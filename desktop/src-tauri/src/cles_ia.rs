//! The client's keys for the AI services of `catalogue/api-ia.json`, one per
//! account (one OpenAI key serves GPT Image, Sora and OpenAI Audio alike).
//!
//! Same rule as `llm.rs`: the key goes to the system keychain, never comes back
//! to the screen, never sits in a file. Anthropic keeps its own entry in
//! `llm.rs`, which is the only place the app reads it from; this module hands
//! that account over rather than keeping a second copy.
//!
//! Saving a key is not using it. Only the accounts whose API the app actually
//! calls (`branche` in the catalogue) are used by the agents today; for the
//! others the message says so in plain words, so the screen never reads
//! "connected" for a service nothing calls.

use serde::Serialize;
use serde_json::Value;

const CATALOGUE: &str = include_str!("../../../catalogue/api-ia.json");
const SERVICE_TROUSSEAU: &str = "iagent-api";
/// The account `llm.rs` owns.
const COMPTE_LLM: &str = "anthropic";

#[derive(Serialize)]
pub struct CleCompte {
    pub compte: String,
    pub rangee: bool,
    pub employee: bool,
}

fn catalogue() -> Value {
    serde_json::from_str(CATALOGUE).expect("catalogue/api-ia.json is checked by check-api-ia.ts")
}

fn comptes() -> Vec<String> {
    catalogue()["comptes"]
        .as_object()
        .map(|o| o.keys().cloned().collect())
        .unwrap_or_default()
}

/// An account is used when at least one of its APIs is actually called.
fn employe(compte: &str) -> bool {
    catalogue()["apis"].as_array().into_iter().flatten().any(|a| {
        a["compte"].as_str() == Some(compte) && a["branche"].as_bool() == Some(true)
    })
}

fn compte_connu(compte: &str) -> Result<(), String> {
    if comptes().iter().any(|c| c == compte) {
        Ok(())
    } else {
        Err("ce service n'est pas dans la liste des moteurs d'IA".to_string())
    }
}

/// What is accepted as a key before opening the keychain. Never echoes it.
fn forme(cle: &str) -> Result<String, String> {
    let cle = cle.trim();
    if cle.is_empty() {
        return Err("aucune clé n'a été saisie".to_string());
    }
    if cle.chars().any(char::is_whitespace) {
        return Err("une clé ne contient pas d'espace : vérifiez que vous avez collé la clé seule".to_string());
    }
    if cle.chars().count() < 8 {
        return Err("c'est trop court pour une clé : recopiez-la depuis la page de l'éditeur".to_string());
    }
    Ok(cle.to_string())
}

fn message_rangee(employee: bool) -> String {
    if employee {
        "Votre clé est rangée dans le coffre de votre ordinateur. Vos agents peuvent s'en servir.".to_string()
    } else {
        "Votre clé est rangée dans le coffre de votre ordinateur. Vos agents ne s'en servent pas encore : ce service n'est pas encore branché dans l'application.".to_string()
    }
}

fn entree(compte: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, compte)
        .map_err(|e| format!("coffre du système indisponible : {}", e))
}

fn rangee(compte: &str) -> bool {
    if compte == COMPTE_LLM {
        return crate::llm::cle_api_presente();
    }
    entree(compte)
        .and_then(|t| t.get_password().map_err(|e| e.to_string()))
        .map(|c| !c.trim().is_empty())
        .unwrap_or(false)
}

/// For each account: is a key saved, and do the agents use it. Never the key.
#[tauri::command]
pub fn cles_ia_etat() -> Vec<CleCompte> {
    comptes()
        .into_iter()
        .map(|c| CleCompte { rangee: rangee(&c), employee: employe(&c), compte: c })
        .collect()
}

#[tauri::command]
pub fn cle_ia_ranger(compte: String, cle: String) -> Result<String, String> {
    compte_connu(&compte)?;
    if compte == COMPTE_LLM {
        return crate::llm::cle_api_ranger(cle);
    }
    let cle = forme(&cle)?;
    entree(&compte)?
        .set_password(&cle)
        .map_err(|e| format!("enregistrement dans le coffre : {}", e))?;
    Ok(message_rangee(employe(&compte)))
}

#[tauri::command]
pub fn cle_ia_retirer(compte: String) -> Result<String, String> {
    compte_connu(&compte)?;
    if compte == COMPTE_LLM {
        return crate::llm::cle_api_retirer();
    }
    match entree(&compte)?.delete_credential() {
        Ok(()) => Ok("Votre clé a été retirée de cet ordinateur.".to_string()),
        Err(keyring::Error::NoEntry) => Ok("Aucune clé n'était rangée.".to_string()),
        Err(e) => Err(format!("retrait du coffre : {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_catalogue_se_lit_et_porte_ses_comptes() {
        let c = comptes();
        assert!(c.len() > 50, "{} comptes seulement", c.len());
        assert!(c.iter().any(|x| x == "openai"));
    }

    #[test]
    fn seul_le_compte_que_llm_appelle_est_employe() {
        assert!(employe(COMPTE_LLM));
        assert!(!employe("openai"));
        assert!(!employe("elevenlabs"));
    }

    #[test]
    fn un_compte_inconnu_est_refuse_avant_le_coffre() {
        assert!(compte_connu("pirate").is_err());
        assert!(compte_connu("mistral").is_ok());
    }

    #[test]
    fn la_forme_refuse_sans_jamais_redire_la_cle() {
        for mauvaise in ["", "   ", "sk-abc def-123456", "x9q2"] {
            let refus = forme(mauvaise).expect_err(mauvaise);
            if !mauvaise.trim().is_empty() {
                assert!(!refus.contains(mauvaise.trim()), "la clé revient dans : {}", refus);
            }
        }
        assert_eq!(forme("  sk-proj-0123456789  ").unwrap(), "sk-proj-0123456789");
    }

    #[test]
    fn une_cle_rangee_mais_pas_employee_le_dit() {
        assert!(message_rangee(false).contains("ne s'en servent pas encore"));
        assert!(!message_rangee(true).contains("pas encore"));
    }
}
