//! La jauge de la machine : ce que les agents installés demandent, ce que cette
//! machine offre, et la phrase que le client lit avant de lancer quoi que ce soit.
//!
//! Le mémo du dépôt promet depuis le 18/09 que « l'application calcule la jauge de
//! la machine et prévient avant de basculer ». La moitié droite était tenue
//! (`modele::choisir` porte toujours son motif) ; la gauche ne l'était pas :
//! `jaugeMachine` ne vivait que dans `dimensionnement/calculer.ts`, du côté de la
//! boutique, et `modele.rs` renvoyait lui-même à une jauge qui n'existait pas
//! (« se dira à la jauge, pas au nom »). Ce module est cette jauge.
//!
//! **Les chiffres ne sont pas recopiés.** Mémoire par palier, mémoire de travail,
//! réserve de mémoire unifiée, palier résident ou à la demande, machines du
//! catalogue : tout vient des deux fichiers du dimensionnement, installés avec
//! l'application. Le banc rejoue ici les cas du banc TypeScript et refuse la
//! moindre divergence entre les deux règles.
//!
//! **Ce que la jauge sait et ce qu'elle ignore.** La mémoire laissée aux modèles
//! se mesure sur toutes les machines, et c'est elle qui tranche sur les mini-PC du
//! produit. La puissance de calcul, elle, ne se mesure pas : une carte ne dit pas
//! ce qu'elle vaut face à une RTX 4070. Quand l'installation nomme une machine du
//! catalogue LocalAgent, sa capacité est connue et la charge est jugée ; sinon la
//! jauge le dit au lieu de deviner. Une jauge qui inventerait une capacité
//! annoncerait « confortable » à un client dont les tâches prennent du retard.

use std::collections::{BTreeMap, BTreeSet};

/// Ce que la mémoire des modèles coûte en plus des poids, par palier chargé.
/// Valeur de secours : le fichier des paliers la porte, et c'est lui qui fait foi.
const MEMOIRE_TRAVAIL_DEFAUT: f64 = 0.5;
/// Sur une machine à mémoire unifiée, la RAM que les modèles n'auront pas.
const RESERVE_UNIFIEE_DEFAUT: f64 = 6.0;

// ---------------------------------------------------------------------------
// La table des paliers, telle que le dimensionnement l'écrit
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub struct Palier {
    pub ram: f64,
    pub vram: f64,
    pub charge_unitaire: f64,
    /// Un palier résident reste chargé en permanence (il répond à la voix et au
    /// courrier) ; les autres se chargent un à la fois, à la demande.
    pub resident: bool,
}

#[derive(Debug, Clone)]
pub struct Table {
    pub paliers: BTreeMap<String, Palier>,
    pub memoire_travail: f64,
    pub reserve_unifiee: f64,
    /// La RAM que l'application, le système et les navigateurs pilotés se gardent.
    pub systeme_ram: f64,
}

/// Lit `dimensionnement/paliers-modeles.json`, posé par l'installeur.
pub fn table_depuis(brut: &str) -> Result<Table, String> {
    let fichier: serde_json::Value =
        serde_json::from_str(brut).map_err(|e| format!("paliers de modèles illisibles : {}", e))?;
    let objet = fichier
        .get("paliers")
        .and_then(serde_json::Value::as_object)
        .ok_or("le fichier des paliers ne porte aucun palier")?;

    let mut paliers = BTreeMap::new();
    for (nom, p) in objet {
        let nombre = |cle: &str| -> Result<f64, String> {
            p.get(cle)
                .and_then(serde_json::Value::as_f64)
                .ok_or_else(|| format!("le palier {} n'a pas de {}", nom, cle))
        };
        paliers.insert(
            nom.clone(),
            Palier {
                ram: nombre("ram")?,
                vram: nombre("vram")?,
                charge_unitaire: nombre("chargeUnitaire")?,
                // Sans le drapeau, on compte le palier comme résident : c'est le
                // calcul le plus exigeant des deux, donc celui qui ne promet rien.
                resident: p
                    .get("resident")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(true),
            },
        );
    }
    if paliers.is_empty() {
        return Err("le fichier des paliers ne porte aucun palier".into());
    }

    let lire = |cle: &str, defaut: f64| {
        fichier
            .get(cle)
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(defaut)
    };
    Ok(Table {
        paliers,
        memoire_travail: lire("memoireTravailParPalier", MEMOIRE_TRAVAIL_DEFAUT),
        reserve_unifiee: lire("reserveMemoireUnifiee", RESERVE_UNIFIEE_DEFAUT),
        systeme_ram: fichier
            .get("systeme")
            .and_then(|s| s.get("ram"))
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(4.0),
    })
}

