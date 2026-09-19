use std::error::Error;
use serde::{Deserialize, Serialize};

/// Palier de modele tel que declare dans la fiche agent (`modeles.texte`),
/// defini dans `dimensionnement/paliers-modeles.json` a la racine du depot.
/// Le paquet nomme un palier, jamais un modele : c'est l'application qui
/// choisit le poids concret installe sur la machine du client.
pub fn modele_local_par_defaut(palier: &str) -> &'static str {
    match palier {
        "texte-leger" => "qwen2.5:3b",
        "texte-avance" => "qwen2.5:14b",
        "texte-expert" => "qwen2.5:32b",
        // "texte-standard" est le palier de la plupart des postes.
        _ => "llama3.1:8b",
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    /// Modeles locaux via Ollama : aucun token facture.
    Local,
    /// API distante (Anthropic) : facturee, au choix du client.
    Api,
}

impl Mode {
    fn depuis_env() -> Self {
        match std::env::var("IAGENT_LLM_MODE")
            .unwrap_or_default()
            .to_lowercase()
            .as_str()
        {
            "api" => Mode::Api,
            // Local par defaut, API au choix du client (regle projet, 18/09/2026).
            _ => Mode::Local,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentPersona {
    pub id: String,
    pub name: String,
    pub role: String,
    pub system_prompt: String,
    /// Palier de modele texte demande par la fiche agent.
    pub palier: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// Etat du moteur local, rendu tel quel a l'interface.
/// Un agent qui ne tourne pas en local doit toujours dire pourquoi.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtatMoteurLocal {
    pub disponible: bool,
    pub url: String,
    pub modeles_installes: Vec<String>,
    /// Motif en clair quand `disponible` est faux.
    pub motif: Option<String>,
}

#[derive(Clone)]
pub struct LLMService {
    mode: Mode,
    ollama_url: String,
    /// Force un modele Ollama pour tous les agents, sinon le palier decide.
    ollama_modele_force: Option<String>,
    anthropic_key: Option<String>,
    anthropic_url: String,
    client: reqwest::Client,
}

impl LLMService {
    pub fn new() -> Result<Self, Box<dyn Error>> {
        let mode = Mode::depuis_env();
        let anthropic_key = std::env::var("ANTHROPIC_API_KEY").ok();

        if mode == Mode::Api && anthropic_key.is_none() {
            // Sans cle pour la capacite manquante, l'agent s'arrete avec le motif ecrit.
            return Err("mode API demande mais ANTHROPIC_API_KEY absente".into());
        }

        Ok(LLMService {
            mode,
            ollama_url: std::env::var("IAGENT_OLLAMA_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:11434".to_string()),
            ollama_modele_force: std::env::var("IAGENT_OLLAMA_MODEL").ok().filter(|s| !s.is_empty()),
            anthropic_key,
            anthropic_url: "https://api.anthropic.com/v1/messages".to_string(),
            client: reqwest::Client::new(),
        })
    }

    pub fn mode(&self) -> Mode {
        self.mode
    }

    fn modele_pour(&self, persona: &AgentPersona) -> String {
        self.ollama_modele_force
            .clone()
            .unwrap_or_else(|| modele_local_par_defaut(&persona.palier).to_string())
    }

    /// Interroge Ollama : moteur joignable, et quels poids sont deja tires.
    pub async fn etat_moteur_local(&self) -> EtatMoteurLocal {
        let url = format!("{}/api/tags", self.ollama_url.trim_end_matches('/'));

        let reponse = match self.client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                return EtatMoteurLocal {
                    disponible: false,
                    url: self.ollama_url.clone(),
                    modeles_installes: vec![],
                    motif: Some(format!(
                        "Ollama injoignable sur {} ({}). Lancez `ollama serve`, \
                         ou basculez en mode API dans les reglages.",
                        self.ollama_url, e
                    )),
                }
            }
        };

        if !reponse.status().is_success() {
            let status = reponse.status();
            return EtatMoteurLocal {
                disponible: false,
                url: self.ollama_url.clone(),
                modeles_installes: vec![],
                motif: Some(format!("Ollama a repondu {} sur /api/tags", status)),
            };
        }

        let corps: serde_json::Value = match reponse.json().await {
            Ok(v) => v,
            Err(e) => {
                return EtatMoteurLocal {
                    disponible: false,
                    url: self.ollama_url.clone(),
                    modeles_installes: vec![],
                    motif: Some(format!("Reponse Ollama illisible : {}", e)),
                }
            }
        };

        let modeles: Vec<String> = corps["models"]
            .as_array()
            .map(|liste| {
                liste
                    .iter()
                    .filter_map(|m| m["name"].as_str().map(str::to_string))
                    .collect()
            })
            .unwrap_or_default();

        let motif = if modeles.is_empty() {
            Some(
                "Ollama tourne mais aucun modele n'est installe. \
                 Tirez le palier texte : `ollama pull llama3.1:8b`."
                    .to_string(),
            )
        } else {
            None
        };

        EtatMoteurLocal {
            disponible: motif.is_none(),
            url: self.ollama_url.clone(),
            modeles_installes: modeles,
            motif,
        }
    }

    pub async fn call_agent_llm(
        &self,
        agent_persona: &AgentPersona,
        user_command: &str,
    ) -> Result<String, String> {
        match self.mode {
            Mode::Local => self.appeler_ollama(agent_persona, user_command).await,
            Mode::Api => self.appeler_anthropic(agent_persona, user_command).await,
        }
    }

    /// Exécution locale : POST /api/chat, sans flux, aucun token facture.
    async fn appeler_ollama(
        &self,
        persona: &AgentPersona,
        commande: &str,
    ) -> Result<String, String> {
        let modele = self.modele_pour(persona);
        let url = format!("{}/api/chat", self.ollama_url.trim_end_matches('/'));

        let requete = serde_json::json!({
            "model": modele,
            "stream": false,
            "messages": [
                { "role": "system", "content": persona.system_prompt },
                { "role": "user", "content": commande },
            ],
        });

        let reponse = self
            .client
            .post(&url)
            .json(&requete)
            .send()
            .await
            .map_err(|e| {
                format!(
                    "Agent {} arrete : Ollama injoignable sur {} ({}). \
                     Lancez `ollama serve`, ou passez cet agent en mode API.",
                    persona.name, self.ollama_url, e
                )
            })?;

        if !reponse.status().is_success() {
            let status = reponse.status();
            let corps = reponse.text().await.unwrap_or_default();
            if status == reqwest::StatusCode::NOT_FOUND {
                return Err(format!(
                    "Agent {} arrete : le modele `{}` (palier {}) n'est pas installe. \
                     Tirez-le avec `ollama pull {}`.",
                    persona.name, modele, persona.palier, modele
                ));
            }
            return Err(format!("Ollama a repondu {} : {}", status, corps));
        }

        let donnees: serde_json::Value = reponse
            .json()
            .await
            .map_err(|e| format!("Reponse Ollama illisible : {}", e))?;

        donnees["message"]["content"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| "Aucun texte dans la reponse Ollama".to_string())
    }

    async fn appeler_anthropic(
        &self,
        persona: &AgentPersona,
        commande: &str,
    ) -> Result<String, String> {
        let cle = self
            .anthropic_key
            .as_ref()
            .ok_or_else(|| "ANTHROPIC_API_KEY absente".to_string())?;

        let requete = serde_json::json!({
            "model": "claude-3-5-haiku-20241022",
            "max_tokens": 1024,
            "system": persona.system_prompt,
            "messages": [{ "role": "user", "content": commande }],
        });

        let reponse = self
            .client
            .post(&self.anthropic_url)
            .header("x-api-key", cle)
            .header("anthropic-version", "2023-06-01")
            .json(&requete)
            .send()
            .await
            .map_err(|e| format!("Appel API echoue : {}", e))?;

        if !reponse.status().is_success() {
            let status = reponse.status();
            let corps = reponse.text().await.unwrap_or_default();
            return Err(format!("Erreur API {} : {}", status, corps));
        }

        let donnees: serde_json::Value = reponse
            .json()
            .await
            .map_err(|e| format!("Reponse API illisible : {}", e))?;

        donnees["content"][0]["text"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| "Aucun texte dans la reponse API".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Read, Write};
    use std::net::TcpListener;

    /// Faux Ollama : repond sur /api/tags et /api/chat comme le vrai,
    /// pour verifier le chemin d'execution sans tirer un modele de 5 Go.
    fn faux_ollama(tags: &'static str, chat: &'static str) -> (String, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());

        let handle = std::thread::spawn(move || {
            for flux in listener.incoming().take(4) {
                let mut flux = match flux {
                    Ok(f) => f,
                    Err(_) => continue,
                };
                let mut lecteur = BufReader::new(flux.try_clone().unwrap());

                let mut ligne_requete = String::new();
                lecteur.read_line(&mut ligne_requete).unwrap();

                let mut longueur = 0usize;
                loop {
                    let mut entete = String::new();
                    lecteur.read_line(&mut entete).unwrap();
                    if entete.trim().is_empty() {
                        break;
                    }
                    if let Some(v) = entete.to_lowercase().strip_prefix("content-length:") {
                        longueur = v.trim().parse().unwrap_or(0);
                    }
                }
                if longueur > 0 {
                    let mut corps = vec![0u8; longueur];
                    lecteur.read_exact(&mut corps).unwrap();
                }

                let (code, corps) = if ligne_requete.contains("/api/tags") {
                    ("200 OK", tags)
                } else if ligne_requete.contains("/api/chat") {
                    if chat.is_empty() {
                        ("404 Not Found", "{\"error\":\"model not found\"}")
                    } else {
                        ("200 OK", chat)
                    }
                } else {
                    ("404 Not Found", "{}")
                };

                let reponse = format!(
                    "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    code,
                    corps.len(),
                    corps
                );
                let _ = flux.write_all(reponse.as_bytes());
                let _ = flux.flush();
            }
        });

        (url, handle)
    }

    fn service(url: &str) -> LLMService {
        LLMService {
            mode: Mode::Local,
            ollama_url: url.to_string(),
            ollama_modele_force: None,
            anthropic_key: None,
            anthropic_url: "https://api.anthropic.com/v1/messages".to_string(),
            client: reqwest::Client::new(),
        }
    }

    fn persona(palier: &str) -> AgentPersona {
        AgentPersona {
            id: "AG-0001".to_string(),
            name: "Albert".to_string(),
            role: "Assistant productivite".to_string(),
            system_prompt: "Tu es Albert.".to_string(),
            palier: palier.to_string(),
        }
    }

    #[test]
    fn le_palier_choisit_le_modele() {
        assert_eq!(modele_local_par_defaut("texte-leger"), "qwen2.5:3b");
        assert_eq!(modele_local_par_defaut("texte-standard"), "llama3.1:8b");
        assert_eq!(modele_local_par_defaut("texte-avance"), "qwen2.5:14b");
        assert_eq!(modele_local_par_defaut("texte-expert"), "qwen2.5:32b");
        // Un palier inconnu retombe sur celui de la plupart des postes.
        assert_eq!(modele_local_par_defaut("inconnu"), "llama3.1:8b");
    }

    #[tokio::test]
    async fn un_agent_s_execute_en_local() {
        let (url, _h) = faux_ollama(
            r#"{"models":[{"name":"llama3.1:8b"}]}"#,
            r#"{"message":{"role":"assistant","content":"Rendez-vous note pour mardi 14h."},"done":true}"#,
        );

        let reponse = service(&url)
            .call_agent_llm(&persona("texte-standard"), "Note un rendez-vous mardi 14h.")
            .await
            .expect("l'agent doit repondre");

        assert_eq!(reponse, "Rendez-vous note pour mardi 14h.");
    }

    #[tokio::test]
    async fn moteur_joignable_liste_les_modeles() {
        let (url, _h) = faux_ollama(r#"{"models":[{"name":"llama3.1:8b"}]}"#, "{}");

        let etat = service(&url).etat_moteur_local().await;

        assert!(etat.disponible);
        assert_eq!(etat.modeles_installes, vec!["llama3.1:8b".to_string()]);
        assert!(etat.motif.is_none());
    }

    #[tokio::test]
    async fn moteur_sans_modele_dit_pourquoi() {
        let (url, _h) = faux_ollama(r#"{"models":[]}"#, "{}");

        let etat = service(&url).etat_moteur_local().await;

        assert!(!etat.disponible);
        let motif = etat.motif.expect("un motif en clair est obligatoire");
        assert!(motif.contains("ollama pull"), "motif inutilisable : {}", motif);
    }

    #[tokio::test]
    async fn moteur_injoignable_dit_pourquoi() {
        // Port ferme : rien n'ecoute.
        let etat = service("http://127.0.0.1:1").etat_moteur_local().await;

        assert!(!etat.disponible);
        let motif = etat.motif.expect("un motif en clair est obligatoire");
        assert!(motif.contains("ollama serve"), "motif inutilisable : {}", motif);
    }

    #[tokio::test]
    async fn modele_absent_nomme_la_commande_a_taper() {
        let (url, _h) = faux_ollama(r#"{"models":[]}"#, "");

        let erreur = service(&url)
            .call_agent_llm(&persona("texte-avance"), "Analyse ce contrat.")
            .await
            .expect_err("un modele absent doit arreter l'agent");

        assert!(erreur.contains("qwen2.5:14b"), "erreur inutilisable : {}", erreur);
        assert!(erreur.contains("ollama pull"), "erreur inutilisable : {}", erreur);
    }
}
