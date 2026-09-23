//! Exécuter une tâche de la fiche et poser le résultat dans le dossier du client.
//!
//! C'était le trou du parcours minimal du cadrage — *installer → se connecter →
//! télécharger un agent → **une tâche s'exécute → résultat dans le dossier** →
//! conversation vocale*. Les 1 249 fiches décrivent 9 233 tâches, chacune avec
//! son dossier de sortie et son format, et rien dans l'application ne savait en
//! exécuter une : aucune commande, aucun écrivain de fichier. Un catalogue de
//! travail que personne ne fait n'est pas un employé.
//!
//! Trois refus tenus ici, dans le code et non dans une consigne au modèle :
//!
//! 1. **L'agent doit être embauché sur cette fiche.** Le prénom et la fiche
//!    viennent de l'écran ; c'est `installation.json`, écrit par le client, qui
//!    dit qui travaille chez lui. Sans ce contrôle, une vue suffirait à faire
//!    travailler une fiche que le client n'a jamais installée.
//! 2. **Le dossier de sortie est celui que le client a choisi.** La fiche ne
//!    nomme qu'un dossier logique (« courrier/reponses ») ; la correspondance
//!    vers un vrai dossier du poste est dans `installation.json`. Une tâche dont
//!    le dossier n'a pas été choisi ne s'exécute pas : elle n'écrit pas ailleurs
//!    « en attendant ».
//! 3. **Rien ne part du poste.** Cette commande écrit un fichier, et c'est tout.
//!    Un résultat qui attend un accord (`validationHumaine`) est écrit comme les
//!    autres et le dit ; il n'est ni envoyé ni publié. C'est la règle de Max :
//!    l'agent prépare, le client valide.
//!
//! **Ce qui n'est pas écrit** : `xlsx`, `docx`, `pdf` et les formats d'image, de
//! son et de vidéo. 4 100 tâches demandent un tableur, 523 un PDF, 310 un
//! document : l'application n'embarque aucune bibliothèque pour les produire.
//! `format_ecrivable()` le dit en clair plutôt que d'écrire un `.xlsx` qui n'en
//! serait pas un — même discipline que `diagnosticLocal()` côté dimensionnement.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Les formats que l'application sait réellement produire aujourd'hui.
///
/// Du texte, rien d'autre : ce sont les seuls que `std::fs::write` suffit à
/// écrire honnêtement. La liste s'allongera quand un écrivain existera pour de
/// bon, pas avant.
pub const FORMATS_ECRITS: [&str; 5] = ["md", "txt", "csv", "json", "html"];

/// Ce qu'il faudrait pour écrire les autres, dit au client plutôt que tu.
fn ce_qui_manque(format: &str) -> &'static str {
    match format {
        "xlsx" => "aucun écrivain de tableur n'est embarqué dans l'application",
        "docx" => "aucun écrivain de document n'est embarqué dans l'application",
        "pdf" => "aucun écrivain de PDF n'est embarqué dans l'application",
        "eml" => "l'envoi de courriel existe, mais pas l'écriture d'un brouillon sur le disque",
        "png" | "jpg" => "l'agent image ne tourne pas encore sur cette machine",
        "mp4" | "mp3" | "wav" => "l'agent son et vidéo ne tourne pas encore sur cette machine",
        _ => "ce format n'est pas prévu par le contrat des fiches",
    }
}

/// Dit si l'application sait produire ce format, et sinon pourquoi.
pub fn format_ecrivable(format: &str) -> Result<(), String> {
    if FORMATS_ECRITS.contains(&format) {
        return Ok(());
    }
    Err(format!(
        "la tâche rend un fichier « {} » et {} — le résultat n'est pas écrit plutôt qu'écrit de travers",
        format,
        ce_qui_manque(format)
    ))
}

/// Le vrai dossier du poste derrière le dossier logique d'une tâche.
///
/// Le client choisit ses dossiers à l'installation ; la fiche n'en connaît que
/// le nom logique. Un dossier non choisi est une question à lui poser, pas un
/// chemin à deviner : `dossiersManquants()` côté interface pose déjà la
/// question, et ici on refuse.
pub fn dossier_reel(dossiers: &serde_json::Value, logique: &str) -> Result<PathBuf, String> {
    let choisi = dossiers
        .get(logique)
        .and_then(serde_json::Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| {
            format!(
                "le dossier « {} » n'a pas encore été choisi sur cet ordinateur : l'agent ne sait pas où poser le résultat",
                logique
            )
        })?;

    let chemin = PathBuf::from(choisi);
    // Un chemin relatif se résoudrait depuis le dossier de travail de
    // l'application, qui n'est pas celui du client : le fichier atterrirait à
    // côté de l'exécutable sans que personne le retrouve.
    if !chemin.is_absolute() {
        return Err(format!(
            "le dossier choisi pour « {} » n'est pas un chemin complet : {}",
            logique, choisi
        ));
    }
    Ok(chemin)
}

