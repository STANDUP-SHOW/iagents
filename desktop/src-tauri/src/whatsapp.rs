//! WhatsApp, par la plateforme Business de Meta et un relais pour l'entrant.
//!
//! **Pourquoi pas l'application de bureau installée sur le poste.** Les
//! conditions de Meta interdisent en toutes lettres « sending illegal or
//! impermissible communications such as bulk messaging, auto-messaging,
//! auto-dialing, and the like » et « any non-personal use of our Services
//! unless otherwise authorized by us » (lu le 24/09/2026). Un agent qui pilote
//! WhatsApp Desktop est exactement ça, et c'est le numéro de l'entreprise du
//! client qui serait fermé. La plateforme Business est la voie autorisée.
//!
//! **Pourquoi un relais alors que Telegram n'en demande pas.** Telegram laisse
//! la machine du client appeler et attendre (`getUpdates`). Meta ne livre un
//! entrant qu'en le POSTant vers une adresse publique, et sa page est nette :
//! « your server must have a valid TLS or SSL certificate correctly configured
//! and installed. Self-signed certificates are not supported ». Aucune API de
//! relève n'existe. La machine du client n'a pas d'adresse publique, donc il
//! faut quelqu'un entre les deux. C'est le choix de max du 24/09/2026.
//!
//! **Ce qui ne passe PAS par le relais : l'envoi.** Le poste appelle
//! `graph.facebook.com` directement, avec le jeton du client, qui ne quitte
//! jamais sa machine. Le relais ne voit que ce que Meta lui pousse, c'est-à-dire
//! ce que des clients écrivent à l'entreprise — et il ne le garde que le temps
//! que le poste vienne le chercher.
//!
//! **Le contrat du relais est défini ici** (`docs/relais-whatsapp.md` le répète
//! pour qui l'écrira) :
//!
//! ```text
//! GET {relais}/messages?depuis=<n>&attente=<s>
//!     Authorization: Bearer <secret du relais>
//! -> 200 {"messages":[{"de","nom","texte","recu_le"}],"suite":<n>}
//! -> 401 si le secret ne va pas
//! ```
//!
//! Le relais garde la ligne ouverte jusqu'à `attente` secondes, comme Telegram,
//! pour que la forme soit la même des deux côtés : un poste qui sait recevoir
//! sait recevoir des deux.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// L'API de Meta. En dur, comme pour Telegram, et pour la même raison : rien
/// qui porte le jeton du client ne doit pouvoir être détourné ailleurs.
const GRAPH: &str = "https://graph.facebook.com";

/// La version relevée sur la page d'envoi le 24/09/2026. Elle s'écrit ici et
/// nulle part ailleurs : Meta date ses versions, et celle qu'on a lue est la
/// seule dont on connaisse la forme.
const VERSION: &str = "v21.0";

const SERVICE_TROUSSEAU: &str = "iagent-whatsapp";
const ENTREE_TROUSSEAU: &str = "connexion";

/// Combien de secondes le relais garde la ligne ouverte quand il n'a rien.
const ATTENTE_SECONDES: u64 = 25;

/// Le délai réseau, plus long que l'attente. Même piège que pour Telegram :
/// plus court, il couperait la ligne avant la réponse et l'agent ne recevrait
/// jamais rien tout en voyant passer des erreurs. Un banc compare les deux.
const DELAI_RESEAU: Duration = Duration::from_secs(ATTENTE_SECONDES + 10);

/// Tout ce qu'il faut pour parler WhatsApp, rangé d'un bloc au coffre.
///
/// Deux des quatre champs sont des secrets (`jeton`, `secret_relais`) et les
/// deux autres n'ont de sens qu'avec eux. Les séparer ne protégerait rien et
/// ferait deux endroits où se tromper.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Connexion {
    /// Le jeton d'accès permanent du client, côté Meta.
    pub jeton: String,
    /// L'identifiant du numéro (`phone_number_id`), que Meta met aussi dans
    /// `metadata.phone_number_id` de chaque entrant.
    pub numero_id: String,
    /// L'adresse du relais, en https.
    pub relais: String,
    /// Ce que le poste présente au relais pour avoir le droit de relever.
    pub secret_relais: String,
}

