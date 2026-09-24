//! Le planning qui se tient seul : chaque tâche part à son heure, sans clic.
//!
//! Jusqu'au 24/09/2026 la `planification` des fiches (tous les jours à 19h,
//! chaque vendredi, le 5 du mois…) était lue, affichée à l'écran et écrite dans
//! le planning du client, et **aucun code ne l'exécutait** : un agent ne
//! travaillait que quand on cliquait dans « Le travail du jour ». Le produit
//! vend un employé qui travaille tous les jours sans qu'on le lui demande ; sans
//! ce module il ne le faisait pas. La réponse du client sur le rythme (léger,
//! normal, soutenu) ne changeait rien non plus.
//!
//! Ce que ce module fait, et seulement ça :
//!
//! - toutes les trente secondes il relit `installation.json` et les fiches — un
//!   réglage changé par le client ou par le Team Holder vaut au passage suivant,
//!   sans redémarrage ;
//! - il lance, par `executer_tache` et rien d'autre, chaque tâche dont
//!   l'échéance est passée et qui n'a pas tourné depuis. Les refus (tâche
//!   éteinte, dossier non choisi, machine qui ne tient pas en « tout local »)
//!   restent donc ceux de l'exécution : ils s'écrivent au journal avec leur
//!   motif, rien ne se dégrade en silence ;
//! - une application fermée à l'heure dite rattrape **une fois** chaque tâche
//!   manquée au lancement suivant, et le journal dit qu'elle est partie en
//!   retard et combien de passages ont sauté. Rejouer chaque passage manqué
//!   ferait écrire à l'agent sept états du jour d'un coup un lundi matin ;
//! - la même tâche du même agent ne part jamais deux fois en même temps, qu'on
//!   ait cliqué ou que l'heure soit venue (`occuper`).
//!
//! Ce qu'il ne fait pas : les tâches `declencheur` (courriel reçu, fichier
//! déposé…) attendent un événement que personne n'écoute encore, et les tâches
//! `a-la-demande` partent quand on les demande. La profondeur du rythme soutenu
//! (plus de tours par exécution) n'est pas appliquée : une exécution est un seul
//! appel au modèle aujourd'hui.

use chrono::{
    Datelike, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Timelike, Weekday,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Mutex;

/// Un regard toutes les trente secondes : une tâche part au plus une demi-minute
/// après son heure, et relire deux petits fichiers ne coûte rien.
const TOUR: std::time::Duration = std::time::Duration::from_secs(30);
/// Le premier regard attend que l'application ait fini de démarrer : la voix,
/// la jauge et le moteur local se lèvent pendant ce temps.
const PREMIER_REGARD: std::time::Duration = std::time::Duration::from_secs(20);

/// Les tâches quotidiennes tournent du lundi au vendredi.
///
/// C'est ce que l'agent annonce au client à l'entretien d'embauche (« mes
/// tâches tournent entre 9h et 17h30, du lundi au vendredi »,
/// `questionsCadre`), donc ce que le client attend de voir. Le tableau
/// d'économie, lui, compte 30 jours par mois : il surestime un peu la facture
/// d'API d'une tâche quotidienne, ce qui est le sens prudent.
pub const QUOTIDIENNE_EN_SEMAINE_SEULEMENT: bool = true;

/// Au-delà, un passage est dit « en retard » dans le journal.
const RETARD_TOLERE_MINUTES: i64 = 10;

// --- ce que le client a réglé ------------------------------------------------

/// Le rythme choisi à l'entretien : combien de fois l'agent passe.
///
/// Mêmes valeurs et mêmes multiplicateurs que `dimensionnement/intensite.ts`,
/// qui en tire le coût annoncé au client : léger passe deux fois moins souvent,
/// soutenu deux fois plus. Le chiffre annoncé et ce qui tourne doivent dire la
/// même chose.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Intensite {
    Light,
    Medium,
    High,
}

impl Intensite {
    pub fn lire(v: Option<&Value>) -> Option<Intensite> {
        match v.and_then(Value::as_str)? {
            "light" => Some(Intensite::Light),
            "medium" => Some(Intensite::Medium),
            "high" => Some(Intensite::High),
            _ => None,
        }
    }

    /// Ce que le client a répondu, et « normal » s'il n'a rien dit : normal,
    /// c'est la fiche telle qu'elle est écrite.
    pub fn du_client(agent: &Value) -> Intensite {
        Intensite::lire(agent.get("intensite")).unwrap_or(Intensite::Medium)
    }

    fn frequence(self) -> f64 {
        match self {
            Intensite::Light => 0.5,
            Intensite::Medium => 1.0,
            Intensite::High => 2.0,
        }
    }
}

/// Une planification de la fiche, lue une fois pour toutes.
#[derive(Debug, Clone, PartialEq)]
pub enum Rythme {
    Quotidienne { heure: NaiveTime },
    Hebdomadaire { jour: Weekday, heure: NaiveTime },
    Mensuelle { jour: u32, heure: NaiveTime },
    Intervalle { minutes: i64 },
    Declencheur { evenement: String },
    ALaDemande,
}

fn heure(v: Option<&Value>) -> Result<NaiveTime, String> {
    let texte = v.and_then(Value::as_str).ok_or("heure absente")?;
    NaiveTime::parse_from_str(texte, "%H:%M").map_err(|_| format!("heure illisible : {}", texte))
}

fn jour_de_semaine(v: Option<&Value>) -> Result<Weekday, String> {
    Ok(match v.and_then(Value::as_str).ok_or("jour absent")? {
        "lundi" => Weekday::Mon,
        "mardi" => Weekday::Tue,
        "mercredi" => Weekday::Wed,
        "jeudi" => Weekday::Thu,
        "vendredi" => Weekday::Fri,
        "samedi" => Weekday::Sat,
        "dimanche" => Weekday::Sun,
        autre => return Err(format!("jour illisible : {}", autre)),
    })
}

/// Lit une `planification` telle que le contrat de paquet la décrit.
///
/// Une planification inconnue est une erreur, jamais un « à la demande » par
/// défaut : c'est exactement la faute qui a compté 3 407 tâches hebdomadaires
/// à cinq passages par jour le 23/09.
pub fn lire_rythme(p: &Value) -> Result<Rythme, String> {
    match p.get("type").and_then(Value::as_str).ok_or("planification sans type")? {
        "quotidienne" => Ok(Rythme::Quotidienne { heure: heure(p.get("heure"))? }),
        "hebdomadaire" => Ok(Rythme::Hebdomadaire {
            jour: jour_de_semaine(p.get("jour"))?,
            heure: heure(p.get("heure"))?,
        }),
        "mensuelle" => {
            let jour = p.get("jour").and_then(Value::as_u64).ok_or("quantième absent")?;
            if !(1..=28).contains(&jour) {
                return Err(format!("quantième hors de 1 à 28 : {}", jour));
            }
            Ok(Rythme::Mensuelle { jour: jour as u32, heure: heure(p.get("heure"))? })
        }
        "intervalle" => {
            let minutes = p.get("minutes").and_then(Value::as_i64).ok_or("intervalle sans minutes")?;
            if minutes < 5 {
                return Err(format!("intervalle de moins de cinq minutes : {}", minutes));
            }
            Ok(Rythme::Intervalle { minutes })
        }
        "declencheur" => Ok(Rythme::Declencheur {
            evenement: p
                .get("evenement")
                .and_then(Value::as_str)
                .ok_or("déclencheur sans événement")?
                .to_string(),
        }),
        "a-la-demande" => Ok(Rythme::ALaDemande),
        autre => Err(format!("planification inconnue : {}", autre)),
    }
}

