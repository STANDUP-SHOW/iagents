//! Le Team Holder : ce qu'il lit des autres agents, et ce qu'il peut y changer.
//!
//! Max, 24/09/2026 : « à la base de iAgent, l'utilisateur peut s'équiper d'un
//! Team Holder, responsable et assistant personnel, qui prend en charge les
//! agents, intervient sur leurs réglages, les interroge, récupère les données
//! de leurs rapports ». Le client n'a plus qu'un interlocuteur.
//!
//! Sa fiche est `socle/AG-0000-team-holder.json`. Ce module tient, dans le code
//! et non dans une consigne au modèle, ce qu'elle promet :
//!
//! 1. **Il ne lit que ce que les agents produisent.** Les fichiers se listent
//!    dans les dossiers de sortie que déclarent les tâches de chaque agent
//!    (fiche et tâches ajoutées par le client), résolus par
//!    `tache::dossier_reel` comme à l'écriture. Un fichier demandé hors de ces
//!    dossiers est refusé, quel que soit le chemin passé par l'écran.
//! 2. **Il ne change que trois choses** (`REGLAGES`) : l'horaire d'une tâche,
//!    son allumage, et son mode contrôle. Ni prénom, ni fiche, ni dossiers, ni
//!    compétences : ce qui ferait écrire ailleurs, ou changerait le métier,
//!    reste au client.
//! 3. **Chaque changement est inscrit et se défait.** L'avant et l'après sont
//!    écrits dans `installation.json` même, sous `changements`, dans la même
//!    écriture que le réglage : un réglage appliqué sans sa trace, ou une trace
//!    sans réglage, est impossible. L'annulation refuse de défaire un réglage
//!    qui a bougé depuis, plutôt que d'écraser en silence un geste plus récent.
//!
//! Le « oui » du client est demandé par l'écran avant `equipe_regler` : la
//! phrase qui le lui répète vient de `team-holder.ts`.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// La fiche du Team Holder. Un seul par poste suffit, mais rien n'interdit
/// d'en embaucher un second : chacun signe ses changements de son prénom.
pub const FICHE_TEAM_HOLDER: &str = "AG-0000";

/// Les trois réglages qu'il touche. Doit rester identique à `REGLAGES` de
/// `desktop/src/agents/team-holder.ts` : `check-team-holder.ts` compare.
pub const REGLAGES: [&str; 3] = ["planification", "active", "validationHumaine"];

/// Au plus ce nombre de fichiers par agent : une synthèse se fait sur le
/// travail récent, pas sur des mois d'archives.
pub const PRODUCTIONS_MAX: usize = 30;

/// Ce qu'un seul document peut peser dans la conversation.
pub const CARACTERES_MAX: usize = 20_000;

const JOURS: [&str; 7] = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const EVENEMENTS: [&str; 5] = [
    "email.recu",
    "whatsapp.recu",
    "fichier.depose",
    "calendrier.evenement",
    "appel.recu",
];

/// Un changement apporté au travail d'un agent, tel qu'il est inscrit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Changement {
    pub id: String,
    pub date: String,
    /// Le prénom du Team Holder qui l'a appliqué.
    pub par: String,
    pub agent: String,
    pub tache_id: String,
    pub tache_nom: String,
    pub reglage: String,
    /// Ce qu'écrivait l'installation avant ; absent = la fiche décidait.
    pub avant: Option<Value>,
    pub apres: Value,
    #[serde(default)]
    pub annule_le: Option<String>,
}

/// Un document déposé par un agent.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Production {
    pub fichier: String,
    pub nom: String,
    pub dossier: String,
    /// Les tâches qui écrivent dans ce dossier.
    pub taches: Vec<String>,
    pub modifie_le: u64,
    pub octets: u64,
}

fn agents(installation: &Value) -> &[Value] {
    installation
        .get("agents")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn chaine<'a>(v: &'a Value, cle: &str) -> Option<&'a str> {
    v.get(cle).and_then(Value::as_str)
}

fn index_agent(installation: &Value, prenom: &str) -> Result<usize, String> {
    agents(installation)
        .iter()
        .position(|a| chaine(a, "prenom") == Some(prenom))
        .ok_or_else(|| format!("aucun agent ne s'appelle {} sur ce poste", prenom))
}