/// Un message qu'une personne a écrit à l'entreprise.
///
/// Les champs traversent vers l'écran avec CES noms : le dépôt n'emploie pas
/// `rename_all`, et un `recuLe` côté React rendrait `undefined` en silence.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MessageRecu {
    /// Le numéro de l'expéditeur, tel que Meta l'écrit (`messages[].from`).
    /// C'est aussi ce qu'il faut redonner à `envoyer` pour lui répondre.
    pub de: String,
    /// Son nom de profil s'il en a un (`contacts[].profile.name`).
    pub nom: String,
    pub texte: String,
    /// L'horodatage de Meta, en secondes, tel quel.
    pub recu_le: String,
}

/// Ce que rend une relève. **Même forme que celle de Telegram, exprès** : le
/// jour où l'écran saura recevoir, il saura recevoir des deux.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Releve {
    pub messages: Vec<MessageRecu>,
    /// Le point de reprise à redonner au prochain appel.
    pub suite: i64,
}

pub struct WhatsApp {
    graph: String,
    connexion: Connexion,
    client: reqwest::Client,
}

impl WhatsApp {
    pub fn nouveau(connexion: Connexion) -> Result<Self, String> {
        Self::batir(GRAPH.to_string(), forme_de_la_connexion(connexion)?)
    }

    /// Le constructeur du banc, seul à pouvoir viser autre chose que Meta.
    #[cfg(test)]
    fn sur(graph: String, connexion: Connexion) -> Result<Self, String> {
        Self::batir(graph, connexion)
    }

    fn batir(graph: String, connexion: Connexion) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .timeout(DELAI_RESEAU)
            .build()
            .map_err(|_| "Le réseau n'a pas pu être préparé sur cet ordinateur.".to_string())?;
        Ok(Self {
            graph,
            connexion,
            client,
        })
    }

    /// Répond à quelqu'un qui a écrit à l'entreprise.
    ///
    /// **C'est bien « répondre » et pas « écrire »** : Meta n'accepte un message
    /// libre que dans la fenêtre de service ouverte par le message de la
    /// personne. Ouvrir une conversation demande un modèle validé et payant, ce
    /// qui n'est pas écrit ici et n'est pas ce qu'un agent fait.
    ///
    /// Contrairement à Telegram, le jeton n'est PAS dans l'adresse : il est en
    /// en-tête. L'adresse peut donc paraître dans une erreur ; le jeton, jamais.
    pub async fn envoyer(&self, a: &str, texte: &str) -> Result<String, String> {
        if texte.trim().is_empty() {
            return Err("Un message vide ne part pas.".to_string());
        }
        let corps = serde_json::json!({
            "messaging_product": "whatsapp",
            "to": a,
            "type": "text",
            "text": { "preview_url": false, "body": texte },
        });
        let reponse = self
            .client
            .post(format!(
                "{}/{}/{}/messages",
                self.graph, VERSION, self.connexion.numero_id
            ))
            .bearer_auth(&self.connexion.jeton)
            .json(&corps)
            .send()
            .await
            .map_err(|_| {
                "WhatsApp n'a pas répondu. Vérifiez que cet ordinateur a bien accès à Internet."
                    .to_string()
            })?;

        let statut = reponse.status().as_u16();
        let charge: serde_json::Value = reponse
            .json()
            .await
            .map_err(|_| "WhatsApp a répondu quelque chose d'illisible.".to_string())?;

        if let Some(identifiant) = charge
            .get("messages")
            .and_then(|m| m.get(0))
            .and_then(|m| m.get("id"))
            .and_then(|v| v.as_str())
        {
            return Ok(identifiant.to_string());
        }
        Err(refus_en_francais(statut, &charge))
    }

    /// Relève chez le relais les messages arrivés depuis `depuis`.
    pub async fn relever(&self, depuis: i64) -> Result<Releve, String> {
        let reponse = self
            .client
            .get(format!("{}/messages", self.connexion.relais.trim_end_matches('/')))
            .query(&[
                ("depuis", depuis.to_string()),
                ("attente", ATTENTE_SECONDES.to_string()),
            ])
            .bearer_auth(&self.connexion.secret_relais)
            .send()
            .await
            .map_err(|_| {
                "Le relais WhatsApp n'a pas répondu. Les messages reçus attendent chez lui."
                    .to_string()
            })?;

        if reponse.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(
                "Le relais WhatsApp a refusé cet ordinateur. Rebranchez WhatsApp pour lui \
                 redonner son secret."
                    .to_string(),
            );
        }
        if !reponse.status().is_success() {
            return Err(format!(
                "Le relais WhatsApp a refusé la demande (code {}).",
                reponse.status().as_u16()
            ));
        }
        let releve: Releve = reponse
            .json()
            .await
            .map_err(|_| "Le relais WhatsApp a répondu quelque chose d'illisible.".to_string())?;
        // Le point de reprise ne recule jamais, même si le relais se trompe :
        // il ferait resservir des messages auxquels l'agent a déjà répondu.
        Ok(Releve {
            suite: releve.suite.max(depuis),
            messages: releve.messages,
        })
    }
}