// --- les échéances -----------------------------------------------------------
//
// Tout se calcule en heure locale « nue » (sans fuseau) : 19h00 sur la fiche,
// c'est 19h00 à l'horloge du client, été comme hiver. La conversion vers
// l'instant réel n'a lieu qu'au bord, dans `vers_epoque`.

fn en_semaine(d: NaiveDate) -> bool {
    !matches!(d.weekday(), Weekday::Sat | Weekday::Sun)
}

/// Rythme léger : un passage sur deux, choisi par la parité du jour, de la
/// semaine ou du mois. Stable d'un lancement à l'autre, sans rien retenir.
fn jour_pair(d: NaiveDate) -> bool {
    d.num_days_from_ce() % 2 == 0
}

fn semaine_paire(d: NaiveDate) -> bool {
    let lundi = d.num_days_from_ce() - d.weekday().num_days_from_monday() as i32;
    lundi.div_euclid(7) % 2 == 0
}

fn mois_pair(d: NaiveDate) -> bool {
    (d.year() * 12 + d.month0() as i32) % 2 == 0
}

/// Rythme soutenu, tâche quotidienne : un second passage six heures après le
/// premier, ou six heures avant s'il tomberait après minuit. 9h donne 15h,
/// 19h donne 13h : l'agent repasse dans la journée, pas la nuit.
fn second_passage(h: NaiveTime) -> NaiveTime {
    if h.hour() < 18 {
        h + Duration::hours(6)
    } else {
        h - Duration::hours(6)
    }
}

/// Rythme soutenu, tâche hebdomadaire : un second passage trois jours plus
/// tard, ramené au lundi s'il tombe un week-end.
fn second_jour(j: Weekday) -> Weekday {
    let d = j.succ().succ().succ();
    match d {
        Weekday::Sat | Weekday::Sun => Weekday::Mon,
        autre => autre,
    }
}

/// Rythme soutenu, tâche mensuelle : un second passage quatorze jours plus
/// tard, dans les 28 premiers jours comme le premier.
fn second_quantieme(q: u32) -> u32 {
    (q - 1 + 14) % 28 + 1
}

/// Les passages d'une tâche calendaire sur une journée, dans l'ordre.
fn passages_du_jour(r: &Rythme, i: Intensite, d: NaiveDate) -> Vec<NaiveDateTime> {
    let mut v = Vec::new();
    match r {
        Rythme::Quotidienne { heure } => {
            if QUOTIDIENNE_EN_SEMAINE_SEULEMENT && !en_semaine(d) {
                return v;
            }
            if i == Intensite::Light && !jour_pair(d) {
                return v;
            }
            v.push(d.and_time(*heure));
            if i == Intensite::High {
                v.push(d.and_time(second_passage(*heure)));
            }
        }
        Rythme::Hebdomadaire { jour, heure } => {
            if d.weekday() == *jour && !(i == Intensite::Light && !semaine_paire(d)) {
                v.push(d.and_time(*heure));
            }
            if i == Intensite::High && second_jour(*jour) != *jour && d.weekday() == second_jour(*jour) {
                v.push(d.and_time(*heure));
            }
        }
        Rythme::Mensuelle { jour, heure } => {
            if d.day() == *jour && !(i == Intensite::Light && !mois_pair(d)) {
                v.push(d.and_time(*heure));
            }
            if i == Intensite::High && d.day() == second_quantieme(*jour) {
                v.push(d.and_time(*heure));
            }
        }
        _ => {}
    }
    v.sort();
    v
}

/// L'écart entre deux passages d'une tâche à intervalle, selon le rythme.
/// Jamais sous cinq minutes, le plancher du contrat.
fn pas_intervalle(minutes: i64, i: Intensite) -> Duration {
    let m = ((minutes as f64) / i.frequence()).round() as i64;
    Duration::minutes(m.max(5))
}

/// Soixante-dix jours couvrent le plus long écart possible entre deux
/// passages : une tâche mensuelle au rythme léger, un mois sur deux.
const FENETRE_JOURS: i64 = 70;

/// Le dernier passage prévu au plus tard `maintenant`, et pas avant `ancre`
/// (le moment où la tâche est entrée dans le planning). `None` pour ce qui ne
/// se planifie pas à l'heure.
pub fn derniere_echeance(
    r: &Rythme,
    i: Intensite,
    ancre: NaiveDateTime,
    maintenant: NaiveDateTime,
) -> Option<NaiveDateTime> {
    if maintenant < ancre {
        return None;
    }
    match r {
        Rythme::Intervalle { minutes } => {
            let pas = pas_intervalle(*minutes, i);
            let n = (maintenant - ancre).num_seconds() / pas.num_seconds();
            (n >= 1).then(|| ancre + pas * n as i32)
        }
        Rythme::Declencheur { .. } | Rythme::ALaDemande => None,
        _ => {
            let mut d = maintenant.date();
            for _ in 0..=FENETRE_JOURS {
                if let Some(p) = passages_du_jour(r, i, d)
                    .into_iter()
                    .rev()
                    .find(|p| *p <= maintenant)
                {
                    return (p >= ancre).then_some(p);
                }
                if d < ancre.date() {
                    return None;
                }
                d = d.pred_opt()?;
            }
            None
        }
    }
}

/// Le prochain passage prévu après `maintenant`, pour l'écran.
pub fn prochaine_echeance(
    r: &Rythme,
    i: Intensite,
    ancre: NaiveDateTime,
    maintenant: NaiveDateTime,
) -> Option<NaiveDateTime> {
    match r {
        Rythme::Intervalle { minutes } => {
            let pas = pas_intervalle(*minutes, i);
            if maintenant < ancre {
                return Some(ancre + pas);
            }
            let n = (maintenant - ancre).num_seconds() / pas.num_seconds();
            Some(ancre + pas * (n as i32 + 1))
        }
        Rythme::Declencheur { .. } | Rythme::ALaDemande => None,
        _ => {
            let mut d = maintenant.date();
            for _ in 0..=FENETRE_JOURS {
                if let Some(p) = passages_du_jour(r, i, d).into_iter().find(|p| *p > maintenant) {
                    return Some(p);
                }
                d = d.succ_opt()?;
            }
            None
        }
    }
}

