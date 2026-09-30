use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Ce que l'employeur a reproché à son agent, et qui doit lui revenir à chaque
/// conversation. Sans cela, un refus vaut pour la session en cours puis
/// s'efface : l'agent recommencerait la même erreur le lendemain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entree {
    pub date: String,
    pub tache: String,
    pub raison: String,
}

/// Le prénom vient de l'interface : sans ce contrôle, il servirait à écrire
/// n'importe où sur le poste. Partagé avec `mcp.rs`, qui tient son propre
/// journal — deux fichiers par agent, un seul nettoyage de nom.
pub(crate) fn nom_propre(prenom: &str) -> Result<String, String> {
    let propre: String = prenom
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect();

    if propre.is_empty() || propre.len() > 64 {
        return Err(format!("prénom d'agent invalide : {}", prenom));
    }
    Ok(propre.to_lowercase())
}

fn nom_de_fichier_sur(prenom: &str) -> Result<String, String> {
    Ok(format!("journal-{}.json", nom_propre(prenom)?))
}

fn chemin(prenom: &str) -> Result<PathBuf, String> {
    // Un journal n'est jamais livré : il n'existe que parce que le client a
    // reproché quelque chose. Il se lit donc là où il s'écrit.
    Ok(crate::chemins::pour_ecrire(&format!(
        "config/{}",
        nom_de_fichier_sur(prenom)?
    )))
}

#[tauri::command]
pub fn journal_lire(prenom: String) -> Result<Vec<Entree>, String> {
    let fichier = chemin(&prenom)?;
    if !fichier.exists() {
        return Ok(Vec::new());
    }
    let brut = std::fs::read_to_string(&fichier)
        .map_err(|e| format!("lecture de {} : {}", fichier.display(), e))?;
    serde_json::from_str(&brut).map_err(|e| format!("journal illisible : {}", e))
}

/// Ajoute un retour au journal de l'agent. Les entrées s'accumulent : effacer
/// silencieusement les anciennes reviendrait à lui faire oublier ce qu'on lui a
/// appris.
#[tauri::command]
pub fn journal_ajouter(prenom: String, tache: String, raison: String) -> Result<usize, String> {
    if raison.trim().is_empty() {
        return Err("un retour sans raison n'apprend rien à l'agent".to_string());
    }

    let fichier = chemin(&prenom)?;
    if let Some(parent) = fichier.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("création de {} : {}", parent.display(), e))?;
    }

    let mut entrees = journal_lire(prenom.clone())?;
    entrees.push(Entree {
        date: horodatage(),
        tache,
        raison,
    });

    let brut = serde_json::to_string_pretty(&entrees)
        .map_err(|e| format!("écriture du journal : {}", e))?;
    std::fs::write(&fichier, brut)
        .map_err(|e| format!("écriture de {} : {}", fichier.display(), e))?;

    Ok(entrees.len())
}

fn horodatage() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secondes = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secondes)
}

#[cfg(test)]
mod tests {
    use super::nom_de_fichier_sur;

    #[test]
    fn un_prenom_donne_un_nom_de_fichier() {
        assert_eq!(nom_de_fichier_sur("Marie").unwrap(), "journal-marie.json");
        assert_eq!(nom_de_fichier_sur("Jean-Luc").unwrap(), "journal-jean-luc.json");
    }

    #[test]
    fn un_prenom_ne_peut_pas_sortir_du_dossier() {
        for mauvais in ["../../etc/passwd", "..", "/", "", "   ", "a/b"] {
            let obtenu = nom_de_fichier_sur(mauvais);
            if let Ok(nom) = &obtenu {
                assert!(!nom.contains('/'), "chemin échappé : {}", nom);
                assert!(!nom.contains(".."), "chemin échappé : {}", nom);
            }
        }
        assert!(nom_de_fichier_sur("").is_err());
        assert!(nom_de_fichier_sur("/").is_err());
    }
}