/// Dépouille ce que Meta POSTe au relais.
///
/// **Cette fonction ne tourne pas sur le poste** : c'est le relais qui reçoit
/// la charge de Meta. Elle vit ici pour que la forme relevée le 24/09/2026 soit
/// écrite une seule fois, éprouvée par un banc, et recopiable telle quelle par
/// qui écrira le relais. Une mise à jour qui n'est pas un message (un accusé de
/// lecture, un statut) ne rend rien : elle n'a rien à dire à l'agent.
pub fn depouiller_entrant(charge: &serde_json::Value) -> Vec<MessageRecu> {
    let mut recus = Vec::new();
    let tableau = |v: Option<&serde_json::Value>| -> Vec<serde_json::Value> {
        v.and_then(|x| x.as_array()).cloned().unwrap_or_default()
    };

    for entree in tableau(charge.get("entry")) {
        for changement in tableau(entree.get("changes")) {
            let Some(valeur) = changement.get("value") else {
                continue;
            };
            // `contacts` porte le nom de profil, `messages` le texte, et les
            // deux se rejoignent par le numéro : `contacts[].wa_id` d'un côté,
            // `messages[].from` de l'autre. Les apparier par position les
            // mélangerait dès qu'une notification en porte plusieurs.
            let contacts = tableau(valeur.get("contacts"));
            for message in tableau(valeur.get("messages")) {
                let (Some(de), Some(texte)) = (
                    message.get("from").and_then(|v| v.as_str()),
                    message
                        .get("text")
                        .and_then(|t| t.get("body"))
                        .and_then(|v| v.as_str()),
                ) else {
                    continue;
                };
                let nom = contacts
                    .iter()
                    .find(|c| c.get("wa_id").and_then(|v| v.as_str()) == Some(de))
                    .and_then(|c| c.get("profile"))
                    .and_then(|p| p.get("name"))
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or(de);
                recus.push(MessageRecu {
                    de: de.to_string(),
                    nom: nom.to_string(),
                    texte: texte.to_string(),
                    recu_le: message
                        .get("timestamp")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                });
            }
        }
    }
    recus
}

/// Ce que le client lit quand Meta refuse.
///
/// Le `message` que rend Meta est en anglais : le recopier, c'est le « Failed
/// to initialize voice » que la voix a coûté. Un seul code est traduit, le 190,
/// parce que c'est le seul relevé ; le reste reste général avec son numéro, et
/// on n'invente pas une liste qu'on n'a pas lue.
fn refus_en_francais(statut: u16, charge: &serde_json::Value) -> String {
    let code = charge
        .get("error")
        .and_then(|e| e.get("code"))
        .and_then(|v| v.as_i64());
    if code == Some(190) || statut == 401 {
        return "WhatsApp a refusé ce jeton. Il a peut-être expiré : reprenez-en un dans \
                votre compte Meta Business."
            .to_string();
    }
    match code {
        Some(c) => format!(
            "WhatsApp a refusé le message (code {}). Rien n'a été envoyé. Une réponse ne part \
             que dans les 24 heures qui suivent le message de la personne.",
            c
        ),
        None => format!(
            "WhatsApp a refusé le message (code {}). Rien n'a été envoyé.",
            statut
        ),
    }
}

