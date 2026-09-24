//! Telegram, pour de vrai : l'API de bots, pas l'application de bureau.
//!
//! Le client installe Telegram Desktop sur la machine préparée en usine, et la
//! tentation est de piloter cette fenêtre-là. C'est le mauvais chemin : une
//! application de bureau n'a pas d'API, la piloter veut dire simuler des clics,
//! et ça casse à chaque mise à jour de l'éditeur.
//!
//! Telegram publie une API de bots exprès pour ça, gratuite
//! (`core.telegram.org/bots`, lu le 24/09/2026). Ce qui compte ici : elle se
//! relève en **longue attente** (`getUpdates`), c'est-à-dire que c'est la
//! machine du client qui appelle Telegram et garde la ligne ouverte. Aucune
//! adresse publique, aucun relais hébergé, rien à ouvrir sur la box du client.
//! C'est exactement ce qui manque à WhatsApp, dont Meta ne livre un entrant
//! qu'en le poussant vers une adresse publique.
//!
//! Ce module remplace trois fonctions qui annonçaient un envoi sans rien
//! envoyer. La règle qu'elles ont coûtée tient toujours : rien ici ne rend un
//! succès sans avoir joint `api.telegram.org`.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// L'hôte de l'API. Écrit une fois, et **impossible à déplacer en production** :
/// le jeton du bot voyage dans le chemin de l'adresse, donc une base
/// configurable serait un moyen de l'envoyer ailleurs. Seul le banc en pose une
/// autre, par un constructeur qui n'existe qu'en test.
const API: &str = "https://api.telegram.org";

/// Le coffre du système où vit le jeton du bot. Même règle que la clé d'API du
/// client : ni dans le dépôt, ni dans un paquet, ni dans le SQLite du poste —
/// c'est là que `save_connector_credentials` écrivait un jeton en clair avant
/// d'être retiré le 24/09.
const SERVICE_TROUSSEAU: &str = "iagent-telegram";
const ENTREE_TROUSSEAU: &str = "bot";

/// Combien de secondes Telegram garde la ligne ouverte quand il n'a rien à
/// dire. C'est la longue attente : sans elle il faudrait rappeler sans cesse.
const ATTENTE_SECONDES: u64 = 25;

/// Le délai du client HTTP, qui doit être **plus long** que l'attente
/// ci-dessus. C'est le piège de la longue attente : un délai plus court coupe
/// la ligne avant que Telegram réponde, et l'agent ne reçoit jamais rien tout
/// en voyant passer des erreurs de réseau. Un banc compare les deux nombres.
const DELAI_RESEAU: Duration = Duration::from_secs(ATTENTE_SECONDES + 10);

/// Un message qu'un humain a envoyé au bot.
///
/// Les champs traversent vers l'écran avec CES noms : le dépôt n'emploie pas
/// `rename_all`, et un `chatId` côté React rendrait `undefined` sans qu'aucun
/// compilateur ne bronche.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MessageRecu {
    pub chat_id: i64,
    pub de: String,
    pub texte: String,
}

/// Ce que rend une relève : les messages, et par où reprendre.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Releve {
    pub messages: Vec<MessageRecu>,
    /// Le `offset` à redonner au prochain appel. **C'est le piège de
    /// `getUpdates`** : tant qu'on ne redonne pas `dernier + 1`, Telegram
    /// reserre les mêmes messages indéfiniment et l'agent répond en boucle.
    pub suite: i64,
}

pub struct Telegram {
    base: String,
    jeton: String,
    client: reqwest::Client,
}

impl Telegram {
    /// Le seul constructeur de production : la base est `API`, point.
    pub fn nouveau(jeton: String) -> Result<Self, String> {
        Self::batir(API.to_string(), forme_du_jeton(&jeton)?)
    }

    /// Le constructeur du banc, qui seul peut poser une autre base.
    #[cfg(test)]
    fn sur(base: String, jeton: String) -> Result<Self, String> {
        Self::batir(base, jeton)
    }

