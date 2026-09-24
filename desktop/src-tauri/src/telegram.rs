use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramCredentials {
    pub bot_token: String,
    pub chat_id: String,
    pub is_connected: bool,
}

/// Ce que l'application sait faire de Telegram aujourd'hui : rien.
///
/// Les trois commandes Tauri (`connect_telegram`, `get_telegram_instructions`,
/// `send_telegram_message`) sont enregistrées dans `main.rs` ; ce module, lui,
/// n'a jamais joint `api.telegram.org`. `send_message` imprimait
/// « Telegram: Would send to … » sur la sortie standard et rendait
/// `Ok("Message sent to Telegram chat …")` : le client aurait lu « envoyé »
/// sans qu'un message parte. `validate_token` vérifiait que le jeton contenait
/// un `:` et répondait que le jeton était bon. `connect_telegram` posait
/// `is_connected: true` sans rien demander à personne.
///
/// C'est la faute que `courriel.rs` interdit du côté du courrier — on n'annonce
/// pas un envoi qu'on n'a pas fait — et elle n'a trompé personne seulement
/// parce que l'écran n'appelle aucune de ces trois commandes. À une ligne
/// d'interface près, elle l'aurait fait.
///
/// Les deux entrées refusent donc, avec une phrase que le client comprend,
/// jusqu'à ce que le réseau soit écrit. Le jeton ne s'imprime plus non plus :
/// il partait en clair sur stdout, tronqué à huit caractères, ce qui est huit
/// de trop.
const PAS_ENCORE_BRANCHE: &str = "Telegram n'est pas encore branché : l'application ne sait pas \
encore lui parler. Rien n'a été envoyé.";

pub struct TelegramService;

impl TelegramService {
    pub async fn connect_telegram(
        _bot_token: String,
        _chat_id: String,
    ) -> Result<TelegramCredentials, String> {
        Err(PAS_ENCORE_BRANCHE.to_string())
    }

    pub async fn send_message(
        _credentials: &TelegramCredentials,
        _text: &str,
    ) -> Result<String, String> {
        Err(PAS_ENCORE_BRANCHE.to_string())
    }

    pub fn get_connection_instructions() -> String {
        "Pour brancher Telegram :\n\
         \n\
         1. Ouvrez Telegram et cherchez @BotFather.\n\
         2. Envoyez /newbot et suivez ses questions.\n\
         3. Copiez le jeton qu'il vous donne (de la forme 123456:ABC-DEF...).\n\
         4. Démarrez une conversation avec votre bot et envoyez-lui un message.\n\
         \n\
         L'application ne sait pas encore parler à Telegram : ces informations \
         ne serviront qu'une fois la connexion écrite."
            .to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bloquer<T>(f: impl std::future::Future<Output = T>) -> T {
        tokio::runtime::Runtime::new().unwrap().block_on(f)
    }

    /// Le banc qui compte : rien de ce module ne peut rendre un succès. Un `Ok`
    /// ici, c'est le client qui lit « envoyé » quand rien n'est parti.
    #[test]
    fn rien_ne_peut_rendre_un_succes() {
        let erreur = bloquer(TelegramService::connect_telegram(
            "123456:ABC".to_string(),
            "42".to_string(),
        ))
        .unwrap_err();
        assert!(erreur.contains("pas encore branché"), "{erreur}");

        let identifiants = TelegramCredentials {
            bot_token: "123456:ABC".to_string(),
            chat_id: "42".to_string(),
            is_connected: true,
        };
        let erreur = bloquer(TelegramService::send_message(&identifiants, "bonjour")).unwrap_err();
        assert!(erreur.contains("Rien n'a été envoyé"), "{erreur}");
    }

    /// Même règle que pour les refus de `mcp.rs` : ce que le client lit est du
    /// français, pas un mot de programmeur.
    #[test]
    fn le_refus_se_lit_en_francais() {
        for phrase in [
            PAS_ENCORE_BRANCHE.to_string(),
            TelegramService::get_connection_instructions(),
        ] {
            let bas = phrase.to_lowercase();
            for mot in ["error", "null", "failed", "undefined"] {
                assert!(!bas.contains(mot), "« {mot} » dans : {phrase}");
            }
        }
    }
}