fn trousseau() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, ENTREE_TROUSSEAU)
        .map_err(|_| "Le coffre de cet ordinateur n'est pas disponible.".to_string())
}

/// Ce qui est recevable, avant d'ouvrir le coffre. Ne recopie jamais le jeton
/// ni le secret du relais dans une erreur : un secret mal collé reviendrait à
/// l'écran, puis dans une capture ou un journal.
fn forme_de_la_connexion(c: Connexion) -> Result<Connexion, String> {
    let taille = |s: &str| s.trim().to_string();
    let connexion = Connexion {
        jeton: taille(&c.jeton),
        numero_id: taille(&c.numero_id),
        relais: taille(&c.relais),
        secret_relais: taille(&c.secret_relais),
    };
    if connexion.jeton.is_empty() {
        return Err("Aucun jeton WhatsApp n'a été saisi.".to_string());
    }
    if connexion.numero_id.is_empty()
        || !connexion.numero_id.chars().all(|c| c.is_ascii_digit())
    {
        return Err(
            "L'identifiant du numéro n'est fait que de chiffres : c'est le « phone number ID » \
             de votre compte Meta Business."
                .to_string(),
        );
    }
    adresse_du_relais_recevable(&connexion.relais)?;
    if connexion.secret_relais.is_empty() {
        return Err("Le secret du relais n'a pas été saisi.".to_string());
    }
    Ok(connexion)
}

/// Le secret du relais part à chaque relève, en en-tête. En clair il se lirait
/// sur le chemin, donc `http://` est refusé — sauf sur la boucle locale, qui ne
/// sort pas de la machine et où tourne le banc. Même règle que pour un serveur
/// MCP distant.
fn adresse_du_relais_recevable(adresse: &str) -> Result<(), String> {
    if adresse.is_empty() {
        return Err("L'adresse du relais n'a pas été saisie.".to_string());
    }
    if adresse.starts_with("https://") {
        return Ok(());
    }
    let locale = adresse.starts_with("http://127.0.0.1")
        || adresse.starts_with("http://localhost")
        || adresse.starts_with("http://[::1]");
    if locale {
        return Ok(());
    }
    Err("L'adresse du relais doit commencer par https:// : le secret part à chaque relève \
         et se lirait en clair sur le chemin."
        .to_string())
}

/// La connexion rangée sur cette machine, s'il y en a une.
pub fn connexion() -> Option<Connexion> {
    let brut = trousseau().ok()?.get_password().ok()?;
    serde_json::from_str(&brut).ok()
}

const PAS_BRANCHE: &str = "WhatsApp n'est pas branché sur cet ordinateur. Rien n'a été envoyé.";

fn compte() -> Result<WhatsApp, String> {
    WhatsApp::nouveau(connexion().ok_or_else(|| PAS_BRANCHE.to_string())?)
}

/// Range la connexion au coffre.
///
/// **Ce qui n'est PAS vérifié ici, et c'est dit au client** : que le jeton vaut
/// quelque chose chez Meta. Il n'existe pas d'appel de contrôle qu'on ait relevé
/// — seul l'envoi est documenté, et il demande quelqu'un à qui écrire. Inventer
/// une adresse pour faire semblant de vérifier serait pire que de le dire.
#[tauri::command]
pub fn whatsapp_brancher(
    jeton: String,
    numero_id: String,
    relais: String,
    secret_relais: String,
) -> Result<String, String> {
    let connexion = forme_de_la_connexion(Connexion {
        jeton,
        numero_id,
        relais,
        secret_relais,
    })?;
    let brut = serde_json::to_string(&connexion)
        .map_err(|_| "La connexion n'a pas pu être préparée.".to_string())?;
    trousseau()?
        .set_password(&brut)
        .map_err(|_| "La connexion n'a pas pu être rangée dans le coffre.".to_string())?;
    Ok("WhatsApp est branché. Votre jeton reste dans le coffre de cet ordinateur ; il sera \
        éprouvé au premier message envoyé."
        .to_string())
}

