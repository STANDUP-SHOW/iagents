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
//! - **Google Cloud Text-to-Speech** (Chirp 3 HD, 12/10/2026): the spare
//!   voice. Another Google service than Gemini (Cloud console, its own key and
//!   bill). Its Chirp 3 HD voices carry the same names as Gemini's (Kore,
//!   Charon…), so an agent keeps the same voice when it takes over. Request
//!   shape read in the REST reference (`v1/text:synthesize`) on 12/10/2026;
//!   an invalid key answers 400 `API_KEY_INVALID`, seen on the real endpoint.
//!
//! Every engine with a key is tried in turn: the client's preferred one first
//! (`config/voix-api.json`), then the order of `ORDRE`. The first that answers
//! speaks; the reasons of those that failed are said, never swallowed.
//!
//! Keys live in the system keychain under `iagent-api`, accounts
//! `elevenlabs`, `mistral`, `google-ai-studio` and `google-text-to-speech` — the same entries as the AI engines
//! screen, so a key saved there is used here. They never come back to the
//! screen. All four engines return WAV, which `voice::jouer_wav` already plays.
//!
//! Nothing here was heard on a real machine yet: the request shapes were read
//! in each vendor's API reference on 06/10/2026.

use serde_json::{json, Value};

const SERVICE_TROUSSEAU: &str = "iagent-api";
pub const COMPTE_ELEVENLABS: &str = "elevenlabs";
pub const COMPTE_GEMINI: &str = "google-ai-studio";
pub const COMPTE_MISTRAL: &str = "mistral";
pub const COMPTE_GOOGLE_TTS: &str = "google-text-to-speech";

const ADRESSE_ELEVENLABS: &str = "https://api.elevenlabs.io/v1/text-to-speech";
const MODELE_ELEVENLABS: &str = "eleven_v4";
const ADRESSE_GEMINI: &str = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODELE_GEMINI: &str = "gemini-3.8-flash-tts";
const ADRESSE_GOOGLE_TTS: &str = "https://texttospeech.googleapis.com/v1/text:synthesize";
/// Chirp 3 HD voice names are `<locale>-Chirp3-HD-<voice>`.
const PREFIXE_GOOGLE_TTS: &str = "fr-FR-Chirp3-HD-";
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
    GoogleTts,
}

/// The order engines are tried in when the client prefers none.
pub const ORDRE: [Moteur; 4] = [Moteur::ElevenLabs, Moteur::Mistral, Moteur::Gemini, Moteur::GoogleTts];

