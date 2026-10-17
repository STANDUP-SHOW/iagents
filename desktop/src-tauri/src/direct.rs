//! The live conversation: the agent hears the client and answers aloud on one
//! open line to Gemini, instead of the relay of the listening loop.
//!
//! max, 16/10/2026: « je parle, j'attends trois minutes et j'ai une réponse,
//! complètement à côté de la plaque, puisqu'entre-temps j'ai continué à
//! parler ». The relay waited for a 0.8 s pause, transcribed on the PC,
//! transcribed again online, had the whole answer written, had a voice made
//! for it, played it with the microphone shut, and only then listened again.
//! Six steps, each waiting for the one before.
//!
//! Here the screen captures the microphone (with the echo cancellation of the
//! web view, so the agent does not hear itself through the speakers) and
//! plays the answer; Rust holds the line. The Google key never reaches the
//! screen: the line is opened here, with it, and only sound and words cross.
//! Gemini decides itself when the client has finished, answers as it thinks,
//! and stops talking when the client talks over it.
//!
//! Without a Google AI Studio key, or when the line cannot be opened, the
//! screen falls back on the relay: the client is answered either way.

use std::sync::Mutex;

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::voix_api::{self, Moteur};

const ADRESSE_MODELES: &str = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000";
const ADRESSE_LIGNE: &str =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/// The sound the screen sends: 16-bit PCM, 16 kHz, mono (Live API reference).
const FORMAT_ENTRANT: &str = "audio/pcm;rate=16000";

/// The model, read once from the key's own list: never written here, the
/// names change every few months.
static MODELE: Mutex<Option<String>> = Mutex::new(None);

/// The line open now, if any. One at a time: one client, one microphone.
static LIGNE: Mutex<Option<Ligne>> = Mutex::new(None);
static NUMERO: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

struct Ligne {
    numero: u64,
    envoi: mpsc::UnboundedSender<Message>,
}

/// True while a live conversation holds the microphone: the listening loop
/// then keeps nothing, so Whisper does not transcribe the same voice for
/// nobody and the PC keeps its cores.
pub fn en_cours() -> bool {
    crate::voice::EN_DIRECT.load(std::sync::atomic::Ordering::Acquire)
}

/// Whether a live conversation can be opened on this PC at all.
pub fn possible() -> bool {
    voix_api::cle(Moteur::Gemini).is_some()
}

/// The live model to open, from the models the key may use: those that take
/// a live line (`bidiGenerateContent`). A released model before a preview,
/// a model that speaks natively before one that reads text aloud, then the
/// highest version.
pub fn choisir_modele(liste: &Value) -> Option<String> {
    let mut candidats: Vec<(bool, bool, Vec<u32>, String)> = liste
        .get("models")?
        .as_array()?
        .iter()
        .filter(|m| {
            m.get("supportedGenerationMethods")
                .and_then(Value::as_array)
                .is_some_and(|a| a.iter().any(|x| x.as_str() == Some("bidiGenerateContent")))
        })
        .filter_map(|m| m.get("name")?.as_str().map(str::to_string))
        .filter(|n| n.contains("gemini"))
        .map(|n| {
            let essai = n.contains("preview") || n.contains("exp");
            let lu = !(n.contains("native-audio") || n.contains("live"));
            let version: Vec<u32> = n
                .trim_start_matches("models/gemini-")
                .split(['-', '.'])
                .map_while(|p| p.parse().ok())
                .collect();
            (essai, lu, version, n)
        })
        .collect();
    candidats.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)).then(b.2.cmp(&a.2)));
    candidats.into_iter().next().map(|c| c.3)
}

/// The first message on the line: who the agent is, which voice, and that
/// both sides are written down too (the screen shows them, and the
/// conversation goes on in writing with the same agent).
pub fn premier_message(modele: &str, voix: &str, consigne: &str) -> Value {
    json!({
        "setup": {
            "model": modele,
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": { "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": voix } } }
            },
            "systemInstruction": { "parts": [{ "text": consigne }] },
            "inputAudioTranscription": {},
            "outputAudioTranscription": {},
            // Audio fills the window in about fifteen minutes; past that the
            // oldest turns are dropped instead of the line being cut.
            "contextWindowCompression": { "slidingWindow": {} }
        }
    })
}

pub fn message_son(donnees: &str) -> Value {
    json!({ "realtimeInput": { "audio": { "data": donnees, "mimeType": FORMAT_ENTRANT } } })
}

pub fn message_texte(texte: &str) -> Value {
    json!({ "realtimeInput": { "text": texte } })
}

