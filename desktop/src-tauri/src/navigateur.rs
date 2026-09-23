//! Le navigateur du client, dans l'application.
//!
//! Ce que ce module fait, et ce qu'il ne fait pas, tient à une décision de Max
//! (2026-09-22) : « je ne veux pas que les agents enfreignent les règles ».
//! Le client ouvre ses propres comptes ici, avec ses propres identifiants ;
//! l'application ne les saisit jamais et ne les garde nulle part. Elle garde
//! seulement le profil du navigateur sur le disque du poste, pour qu'une
//! session ouverte une fois le reste au lancement suivant.
//!
//! Trois choses n'existent pas dans ce fichier, et c'est délibéré :
//!   - aucune commande n'injecte de script dans la page. Le cahier des charges
//!     en proposait une qui interpolait un sélecteur non échappé dans
//!     `executeJavaScript` : elle donne à n'importe quelle page le contrôle du
//!     poste, et elle n'entrera pas ici.
//!   - aucune autorisation n'est accordée d'office. Le même cahier des charges
//!     répondait `callback(true)` à toute demande de permission ; la page
//!     obtenait micro et caméra sans que personne ne soit prévenu.
//!   - rien ne clique, ne remplit ni ne publie. Agir dans la page vient en
//!     phase C, avec validation humaine avant tout envoi.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};

/// Une seule fenêtre de navigation, réutilisée. En ouvrir une par site
/// multiplierait les profils et ferait perdre les sessions déjà ouvertes.
const ETIQUETTE: &str = "navigateur";

/// Un compte que le client déclare avoir connecté. Aucun identifiant, aucun
/// mot de passe : seulement de quoi dire à l'agent où il peut travailler.
/// Ce que le client a tapé dans la page reste dans le profil du navigateur,
/// sur son poste, et ne remonte ni dans un paquet ni chez nous.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SiteConnecte {
    /// Nom que le client reconnaît : « Mon compte Sage », « LinkedIn ».
    pub nom: String,
    /// Hôte du site, sans schéma ni chemin : `www.sage.com`.
    pub hote: String,
    /// Quand le client l'a déclaré, en secondes depuis 1970.
    pub declare_le: u64,
}

fn dossier_ressources() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(std::path::Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Le profil ne va pas à côté de l'exécutable : sous Windows, une installation
/// par MSI pose l'application dans un dossier où l'utilisateur n'écrit pas, et
/// les cookies seraient perdus à chaque fermeture.
fn dossier_profil(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("dossier de données introuvable : {}", e))?;
    let profil = base.join(ETIQUETTE);
    std::fs::create_dir_all(&profil)
        .map_err(|e| format!("création de {} : {}", profil.display(), e))?;
    Ok(profil)
}

fn fichier_sites() -> PathBuf {
    dossier_ressources()
        .join("config")
        .join("navigateur-sites.json")
}

/// Seuls `http` et `https` ouvrent une page. Sans ce contrôle, une adresse
/// venue de l'interface ferait lire un fichier du poste (`file://`) ou
/// exécuter du script (`javascript:`) avec les droits de l'application.
pub fn adresse_valide(adresse: &str) -> Result<Url, String> {
    let url = Url::parse(adresse.trim()).map_err(|_| format!("adresse illisible : {}", adresse))?;

    match url.scheme() {
        "http" | "https" => {}
        autre => return Err(format!("adresse refusée, schéma {} : {}", autre, adresse)),
    }

    if url.host_str().unwrap_or("").is_empty() {
        return Err(format!("adresse sans site : {}", adresse));
    }

    Ok(url)
}

fn horodatage() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Ouvre le navigateur du client sur une adresse, ou l'y emmène s'il est déjà
/// ouvert. C'est le client qui se connecte à son compte dans cette fenêtre ;
/// l'application regarde la page se charger et n'y touche pas.
#[tauri::command]
pub fn navigateur_ouvrir(app: AppHandle, adresse: String) -> Result<String, String> {
    let url = adresse_valide(&adresse)?;

    if let Some(fenetre) = app.get_webview_window(ETIQUETTE) {
        fenetre
            .navigate(url.clone())
            .map_err(|e| format!("navigation vers {} : {}", url, e))?;
        fenetre
            .set_focus()
            .map_err(|e| format!("mise au premier plan : {}", e))?;
        return Ok(url.to_string());
    }

    let profil = dossier_profil(&app)?;

    WebviewWindowBuilder::new(&app, ETIQUETTE, WebviewUrl::External(url.clone()))
        .title("Vos comptes — iAgent")
        .inner_size(1280.0, 860.0)
        .resizable(true)
        // Le profil est persistant : c'est lui qui tient la session ouverte
        // d'un lancement à l'autre, ce que Max a demandé explicitement.
        .data_directory(profil)
        // Une fenêtre en navigation privée perdrait la session à la fermeture.
        .incognito(false)
        // La page du client n'a aucune raison d'appeler les commandes de
        // l'application : sans cela, un site visité pourrait lire ses fiches.
        .on_navigation(|url| matches!(url.scheme(), "http" | "https"))
        .build()
        .map_err(|e| format!("ouverture du navigateur : {}", e))?;

    Ok(url.to_string())
}