impl Moteur {
    pub fn compte(self) -> &'static str {
        match self {
            Moteur::ElevenLabs => COMPTE_ELEVENLABS,
            Moteur::Mistral => COMPTE_MISTRAL,
            Moteur::Gemini => COMPTE_GEMINI,
            Moteur::GoogleTts => COMPTE_GOOGLE_TTS,
        }
    }
    pub fn nom(self) -> &'static str {
        match self {
            Moteur::ElevenLabs => "ElevenLabs",
            Moteur::Mistral => "Mistral",
            Moteur::Gemini => "Gemini",
            Moteur::GoogleTts => "Google Text-to-Speech",
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

/// Which engines speak, in the order they are tried, from which keys are
/// saved. ElevenLabs first: it is the dearer one, so a client who saved its
/// key asked for it. Then Mistral, French and European, then Gemini, then
/// Google Text-to-Speech, the spare. An engine the client prefers goes first,
/// but only if its key is saved: a preference never speaks without a key.
pub fn moteurs_retenus(avec_cle: &[Moteur], prefere: Option<Moteur>) -> Vec<Moteur> {
    let mut ordre: Vec<Moteur> = ORDRE.iter().copied().filter(|m| avec_cle.contains(m)).collect();
    if let Some(p) = prefere.filter(|p| ordre.contains(p)) {
        ordre.retain(|m| *m != p);
        ordre.insert(0, p);
    }
    ordre
}

fn fichier_preference() -> std::path::PathBuf {
    crate::chemins::pour_ecrire("config/voix-api.json")
}

/// The engine the client asked to hear first, if any.
fn moteur_prefere() -> Option<Moteur> {
    let texte = std::fs::read_to_string(fichier_preference()).ok()?;
    let v: Value = serde_json::from_str(&texte).ok()?;
    moteur_nomme(v.get("prefere")?.as_str()?).ok()
}

/// The engines with a saved key, in the order they are tried, with their key.
pub fn moteurs_du_poste() -> Vec<(Moteur, String)> {
    let cles: Vec<(Moteur, String)> = ORDRE.iter().filter_map(|m| cle(*m).map(|k| (*m, k))).collect();
    let avec_cle: Vec<Moteur> = cles.iter().map(|(m, _)| *m).collect();
    moteurs_retenus(&avec_cle, moteur_prefere())
        .into_iter()
        .filter_map(|m| cles.iter().find(|(n, _)| *n == m).cloned())
        .collect()
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

/// The gender of a common, unambiguous first name, from the table the screen
/// reads too (`src/config/prenoms.json`), so the face and the voice agree.
/// Mixed or unknown names give nothing. Only the first word counts.
pub fn sexe_du_prenom(prenom: &str) -> Option<&'static str> {
    static TABLE: std::sync::OnceLock<(Vec<String>, Vec<String>)> = std::sync::OnceLock::new();
    let (hommes, femmes) = TABLE.get_or_init(|| {
        let v: Value = serde_json::from_str(include_str!("../../src/config/prenoms.json"))
            .expect("prenoms.json is valid JSON");
        let liste = |k: &str| -> Vec<String> {
            v[k].as_array()
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                .unwrap_or_default()
        };
        (liste("homme"), liste("femme"))
    });
    let premier: String = prenom
        .split(|c: char| c.is_whitespace() || c == '-')
        .find(|m| !m.is_empty())?
        .chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'à' | 'â' | 'ä' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'î' | 'ï' => 'i',
            'ô' | 'ö' => 'o',
            'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            c => c,
        })
        .collect();
    if hommes.contains(&premier) {
        Some("homme")
    } else if femmes.contains(&premier) {
        Some("femme")
    } else {
        None
    }
}

/// The voice an agent speaks with on this engine. A voice the client chose
/// wins when it belongs to the engine; otherwise the gender the hiring gave;
/// otherwise the gender of the first name when it is unambiguous — a Victor
/// spoke with a woman's voice until 11/10/2026 because nothing was saved for
/// him; otherwise a voice tied to the first name.
pub fn voix_de(moteur: Moteur, prenom: &str, voix: Option<&str>, sexe: Option<&str>) -> String {
    let sexe = sexe.or_else(|| sexe_du_prenom(prenom));
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
        // Same voices as Gemini under their Cloud name: an agent that falls
        // back from Gemini keeps its voice.
        Moteur::GoogleTts => {
            let nom = voix.map(|v| v.strip_prefix(PREFIXE_GOOGLE_TTS).unwrap_or(v));
            format!("{}{}", PREFIXE_GOOGLE_TTS, voix_de(Moteur::Gemini, prenom, nom, sexe))
        }
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

pub fn corps_google_tts(texte: &str, voix: &str) -> Value {
    json!({
        "input": { "text": texte },
        "voice": { "languageCode": "fr-FR", "name": voix },
        "audioConfig": { "audioEncoding": "LINEAR16" }
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

/// Why the engine said no, in French. `corps` is the error body: Google
/// answers a wrong key with 400 `API_KEY_INVALID`, not 401, and a Cloud API
/// left off with 403 `SERVICE_DISABLED`. The body is read, never repeated.
fn refus(moteur: Moteur, statut: reqwest::StatusCode, corps: &str) -> String {
    if corps.contains("API_KEY_INVALID") {
        return format!("la clé {} est refusée : vérifiez-la dans « Vos connexions »", moteur.nom());
    }
    if corps.contains("SERVICE_DISABLED") || corps.contains("has not been used in project") {
        return format!(
            "{} n'est pas activé sur le projet Google de cette clé : activez « Cloud Text-to-Speech API » dans console.cloud.google.com",
            moteur.nom()
        );
    }
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
    pub google_tts: &'a str,
}

pub const ADRESSES: Adresses<'static> = Adresses {
    elevenlabs: ADRESSE_ELEVENLABS,
    mistral: ADRESSE_MISTRAL,
    gemini: ADRESSE_GEMINI,
    google_tts: ADRESSE_GOOGLE_TTS,
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
                let statut = r.status();
                return Err(refus(moteur, statut, &r.text().await.unwrap_or_default()));
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
                let statut = r.status();
                return Err(refus(moteur, statut, &r.text().await.unwrap_or_default()));
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
                let statut = r.status();
                return Err(refus(moteur, statut, &r.text().await.unwrap_or_default()));
            }
            let v: Value = r.json().await.map_err(|_| "Gemini a rendu une réponse illisible".to_string())?;
            audio_de_gemini(&v).ok_or_else(|| "Gemini n'a rendu aucun son".to_string())
        }
        Moteur::GoogleTts => {
            let r = client
                .post(adresses.google_tts)
                .header("x-goog-api-key", cle)
                .json(&corps_google_tts(texte, voix))
                .send()
                .await
                .map_err(injoignable)?;
            if !r.status().is_success() {
                let statut = r.status();
                return Err(refus(moteur, statut, &r.text().await.unwrap_or_default()));
            }
            let v: Value = r
                .json()
                .await
                .map_err(|_| "Google Text-to-Speech a rendu une réponse illisible".to_string())?;
            // LINEAR16 comes with its WAV header, per the REST reference.
            v.get("audioContent")
                .and_then(Value::as_str)
                .and_then(decoder)
                .filter(|son| son.starts_with(b"RIFF"))
                .ok_or_else(|| "Google Text-to-Speech n'a rendu aucun son".to_string())
        }
    }
}