/// Le prénom doit désigner un Team Holder embauché : c'est lui qui signe.
fn verifier_team_holder(installation: &Value, par: &str) -> Result<(), String> {
    let i = index_agent(installation, par)?;
    if chaine(&agents(installation)[i], "ficheId") != Some(FICHE_TEAM_HOLDER) {
        return Err(format!(
            "{} n'est pas le Team Holder de ce poste : seul lui règle le travail des autres agents",
            par
        ));
    }
    Ok(())
}

/// Un horaire recevable, avec les mêmes règles que le contrat de paquet.
///
/// Le Team Holder reçoit l'horaire de l'écran : sans ce contrôle, une
/// planification que l'exécution ne comprend pas éteindrait la tâche sans que
/// personne le voie.
pub fn planification_recevable(p: &Value) -> Result<(), String> {
    let o = p.as_object().ok_or("un horaire doit être un objet")?;
    let heure_ok = |h: Option<&Value>| -> bool {
        let Some(h) = h.and_then(Value::as_str) else { return false };
        let b = h.as_bytes();
        b.len() == 5
            && b[2] == b':'
            && h[..2].parse::<u8>().map_or(false, |x| x < 24)
            && h[3..].parse::<u8>().map_or(false, |x| x < 60)
    };
    let cles = |permises: &[&str]| o.keys().all(|k| permises.contains(&k.as_str()));
    let type_ = o.get("type").and_then(Value::as_str).unwrap_or("");
    let ok = match type_ {
        "quotidienne" => heure_ok(o.get("heure")) && cles(&["type", "heure"]),
        "hebdomadaire" => {
            heure_ok(o.get("heure"))
                && o.get("jour").and_then(Value::as_str).map_or(false, |j| JOURS.contains(&j))
                && cles(&["type", "jour", "heure"])
        }
        "mensuelle" => {
            heure_ok(o.get("heure"))
                && o.get("jour").and_then(Value::as_u64).map_or(false, |j| (1..=28).contains(&j))
                && cles(&["type", "jour", "heure"])
        }
        "intervalle" => {
            o.get("minutes").and_then(Value::as_u64).map_or(false, |m| m >= 5)
                && cles(&["type", "minutes"])
        }
        "declencheur" => {
            o.get("evenement").and_then(Value::as_str).map_or(false, |e| EVENEMENTS.contains(&e))
                && cles(&["type", "evenement"])
        }
        "a-la-demande" => cles(&["type"]),
        _ => false,
    };
    if ok {
        Ok(())
    } else {
        Err(format!("horaire non reconnu : {}", p))
    }
}

/// Où vit le réglage d'une tâche dans l'installation.
enum Place {
    /// Une tâche de la fiche : le réglage va dans `planning.ajustements`.
    Fiche,
    /// Une tâche ajoutée par le client : le réglage est porté par elle.
    Ajoutee(usize),
}

fn trouver_tache(agent: &Value, fiche: &Value, tache_id: &str) -> Result<(Place, String), String> {
    let nom_de = |t: &Value| chaine(t, "nom").unwrap_or(tache_id).to_string();
    if let Some(t) = fiche
        .get("taches")
        .and_then(Value::as_array)
        .and_then(|ts| ts.iter().find(|t| chaine(t, "id") == Some(tache_id)))
    {
        return Ok((Place::Fiche, nom_de(t)));
    }
    let ajoutees = agent
        .pointer("/planning/ajoutees")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[]);
    if let Some(i) = ajoutees.iter().position(|t| chaine(t, "id") == Some(tache_id)) {
        return Ok((Place::Ajoutee(i), nom_de(&ajoutees[i])));
    }
    Err(format!(
        "{} n'a pas de tâche « {} »",
        chaine(agent, "prenom").unwrap_or("cet agent"),
        tache_id
    ))
}

