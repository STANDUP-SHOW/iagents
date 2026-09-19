use std::error::Error;
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use vosk::{DecodingState, LogLevel, Model, Recognizer};

/// Capture rate handed to both the input device and the recognizer.
const SAMPLE_RATE: u32 = 44100;

pub struct VoiceState {
    pub recognizer: Arc<Mutex<Option<Recognizer>>>,
    pub model: Arc<Model>,
    pub is_listening: Arc<Mutex<bool>>,
    pub audio_stream: Arc<Mutex<Option<Stream>>>,
    /// Last utterance the recognizer finalized, waiting to be polled.
    pending_result: Arc<Mutex<Option<String>>>,
}

impl VoiceState {
    pub fn new(model_path: &str) -> Result<Self, Box<dyn Error>> {
        vosk::set_log_level(LogLevel::Warn);

        // Load model from path (typically bundled or downloaded)
        let model = Model::new(model_path)
            .ok_or_else(|| format!("Could not load the Vosk model at {}", model_path))?;

        Ok(VoiceState {
            recognizer: Arc::new(Mutex::new(None)),
            model: Arc::new(model),
            is_listening: Arc::new(Mutex::new(false)),
            audio_stream: Arc::new(Mutex::new(None)),
            pending_result: Arc::new(Mutex::new(None)),
        })
    }

    pub fn init_voice_recognition(&self) -> Result<String, String> {
        let recognizer = Recognizer::new(&self.model, SAMPLE_RATE as f32)
            .ok_or_else(|| "Failed to initialize recognizer".to_string())?;

        let mut rec = self.recognizer.lock().unwrap();
        *rec = Some(recognizer);
        Ok("Voice recognition initialized".to_string())
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
            sample_rate: SAMPLE_RATE,
            buffer_size: cpal::BufferSize::Default,
        };

        let recognizer = Arc::clone(&self.recognizer);
        let is_listening = Arc::clone(&self.is_listening);
        let pending_result = Arc::clone(&self.pending_result);

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    let is_active = *is_listening.lock().unwrap();
                    if !is_active {
                        return;
                    }

                    if let Ok(mut rec) = recognizer.lock() {
                        if let Some(recognizer) = rec.as_mut() {
                            // Silence ends an utterance; only then is a transcript ready.
                            if let Ok(DecodingState::Finalized) = recognizer.accept_waveform(data) {
                                if let Some(single) = recognizer.result().single() {
                                    let text = single.text.to_string();
                                    if let Ok(mut pending) = pending_result.lock() {
                                        *pending = Some(text);
                                    }
                                }
                            }
                        }
                    }
                },
                |err| eprintln!("Stream error: {}", err),
                None,
            )
            .map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start stream: {}", e))?;

        let mut stream_guard = self.audio_stream.lock().unwrap();
        *stream_guard = Some(stream);

        Ok(())
    }

    pub fn process_audio(&self, _audio_data: &[i16]) -> Result<Option<String>, String> {
        if self.recognizer.lock().unwrap().is_none() {
            return Err("Recognizer not initialized".to_string());
        }

        let mut pending = self.pending_result.lock().unwrap();
        Ok(pending.take())
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
            let final_result = recognizer
                .final_result()
                .single()
                .map(|single| single.text.to_string())
                .unwrap_or_default();
            Ok(final_result)
        } else {
            Ok("No active listening session".to_string())
        }
    }

    pub fn get_partial_result(&self) -> Result<Option<String>, String> {
        let mut rec_guard = self.recognizer.lock().unwrap();

        if let Some(recognizer) = rec_guard.as_mut() {
            let partial = recognizer.partial_result().partial.to_string();
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

pub async fn text_to_speech(text: &str) -> Result<String, String> {
    use std::process::Command;

    // Local TTS through pyttsx3. The spoken text is injected as a JSON string
    // literal, which is also valid Python, so quotes and backslashes in the
    // text cannot break out of the generated snippet.
    let literal = serde_json::to_string(text).map_err(|e| format!("Invalid text: {}", e))?;

    let python_code = format!(
        "import pyttsx3\n\
         engine = pyttsx3.init()\n\
         engine.setProperty('rate', 150)\n\
         engine.setProperty('volume', 0.9)\n\
         engine.say({})\n\
         engine.runAndWait()\n",
        literal
    );

    let output = Command::new("python3")
        .arg("-c")
        .arg(&python_code)
        .output()
        .or_else(|_| {
            // Fallback to `python`, which is the usual name on Windows.
            Command::new("python").arg("-c").arg(&python_code).output()
        })
        .map_err(|e| format!("Failed to run pyttsx3: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("TTS error: {}", stderr));
    }

    Ok("Text spoken successfully".to_string())
}