/// What an API voice gave: the sound, who spoke, and why the engines tried
/// before it did not.
pub struct Parole {
    pub wav: Vec<u8>,
    pub moteur: Moteur,
    pub echecs: Vec<String>,
}

/// Tries each engine in turn until one speaks. All failures are kept, in
/// order, so the caller can say why the voice changed.
pub async fn parler_avec(
    adresses: &Adresses<'_>,
    moteurs: &[(Moteur, String)],
    prenom: &str,
    voix: Option<&str>,
    sexe: Option<&str>,
    texte: &str,
) -> Option<Result<Parole, String>> {
    if moteurs.is_empty() {
        return None;
    }
    let mut echecs = Vec::new();
    for (moteur, cle) in moteurs {
        let v = voix_de(*moteur, prenom, voix, sexe);
        match synthetiser(adresses, *moteur, cle, &v, texte).await {
            Ok(wav) => return Some(Ok(Parole { wav, moteur: *moteur, echecs })),
            Err(e) => echecs.push(e),
        }
    }
    Some(Err(echecs.join(" ; ")))
}

/// The voice of `prenom` through the client's APIs, as WAV bytes; `None` when
/// no voice key is saved (the caller then speaks locally).
pub async fn parler(prenom: Option<&str>, texte: &str) -> Option<Result<Parole, String>> {
    let moteurs = moteurs_du_poste();
    if moteurs.is_empty() {
        return None;
    }
    let installation: Value = crate::fiches::lire_installation()
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or(Value::Null);
    let prenom = prenom.unwrap_or("");
    let (voix, sexe) = agent_de(&installation, prenom);
    parler_avec(&ADRESSES, &moteurs, prenom, voix.as_deref(), sexe.as_deref(), texte).await
}

// ---------------------------------------------------------------------------
// The keys, from the voice screen
// ---------------------------------------------------------------------------

fn moteur_nomme(compte: &str) -> Result<Moteur, String> {
    match compte {
        COMPTE_ELEVENLABS => Ok(Moteur::ElevenLabs),
        COMPTE_MISTRAL => Ok(Moteur::Mistral),
        COMPTE_GEMINI => Ok(Moteur::Gemini),
        COMPTE_GOOGLE_TTS => Ok(Moteur::GoogleTts),
        _ => Err("ce service ne fait pas parler les agents".to_string()),
    }
}

#[derive(serde::Serialize)]
pub struct EtatVoixApi {
    pub elevenlabs: bool,
    pub mistral: bool,
    pub gemini: bool,
    pub google_tts: bool,
    /// The account of the engine the client asked to hear first, if any.
    pub prefere: Option<String>,
    /// The engine that will speak, in words.
    pub parle: String,
}

