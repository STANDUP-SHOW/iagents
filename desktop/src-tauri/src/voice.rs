use std::error::Error;
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Whisper travaille en 16 kHz mono : tout ce qui entre est ramené à ce taux.
const TAUX_WHISPER: u32 = 16_000;

pub struct VoiceState {
    contexte: Arc<WhisperContext>,
    /// Audio capté depuis le dernier vidage, déjà ramené en 16 kHz mono.
    tampon: Arc<Mutex<Vec<f32>>>,
    pub is_listening: Arc<Mutex<bool>>,
    pub audio_stream: Arc<Mutex<Option<Stream>>>,
}

// Le flux cpal n'est pas Send ; il ne sort jamais du mutex qui le détient et
// n'est manipulé que depuis les commandes de l'application.
unsafe impl Send for VoiceState {}

impl VoiceState {
    pub fn new(chemin_modele: &str) -> Result<Self, Box<dyn Error>> {
        if !std::path::Path::new(chemin_modele).exists() {
            return Err(format!(
                "modèle d'écoute introuvable : {}. Télécharger un modèle Whisper au format ggml.",
                chemin_modele
            )
            .into());
        }

        let contexte =
            WhisperContext::new_with_params(chemin_modele, WhisperContextParameters::default())
                .map_err(|e| format!("chargement du modèle d'écoute : {}", e))?;

        Ok(VoiceState {
            contexte: Arc::new(contexte),
            tampon: Arc::new(Mutex::new(Vec::new())),
            is_listening: Arc::new(Mutex::new(false)),
            audio_stream: Arc::new(Mutex::new(None)),
        })
    }

    pub fn start_listening(&self) -> Result<String, String> {
        {
            let mut ecoute = self.is_listening.lock().unwrap();
            if *ecoute {
                return Err("écoute déjà en cours".to_string());
            }
            *ecoute = true;
        }

        self.ouvrir_flux()?;
        Ok("écoute démarrée".to_string())
    }

    pub fn stop_listening(&self) -> Result<String, String> {
        *self.is_listening.lock().unwrap() = false;
        self.audio_stream.lock().unwrap().take();
        Ok("écoute arrêtée".to_string())
    }

    fn ouvrir_flux(&self) -> Result<(), String> {
        let hote = cpal::default_host();
        let peripherique = hote
            .default_input_device()
            .ok_or_else(|| "aucun microphone disponible".to_string())?;

        let config = peripherique
            .default_input_config()
            .map_err(|e| format!("configuration du microphone : {}", e))?;

        let taux = config.sample_rate();
        let canaux = config.channels() as usize;
        if taux % TAUX_WHISPER != 0 {
            return Err(format!(
                "microphone à {} Hz : seuls les multiples de {} Hz sont pris en charge \
                 (48000 et 16000 couvrent la quasi-totalité des appareils).",
                taux, TAUX_WHISPER
            ));
        }
        let pas = (taux / TAUX_WHISPER) as usize;

        let tampon = Arc::clone(&self.tampon);
        let ecoute = Arc::clone(&self.is_listening);
        let format = config.sample_format();
        let config: cpal::StreamConfig = config.into();

        let sur_erreur = |e| eprintln!("flux audio : {}", e);

        let flux = match format {
            SampleFormat::F32 => peripherique.build_input_stream(
                &config,
                move |donnees: &[f32], _: &cpal::InputCallbackInfo| {
                    if !*ecoute.lock().unwrap() {
                        return;
                    }
                    let mut t = tampon.lock().unwrap();
                    t.extend(reduire(donnees, canaux, pas));
                },
                sur_erreur,
                None,
            ),
            SampleFormat::I16 => peripherique.build_input_stream(
                &config,
                move |donnees: &[i16], _: &cpal::InputCallbackInfo| {
                    if !*ecoute.lock().unwrap() {
                        return;
                    }
                    let en_f32: Vec<f32> = donnees
                        .iter()
                        .map(|e| *e as f32 / i16::MAX as f32)
                        .collect();
                    let mut t = tampon.lock().unwrap();
                    t.extend(reduire(&en_f32, canaux, pas));
                },
                sur_erreur,
                None,
            ),
            autre => return Err(format!("format audio non pris en charge : {:?}", autre)),
        }
        .map_err(|e| format!("ouverture du flux audio : {}", e))?;

        flux.play().map_err(|e| format!("démarrage du flux : {}", e))?;
        *self.audio_stream.lock().unwrap() = Some(flux);

        Ok(())
    }

