//! Pilote initial des gestes Web sur le navigateur Tauri deja present.
//!
//! Cette interface est destinee UNIQUEMENT aux essais manuels depuis "Vos
//! comptes". Elle n'est pas exposee aux agents par MCP : un booleen fourni par
//! un appelant n'est PAS une preuve cryptographique de consentement humain.
//! Avant toute delegation a un agent, brancher le gestionnaire d'autorisations
//! de web_operator.rs et les validations signees par le backend de confiance.
//!
//! On ne recoit ni code JavaScript, ni CSS selector de l'IA. Le pilote choisit
//! un element releve precedemment et borne le geste dans un script constant.
//! Chaque releve porte un identifiant aleatoire consomme au premier essai,
//! pour eviter le rejeu de gestes sur une page modifiee.

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Manager, Url};
use uuid::Uuid;

use crate::web_operator_observation::{ElementVue, Observation};

const SCRIPT_ACTION: &str = include_str!("web_operator_action.js");
const DELAI_ACTION: Duration = Duration::from_secs(8);
const MAX_REPONSE: usize = 2048;
const MAX_TEXTE: usize = 2000;

#[derive(Debug, Clone)]
struct Souvenir {
    id: String,
    adresse: String,
    elements: Vec<ElementVue>,
}

static DERNIERE_OBSERVATION: OnceLock<Mutex<Option<Souvenir>>> = OnceLock::new();

fn memoire() -> &'static Mutex<Option<Souvenir>> {
    DERNIERE_OBSERVATION.get_or_init(|| Mutex::new(None))
}

/// Une observation ne dure que pour la page actuelle, elle n'est pas un droit
/// permanent. L'UUID n'a pas le role d'un jeton de connexion.
pub(crate) fn memoriser(adresse: &Url, observation: &mut Observation) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let souvenir = Souvenir {
        id: id.clone(),
        adresse: adresse.to_string(),
        elements: observation.elements.clone(),
    };
    *memoire().lock().map_err(|_| "Memoire du navigateur indisponible.")? = Some(souvenir);
    observation.id = id;
    Ok(())
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GesteManuel {
    Renseigner,
    Cliquer,
}