/// The engines in the order they are tried, said to the client.
pub fn phrase_de_l_ordre(ordre: &[Moteur]) -> String {
    match ordre {
        [] => "Vos agents parlent avec la voix installée sur ce poste.".to_string(),
        [seul] => format!(
            "Vos agents parlent avec {}. S'il ne répond pas, ils reprennent la voix du poste.",
            seul.nom()
        ),
        [premier, reste @ ..] => format!(
            "Vos agents parlent avec {}. S'il ne répond pas, {} prend le relais, puis la voix du poste.",
            premier.nom(),
            reste.iter().map(|m| m.nom()).collect::<Vec<_>>().join(", puis ")
        ),
    }
}

#[tauri::command]
pub fn voix_api_etat() -> EtatVoixApi {
    let avec_cle: Vec<Moteur> = ORDRE.iter().copied().filter(|m| cle(*m).is_some()).collect();
    let prefere = moteur_prefere();
    let ordre = moteurs_retenus(&avec_cle, prefere);
    EtatVoixApi {
        elevenlabs: avec_cle.contains(&Moteur::ElevenLabs),
        mistral: avec_cle.contains(&Moteur::Mistral),
        gemini: avec_cle.contains(&Moteur::Gemini),
        google_tts: avec_cle.contains(&Moteur::GoogleTts),
        prefere: prefere.filter(|p| avec_cle.contains(p)).map(|p| p.compte().to_string()),
        parle: phrase_de_l_ordre(&ordre),
    }
}

