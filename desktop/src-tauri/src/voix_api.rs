//! The agents' voice through an API, when the client chose one.
//!
//! Same rule as the models: local by default (Piper, in `voice.rs`), an API
//! only when the client saved its key. Two engines, picked on 06/10/2026 from
//! the September 2026 blind-listening rankings:
//!
//! - **ElevenLabs** (`eleven_v4`): first of the arena, the most expressive,
//!   about five times the price of Gemini. Saving its key is choosing it.
//! - **Mistral Voxtral** (`voxtral-mini-tts-2603`): French natively, European,
//!   about $10 a month for an hour of talk a day.
//! - **Gemini Flash TTS** (`gemini-3.8-flash-tts`): third of the arena, French
//!   among 130 languages, about $16 per million characters. Its delivery is
//!   directed by a sentence (`speech_metadata.style`), never by the text.
//!
//! Keys live in the system keychain under `iagent-api`, accounts
//! `elevenlabs`, `mistral` and `google-ai-studio` — the same entries as the AI engines
//! screen, so a key saved there is used here. They never come back to the
//! screen. All three engines return WAV, which `voice::jouer_wav` already plays.
//!
//! Nothing here was heard on a real machine yet: the request shapes were read
//! in each vendor's API reference on 06/10/2026.

use serde_json::{json, Value};

const SERVICE_TROUSSEAU: &str = "iagent-api";
pub const COMPTE_ELEVENLABS: &str = "elevenlabs";
pub const COMPTE_GEMINI: &str = "google-ai-studio";
pub const COMPTE_MISTRAL: &str = "mistral";

const ADRESSE_ELEVENLABS: &str = "https://api.elevenlabs.io/v1/text-to-speech";
const MODELE_ELEVENLABS: &str = "eleven_v4";
const ADRESSE_GEMINI: &str = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODELE_GEMINI: &str = "gemini-3.8-flash-tts";
const ADRESSE_MISTRAL: &str = "https://api.mistral.ai/v1/audio/speech";
const MODELE_MISTRAL: &str = "voxtral-mini-tts-2603";
/// The one French preset slug found in the documentation; not heard here.
const MISTRAL_DEFAUT: &str = "fr_marie_neutral";

/// How the agents speak by default: a person, not a reader.
const STYLE: &str = "en français, avec naturel et chaleur, comme un collègue attentionné qui parle \
                     à son patron ; ton posé et rassurant si la nouvelle est mauvaise, enjoué si elle est bonne";

/// Premade ElevenLabs voices, already named in `conversation-settings.json`.
const ELEVENLABS_FEMME: &str = "EXAVITQu4vr4xnSDxMaL";
const ELEVENLABS_HOMME: &str = "pNInz6obpgDQGcFmaJgB";
/// Gemini prebuilt voices. Gender as listed by Google; not heard here.
const GEMINI_FEMMES: [&str; 3] = ["Kore", "Aoede", "Leda"];
const GEMINI_HOMMES: [&str; 3] = ["Charon", "Puck", "Orus"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Moteur {
    ElevenLabs,
    Mistral,
    Gemini,
}

impl Moteur {
    pub fn compte(self) -> &'static str {
        match self {
            Moteur::ElevenLabs => COMPTE_ELEVENLABS,
            Moteur::Mistral => COMPTE_MISTRAL,
            Moteur::Gemini => COMPTE_GEMINI,
        }
    }
    pub fn nom(self) -> &'static str {
        match self {
            Moteur::ElevenLabs => "ElevenLabs",
            Moteur::Mistral => "Mistral",
            Moteur::Gemini => "Gemini",
        }
    }
}

fn entree(compte: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, compte)
        .map_err(|e| format!("coffre du système indisponible : {}", e))
}

fn cle(moteur: Moteur) -> Option<String> {
    entree(moteur.compte())
        .ok()
        .and_then(|e| e.get_password().ok())
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
}

/// Which engine speaks, from which keys are saved. ElevenLabs first: it is
/// the dearer one, so a client who saved its key asked for it. Then Mistral,
/// French and European, then Gemini.
pub fn moteur_retenu(elevenlabs: bool, mistral: bool, gemini: bool) -> Option<Moteur> {
    if elevenlabs {
        Some(Moteur::ElevenLabs)
    } else if mistral {
        Some(Moteur::Mistral)
    } else if gemini {
        Some(Moteur::Gemini)
    } else {
        None
    }
}