/// La valeur écrite aujourd'hui dans l'installation pour ce réglage.
fn valeur_ecrite(agent: &Value, place: &Place, tache_id: &str, reglage: &str) -> Option<Value> {
    match place {
        Place::Fiche => agent
            .pointer("/planning/ajustements")
            .and_then(Value::as_array)?
            .iter()
            .find(|a| chaine(a, "tacheId") == Some(tache_id))?
            .get(reglage)
            .cloned(),
        Place::Ajoutee(i) => agent
            .pointer("/planning/ajoutees")
            .and_then(Value::as_array)?
            .get(*i)?
            .get(reglage)
            .cloned(),
    }
}

/// Écrit (ou retire, quand `valeur` est `None`) un réglage dans l'agent.
fn ecrire_valeur(agent: &mut Value, place: &Place, tache_id: &str, reglage: &str, valeur: Option<Value>) {
    if !agent.get("planning").map_or(false, Value::is_object) {
        agent["planning"] = json!({});
    }
    match place {
        Place::Fiche => {
            let planning = &mut agent["planning"];
            if !planning.get("ajustements").map_or(false, Value::is_array) {
                planning["ajustements"] = json!([]);
            }
            let liste = planning["ajustements"].as_array_mut().expect("tableau posé ci-dessus");
            let i = match liste.iter().position(|a| chaine(a, "tacheId") == Some(tache_id)) {
                Some(i) => i,
                None => {
                    liste.push(json!({ "tacheId": tache_id }));
                    liste.len() - 1
                }
            };
            let ajustement = liste[i].as_object_mut().expect("un ajustement est un objet");
            match valeur {
                Some(v) => {
                    ajustement.insert(reglage.to_string(), v);
                }
                None => {
                    ajustement.remove(reglage);
                }
            }
            // Un ajustement qui ne porte plus que son identifiant ne dit rien :
            // le laisser ferait croire au client qu'il a réglé cette tâche.
            if ajustement.len() == 1 {
                liste.remove(i);
            }
        }
        Place::Ajoutee(i) => {
            if let Some(t) = agent["planning"]["ajoutees"].get_mut(*i).and_then(Value::as_object_mut) {
                match valeur {
                    Some(v) => {
                        t.insert(reglage.to_string(), v);
                    }
                    None => {
                        t.remove(reglage);
                    }
                }
            }
        }
    }
}

