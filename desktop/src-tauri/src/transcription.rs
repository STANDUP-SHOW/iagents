//! What the client says to an agent, transcribed by Gemini.
//!
//! Decided by max on 12/10/2026 after hearing the local transcription on his
//! PC (« horrible »): when the client saved a Google AI Studio key, the
//! sentence addressed to an agent is transcribed by Gemini, Whisper staying
//! the fallback when there is no key or no network. The same key already
//! speaks for the agents (`voix_api`), so one key covers both.
//!
//! What leaves the PC: **only a sentence addressed to an agent** — one that
//! opened on an agent's first name, or said in a conversation already open
//! with it. The room is never sent; Whisper hears it on the PC and decides.
//!
//! The model is not written here: Google renames its models faster than this
//! file would be updated, and a name that no longer exists answers 404 to
//! every sentence. It is read once from the key's own model list, the best
//! stable « flash » model that accepts `generateContent`.
//!
//! Request shape (`generateContent`, `inline_data` audio/wav) read in the
//! Gemini API reference; not yet sent with a real key from this repository.

use serde_json::{json, Value};

use crate::voix_api::{self, Moteur};

const ADRESSE: &str = "https://generativelanguage.googleapis.com/v1beta";

/// The model found for this key, once found.
static MODELE: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// Whether a sentence addressed to an agent will leave for Google.
pub fn en_ligne() -> bool {
    voix_api::cle(Moteur::Gemini).is_some()
}

/// The best model for a transcription among those the key lists: a « flash »
/// model that answers `generateContent`, not a speech, live, image or
/// embedding one; stable before preview, full before lite, newest first.
pub fn choisir_modele(liste: &Value) -> Option<String> {
    let exclus = ["tts", "live", "image", "embedding", "audio", "native", "thinking", "learnlm"];
    let mut candidats: Vec<(bool, bool, Vec<u32>, String)> = liste
        .get("models")?
        .as_array()?
        .iter()
        .filter(|m| {
            m.get("supportedGenerationMethods")
                .and_then(Value::as_array)
                .is_some_and(|a| a.iter().any(|x| x.as_str() == Some("generateContent")))
        })
        .filter_map(|m| m.get("name")?.as_str().map(str::to_string))
        .filter(|n| n.contains("gemini") && n.contains("flash") && !exclus.iter().any(|x| n.contains(x)))
        .map(|n| {
            let essai = n.contains("preview") || n.contains("exp");
            let leger = n.contains("lite");
            let version: Vec<u32> = n
                .trim_start_matches("models/gemini-")
                .split(['-', '.'])
                .map_while(|p| p.parse().ok())
                .collect();
            (essai, leger, version, n)
        })
        .collect();
    candidats.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)).then(b.2.cmp(&a.2)));
    candidats.into_iter().next().map(|c| c.3)
}

/// The instruction that goes with the sound. The hired agents' first names
/// are given, so « Victor » does not come back as « victoire ».
pub fn consigne(prenoms: &[String]) -> String {
    let mut c = String::from(
        "Transcris mot pour mot, en français, ce qui est dit dans cet enregistrement. \
         Rends uniquement les mots prononcés, avec la ponctuation, sans guillemets ni commentaire. \
         S'il n'y a aucune parole, rends un texte vide.",
    );
    if !prenoms.is_empty() {
        c.push_str(&format!(" La personne s'adresse peut-être à l'un de ces assistants : {}.", prenoms.join(", ")));
    }
    c
}

/// 16 kHz mono samples as a WAV file.
pub fn wav(echantillons: &[f32]) -> Vec<u8> {
    let spec = hound::WavSpec { channels: 1, sample_rate: 16_000, bits_per_sample: 16, sample_format: hound::SampleFormat::Int };
    let mut sortie = std::io::Cursor::new(Vec::new());
    {
        let mut w = hound::WavWriter::new(&mut sortie, spec).expect("WAV en mémoire");
        for e in echantillons {
            w.write_sample((e.clamp(-1.0, 1.0) * i16::MAX as f32) as i16).expect("WAV en mémoire");
        }
        w.finalize().expect("WAV en mémoire");
    }
    sortie.into_inner()
}