/// Dit si WhatsApp est branché, sans jamais rendre le jeton ni le secret.
#[tauri::command]
pub fn whatsapp_branche() -> bool {
    connexion().is_some()
}

#[tauri::command]
pub fn whatsapp_debrancher() -> Result<String, String> {
    match trousseau()?.delete_credential() {
        Ok(()) => Ok("WhatsApp a été débranché de cet ordinateur.".to_string()),
        Err(keyring::Error::NoEntry) => Ok("WhatsApp n'était pas branché.".to_string()),
        Err(_) => Err("La connexion n'a pas pu être retirée du coffre.".to_string()),
    }
}

#[tauri::command]
pub async fn whatsapp_repondre(a: String, texte: String) -> Result<String, String> {
    compte()?.envoyer(&a, &texte).await?;
    Ok("Réponse envoyée.".to_string())
}

#[tauri::command]
pub async fn whatsapp_relever(depuis: i64) -> Result<Releve, String> {
    compte()?.relever(depuis).await
}

#[cfg(test)]
mod tests {
    use super::*;

    const JETON: &str = "EAAbanc-un-jeton-qui-ne-sert-a-rien";
    const SECRET: &str = "secret-du-relais-de-banc";

    fn bloquer<T>(f: impl std::future::Future<Output = T>) -> T {
        tokio::runtime::Runtime::new().unwrap().block_on(f)
    }

    fn connexion_de_banc(relais: &str) -> Connexion {
        Connexion {
            jeton: JETON.to_string(),
            numero_id: "106540352242922".to_string(),
            relais: relais.to_string(),
            secret_relais: SECRET.to_string(),
        }
    }

    struct Recue {
        chemin: String,
        entetes: Vec<(String, String)>,
        corps: String,
    }

    impl Recue {
        fn entete(&self, nom: &str) -> Option<&str> {
            self.entetes
                .iter()
                .find(|(n, _)| n == nom)
                .map(|(_, v)| v.as_str())
        }
    }

    /// Un serveur HTTP de banc, écrit à la main comme celui de `mcp.rs` et de
    /// `telegram.rs` : rien de plus que ce qui est déjà au dépôt, et il tourne
    /// aussi sous Windows.
    fn serveur(
        reponses: Vec<(u16, String)>,
    ) -> (String, std::sync::Arc<std::sync::Mutex<Vec<Recue>>>) {
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
                    .unwrap_or_else(|| (500, "{}".to_string()));
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

        let mut entetes = Vec::new();
        let mut taille = 0usize;
        loop {
            let mut ligne = String::new();
            if lecteur.read_line(&mut ligne).ok()? == 0 || ligne.trim().is_empty() {
                break;
            }
            if let Some((nom, valeur)) = ligne.split_once(':') {
                let nom = nom.trim().to_lowercase();
                let valeur = valeur.trim().to_string();
                if nom == "content-length" {
                    taille = valeur.parse().unwrap_or(0);
                }
                entetes.push((nom, valeur));
            }
        }
        let mut corps = vec![0u8; taille];
        if taille > 0 {
            lecteur.read_exact(&mut corps).ok()?;
        }
        Some(Recue {
            chemin,
            entetes,
            corps: String::from_utf8_lossy(&corps).to_string(),
        })
    }