fn changements(installation: &Value) -> Vec<Changement> {
    installation
        .get("changements")
        .cloned()
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

/// Applique un réglage demandé par le client à travers son Team Holder.
///
/// Fonction pure : elle rend la nouvelle installation et le changement
/// inscrit, sans toucher au disque. `lire_fiche` est passée pour qu'un banc
/// puisse l'éprouver sans catalogue installé.
pub fn regler(
    installation: &Value,
    lire_fiche: &dyn Fn(&str) -> Result<String, String>,
    par: &str,
    prenom: &str,
    tache_id: &str,
    reglage: &str,
    valeur: Value,
    date: &str,
) -> Result<(Value, Changement), String> {
    verifier_team_holder(installation, par)?;
    if !REGLAGES.contains(&reglage) {
        return Err(format!(
            "le Team Holder ne règle que l'horaire, l'allumage et le mode contrôle d'une tâche, pas « {} »",
            reglage
        ));
    }
    match reglage {
        "planification" => planification_recevable(&valeur)?,
        _ if !valeur.is_boolean() => return Err(format!("« {} » attend oui ou non", reglage)),
        _ => {}
    }

    let i = index_agent(installation, prenom)?;
    let agent = &agents(installation)[i];
    let fiche_id = chaine(agent, "ficheId").ok_or("un agent installé sans fiche")?;
    let fiche: Value = serde_json::from_str(&lire_fiche(fiche_id)?)
        .map_err(|e| format!("fiche {} illisible : {}", fiche_id, e))?;
    let (place, tache_nom) = trouver_tache(agent, &fiche, tache_id)?;
    if matches!(place, Place::Ajoutee(_)) && reglage == "active" {
        // `planningDuClient` allume toujours une tâche ajoutée : l'éteindre
        // ici n'aurait aucun effet, et le client croirait l'avoir fait.
        return Err(format!(
            "« {} » est une tâche que vous avez ajoutée : elle se retire, elle ne s'éteint pas",
            tache_nom
        ));
    }

    let avant = valeur_ecrite(agent, &place, tache_id, reglage);
    if avant.as_ref() == Some(&valeur) {
        return Err(format!("« {} » de {} est déjà réglée ainsi", tache_nom, prenom));
    }

    let mut nouvelle = installation.clone();
    ecrire_valeur(&mut nouvelle["agents"][i], &place, tache_id, reglage, Some(valeur.clone()));

    let mut liste = changements(installation);
    let changement = Changement {
        id: format!("CH-{}", liste.len() + 1),
        date: date.to_string(),
        par: par.to_string(),
        agent: prenom.to_string(),
        tache_id: tache_id.to_string(),
        tache_nom,
        reglage: reglage.to_string(),
        avant,
        apres: valeur,
        annule_le: None,
    };
    liste.push(changement.clone());
    nouvelle["changements"] = serde_json::to_value(&liste).map_err(|e| e.to_string())?;
    Ok((nouvelle, changement))
}

/// Défait un changement, s'il est encore celui qui s'applique.
pub fn annuler(
    installation: &Value,
    lire_fiche: &dyn Fn(&str) -> Result<String, String>,
    id: &str,
    date: &str,
) -> Result<(Value, Changement), String> {
    let mut liste = changements(installation);
    let k = liste
        .iter()
        .position(|c| c.id == id)
        .ok_or_else(|| format!("aucun changement {} n'est inscrit", id))?;
    let ch = liste[k].clone();
    if let Some(le) = &ch.annule_le {
        return Err(format!("le changement {} a déjà été annulé le {}", id, le));
    }

    let i = index_agent(installation, &ch.agent)
        .map_err(|_| format!("{} n'est plus sur ce poste : rien à annuler", ch.agent))?;
    let agent = &agents(installation)[i];
    let fiche_id = chaine(agent, "ficheId").ok_or("un agent installé sans fiche")?;
    let fiche: Value = serde_json::from_str(&lire_fiche(fiche_id)?)
        .map_err(|e| format!("fiche {} illisible : {}", fiche_id, e))?;
    let (place, _) = trouver_tache(agent, &fiche, &ch.tache_id)?;

    // Le réglage a bougé depuis : défaire celui-ci écraserait le plus récent.
    if valeur_ecrite(agent, &place, &ch.tache_id, &ch.reglage).as_ref() != Some(&ch.apres) {
        let plus_recent = liste[k + 1..]
            .iter()
            .rev()
            .find(|c| {
                c.annule_le.is_none()
                    && c.agent == ch.agent
                    && c.tache_id == ch.tache_id
                    && c.reglage == ch.reglage
            })
            .map(|c| format!(" : annulez d'abord {}", c.id))
            .unwrap_or_else(|| " à la main depuis".to_string());
        return Err(format!(
            "« {} » de {} a été réglée de nouveau{}",
            ch.tache_nom, ch.agent, plus_recent
        ));
    }

    let mut nouvelle = installation.clone();
    ecrire_valeur(&mut nouvelle["agents"][i], &place, &ch.tache_id, &ch.reglage, ch.avant.clone());
    liste[k].annule_le = Some(date.to_string());
    let annule = liste[k].clone();
    nouvelle["changements"] = serde_json::to_value(&liste).map_err(|e| e.to_string())?;
    Ok((nouvelle, annule))
}

/// Les dossiers de sortie d'un agent, logiques, avec les tâches qui y écrivent.
fn dossiers_de_sortie(agent: &Value, fiche: &Value) -> Vec<(String, Vec<String>)> {
    let mut taches: Vec<&Value> = fiche
        .get("taches")
        .and_then(Value::as_array)
        .map(|v| v.iter().collect())
        .unwrap_or_default();
    if let Some(a) = agent.pointer("/planning/ajoutees").and_then(Value::as_array) {
        taches.extend(a.iter());
    }
    let mut dossiers: Vec<(String, Vec<String>)> = Vec::new();
    for t in taches {
        let id = chaine(t, "id").unwrap_or_default().to_string();
        for s in t.get("sorties").and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[]) {
            let Some(d) = chaine(s, "dossier") else { continue };
            match dossiers.iter_mut().find(|(x, _)| x == d) {
                Some((_, ids)) => ids.push(id.clone()),
                None => dossiers.push((d.to_string(), vec![id.clone()])),
            }
        }
    }
    dossiers
}