/// Combien de passages tombaient dans `]apres, jusqua]`. Borné : au-delà
/// d'une année d'absence, le chiffre exact n'apprend plus rien à personne.
pub fn passages_entre(r: &Rythme, i: Intensite, apres: NaiveDateTime, jusqua: NaiveDateTime) -> usize {
    if jusqua <= apres {
        return 0;
    }
    match r {
        Rythme::Intervalle { minutes } => {
            let pas = pas_intervalle(*minutes, i).num_seconds();
            (((jusqua - apres).num_seconds() / pas) as usize).min(100_000)
        }
        Rythme::Declencheur { .. } | Rythme::ALaDemande => 0,
        _ => {
            let mut n = 0;
            let mut d = apres.date();
            for _ in 0..=366 {
                if d > jusqua.date() {
                    break;
                }
                n += passages_du_jour(r, i, d)
                    .into_iter()
                    .filter(|p| *p > apres && *p <= jusqua)
                    .count();
                match d.succ_opt() {
                    Some(s) => d = s,
                    None => break,
                }
            }
            n
        }
    }
}

/// Ce qu'il faut lancer maintenant, s'il y a lieu : l'échéance manquée la plus
/// récente, et combien de passages sont tombés depuis le dernier travail fait.
///
/// Une seule exécution même si plusieurs passages ont sauté : c'est la règle
/// du rattrapage. Un travail commencé à l'échéance ou après la satisfait, qu'il
/// soit parti de l'horloge ou d'un clic.
pub fn a_lancer(
    r: &Rythme,
    i: Intensite,
    depuis: NaiveDateTime,
    dernier_debut: Option<NaiveDateTime>,
    maintenant: NaiveDateTime,
) -> Option<(NaiveDateTime, usize)> {
    let prevue = derniere_echeance(r, i, depuis, maintenant)?;
    if dernier_debut.map_or(false, |d| d >= prevue) {
        return None;
    }
    // Comptés depuis le dernier travail, qui a honoré son propre passage, ou
    // depuis l'entrée au planning, dont le passage pile à l'heure compte.
    let depart = match dernier_debut {
        Some(d) if d > depuis => d,
        _ => depuis - Duration::seconds(1),
    };
    let manquees = passages_entre(r, i, depart, maintenant).max(1);
    Some((prevue, manquees))
}

// --- les tâches d'un agent, telles que le client les a réglées ---------------

/// Une tâche du planning d'un agent, avec ce que le client en a changé.
#[derive(Debug, Clone)]
pub struct TacheDuPlanning {
    pub id: String,
    pub nom: String,
    pub planification: Value,
    pub active: bool,
}

fn booleen(v: Option<&Value>) -> Option<bool> {
    v.and_then(Value::as_bool)
}

/// Les tâches de la fiche et celles que le client a ajoutées, réglées par
/// `planning.ajustements`.
///
/// Même règle que `lire_tache` dans `tache.rs`, qui reste le dernier mot :
/// `executer_tache` refuse de toute façon une tâche éteinte. Les témoins de
/// `temoins-planning.json` sont rejoués ici aussi pour que le planning ne
/// lance pas ce que l'exécution refuserait.
pub fn taches_du_planning(fiche: &Value, agent: &Value) -> Vec<TacheDuPlanning> {
    let ajustements: Vec<&Value> = agent
        .pointer("/planning/ajustements")
        .and_then(Value::as_array)
        .map(|a| a.iter().collect())
        .unwrap_or_default();
    let regle = |id: &str| {
        ajustements
            .iter()
            .copied()
            .find(|a| a.get("tacheId").and_then(Value::as_str) == Some(id))
    };
    let vides = Vec::new();
    let de_la_fiche = fiche.get("taches").and_then(Value::as_array).unwrap_or(&vides);
    let ajoutees = agent
        .pointer("/planning/ajoutees")
        .and_then(Value::as_array)
        .unwrap_or(&vides);

    let mut vues = HashSet::new();
    let mut taches = Vec::new();
    for (t, ajoutee) in de_la_fiche
        .iter()
        .map(|t| (t, false))
        .chain(ajoutees.iter().map(|t| (t, true)))
    {
        let Some(id) = t.get("id").and_then(Value::as_str) else { continue };
        // La fiche d'abord, comme `lire_tache` : un identifiant ajouté qui
        // doublerait celui de la fiche ne s'exécuterait jamais sous ce nom.
        if !vues.insert(id.to_string()) {
            continue;
        }
        let r = regle(id);
        let planification = r
            .and_then(|r| r.get("planification"))
            .or_else(|| t.get("planification"))
            .cloned()
            .unwrap_or(Value::Null);
        taches.push(TacheDuPlanning {
            id: id.to_string(),
            nom: t.get("nom").and_then(Value::as_str).unwrap_or(id).to_string(),
            planification,
            active: booleen(r.and_then(|r| r.get("active")))
                .or_else(|| booleen(t.get("active")))
                .unwrap_or(ajoutee),
        });
    }
    taches
}

// --- ce que le planning retient d'un lancement à l'autre --------------------

/// Le suivi d'une tâche, gardé dans `config/planning-etat.json`.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Suivi {
    /// Depuis quand la tâche est dans le planning sous ce réglage (instant Unix).
    /// Rien d'avant ne se rattrape : un agent embauché à 14h ne rend pas à 14h
    /// le travail de 9h, et une heure déplacée ne fait pas partir la tâche
    /// aussitôt.
    pub depuis: i64,
    /// Le réglage vu la dernière fois : planification, rythme, allumage.
    pub empreinte: String,
    /// Le début du dernier travail de cette tâche, parti de l'horloge ou d'un clic.
    pub dernier_debut: Option<i64>,
    /// Posé par le planning quand il lance, retiré quand il a fini. Présent au
    /// démarrage, il dit que l'application s'est arrêtée en plein travail.
    pub en_cours_depuis: Option<i64>,
}

type Etat = HashMap<String, Suivi>;

fn cle(prenom: &str, fiche_id: &str, tache_id: &str) -> String {
    format!("{}|{}|{}", prenom, fiche_id, tache_id)
}

fn dossier_config() -> PathBuf {
    crate::fiches::dossier_ressources().join("config")
}

fn chemin_etat() -> PathBuf {
    dossier_config().join("planning-etat.json")
}

fn chemin_journal() -> PathBuf {
    dossier_config().join("planning-journal.jsonl")
}

/// Un seul verrou pour lire, changer et réécrire l'état : le planning et un
/// clic qui finit au même moment ne s'écrasent pas l'un l'autre.
static ETAT: Mutex<()> = Mutex::new(());

fn lire_etat() -> Etat {
    std::fs::read_to_string(chemin_etat())
        .ok()
        .and_then(|b| serde_json::from_str(&b).ok())
        .unwrap_or_default()
}

