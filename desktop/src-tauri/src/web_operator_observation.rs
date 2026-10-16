//! Observation structurelle dans la WebView Tauri EXISTANTE.
//!
//! Pour eviter un second navigateur et la perte des sessions, on utilise
//! WebviewWindow::eval_with_callback (Tauri 2.11.5, Cargo.lock).
//! Le script est CONST, sans texte ni selecteur provenant de l'agent.
//! On ne recupere JAMAIS les valeurs des champs, les cookies, les tokens ou
//! le HTML brut. Cette lecture ne donne pas de droit d'agir dans la page.
//! Le navigateur externe reste hors des capabilities Tauri.
//!
//! La presence d'un site dans navigateur-sites.json signifie seulement que
//! l'utilisateur l'a declare. Cela ne vaut pas autorisation de PUBLIER.
//! L'observation est reservee a un site declare et a HTTPS port standard.
//!
//! Limites : une page peut etre hostile, changer pendant l'observation ou
//! ne pas exposer son DOM (iframe cross-origin, Shadow DOM ferme, etc.).
//! Aucun resultat n'est presente comme un fait fiable sans validation.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, Url};

const SCRIPT_STRUCTURE: &str = include_str!("web_operator_snapshot.js");
const DELAI_OBSERVATION: Duration = Duration::from_secs(8);
const MAX_REPONSE: usize = 32_768;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementVue {
    pub tag: String,
    pub role: String,
    pub type_champ: String,
    pub nom: String,
    pub requis: bool,
    pub inactif: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub version: u8,
    #[serde(default)]
    pub origine: String,
    #[serde(default)]
    pub titre: String,
    #[serde(default)]
    pub titres: Vec<String>,
    #[serde(default)]
    pub elements: Vec<ElementVue>,
    #[serde(default)]
    pub erreur: Option<String>,
}

/// En lecture seulement, l'accord est une declaration utilisateur preexistante.
/// Pour toute action impactante, le controle Web Operator de phase C reste
/// distinct et exige une permission/validation humaine supplementaire.
fn site_observable(url: &Url, sites: &[crate::navigateur::SiteConnecte]) -> bool {
    if url.scheme() != "https" || url.port_or_known_default() != Some(443) {
        return false;
    }
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    let Some(hote) = url.host_str() else {
        return false;
    };
    sites.iter().any(|s| s.hote.eq_ignore_ascii_case(hote))
}

/// Verifie les bornes APRES deserialisation : meme une page malveillante ne
/// doit pas pouvoir gonfler les donnees qui iront ensuite aux agents.
fn valider_resultat(o: &Observation, origine_attendue: &str) -> Result<(), String> {
    if o.version != 1 || o.erreur.is_some() || o.origine != origine_attendue {
        return Err("La page n'a pas fourni une observation valide.".into());
    }
    if o.titre.chars().count() > 120 || o.titres.len() > 8 || o.elements.len() > 50 {
        return Err("La page a rendu une observation hors limites.".into());
    }
    if o.titres.iter().any(|t| t.chars().count() > 90)
        || o.elements.iter().any(|e| {
            e.tag.chars().count() > 20
                || e.role.chars().count() > 24
                || e.type_champ.chars().count() > 24
                || e.nom.chars().count() > 100
        })
    {
        return Err("La page a rendu une observation trop longue.".into());
    }
    Ok(())
}

/// Observe le navigateur visible deja connecte, sur demande depuis la vue
/// privilegiee. Aucune action ni saisie n'est executee dans le site.
///
/// L'agent recevra cette observation via son futur outil de lecture, APRES
/// application des permissions par agent existantes (mcp.rs).
#[tauri::command]
pub async fn navigateur_observer(app: AppHandle) -> Result<Observation, String> {
    let fenetre = app.get_webview_window("navigateur")
        .ok_or("Le navigateur est ferme. Ouvrez d'abord un compte.")?;
    let avant = fenetre.url()
        .map_err(|e| format!("Impossible de lire l'adresse de la page : {}", e))?;
    let sites = crate::navigateur::navigateur_sites()?;
    if !site_observable(&avant, &sites) {
        return Err(
            "Observation refusee : ouvrez un site HTTPS declare dans Vos comptes.".into()
        );
    }
    let origine = avant.origin().ascii_serialization();

    // eval_with_callback accepte une fonction Fn : le sender est pris au
    // premier resultat, pour ne pas bloquer un canal deja consomme.
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    fenetre.eval_with_callback(SCRIPT_STRUCTURE, move |reponse| {
        if let Ok(mut garde) = tx.lock() {
            if let Some(tx) = garde.take() {
                let _ = tx.send(reponse);
            }
        }
    }).map_err(|e| format!("La lecture de la page n'a pas demarre : {}", e))?;

    let brut = tokio::time::timeout(DELAI_OBSERVATION, rx)
        .await
        .map_err(|_| "La page n'a pas repondu sous huit secondes.".to_string())?
        .map_err(|_| "La page n'a pas rendu son observation.".to_string())?;
    if brut.len() > MAX_REPONSE {
        return Err("L'observation depasse la taille autorisee.".into());
    }
    let resultat: Observation = serde_json::from_str(&brut)
        .map_err(|_| "Le navigateur a renvoye une observation illisible.".to_string())?;
    valider_resultat(&resultat, &origine)?;

    // Une SPA / une redirection peut changer de page pendant l'evaluation.
    // Refuser alors le resultat, au lieu de l'attribuer a la nouvelle page.
    let apres = fenetre.url()
        .map_err(|e| format!("Impossible de verifier la page : {}", e))?;
    if apres != avant || !site_observable(&apres, &sites) {
        return Err("La page a change pendant l'observation. Reessayez.".into());
    }
    Ok(resultat)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn site() -> crate::navigateur::SiteConnecte {
        crate::navigateur::SiteConnecte {
            nom: "Mon compte".into(),
            hote: "www.example.com".into(),
            declare_le: 100,
        }
    }

    fn resultat() -> Observation {
        Observation {
            version: 1,
            origine: "https://www.example.com".into(),
            titre: "Votre compte".into(),
            titres: vec!["Profil".into()],
            elements: vec![ElementVue {
                tag: "input".into(),
                role: "".into(),
                type_champ: "email".into(),
                nom: "Adresse e-mail".into(),
                requis: true,
                inactif: false,
            }],
            erreur: None,
        }
    }

    #[test]
    fn observation_exige_une_origine_https_declaree() {
        let liste = vec![site()];
        for adresse in [
            "http://www.example.com/",
            "https://www.example.com:8443/",
            "https://www.example.com.attacker.test/",
            "https://example.com/",
            "https://login:secret@www.example.com/",
        ] {
            assert!(!site_observable(&Url::parse(adresse).unwrap(), &liste), "{}", adresse);
        }
        assert!(site_observable(&Url::parse("https://www.example.com/profil").unwrap(), &liste));
    }

    #[test]
    fn resultat_valide_et_borne() {
        assert!(valider_resultat(&resultat(), "https://www.example.com").is_ok());
        let mut autre = resultat();
        autre.elements[0].nom = "x".repeat(101);
        assert!(valider_resultat(&autre, "https://www.example.com").is_err());
        let mut autre = resultat();
        autre.origine = "https://phishing.test".into();
        assert!(valider_resultat(&autre, "https://www.example.com").is_err());
    }

    #[test]
    fn erreur_de_page_refusee() {
        let mut autre = resultat();
        autre.erreur = Some("observation_indisponible".into());
        assert!(valider_resultat(&autre, "https://www.example.com").is_err());
    }
}