fn dossiers_reels(agent: &Value, fiche: &Value) -> Vec<(String, Vec<String>, PathBuf)> {
    let vide = json!({});
    let prenom = chaine(agent, "prenom").unwrap_or_default();
    dossiers_de_sortie(agent, fiche)
        .into_iter()
        .filter_map(|(logique, taches)| {
            crate::tache::dossier_reel(
                agent.get("dossiers").unwrap_or(&vide),
                chaine(agent, "racine"),
                prenom,
                &logique,
            )
            .ok()
            .map(|reel| (logique, taches, reel))
        })
        .collect()
}

/// Ce qu'un agent a déposé, le plus récent d'abord.
pub fn productions(agent: &Value, fiche: &Value) -> Vec<Production> {
    let mut vus: Vec<Production> = Vec::new();
    for (logique, taches, reel) in dossiers_reels(agent, fiche) {
        let Ok(entrees) = std::fs::read_dir(&reel) else { continue };
        for e in entrees.flatten() {
            let chemin = e.path();
            let nom = e.file_name().to_string_lossy().to_string();
            // Les fichiers cachés et les écritures en cours (`poser` écrit
            // d'abord un `.nouveau`) ne sont pas des productions.
            if nom.starts_with('.') || nom.ends_with(".nouveau") {
                continue;
            }
            let Ok(meta) = e.metadata() else { continue };
            if !meta.is_file() {
                continue;
            }
            let modifie_le = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map_or(0, |d| d.as_secs());
            let fichier = chemin.display().to_string();
            if vus.iter().any(|p| p.fichier == fichier) {
                continue;
            }
            vus.push(Production {
                fichier,
                nom,
                dossier: logique.clone(),
                taches: taches.clone(),
                modifie_le,
                octets: meta.len(),
            });
        }
    }
    vus.sort_by(|a, b| b.modifie_le.cmp(&a.modifie_le).then(a.nom.cmp(&b.nom)));
    vus.truncate(PRODUCTIONS_MAX);
    vus
}

/// Lit un document déposé par un agent, s'il est bien dans un de ses dossiers.
///
/// Le chemin vient de l'écran : on ne le « nettoie » pas, on vérifie que son
/// dossier, résolu sur le disque, est un des dossiers de sortie de l'agent.
/// Un `..` ou un lien symbolique qui mènerait ailleurs échoue ici.
pub fn lire_production(agent: &Value, fiche: &Value, fichier: &Path) -> Result<String, String> {
    let nom = fichier
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let reel = std::fs::canonicalize(fichier).map_err(|_| format!("{} est introuvable", nom))?;
    let parent = reel.parent().map(Path::to_path_buf).unwrap_or_default();
    let permis = dossiers_reels(agent, fiche)
        .into_iter()
        .filter_map(|(_, _, d)| std::fs::canonicalize(d).ok())
        .any(|d| d == parent);
    if !permis {
        return Err(format!(
            "{} n'est pas dans un dossier où {} dépose son travail",
            nom,
            chaine(agent, "prenom").unwrap_or("cet agent")
        ));
    }

    let extension = reel
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let texte = match extension.as_str() {
        "md" | "txt" | "csv" | "json" | "html" => {
            std::fs::read_to_string(&reel).map_err(|e| format!("{} : {}", nom, e))?
        }
        "xlsx" | "docx" | "eml" => {
            let octets = std::fs::read(&reel).map_err(|e| format!("{} : {}", nom, e))?;
            match extension.as_str() {
                "xlsx" => crate::lecture::lire_classeur(&octets)?,
                "docx" => crate::lecture::lire_document_word(&octets)?,
                _ => crate::lecture::lire_courriel(&octets)?,
            }
        }
        "pdf" => {
            return Err(format!(
                "{} est un PDF : l'application ne le relit pas, ouvrez-le vous-même",
                nom
            ))
        }
        _ => return Err(format!("{} : l'application ne sait pas ouvrir ce format", nom)),
    };
    if texte.chars().count() > CARACTERES_MAX {
        let coupe: String = texte.chars().take(CARACTERES_MAX).collect();
        return Ok(format!("{}\n\n[… document coupé : seul le début a été lu]", coupe));
    }
    Ok(texte)
}