/// The engine and its key, if the client saved one.
pub fn moteur_du_poste() -> Option<(Moteur, String)> {
    let e = cle(Moteur::ElevenLabs);
    let mi = cle(Moteur::Mistral);
    let g = cle(Moteur::Gemini);
    let m = moteur_retenu(e.is_some(), mi.is_some(), g.is_some())?;
    let k = match m {
        Moteur::ElevenLabs => e,
        Moteur::Mistral => mi,
        Moteur::Gemini => g,
    }?;
    Some((m, k))
}

/// What the hiring saved about an agent's voice: `voix` and `sexe`.
pub fn agent_de(installation: &Value, prenom: &str) -> (Option<String>, Option<String>) {
    let agent = installation
        .get("agents")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find(|a| a.get("prenom").and_then(Value::as_str) == Some(prenom));
    let champ = |k: &str| {
        agent
            .and_then(|a| a.get(k))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(String::from)
    };
    (champ("voix"), champ("sexe"))
}

/// Same name, same voice, every time — and two agents rarely share one.
fn rang(prenom: &str, n: usize) -> usize {
    prenom.bytes().fold(0usize, |h, b| h.wrapping_mul(31).wrapping_add(b as usize)) % n
}

/// The voice an agent speaks with on this engine. A voice the client chose
/// wins when it belongs to the engine; otherwise the agent's gender, when the
/// hiring gave one; otherwise a voice tied to the first name. Never a gender
/// guessed from the name.
pub fn voix_de(moteur: Moteur, prenom: &str, voix: Option<&str>, sexe: Option<&str>) -> String {
    match moteur {
        Moteur::ElevenLabs => {
            if let Some(v) = voix.filter(|v| v.len() == 20 && v.chars().all(|c| c.is_ascii_alphanumeric())) {
                return v.to_string();
            }
            match sexe {
                Some("femme") => ELEVENLABS_FEMME,
                Some("homme") => ELEVENLABS_HOMME,
                _ => [ELEVENLABS_FEMME, ELEVENLABS_HOMME][rang(prenom, 2)],
            }
            .to_string()
        }
        // Mistral names its presets by language first; any other voice the
        // client chose belongs to another engine.
        Moteur::Mistral => voix
            .filter(|v| v.starts_with("fr_"))
            .unwrap_or(MISTRAL_DEFAUT)
            .to_string(),
        Moteur::Gemini => {
            let toutes: Vec<&str> = GEMINI_FEMMES.iter().chain(GEMINI_HOMMES.iter()).copied().collect();
            if let Some(v) = voix.and_then(|v| toutes.iter().find(|t| t.eq_ignore_ascii_case(v))) {
                return v.to_string();
            }
            let liste: &[&str] = match sexe {
                Some("femme") => &GEMINI_FEMMES,
                Some("homme") => &GEMINI_HOMMES,
                _ => &toutes,
            };
            liste[rang(prenom, liste.len())].to_string()
        }
    }
}

pub fn corps_elevenlabs(texte: &str) -> Value {
    json!({ "text": texte, "model_id": MODELE_ELEVENLABS, "language_code": "fr" })
}

pub fn corps_mistral(texte: &str, voix: &str) -> Value {
    json!({ "model": MODELE_MISTRAL, "input": texte, "voice_id": voix, "response_format": "wav" })
}

pub fn corps_gemini(texte: &str, voix: &str) -> Value {
    json!({
        "model": MODELE_GEMINI,
        "input": [{
            "type": "user_input",
            "content": [{
                "type": "text",
                "text": texte,
                "annotations": [{ "type": "speech_metadata", "style": STYLE }]
            }]
        }],
        "response_format": { "type": "audio" },
        "generation_config": { "speech_config": [{ "voice": voix }] }
    })
}

/// The last audio part of a Gemini answer, decoded.
pub fn audio_de_gemini(reponse: &Value) -> Option<Vec<u8>> {
    let donnees = reponse
        .get("steps")?
        .as_array()?
        .iter()
        .filter(|s| s.get("type").and_then(Value::as_str) == Some("model_output"))
        .flat_map(|s| s.get("content").and_then(Value::as_array).into_iter().flatten())
        .filter(|c| c.get("type").and_then(Value::as_str) == Some("audio"))
        .filter_map(|c| c.get("data").and_then(Value::as_str))
        .last()?;
    decoder(donnees)
}

fn refus(moteur: Moteur, statut: reqwest::StatusCode) -> String {
    match statut.as_u16() {
        401 | 403 => format!("la clé {} est refusée : vérifiez-la dans « Vos connexions »", moteur.nom()),
        402 | 429 => format!("{} refuse pour l'instant : crédit épuisé ou trop de demandes", moteur.nom()),
        _ => format!("{} n'a pas su produire la voix (code {})", moteur.nom(), statut.as_u16()),
    }
}