/// Le nom du fichier posé dans le dossier.
///
/// Il vient de l'identifiant de la tâche (un slug du contrat) et de l'horodatage,
/// jamais du nom que le modèle aurait proposé : c'est le seul moyen de garantir
/// qu'un résultat ne peut pas écraser un fichier du client ni sortir du dossier.
pub fn nom_du_fichier(tache_id: &str, horodatage: &str, format: &str) -> Result<String, String> {
    let propre: String = tache_id
        .chars()
        .filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == '-')
        .collect();
    if propre.is_empty() || propre.len() > 64 || propre != tache_id {
        return Err(format!("identifiant de tâche invalide : {}", tache_id));
    }
    if !FORMATS_ECRITS.contains(&format) {
        return Err(format!("format non écrit : {}", format));
    }
    Ok(format!("{}-{}.{}", propre, horodatage, format))
}

/// L'heure du résultat, en chiffres triables (AAAAMMJJ-HHMMSS en temps universel).
///
/// Écrite à la main pour ne pas ajouter une dépendance de dates à l'application :
/// le client trie ses fichiers par nom et retrouve le dernier.
pub fn horodatage(secondes_depuis_epoque: u64) -> String {
    let jours = secondes_depuis_epoque / 86_400;
    let reste = secondes_depuis_epoque % 86_400;
    let (heure, minute, seconde) = (reste / 3600, (reste % 3600) / 60, reste % 60);

    // Civil-from-days, d'après l'algorithme de Howard Hinnant : pas de table de
    // bissextiles à tenir, donc rien à corriger dans dix ans.
    let z = jours as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let jour = doy - (153 * mp + 2) / 5 + 1;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 };
    let annee = if mois <= 2 { y + 1 } else { y };

    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        annee, mois, jour, heure, minute, seconde
    )
}

/// Écrit le résultat dans le dossier du client, sans jamais écraser.
///
/// Par fichier provisoire puis renommage, comme `installation_ecrire` : une
/// coupure au milieu laisserait au client un résultat tronqué qu'il croirait
/// complet.
pub fn poser(dossier: &Path, nom: &str, contenu: &str) -> Result<PathBuf, String> {
    std::fs::create_dir_all(dossier)
        .map_err(|e| format!("création de {} : {}", dossier.display(), e))?;

    let chemin = dossier.join(nom);
    if chemin.exists() {
        return Err(format!("{} existe déjà", chemin.display()));
    }
    let provisoire = dossier.join(format!("{}.nouveau", nom));
    std::fs::write(&provisoire, contenu.as_bytes())
        .map_err(|e| format!("écriture de {} : {}", provisoire.display(), e))?;
    std::fs::rename(&provisoire, &chemin)
        .map_err(|e| format!("mise en place de {} : {}", chemin.display(), e))?;
    Ok(chemin)
}

/// Ce que l'agent reçoit pour faire le travail : sa consigne, puis la tâche.
///
/// Le métier vient de la fiche et les procédures de l'employeur des compétences
/// ajoutées à l'embauche ; l'énoncé, lui, ne dit que la tâche du jour.
pub fn consigne_de_la_tache(
    consigne_fiche: &str,
    competences: &[String],
    tache_nom: &str,
    tache_description: &str,
    format: &str,
    validation_humaine: bool,
) -> (String, String) {
    let mut systeme = consigne_fiche.trim().to_string();
    if !competences.is_empty() {
        systeme.push_str("\n\nCe que votre employeur vous a appris :\n");
        for c in competences {
            systeme.push_str(&format!("- {}\n", c));
        }
    }
    systeme.push_str(&format!(
        "\n\nVous rendez un fichier « {} ». N'écrivez que son contenu : pas de préambule, pas de commentaire sur ce que vous avez fait.",
        format
    ));
    if validation_humaine {
        // L'agent doit savoir que son travail est relu : un texte écrit pour
        // être envoyé tel quel ne se relit pas de la même façon.
        systeme.push_str(" Ce résultat sera relu et validé avant d'être utilisé : signalez ce dont vous n'êtes pas sûr plutôt que de le combler.");
    }

    let enonce = format!("{}\n\n{}", tache_nom.trim(), tache_description.trim());
    (systeme, enonce)
}