fn date_du_jour() -> String {
    let secondes = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let (a, m, j, h, mi, _, _) = crate::tache::civil(secondes);
    format!("{:04}-{:02}-{:02} {:02}:{:02}", a, m, j, h, mi)
}

fn installation_actuelle() -> Result<Value, String> {
    serde_json::from_str(&crate::fiches::lire_installation()?)
        .map_err(|e| format!("installation illisible : {}", e))
}

fn ecrire(nouvelle: &Value) -> Result<(), String> {
    let contenu = serde_json::to_string_pretty(nouvelle).map_err(|e| e.to_string())?;
    crate::fiches::installation_ecrire(contenu).map(|_| ())
}

fn lire(id: &str) -> Result<String, String> {
    crate::fiches::lire_fiche(id.to_string())
}

fn agent_et_fiche(prenom: &str) -> Result<(Value, Value), String> {
    let installation = installation_actuelle()?;
    let agent = agents(&installation)[index_agent(&installation, prenom)?].clone();
    let fiche_id = chaine(&agent, "ficheId").ok_or("un agent installé sans fiche")?;
    let fiche: Value = serde_json::from_str(&lire(fiche_id)?)
        .map_err(|e| format!("fiche {} illisible : {}", fiche_id, e))?;
    Ok((agent, fiche))
}

/// Applique un réglage que le client vient d'accepter.
#[tauri::command]
pub fn equipe_regler(
    par: String,
    agent: String,
    tache_id: String,
    reglage: String,
    valeur: Value,
) -> Result<Changement, String> {
    let (nouvelle, ch) = regler(
        &installation_actuelle()?,
        &lire,
        &par,
        &agent,
        &tache_id,
        &reglage,
        valeur,
        &date_du_jour(),
    )?;
    ecrire(&nouvelle)?;
    Ok(ch)
}

#[tauri::command]
pub fn equipe_annuler(id: String) -> Result<Changement, String> {
    let (nouvelle, ch) = annuler(&installation_actuelle()?, &lire, &id, &date_du_jour())?;
    ecrire(&nouvelle)?;
    Ok(ch)
}

#[tauri::command]
pub fn equipe_changements() -> Result<Vec<Changement>, String> {
    Ok(changements(&installation_actuelle()?))
}

#[tauri::command]
pub fn equipe_productions(prenom: String) -> Result<Vec<Production>, String> {
    let (agent, fiche) = agent_et_fiche(&prenom)?;
    Ok(productions(&agent, &fiche))
}

#[tauri::command]
pub fn equipe_lire_production(prenom: String, fichier: String) -> Result<String, String> {
    let (agent, fiche) = agent_et_fiche(&prenom)?;
    lire_production(&agent, &fiche, Path::new(&fichier))
}

#[cfg(test)]
mod tests {
    use super::*;