pub fn table() -> Result<Table, String> {
    let chemin = crate::fiches::dossier_ressources().join("dimensionnement/paliers-modeles.json");
    let brut = std::fs::read_to_string(&chemin).map_err(|e| {
        format!(
            "lecture de {} : {} — les paliers de modèles n'ont pas été installés avec l'application",
            chemin.display(),
            e
        )
    })?;
    table_depuis(&brut)
}

// ---------------------------------------------------------------------------
// Ce qu'un agent demande
// ---------------------------------------------------------------------------

/// Le bloc `modeles` d'une fiche : des paliers par capacité, et la part du temps
/// où l'agent les sollicite vraiment.
#[derive(Debug, Clone, PartialEq)]
pub struct Modeles {
    pub paliers: Vec<String>,
    pub activite: f64,
}

/// Tous les champs texte du bloc sont des paliers ; `activite` est un nombre.
/// Lire le bloc ainsi, plutôt que champ par champ, évite qu'une capacité ajoutée
/// au schéma (la musique hier, autre chose demain) soit oubliée ici en silence.
pub fn modeles_de(bloc: &serde_json::Value) -> Modeles {
    let mut paliers: Vec<String> = Vec::new();
    if let Some(objet) = bloc.as_object() {
        for valeur in objet.values() {
            if let Some(palier) = valeur.as_str() {
                if !paliers.contains(&palier.to_string()) {
                    paliers.push(palier.to_string());
                }
            }
        }
    }
    Modeles {
        paliers,
        activite: bloc
            .get("activite")
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(1.0),
    }
}

/// Mémoire des modèles pour un ensemble de paliers DISTINCTS : les résidents
/// s'additionnent, les autres comptent une fois, pour le plus gros. C'est la règle
/// qui fait qu'un deuxième agent sur le même palier ne coûte pas un deuxième modèle.
fn memoire_modeles(table: &Table, paliers: &BTreeSet<String>) -> f64 {
    let mut residents = 0.0;
    let mut a_la_demande: f64 = 0.0;
    for id in paliers {
        let Some(p) = table.paliers.get(id) else { continue };
        let m = p.vram + if p.vram > 0.0 { table.memoire_travail } else { 0.0 };
        if p.resident {
            residents += m;
        } else {
            a_la_demande = a_la_demande.max(m);
        }
    }
    (residents + a_la_demande).ceil()
}

/// La charge continue d'UN agent : la somme des charges unitaires de ses paliers,
/// ramenée à la part du temps où il travaille, et bornée à une carte entière.
fn charge_continue(table: &Table, m: &Modeles) -> f64 {
    let somme: f64 = m
        .paliers
        .iter()
        .filter_map(|id| table.paliers.get(id))
        .map(|p| p.charge_unitaire)
        .sum();
    ((somme * m.activite * 100.0).round() / 100.0).min(1.0)
}

#[derive(Debug, Clone, PartialEq)]
pub struct Besoins {
    /// Mémoire à réserver aux modèles, en Go.
    pub memoire_modeles: f64,
    /// RAM totale, réserve du système comprise.
    pub ram: f64,
    /// Charge continue cumulée, en parts d'une carte de référence.
    pub charge: f64,
    /// Les paliers distincts que cette machine devra tenir chargés.
    pub paliers: Vec<String>,
}