fn ecrire_etat(etat: &Etat) {
    let chemin = chemin_etat();
    if let Some(parent) = chemin.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // Même précaution qu'`installation_ecrire` : un fichier tronqué par une
    // coupure ferait tout rattraper, ou rien.
    if let Ok(brut) = serde_json::to_string_pretty(etat) {
        let provisoire = chemin.with_extension("json.nouveau");
        if std::fs::write(&provisoire, brut).is_ok() {
            let _ = std::fs::rename(&provisoire, &chemin);
        }
    }
}

fn changer_etat<T>(f: impl FnOnce(&mut Etat) -> T) -> T {
    let _verrou = ETAT.lock().unwrap_or_else(|e| e.into_inner());
    let mut etat = lire_etat();
    let r = f(&mut etat);
    ecrire_etat(&etat);
    r
}

// --- une tâche ne part jamais deux fois en même temps ------------------------

static EN_COURS: Mutex<Option<HashSet<String>>> = Mutex::new(None);

/// Tenu tant qu'une tâche travaille. Posé au début d'`executer_tache` :
/// `let _garde = planificateur::occuper(&prenom, &fiche_id, &tache_id)?;`
///
/// Refuse la même tâche du même agent tant qu'elle tourne, que le premier
/// lancement vienne de l'horloge ou d'un clic. En la relâchant, retient
/// l'heure où elle a commencé : un travail fait après l'échéance la satisfait.
pub struct Garde {
    cle: String,
    debut: i64,
}

pub fn occuper(prenom: &str, fiche_id: &str, tache_id: &str) -> Result<Garde, String> {
    let c = cle(prenom, fiche_id, tache_id);
    let mut en_cours = EN_COURS.lock().unwrap_or_else(|e| e.into_inner());
    let ensemble = en_cours.get_or_insert_with(HashSet::new);
    if !ensemble.insert(c.clone()) {
        return Err(format!(
            "{} fait déjà cette tâche en ce moment : elle ne part pas deux fois à la fois",
            prenom
        ));
    }
    Ok(Garde { cle: c, debut: epoque_maintenant() })
}

/// Combien de tâches tournent en ce moment. Pour la mise à jour automatique,
/// qui ne doit s'installer qu'au calme : elle et le planning doivent dire la
/// même chose de « une tâche tourne ».
#[allow(dead_code)]
pub fn en_cours() -> usize {
    EN_COURS
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .map_or(0, HashSet::len)
}

impl Drop for Garde {
    fn drop(&mut self) {
        if let Some(e) = EN_COURS.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
            e.remove(&self.cle);
        }
        let (cle, debut) = (self.cle.clone(), self.debut);
        changer_etat(|etat| {
            let s = etat.entry(cle).or_insert_with(|| Suivi { depuis: debut, ..Suivi::default() });
            s.dernier_debut = Some(s.dernier_debut.map_or(debut, |d| d.max(debut)));
        });
    }
}

// --- l'heure ------------------------------------------------------------------

fn epoque_maintenant() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn vers_local(epoque: i64) -> NaiveDateTime {
    Local
        .timestamp_opt(epoque, 0)
        .earliest()
        .map(|t| t.naive_local())
        .unwrap_or_default()
}

/// L'instant réel d'une heure locale. Au passage à l'heure d'été, 2h30
/// n'existe pas : on prend l'heure d'après plutôt que de sauter la tâche.
fn vers_epoque(local: NaiveDateTime) -> i64 {
    Local
        .from_local_datetime(&local)
        .earliest()
        .or_else(|| Local.from_local_datetime(&(local + Duration::hours(1))).earliest())
        .map(|t| t.timestamp())
        .unwrap_or(0)
}

fn en_clair(local: NaiveDateTime) -> String {
    const JOURS: [&str; 7] = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    format!(
        "{} {:02}/{:02} à {:02}:{:02}",
        JOURS[local.weekday().num_days_from_monday() as usize],
        local.day(),
        local.month(),
        local.hour(),
        local.minute()
    )
}

fn duree_en_clair(minutes: i64) -> String {
    match minutes {
        m if m < 60 => format!("{} min", m),
        m if m < 48 * 60 => format!("{} h {:02}", m / 60, m % 60),
        m => format!("{} jours", m / (24 * 60)),
    }
}

// --- le journal ----------------------------------------------------------------

/// Un passage du planning, tel que le client peut le relire.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Passage {
    pub prenom: String,
    pub fiche_id: String,
    pub tache_id: String,
    pub tache: String,
    /// L'échéance que ce passage honore, et quand il est vraiment parti.
    pub prevue: i64,
    pub lancee: i64,
    pub finie: i64,
    pub retard_minutes: i64,
    /// Vrai quand l'application était fermée à l'heure prévue.
    pub rattrapage: bool,
    /// Combien de passages sont tombés depuis le dernier travail ; un seul est fait.
    pub manquees: usize,
    /// Vrai quand l'application s'était arrêtée pendant ce travail la fois d'avant.
    pub reprise: bool,
    pub fichier: Option<String>,
    pub erreur: Option<String>,
    pub voie: Option<String>,
    pub motif: Option<String>,
    pub validation_humaine: bool,
    /// Le passage dit en une phrase, pour l'écran et pour le Team Holder.
    pub message: String,
}

/// La phrase du journal. Rendue à part pour être éprouvée.
pub fn message_du_passage(
    prenom: &str,
    tache: &str,
    prevue: NaiveDateTime,
    retard_minutes: i64,
    rattrapage: bool,
    manquees: usize,
    reprise: bool,
    issue: &Result<(String, bool), String>,
) -> String {
    let mut m = format!("{} : « {} », prévue {}", prenom, tache, en_clair(prevue));
    if retard_minutes > RETARD_TOLERE_MINUTES {
        m.push_str(&format!(", partie avec {} de retard", duree_en_clair(retard_minutes)));
        if rattrapage {
            m.push_str(" (l'application était fermée à l'heure prévue)");
        }
    }
    if manquees > 1 {
        m.push_str(&format!(
            " ; {} passages manqués, un seul rattrapé",
            manquees
        ));
    }
    if reprise {
        m.push_str(" ; reprise, l'application s'était arrêtée pendant ce travail");
    }
    match issue {
        Ok((fichier, relire)) => {
            m.push_str(&format!(". Résultat : {}", fichier));
            if *relire {
                m.push_str(", à relire avant usage");
            }
            m.push('.');
        }
        Err(e) => m.push_str(&format!(". Pas faite : {}.", e.trim_end_matches('.'))),
    }
    m
}

fn journaliser(p: &Passage) {
    use std::io::Write;
    let chemin = chemin_journal();
    if let Some(parent) = chemin.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let (Ok(ligne), Ok(mut f)) = (
        serde_json::to_string(p),
        std::fs::OpenOptions::new().create(true).append(true).open(&chemin),
    ) {
        let _ = writeln!(f, "{}", ligne);
    }
}

