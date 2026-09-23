use std::path::PathBuf;

/// Les fiches et la configuration d'installation vivent à côté de l'exécutable.
/// Rust ne fait que les lire : l'assemblage (planning du client, prénom, sexe,
/// dossiers) reste en TypeScript, où il est testé. Dupliquer cette logique ici
/// la ferait diverger.
pub fn dossier_ressources() -> PathBuf {
    // En développement, l'exécutable est dans target/debug et l'installeur n'a
    // rien copié à côté : sans cette échappatoire, l'entretien d'embauche ne
    // trouverait aucun référentiel tant que l'application n'est pas installée.
    // Même convention que `voice.rs` pour Piper et les modèles.
    if let Some(v) = std::env::var_os("IAGENT_RESSOURCES") {
        return PathBuf::from(v);
    }
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(std::path::Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

#[tauri::command]
pub fn lire_installation() -> Result<String, String> {
    let chemin = dossier_ressources().join("config/installation.json");
    std::fs::read_to_string(&chemin)
        .map_err(|e| format!("lecture de {} : {}", chemin.display(), e))
}

/// L'identifiant vient de l'interface : sans ce contrôle, un « ../../ » ferait
/// lire n'importe quel fichier du poste.
fn identifiant_valide(id: &str) -> bool {
    let mut parties = id.splitn(2, '-');
    matches!(
        (parties.next(), parties.next()),
        (Some("AG"), Some(n))
            if n.len() == 4 && n.bytes().all(|b| b.is_ascii_digit())
    )
}

#[tauri::command]
pub fn lire_fiche(id: String) -> Result<String, String> {
    if !identifiant_valide(&id) {
        return Err(format!("identifiant de fiche invalide : {}", id));
    }

    let dossier = dossier_ressources().join("agents");
    let prefixe = format!("{}-", id);

    let entrees = std::fs::read_dir(&dossier)
        .map_err(|e| format!("lecture de {} : {}", dossier.display(), e))?;

    for entree in entrees.flatten() {
        let nom = entree.file_name();
        let nom = nom.to_string_lossy();
        if nom.starts_with(&prefixe) && nom.ends_with(".json") {
            return std::fs::read_to_string(entree.path())
                .map_err(|e| format!("lecture de {} : {}", nom, e));
        }
    }

    Err(format!("fiche {} absente du catalogue installé", id))
}


/// Contrôle ce que l'installation s'apprête à écrire, avant qu'elle l'écrive.
///
/// Rendue séparément de la commande pour être testée : c'est le seul endroit
/// qui empêche un prénom de sortir du dossier de configuration, et un banc qui
/// ne peut pas l'appeler ne prouve rien.
pub fn installation_recevable(contenu: &str) -> Result<(), String> {
    let json: serde_json::Value = serde_json::from_str(contenu)
        .map_err(|e| format!("installation illisible : {}", e))?;

    let agents = json
        .get("agents")
        .and_then(|a| a.as_array())
        .ok_or("installation sans liste d'agents")?;

    let mut prenoms_vus: Vec<String> = Vec::new();

    for agent in agents {
        let id = agent
            .get("ficheId")
            .and_then(|v| v.as_str())
            .ok_or("un agent installé sans identifiant de fiche")?;
        if !identifiant_valide(id) {
            return Err(format!("identifiant de fiche invalide : {}", id));
        }

        let prenom = agent
            .get("prenom")
            .and_then(|v| v.as_str())
            .ok_or("un agent installé sans prénom")?;
        // Le prénom sert à nommer le journal de l'agent (journal-<prenom>.json).
        // Un « ../ » qui passerait ici ferait écrire hors du dossier de config.
        if prenom.trim().is_empty() || prenom.chars().count() > 64 {
            return Err(format!("prénom d'agent invalide : {}", prenom));
        }
        if !prenom.chars().all(|c| c.is_alphanumeric() || c == '-' || c == ' ') {
            return Err(format!("prénom d'agent invalide : {}", prenom));
        }

        let clef = prenom.trim().to_lowercase();
        if prenoms_vus.contains(&clef) {
            return Err(format!("deux agents portent le prénom {}", prenom));
        }
        prenoms_vus.push(clef);
    }

    Ok(())
}

/// Écrit la configuration d'installation.
///
/// L'écriture passe par un fichier temporaire puis un renommage : une coupure
/// au milieu d'un `write` laisserait un `installation.json` tronqué, et
/// l'application ne redémarrerait plus.
#[tauri::command]
pub fn installation_ecrire(contenu: String) -> Result<String, String> {
    installation_recevable(&contenu)?;

    let chemin = dossier_ressources().join("config").join("installation.json");
    if let Some(parent) = chemin.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("création de {} : {}", parent.display(), e))?;
    }

    let provisoire = chemin.with_extension("json.nouveau");
    std::fs::write(&provisoire, contenu.as_bytes())
        .map_err(|e| format!("écriture de {} : {}", provisoire.display(), e))?;
    std::fs::rename(&provisoire, &chemin)
        .map_err(|e| format!("remplacement de {} : {}", chemin.display(), e))?;

    Ok(chemin.display().to_string())
}


/// Les seuls catalogues que l'interface peut demander.
///
/// Sans cette liste, le nom viendrait de la vue et servirait à lire n'importe
/// quel fichier du poste. On ne « nettoie » pas un chemin reçu de l'extérieur :
/// on refuse tout ce qui n'est pas dans cette liste.
const CATALOGUES: [(&str, &str); 4] = [
    ("logiciels", "catalogue/logiciels.json"),
    ("activites", "catalogue/activites.json"),
    ("catalogue", "catalogue/catalogue.json"),
    ("connecteurs", "connecteurs/catalogue.json"),
];

