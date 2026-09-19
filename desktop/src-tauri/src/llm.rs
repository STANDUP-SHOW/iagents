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

pub struct LLMService {
    api_key: String,
    api_url: String,
}

impl LLMService {
    pub fn new() -> Result<Self, Box<dyn Error>> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")
            .map_err(|_| "ANTHROPIC_API_KEY not set")?;

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

        // Build request
        let request = serde_json::json!({
            "model": "claude-3-5-haiku-20241022",
            "max_tokens": 1024,
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
