//! Où l'application lit ce qui est livré avec elle, et où elle écrit ce que le
//! client produit. **Deux racines, et un seul endroit qui dit laquelle.**
//!
//! Ce qui a fait écrire ce module, constaté le 25/09/2026 sur la 0.2.0 installée
//! par le MSI dans `C:\Program Files\iAgent Desktop` : **rien de ce que
//! l'application écrit ne pouvait s'écrire.** Tout passait par le dossier de
//! l'exécutable, où `BUILTIN\Utilisateurs` n'a que la lecture et l'exécution, et
//! l'application tourne sans élévation. Conséquences mesurées, dans l'ordre de
//! gravité :
//!
//!   - `config/installation.json` : une embauche ne pouvait pas être
//!     sauvegardée. Le client passait l'entretien, l'agent disparaissait.
//!   - les quatre pièces de la voix ne se téléchargeaient pas, donc ni écoute,
//!     ni parole, ni empreinte vocale — c'est par là que le défaut s'est vu.
//!   - le journal de reprise et le journal des outils n'étaient pas tenus.
//!
//! Et son frère : `Database::new("iagent.db")`, un chemin **relatif au dossier
//! courant**. L'application lancée depuis la fin de l'installeur ouvrait sa base
//! dans `C:\Users\…\Downloads`. Lancée depuis le menu Démarrer le lendemain,
//! elle n'y retournait pas : la base semblait vide.
//!
//! Le remède existait déjà dans le dépôt, à un seul endroit
//! (`navigateur::dossier_profil`, qui pose le profil du navigateur sous
//! `app_local_data_dir` « parce qu'une installation par MSI pose l'application
//! dans un dossier où l'utilisateur n'écrit pas »). Il était juste, il n'était
//! pas appliqué ailleurs. **Une règle écrite une fois et appliquée à un seul
//! endroit ne protège que cet endroit.**

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// La racine inscriptible, posée une seule fois au démarrage depuis la réponse
/// de Tauri. Elle n'est pas calculée ici : le dossier de données d'une
/// application dépend du système et de son identifiant, et le recalculer à la
/// main donnerait un second avis qui finirait par différer du premier.
static DONNEES: OnceLock<PathBuf> = OnceLock::new();

/// Dit une seule fois que la racine n'a pas été posée. Sans ce garde, le message
/// reviendrait à chaque écriture.
static SECOURS_DIT: OnceLock<()> = OnceLock::new();

/// Posé par `main`, dans son `setup`, avant qu'aucune commande ne tourne.
///
/// Refuse d'être posé deux fois : deux racines dans une même exécution, c'est
/// une embauche écrite d'un côté et relue de l'autre.
pub fn poser_dossier_donnees(chemin: PathBuf) -> Result<(), String> {
    DONNEES.set(chemin).map_err(|refuse| {
        format!(
            "le dossier de données est déjà posé ({}) : {} refusé",
            dossier_donnees().display(),
            refuse.display()
        )
    })
}

/// La racine inscriptible.
///
/// `IAGENT_DONNEES` la déplace, pour le développement et les bancs, où aucun
/// `setup` de Tauri ne tourne. À défaut, `IAGENT_RESSOURCES` sert des deux
/// côtés : en développement les deux racines sont le même dossier, ce que tous
/// les bancs supposent déjà — un banc qui écrit puis relit doit retrouver son
/// fichier sans rien apprendre de neuf. Sans l'une ni l'autre et sans `setup`,
/// on écrit dans un dossier temporaire **en le disant** : le silence renverrait
/// les écritures à côté de l'exécutable, c'est-à-dire au défaut que ce module
/// corrige.
pub fn dossier_donnees() -> PathBuf {
    if let Some(v) = std::env::var_os("IAGENT_DONNEES") {
        return PathBuf::from(v);
    }
    if let Some(pose) = DONNEES.get() {
        return pose.clone();
    }
    if let Some(v) = std::env::var_os("IAGENT_RESSOURCES") {
        return PathBuf::from(v);
    }
    let secours = std::env::temp_dir().join("iagent-donnees");
    if SECOURS_DIT.set(()).is_ok() {
        eprintln!(
            "dossier de données non posé au démarrage : écriture de secours dans {}. \
             C'est un défaut de démarrage, pas un réglage.",
            secours.display()
        );
    }
    secours
}