    fn batir(base: String, jeton: String) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .timeout(DELAI_RESEAU)
            .build()
            .map_err(|_| "Le réseau n'a pas pu être préparé sur cet ordinateur.".to_string())?;
        Ok(Self {
            base,
            jeton,
            client,
        })
    }

    /// L'adresse d'une méthode. **Privée, et jamais recopiée dans une erreur** :
    /// le jeton du bot est dedans, comme un mot de passe dans une URL. C'est la
    /// même règle que pour les serveurs MCP distants, où seul l'hôte a le droit
    /// de paraître dans un message.
    fn adresse(&self, methode: &str) -> String {
        format!("{}/bot{}/{}", self.base, self.jeton, methode)
    }

    /// Le seul endroit qui parle au réseau.
    async fn appeler(
        &self,
        methode: &str,
        corps: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let reponse = self
            .client
            .post(self.adresse(methode))
            .json(&corps)
            .send()
            .await
            // Le motif de reqwest porte l'adresse complète, donc le jeton :
            // il ne remonte jamais tel quel.
            .map_err(|_| {
                "Telegram n'a pas répondu. Vérifiez que cet ordinateur a bien accès à Internet."
                    .to_string()
            })?;

        let statut = reponse.status().as_u16();
        let charge: serde_json::Value = reponse
            .json()
            .await
            .map_err(|_| "Telegram a répondu quelque chose d'illisible.".to_string())?;

        if charge.get("ok").and_then(|v| v.as_bool()) == Some(true) {
            return charge
                .get("result")
                .cloned()
                .ok_or_else(|| "Telegram a répondu sans résultat.".to_string());
        }
        // Telegram porte son propre numero dans `error_code`. Il vaut mieux
        // que le statut HTTP : un intermediaire (proxy d'entreprise, portail
        // Wi-Fi) peut rendre 200 sur un refus, et le client lirait alors
        // « code 200 » pour un jeton mort.
        let code = charge
            .get("error_code")
            .and_then(|v| v.as_u64())
            .map(|c| c as u16)
            .unwrap_or(statut);
        Err(refus_en_francais(code))
    }

    /// Vérifie le jeton en demandant à Telegram qui est ce bot, et rend son nom.
    ///
    /// C'est la seule preuve qu'un jeton vaut quelque chose : en vérifier la
    /// forme ne dit rien, l'ancienne version se contentait d'y chercher un `:`
    /// et répondait que le jeton était bon.
    pub async fn qui_suis_je(&self) -> Result<String, String> {
        let moi = self.appeler("getMe", serde_json::json!({})).await?;
        moi.get("username")
            .and_then(|v| v.as_str())
            .map(|n| format!("@{}", n))
            .ok_or_else(|| "Telegram n'a pas donné le nom de ce bot.".to_string())
    }

    /// Envoie un message dans une conversation.
    ///
    /// `chat_id` ne se devine pas et ne se saisit pas : il arrive avec un
    /// message entrant. C'est pour ça qu'il est un argument ici et non un
    /// réglage rangé à la connexion, comme le faisait la version d'avant — un
    /// bot parle à tous ceux qui lui écrivent, pas à une seule conversation.
    pub async fn envoyer(&self, chat_id: i64, texte: &str) -> Result<(), String> {
        if texte.trim().is_empty() {
            return Err("Un message vide ne part pas.".to_string());
        }
        self.appeler(
            "sendMessage",
            serde_json::json!({ "chat_id": chat_id, "text": texte }),
        )
        .await
        .map(|_| ())
    }

    /// Relève les messages arrivés depuis `depuis`, en gardant la ligne ouverte.
    pub async fn relever(&self, depuis: i64) -> Result<Releve, String> {
        let brut = self
            .appeler(
                "getUpdates",
                serde_json::json!({ "offset": depuis, "timeout": ATTENTE_SECONDES }),
            )
            .await?;
        Ok(depouiller(&brut, depuis))
    }
}