/// What a message from Gemini means for the screen.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(tag = "quoi", rename_all = "kebab-case")]
pub enum Evenement {
    /// The line is ready: sound may be sent.
    Pret,
    /// A piece of the answer, base64 16-bit PCM at the rate given.
    Son { donnees: String, taux: u32 },
    /// The client talked over the agent: what is still queued must not play.
    Coupe,
    /// Words the client said, as they are recognised.
    Entendu { texte: String },
    /// Words the agent says, as it says them.
    Dit { texte: String },
    /// The agent has finished its turn.
    TourFini,
    /// The client took leave of the agent: close once it has finished.
    Conge,
    /// The client called another agent: close, and hand it the request.
    Autre { prenom: String, demande: String },
    /// The line is closing.
    Fin { motif: Option<String> },
}

/// What a whole sentence of the client means for the line, by the same rule
/// as the listening loop (`reveil.rs`): « au revoir » closes it, another
/// hired agent's first name opening the sentence hands over to that agent.
/// `None`: the conversation goes on.
pub fn suite(prenom: &str, phrase: &str, prenoms: &[String]) -> Option<Evenement> {
    let ouverte = crate::reveil::Etat::EnConversation { prenom: prenom.to_string() };
    match crate::reveil::entendu(&ouverte, phrase, prenoms).1 {
        crate::reveil::Reaction::Conge { .. } => Some(Evenement::Conge),
        crate::reveil::Reaction::Appel { prenom: p, demande } if p != prenom => {
            Some(Evenement::Autre { prenom: p, demande })
        }
        // « Victor, au revoir » names the agent it leaves.
        crate::reveil::Reaction::Appel { demande, .. } if demande.trim() != phrase.trim() => {
            match crate::reveil::entendu(&ouverte, &demande, prenoms).1 {
                crate::reveil::Reaction::Conge { .. } => Some(Evenement::Conge),
                _ => None,
            }
        }
        _ => None,
    }
}

/// An event as the screen receives it: which line it comes from, so a line
/// that is closing cannot speak into the one that replaced it.
#[derive(serde::Serialize, Clone)]
struct Envoi<'a> {
    ligne: u64,
    #[serde(flatten)]
    evenement: &'a Evenement,
}

/// Reads one message from Gemini. Several things can arrive in one message
/// (a piece of sound and the words that go with it).
pub fn lire(message: &Value) -> Vec<Evenement> {
    let mut sortie = Vec::new();
    if message.get("setupComplete").is_some() {
        sortie.push(Evenement::Pret);
    }
    if let Some(contenu) = message.get("serverContent") {
        if contenu.get("interrupted").and_then(Value::as_bool) == Some(true) {
            sortie.push(Evenement::Coupe);
        }
        if let Some(t) = contenu.pointer("/inputTranscription/text").and_then(Value::as_str) {
            if !t.is_empty() {
                sortie.push(Evenement::Entendu { texte: t.to_string() });
            }
        }
        if let Some(t) = contenu.pointer("/outputTranscription/text").and_then(Value::as_str) {
            if !t.is_empty() {
                sortie.push(Evenement::Dit { texte: t.to_string() });
            }
        }
        for part in contenu
            .pointer("/modelTurn/parts")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            let Some(son) = part.get("inlineData") else { continue };
            let type_ = son.get("mimeType").and_then(Value::as_str).unwrap_or("");
            if !type_.starts_with("audio/pcm") {
                continue;
            }
            if let Some(d) = son.get("data").and_then(Value::as_str) {
                sortie.push(Evenement::Son { donnees: d.to_string(), taux: taux_de(type_) });
            }
        }
        if contenu.get("turnComplete").and_then(Value::as_bool) == Some(true) {
            sortie.push(Evenement::TourFini);
        }
    }
    if message.get("goAway").is_some() {
        sortie.push(Evenement::Fin {
            motif: Some("Google ferme la conversation (durée maximale atteinte). Appelez l'agent pour en ouvrir une autre.".to_string()),
        });
    }
    if let Some(e) = message.get("error") {
        let m = e.get("message").and_then(Value::as_str).unwrap_or("erreur sans message");
        sortie.push(Evenement::Fin { motif: Some(format!("Google a refusé la conversation : {}", m)) });
    }
    sortie
}

/// `audio/pcm;rate=24000` → 24000. Gemini speaks at 24 kHz when it does not say.
fn taux_de(type_: &str) -> u32 {
    type_
        .split(';')
        .find_map(|p| p.trim().strip_prefix("rate="))
        .and_then(|r| r.parse().ok())
        .unwrap_or(24_000)
}