#[derive(Debug, Clone, Deserialize)]
struct RetourScript {
    statut: String,
    #[serde(default)]
    motif: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RetourAction {
    pub statut: String,
    pub geste: GesteManuel,
    pub observation_a_rafraichir: bool,
}

/// La derniere observation est univoque et consommee immediatement ; toute
/// erreur oblige a relire le site, jamais a rejouer un clic incertain.
fn consommer(id: &str, index: usize, geste: GesteManuel) -> Result<(Souvenir, ElementVue), String> {
    let mut memoire = memoire().lock().map_err(|_| "Memoire du navigateur indisponible.")?;
    let valide = memoire.as_ref().is_some_and(|s| {
        s.id == id && !id.trim().is_empty() && s.elements.get(index).is_some()
    });
    if !valide {
        return Err("Observation perimee ou element absent. Relisez la page.".into());
    }
    let souvenir = memoire.take().ok_or("Observation absente.")?;
    let el = souvenir.elements[index].clone();
    if el.inactif || el.nom.trim().is_empty() {
        return Err("Cet element n'est pas utilisable depuis le pilote initial.".into());
    }
    match geste {
        GesteManuel::Renseigner => {
            let type_ok = matches!(el.type_champ.as_str(),
                "" | "text" | "email" | "tel" | "search" | "url" | "number");
            if !(el.tag == "textarea" || (el.tag == "input" && type_ok)) {
                return Err("Ce champ n'est pas pris en charge pour la saisie.".into());
            }
        }
        GesteManuel::Cliquer => {
            if el.tag != "button" {
                return Err("Seuls les boutons HTML explicites sont pris en charge.".into());
            }
        }
    }
    Ok((souvenir, el))
}

/// Aucune action ne part sans un clic explicite dans l'UI privilegiee.
/// Il est INTERDIT de brancher cet argument \`confirmation_humaine\` directement
/// au modele IA ou a un serveur MCP : c'est un bouton de banc d'essai manuel.
#[tauri::command]
pub async fn navigateur_action(
    app: AppHandle,
    observation_id: String,
    index: usize,
    geste: GesteManuel,
    texte: Option<String>,
    confirmation_humaine: bool,
) -> Result<RetourAction, String> {
    if !confirmation_humaine {
        return Err("Confirmez explicitement le geste avant de l'executer.".into());
    }
    if geste == GesteManuel::Renseigner && texte.as_ref().is_none_or(|t| t.chars().count() > MAX_TEXTE) {
        return Err("Le texte est absent ou depasse 2 000 caracteres.".into());
    }
    if geste == GesteManuel::Cliquer && texte.is_some() {
        return Err("Un clic ne doit contenir aucun texte.".into());
    }

    let (souvenir, element) = consommer(&observation_id, index, geste)?;
    let fenetre = app.get_webview_window("navigateur")
        .ok_or("Le navigateur est ferme. Ouvrez d'abord un compte.")?;
    let avant = fenetre.url()
        .map_err(|e| format!("Adresse du navigateur indisponible : {}", e))?;
    if avant.to_string() != souvenir.adresse {
        return Err("Le site a change. Relisez la page avant d'agir.".into());
    }
    let sites = crate::navigateur::navigateur_sites()?;
    if !crate::web_operator_observation::site_observable(&avant, &sites) {
        return Err("Action refusee : le site HTTPS doit etre declare.".into());
    }

    let payload = serde_json::json!({
        "adresse": souvenir.adresse,
        "origine": avant.origin().ascii_serialization(),
        "index": index,
        "geste": geste,
        "texte": texte,
        "element": element,
    });
    // Une chaine JSON encodee une seconde fois est inseree comme argument
    // JavaScript de JSON.parse(). Aucune chaine utilisateur n'est du JS libre.
    let json = serde_json::to_string(&payload)
        .map_err(|_| "Parametres d'action invalides.")?;
    let litteral = serde_json::to_string(&json)
        .map_err(|_| "Parametres d'action invalides.")?;
    let script = SCRIPT_ACTION.replace("__IAGENT_REQUEST__", &litteral);

    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = Arc::new(Mutex::new(Some(tx)));
    fenetre.eval_with_callback(script, move |reponse| {
        if let Ok(mut garde) = tx.lock() {
            if let Some(tx) = garde.take() {
                let _ = tx.send(reponse);
            }
        }
    }).map_err(|e| format!("L'action n'a pas pu demarrer : {}", e))?;
    let brut = tokio::time::timeout(DELAI_ACTION, rx)
        .await
        .map_err(|_| "Resultat inconnu apres huit secondes : ne relancez pas sans verification.".to_string())?
        .map_err(|_| "Le navigateur n'a pas confirme l'action.".to_string())?;
    if brut.len() > MAX_REPONSE {
        return Err("La reponse de l'action est trop volumineuse.".into());
    }
    let retour: RetourScript = serde_json::from_str(&brut)
        .map_err(|_| "Le navigateur a renvoye une reponse d'action illisible.".to_string())?;
    if retour.statut != "declenche" {
        return Err(format!(
            "Action refusee par la page : {}",
            retour.motif.as_deref().unwrap_or("sans_detail")
        ));
    }
    // Un clic peut modifier l'URL. Dans ce cas, retourner "declenche" veut
    // uniquement dire "l'evenement est parti". La validation du resultat est
    // une observation ulterieure, jamais ce booleen.
    Ok(RetourAction {
        statut: "declenche_non_verifie".into(),
        geste,
        observation_a_rafraichir: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn element(tag: &str, type_champ: &str) -> ElementVue {
        ElementVue {
            tag: tag.into(), role: String::new(), type_champ: type_champ.into(),
            nom: "Un champ".into(), requis: false, inactif: false,
        }
    }

    #[test]
    fn une_observation_ne_sert_qu_une_fois() {
        let adresse = Url::parse("https://example.com/formulaire").unwrap();
        let mut o = Observation {
            version: 1, id: String::new(), origine: "https://example.com".into(),
            titre: "".into(), titres: vec![], elements: vec![element("input", "text")], erreur: None,
        };
        memoriser(&adresse, &mut o).unwrap();
        assert!(!o.id.is_empty());
        let premier = consommer(&o.id, 0, GesteManuel::Renseigner);
        assert!(premier.is_ok());
        let second = consommer(&o.id, 0, GesteManuel::Renseigner);
        assert!(second.is_err());
    }

    #[test]
    fn aucun_mot_de_passe_ou_lien_ou_bouton_submit() {
        let adresse = Url::parse("https://example.com").unwrap();
        let mut o = Observation {
            version: 1, id: String::new(), origine: "https://example.com".into(),
            titre: "".into(), titres: vec![], elements: vec![element("input", "password")], erreur: None,
        };
        memoriser(&adresse, &mut o).unwrap();
        assert!(consommer(&o.id, 0, GesteManuel::Renseigner).is_err());

        o.elements = vec![element("a", "")];
        memoriser(&adresse, &mut o).unwrap();
        assert!(consommer(&o.id, 0, GesteManuel::Cliquer).is_err());
    }

    #[test]
    fn mauvais_identifiant_ne_consomme_pas_la_bonne_observation() {
        let adresse = Url::parse("https://example.com").unwrap();
        let mut o = Observation {
            version: 1, id: String::new(), origine: "https://example.com".into(),
            titre: "".into(), titres: vec![], elements: vec![element("input", "email")], erreur: None,
        };
        memoriser(&adresse, &mut o).unwrap();
        assert!(consommer("mauvais", 0, GesteManuel::Renseigner).is_err());
        assert!(consommer(&o.id, 0, GesteManuel::Renseigner).is_ok());
    }
}