/// Ce que l'écran affiche après l'exécution.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Resultat {
    /// Le fichier posé, chemin complet : le client doit pouvoir l'ouvrir.
    pub fichier: String,
    /// `local` ou `api`, et pourquoi — repris du choix de `modele.rs`.
    pub voie: String,
    pub motif: String,
    /// Vrai quand le résultat attend un accord avant d'être utilisé.
    pub validation_humaine: bool,
}

#[derive(Debug, Deserialize)]
struct SortieDeclaree {
    dossier: String,
    format: String,
}

/// La tâche à exécuter, lue dans la fiche installée.
struct TacheLue {
    nom: String,
    description: String,
    sortie: SortieDeclaree,
    validation_humaine: bool,
    active: bool,
}

fn lire_tache(fiche: &serde_json::Value, tache_id: &str) -> Result<TacheLue, String> {
    let taches = fiche
        .get("taches")
        .and_then(serde_json::Value::as_array)
        .ok_or("fiche sans tâches")?;
    let t = taches
        .iter()
        .find(|t| t.get("id").and_then(serde_json::Value::as_str) == Some(tache_id))
        .ok_or_else(|| format!("la fiche n'a pas de tâche « {} »", tache_id))?;

    let sorties = t
        .get("sorties")
        .and_then(serde_json::Value::as_array)
        .and_then(|s| s.first())
        .ok_or_else(|| format!("la tâche « {} » ne dit pas où va son résultat", tache_id))?;

    Ok(TacheLue {
        nom: t.get("nom").and_then(serde_json::Value::as_str).unwrap_or(tache_id).to_string(),
        description: t
            .get("description")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string(),
        sortie: serde_json::from_value(sorties.clone())
            .map_err(|e| format!("sortie illisible pour « {} » : {}", tache_id, e))?,
        validation_humaine: t
            .get("validationHumaine")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(true),
        active: t.get("active").and_then(serde_json::Value::as_bool).unwrap_or(false),
    })
}

/// L'agent installé sous ce prénom, et ce que le client lui a donné.
fn agent_installe(
    installation: &serde_json::Value,
    prenom: &str,
    fiche_id: &str,
) -> Result<serde_json::Value, String> {
    installation
        .get("agents")
        .and_then(serde_json::Value::as_array)
        .and_then(|agents| {
            agents
                .iter()
                .find(|a| {
                    a.get("prenom").and_then(serde_json::Value::as_str) == Some(prenom)
                        && a.get("ficheId").and_then(serde_json::Value::as_str) == Some(fiche_id)
                })
                .cloned()
        })
        .ok_or_else(|| format!("{} n'est pas embauché sur la fiche {}", prenom, fiche_id))
}

/// Tout ce qu'il faut pour exécuter une tâche, décidé avant d'appeler le modèle.
///
/// Rendu séparément de la commande pour être éprouvé : c'est ici que se
/// refusent l'agent non embauché, la tâche éteinte, le dossier non choisi et le
/// format que l'application ne sait pas écrire. Un banc qui ne peut pas
/// l'appeler ne prouverait rien de ces quatre refus.
#[derive(Debug, Clone, PartialEq)]
pub struct Preparation {
    pub dossier: PathBuf,
    pub nom_fichier: String,
    pub systeme: String,
    pub enonce: String,
    pub validation_humaine: bool,
}