fn decoder(b64: &str) -> Option<Vec<u8>> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.decode(b64).ok()
}

/// Where each engine is reached; the bench swaps them for a local server.
pub struct Adresses<'a> {
    pub elevenlabs: &'a str,
    pub mistral: &'a str,
    pub gemini: &'a str,
}

pub const ADRESSES: Adresses<'static> = Adresses {
    elevenlabs: ADRESSE_ELEVENLABS,
    mistral: ADRESSE_MISTRAL,
    gemini: ADRESSE_GEMINI,
};

/// Speaks `texte` through the engine, returns WAV bytes.
pub async fn synthetiser(
    adresses: &Adresses<'_>,
    moteur: Moteur,
    cle: &str,
    voix: &str,
    texte: &str,
) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|_| "le poste n'a pas pu préparer l'appel à la voix".to_string())?;
    let injoignable = |_| format!("{} est injoignable : vérifiez la connexion à Internet", moteur.nom());
    match moteur {
        Moteur::ElevenLabs => {
            let r = client
                .post(format!("{}/{}?output_format=wav_24000", adresses.elevenlabs, voix))
                .header("xi-api-key", cle)
                .json(&corps_elevenlabs(texte))
                .send()
                .await
                .map_err(injoignable)?;
            if !r.status().is_success() {
                return Err(refus(moteur, r.status()));
            }
            r.bytes().await.map(|b| b.to_vec()).map_err(injoignable)
        }
        Moteur::Mistral => {
            let r = client
                .post(adresses.mistral)
                .bearer_auth(cle)
                .json(&corps_mistral(texte, voix))
                .send()
                .await
                .map_err(injoignable)?;
            if !r.status().is_success() {
                return Err(refus(moteur, r.status()));
            }
            let v: Value = r.json().await.map_err(|_| "Mistral a rendu une réponse illisible".to_string())?;
            v.get("audio_data")
                .and_then(Value::as_str)
                .and_then(decoder)
                .ok_or_else(|| "Mistral n'a rendu aucun son".to_string())
        }
        Moteur::Gemini => {
            let r = client
                .post(adresses.gemini)
                .header("x-goog-api-key", cle)
                .json(&corps_gemini(texte, voix))
                .send()
                .await
                .map_err(injoignable)?;
            if !r.status().is_success() {
                return Err(refus(moteur, r.status()));
            }
            let v: Value = r.json().await.map_err(|_| "Gemini a rendu une réponse illisible".to_string())?;
            audio_de_gemini(&v).ok_or_else(|| "Gemini n'a rendu aucun son".to_string())
        }
    }
}

/// The voice of `prenom` through the client's API, as WAV bytes; `None` when
/// no voice key is saved (the caller then speaks locally).
pub async fn parler(prenom: Option<&str>, texte: &str) -> Option<Result<Vec<u8>, String>> {
    let (moteur, cle) = moteur_du_poste()?;
    let installation: Value = crate::fiches::lire_installation()
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or(Value::Null);
    let prenom = prenom.unwrap_or("");
    let (voix, sexe) = agent_de(&installation, prenom);
    let voix = voix_de(moteur, prenom, voix.as_deref(), sexe.as_deref());
    Some(synthetiser(&ADRESSES, moteur, &cle, &voix, texte).await)
}

// ---------------------------------------------------------------------------
// The keys, from the voice screen
// ---------------------------------------------------------------------------

fn moteur_nomme(compte: &str) -> Result<Moteur, String> {
    match compte {
        COMPTE_ELEVENLABS => Ok(Moteur::ElevenLabs),
        COMPTE_MISTRAL => Ok(Moteur::Mistral),
        COMPTE_GEMINI => Ok(Moteur::Gemini),
        _ => Err("ce service ne fait pas parler les agents".to_string()),
    }
}

#[derive(serde::Serialize)]
pub struct EtatVoixApi {
    pub elevenlabs: bool,
    pub mistral: bool,
    pub gemini: bool,
    /// The engine that will speak, in words.
    pub parle: String,
}

#[tauri::command]
pub fn voix_api_etat() -> EtatVoixApi {
    let elevenlabs = cle(Moteur::ElevenLabs).is_some();
    let mistral = cle(Moteur::Mistral).is_some();
    let gemini = cle(Moteur::Gemini).is_some();
    let parle = match moteur_retenu(elevenlabs, mistral, gemini) {
        Some(m) => format!("Vos agents parlent avec {}.", m.nom()),
        None => "Vos agents parlent avec la voix installée sur ce poste.".to_string(),
    };
    EtatVoixApi { elevenlabs, mistral, gemini, parle }
}