/// The client chooses which voice speaks first; `None` goes back to the
/// usual order. Only a voice engine can be named.
#[tauri::command]
pub fn voix_api_preferer(compte: Option<String>) -> Result<String, String> {
    let chemin = fichier_preference();
    match compte {
        None => {
            match std::fs::remove_file(&chemin) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(format!("retrait du choix de voix : {}", e)),
            }
            Ok("Vos agents reprennent l'ordre habituel des voix.".to_string())
        }
        Some(c) => {
            let moteur = moteur_nomme(&c)?;
            if cle(moteur).is_none() {
                return Err(format!("rangez d'abord la clé {} : sans elle, cette voix ne peut pas parler", moteur.nom()));
            }
            crate::chemins::preparer(&chemin)?;
            std::fs::write(&chemin, json!({ "prefere": moteur.compte() }).to_string())
                .map_err(|e| format!("enregistrement du choix de voix : {}", e))?;
            Ok(format!("Vos agents parlent d'abord avec {}.", moteur.nom()))
        }
    }
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
        use Moteur::*;
        assert_eq!(moteurs_retenus(&[GoogleTts, Gemini, Mistral, ElevenLabs], None), vec![ElevenLabs, Mistral, Gemini, GoogleTts]);
        assert_eq!(moteurs_retenus(&[Mistral, Gemini], None), vec![Mistral, Gemini]);
        assert_eq!(moteurs_retenus(&[Gemini], None), vec![Gemini]);
        assert_eq!(moteurs_retenus(&[], None), vec![]);
    }

    #[test]
    fn google_tts_prend_le_relais_de_gemini_et_passe_devant_si_le_client_le_choisit() {
        use Moteur::*;
        // Gemini speaks, Google Text-to-Speech is the spare: the default stays.
        assert_eq!(moteurs_retenus(&[Gemini, GoogleTts], None), vec![Gemini, GoogleTts]);
        // Alone, it speaks.
        assert_eq!(moteurs_retenus(&[GoogleTts], None), vec![GoogleTts]);
        // Chosen by the client, it goes first and Gemini becomes the spare.
        assert_eq!(moteurs_retenus(&[Gemini, GoogleTts], Some(GoogleTts)), vec![GoogleTts, Gemini]);
        // A preference without its key changes nothing and speaks with nothing.
        assert_eq!(moteurs_retenus(&[Gemini], Some(GoogleTts)), vec![Gemini]);
        assert_eq!(moteur_nomme(COMPTE_GOOGLE_TTS), Ok(GoogleTts));
    }

    #[test]
    fn l_ordre_se_dit_au_client() {
        use Moteur::*;
        assert_eq!(phrase_de_l_ordre(&[]), "Vos agents parlent avec la voix installée sur ce poste.");
        let p = phrase_de_l_ordre(&[Gemini, GoogleTts]);
        assert!(p.starts_with("Vos agents parlent avec Gemini.") && p.contains("Google Text-to-Speech prend le relais"), "{p}");
    }

    #[test]
    fn google_tts_garde_la_voix_de_gemini_et_le_genre_de_l_agent() {
        for prenom in ["Victor", "Hugo", "Paul", "Louis", "Malik", "Adam", "Jean-Marc"] {
            let v = voix_de(Moteur::GoogleTts, prenom, None, None);
            let nom = v.strip_prefix(PREFIXE_GOOGLE_TTS).expect(&v);
            assert!(GEMINI_HOMMES.contains(&nom), "{prenom} : {v}");
            assert_eq!(nom, voix_de(Moteur::Gemini, prenom, None, None), "{prenom}");
        }
        for prenom in ["Léa", "Sarah", "Nora", "Inès", "Jeanne", "Clara", "Marie Claire"] {
            let v = voix_de(Moteur::GoogleTts, prenom, None, None);
            assert!(GEMINI_FEMMES.contains(&v.strip_prefix(PREFIXE_GOOGLE_TTS).unwrap()), "{prenom} : {v}");
        }
        // The gender the hiring saved wins over the name.
        let v = voix_de(Moteur::GoogleTts, "Victor", None, Some("femme"));
        assert!(GEMINI_FEMMES.contains(&v.strip_prefix(PREFIXE_GOOGLE_TTS).unwrap()), "{v}");
        // A Gemini voice the client chose is kept, under its Cloud name.
        assert_eq!(voix_de(Moteur::GoogleTts, "Léa", Some("aoede"), None), "fr-FR-Chirp3-HD-Aoede");
        assert_eq!(voix_de(Moteur::GoogleTts, "Léa", Some("fr-FR-Chirp3-HD-Leda"), None), "fr-FR-Chirp3-HD-Leda");
        // A voice of another engine is not sent.
        assert!(voix_de(Moteur::GoogleTts, "Hugo", Some("ZQe5CZNOzWyzChESwQEW"), None).starts_with(PREFIXE_GOOGLE_TTS));
        let c = corps_google_tts("Bonjour Max.", "fr-FR-Chirp3-HD-Charon");
        assert_eq!(c["input"]["text"], "Bonjour Max.");
        assert_eq!(c["voice"]["languageCode"], "fr-FR");
        assert_eq!(c["voice"]["name"], "fr-FR-Chirp3-HD-Charon");
        assert_eq!(c["audioConfig"]["audioEncoding"], "LINEAR16");
    }

    #[test]
    fn la_voix_choisie_gagne_puis_le_genre_puis_le_prenom() {
        // A voice of the other engine is ignored rather than sent.
        assert_eq!(voix_de(Moteur::Gemini, "Léa", Some("Aoede"), None), "Aoede");
        assert_eq!(voix_de(Moteur::ElevenLabs, "Léa", Some("Aoede"), Some("femme")), ELEVENLABS_FEMME);
        // Nothing saved for the agent: the name decides, as on max's PC.
        for prenom in ["Victor", "Hugo", "Paul", "Louis", "Malik", "Adam", "Jean-Marc"] {
            assert!(GEMINI_HOMMES.contains(&voix_de(Moteur::Gemini, prenom, None, None).as_str()), "{prenom}");
            assert_eq!(voix_de(Moteur::ElevenLabs, prenom, None, None), ELEVENLABS_HOMME, "{prenom}");
        }
        for prenom in ["Léa", "Sarah", "Nora", "Inès", "Jeanne", "Clara", "Marie Claire"] {
            assert!(GEMINI_FEMMES.contains(&voix_de(Moteur::Gemini, prenom, None, None).as_str()), "{prenom}");
        }
        assert_eq!(sexe_du_prenom("Camille"), None);
        // A gender the client chose wins over the name.
        assert!(GEMINI_FEMMES.contains(&voix_de(Moteur::Gemini, "Victor", None, Some("femme")).as_str()));
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
        let son = synthetiser(&Adresses { elevenlabs: &adresse, mistral: "", gemini: "", google_tts: "" }, Moteur::ElevenLabs, "cle-de-banc", ELEVENLABS_FEMME, "Bonjour").await.unwrap();
        assert_eq!(son, b"RIFF....WAVE");
        let vu = requete.await.unwrap().to_ascii_lowercase();
        assert!(vu.contains(&format!("post /{}?output_format=wav_24000", ELEVENLABS_FEMME.to_ascii_lowercase())));
        assert!(vu.contains("xi-api-key: cle-de-banc"));
    }

    #[tokio::test]
    async fn une_cle_refusee_se_dit_en_francais_sans_la_recopier() {
        let (adresse, _r) = serveur(401, b"{}".to_vec(), "application/json").await;
        let e = synthetiser(&Adresses { elevenlabs: "", mistral: "", gemini: &adresse, google_tts: "" }, Moteur::Gemini, "cle-secrete-de-banc", "Kore", "Bonjour").await.unwrap_err();
        assert!(e.contains("refusée") && e.contains("Vos connexions"), "{e}");
        assert!(!e.contains("cle-secrete"));
    }

    #[tokio::test]
    async fn gemini_rend_le_son_decode() {
        let corps = serde_json::to_vec(&json!({ "steps": [{ "type": "model_output", "content": [{ "type": "audio", "data": "UklGRg==" }] }] })).unwrap();
        let (adresse, requete) = serveur(200, corps, "application/json").await;
        let son = synthetiser(&Adresses { elevenlabs: "", mistral: "", gemini: &adresse, google_tts: "" }, Moteur::Gemini, "k-de-banc-gemini", "Kore", "Bonjour").await.unwrap();
        assert_eq!(son, b"RIFF");
        assert!(requete.await.unwrap().to_ascii_lowercase().contains("x-goog-api-key: k-de-banc-gemini"));
    }

    #[tokio::test]
    async fn mistral_recoit_sa_cle_en_porteur_et_rend_le_son_decode() {
        let corps = serde_json::to_vec(&json!({ "audio_data": "UklGRg==" })).unwrap();
        let (adresse, requete) = serveur(200, corps, "application/json").await;
        let son = synthetiser(&Adresses { elevenlabs: "", mistral: &adresse, gemini: "", google_tts: "" }, Moteur::Mistral, "k-mistral-banc", MISTRAL_DEFAUT, "Bonjour").await.unwrap();
        assert_eq!(son, b"RIFF");
        let vu = requete.await.unwrap();
        assert!(vu.to_ascii_lowercase().contains("authorization: bearer k-mistral-banc"));
        assert!(vu.contains("\"response_format\":\"wav\""), "{vu}");
    }

    #[tokio::test]
    async fn google_tts_recoit_sa_cle_dans_l_en_tete_et_rend_le_wav() {
        let corps = serde_json::to_vec(&json!({ "audioContent": "UklGRiQAAABXQVZF" })).unwrap();
        let (adresse, requete) = serveur(200, corps, "application/json").await;
        let a = Adresses { elevenlabs: "", mistral: "", gemini: "", google_tts: &adresse };
        let son = synthetiser(&a, Moteur::GoogleTts, "k-de-banc-tts", "fr-FR-Chirp3-HD-Charon", "Bonjour").await.unwrap();
        assert!(son.starts_with(b"RIFF") && son.ends_with(b"WAVE"));
        let vu = requete.await.unwrap();
        assert!(vu.to_ascii_lowercase().contains("x-goog-api-key: k-de-banc-tts"));
        assert!(vu.contains("fr-FR-Chirp3-HD-Charon") && vu.contains("LINEAR16"), "{vu}");
    }

    #[tokio::test]
    async fn google_tts_sans_son_ne_se_dit_pas_reussi() {
        let corps = serde_json::to_vec(&json!({ "audioContent": "" })).unwrap();
        let (adresse, _r) = serveur(200, corps, "application/json").await;
        let a = Adresses { elevenlabs: "", mistral: "", gemini: "", google_tts: &adresse };
        let e = synthetiser(&a, Moteur::GoogleTts, "k", "fr-FR-Chirp3-HD-Kore", "Bonjour").await.unwrap_err();
        assert_eq!(e, "Google Text-to-Speech n'a rendu aucun son");
    }

    #[tokio::test]
    async fn une_cle_google_invalide_rend_400_et_se_dit_refusee() {
        // The real endpoint answers a wrong key this way (seen on 12/10/2026).
        let corps = br#"{"error":{"code":400,"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}"#.to_vec();
        let (adresse, _r) = serveur(400, corps, "application/json").await;
        let a = Adresses { elevenlabs: "", mistral: "", gemini: "", google_tts: &adresse };
        let e = synthetiser(&a, Moteur::GoogleTts, "cle-secrete-tts", "fr-FR-Chirp3-HD-Kore", "Bonjour").await.unwrap_err();
        assert!(e.contains("Google Text-to-Speech est refusée") && e.contains("Vos connexions"), "{e}");
        assert!(!e.contains("cle-secrete") && !e.contains("API_KEY_INVALID"));
    }

    #[tokio::test]
    async fn une_api_google_non_activee_dit_quoi_faire() {
        let corps = br#"{"error":{"code":403,"status":"PERMISSION_DENIED","details":[{"reason":"SERVICE_DISABLED"}]}}"#.to_vec();
        let (adresse, _r) = serveur(403, corps, "application/json").await;
        let a = Adresses { elevenlabs: "", mistral: "", gemini: "", google_tts: &adresse };
        let e = synthetiser(&a, Moteur::GoogleTts, "k", "fr-FR-Chirp3-HD-Kore", "Bonjour").await.unwrap_err();
        assert!(e.contains("Cloud Text-to-Speech API") && e.contains("console.cloud.google.com"), "{e}");
    }

    #[tokio::test]
    async fn quand_gemini_echoue_google_tts_parle_avec_la_meme_voix_et_l_echec_reste_dit() {
        let (gemini, _g) = serveur(429, b"{}".to_vec(), "application/json").await;
        let corps = serde_json::to_vec(&json!({ "audioContent": "UklGRiQAAABXQVZF" })).unwrap();
        let (tts, requete) = serveur(200, corps, "application/json").await;
        let a = Adresses { elevenlabs: "", mistral: "", gemini: &gemini, google_tts: &tts };
        let moteurs = vec![(Moteur::Gemini, "k-gemini".to_string()), (Moteur::GoogleTts, "k-tts".to_string())];
        let p = parler_avec(&a, &moteurs, "Victor", None, None, "Bonjour").await.unwrap().unwrap();
        assert_eq!(p.moteur, Moteur::GoogleTts);
        assert_eq!(p.echecs.len(), 1);
        assert!(p.echecs[0].starts_with("Gemini refuse"), "{:?}", p.echecs);
        let attendu = format!("{}{}", PREFIXE_GOOGLE_TTS, voix_de(Moteur::Gemini, "Victor", None, None));
        assert!(requete.await.unwrap().contains(&attendu));
    }

    #[tokio::test]
    async fn quand_toutes_les_voix_echouent_chaque_raison_est_dite() {
        let (gemini, _g) = serveur(500, b"{}".to_vec(), "application/json").await;
        let (tts, _t) = serveur(403, br#"{"details":[{"reason":"SERVICE_DISABLED"}]}"#.to_vec(), "application/json").await;
        let a = Adresses { elevenlabs: "", mistral: "", gemini: &gemini, google_tts: &tts };
        let moteurs = vec![(Moteur::Gemini, "k".to_string()), (Moteur::GoogleTts, "k".to_string())];
        let e = parler_avec(&a, &moteurs, "Léa", None, None, "Bonjour").await.unwrap().err().unwrap();
        assert!(e.contains("Gemini n'a pas su") && e.contains("Google Text-to-Speech n'est pas activé"), "{e}");
        assert!(parler_avec(&a, &[], "Léa", None, None, "Bonjour").await.is_none());
    }

    #[test]
    fn seuls_les_quatre_moteurs_de_voix_se_rangent_ici() {
        assert!(moteur_nomme("openai").is_err());
        assert!(voix_api_ranger("elevenlabs".into(), "a b".into()).is_err());
    }
}