pub fn preparer(
    installation: &str,
    fiche: &str,
    prenom: &str,
    fiche_id: &str,
    tache_id: &str,
    maintenant: u64,
) -> Result<Preparation, String> {
    let installation: serde_json::Value = serde_json::from_str(installation)
        .map_err(|e| format!("installation illisible : {}", e))?;
    let agent = agent_installe(&installation, prenom, fiche_id)?;

    let fiche: serde_json::Value =
        serde_json::from_str(fiche).map_err(|e| format!("fiche illisible : {}", e))?;
    let tache = lire_tache(&fiche, tache_id)?;
    // Le client éteint les tâches qu'il ne veut pas : les exécuter quand même
    // ferait travailler l'agent sur ce qu'on lui a retiré.
    if !tache.active {
        return Err(format!(
            "la tâche « {} » est éteinte sur cet ordinateur : le client l'a désactivée",
            tache.nom
        ));
    }

    format_ecrivable(&tache.sortie.format)?;
    let vide = serde_json::json!({});
    let dossier = dossier_reel(agent.get("dossiers").unwrap_or(&vide), &tache.sortie.dossier)?;
    let nom_fichier = nom_du_fichier(tache_id, &horodatage(maintenant), &tache.sortie.format)?;

    let consigne = fiche
        .get("expert")
        .and_then(|e| e.get("consigne"))
        .and_then(serde_json::Value::as_str)
        .ok_or("la fiche ne porte pas de consigne : l'agent ne saurait pas comment travailler")?;
    let competences: Vec<String> = agent
        .get("competences")
        .and_then(serde_json::Value::as_array)
        .map(|v| {
            v.iter()
                .filter_map(|c| {
                    c.get("texte")
                        .or_else(|| c.get("contenu"))
                        .and_then(serde_json::Value::as_str)
                        .or_else(|| c.as_str())
                        .map(str::to_string)
                })
                .collect()
        })
        .unwrap_or_default();

    let (systeme, enonce) = consigne_de_la_tache(
        consigne,
        &competences,
        &tache.nom,
        &tache.description,
        &tache.sortie.format,
        tache.validation_humaine,
    );

    Ok(Preparation {
        dossier,
        nom_fichier,
        systeme,
        enonce,
        validation_humaine: tache.validation_humaine,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn installation(dossiers: &str) -> String {
        format!(
            r#"{{"agents":[{{"prenom":"Camille","ficheId":"AG-0001","voix":"fr","dossiers":{},"competences":[]}}]}}"#,
            dossiers
        )
    }

    fn fiche(format: &str, active: bool, validation: bool) -> String {
        format!(
            r#"{{"id":"AG-0001","expert":{{"consigne":"Vous tenez le secrétariat."}},
               "taches":[{{"id":"compte-rendu","nom":"Compte rendu du soir",
                 "description":"Résumer la journée.",
                 "sorties":[{{"dossier":"courrier/reponses","format":"{}"}}],
                 "validationHumaine":{},"active":{}}}]}}"#,
            format, validation, active
        )
    }

    const DOSSIERS: &str = r#"{"courrier/reponses":"/tmp/iagent-essai"}"#;

    /// Le cœur du parcours minimal : une tâche allumée, un dossier choisi, un
    /// format écrivable, et l'agent sait quoi faire et où le poser.
    #[test]
    fn une_tache_prete_donne_de_quoi_travailler_et_ou_ecrire() {
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            1_758_585_600,
        )
        .expect("la tâche devrait être prête");
        assert_eq!(p.dossier, PathBuf::from("/tmp/iagent-essai"));
        assert_eq!(p.nom_fichier, "compte-rendu-20250923-000000.md");
        assert!(p.systeme.contains("Vous tenez le secrétariat."));
        assert!(p.systeme.contains("fichier « md »"));
        assert!(p.enonce.contains("Compte rendu du soir"));
        assert!(!p.validation_humaine);
    }

    /// Le prénom et la fiche viennent de l'écran ; seule l'installation dit qui
    /// travaille chez le client. Sans ce refus, une vue suffirait à faire
    /// travailler une fiche que personne n'a installée.
    #[test]
    fn un_agent_non_embauche_ne_travaille_pas() {
        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Dominique",
            "AG-0001",
            "compte-rendu",
            0,
        )
        .unwrap_err();
        assert!(e.contains("n'est pas embauché"), "{}", e);

        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0002",
            "compte-rendu",
            0,
        )
        .unwrap_err();
        assert!(e.contains("n'est pas embauché"), "{}", e);
    }

    /// Le client éteint ce qu'il ne veut pas : l'agent ne le fait pas quand même.
    #[test]
    fn une_tache_eteinte_ne_s_execute_pas() {
        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", false, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
        )
        .unwrap_err();
        assert!(e.contains("éteinte"), "{}", e);
    }

    /// Un dossier non choisi est une question à poser au client, pas un chemin à
    /// deviner : le résultat n'atterrit pas « en attendant » à côté de l'exécutable.
    #[test]
    fn sans_dossier_choisi_rien_n_est_ecrit_ailleurs() {
        let e = preparer(
            &installation("{}"),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
        )
        .unwrap_err();
        assert!(e.contains("n'a pas encore été choisi"), "{}", e);

        // Un chemin relatif se résoudrait depuis le dossier de l'application.
        let e = preparer(
            &installation(r#"{"courrier/reponses":"reponses"}"#),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
        )
        .unwrap_err();
        assert!(e.contains("chemin complet"), "{}", e);
    }

    /// 4 100 tâches demandent un tableur et l'application n'en écrit aucun :
    /// elle doit le dire, pas poser un `.xlsx` qui n'en est pas un.
    #[test]
    fn un_format_non_ecrit_se_dit_au_lieu_de_s_inventer() {
        for (format, mot) in [("xlsx", "tableur"), ("docx", "document"), ("pdf", "PDF")] {
            let e = preparer(
                &installation(DOSSIERS),
                &fiche(format, true, false),
                "Camille",
                "AG-0001",
                "compte-rendu",
                0,
            )
            .unwrap_err();
            assert!(e.contains(format) && e.contains(mot), "{} : {}", format, e);
        }
        assert!(format_ecrivable("md").is_ok());
        assert!(format_ecrivable("csv").is_ok());
    }

    /// Le nom du fichier ne vient jamais de ce que le modèle propose : il est
    /// construit ici, sinon un résultat pourrait écraser un fichier du client ou
    /// sortir de son dossier.
    #[test]
    fn le_nom_du_fichier_ne_peut_pas_sortir_du_dossier() {
        assert!(nom_du_fichier("../../etc/passwd", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("compte rendu", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("Compte-Rendu", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("compte-rendu", "20250923-000000", "xlsx").is_err());
        assert_eq!(
            nom_du_fichier("compte-rendu", "20250923-000000", "md").unwrap(),
            "compte-rendu-20250923-000000.md"
        );
    }

    /// L'horodatage se lit et se trie : le client retrouve le dernier résultat
    /// dans son explorateur de fichiers, sans nous.
    #[test]
    fn l_horodatage_se_lit_et_se_trie() {
        assert_eq!(horodatage(0), "19700101-000000");
        assert_eq!(horodatage(1_758_585_600), "20250923-000000");
        assert_eq!(horodatage(1_758_585_600 + 3_661), "20250923-010101");
        // Une date après un 29 février : l'algorithme n'a pas de table à tenir.
        assert_eq!(horodatage(1_709_208_000), "20240229-120000");
        assert!(horodatage(1_758_585_600) < horodatage(1_758_672_000));
    }

    /// Un résultat relu n'est pas écrit comme un résultat envoyé : l'agent doit
    /// savoir qu'il peut signaler un doute plutôt que de le combler.
    #[test]
    fn un_resultat_qui_attend_un_accord_le_dit_a_l_agent() {
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, true),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
        )
        .unwrap();
        assert!(p.validation_humaine);
        assert!(p.systeme.contains("relu et validé"), "{}", p.systeme);
    }

    /// Ce que l'employeur a appris à son agent s'ajoute au métier de la fiche,
    /// il ne le remplace pas.
    #[test]
    fn les_competences_de_l_employeur_s_ajoutent_a_la_fiche() {
        let inst = r#"{"agents":[{"prenom":"Camille","ficheId":"AG-0001",
            "dossiers":{"courrier/reponses":"/tmp/iagent-essai"},
            "competences":[{"texte":"Nos devis partent toujours en PDF."}]}]}"#;
        let p = preparer(inst, &fiche("md", true, false), "Camille", "AG-0001", "compte-rendu", 0)
            .unwrap();
        assert!(p.systeme.contains("Vous tenez le secrétariat."));
        assert!(p.systeme.contains("Nos devis partent toujours en PDF."));
    }

    /// Le fichier est posé entier ou pas du tout, et n'écrase jamais.
    #[test]
    fn le_resultat_est_pose_entier_et_n_ecrase_rien() {
        let dossier = std::env::temp_dir().join(format!("iagent-tache-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);

        let chemin = poser(&dossier, "essai.md", "Le compte rendu.").unwrap();
        assert_eq!(std::fs::read_to_string(&chemin).unwrap(), "Le compte rendu.");

        let e = poser(&dossier, "essai.md", "Autre chose.").unwrap_err();
        assert!(e.contains("existe déjà"), "{}", e);
        // Le premier résultat n'a pas bougé.
        assert_eq!(std::fs::read_to_string(&chemin).unwrap(), "Le compte rendu.");
        // Et rien de provisoire n'est resté dans le dossier du client.
        let restes: Vec<_> = std::fs::read_dir(&dossier)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(restes, vec!["essai.md".to_string()]);

        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// Une tâche que la fiche ne porte pas ne s'invente pas.
    #[test]
    fn une_tache_inconnue_se_refuse() {
        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "autre-chose",
            0,
        )
        .unwrap_err();
        assert!(e.contains("autre-chose"), "{}", e);
    }
}
