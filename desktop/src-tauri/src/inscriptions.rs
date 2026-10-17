//! Les images des comptes d'iAgent : l'avatar et les bannières fabriqués
//! depuis le logo officiel (`src/inscriptions/fabriquer-visuels.mjs`), compilés
//! dans le binaire et posés dans le dossier des téléversements, le seul d'où
//! un agent peut joindre un fichier. Ce qui y est déjà n'est jamais écrasé :
//! le dirigeant peut y remplacer une image par la sienne sous le même nom.

use crate::pilote;

/// Nom du fichier et son contenu. `check-inscriptions.ts` vérifie que le
/// registre ne cite que ces noms, et que chacun existe sur le disque.
pub const VISUELS: &[(&str, &[u8])] = &[
    ("avatar-iagent-800.png", include_bytes!("../../src/inscriptions/visuels/avatar-iagent-800.png")),
    ("banniere-iagent-1500x500.jpg", include_bytes!("../../src/inscriptions/visuels/banniere-iagent-1500x500.jpg")),
    ("banniere-iagent-facebook-1640x624.jpg", include_bytes!("../../src/inscriptions/visuels/banniere-iagent-facebook-1640x624.jpg")),
    ("banniere-iagent-linkedin-1128x191.jpg", include_bytes!("../../src/inscriptions/visuels/banniere-iagent-linkedin-1128x191.jpg")),
    ("banniere-iagent-youtube-2560x1440.jpg", include_bytes!("../../src/inscriptions/visuels/banniere-iagent-youtube-2560x1440.jpg")),
];

/// Pose dans `dossier` les images absentes ; rend les noms posés.
pub fn poser(dossier: &std::path::Path) -> Result<Vec<String>, String> {
    std::fs::create_dir_all(dossier).map_err(|e| format!("création de {} : {}", dossier.display(), e))?;
    let mut poses = Vec::new();
    for (nom, octets) in VISUELS {
        let chemin = dossier.join(nom);
        if chemin.exists() {
            continue;
        }
        std::fs::write(&chemin, octets).map_err(|e| format!("écriture de {} : {}", chemin.display(), e))?;
        poses.push(nom.to_string());
    }
    Ok(poses)
}

/// Les images des comptes d'iAgent, prêtes dans le dossier des téléversements.
#[tauri::command]
pub fn inscriptions_preparer_visuels() -> Result<Vec<String>, String> {
    poser(&pilote::dossier_televersements()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn les_images_se_posent_sans_ecraser_celles_du_dirigeant() {
        let d = std::env::temp_dir().join(format!("iagent-visuels-{}", uuid::Uuid::new_v4().simple()));
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("avatar-iagent-800.png"), b"le sien").unwrap();
        let poses = poser(&d).unwrap();
        assert_eq!(poses.len(), VISUELS.len() - 1);
        assert_eq!(std::fs::read(d.join("avatar-iagent-800.png")).unwrap(), b"le sien");
        assert!(poser(&d).unwrap().is_empty(), "un second passage ne pose rien");
        for (nom, octets) in VISUELS {
            assert!(octets.len() > 10_000, "{} semble vide", nom);
        }
        let _ = std::fs::remove_dir_all(&d);
    }
}