/// Ce que cet ensemble d'agents demande à une machine. La mémoire se compte par
/// palier distinct, la charge par agent : c'est le banc qui a imposé cette
/// asymétrie, compté par agent un seul poste de bureau ne tenait plus sur un mini-PC.
pub fn besoins(table: &Table, agents: &[Modeles]) -> Besoins {
    let mut distincts: BTreeSet<String> = BTreeSet::new();
    let mut charge = 0.0;
    let mut ram: f64 = 0.0;
    for a in agents {
        for id in &a.paliers {
            distincts.insert(id.clone());
        }
        charge += charge_continue(table, a);
        let ram_agent = a
            .paliers
            .iter()
            .filter_map(|id| table.paliers.get(id))
            .map(|p| p.ram)
            .fold(0.0_f64, f64::max);
        ram = ram.max(ram_agent + table.systeme_ram);
    }
    Besoins {
        memoire_modeles: memoire_modeles(table, &distincts),
        // Un agent de plus, c'est un Go de plus de contexte et de fichiers ouverts.
        ram: if agents.is_empty() { 0.0 } else { ram + agents.len() as f64 },
        charge,
        paliers: distincts.into_iter().collect(),
    }
}

// ---------------------------------------------------------------------------
// Ce que la machine offre
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Machine {
    /// Comment la machine se nomme, pour que le client reconnaisse la sienne.
    pub nom: String,
    /// RAM totale, en Go.
    pub ram: f64,
    /// Mémoire laissée aux modèles, en Go.
    pub memoire_modeles: f64,
    /// Mémoire partagée avec la RAM (mini-PC sans carte dédiée).
    pub memoire_unifiee: bool,
    /// Part de la capacité d'une carte de référence. `None` = carte non identifiée,
    /// et la jauge le dira plutôt que de deviner.
    pub capacite_gpu: Option<f64>,
    /// D'où viennent ces chiffres, en clair : le client doit pouvoir les contester.
    pub origine: String,
}

/// La machine du catalogue LocalAgent que l'installation nomme, s'il y en a une.
///
/// Sur une machine que nous avons vendue, tout est connu — mémoire, capacité,
/// mémoire unifiée ou non — et rien n'est à mesurer. C'est le seul cas où la
/// charge peut être jugée, parce que c'est le seul où nous savons ce que vaut
/// la carte face à une RTX 4070.
pub fn machine_du_catalogue(catalogue: &str, id: &str) -> Option<Machine> {
    let fichier: serde_json::Value = serde_json::from_str(catalogue).ok()?;
    let machines = fichier.get("machines")?.as_array()?;
    let m = machines
        .iter()
        .find(|m| m.get("id").and_then(serde_json::Value::as_str) == Some(id))?;
    let nombre = |cle: &str| m.get(cle).and_then(serde_json::Value::as_f64);
    Some(Machine {
        nom: m
            .get("nom")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(id)
            .to_string(),
        ram: nombre("ram")?,
        memoire_modeles: nombre("vram")?,
        memoire_unifiee: m
            .get("memoireUnifiee")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        capacite_gpu: nombre("capaciteGpu"),
        origine: "machine du catalogue LocalAgent, chiffres du dimensionnement".into(),
    })
}

/// La machine telle qu'elle se mesure, quand ce n'est pas une des nôtres.
///
/// Seule la mémoire se mesure. On la traite en mémoire unifiée : c'est le cas des
/// mini-PC du produit, et sur une tour à carte dédiée ça sous-estime la mémoire
/// des modèles, jamais l'inverse. La capacité reste inconnue, et la jauge le dit.
pub fn machine_mesuree(table: &Table) -> Result<Machine, String> {
    let ram = memoire_totale()?;
    Ok(Machine {
        nom: "cet ordinateur".into(),
        ram,
        memoire_modeles: (ram - table.reserve_unifiee).max(0.0),
        memoire_unifiee: true,
        capacite_gpu: None,
        origine: format!(
            "mesuré sur cet ordinateur : {:.1} Go de mémoire, moins {} Go gardés pour le système",
            ram, table.reserve_unifiee
        ),
    })
}

// ---------------------------------------------------------------------------
// La mesure, système par système
// ---------------------------------------------------------------------------

/// La mémoire totale de cet ordinateur, en Go (base 1024, celle des modèles).
#[cfg(target_os = "linux")]
pub fn memoire_totale() -> Result<f64, String> {
    let brut = std::fs::read_to_string("/proc/meminfo")
        .map_err(|e| format!("lecture de /proc/meminfo : {}", e))?;
    memoire_de_meminfo(&brut)
}

