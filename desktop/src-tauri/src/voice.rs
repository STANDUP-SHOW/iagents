use std::sync::{Arc, Mutex};
use std::error::Error;
use std::thread;
use vosk::Vosk;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};

pub struct VoiceState {
    pub recognizer: Arc<Mutex<Option<vosk::Recognizer>>>,
    pub model: Arc<vosk::Model>,
    pub is_listening: Arc<Mutex<bool>>,
    pub audio_stream: Arc<Mutex<Option<Stream>>>,
}

impl VoiceState {
    pub fn new(model_path: &str) -> Result<Self, Box<dyn Error>> {
        // Initialize Vosk library
        vosk::set_log_level(-1);

        // Load model from path (typically bundled or downloaded)
        let model = vosk::Model::new(model_path)?;

        Ok(VoiceState {
            recognizer: Arc::new(Mutex::new(None)),
            model: Arc::new(model),
            is_listening: Arc::new(Mutex::new(false)),
            audio_stream: Arc::new(Mutex::new(None)),
        })
    }

    pub fn init_voice_recognition(&self) -> Result<String, String> {
        match self.model.new_recognizer(44100) {
            Ok(recognizer) => {
                let mut rec = self.recognizer.lock().unwrap();
                *rec = Some(recognizer);
                Ok("Voice recognition initialized".to_string())
            }
            Err(e) => Err(format!("Failed to initialize recognizer: {}", e))
        }
    }

    pub fn start_listening(&self) -> Result<String, String> {
        let mut listening = self.is_listening.lock().unwrap();
        if *listening {
            return Err("Already listening".to_string());
        }
        *listening = true;
        drop(listening);

        // Initialize recognizer if not already done
        if self.recognizer.lock().unwrap().is_none() {
            self.init_voice_recognition()?;
        }

        // Start audio input stream
        self.start_audio_stream()?;

        Ok("Listening started".to_string())
    }

    fn start_audio_stream(&self) -> Result<(), String> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| "No input device available".to_string())?;

        let config = StreamConfig {
            channels: 1,
            sample_rate: cpal::SampleRate(44100),
            buffer_size: cpal::BufferSize::Default,
        };

        let recognizer = Arc::clone(&self.recognizer);
        let is_listening = Arc::clone(&self.is_listening);

        let stream = device
            .build_input_stream(
                &config,
                move |data: &cpal::Data, _: &cpal::InputCallbackInfo| {
                    let is_active = *is_listening.lock().unwrap();
                    if !is_active {
                        return;
                    }

                    let audio_samples: Vec<i16> = data
                        .as_slice::<i16>()
                        .unwrap_or(&[])
                        .to_vec();

                    if let Ok(mut rec) = recognizer.lock() {
                        if let Some(recognizer) = rec.as_mut() {
                            let _ = recognizer.accept_waveform(&audio_samples);
                        }
                    }
                },
                |err| eprintln!("Stream error: {}", err),
            )
            .map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream.play().map_err(|e| format!("Failed to start stream: {}", e))?;

        let mut stream_guard = self.audio_stream.lock().unwrap();
        *stream_guard = Some(stream);

        Ok(())
    }

    pub fn process_audio(&self, _audio_data: &[i16]) -> Result<Option<String>, String> {
        let mut rec_guard = self.recognizer.lock().unwrap();

        if let Some(recognizer) = rec_guard.as_mut() {
            if recognizer.is_final_result().unwrap_or(false) {
                let result = recognizer.result().unwrap_or_default();
                Ok(Some(result))
            } else {
                Ok(None)
            }
        } else {
            Err("Recognizer not initialized".to_string())
        }
    }

    pub fn stop_listening(&self) -> Result<String, String> {
        let mut listening = self.is_listening.lock().unwrap();
        *listening = false;
        drop(listening);

        // Stop audio stream
        let mut stream_guard = self.audio_stream.lock().unwrap();
        *stream_guard = None;

        let mut rec_guard = self.recognizer.lock().unwrap();
        if let Some(recognizer) = rec_guard.as_mut() {
            let final_result = recognizer.final_result().unwrap_or_default();
            Ok(final_result)
        } else {
            Ok("No active listening session".to_string())
        }
    }

    pub fn get_partial_result(&self) -> Result<Option<String>, String> {
        let mut rec_guard = self.recognizer.lock().unwrap();

        if let Some(recognizer) = rec_guard.as_mut() {
            let partial = recognizer.partial_result().unwrap_or_default();
            if partial.is_empty() {
                Ok(None)
            } else {
                Ok(Some(partial))
            }
        } else {
            Err("Recognizer not initialized".to_string())
        }
    }
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