/// Why the line closed, in words the client reads. Google puts the reason of
/// a refusal in the close frame.
fn motif_de_fermeture(raison: &str) -> Option<String> {
    let raison = raison.trim();
    if raison.is_empty() {
        return None;
    }
    let lu = raison.to_lowercase();
    Some(if lu.contains("api key") || lu.contains("api_key") || lu.contains("permission") {
        "la clé Google AI Studio est refusée pour la conversation en direct.".to_string()
    } else if lu.contains("quota") || lu.contains("resource") {
        "le quota de la clé Google est atteint.".to_string()
    } else {
        format!("Google a fermé la ligne : {}", raison)
    })
}

async fn modele_live(client: &reqwest::Client, cle: &str) -> Result<String, String> {
    if let Some(m) = MODELE.lock().unwrap().clone() {
        return Ok(m);
    }
    let reponse = client
        .get(ADRESSE_MODELES)
        .header("x-goog-api-key", cle)
        .send()
        .await
        .map_err(|_| "Google ne répond pas (connexion internet ?)".to_string())?;
    if !reponse.status().is_success() {
        return Err(format!("Google refuse la clé ({})", reponse.status().as_u16()));
    }
    let liste: Value = reponse.json().await.map_err(|_| "Google a rendu une liste illisible".to_string())?;
    let m = choisir_modele(&liste)
        .ok_or("aucun modèle de conversation en direct n'est ouvert à cette clé Google".to_string())?;
    *MODELE.lock().unwrap() = Some(m.clone());
    Ok(m)
}

/// Opens the line for `prenom`, sends the instruction, then what the client
/// already said when calling the agent. Returns once Google has accepted the
/// line; sound and words then arrive as `direct` events.
pub async fn ouvrir(app: AppHandle, prenom: String, consigne: String, demande: String) -> Result<u64, String> {
    fermer(None);
    let cle = voix_api::cle(Moteur::Gemini).ok_or("aucune clé Google AI Studio n'est rangée sur ce poste")?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let modele = modele_live(&client, &cle).await?;

    let installation: Value = crate::fiches::lire_installation()
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or(Value::Null);
    let (voix, sexe) = voix_api::agent_de(&installation, &prenom);
    let voix = voix_api::voix_de(Moteur::Gemini, &prenom, voix.as_deref(), sexe.as_deref());

    let mut requete = tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(ADRESSE_LIGNE)
        .map_err(|e| e.to_string())?;
    requete
        .headers_mut()
        .insert("x-goog-api-key", cle.parse().map_err(|_| "clé Google illisible".to_string())?);
    let (ligne, _) = tokio::time::timeout(std::time::Duration::from_secs(10), tokio_tungstenite::connect_async(requete))
        .await
        .map_err(|_| "Google ne répond pas (connexion internet ?)".to_string())?
        .map_err(|e| format!("la ligne vers Google ne s'ouvre pas : {}", e))?;
    let (mut ecrire, mut lire_ligne) = ligne.split();

    ecrire
        .send(Message::Text(premier_message(&modele, &voix, &consigne).to_string().into()))
        .await
        .map_err(|e| format!("la ligne vers Google s'est coupée : {}", e))?;

    // Google answers the first message before anything else: a refusal of
    // the instruction or the model must reach the caller, who then falls back.
    let accepte = tokio::time::timeout(std::time::Duration::from_secs(10), async {
        while let Some(m) = lire_ligne.next().await {
            match m {
                Ok(Message::Text(t)) => {
                    if let Ok(v) = serde_json::from_str::<Value>(&t) {
                        if lire(&v).contains(&Evenement::Pret) {
                            return Ok(());
                        }
                    }
                }
                Ok(Message::Binary(b)) => {
                    if let Ok(v) = serde_json::from_slice::<Value>(&b) {
                        if lire(&v).contains(&Evenement::Pret) {
                            return Ok(());
                        }
                    }
                }
                Ok(Message::Close(c)) => {
                    return Err(c
                        .and_then(|c| motif_de_fermeture(&c.reason))
                        .unwrap_or("Google a refusé la conversation".to_string()))
                }
                Ok(_) => {}
                Err(e) => return Err(format!("la ligne vers Google s'est coupée : {}", e)),
            }
        }
        Err("Google a refusé la conversation".to_string())
    })
    .await
    .map_err(|_| "Google n'a pas accepté la conversation à temps".to_string())?;
    accepte?;

    let (envoi, mut a_envoyer) = mpsc::unbounded_channel::<Message>();
    let premier = if demande.trim().is_empty() { prenom.clone() } else { demande };
    let _ = envoi.send(Message::Text(message_texte(&premier).to_string().into()));
    let numero = NUMERO.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
    *LIGNE.lock().unwrap() = Some(Ligne { numero, envoi });
    crate::voice::EN_DIRECT.store(true, std::sync::atomic::Ordering::Release);

    tokio::spawn(async move {
        while let Some(m) = a_envoyer.recv().await {
            let fin = matches!(m, Message::Close(_));
            if ecrire.send(m).await.is_err() || fin {
                break;
            }
        }
    });

    let prenoms = crate::prenoms_embauches();
    tokio::spawn(async move {
        let mut motif = None;
        let mut phrase = String::new();
        while let Some(m) = lire_ligne.next().await {
            let v = match m {
                Ok(Message::Text(t)) => serde_json::from_str::<Value>(&t).ok(),
                Ok(Message::Binary(b)) => serde_json::from_slice::<Value>(&b).ok(),
                Ok(Message::Close(c)) => {
                    motif = c.and_then(|c| motif_de_fermeture(&c.reason));
                    break;
                }
                Ok(_) => None,
                Err(e) => {
                    motif = Some(format!("la ligne vers Google s'est coupée : {}", e));
                    break;
                }
            };
            for e in v.as_ref().map(lire).unwrap_or_default() {
                match &e {
                    Evenement::Fin { motif: m } => {
                        motif = m.clone();
                        continue;
                    }
                    Evenement::Entendu { texte } => phrase.push_str(texte),
                    Evenement::TourFini => {
                        let dite = std::mem::take(&mut phrase);
                        let _ = app.emit("direct", Envoi { ligne: numero, evenement: &e });
                        if let Some(s) = suite(&prenom, &dite, &prenoms) {
                            let _ = app.emit("direct", Envoi { ligne: numero, evenement: &s });
                        }
                        continue;
                    }
                    _ => {}
                }
                let _ = app.emit("direct", Envoi { ligne: numero, evenement: &e });
            }
        }
        // Only the line that is still the current one is cleared: a newer
        // line for another agent may already have replaced it.
        {
            let mut l = LIGNE.lock().unwrap();
            if let Some(ouverte) = l.take_if(|l| l.numero == numero) {
                let _ = ouverte.envoi.send(Message::Close(None));
                crate::voice::EN_DIRECT.store(false, std::sync::atomic::Ordering::Release);
            }
        }
        let _ = app.emit("direct", Envoi { ligne: numero, evenement: &Evenement::Fin { motif } });
    });
    Ok(numero)
}