/// Transforme la réponse brute de `getUpdates` en messages et en point de
/// reprise. Fonction pure : le banc l'éprouve sans réseau, sur les formes que
/// Telegram rend vraiment.
fn depouiller(brut: &serde_json::Value, depuis: i64) -> Releve {
    let mut messages = Vec::new();
    let mut suite = depuis;

    for entree in brut.as_array().map(|a| a.as_slice()).unwrap_or(&[]) {
        if let Some(numero) = entree.get("update_id").and_then(|v| v.as_i64()) {
            // `dernier + 1`, jamais `dernier` : voir Releve::suite.
            suite = suite.max(numero + 1);
        }
        // Une mise à jour n'est pas forcément un message : une réaction, un
        // membre qui part, un bouton. Celles-là avancent le point de reprise
        // et ne remontent pas, sinon elles reviendraient à chaque relève.
        let Some(message) = entree.get("message") else {
            continue;
        };
        let (Some(chat_id), Some(texte)) = (
            message
                .get("chat")
                .and_then(|c| c.get("id"))
                .and_then(|v| v.as_i64()),
            message.get("text").and_then(|v| v.as_str()),
        ) else {
            continue;
        };
        messages.push(MessageRecu {
            chat_id,
            de: nom_de_l_envoyeur(message),
            texte: texte.to_string(),
        });
    }

    Releve { messages, suite }
}

/// De qui vient le message, pour que l'agent sache à qui il parle. Telegram ne
/// promet que `first_name` ; `username` et `last_name` peuvent manquer.
fn nom_de_l_envoyeur(message: &serde_json::Value) -> String {
    let Some(auteur) = message.get("from") else {
        return "quelqu'un".to_string();
    };
    let texte = |clef: &str| {
        auteur
            .get(clef)
            .and_then(|v| v.as_str())
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string())
    };
    texte("username")
        .map(|u| format!("@{}", u))
        .or_else(|| texte("first_name"))
        .unwrap_or_else(|| "quelqu'un".to_string())
}

/// Ce que le client lit quand Telegram refuse.
///
/// La `description` que rend Telegram est en anglais ; la recopier, c'est le
/// « Failed to initialize voice » que la voix a coûté. On traduit les cas qui
/// arrivent vraiment et on reste général pour le reste. Le numéro est gardé :
/// un nombre n'est pas du jargon et aide au dépannage.
fn refus_en_francais(statut: u16) -> String {
    match statut {
        401 => "Telegram a refusé ce jeton. Redemandez-en un à @BotFather.".to_string(),
        403 => "Ce bot n'a pas le droit d'écrire dans cette conversation : \
                la personne doit lui écrire en premier."
            .to_string(),
        400 => "Telegram n'a pas compris la demande : la conversation est peut-être \
                introuvable. Rien n'a été envoyé."
            .to_string(),
        429 => "Trop de messages d'un coup : Telegram demande d'attendre un moment.".to_string(),
        code => format!(
            "Telegram a refusé la demande (code {}). Rien n'a été envoyé.",
            code
        ),
    }
}

fn trousseau() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, ENTREE_TROUSSEAU)
        .map_err(|_| "Le coffre de cet ordinateur n'est pas disponible.".to_string())
}

/// Le jeton du bot, du coffre d'abord, de l'environnement ensuite.
///
/// L'environnement ne reste lu que pour le développement et les bancs, comme
/// pour la clé d'API du client.
pub fn jeton() -> Option<String> {
    let coffre = trousseau().and_then(|t| {
        t.get_password()
            .map_err(|_| "lecture du coffre".to_string())
    });
    jeton_retenu(coffre.ok(), std::env::var("TELEGRAM_BOT_TOKEN").ok())
}

/// Laquelle des deux sources l'emporte. Sortie du corps de `jeton()` pour que
/// la règle s'éprouve sans toucher au coffre de la machine qui lance les bancs.
fn jeton_retenu(coffre: Option<String>, environnement: Option<String>) -> Option<String> {
    [coffre, environnement]
        .into_iter()
        .flatten()
        .map(|c| c.trim().to_string())
        .find(|c| !c.is_empty())
}

