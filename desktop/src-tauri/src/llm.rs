use std::error::Error;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPersona {
    pub id: String,
    pub name: String,
    pub role: String,
    pub system_prompt: String,
}

#[derive(Debug, Serialize)]
pub struct LLMRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub max_tokens: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct LLMResponse {
    pub content: Vec<ResponseContent>,
    pub stop_reason: String,
}

#[derive(Debug, Deserialize)]
pub struct ResponseContent {
    pub type_field: Option<String>,
    pub text: Option<String>,
}

/// Le modele de l'API, ecrit une fois. `dimensionnement/tarifs-api.json` prend
/// le meme pour reference : c'est sur lui que l'argument economique est calcule.
pub const MODELE_API: &str = "claude-sonnet-5";

#[derive(Clone)]
pub struct LLMService {
    api_key: String,
    api_url: String,
}

/// Le coffre du systeme ou vit la cle du client.
///
/// Elle ne venait que d'une variable d'environnement : apres une installation
/// par MSI, un client n'a aucun moyen d'en poser une, donc aucun moyen de faire
/// travailler un agent si aucun moteur local n'est installe. Et la regle du
/// depot est que sa cle reste chez lui, jamais dans un paquet ni dans un
/// fichier du dossier de l'application. Le trousseau du systeme est le seul
/// endroit qui tienne les deux.
const SERVICE_TROUSSEAU: &str = "iagent-api";
const ENTREE_TROUSSEAU: &str = "anthropic";

fn trousseau() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, ENTREE_TROUSSEAU)
        .map_err(|e| format!("coffre du systeme indisponible : {}", e))
}

/// La cle du client, du coffre d'abord, de l'environnement ensuite.
///
/// L'environnement reste lu pour le developpement et les bancs ; en production
/// c'est le coffre qui compte.
pub fn cle_api() -> Option<String> {
    let coffre = trousseau().and_then(|t| {
        t.get_password()
            .map_err(|e| format!("lecture du coffre : {}", e))
    });
    cle_retenue(coffre.ok(), std::env::var("ANTHROPIC_API_KEY").ok())
}

/// Laquelle des deux sources l'emporte, et ce qui compte comme absente.
///
/// Sortie du corps de `cle_api` pour que la regle se verifie au banc sans
/// toucher au coffre de la machine qui lance les tests : une entree blanche
/// dans le coffre ne doit pas masquer la variable d'environnement.
fn cle_retenue(coffre: Option<String>, environnement: Option<String>) -> Option<String> {
    [coffre, environnement]
        .into_iter()
        .flatten()
        .map(|c| c.trim().to_string())
        .find(|c| !c.is_empty())
}

/// Range la cle du client dans le coffre du systeme.
///
/// Ne rend jamais la cle, ni dans un retour ni dans une erreur : une cle qui
/// repasse par l'interface finit dans un journal ou dans une capture d'ecran.
#[tauri::command]
pub fn cle_api_ranger(cle: String) -> Result<String, String> {
    let cle = forme_de_la_cle(&cle)?;
    trousseau()?
        .set_password(&cle)
        .map_err(|e| format!("enregistrement dans le coffre : {}", e))?;
    Ok("Votre cle est rangee dans le coffre de votre ordinateur.".to_string())
}

/// Ce qui est recevable comme cle, avant d'ouvrir le coffre.
///
/// Le prefixe des cles Anthropic : le verifier evite au client de croire sa
/// cle rangee alors qu'il a colle autre chose, et de le decouvrir a la
/// premiere tache. Rend la cle taillee, jamais l'originale.
fn forme_de_la_cle(cle: &str) -> Result<String, String> {
    let cle = cle.trim();
    if cle.is_empty() {
        return Err("aucune cle n'a ete saisie".to_string());
    }
    if !cle.starts_with("sk-ant-") {
        return Err(
            "cette cle ne ressemble pas a une cle Anthropic (elle commence par sk-ant-)"
                .to_string(),
        );
    }
    Ok(cle.to_string())
}

/// Dit si une cle est posee, sans jamais la rendre.
#[tauri::command]
pub fn cle_api_presente() -> bool {
    cle_api().is_some()
}