    /// La charge que Meta POSTe pour un message texte, recopiée VERBATIM de sa
    /// page de référence le 24/09/2026. C'est la seule forme dont on sache
    /// qu'elle est vraie ; tout le dépouillement se juge sur elle.
    fn charge_de_meta() -> serde_json::Value {
        serde_json::json!({
          "object": "whatsapp_business_account",
          "entry": [{
            "id": "102290129340398",
            "changes": [{
              "value": {
                "messaging_product": "whatsapp",
                "metadata": {
                  "display_phone_number": "15550783881",
                  "phone_number_id": "106540352242922"
                },
                "contacts": [{
                  "profile": { "name": "Sheena Nelson" },
                  "wa_id": "16505551234"
                }],
                "messages": [{
                  "from": "16505551234",
                  "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
                  "timestamp": "1749416383",
                  "type": "text",
                  "text": { "body": "Does it come in another color?" }
                }]
              },
              "field": "messages"
            }]
          }]
        })
    }

    // -----------------------------------------------------------------------
    // Les secrets
    // -----------------------------------------------------------------------

    /// Le jeton part en en-tête et pas dans l'adresse, contrairement à Telegram.
    /// Le piège est le même : le motif de reqwest ne doit jamais remonter tel
    /// quel, et rien de ce que le client lit ne doit porter le jeton.
    #[test]
    fn ni_le_jeton_ni_le_secret_ne_fuient_dans_un_refus() {
        let (base, _) = serveur(vec![(
            401,
            "{\"error\":{\"message\":\"Invalid OAuth access token\",\"code\":190}}".to_string(),
        )]);
        let compte = WhatsApp::sur(base.clone(), connexion_de_banc(&base)).expect("compte");
        let refus = bloquer(compte.envoyer("16505551234", "bonjour")).unwrap_err();
        assert!(!refus.contains(JETON), "le jeton est dans : {refus}");

        let (base, _) = serveur(vec![(401, "{}".to_string())]);
        let compte = WhatsApp::sur(base.clone(), connexion_de_banc(&base)).expect("compte");
        let refus = bloquer(compte.relever(0)).unwrap_err();
        assert!(!refus.contains(SECRET), "le secret est dans : {refus}");

        // Et quand le réseau lui-même tombe.
        let mort = "http://127.0.0.1:1".to_string();
        let compte = WhatsApp::sur(mort.clone(), connexion_de_banc(&mort)).expect("compte");
        let refus = bloquer(compte.envoyer("165", "x")).unwrap_err();
        assert!(!refus.contains(JETON), "le jeton est dans : {refus}");
    }

    #[test]
    fn la_production_ne_parle_qu_a_meta_en_chiffre() {
        let c = Connexion {
            relais: "https://relais.example".to_string(),
            ..connexion_de_banc("https://relais.example")
        };
        let compte = WhatsApp::nouveau(c).expect("compte");
        assert_eq!(compte.graph, "https://graph.facebook.com");
    }

    /// Le secret du relais part à chaque relève : en clair il se lirait sur le
    /// chemin. La boucle locale est la seule exception, pour le banc.
    #[test]
    fn un_relais_en_clair_est_refuse_sauf_sur_la_boucle_locale() {
        assert!(adresse_du_relais_recevable("https://relais.example").is_ok());
        assert!(adresse_du_relais_recevable("http://127.0.0.1:8080").is_ok());
        assert!(adresse_du_relais_recevable("http://localhost:8080").is_ok());
        for mauvaise in ["", "http://relais.example", "ftp://relais.example", "relais.example"] {
            assert!(
                adresse_du_relais_recevable(mauvaise).is_err(),
                "acceptée : {mauvaise}"
            );
        }
    }

    #[test]
    fn la_forme_de_la_connexion_refuse_ce_qui_n_en_est_pas_une() {
        let bonne = connexion_de_banc("https://relais.example");
        assert!(forme_de_la_connexion(bonne.clone()).is_ok());

        for (champ, mauvaise) in [
            ("jeton", Connexion { jeton: "  ".into(), ..bonne.clone() }),
            ("numero_id", Connexion { numero_id: "abc123".into(), ..bonne.clone() }),
            ("numero_id", Connexion { numero_id: "".into(), ..bonne.clone() }),
            ("secret", Connexion { secret_relais: "".into(), ..bonne.clone() }),
        ] {
            let refus = forme_de_la_connexion(mauvaise).unwrap_err();
            assert!(!refus.contains(JETON), "{champ} : le jeton est dans {refus}");
            assert!(!refus.contains(SECRET), "{champ} : le secret est dans {refus}");
        }
    }