/// Les derniers passages du planning, les plus récents d'abord.
#[tauri::command]
pub fn planning_journal(limite: Option<usize>) -> Vec<Passage> {
    let brut = std::fs::read_to_string(chemin_journal()).unwrap_or_default();
    let mut v: Vec<Passage> = brut.lines().filter_map(|l| serde_json::from_str(l).ok()).collect();
    v.reverse();
    v.truncate(limite.unwrap_or(50));
    v
}

// --- ce que l'écran peut montrer ----------------------------------------------

/// Une tâche du planning et son prochain passage.
#[derive(Debug, Clone, Serialize)]
pub struct Prevision {
    pub prenom: String,
    pub fiche_id: String,
    pub tache_id: String,
    pub tache: String,
    pub intensite: Intensite,
    pub active: bool,
    /// Instant Unix du prochain passage, absent pour ce qui ne part pas à l'heure.
    pub prochaine: Option<i64>,
    pub prochaine_en_clair: Option<String>,
    /// Pourquoi rien ne partira à l'heure, quand c'est le cas.
    pub remarque: Option<String>,
}

/// Le planning de tous les agents : ce qui partira, quand, et ce qui ne partira pas seul.
#[tauri::command]
pub fn planning_etat() -> Result<Vec<Prevision>, String> {
    let installation: Value = serde_json::from_str(&crate::fiches::lire_installation()?)
        .map_err(|e| format!("installation illisible : {}", e))?;
    let etat = {
        let _verrou = ETAT.lock().unwrap_or_else(|e| e.into_inner());
        lire_etat()
    };
    let maintenant = epoque_maintenant();
    let local = vers_local(maintenant);
    let mut v = Vec::new();
    for agent in installation.get("agents").and_then(Value::as_array).into_iter().flatten() {
        let (Some(prenom), Some(fiche_id)) = (
            agent.get("prenom").and_then(Value::as_str),
            agent.get("ficheId").and_then(Value::as_str),
        ) else {
            continue;
        };
        let Ok(fiche) = crate::fiches::lire_fiche(fiche_id.to_string())
            .and_then(|f| serde_json::from_str::<Value>(&f).map_err(|e| e.to_string()))
        else {
            continue;
        };
        let intensite = Intensite::du_client(agent);
        for t in taches_du_planning(&fiche, agent) {
            let depuis = etat
                .get(&cle(prenom, fiche_id, &t.id))
                .map_or(maintenant, |s| s.depuis);
            let (prochaine, remarque) = match lire_rythme(&t.planification) {
                Err(e) => (None, Some(format!("horaire illisible, la tâche ne part pas seule : {}", e))),
                Ok(_) if !t.active => (None, Some("éteinte".to_string())),
                Ok(Rythme::ALaDemande) => (None, Some("à la demande".to_string())),
                Ok(Rythme::Declencheur { evenement }) => (
                    None,
                    Some(format!("attend un événement ({}) que l'application n'écoute pas encore", evenement)),
                ),
                Ok(r) => (prochaine_echeance(&r, intensite, vers_local(depuis), local), None),
            };
            v.push(Prevision {
                prenom: prenom.to_string(),
                fiche_id: fiche_id.to_string(),
                tache_id: t.id,
                tache: t.nom,
                intensite,
                active: t.active,
                prochaine: prochaine.map(vers_epoque),
                prochaine_en_clair: prochaine.map(en_clair),
                remarque,
            });
        }
    }
    Ok(v)
}

// --- la boucle -----------------------------------------------------------------

/// Ce qu'un tour a décidé de lancer.
#[derive(Debug, Clone)]
struct ALancer {
    prenom: String,
    fiche_id: String,
    tache_id: String,
    tache: String,
    prevue: NaiveDateTime,
    manquees: usize,
    reprise: bool,
}

/// Relit l'installation et dit ce qui est dû. Tient l'état à jour au passage :
/// une tâche nouvelle ou réglée autrement repart de maintenant.
fn ce_qui_est_du(installation: &Value, maintenant: i64) -> Vec<ALancer> {
    let local = vers_local(maintenant);
    let mut dus = Vec::new();
    changer_etat(|etat| {
        for agent in installation.get("agents").and_then(Value::as_array).into_iter().flatten() {
            let (Some(prenom), Some(fiche_id)) = (
                agent.get("prenom").and_then(Value::as_str),
                agent.get("ficheId").and_then(Value::as_str),
            ) else {
                continue;
            };
            let Ok(fiche) = crate::fiches::lire_fiche(fiche_id.to_string())
                .and_then(|f| serde_json::from_str::<Value>(&f).map_err(|e| e.to_string()))
            else {
                continue;
            };
            let intensite = Intensite::du_client(agent);
            for t in taches_du_planning(&fiche, agent) {
                let Ok(rythme) = lire_rythme(&t.planification) else { continue };
                let empreinte = format!("{}|{:?}|{}", t.planification, intensite, t.active);
                let s = etat
                    .entry(cle(prenom, fiche_id, &t.id))
                    .or_insert_with(|| Suivi { depuis: maintenant, ..Suivi::default() });
                // Nouvelle, déplacée, rallumée ou passée à un autre rythme : on
                // repart de maintenant. Rien de ce qui précède ne se rattrape.
                if s.empreinte != empreinte || !t.active {
                    s.depuis = maintenant;
                    s.empreinte = empreinte;
                }
                if !t.active {
                    continue;
                }
                let dernier = s.dernier_debut.map(vers_local);
                if let Some((prevue, manquees)) =
                    a_lancer(&rythme, intensite, vers_local(s.depuis), dernier, local)
                {
                    dus.push(ALancer {
                        prenom: prenom.to_string(),
                        fiche_id: fiche_id.to_string(),
                        tache_id: t.id.clone(),
                        tache: t.nom.clone(),
                        prevue,
                        manquees,
                        reprise: s.en_cours_depuis.is_some(),
                    });
                }
            }
        }
    });
    // Le plus en retard d'abord.
    dus.sort_by_key(|d| d.prevue);
    dus
}

/// Démarre le planning. Appelé une fois, au lancement de l'application.
pub fn demarrer(app: tauri::AppHandle) {
    let lancement = epoque_maintenant();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(PREMIER_REGARD).await;
        loop {
            tour(&app, lancement).await;
            tokio::time::sleep(TOUR).await;
        }
    });
}