/// La racine livrée : les fiches, les catalogues, le dimensionnement, tout ce
/// que l'installeur a copié à côté de l'exécutable. En lecture seule sur un
/// poste installé, et c'est bien ainsi.
pub fn dossier_livre() -> PathBuf {
    crate::fiches::dossier_ressources()
}

/// Le chemin d'un fichier que l'application écrit. Toujours sous la racine
/// inscriptible, jamais à côté de l'exécutable.
pub fn pour_ecrire(relatif: &str) -> PathBuf {
    dossier_donnees().join(relatif)
}

/// Le chemin d'un fichier que l'application lit et peut avoir écrit : ce que le
/// client a écrit d'abord, ce qui est livré ensuite.
///
/// L'ordre compte et n'est pas symétrique. `config/installation.json` est livré
/// avec trois agents de démonstration **et** réécrit à chaque embauche : lire le
/// livré d'abord rendrait au client la démonstration à la place de son équipe.
pub fn pour_lire(relatif: &str) -> PathBuf {
    a_lire(&dossier_donnees(), &dossier_livre(), relatif)
}

/// La règle de lecture, les deux racines données.
///
/// Séparée pour être éprouvable : les racines réelles viennent de Tauri et d'un
/// exécutable installé, que le banc n'a ni l'un ni l'autre.
fn a_lire(donnees: &Path, livre: &Path, relatif: &str) -> PathBuf {
    let ecrit = donnees.join(relatif);
    if ecrit.exists() {
        ecrit
    } else {
        livre.join(relatif)
    }
}

/// Crée le dossier parent d'un fichier qu'on va écrire.
///
/// Le message nomme le dossier, parce que c'est lui que le client doit pouvoir
/// montrer quand l'écriture est refusée : « accès refusé » sans chemin n'aide
/// personne.
pub fn preparer(chemin: &Path) -> Result<(), String> {
    if let Some(parent) = chemin.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("création de {} : {}", parent.display(), e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dossier(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("iagent-chemins-{}-{}", nom, std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn lit_le_livre_quand_le_client_n_a_rien_ecrit() {
        let donnees = dossier("lit-livre-d");
        let livre = dossier("lit-livre-l");
        std::fs::create_dir_all(livre.join("config")).unwrap();
        std::fs::write(livre.join("config/installation.json"), "{}").unwrap();

        let vu = a_lire(&donnees, &livre, "config/installation.json");
        assert_eq!(vu, livre.join("config/installation.json"));
    }

    #[test]
    fn prefere_ce_que_le_client_a_ecrit() {
        let donnees = dossier("prefere-d");
        let livre = dossier("prefere-l");
        for racine in [&donnees, &livre] {
            std::fs::create_dir_all(racine.join("config")).unwrap();
            std::fs::write(racine.join("config/installation.json"), "{}").unwrap();
        }

        let vu = a_lire(&donnees, &livre, "config/installation.json");
        assert_eq!(
            vu,
            donnees.join("config/installation.json"),
            "l'équipe embauchée par le client passe avant la démonstration livrée"
        );
    }

    /// Un fichier que rien n'a écrit et que rien ne livre doit rendre le chemin
    /// livré, pas un chemin vide : c'est celui qui porte le bon message d'erreur
    /// (« il faut réinstaller »), pas « fichier introuvable dans un dossier de
    /// données que le client n'a jamais vu ».
    #[test]
    fn un_fichier_absent_des_deux_cotes_rend_le_chemin_livre() {
        let donnees = dossier("absent-d");
        let livre = dossier("absent-l");
        let vu = a_lire(&donnees, &livre, "dimensionnement/machines.json");
        assert_eq!(vu, livre.join("dimensionnement/machines.json"));
    }

    #[test]
    fn preparer_cree_le_dossier_parent() {
        let d = dossier("preparer");
        let fichier = d.join("config").join("installation.json");
        preparer(&fichier).unwrap();
        assert!(fichier.parent().unwrap().is_dir());
    }
}