/// Ce qui est recevable comme jeton, avant d'ouvrir le coffre. Un jeton de
/// @BotFather s'écrit `<chiffres>:<suite>`. Rend le jeton taillé, jamais
/// l'original, et ne le recopie dans aucune erreur.
fn forme_du_jeton(brut: &str) -> Result<String, String> {
    let brut = brut.trim();
    if brut.is_empty() {
        return Err("Aucun jeton n'a été saisi.".to_string());
    }
    let Some((numero, secret)) = brut.split_once(':') else {
        return Err("Ce jeton ne ressemble pas à un jeton Telegram : \
                    @BotFather en donne un de la forme 123456:AA..."
            .to_string());
    };
    if numero.is_empty() || !numero.chars().all(|c| c.is_ascii_digit()) || secret.len() < 20 {
        return Err("Ce jeton ne ressemble pas à un jeton Telegram : \
                    @BotFather en donne un de la forme 123456:AA..."
            .to_string());
    }
    Ok(brut.to_string())
}

/// Range le jeton du bot dans le coffre, après avoir vérifié auprès de Telegram
/// qu'il vaut quelque chose. Ne rend jamais le jeton, ni en retour ni en erreur.
#[tauri::command]
pub async fn telegram_brancher(jeton: String) -> Result<String, String> {
    let bot = Telegram::nouveau(jeton.clone())?;
    let nom = bot.qui_suis_je().await?;
    trousseau()?
        .set_password(forme_du_jeton(&jeton)?.as_str())
        .map_err(|_| "Le jeton n'a pas pu être rangé dans le coffre.".to_string())?;
    Ok(format!(
        "Votre bot {} est branché. Écrivez-lui depuis Telegram pour que l'agent vous réponde.",
        nom
    ))
}

/// Dit si un jeton est posé, sans jamais le rendre.
#[tauri::command]
pub fn telegram_branche() -> bool {
    jeton().is_some()
}

/// Retire le jeton du coffre. Un jeton qu'on ne peut pas retirer est un jeton
/// qu'on n'ose pas poser.
#[tauri::command]
pub fn telegram_debrancher() -> Result<String, String> {
    match trousseau()?.delete_credential() {
        Ok(()) => Ok("Votre bot a été débranché de cet ordinateur.".to_string()),
        Err(keyring::Error::NoEntry) => Ok("Aucun bot n'était branché.".to_string()),
        Err(_) => Err("Le jeton n'a pas pu être retiré du coffre.".to_string()),
    }
}

const PAS_DE_JETON: &str = "Aucun bot Telegram n'est branché sur cet ordinateur. \
Rien n'a été envoyé.";

fn bot() -> Result<Telegram, String> {
    Telegram::nouveau(jeton().ok_or_else(|| PAS_DE_JETON.to_string())?)
}

#[tauri::command]
pub async fn telegram_envoyer(chat_id: i64, texte: String) -> Result<String, String> {
    bot()?.envoyer(chat_id, &texte).await?;
    Ok("Message envoyé.".to_string())
}

#[tauri::command]
pub async fn telegram_relever(depuis: i64) -> Result<Releve, String> {
    bot()?.relever(depuis).await
}