    #[test]
    fn le_delai_reseau_survit_a_la_longue_attente() {
        assert!(DELAI_RESEAU > Duration::from_secs(ATTENTE_SECONDES));
    }

    // -----------------------------------------------------------------------
    // Ce qui part vraiment sur le réseau
    // -----------------------------------------------------------------------

    /// La forme exacte relevée sur la page d'envoi de Meta le 24/09/2026.
    #[test]
    fn envoyer_poste_la_forme_relevee_chez_meta() {
        let (base, recues) = serveur(vec![(
            200,
            "{\"messaging_product\":\"whatsapp\",\"contacts\":[{\"wa_id\":\"16505551234\"}],\
             \"messages\":[{\"id\":\"wamid.XYZ\"}]}"
                .to_string(),
        )]);
        let compte = WhatsApp::sur(base.clone(), connexion_de_banc(&base)).expect("compte");
        let id = bloquer(compte.envoyer("16505551234", "bien reçu")).unwrap();
        assert_eq!(id, "wamid.XYZ");

        let recues = recues.lock().expect("journal");
        assert_eq!(recues[0].chemin, "/v21.0/106540352242922/messages");
        assert_eq!(
            recues[0].entete("authorization"),
            Some(format!("Bearer {JETON}").as_str())
        );
        let corps: serde_json::Value = serde_json::from_str(&recues[0].corps).expect("corps");
        assert_eq!(corps["messaging_product"], "whatsapp");
        assert_eq!(corps["to"], "16505551234");
        assert_eq!(corps["type"], "text");
        assert_eq!(corps["text"]["body"], "bien reçu");
    }

    #[test]
    fn un_message_vide_ne_part_pas() {
        let (base, recues) = serveur(vec![]);
        let compte = WhatsApp::sur(base.clone(), connexion_de_banc(&base)).expect("compte");
        assert!(bloquer(compte.envoyer("165", "   ")).is_err());
        assert!(
            recues.lock().expect("journal").is_empty(),
            "un appel est parti quand même"
        );
    }

    /// La relève présente le secret, demande la longue attente, et son point de
    /// reprise ne recule jamais — un relais qui rendrait un `suite` plus bas
    /// ferait resservir des messages auxquels l'agent a déjà répondu.
    #[test]
    fn relever_presente_le_secret_et_ne_recule_pas() {
        let (base, recues) = serveur(vec![(
            200,
            "{\"messages\":[{\"de\":\"16505551234\",\"nom\":\"Sheena\",\"texte\":\"bonjour\",\
             \"recu_le\":\"1749416383\"}],\"suite\":3}"
                .to_string(),
        )]);
        let compte = WhatsApp::sur(base.clone(), connexion_de_banc(&base)).expect("compte");
        let releve = bloquer(compte.relever(7)).unwrap();
        assert_eq!(releve.suite, 7, "le relais rendait 3, on ne recule pas");
        assert_eq!(releve.messages[0].texte, "bonjour");

        let recues = recues.lock().expect("journal");
        assert!(recues[0].chemin.starts_with("/messages?"), "{}", recues[0].chemin);
        assert!(recues[0].chemin.contains("depuis=7"), "{}", recues[0].chemin);
        assert!(
            recues[0].chemin.contains(&format!("attente={ATTENTE_SECONDES}")),
            "{}",
            recues[0].chemin
        );
        assert_eq!(
            recues[0].entete("authorization"),
            Some(format!("Bearer {SECRET}").as_str())
        );
    }

    #[test]
    fn un_relais_qui_refuse_le_dit_en_francais() {
        let (base, _) = serveur(vec![(401, "{}".to_string())]);
        let compte = WhatsApp::sur(base.clone(), connexion_de_banc(&base)).expect("compte");
        let refus = bloquer(compte.relever(0)).unwrap_err();
        assert!(refus.contains("Rebranchez"), "{refus}");
    }