pub fn corps(echantillons: &[f32], prenoms: &[String]) -> Value {
    use base64::Engine;
    json!({
        "contents": [{ "role": "user", "parts": [
            { "text": consigne(prenoms) },
            { "inline_data": { "mime_type": "audio/wav", "data": base64::engine::general_purpose::STANDARD.encode(wav(echantillons)) } }
        ]}],
        "generationConfig": { "temperature": 0 }
    })
}

/// The text of the answer, all parts joined.
pub fn texte_de(reponse: &Value) -> Option<String> {
    let parts = reponse.get("candidates")?.get(0)?.get("content")?.get("parts")?.as_array()?;
    let t: String = parts.iter().filter_map(|p| p.get("text")?.as_str()).collect();
    Some(t.trim().trim_matches(['"', '«', '»']).trim().to_string())
}

/// Transcribes with the client's key. `Err` says why in French, never with
/// the key in it.
pub async fn transcrire(echantillons: &[f32], prenoms: &[String]) -> Result<String, String> {
    let cle = voix_api::cle(Moteur::Gemini).ok_or("aucune clé Google AI Studio n'est rangée")?;
    transcrire_avec(ADRESSE, &cle, echantillons, prenoms).await
}

pub async fn transcrire_avec(adresse: &str, cle: &str, echantillons: &[f32], prenoms: &[String]) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|_| "le réseau du poste n'a pas pu être préparé".to_string())?;
    let hors_ligne = |_| "Google ne répond pas : pas de réseau, ou trop lent".to_string();

    let deja = MODELE.lock().unwrap().clone();
    let modele = match deja {
        Some(m) => m,
        None => {
            let r = client
                .get(format!("{}/models?pageSize=1000", adresse))
                .header("x-goog-api-key", cle)
                .send()
                .await
                .map_err(hors_ligne)?;
            let statut = r.status();
            let corps_r = r.text().await.unwrap_or_default();
            if !statut.is_success() {
                return Err(voix_api::refus(Moteur::Gemini, statut, &corps_r));
            }
            let liste: Value = serde_json::from_str(&corps_r).unwrap_or(Value::Null);
            let m = choisir_modele(&liste).ok_or("cette clé Google ne donne accès à aucun modèle capable de transcrire")?;
            *MODELE.lock().unwrap() = Some(m.clone());
            m
        }
    };

    let r = client
        .post(format!("{}/{}:generateContent", adresse, modele))
        .header("x-goog-api-key", cle)
        .json(&corps(echantillons, prenoms))
        .send()
        .await
        .map_err(hors_ligne)?;
    let statut = r.status();
    let corps_r = r.text().await.unwrap_or_default();
    if !statut.is_success() {
        if statut.as_u16() == 404 {
            // The model went away: look again next time.
            *MODELE.lock().unwrap() = None;
        }
        return Err(voix_api::refus(Moteur::Gemini, statut, &corps_r));
    }
    let reponse: Value = serde_json::from_str(&corps_r).unwrap_or(Value::Null);
    texte_de(&reponse).ok_or_else(|| "Gemini n'a rendu aucun texte".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    /// The model cache is shared: the network benches take turns.
    static TOUR: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

    #[test]
    fn le_modele_retenu_est_un_flash_stable_recent_qui_sait_transcrire() {
        let liste = json!({ "models": [
            { "name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"] },
            { "name": "models/gemini-3.1-flash", "supportedGenerationMethods": ["generateContent", "countTokens"] },
            { "name": "models/gemini-3.8-flash-tts", "supportedGenerationMethods": ["generateContent"] },
            { "name": "models/gemini-3.8-flash-live", "supportedGenerationMethods": ["bidiGenerateContent"] },
            { "name": "models/gemini-3.5-flash-preview", "supportedGenerationMethods": ["generateContent"] },
            { "name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"] },
            { "name": "models/gemini-3.5-pro", "supportedGenerationMethods": ["generateContent"] },
            { "name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"] }
        ]});
        assert_eq!(choisir_modele(&liste).as_deref(), Some("models/gemini-3.1-flash"));
        // Better a lite or preview model than nothing.
        let maigre = json!({ "models": [
            { "name": "models/gemini-3.5-flash-lite-preview", "supportedGenerationMethods": ["generateContent"] }
        ]});
        assert_eq!(choisir_modele(&maigre).as_deref(), Some("models/gemini-3.5-flash-lite-preview"));
        assert_eq!(choisir_modele(&json!({ "models": [] })), None);
    }

    #[test]
    fn le_son_part_en_wav_16_khz_avec_les_prenoms_dans_la_consigne() {
        let c = corps(&[0.0; 1600], &["Victor".into(), "Hugo".into()]);
        let parts = &c["contents"][0]["parts"];
        assert!(parts[0]["text"].as_str().unwrap().contains("Victor, Hugo"));
        assert_eq!(parts[1]["inline_data"]["mime_type"], "audio/wav");
        use base64::Engine;
        let son = base64::engine::general_purpose::STANDARD.decode(parts[1]["inline_data"]["data"].as_str().unwrap()).unwrap();
        let w = hound::WavReader::new(std::io::Cursor::new(son)).unwrap();
        assert_eq!((w.spec().sample_rate, w.spec().channels, w.len()), (16_000, 1, 1600));
    }

    #[test]
    fn le_texte_rendu_est_debarrasse_de_ses_guillemets() {
        let r = json!({ "candidates": [{ "content": { "parts": [{ "text": "« Victor, bonjour ! »\n" }] } }] });
        assert_eq!(texte_de(&r).as_deref(), Some("Victor, bonjour !"));
        assert_eq!(texte_de(&json!({})), None);
    }

    /// Answers each connection in turn with the next (status, body).
    async fn serveur(reponses: Vec<(u16, String)>) -> (String, tokio::task::JoinHandle<Vec<String>>) {
        let ecoute = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let adresse = format!("http://{}", ecoute.local_addr().unwrap());
        let tache = tokio::spawn(async move {
            let mut vus = Vec::new();
            for (statut, corps) in reponses {
                let (mut s, _) = ecoute.accept().await.unwrap();
                let mut lu = Vec::new();
                let mut tampon = [0u8; 65536];
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
                    "HTTP/1.1 {} X\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
                    statut,
                    corps.len()
                );
                s.write_all(entete.as_bytes()).await.unwrap();
                s.write_all(corps.as_bytes()).await.unwrap();
                vus.push(String::from_utf8_lossy(&lu).to_string());
            }
            vus
        });
        (adresse, tache)
    }

    #[tokio::test]
    async fn la_phrase_part_au_modele_lu_dans_la_liste_avec_la_cle_en_en_tete() {
        let _tour = TOUR.lock().await;
        *MODELE.lock().unwrap() = None;
        let liste = json!({ "models": [{ "name": "models/gemini-3.1-flash", "supportedGenerationMethods": ["generateContent"] }] });
        let reponse = json!({ "candidates": [{ "content": { "parts": [{ "text": "Victor, qu'as-tu fait aujourd'hui ?" }] } }] });
        let (adresse, requetes) = serveur(vec![(200, liste.to_string()), (200, reponse.to_string())]).await;
        let texte = transcrire_avec(&adresse, "cle-de-banc", &[0.0; 16000], &["Victor".into()]).await.unwrap();
        assert_eq!(texte, "Victor, qu'as-tu fait aujourd'hui ?");
        let vus = requetes.await.unwrap();
        assert!(vus[0].starts_with("GET /models?pageSize=1000"));
        assert!(vus[1].starts_with("POST /models/gemini-3.1-flash:generateContent"));
        for v in &vus {
            assert!(v.to_ascii_lowercase().contains("x-goog-api-key: cle-de-banc"));
            // The key travels in a header, never in the address.
            assert!(!v.lines().next().unwrap().contains("cle-de-banc"));
        }
        *MODELE.lock().unwrap() = None;
    }

    #[tokio::test]
    async fn une_cle_refusee_se_dit_en_francais_sans_la_recopier() {
        let _tour = TOUR.lock().await;
        *MODELE.lock().unwrap() = None;
        let (adresse, _) = serveur(vec![(400, r#"{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}"#.into())]).await;
        let e = transcrire_avec(&adresse, "cle-secrete", &[0.0; 16000], &[]).await.unwrap_err();
        assert!(e.contains("refusée"), "{e}");
        assert!(!e.contains("cle-secrete"));
    }
}