#[tauri::command]
pub fn telegram_mode_d_emploi() -> String {
    "Pour brancher Telegram :\n\
     \n\
     1. Ouvrez Telegram et cherchez @BotFather.\n\
     2. Envoyez-lui /newbot et suivez ses questions.\n\
     3. Copiez le jeton qu'il vous donne (de la forme 123456:AA...) et collez-le ici.\n\
     4. Écrivez un premier message à votre bot : c'est ce qui lui donne le droit \
     de vous répondre.\n\
     \n\
     Votre jeton reste dans le coffre de cet ordinateur. Rien ne passe par nous."
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    const JETON: &str = "123456:AAHbanc-de-jeton-qui-ne-sert-a-rien";

    fn bloquer<T>(f: impl std::future::Future<Output = T>) -> T {
        tokio::runtime::Runtime::new().unwrap().block_on(f)
    }

    /// Un serveur HTTP de banc, minuscule : il note ce qu'on lui demande et rend
    /// la réponse suivante de la pile. Écrit à la main comme celui de `mcp.rs`,
    /// pour que le banc ne dépende de rien de plus que ce qui est déjà au dépôt
    /// et qu'il tourne aussi sous Windows.
    struct Recue {
        chemin: String,
        corps: String,
    }

    fn serveur(reponses: Vec<(u16, String)>) -> (String, std::sync::Arc<std::sync::Mutex<Vec<Recue>>>) {
        let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute locale");
        let port = ecoute.local_addr().expect("adresse").port();
        let recues = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let journal = recues.clone();
        let attendues = reponses.len();

        std::thread::spawn(move || {
            let mut restantes = reponses.into_iter();
            let mut servies = 0usize;
            for flux in ecoute.incoming() {
                let Ok(mut flux) = flux else { break };
                let Some(recue) = lire(&mut flux) else { continue };
                journal.lock().expect("journal").push(recue);
                let (code, corps) = restantes
                    .next()
                    .unwrap_or_else(|| (500, "{\"ok\":false}".to_string()));
                let reponse = format!(
                    "HTTP/1.1 {} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    code,
                    corps.len(),
                    corps
                );
                use std::io::Write;
                let _ = flux.write_all(reponse.as_bytes());
                let _ = flux.flush();
                servies += 1;
                if servies >= attendues {
                    break;
                }
            }
        });

        (format!("http://127.0.0.1:{}", port), recues)
    }

    fn lire(flux: &mut std::net::TcpStream) -> Option<Recue> {
        use std::io::{BufRead, BufReader, Read};
        let mut lecteur = BufReader::new(flux.try_clone().ok()?);
        let mut premiere = String::new();
        lecteur.read_line(&mut premiere).ok()?;
        if premiere.trim().is_empty() {
            return None;
        }
        let chemin = premiere.split_whitespace().nth(1)?.to_string();

        let mut taille = 0usize;
        loop {
            let mut ligne = String::new();
            if lecteur.read_line(&mut ligne).ok()? == 0 || ligne.trim().is_empty() {
                break;
            }
            if let Some((nom, valeur)) = ligne.split_once(':') {
                if nom.trim().eq_ignore_ascii_case("content-length") {
                    taille = valeur.trim().parse().unwrap_or(0);
                }
            }
        }
        let mut corps = vec![0u8; taille];
        if taille > 0 {
            lecteur.read_exact(&mut corps).ok()?;
        }
        Some(Recue {
            chemin,
            corps: String::from_utf8_lossy(&corps).to_string(),
        })
    }

    // -----------------------------------------------------------------------
    // Le jeton
    // -----------------------------------------------------------------------

    /// **Le banc qui compte le plus.** Le jeton du bot voyage dans le CHEMIN de
    /// l'adresse : tout motif de réseau recopié tel quel le publierait dans un
    /// message d'erreur, une capture d'écran ou un journal.
    #[test]
    fn le_jeton_ne_fuit_dans_aucun_refus() {
        let (base, _) = serveur(vec![(401, "{\"ok\":false,\"description\":\"Unauthorized\"}".to_string())]);
        let bot = Telegram::sur(base, JETON.to_string()).expect("bot");
        let refus = bloquer(bot.qui_suis_je()).unwrap_err();
        assert!(!refus.contains(JETON), "le jeton est dans : {refus}");
        assert!(!refus.contains("AAHbanc"), "un morceau du jeton est dans : {refus}");

        // Et quand le réseau lui-même échoue : reqwest met l'adresse complète
        // dans son propre motif, donc celui-là ne doit jamais remonter.
        let bot = Telegram::sur("http://127.0.0.1:1".to_string(), JETON.to_string()).expect("bot");
        let refus = bloquer(bot.qui_suis_je()).unwrap_err();
        assert!(!refus.contains(JETON), "le jeton est dans : {refus}");
    }

    /// La production ne peut pas envoyer le jeton en clair : sa base est en dur.
    #[test]
    fn la_production_ne_parle_qu_en_chiffre() {
        let bot = Telegram::nouveau(JETON.to_string()).expect("bot");
        assert_eq!(bot.base, "https://api.telegram.org");
        assert!(bot.adresse("getMe").starts_with("https://"));
    }

    #[test]
    fn la_forme_du_jeton_refuse_ce_qui_n_en_est_pas_un() {
        for mauvais in ["", "   ", "sans-deux-points", "abc:AAHquelque-chose-de-long", "123456:court"] {
            let refus = forme_du_jeton(mauvais).unwrap_err();
            assert!(!refus.contains(mauvais) || mauvais.trim().is_empty(), "{refus}");
        }
        assert_eq!(forme_du_jeton(&format!("  {JETON}  ")).unwrap(), JETON);
    }

    /// Une entrée blanche dans le coffre ne doit pas masquer l'environnement.
    #[test]
    fn le_coffre_l_emporte_sauf_s_il_est_blanc() {
        assert_eq!(
            jeton_retenu(Some("  du-coffre ".into()), Some("de-l-env".into())),
            Some("du-coffre".to_string())
        );
        assert_eq!(
            jeton_retenu(Some("   ".into()), Some("de-l-env".into())),
            Some("de-l-env".to_string())
        );
        assert_eq!(jeton_retenu(None, None), None);
    }

    // -----------------------------------------------------------------------
    // La longue attente
    // -----------------------------------------------------------------------

    /// Le piège de la longue attente : un délai réseau plus court que l'attente
    /// demandée couperait la ligne avant que Telegram réponde, et l'agent ne
    /// recevrait jamais rien tout en voyant passer des erreurs.
    #[test]
    fn le_delai_reseau_survit_a_la_longue_attente() {
        assert!(
            DELAI_RESEAU > Duration::from_secs(ATTENTE_SECONDES),
            "délai {DELAI_RESEAU:?} contre attente de {ATTENTE_SECONDES} s"
        );
    }

    /// Le point de reprise est `dernier + 1`. Redonner `dernier` ferait resservir
    /// le même message à chaque relève, et l'agent répondrait en boucle.
    #[test]
    fn le_point_de_reprise_est_le_dernier_plus_un() {
        let brut = serde_json::json!([
            {"update_id": 41, "message": {"chat": {"id": 7}, "text": "bonjour", "from": {"username": "max"}}},
            {"update_id": 42, "message": {"chat": {"id": 7}, "text": "tu es la ?", "from": {"first_name": "Max"}}}
        ]);
        let releve = depouiller(&brut, 0);
        assert_eq!(releve.suite, 43);
        assert_eq!(
            releve.messages,
            vec![
                MessageRecu { chat_id: 7, de: "@max".into(), texte: "bonjour".into() },
                MessageRecu { chat_id: 7, de: "Max".into(), texte: "tu es la ?".into() },
            ]
        );
    }

    /// Une mise à jour qui n'est pas un message (réaction, bouton, membre qui
    /// part) avance quand même le point de reprise, sinon elle reviendrait à
    /// chaque relève et bloquerait tout ce qui la suit.
    #[test]
    fn une_mise_a_jour_sans_message_avance_le_point_de_reprise() {
        let brut = serde_json::json!([
            {"update_id": 10, "message_reaction": {"chat": {"id": 7}}},
            {"update_id": 11, "message": {"chat": {"id": 7}}}
        ]);
        let releve = depouiller(&brut, 5);
        assert!(releve.messages.is_empty());
        assert_eq!(releve.suite, 12);

        // Rien à relever ne fait pas reculer le point de reprise.
        assert_eq!(depouiller(&serde_json::json!([]), 99).suite, 99);
    }

    #[test]
    fn un_envoyeur_sans_nom_reste_nommable() {
        let anonyme = serde_json::json!({"chat": {"id": 1}, "text": "x"});
        assert_eq!(nom_de_l_envoyeur(&anonyme), "quelqu'un");
        let vide = serde_json::json!({"from": {"username": "  "}});
        assert_eq!(nom_de_l_envoyeur(&vide), "quelqu'un");
    }

    // -----------------------------------------------------------------------
    // Ce qui part vraiment sur le réseau
    // -----------------------------------------------------------------------

    #[test]
    fn qui_suis_je_demande_vraiment_a_telegram() {
        let (base, recues) = serveur(vec![(
            200,
            "{\"ok\":true,\"result\":{\"id\":1,\"username\":\"agent_bot\"}}".to_string(),
        )]);
        let bot = Telegram::sur(base, JETON.to_string()).expect("bot");
        assert_eq!(bloquer(bot.qui_suis_je()).unwrap(), "@agent_bot");
        let recues = recues.lock().expect("journal");
        assert_eq!(recues[0].chemin, format!("/bot{JETON}/getMe"));
    }

    #[test]
    fn envoyer_poste_le_texte_et_la_conversation() {
        let (base, recues) = serveur(vec![(200, "{\"ok\":true,\"result\":{}}".to_string())]);
        let bot = Telegram::sur(base, JETON.to_string()).expect("bot");
        bloquer(bot.envoyer(7, "le rapport est prêt")).unwrap();
        let recues = recues.lock().expect("journal");
        assert!(recues[0].chemin.ends_with("/sendMessage"));
        let corps: serde_json::Value = serde_json::from_str(&recues[0].corps).expect("corps");
        assert_eq!(corps["chat_id"], 7);
        assert_eq!(corps["text"], "le rapport est prêt");
    }

    /// La relève demande bien la longue attente et le bon point de reprise :
    /// sans `timeout` on retomberait sur des appels en rafale.
    #[test]
    fn relever_demande_la_longue_attente_et_le_point_de_reprise() {
        let (base, recues) = serveur(vec![(
            200,
            "{\"ok\":true,\"result\":[{\"update_id\":5,\"message\":{\"chat\":{\"id\":3},\"text\":\"salut\"}}]}"
                .to_string(),
        )]);
        let bot = Telegram::sur(base, JETON.to_string()).expect("bot");
        let releve = bloquer(bot.relever(5)).unwrap();
        assert_eq!(releve.suite, 6);
        assert_eq!(releve.messages[0].texte, "salut");
        let recues = recues.lock().expect("journal");
        let corps: serde_json::Value = serde_json::from_str(&recues[0].corps).expect("corps");
        assert_eq!(corps["offset"], 5);
        assert_eq!(corps["timeout"], ATTENTE_SECONDES);
    }

    /// Rien ne part sans texte, et le refus le dit — c'est la règle que les
    /// trois fonctions d'avant enfreignaient en annonçant un envoi.
    #[test]
    fn un_message_vide_ne_part_pas() {
        let (base, recues) = serveur(vec![]);
        let bot = Telegram::sur(base, JETON.to_string()).expect("bot");
        assert!(bloquer(bot.envoyer(7, "   ")).is_err());
        assert!(recues.lock().expect("journal").is_empty(), "un appel est parti quand même");
    }

    /// Ce que le client lit reste du français : pas un mot de programmeur, et
    /// surtout pas la `description` anglaise que Telegram renvoie.
    #[test]
    fn tout_refus_se_lit_en_francais() {
        let mut phrases: Vec<String> = [401u16, 403, 400, 429, 500]
            .into_iter()
            .map(refus_en_francais)
            .collect();
        phrases.push(PAS_DE_JETON.to_string());
        phrases.push(telegram_mode_d_emploi());
        phrases.push(forme_du_jeton("").unwrap_err());
        for phrase in phrases {
            let bas = phrase.to_lowercase();
            for mot in ["error", "null", "failed", "undefined", "unauthorized", "token"] {
                assert!(!bas.contains(mot), "« {mot} » dans : {phrase}");
            }
        }
    }
}