    /// Transcrit ce qui a été capté et vide le tampon.
    pub fn process_audio(&self, audio_data: &[i16]) -> Result<Option<String>, String> {
        let echantillons: Vec<f32> = if audio_data.is_empty() {
            let mut t = self.tampon.lock().unwrap();
            std::mem::take(&mut *t)
        } else {
            audio_data
                .iter()
                .map(|e| *e as f32 / i16::MAX as f32)
                .collect()
        };

        if echantillons.is_empty() {
            return Ok(None);
        }

        self.transcrire(&echantillons).map(Some)
    }

    /// Transcrit ce qui a été capté sans vider le tampon.
    pub fn get_partial_result(&self) -> Result<String, String> {
        let echantillons = self.tampon.lock().unwrap().clone();
        if echantillons.is_empty() {
            return Ok(String::new());
        }
        self.transcrire(&echantillons)
    }

    fn transcrire(&self, echantillons: &[f32]) -> Result<String, String> {
        // Whisper refuse les fragments trop courts : moins d'une seconde ne
        // porte pas de phrase exploitable.
        if echantillons.len() < TAUX_WHISPER as usize {
            return Ok(String::new());
        }

        let mut etat = self
            .contexte
            .create_state()
            .map_err(|e| format!("initialisation de la transcription : {}", e))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("fr"));
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);

        etat
            .full(params, echantillons)
            .map_err(|e| format!("transcription : {}", e))?;

        let segments = etat
            .full_n_segments()
            .map_err(|e| format!("lecture de la transcription : {}", e))?;

        let mut texte = String::new();
        for i in 0..segments {
            let segment = etat
                .full_get_segment_text(i)
                .map_err(|e| format!("lecture du segment {} : {}", i, e))?;
            texte.push_str(&segment);
        }

        Ok(texte.trim().to_string())
    }
}

/// Ramène un bloc multicanal au mono 16 kHz : moyenne des canaux, puis moyenne
/// glissante sur `pas` échantillons plutôt qu'une décimation sèche, qui
/// replierait les aigus sur la voix.
fn reduire(donnees: &[f32], canaux: usize, pas: usize) -> Vec<f32> {
    if canaux == 0 || pas == 0 {
        return Vec::new();
    }

    let mono: Vec<f32> = donnees
        .chunks_exact(canaux)
        .map(|trame| trame.iter().sum::<f32>() / canaux as f32)
        .collect();

    mono.chunks_exact(pas)
        .map(|groupe| groupe.iter().sum::<f32>() / pas as f32)
        .collect()
}

// The spoken text is fed through stdin and never interpolated into the script:
// it comes from the model, so building a program around it would let a crafted
// sentence run arbitrary code on the client machine.
const SCRIPT_TTS: &str = "\
import sys, pyttsx3
texte = sys.stdin.read()
moteur = pyttsx3.init()
moteur.setProperty('rate', 150)
moteur.setProperty('volume', 0.9)
moteur.say(texte)
moteur.runAndWait()
";

pub async fn text_to_speech(text: &str) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    fn lancer(programme: &str) -> std::io::Result<std::process::Child> {
        Command::new(programme)
            .arg("-c")
            .arg(SCRIPT_TTS)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
    }

    let mut enfant = lancer("python3")
        .or_else(|_| lancer("python"))
        .map_err(|e| format!("python introuvable pour la synthèse vocale : {}", e))?;

    let mut entree = enfant
        .stdin
        .take()
        .ok_or_else(|| "entrée standard indisponible".to_string())?;
    entree
        .write_all(text.as_bytes())
        .map_err(|e| format!("écriture vers la synthèse vocale : {}", e))?;
    drop(entree);

    let sortie = enfant
        .wait_with_output()
        .map_err(|e| format!("synthèse vocale interrompue : {}", e))?;

    if !sortie.status.success() {
        return Err(format!(
            "synthèse vocale en échec : {}",
            String::from_utf8_lossy(&sortie.stderr)
        ));
    }

    Ok("texte prononcé".to_string())
}