    const FICHE_MARIE: &str = r#"{"id":"AG-0028","taches":[
        {"id":"etat-du-jour","nom":"État du jour","planification":{"type":"quotidienne","heure":"18:00"},
         "sorties":[{"dossier":"facturation/etats","format":"md"}],"validationHumaine":false,"active":true},
        {"id":"avoirs","nom":"Préparer les avoirs","planification":{"type":"a-la-demande"},
         "sorties":[{"dossier":"facturation/avoirs","format":"pdf"}],"validationHumaine":true,"active":true}
    ]}"#;

    fn fiches(id: &str) -> Result<String, String> {
        match id {
            "AG-0028" => Ok(FICHE_MARIE.to_string()),
            "AG-0000" => Ok(r#"{"id":"AG-0000","taches":[]}"#.to_string()),
            _ => Err(format!("fiche {} absente", id)),
        }
    }

    fn poste() -> Value {
        json!({
            "agents": [
                { "prenom": "Alice", "ficheId": "AG-0000", "voix": "v" },
                { "prenom": "Marie", "ficheId": "AG-0028", "voix": "v",
                  "planning": {
                    "ajustements": [{ "tacheId": "avoirs", "active": false }],
                    "ajoutees": [{ "id": "compte-rendu", "nom": "Compte rendu du soir",
                                   "planification": { "type": "quotidienne", "heure": "19:00" },
                                   "sorties": [{ "dossier": "facturation/soir", "format": "md" }] }]
                  } }
            ]
        })
    }

    fn ajustement<'a>(i: &'a Value, tache: &str) -> Option<&'a Value> {
        i.pointer("/agents/1/planning/ajustements")?
            .as_array()?
            .iter()
            .find(|a| a["tacheId"] == tache)
    }

    #[test]
    fn un_horaire_se_regle_s_inscrit_et_se_defait() {
        let heure = json!({ "type": "quotidienne", "heure": "19:30" });
        let (apres, ch) = regler(&poste(), &fiches, "Alice", "Marie", "etat-du-jour",
            "planification", heure.clone(), "2026-09-24 12:00").unwrap();
        assert_eq!(ajustement(&apres, "etat-du-jour").unwrap()["planification"], heure);
        assert_eq!(ch.id, "CH-1");
        assert_eq!(ch.avant, None);
        assert_eq!(ch.tache_nom, "État du jour");
        assert_eq!(apres["changements"][0]["par"], "Alice");

        let (defait, annule) = annuler(&apres, &fiches, "CH-1", "2026-09-24 12:05").unwrap();
        assert!(ajustement(&defait, "etat-du-jour").is_none(), "l'ajustement vide doit disparaître");
        assert_eq!(annule.annule_le.as_deref(), Some("2026-09-24 12:05"));
        // L'historique garde la trace de ce qui a été fait puis défait.
        assert_eq!(defait["changements"].as_array().unwrap().len(), 1);
        assert!(annuler(&defait, &fiches, "CH-1", "x").unwrap_err().contains("déjà été annulé"));
    }

    #[test]
    fn l_annulation_rend_la_valeur_d_avant_pas_celle_de_la_fiche() {
        let (apres, _) = regler(&poste(), &fiches, "Alice", "Marie", "avoirs", "active",
            json!(true), "d").unwrap();
        assert_eq!(ajustement(&apres, "avoirs").unwrap()["active"], true);
        let (defait, _) = annuler(&apres, &fiches, "CH-1", "d").unwrap();
        assert_eq!(ajustement(&defait, "avoirs").unwrap()["active"], false);
    }

    #[test]
    fn on_n_annule_pas_un_reglage_qui_a_bouge_depuis() {
        let (un, _) = regler(&poste(), &fiches, "Alice", "Marie", "etat-du-jour", "validationHumaine",
            json!(true), "d").unwrap();
        let (deux, _) = regler(&un, &fiches, "Alice", "Marie", "etat-du-jour", "validationHumaine",
            json!(false), "d").unwrap();
        let refus = annuler(&deux, &fiches, "CH-1", "d").unwrap_err();
        assert!(refus.contains("annulez d'abord CH-2"), "{}", refus);
        let (trois, _) = annuler(&deux, &fiches, "CH-2", "d").unwrap();
        let (quatre, _) = annuler(&trois, &fiches, "CH-1", "d").unwrap();
        assert!(ajustement(&quatre, "etat-du-jour").is_none());
    }

    #[test]
    fn seul_un_team_holder_embauche_regle_les_autres() {
        let refus = regler(&poste(), &fiches, "Marie", "Marie", "etat-du-jour", "active",
            json!(false), "d").unwrap_err();
        assert!(refus.contains("n'est pas le Team Holder"), "{}", refus);
        assert!(regler(&poste(), &fiches, "Bob", "Marie", "etat-du-jour", "active", json!(false), "d").is_err());
    }

    #[test]
    fn il_ne_touche_que_trois_reglages() {
        for reglage in ["dossiers", "ficheId", "prenom", "competences", "sorties", "racine"] {
            let refus = regler(&poste(), &fiches, "Alice", "Marie", "etat-du-jour", reglage,
                json!("/"), "d").unwrap_err();
            assert!(refus.contains("ne règle que"), "{} : {}", reglage, refus);
        }
        assert!(regler(&poste(), &fiches, "Alice", "Marie", "etat-du-jour", "active", json!("oui"), "d").is_err());
        assert!(regler(&poste(), &fiches, "Alice", "Marie", "inconnue", "active", json!(false), "d")
            .unwrap_err().contains("pas de tâche"));
        assert!(regler(&poste(), &fiches, "Alice", "Zoé", "etat-du-jour", "active", json!(false), "d").is_err());
    }

    #[test]
    fn une_tache_ajoutee_se_regle_sur_elle_meme_et_ne_s_eteint_pas() {
        let (apres, _) = regler(&poste(), &fiches, "Alice", "Marie", "compte-rendu", "planification",
            json!({ "type": "quotidienne", "heure": "20:00" }), "d").unwrap();
        assert_eq!(apres.pointer("/agents/1/planning/ajoutees/0/planification/heure").unwrap(), "20:00");
        assert!(regler(&poste(), &fiches, "Alice", "Marie", "compte-rendu", "active", json!(false), "d")
            .unwrap_err().contains("elle se retire"));
    }

    #[test]
    fn un_reglage_deja_en_place_n_est_pas_inscrit() {
        assert!(regler(&poste(), &fiches, "Alice", "Marie", "avoirs", "active", json!(false), "d")
            .unwrap_err().contains("déjà réglée"));
    }

    #[test]
    fn un_horaire_suit_le_contrat() {
        for bon in [
            json!({ "type": "quotidienne", "heure": "07:05" }),
            json!({ "type": "hebdomadaire", "jour": "lundi", "heure": "09:00" }),
            json!({ "type": "mensuelle", "jour": 28, "heure": "23:59" }),
            json!({ "type": "intervalle", "minutes": 5 }),
            json!({ "type": "declencheur", "evenement": "email.recu" }),
            json!({ "type": "a-la-demande" }),
        ] {
            assert!(planification_recevable(&bon).is_ok(), "{}", bon);
        }
        for mauvais in [
            json!({ "type": "quotidienne", "heure": "24:00" }),
            json!({ "type": "quotidienne", "heure": "7h" }),
            json!({ "type": "hebdomadaire", "jour": "lundis", "heure": "09:00" }),
            json!({ "type": "mensuelle", "jour": 31, "heure": "09:00" }),
            json!({ "type": "intervalle", "minutes": 1 }),
            json!({ "type": "declencheur", "evenement": "sms.recu" }),
            json!({ "type": "a-la-demande", "heure": "09:00" }),
            json!({ "type": "tous-les-jours" }),
            json!("quotidienne"),
        ] {
            assert!(planification_recevable(&mauvais).is_err(), "{}", mauvais);
        }
    }

    #[test]
    fn il_ne_lit_que_ce_que_l_agent_depose() {
        let racine = std::env::temp_dir().join(format!("iagent-equipe-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&racine);
        let etats = racine.join("facturation").join("etats");
        std::fs::create_dir_all(&etats).unwrap();
        std::fs::write(etats.join("etat-du-jour-1.md"), "# État\nTrois factures.").unwrap();
        std::fs::write(etats.join("etat-du-jour-2.md.nouveau"), "en cours").unwrap();
        std::fs::write(racine.join("secret.txt"), "ne pas lire").unwrap();

        let mut agent = poste()["agents"][1].clone();
        agent["racine"] = json!(racine.display().to_string());
        let fiche: Value = serde_json::from_str(FICHE_MARIE).unwrap();

        let vus = productions(&agent, &fiche);
        assert_eq!(vus.len(), 1, "{:?}", vus);
        assert_eq!(vus[0].dossier, "facturation/etats");
        assert_eq!(vus[0].taches, vec!["etat-du-jour".to_string()]);

        let texte = lire_production(&agent, &fiche, Path::new(&vus[0].fichier)).unwrap();
        assert!(texte.contains("Trois factures"));

        let refus = lire_production(&agent, &fiche, &racine.join("secret.txt")).unwrap_err();
        assert!(refus.contains("pas dans un dossier"), "{}", refus);
        let detour = etats.join("..").join("..").join("secret.txt");
        assert!(lire_production(&agent, &fiche, &detour).is_err());

        let _ = std::fs::remove_dir_all(&racine);
    }
}