/// Ferme la fenêtre sans toucher au profil : les sessions restent ouvertes.
#[tauri::command]
pub fn navigateur_fermer(app: AppHandle) -> Result<bool, String> {
    match app.get_webview_window(ETIQUETTE) {
        Some(fenetre) => {
            fenetre
                .close()
                .map_err(|e| format!("fermeture du navigateur : {}", e))?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[tauri::command]
pub fn navigateur_sites() -> Result<Vec<SiteConnecte>, String> {
    let fichier = fichier_sites();
    if !fichier.exists() {
        return Ok(Vec::new());
    }
    let brut = std::fs::read_to_string(&fichier)
        .map_err(|e| format!("lecture de {} : {}", fichier.display(), e))?;
    serde_json::from_str(&brut).map_err(|e| format!("liste des sites illisible : {}", e))
}

/// Le client déclare qu'il a connecté un compte sur ce site. C'est une
/// déclaration, pas une vérification : l'application ne va pas lire la page
/// pour savoir s'il est connecté, et ne conserve ni identifiant ni mot de passe.
#[tauri::command]
pub fn navigateur_declarer_site(nom: String, adresse: String) -> Result<Vec<SiteConnecte>, String> {
    let nom = nom.trim().to_string();
    if nom.is_empty() || nom.len() > 120 {
        return Err(format!("nom de site invalide : {}", nom));
    }

    let url = adresse_valide(&adresse)?;
    let hote = url
        .host_str()
        .ok_or_else(|| format!("adresse sans site : {}", adresse))?
        .to_lowercase();

    let mut sites = navigateur_sites()?;
    // Un même site déclaré deux fois donnerait deux lignes pour un seul compte.
    sites.retain(|s| s.hote != hote);
    sites.push(SiteConnecte {
        nom,
        hote,
        declare_le: horodatage(),
    });
    sites.sort_by(|a, b| a.hote.cmp(&b.hote));

    ecrire_sites(&sites)?;
    Ok(sites)
}

#[tauri::command]
pub fn navigateur_oublier_site(hote: String) -> Result<Vec<SiteConnecte>, String> {
    let hote = hote.trim().to_lowercase();
    let mut sites = navigateur_sites()?;
    let avant = sites.len();
    sites.retain(|s| s.hote != hote);
    if sites.len() == avant {
        return Err(format!("aucun site déclaré pour {}", hote));
    }
    ecrire_sites(&sites)?;
    Ok(sites)
}

/// Efface le profil : le client est déconnecté partout, d'un seul geste.
/// C'est la contrepartie de la session conservée à vie, et elle doit rester
/// à portée de main.
#[tauri::command]
pub fn navigateur_effacer_sessions(app: AppHandle) -> Result<String, String> {
    if app.get_webview_window(ETIQUETTE).is_some() {
        return Err(
            "fermez d'abord la fenêtre de navigation : le profil est en cours d'utilisation"
                .to_string(),
        );
    }

    let profil = dossier_profil(&app)?;
    std::fs::remove_dir_all(&profil)
        .map_err(|e| format!("effacement de {} : {}", profil.display(), e))?;
    std::fs::create_dir_all(&profil)
        .map_err(|e| format!("création de {} : {}", profil.display(), e))?;

    // Les sites déclarés partent avec les sessions : les garder afficherait
    // des comptes connectés qui ne le sont plus.
    ecrire_sites(&Vec::new())?;

    Ok(profil.display().to_string())
}

fn ecrire_sites(sites: &[SiteConnecte]) -> Result<(), String> {
    let fichier = fichier_sites();
    if let Some(parent) = fichier.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("création de {} : {}", parent.display(), e))?;
    }
    let brut =
        serde_json::to_string_pretty(sites).map_err(|e| format!("écriture des sites : {}", e))?;
    std::fs::write(&fichier, brut).map_err(|e| format!("écriture de {} : {}", fichier.display(), e))
}

#[cfg(test)]
mod tests {
    use super::adresse_valide;

    #[test]
    fn une_adresse_web_est_acceptee() {
        assert!(adresse_valide("https://www.sage.com/fr-fr/").is_ok());
        assert!(adresse_valide("http://192.168.1.10:8080/erp").is_ok());
        assert!(adresse_valide("  https://linkedin.com  ").is_ok());
    }

    #[test]
    fn tout_autre_schema_est_refuse() {
        for mauvais in [
            "file:///etc/passwd",
            "file://C:/Windows/System32/config",
            "javascript:alert(1)",
            "data:text/html,<script>fetch('/')</script>",
            "tauri://localhost/agents",
            "ftp://exemple.fr",
            "",
            "pas une adresse",
        ] {
            assert!(
                adresse_valide(mauvais).is_err(),
                "adresse acceptée à tort : {}",
                mauvais
            );
        }
    }

    #[test]
    fn une_adresse_sans_site_est_refusee() {
        assert!(adresse_valide("http://").is_err());
        assert!(adresse_valide("http:///").is_err());
    }

    /// `https:///chemin` n'est pas une adresse sans site : la normalisation en
    /// fait `https://chemin/`, un hôte qui ne résoudra simplement pas. Le
    /// refuser reviendrait à refuser un intranet nommé d'un seul mot, ce qui
    /// arrive chez un client qui pointe son ERP par son nom de machine.
    #[test]
    fn un_hote_en_un_seul_mot_reste_accepte() {
        let url = adresse_valide("https:///chemin").expect("hôte d'un seul mot refusé");
        assert_eq!(url.host_str(), Some("chemin"));
        assert!(adresse_valide("https://serveur-erp/accueil").is_ok());
    }
}