/// A piece of what the microphone hears, from the screen.
pub fn envoyer_son(donnees: &str) -> Result<(), String> {
    let l = LIGNE.lock().unwrap();
    let l = l.as_ref().ok_or("aucune conversation en direct n'est ouverte")?;
    l.envoi
        .send(Message::Text(message_son(donnees).to_string().into()))
        .map_err(|_| "la conversation en direct est fermée".to_string())
}

/// Closes the line `numero`, or whichever is open with `None`. Returns
/// whether nothing is open any more (a newer line is left alone).
pub fn fermer(numero: Option<u64>) -> bool {
    let mut l = LIGNE.lock().unwrap();
    if let Some(ouverte) = l.take_if(|l| numero.is_none_or(|n| n == l.numero)) {
        let _ = ouverte.envoi.send(Message::Close(None));
    }
    let libre = l.is_none();
    if libre {
        crate::voice::EN_DIRECT.store(false, std::sync::atomic::Ordering::Release);
    }
    libre
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_modele_retenu_parle_en_direct_et_n_est_pas_un_essai() {
        let liste = json!({ "models": [
            { "name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"] },
            { "name": "models/gemini-3.8-live-preview-09-2026", "supportedGenerationMethods": ["bidiGenerateContent"] },
            { "name": "models/gemini-3.8-live", "supportedGenerationMethods": ["bidiGenerateContent", "countTokens"] },
            { "name": "models/gemini-3.1-live", "supportedGenerationMethods": ["bidiGenerateContent"] },
        ]});
        assert_eq!(choisir_modele(&liste).as_deref(), Some("models/gemini-3.8-live"));
    }

    #[test]
    fn sans_modele_en_direct_rien_n_est_retenu() {
        let liste = json!({ "models": [
            { "name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"] },
        ]});
        assert_eq!(choisir_modele(&liste), None);
    }

    #[test]
    fn un_modele_qui_parle_nativement_passe_devant_un_modele_qui_lit() {
        let liste = json!({ "models": [
            { "name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent", "bidiGenerateContent"] },
            { "name": "models/gemini-3.5-flash-native-audio", "supportedGenerationMethods": ["bidiGenerateContent"] },
        ]});
        assert_eq!(choisir_modele(&liste).as_deref(), Some("models/gemini-3.5-flash-native-audio"));
    }

    #[test]
    fn le_premier_message_porte_la_voix_la_consigne_et_les_transcriptions() {
        let m = premier_message("models/gemini-3.8-live", "Charon", "Vous êtes Victor.");
        assert_eq!(m.pointer("/setup/model").unwrap(), "models/gemini-3.8-live");
        assert_eq!(
            m.pointer("/setup/generationConfig/speechConfig/voiceConfig/prebuiltVoiceConfig/voiceName").unwrap(),
            "Charon"
        );
        assert_eq!(m.pointer("/setup/systemInstruction/parts/0/text").unwrap(), "Vous êtes Victor.");
        assert_eq!(m.pointer("/setup/generationConfig/responseModalities/0").unwrap(), "AUDIO");
        assert!(m.pointer("/setup/inputAudioTranscription").is_some());
        assert!(m.pointer("/setup/outputAudioTranscription").is_some());
    }

    #[test]
    fn le_son_part_en_pcm_16_khz() {
        let m = message_son("AAA=");
        assert_eq!(m.pointer("/realtimeInput/audio/mimeType").unwrap(), "audio/pcm;rate=16000");
        assert_eq!(m.pointer("/realtimeInput/audio/data").unwrap(), "AAA=");
    }

    #[test]
    fn un_morceau_de_reponse_rend_le_son_et_les_mots() {
        let v = json!({ "serverContent": {
            "modelTurn": { "parts": [{ "inlineData": { "mimeType": "audio/pcm;rate=24000", "data": "UklG" } }] },
            "outputTranscription": { "text": "Bonjour" }
        }});
        assert_eq!(
            lire(&v),
            vec![
                Evenement::Dit { texte: "Bonjour".into() },
                Evenement::Son { donnees: "UklG".into(), taux: 24_000 },
            ]
        );
    }

    #[test]
    fn le_client_qui_coupe_la_parole_arrete_l_agent() {
        let v = json!({ "serverContent": { "interrupted": true } });
        assert_eq!(lire(&v), vec![Evenement::Coupe]);
    }

    #[test]
    fn la_fin_du_tour_et_ce_qui_a_ete_entendu() {
        let v = json!({ "serverContent": { "inputTranscription": { "text": "tu m'entends ?" }, "turnComplete": true } });
        assert_eq!(lire(&v), vec![Evenement::Entendu { texte: "tu m'entends ?".into() }, Evenement::TourFini]);
    }

    #[test]
    fn la_ligne_prete_et_la_ligne_qui_ferme() {
        assert_eq!(lire(&json!({ "setupComplete": {} })), vec![Evenement::Pret]);
        assert!(matches!(lire(&json!({ "goAway": { "timeLeft": "5s" } }))[0], Evenement::Fin { motif: Some(_) }));
    }

    fn maison() -> Vec<String> {
        ["Victor", "Nora"].iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn au_revoir_ferme_la_ligne_et_une_question_la_garde() {
        assert_eq!(suite("Victor", "Au revoir.", &maison()), Some(Evenement::Conge));
        assert_eq!(suite("Victor", "Merci Victor, au revoir", &maison()), None);
        assert_eq!(suite("Victor", "Victor, au revoir.", &maison()), Some(Evenement::Conge));
        assert_eq!(suite("Victor", "Et le budget de la semaine prochaine ?", &maison()), None);
    }

    #[test]
    fn appeler_un_autre_agent_lui_passe_la_demande() {
        assert_eq!(
            suite("Victor", "Nora, tu peux me rappeler le rendez-vous ?", &maison()),
            Some(Evenement::Autre { prenom: "Nora".into(), demande: "tu peux me rappeler le rendez-vous ?".into() })
        );
    }

    #[test]
    fn sans_taux_annonce_la_voix_est_a_24_khz() {
        assert_eq!(taux_de("audio/pcm"), 24_000);
        assert_eq!(taux_de("audio/pcm;rate=16000"), 16_000);
    }

    #[test]
    fn un_refus_de_cle_se_dit_en_francais() {
        assert_eq!(
            motif_de_fermeture("API key not valid. Please pass a valid API key.").as_deref(),
            Some("la clé Google AI Studio est refusée pour la conversation en direct.")
        );
        assert_eq!(motif_de_fermeture("  "), None);
    }
}
