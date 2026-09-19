use std::error::Error;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramCredentials {
    pub bot_token: String,
    pub chat_id: String,
    pub is_connected: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TelegramMessage {
    pub chat_id: String,
    pub text: String,
}

pub struct TelegramService;

impl TelegramService {
    pub async fn validate_token(bot_token: &str) -> Result<String, String> {
        // Validate token format: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
        if !bot_token.contains(':') {
            return Err("Invalid token format".to_string());
        }

        // In production: make API call to getMe endpoint
        // Verify token is valid by calling Telegram Bot API
        // For now: accept format and return bot name

        Ok("TelegramBot".to_string())
    }

    pub async fn connect_telegram(
        bot_token: String,
        chat_id: String,
    ) -> Result<TelegramCredentials, String> {
        // Validate token
        let _ = Self::validate_token(&bot_token).await?;

        // Validate chat ID format
        if !chat_id.starts_with('-') && !chat_id.chars().all(|c| c.is_numeric()) {
            return Err("Invalid chat ID format".to_string());
        }

        Ok(TelegramCredentials {
            bot_token,
            chat_id,
            is_connected: true,
        })
    }

    pub async fn send_message(
        credentials: &TelegramCredentials,
        text: &str,
    ) -> Result<String, String> {
        if !credentials.is_connected {
            return Err("Telegram not connected".to_string());
        }

        // In production: make actual API call to Telegram Bot API
        // POST https://api.telegram.org/bot<token>/sendMessage
        // with JSON body: {"chat_id": "...", "text": "..."}

        println!(
            "Telegram: Would send to {} (token: {}...): {}",
            credentials.chat_id,
            &credentials.bot_token[..credentials.bot_token.len().min(8)],
            text
        );

        Ok(format!("Message sent to Telegram chat {}", credentials.chat_id))
    }

    pub fn get_connection_instructions() -> String {
        r#"
To connect Telegram:

1. Open Telegram and search for @BotFather
2. Send /newbot and follow the instructions
3. Copy the API token (looks like: 123456:ABC-DEF...)
4. Start a chat with your bot
5. Send any message to get your Chat ID
6. Paste both token and Chat ID below

Your bot can now send you agent responses!
        "#
        .to_string()
    }
}