/// `MemTotal:       16481980 kB` — la première ligne, en kibioctets.
#[cfg(any(target_os = "linux", test))]
fn memoire_de_meminfo(brut: &str) -> Result<f64, String> {
    for ligne in brut.lines() {
        let Some(reste) = ligne.strip_prefix("MemTotal:") else { continue };
        let ko: f64 = reste
            .split_whitespace()
            .next()
            .and_then(|n| n.parse().ok())
            .ok_or("MemTotal illisible dans /proc/meminfo")?;
        return Ok(ko / 1024.0 / 1024.0);
    }
    Err("/proc/meminfo ne porte pas de MemTotal".into())
}

/// Windows : `GlobalMemoryStatusEx`, l'appel documenté par Microsoft pour ça.
///
/// Six lignes sans rien à analyser : il n'y a pas de sortie à découper, donc pas
/// de format à se tromper. Ce chemin n'a PAS été observé sur une vraie machine
/// Windows depuis ce dépôt ; ce qui est prouvé, c'est qu'il compile pour Windows,
/// la compilation MSI de chaque PR s'en charge.
#[cfg(target_os = "windows")]
pub fn memoire_totale() -> Result<f64, String> {
    use windows_sys::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    let mut etat: MEMORYSTATUSEX = unsafe { std::mem::zeroed() };
    etat.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
    // SAFETY: `etat` is a correctly sized, zeroed MEMORYSTATUSEX with dwLength set,
    // which is the whole contract of GlobalMemoryStatusEx.
    let ok = unsafe { GlobalMemoryStatusEx(&mut etat) };
    if ok == 0 {
        return Err("Windows n'a pas dit combien de mémoire porte cet ordinateur".into());
    }
    Ok(etat.ullTotalPhys as f64 / 1024.0 / 1024.0 / 1024.0)
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub fn memoire_totale() -> Result<f64, String> {
    Err("la mémoire de cet ordinateur ne se lit pas sur ce système".into())
}

// ---------------------------------------------------------------------------
// La jauge
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Niveau {
    Confortable,
    Chargee,
    Saturee,
    Impossible,
    /// La mémoire passe, mais la carte n'a pas été identifiée : la charge n'est
    /// pas jugée. Ce n'est pas « confortable », et ça ne doit pas s'y confondre.
    MemoireSeule,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Verdict {
    pub niveau: Niveau,
    pub memoire_modeles: f64,
    /// Part de la machine consommée, quand elle est connue.
    pub charge: Option<f64>,
    pub message: String,
    pub machine: Machine,
}

/// Mêmes seuils et mêmes phrases que `jaugeMachine` du dimensionnement.
pub fn jauge(machine: &Machine, b: &Besoins) -> Verdict {
    let verdict = |niveau, charge, message: String| Verdict {
        niveau,
        memoire_modeles: b.memoire_modeles,
        charge,
        message,
        machine: machine.clone(),
    };

    if b.memoire_modeles > machine.memoire_modeles
        || (!machine.memoire_unifiee && b.ram > machine.ram)
    {
        return verdict(
            Niveau::Impossible,
            machine.capacite_gpu.map(|c| (b.charge / c * 100.0).round() / 100.0),
            format!(
                "Mémoire insuffisante : {} Go demandés pour les modèles, {} disponibles. Passez un agent en mode API ou retirez-en un.",
                arrondi(b.memoire_modeles),
                arrondi(machine.memoire_modeles)
            ),
        );
    }

    let Some(capacite) = machine.capacite_gpu else {
        return verdict(
            Niveau::MemoireSeule,
            None,
            format!(
                "Mémoire : {} Go demandés pour les modèles, {} disponibles, ça passe. La puissance de la carte n'a pas pu être identifiée sur cet ordinateur : si les tâches prennent du retard, c'est elle. Indiquez votre machine LocalAgent à l'installation pour que la charge soit jugée.",
                arrondi(b.memoire_modeles),
                arrondi(machine.memoire_modeles)
            ),
        );
    };

    let charge = (b.charge / capacite * 100.0).round() / 100.0;
    let pourcent = (charge * 100.0).round();
    if charge > 1.0 {
        return verdict(
            Niveau::Saturee,
            Some(charge),
            format!("Charge {} % : les tâches prendront du retard. Passez les agents les plus lourds en mode API.", pourcent),
        );
    }
    if charge > 0.8 {
        return verdict(
            Niveau::Chargee,
            Some(charge),
            format!("Charge {} % : encore de la place pour un agent léger, pas pour un agent image ou vidéo.", pourcent),
        );
    }
    verdict(
        Niveau::Confortable,
        Some(charge),
        format!("Charge {} % : la machine tient ce pack 24h/24.", pourcent),
    )
}

/// « 7 » et non « 7.0 » : c'est une phrase, pas un tableau.
fn arrondi(v: f64) -> String {
    if (v - v.round()).abs() < 1e-9 {
        format!("{}", v.round() as i64)
    } else {
        format!("{:.1}", v)
    }
}

// ---------------------------------------------------------------------------
// Ce que l'écran demande
// ---------------------------------------------------------------------------

/// Les agents installés sur ce poste, et la machine sur laquelle ils tournent.
fn installation() -> Result<serde_json::Value, String> {
    let brut = crate::fiches::lire_installation()?;
    serde_json::from_str(&brut).map_err(|e| format!("installation illisible : {}", e))
}

/// Les blocs `modeles` des fiches installées. Une fiche absente du catalogue
/// installé n'est pas une raison de ne rien afficher : elle est nommée à part.
pub fn agents_installes(config: &serde_json::Value) -> (Vec<Modeles>, Vec<String>) {
    let mut agents = Vec::new();
    let mut introuvables = Vec::new();
    let liste = config.get("agents").and_then(serde_json::Value::as_array);
    for a in liste.into_iter().flatten() {
        let Some(id) = a.get("ficheId").and_then(serde_json::Value::as_str) else { continue };
        let prenom = a
            .get("prenom")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(id);
        match crate::fiches::lire_fiche(id.to_string())
            .ok()
            .and_then(|brut| serde_json::from_str::<serde_json::Value>(&brut).ok())
        {
            Some(fiche) => agents.push(modeles_de(fiche.get("modeles").unwrap_or(&serde_json::Value::Null))),
            None => introuvables.push(prenom.to_string()),
        }
    }
    (agents, introuvables)
}

/// La machine sur laquelle ces agents tournent : celle du catalogue quand
/// l'installation la nomme, la machine mesurée sinon.
fn machine_de(table: &Table, config: &serde_json::Value) -> Result<Machine, String> {
    let nommee = config.get("machine").and_then(serde_json::Value::as_str);
    if let Some(id) = nommee {
        let chemin = crate::fiches::dossier_ressources().join("dimensionnement/machines.json");
        if let Ok(catalogue) = std::fs::read_to_string(&chemin) {
            if let Some(m) = machine_du_catalogue(&catalogue, id) {
                return Ok(m);
            }
        }
    }
    machine_mesuree(table)
}

/// La jauge de ce poste, telle que l'écran l'affiche. Rien n'est lancé.
#[tauri::command]
pub fn jauge_etat() -> Result<Verdict, String> {
    let table = table()?;
    let config = installation()?;
    let (agents, _introuvables) = agents_installes(&config);
    let machine = machine_de(&table, &config)?;
    Ok(jauge(&machine, &besoins(&table, &agents)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table_du_depot() -> Table {
        let chemin = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../dimensionnement/paliers-modeles.json"
        );
        let brut = std::fs::read_to_string(chemin).expect("paliers-modeles.json introuvable");
        table_depuis(&brut).expect("paliers illisibles")
    }

    fn catalogue_du_depot() -> String {
        let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../../dimensionnement/machines.json");
        std::fs::read_to_string(chemin).expect("machines.json introuvable")
    }

    fn agent(paliers: &[&str], activite: f64) -> Modeles {
        Modeles {
            paliers: paliers.iter().map(|s| s.to_string()).collect(),
            activite,
        }
    }

    /// Le poste de bureau du banc TypeScript : texte standard, parole, embeddings,
    /// 15 % d'activité. Le dimensionnement dit 7 Go et moins de 10 % de charge.
    fn poste_de_bureau() -> Modeles {
        agent(&["texte-standard", "audio-parole", "embeddings"], 0.15)
    }

    #[test]
    fn le_fichier_des_paliers_porte_bien_la_regle_de_memoire() {
        let t = table_du_depot();
        assert_eq!(t.memoire_travail, 0.5, "mémoire de travail par palier");
        assert_eq!(t.reserve_unifiee, 6.0, "réserve de mémoire unifiée");
        assert_eq!(t.systeme_ram, 4.0, "réserve RAM du système");
        assert!(t.paliers.get("texte-standard").expect("palier texte-standard").resident);
        assert!(!t.paliers.get("video").expect("palier video").resident);
    }

    /// Le chiffre que le banc du dimensionnement attend, recalculé ici : si les
    /// deux règles divergent, la boutique et l'application ne diront pas pareil.
    #[test]
    fn un_poste_de_bureau_demande_les_memes_7_go_que_le_dimensionnement() {
        let t = table_du_depot();
        let b = besoins(&t, &[poste_de_bureau()]);
        assert_eq!(b.memoire_modeles, 7.0, "texte 6 + travail 0,5, arrondi au Go");
        // 0.2 + 0.15 + 0.03 = 0.38, x 0.15 = 0.057 -> 0.06
        assert_eq!(b.charge, 0.06, "charge continue d'un poste de bureau");
    }

    /// La règle qui a tout changé : deux agents sur le même palier partagent les
    /// poids. La mémoire ne bouge pas, la charge double.
    #[test]
    fn deux_agents_du_meme_palier_partagent_le_modele_mais_pas_la_charge() {
        let t = table_du_depot();
        let un = besoins(&t, &[poste_de_bureau()]);
        let deux = besoins(&t, &[poste_de_bureau(), poste_de_bureau()]);
        assert_eq!(deux.memoire_modeles, un.memoire_modeles, "un seul jeu de poids");
        assert_eq!(deux.charge, un.charge * 2.0, "la charge se compte par agent");
    }

    /// Image et vidéo se chargent un à la fois : la mémoire retient le plus gros,
    /// pas la somme. Sans cette règle, tout agent créatif paraîtrait impossible.
    #[test]
    fn les_paliers_a_la_demande_ne_s_additionnent_pas() {
        let t = table_du_depot();
        let deux_images = besoins(&t, &[agent(&["texte-standard", "image-rapide", "image-qualite"], 1.0)]);
        let la_plus_grosse = besoins(&t, &[agent(&["texte-standard", "image-qualite"], 1.0)]);
        assert_eq!(deux_images.memoire_modeles, la_plus_grosse.memoire_modeles);
        // texte 6 + 0,5, image-qualite 16 + 0,5 = 23
        assert_eq!(deux_images.memoire_modeles, 23.0);
    }

    /// Les quatre verdicts du banc TypeScript, rejoués sur la même machine :
    /// un Firebat AM02 tient trois postes de bureau, pas quatre, et pas la vidéo.
    #[test]
    fn la_jauge_rend_les_memes_verdicts_que_le_dimensionnement() {
        let t = table_du_depot();
        let am02 = machine_du_catalogue(&catalogue_du_depot(), "firebat-am02-ryzen-7-h255")
            .expect("le Firebat AM02 Ryzen 7 a disparu du catalogue");
        let postes = |n: usize| vec![poste_de_bureau(); n];

        assert_eq!(jauge(&am02, &besoins(&t, &postes(1))).niveau, Niveau::Confortable);
        assert_eq!(jauge(&am02, &besoins(&t, &postes(3))).niveau, Niveau::Chargee);
        assert_eq!(jauge(&am02, &besoins(&t, &postes(4))).niveau, Niveau::Saturee);

        // Mêmes fiches témoins que le banc TypeScript, au palier près.
        let video = agent(&["texte-leger", "video"], 0.7);
        let verdict = jauge(&am02, &besoins(&t, &[video]));
        assert_eq!(verdict.niveau, Niveau::Impossible);
        assert!(verdict.message.contains("mode API"), "{}", verdict.message);
    }

    /// Une machine dont la carte est inconnue ne s'annonce jamais « confortable ».
    #[test]
    fn sans_carte_identifiee_la_jauge_ne_juge_que_la_memoire() {
        let t = table_du_depot();
        let inconnue = Machine {
            nom: "cet ordinateur".into(),
            ram: 16.0,
            memoire_modeles: 10.0,
            memoire_unifiee: true,
            capacite_gpu: None,
            origine: "mesuré".into(),
        };
        let v = jauge(&inconnue, &besoins(&t, &[poste_de_bureau()]));
        assert_eq!(v.niveau, Niveau::MemoireSeule);
        assert_eq!(v.charge, None, "aucune charge annoncée sans capacité connue");
        assert!(v.message.contains("n'a pas pu être identifiée"), "{}", v.message);

        // La mémoire, elle, tranche toujours : un agent d'analyse ne tient pas.
        let analyste = agent(&["texte-avance", "audio-parole", "embeddings"], 0.3);
        let v = jauge(&inconnue, &besoins(&t, &[analyste]));
        assert_eq!(v.niveau, Niveau::Impossible);
        assert!(v.message.contains("Mémoire insuffisante"), "{}", v.message);
    }

    /// Le bloc `modeles` d'une vraie fiche, lu comme l'application le lira.
    #[test]
    fn le_bloc_modeles_d_une_fiche_du_depot_se_lit_entierement() {
        let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../../agents");
        let entree = std::fs::read_dir(chemin)
            .expect("dossier agents introuvable")
            .flatten()
            .find(|e| e.file_name().to_string_lossy().starts_with("AG-0001-"))
            .expect("la fiche AG-0001 a disparu");
        let fiche: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(entree.path()).unwrap()).unwrap();
        let m = modeles_de(&fiche["modeles"]);
        assert!(m.paliers.contains(&"texte-standard".to_string()), "{:?}", m);
        assert!(m.activite > 0.0 && m.activite <= 1.0, "activité {}", m.activite);
        // `activite` est un nombre : il ne doit pas se retrouver parmi les paliers.
        let t = table_du_depot();
        for p in &m.paliers {
            assert!(t.paliers.contains_key(p), "palier inconnu dans AG-0001 : {}", p);
        }
    }

    /// Ce que l'installeur doit poser : sans le catalogue, aucune machine
    /// LocalAgent ne se reconnaît et la charge n'est jamais jugée.
    #[test]
    fn l_installeur_pose_les_machines_la_ou_le_code_les_cherche() {
        let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/tauri.conf.json");
        let conf: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(chemin).unwrap()).unwrap();
        let pose = conf["bundle"]["resources"]["../../dimensionnement/machines.json"]
            .as_str()
            .expect("le catalogue des machines n'est pas embarqué par l'installeur");
        assert_eq!(pose, "dimensionnement/machines.json");
    }

    #[test]
    fn la_memoire_se_lit_dans_meminfo() {
        let brut = "MemTotal:       16481980 kB\nMemFree:         6075308 kB\n";
        let go = memoire_de_meminfo(brut).expect("MemTotal lisible");
        assert!((go - 15.72).abs() < 0.01, "{} Go", go);
        assert!(memoire_de_meminfo("MemFree: 1 kB\n").is_err(), "sans MemTotal, une erreur");
        assert!(memoire_de_meminfo("MemTotal:  beaucoup\n").is_err(), "un nombre illisible est une erreur");
    }

    /// La mesure sur la machine où tourne ce banc : pas un format inventé, la
    /// vraie. Un chiffre nul ou absurde voudrait dire que la lecture ment.
    #[cfg(target_os = "linux")]
    #[test]
    fn cet_ordinateur_dit_sa_memoire() {
        let go = memoire_totale().expect("cet ordinateur a une mémoire");
        assert!(go > 0.5 && go < 4096.0, "{} Go, ce n'est pas une mémoire", go);
        let m = machine_mesuree(&table_du_depot()).expect("machine mesurée");
        assert_eq!(m.memoire_modeles, (go - 6.0).max(0.0));
        assert_eq!(m.capacite_gpu, None, "rien ne permet d'affirmer une capacité");
    }

    /// Une installation qui nomme des fiches absentes ne doit pas faire taire la
    /// jauge : les agents lus comptent, les autres sont nommés.
    #[test]
    fn une_fiche_absente_est_nommee_et_n_arrete_rien() {
        let config: serde_json::Value = serde_json::from_str(
            r#"{"agents":[{"prenom":"Fantome","ficheId":"AG-9999"}]}"#,
        )
        .unwrap();
        let (agents, introuvables) = agents_installes(&config);
        assert!(agents.is_empty());
        assert_eq!(introuvables, vec!["Fantome".to_string()]);
    }
}