/// Lit un des catalogues livrés avec l'application.
///
/// L'entretien d'embauche en a besoin pour reconnaître ce que le client nomme :
/// sans le référentiel des logiciels, l'agent ne sait pas que « Sage » demande
/// une précision, et sans celui des activités il ne parle pas avec les mots de
/// la branche. Ils sont embarqués par l'installeur (`bundle.resources`).
#[tauri::command]
pub fn lire_referentiel(nom: String) -> Result<String, String> {
    let relatif = CATALOGUES
        .iter()
        .find(|(cle, _)| *cle == nom)
        .map(|(_, chemin)| *chemin)
        .ok_or_else(|| format!("catalogue inconnu : {}", nom))?;

    let chemin = dossier_ressources().join(relatif);
    std::fs::read_to_string(&chemin).map_err(|e| {
        format!(
            "lecture de {} : {} — le catalogue n'a pas été installé avec l'application",
            chemin.display(),
            e
        )
    })
}

/// Rendu séparément pour être testé : la commande, elle, touche au disque.
pub fn catalogue_connu(nom: &str) -> bool {
    CATALOGUES.iter().any(|(cle, _)| *cle == nom)
}

#[cfg(test)]
mod tests {
    use super::{catalogue_connu, identifiant_valide, installation_recevable};

    #[test]
    fn accepte_un_identifiant_de_fiche() {
        assert!(identifiant_valide("AG-0001"));
        assert!(identifiant_valide("AG-1249"));
    }

    #[test]
    fn refuse_ce_qui_sortirait_du_catalogue() {
        for mauvais in [
            "../../etc/passwd",
            "AG-0001/../../secret",
            "AG-00001",
            "AG-001",
            "AG-abcd",
            "ag-0001",
            "AG-0001.json",
            "",
        ] {
            assert!(!identifiant_valide(mauvais), "aurait dû refuser : {}", mauvais);
        }
    }

    #[test]
    fn une_installation_ordinaire_passe() {
        let bon = r#"{"agents":[
            {"prenom":"Marie","ficheId":"AG-0028","voix":"v1"},
            {"prenom":"Jean-Luc","ficheId":"AG-0179","voix":"v2"}
        ]}"#;
        assert!(installation_recevable(bon).is_ok());
        assert!(installation_recevable(r#"{"agents":[]}"#).is_ok());
    }

    #[test]
    fn un_prenom_ne_peut_pas_sortir_du_dossier_de_config() {
        for mauvais in [
            r#"{"agents":[{"prenom":"../../etc/passwd","ficheId":"AG-0028","voix":"v"}]}"#,
            r#"{"agents":[{"prenom":"a/b","ficheId":"AG-0028","voix":"v"}]}"#,
            r#"{"agents":[{"prenom":"..","ficheId":"AG-0028","voix":"v"}]}"#,
            r#"{"agents":[{"prenom":"  ","ficheId":"AG-0028","voix":"v"}]}"#,
        ] {
            assert!(
                installation_recevable(mauvais).is_err(),
                "prénom accepté à tort : {}",
                mauvais
            );
        }
    }

    #[test]
    fn deux_agents_ne_partagent_pas_un_prenom() {
        let doublon = r#"{"agents":[
            {"prenom":"Marie","ficheId":"AG-0028","voix":"v1"},
            {"prenom":"marie","ficheId":"AG-0179","voix":"v2"}
        ]}"#;
        assert!(installation_recevable(doublon).is_err());
    }

    #[test]
    fn seuls_les_catalogues_livres_se_lisent() {
        assert!(catalogue_connu("logiciels"));
        assert!(catalogue_connu("activites"));
        for mauvais in [
            "../../.env",
            "catalogue/logiciels.json",
            "logiciels.json",
            "Logiciels",
            "",
            "/etc/passwd",
        ] {
            assert!(!catalogue_connu(mauvais), "catalogue accepté à tort : {}", mauvais);
        }
    }

    /// Vérifie que la convention de chemin tient réellement : ce que
    /// `bundle.resources` installe à côté de l'exécutable est exactement ce que
    /// `lire_referentiel` va chercher. Une faute de frappe dans l'une des deux
    /// listes ne se verrait qu'après une installation sur un poste Windows.
    #[test]
    fn les_referentiels_du_depot_se_lisent_a_leur_place_installee() {
        // Le dépôt sert de dossier d'installation : `bundle.resources` y pose
        // catalogue/logiciels.json et catalogue/activites.json sous ces noms.
        std::env::set_var("IAGENT_RESSOURCES", concat!(env!("CARGO_MANIFEST_DIR"), "/../.."));

        for nom in ["logiciels", "activites", "catalogue", "connecteurs"] {
            let brut = super::lire_referentiel(nom.to_string())
                .unwrap_or_else(|e| panic!("référentiel {} illisible : {}", nom, e));
            let json: serde_json::Value = serde_json::from_str(&brut)
                .unwrap_or_else(|e| panic!("référentiel {} mal formé : {}", nom, e));
            assert!(json.is_object(), "référentiel {} inattendu", nom);
        }

        assert!(super::lire_referentiel("../../.env".to_string()).is_err());
        std::env::remove_var("IAGENT_RESSOURCES");
    }

    #[test]
    fn une_fiche_hors_catalogue_est_refusee() {
        let hors = r#"{"agents":[{"prenom":"Marie","ficheId":"../secret","voix":"v"}]}"#;
        assert!(installation_recevable(hors).is_err());
        assert!(installation_recevable("pas du json").is_err());
        assert!(installation_recevable(r#"{"commentaire":"rien"}"#).is_err());
    }
}