/// Retire la cle du coffre. Une cle qu'on ne peut pas retirer est une cle qu'on
/// n'ose pas poser.
#[tauri::command]
pub fn cle_api_retirer() -> Result<String, String> {
    match trousseau()?.delete_credential() {
        Ok(()) => Ok("Votre cle a ete retiree de cet ordinateur.".to_string()),
        Err(keyring::Error::NoEntry) => Ok("Aucune cle n'etait rangee.".to_string()),
        Err(e) => Err(format!("retrait du coffre : {}", e)),
    }
}

impl LLMService {
    pub fn new() -> Result<Self, Box<dyn Error>> {
        let api_key = cle_api().ok_or("aucune cle d API n est rangee sur cet ordinateur")?;

        Ok(LLMService {
            api_key,
            api_url: "https://api.anthropic.com/v1/messages".to_string(),
        })
    }

    pub async fn call_agent_llm(
        &self,
        agent_persona: &AgentPersona,
        user_command: &str,
    ) -> Result<String, String> {
        // Build messages
        let messages = vec![
            Message {
                role: "user".to_string(),
                content: user_command.to_string(),
            },
        ];

        // Le modele est celui que dimensionnement/tarifs-api.json prend pour
        // reference : c'est sur lui que l'argument economique est calcule.
        // Effort bas parce que la conversation vise moins de trois secondes ;
        // une reponse de standard telephonique ne demande pas de reflexion longue.
        let request = serde_json::json!({
            "model": MODELE_API,
            "max_tokens": 1024,
            "output_config": { "effort": "low" },
            "system": agent_persona.system_prompt,
            "messages": messages,
        });

        // Make HTTP request
        let client = reqwest::Client::new();
        let response = client
            .post(&self.api_url)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("API request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, body));
        }

        let response_data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Extract text from response
        if let Some(content) = response_data["content"].as_array() {
            if let Some(first) = content.first() {
                if let Some(text) = first["text"].as_str() {
                    return Ok(text.to_string());
                }
            }
        }

        Err("No text in response".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn une_cle_vide_ne_se_range_pas() {
        assert!(forme_de_la_cle("").is_err(), "une saisie vide doit être refusée");
        assert!(
            forme_de_la_cle("   ").is_err(),
            "des espaces ne sont pas une clé"
        );
    }

    #[test]
    fn ce_qui_n_est_pas_une_cle_anthropic_se_dit_avant_le_coffre() {
        let refus = forme_de_la_cle("mon-mot-de-passe").unwrap_err();
        assert!(
            refus.contains("sk-ant-"),
            "le refus doit dire à quoi ressemble une clé, pas seulement qu'elle est mauvaise : {}",
            refus
        );
    }

    #[test]
    fn une_cle_collee_avec_des_espaces_se_range_taillee() {
        // Une clé copiée depuis la console arrive souvent avec un retour à la
        // ligne. La refuser pour ça ferait croire au client qu'elle est fausse.
        assert_eq!(
            forme_de_la_cle("  sk-ant-essai123\n").unwrap(),
            "sk-ant-essai123"
        );
    }

    #[test]
    fn le_coffre_passe_avant_la_variable_d_environnement() {
        assert_eq!(
            cle_retenue(Some("sk-ant-coffre".into()), Some("sk-ant-env".into())),
            Some("sk-ant-coffre".to_string())
        );
    }

    #[test]
    fn une_entree_blanche_dans_le_coffre_ne_masque_pas_l_environnement() {
        // Le cas qui a motivé la séparation : un coffre qui rend une chaîne
        // vide n'est pas un coffre qui porte une clé.
        assert_eq!(
            cle_retenue(Some("  ".into()), Some("sk-ant-env".into())),
            Some("sk-ant-env".to_string())
        );
    }

    #[test]
    fn sans_cle_nulle_part_l_agent_ne_croit_pas_en_avoir_une() {
        assert_eq!(cle_retenue(None, None), None);
        assert_eq!(cle_retenue(None, Some(String::new())), None);
    }
}