    // -----------------------------------------------------------------------
    // Le dépouillement de ce que Meta pousse
    // -----------------------------------------------------------------------

    #[test]
    fn depouiller_lit_la_charge_relevee_chez_meta() {
        let recus = depouiller_entrant(&charge_de_meta());
        assert_eq!(
            recus,
            vec![MessageRecu {
                de: "16505551234".into(),
                nom: "Sheena Nelson".into(),
                texte: "Does it come in another color?".into(),
                recu_le: "1749416383".into(),
            }]
        );
    }

    /// **Le piège.** `contacts` et `messages` sont deux tableaux séparés, et
    /// rien ne promet qu'ils soient dans le même ordre. Les apparier par
    /// position collerait le nom d'une personne sur le message d'une autre dès
    /// qu'une notification en porte plusieurs.
    #[test]
    fn le_nom_se_prend_par_le_numero_jamais_par_la_position() {
        let charge = serde_json::json!({
          "entry": [{ "changes": [{ "value": {
            "contacts": [
              { "profile": { "name": "Bernard" }, "wa_id": "222" },
              { "profile": { "name": "Alice" },   "wa_id": "111" }
            ],
            "messages": [
              { "from": "111", "timestamp": "1", "type": "text", "text": { "body": "un" } },
              { "from": "222", "timestamp": "2", "type": "text", "text": { "body": "deux" } }
            ]
          }}]}]
        });
        let recus = depouiller_entrant(&charge);
        assert_eq!(recus[0].nom, "Alice", "le nom a suivi la position");
        assert_eq!(recus[1].nom, "Bernard", "le nom a suivi la position");
    }

    /// Un accusé de lecture, un statut, une image : rien de ça n'est un texte
    /// que l'agent puisse lire. Les remonter ferait répondre l'agent à du vide.
    #[test]
    fn ce_qui_n_est_pas_un_texte_ne_remonte_pas() {
        let statuts = serde_json::json!({
          "entry": [{ "changes": [{ "value": {
            "statuses": [{ "id": "wamid.X", "status": "read", "recipient_id": "111" }]
          }}]}]
        });
        assert!(depouiller_entrant(&statuts).is_empty());

        let image = serde_json::json!({
          "entry": [{ "changes": [{ "value": {
            "messages": [{ "from": "111", "timestamp": "1", "type": "image",
                           "image": { "id": "123" } }]
          }}]}]
        });
        assert!(depouiller_entrant(&image).is_empty());

        assert!(depouiller_entrant(&serde_json::json!({})).is_empty());
    }

    /// Sans nom de profil, l'agent doit quand même savoir à qui il parle.
    #[test]
    fn un_envoyeur_sans_profil_reste_nommable() {
        let charge = serde_json::json!({
          "entry": [{ "changes": [{ "value": {
            "messages": [{ "from": "111", "timestamp": "1", "type": "text",
                           "text": { "body": "bonjour" } }]
          }}]}]
        });
        assert_eq!(depouiller_entrant(&charge)[0].nom, "111");
    }

    /// Ce que le client lit reste du français : pas un mot de programmeur, et
    /// surtout pas le `message` anglais que Meta renvoie.
    #[test]
    fn tout_refus_se_lit_en_francais() {
        let meta = serde_json::json!({"error":{"message":"Invalid OAuth access token","code":190}});
        let mut phrases = vec![
            refus_en_francais(401, &meta),
            refus_en_francais(400, &serde_json::json!({"error":{"code":131047}})),
            refus_en_francais(500, &serde_json::json!({})),
            PAS_BRANCHE.to_string(),
            adresse_du_relais_recevable("http://relais.example").unwrap_err(),
        ];
        phrases.push(
            forme_de_la_connexion(Connexion {
                numero_id: "abc".into(),
                ..connexion_de_banc("https://relais.example")
            })
            .unwrap_err(),
        );
        for phrase in phrases {
            let bas = phrase.to_lowercase();
            for mot in ["error", "null", "failed", "undefined", "invalid", "oauth"] {
                assert!(!bas.contains(mot), "« {mot} » dans : {phrase}");
            }
        }
    }
}
