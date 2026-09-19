use std::path::PathBuf;

/// Les fiches et la configuration d'installation vivent à côté de l'exécutable.
/// Rust ne fait que les lire : l'assemblage (planning du client, prénom, sexe,
/// dossiers) reste en TypeScript, où il est testé. Dupliquer cette logique ici
/// la ferait diverger.
fn dossier_ressources() -> PathBuf {
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

#[cfg(test)]
mod tests {
    use super::identifiant_valide;

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
}
