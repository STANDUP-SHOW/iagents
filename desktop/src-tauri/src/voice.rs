use std::sync::{Arc, Mutex};
use std::error::Error;
use vosk::Vosk;

pub struct VoiceState {
    pub recognizer: Arc<Mutex<Option<vosk::Recognizer>>>,
    pub model: Arc<vosk::Model>,
    pub is_listening: Arc<Mutex<bool>>,
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

        // Initialize recognizer if not already done
        if self.recognizer.lock().unwrap().is_none() {
            self.init_voice_recognition()?;
        }

        Ok("Listening started".to_string())
    }

    pub fn process_audio(&self, audio_data: &[i16]) -> Result<Option<String>, String> {
        let mut rec_guard = self.recognizer.lock().unwrap();

        if let Some(recognizer) = rec_guard.as_mut() {
            match recognizer.accept_waveform(audio_data) {
                Ok(()) => {
                    if recognizer.is_final_result().unwrap_or(false) {
                        // Parse result and extract command
                        let result = recognizer.result().unwrap_or_default();
                        Ok(Some(result))
                    } else {
                        Ok(None)
                    }
                }
                Err(e) => Err(format!("Audio processing error: {}", e))
            }
        } else {
            Err("Recognizer not initialized".to_string())
        }
    }

    pub fn stop_listening(&self) -> Result<String, String> {
        let mut listening = self.is_listening.lock().unwrap();
        *listening = false;

        let mut rec_guard = self.recognizer.lock().unwrap();
        if let Some(recognizer) = rec_guard.as_mut() {
            let final_result = recognizer.final_result().unwrap_or_default();
            Ok(final_result)
        } else {
            Ok("No active listening session".to_string())
        }
    }
}

pub fn text_to_speech(text: &str) -> Result<Vec<u8>, Box<dyn Error>> {
    // Phase 1: Placeholder for local TTS (pyttsx3 via subprocess)
    // Phase 2: ElevenLabs API integration for higher quality
    println!("TTS output: {}", text);
    Ok(vec![])
}