#[tauri::command]
pub fn voix_api_ranger(compte: String, cle: String) -> Result<String, String> {
    let moteur = moteur_nomme(&compte)?;
    let cle = cle.trim();
    if cle.is_empty() || cle.chars().any(char::is_whitespace) || cle.chars().count() < 8 {
        return Err("ce n'est pas une clé : recopiez-la seule, depuis la page de l'éditeur".to_string());
    }
    entree(moteur.compte())?
        .set_password(cle)
        .map_err(|e| format!("enregistrement dans le coffre : {}", e))?;
    Ok(format!("Clé {} rangée dans le coffre de votre ordinateur.", moteur.nom()))
}

#[tauri::command]
pub fn voix_api_retirer(compte: String) -> Result<String, String> {
    let moteur = moteur_nomme(&compte)?;
    match entree(moteur.compte())?.delete_credential() {
        Ok(()) => Ok(format!("Clé {} retirée de cet ordinateur.", moteur.nom())),
        Err(keyring::Error::NoEntry) => Ok("Aucune clé n'était rangée.".to_string()),
        Err(e) => Err(format!("retrait du coffre : {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[test]
    fn la_cle_elevenlabs_l_emporte_et_sans_cle_on_parle_en_local() {
        assert_eq!(moteur_retenu(true, true, true), Some(Moteur::ElevenLabs));
        assert_eq!(moteur_retenu(false, true, true), Some(Moteur::Mistral));
        assert_eq!(moteur_retenu(false, false, true), Some(Moteur::Gemini));
        assert_eq!(moteur_retenu(false, false, false), None);
    }

    #[test]
    fn la_voix_choisie_gagne_puis_le_genre_puis_le_prenom() {
        // A voice of the other engine is ignored rather than sent.
        assert_eq!(voix_de(Moteur::Gemini, "Léa", Some("Aoede"), None), "Aoede");
        assert_eq!(voix_de(Moteur::ElevenLabs, "Léa", Some("Aoede"), Some("femme")), ELEVENLABS_FEMME);
        assert_eq!(voix_de(Moteur::ElevenLabs, "Hugo", Some("ZQe5CZNOzWyzChESwQEW"), None), "ZQe5CZNOzWyzChESwQEW");
        assert_eq!(voix_de(Moteur::Mistral, "Léa", Some("Kore"), None), MISTRAL_DEFAUT);
        assert_eq!(voix_de(Moteur::Mistral, "Léa", Some("fr_marie_happy"), None), "fr_marie_happy");
        assert!(GEMINI_HOMMES.contains(&voix_de(Moteur::Gemini, "Paul", None, Some("homme")).as_str()));
        // Without a gender, the same name always gets the same voice.
        assert_eq!(voix_de(Moteur::Gemini, "Victor", None, None), voix_de(Moteur::Gemini, "Victor", None, None));
    }

    #[test]
    fn l_agent_se_lit_dans_l_installation() {
        let i = json!({ "agents": [{ "prenom": "Léa", "voix": " Kore ", "sexe": "femme" }, { "prenom": "Paul" }] });
        assert_eq!(agent_de(&i, "Léa"), (Some("Kore".into()), Some("femme".into())));
        assert_eq!(agent_de(&i, "Paul"), (None, None));
        assert_eq!(agent_de(&i, "Inconnu"), (None, None));
    }

    #[test]
    fn gemini_recoit_le_texte_tel_quel_et_le_ton_a_part() {
        let c = corps_gemini("Bonjour Max.", "Kore");
        assert_eq!(c["input"][0]["content"][0]["text"], "Bonjour Max.");
        assert_eq!(c["input"][0]["content"][0]["annotations"][0]["type"], "speech_metadata");
        assert_eq!(c["generation_config"]["speech_config"][0]["voice"], "Kore");
        assert_eq!(corps_elevenlabs("x")["language_code"], "fr");
    }

    #[test]
    fn le_son_de_gemini_est_le_dernier_morceau_audio() {
        let r = json!({ "steps": [
            { "type": "user_input", "content": [{ "type": "audio", "data": "AAAA" }] },
            { "type": "model_output", "content": [{ "type": "text", "text": "x" }, { "type": "audio", "data": "UklGRg==" }] }
        ]});
        assert_eq!(audio_de_gemini(&r).unwrap(), b"RIFF");
        assert!(audio_de_gemini(&json!({ "steps": [] })).is_none());
    }

    /// One HTTP answer per connection, from a hand-written local server.
    async fn serveur(statut: u16, corps: Vec<u8>, type_: &'static str) -> (String, tokio::task::JoinHandle<String>) {
        let ecoute = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let adresse = format!("http://{}", ecoute.local_addr().unwrap());
        let tache = tokio::spawn(async move {
            let (mut s, _) = ecoute.accept().await.unwrap();
            let mut lu = Vec::new();
            let mut tampon = [0u8; 8192];
            loop {
                let n = s.read(&mut tampon).await.unwrap();
                lu.extend_from_slice(&tampon[..n]);
                let texte = String::from_utf8_lossy(&lu).to_string();
                if let Some(fin) = texte.find("\r\n\r\n") {
                    let longueur = texte[..fin]
                        .lines()
                        .find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap()))
                        .unwrap_or(0);
                    if lu.len() >= fin + 4 + longueur {
                        break;
                    }
                }
                if n == 0 {
                    break;
                }
            }
            let entete = format!(
                "HTTP/1.1 {} X\r\ncontent-type: {}\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
                statut,
                type_,
                corps.len()
            );
            s.write_all(entete.as_bytes()).await.unwrap();
            s.write_all(&corps).await.unwrap();
            String::from_utf8_lossy(&lu).to_string()
        });
        (adresse, tache)
    }

    #[tokio::test]
    async fn elevenlabs_recoit_sa_cle_dans_l_en_tete_et_rend_le_wav() {
        let (adresse, requete) = serveur(200, b"RIFF....WAVE".to_vec(), "audio/wav").await;
        let son = synthetiser(&Adresses { elevenlabs: &adresse, mistral: "", gemini: "" }, Moteur::ElevenLabs, "cle-de-banc", ELEVENLABS_FEMME, "Bonjour").await.unwrap();
        assert_eq!(son, b"RIFF....WAVE");
        let vu = requete.await.unwrap().to_ascii_lowercase();
        assert!(vu.contains(&format!("post /{}?output_format=wav_24000", ELEVENLABS_FEMME.to_ascii_lowercase())));
        assert!(vu.contains("xi-api-key: cle-de-banc"));
    }

    #[tokio::test]
    async fn une_cle_refusee_se_dit_en_francais_sans_la_recopier() {
        let (adresse, _r) = serveur(401, b"{}".to_vec(), "application/json").await;
        let e = synthetiser(&Adresses { elevenlabs: "", mistral: "", gemini: &adresse }, Moteur::Gemini, "cle-secrete-de-banc", "Kore", "Bonjour").await.unwrap_err();
        assert!(e.contains("refusée") && e.contains("Vos connexions"), "{e}");
        assert!(!e.contains("cle-secrete"));
    }

    #[tokio::test]
    async fn gemini_rend_le_son_decode() {
        let corps = serde_json::to_vec(&json!({ "steps": [{ "type": "model_output", "content": [{ "type": "audio", "data": "UklGRg==" }] }] })).unwrap();
        let (adresse, requete) = serveur(200, corps, "application/json").await;
        let son = synthetiser(&Adresses { elevenlabs: "", mistral: "", gemini: &adresse }, Moteur::Gemini, "k-de-banc-gemini", "Kore", "Bonjour").await.unwrap();
        assert_eq!(son, b"RIFF");
        assert!(requete.await.unwrap().to_ascii_lowercase().contains("x-goog-api-key: k-de-banc-gemini"));
    }

    #[tokio::test]
    async fn mistral_recoit_sa_cle_en_porteur_et_rend_le_son_decode() {
        let corps = serde_json::to_vec(&json!({ "audio_data": "UklGRg==" })).unwrap();
        let (adresse, requete) = serveur(200, corps, "application/json").await;
        let son = synthetiser(&Adresses { elevenlabs: "", mistral: &adresse, gemini: "" }, Moteur::Mistral, "k-mistral-banc", MISTRAL_DEFAUT, "Bonjour").await.unwrap();
        assert_eq!(son, b"RIFF");
        let vu = requete.await.unwrap();
        assert!(vu.to_ascii_lowercase().contains("authorization: bearer k-mistral-banc"));
        assert!(vu.contains("\"response_format\":\"wav\""), "{vu}");
    }

    #[test]
    fn seuls_les_trois_moteurs_de_voix_se_rangent_ici() {
        assert!(moteur_nomme("openai").is_err());
        assert!(voix_api_ranger("elevenlabs".into(), "a b".into()).is_err());
    }
}