async fn tour(app: &tauri::AppHandle, lancement: i64) {
    use tauri::{Emitter, Manager};

    let Ok(installation) = crate::fiches::lire_installation()
        .and_then(|b| serde_json::from_str::<Value>(&b).map_err(|e| e.to_string()))
    else {
        return;
    };

    // Les tâches dues partent l'une après l'autre : les agents d'une machine
    // se relaient sur le même modèle local, et dix tâches de 9h lancées d'un
    // coup se disputeraient la carte au lieu d'avancer.
    for d in ce_qui_est_du(&installation, epoque_maintenant()) {
        let c = cle(&d.prenom, &d.fiche_id, &d.tache_id);
        let lancee = epoque_maintenant();
        changer_etat(|etat| {
            if let Some(s) = etat.get_mut(&c) {
                s.en_cours_depuis = Some(lancee);
            }
        });

        let issue = crate::executer_tache(
            d.prenom.clone(),
            d.fiche_id.clone(),
            d.tache_id.clone(),
            app.state::<crate::AppState>(),
        )
        .await;
        let finie = epoque_maintenant();

        // Le travail a-t-il vraiment commencé ? `occuper` retient son début en
        // se relâchant. S'il n'a rien retenu, la tâche a été refusée avant de
        // démarrer — elle tournait déjà sur un clic, ou une mise à jour
        // s'installe — et elle repartira au tour suivant, sans rien écrire.
        let commence = changer_etat(|etat| match etat.get_mut(&c) {
            Some(s) => {
                s.en_cours_depuis = None;
                s.dernier_debut.map_or(false, |debut| debut >= lancee)
            }
            None => false,
        });
        if !commence {
            continue;
        }

        let retard_minutes = (lancee - vers_epoque(d.prevue)).max(0) / 60;
        let rattrapage = vers_epoque(d.prevue) < lancement;
        let resume = issue
            .as_ref()
            .map(|r| (r.fichier.clone(), r.validation_humaine))
            .map_err(Clone::clone);
        let passage = Passage {
            message: message_du_passage(
                &d.prenom,
                &d.tache,
                d.prevue,
                retard_minutes,
                rattrapage,
                d.manquees,
                d.reprise,
                &resume,
            ),
            prenom: d.prenom,
            fiche_id: d.fiche_id,
            tache_id: d.tache_id,
            tache: d.tache,
            prevue: vers_epoque(d.prevue),
            lancee,
            finie,
            retard_minutes,
            rattrapage,
            manquees: d.manquees,
            reprise: d.reprise,
            fichier: issue.as_ref().ok().map(|r| r.fichier.clone()),
            erreur: issue.as_ref().err().cloned(),
            voie: issue.as_ref().ok().map(|r| r.voie.clone()),
            motif: issue.as_ref().ok().map(|r| r.motif.clone()),
            validation_humaine: issue.as_ref().map_or(false, |r| r.validation_humaine),
        };
        journaliser(&passage);
        // L'écran rafraîchit « Le travail du jour » sans qu'on clique.
        let _ = app.emit("planning-passage", &passage);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn t(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
    }

    fn r(v: Value) -> Rythme {
        lire_rythme(&v).unwrap()
    }

    // 2026-09-24 est un jeudi.
    const JEUDI: &str = "2026-09-24";

    #[test]
    fn les_six_planifications_du_contrat_se_lisent_et_une_inconnue_est_refusee() {
        let schema: Value = serde_json::from_str(include_str!(
            "../../../contrat/paquet-agent.schema.json"
        ))
        .unwrap();
        let variantes = schema
            .pointer("/properties/taches/items/properties/planification/oneOf")
            .and_then(Value::as_array)
            .expect("le schéma a changé de forme : ce banc ne sait plus où lire les planifications");
        assert_eq!(variantes.len(), 6, "une planification est apparue ou a disparu du contrat");
        for v in variantes {
            let type_ = v.pointer("/properties/type/const").and_then(Value::as_str).unwrap();
            let exemple = match type_ {
                "quotidienne" => json!({"type": type_, "heure": "09:00"}),
                "hebdomadaire" => json!({"type": type_, "jour": "vendredi", "heure": "10:00"}),
                "mensuelle" => json!({"type": type_, "jour": 5, "heure": "08:00"}),
                "intervalle" => json!({"type": type_, "minutes": 30}),
                "declencheur" => json!({"type": type_, "evenement": "email.recu"}),
                "a-la-demande" => json!({"type": type_}),
                autre => panic!("planification que le planning ne connaît pas : {}", autre),
            };
            assert!(lire_rythme(&exemple).is_ok(), "{}", exemple);
        }
        assert!(lire_rythme(&json!({"type": "de-temps-en-temps"})).is_err());
        assert!(lire_rythme(&json!({"type": "quotidienne", "heure": "7h"})).is_err());
        assert!(lire_rythme(&json!({"type": "mensuelle", "jour": 31, "heure": "09:00"})).is_err());
        assert!(lire_rythme(&json!({"type": "intervalle", "minutes": 2})).is_err());
    }

    #[test]
    fn une_tache_quotidienne_part_a_son_heure_et_pas_avant() {
        let q = r(json!({"type": "quotidienne", "heure": "19:00"}));
        let ancre = t(&format!("{} 08:00", JEUDI));
        let m = Intensite::Medium;
        assert_eq!(a_lancer(&q, m, ancre, None, t(&format!("{} 18:59", JEUDI))), None);
        assert_eq!(
            a_lancer(&q, m, ancre, None, t(&format!("{} 19:00", JEUDI))),
            Some((t(&format!("{} 19:00", JEUDI)), 1))
        );
    }

    #[test]
    fn une_tache_faite_ne_repart_pas_avant_l_echeance_suivante() {
        let q = r(json!({"type": "quotidienne", "heure": "19:00"}));
        let ancre = t("2026-09-24 08:00");
        let fait = Some(t("2026-09-24 19:00"));
        assert_eq!(a_lancer(&q, Intensite::Medium, ancre, fait, t("2026-09-24 23:00")), None);
        assert_eq!(
            a_lancer(&q, Intensite::Medium, ancre, fait, t("2026-09-25 19:00")).map(|x| x.0),
            Some(t("2026-09-25 19:00"))
        );
    }

    #[test]
    fn un_agent_embauche_apres_l_heure_ne_rattrape_pas_la_journee() {
        // Embauché à 14h, sa tâche de 9h part demain, pas maintenant.
        let q = r(json!({"type": "quotidienne", "heure": "09:00"}));
        let ancre = t("2026-09-24 14:00");
        assert_eq!(a_lancer(&q, Intensite::Medium, ancre, None, t("2026-09-24 14:00")), None);
        assert_eq!(
            prochaine_echeance(&q, Intensite::Medium, ancre, t("2026-09-24 14:00")),
            Some(t("2026-09-25 09:00"))
        );
    }

    #[test]
    fn application_fermee_trois_jours_une_seule_execution_et_le_compte_des_manquees() {
        // Faite mardi 19h, application fermée jusqu'au vendredi 10h : mercredi
        // et jeudi 19h ont sauté. Une seule exécution, celle de jeudi, et le
        // journal dira deux passages manqués.
        let q = r(json!({"type": "quotidienne", "heure": "19:00"}));
        let ancre = t("2026-09-01 08:00");
        let fait = Some(t("2026-09-22 19:00"));
        assert_eq!(
            a_lancer(&q, Intensite::Medium, ancre, fait, t("2026-09-25 10:00")),
            Some((t("2026-09-24 19:00"), 2))
        );
    }

    #[test]
    fn un_travail_lance_d_un_clic_apres_l_echeance_la_satisfait() {
        let q = r(json!({"type": "quotidienne", "heure": "09:00"}));
        let ancre = t("2026-09-20 08:00");
        // Cliqué à 9h05 : le planning ne relance pas.
        assert_eq!(a_lancer(&q, Intensite::Medium, ancre, Some(t("2026-09-24 09:05")), t("2026-09-24 09:06")), None);
        // Cliqué à 8h55 : c'était le travail d'avant l'heure, celui de 9h part quand même.
        assert!(a_lancer(&q, Intensite::Medium, ancre, Some(t("2026-09-24 08:55")), t("2026-09-24 09:00")).is_some());
    }

    #[test]
    fn la_quotidienne_suit_ce_que_l_agent_annonce_a_l_entretien_du_lundi_au_vendredi() {
        let q = r(json!({"type": "quotidienne", "heure": "09:00"}));
        // Samedi 26 et dimanche 27 : rien ; lundi 28 : oui.
        assert_eq!(
            prochaine_echeance(&q, Intensite::Medium, t("2026-09-25 10:00"), t("2026-09-25 10:00")),
            Some(t("2026-09-28 09:00"))
        );
    }

    #[test]
    fn hebdomadaire_et_mensuelle_tombent_le_bon_jour() {
        let h = r(json!({"type": "hebdomadaire", "jour": "vendredi", "heure": "10:00"}));
        assert_eq!(
            prochaine_echeance(&h, Intensite::Medium, t("2026-09-24 08:00"), t("2026-09-24 08:00")),
            Some(t("2026-09-25 10:00"))
        );
        let m = r(json!({"type": "mensuelle", "jour": 5, "heure": "08:00"}));
        assert_eq!(
            prochaine_echeance(&m, Intensite::Medium, t("2026-09-24 08:00"), t("2026-09-24 08:00")),
            Some(t("2026-10-05 08:00"))
        );
        // Une mensuelle manquée en septembre se rattrape en octobre, une fois.
        assert_eq!(
            a_lancer(&m, Intensite::Medium, t("2026-08-01 00:00"), Some(t("2026-08-05 08:00")), t("2026-10-01 12:00")),
            Some((t("2026-09-05 08:00"), 1))
        );
    }

    #[test]
    fn le_rythme_leger_passe_deux_fois_moins_souvent_et_le_soutenu_deux_fois_plus() {
        // Les multiplicateurs de `dimensionnement/intensite.ts` : le coût
        // annoncé au client à l'entretien en est tiré, et ce qui tourne doit
        // lui correspondre.
        let debut = t("2026-10-01 00:00");
        let fin = t("2027-10-01 00:00");
        for (planif, nom) in [
            (json!({"type": "quotidienne", "heure": "09:00"}), "quotidienne"),
            (json!({"type": "hebdomadaire", "jour": "mardi", "heure": "09:00"}), "hebdomadaire"),
            (json!({"type": "mensuelle", "jour": 10, "heure": "09:00"}), "mensuelle"),
            (json!({"type": "intervalle", "minutes": 60}), "intervalle"),
        ] {
            let rr = r(planif);
            let normal = passages_entre(&rr, Intensite::Medium, debut, fin) as f64;
            let leger = passages_entre(&rr, Intensite::Light, debut, fin) as f64;
            let soutenu = passages_entre(&rr, Intensite::High, debut, fin) as f64;
            assert!((leger / normal - 0.5).abs() < 0.05, "{} léger : {} contre {}", nom, leger, normal);
            assert!((soutenu / normal - 2.0).abs() < 0.05, "{} soutenu : {} contre {}", nom, soutenu, normal);
        }
    }

    #[test]
    fn les_multiplicateurs_sont_ceux_du_cout_annonce_au_client() {
        // `dimensionnement/intensite.ts` en tire le chiffre dit à l'entretien.
        let ts = include_str!("../../../dimensionnement/intensite.ts");
        for (cle, i) in [("light", Intensite::Light), ("medium", Intensite::Medium), ("high", Intensite::High)] {
            let bloc = &ts[ts.find(&format!("  {}: {{", cle)).unwrap_or_else(|| panic!("{} absent", cle))..];
            let apres = &bloc[bloc.find("frequence:").unwrap() + "frequence:".len()..];
            let chiffre: f64 = apres[..apres.find(',').unwrap()].trim().parse().unwrap();
            assert_eq!(chiffre, i.frequence(), "{} : l'économie dit {}, le planning {}", cle, chiffre, i.frequence());
        }
    }

    #[test]
    fn un_rythme_mal_ecrit_est_refuse_a_l_ecriture_de_l_installation() {
        let bonne = r#"{"agents":[{"prenom":"Marie","ficheId":"AG-0028","intensite":"high"}]}"#;
        assert!(crate::fiches::installation_recevable(bonne).is_ok());
        for mauvaise in [r#""soutenu""#, r#""High""#, "2", "true"] {
            let c = format!(r#"{{"agents":[{{"prenom":"Marie","ficheId":"AG-0028","intensite":{}}}]}}"#, mauvaise);
            assert!(crate::fiches::installation_recevable(&c).is_err(), "{}", mauvaise);
        }
        assert_eq!(Intensite::du_client(&json!({})), Intensite::Medium, "sans réponse, la fiche telle qu'écrite");
    }

    #[test]
    fn au_rythme_soutenu_l_agent_repasse_dans_la_journee_pas_la_nuit() {
        assert_eq!(second_passage(NaiveTime::from_hms_opt(9, 0, 0).unwrap()), NaiveTime::from_hms_opt(15, 0, 0).unwrap());
        assert_eq!(second_passage(NaiveTime::from_hms_opt(19, 0, 0).unwrap()), NaiveTime::from_hms_opt(13, 0, 0).unwrap());
        for j in [Weekday::Mon, Weekday::Tue, Weekday::Wed, Weekday::Thu, Weekday::Fri] {
            assert!(!matches!(second_jour(j), Weekday::Sat | Weekday::Sun), "{:?}", j);
            assert_ne!(second_jour(j), j);
        }
        for q in 1..=28 {
            let s = second_quantieme(q);
            assert!((1..=28).contains(&s) && s != q, "{} → {}", q, s);
        }
    }

    #[test]
    fn un_intervalle_part_toutes_les_n_minutes_depuis_son_entree_au_planning() {
        let i = r(json!({"type": "intervalle", "minutes": 30}));
        let ancre = t("2026-09-24 09:00");
        assert_eq!(a_lancer(&i, Intensite::Medium, ancre, None, t("2026-09-24 09:29")), None);
        assert_eq!(
            a_lancer(&i, Intensite::Medium, ancre, None, t("2026-09-24 09:30")),
            Some((t("2026-09-24 09:30"), 1))
        );
        // Soutenu : toutes les quinze minutes. Jamais sous cinq.
        assert_eq!(pas_intervalle(30, Intensite::High), Duration::minutes(15));
        assert_eq!(pas_intervalle(5, Intensite::High), Duration::minutes(5));
    }

    #[test]
    fn declencheur_et_a_la_demande_ne_partent_jamais_a_l_heure() {
        let ancre = t("2026-09-01 00:00");
        for p in [json!({"type": "declencheur", "evenement": "email.recu"}), json!({"type": "a-la-demande"})] {
            assert_eq!(a_lancer(&r(p), Intensite::High, ancre, None, t("2026-09-24 12:00")), None);
        }
    }

    #[test]
    fn le_planning_ne_lance_pas_ce_que_l_execution_refuserait() {
        // Les mêmes témoins que `tache.rs` et `check-travail.ts` : une tâche que
        // l'exécution dit éteinte, le planning ne la lance pas.
        let temoins: Value = serde_json::from_str(include_str!("../../temoins-planning.json")).unwrap();
        for cas in temoins["cas"].as_array().unwrap() {
            let fiche = json!({"taches": [{
                "id": "t", "nom": "T",
                "planification": {"type": "quotidienne", "heure": "09:00"},
                "active": cas["fiche"]["active"],
            }]});
            let agent = match &cas["reglage"] {
                Value::Null => json!({"prenom": "Marie", "ficheId": "AG-0001"}),
                reglage => {
                    let mut reglage = reglage.clone();
                    reglage["tacheId"] = json!("t");
                    json!({"prenom": "Marie", "ficheId": "AG-0001", "planning": {"ajustements": [reglage]}})
                }
            };
            let taches = taches_du_planning(&fiche, &agent);
            assert_eq!(
                taches[0].active,
                cas["attendu"]["active"].as_bool().unwrap(),
                "{}",
                cas["intitule"]
            );
        }
    }

    #[test]
    fn l_heure_reglee_par_le_client_ou_le_team_holder_remplace_celle_de_la_fiche() {
        let fiche = json!({"taches": [
            {"id": "etat", "nom": "État", "active": true, "planification": {"type": "quotidienne", "heure": "17:30"}},
        ]});
        let agent = json!({"planning": {
            "ajustements": [{"tacheId": "etat", "planification": {"type": "quotidienne", "heure": "19:00"}}],
            "ajoutees": [{"id": "soir", "nom": "Compte rendu", "planification": {"type": "quotidienne", "heure": "19:30"}}]
        }});
        let taches = taches_du_planning(&fiche, &agent);
        assert_eq!(taches[0].planification["heure"], "19:00");
        assert_eq!(taches[1].id, "soir");
        assert!(taches[1].active, "une tâche que le client vient d'ajouter est allumée");
    }

    #[test]
    fn la_configuration_livree_donne_un_planning_lisible() {
        // Chaque tâche des agents livrés avec l'installeur a une planification
        // que le planning comprend : sinon elle ne partirait jamais, sans bruit.
        let installation: Value =
            serde_json::from_str(include_str!("../../src/config/installation.json")).unwrap();
        let racine = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../agents");
        let mut vues = 0;
        for agent in installation["agents"].as_array().unwrap() {
            let id = agent["ficheId"].as_str().unwrap();
            let fichier = std::fs::read_dir(&racine)
                .unwrap()
                .flatten()
                .find(|e| e.file_name().to_string_lossy().starts_with(&format!("{}-", id)))
                .unwrap_or_else(|| panic!("fiche {} absente du dépôt", id));
            let fiche: Value = serde_json::from_str(&std::fs::read_to_string(fichier.path()).unwrap()).unwrap();
            for t in taches_du_planning(&fiche, agent) {
                lire_rythme(&t.planification)
                    .unwrap_or_else(|e| panic!("{} / {} : {}", id, t.id, e));
                vues += 1;
            }
        }
        assert!(vues > 10, "les agents livrés n'ont presque plus de tâches : {}", vues);
    }

    #[test]
    fn aucune_fiche_du_depot_n_a_une_planification_que_le_planning_ne_lit_pas() {
        let racine = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../agents");
        let mut taches = 0;
        for entree in std::fs::read_dir(&racine).unwrap().flatten() {
            if !entree.file_name().to_string_lossy().ends_with(".json") {
                continue;
            }
            let fiche: Value = serde_json::from_str(&std::fs::read_to_string(entree.path()).unwrap()).unwrap();
            for t in fiche["taches"].as_array().into_iter().flatten() {
                lire_rythme(&t["planification"]).unwrap_or_else(|e| {
                    panic!("{:?} / {} : {}", entree.file_name(), t["id"], e)
                });
                taches += 1;
            }
        }
        assert!(taches > 9_000, "le catalogue a maigri : {} tâches", taches);
    }

    #[test]
    fn le_journal_dit_le_retard_le_rattrapage_et_les_passages_manques() {
        let m = message_du_passage(
            "Marie",
            "État de facturation du jour",
            t("2026-09-24 19:00"),
            15 * 60 + 5,
            true,
            3,
            false,
            &Ok(("/docs/etat.xlsx".to_string(), false)),
        );
        assert!(m.contains("jeudi 24/09 à 19:00"), "{}", m);
        assert!(m.contains("15 h 05 de retard"), "{}", m);
        assert!(m.contains("l'application était fermée"), "{}", m);
        assert!(m.contains("3 passages manqués, un seul rattrapé"), "{}", m);

        // À l'heure : on n'en dit rien.
        let a_l_heure = message_du_passage(
            "Marie", "État", t("2026-09-24 19:00"), 0, false, 1, false,
            &Err("la machine ne tient pas ce poste en tout local : 16 Go demandés, 8 disponibles".to_string()),
        );
        assert!(!a_l_heure.contains("retard"), "{}", a_l_heure);
        assert!(a_l_heure.contains("Pas faite : la machine ne tient pas"), "le motif doit être écrit : {}", a_l_heure);
    }

    #[test]
    fn la_meme_tache_ne_part_pas_deux_fois_a_la_fois() {
        let premiere = occuper("Zoé", "AG-0001", "t").unwrap();
        assert!(occuper("Zoé", "AG-0001", "t").is_err(), "la même tâche est déjà en cours");
        let autre = occuper("Zoé", "AG-0001", "u");
        assert!(autre.is_ok(), "une autre tâche du même agent peut partir");
        assert!(en_cours() >= 2);
        drop(premiere);
        assert!(occuper("Zoé", "AG-0001", "t").is_ok(), "relâchée, elle peut repartir");
    }
}
