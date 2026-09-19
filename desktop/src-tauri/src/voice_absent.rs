//! Remplacant du module voix quand la fonction `voice` est eteinte.
//!
//! Le vrai pipeline (`voice.rs`) depend de la bibliotheque native `libvosk`,
//! que le depot ne fournit pas, et n'a jamais compile contre les API reelles
//! de `vosk` 0.3 et `cpal`. Plutot que de bloquer tout le binaire, on garde la
//! meme surface publique et on renvoie un motif en clair : un agent qui ne
//! tourne pas en local dit toujours pourquoi.
//!
//! Rallumer avec `cargo build --features voice` une fois le module reecrit.

use std::error::Error;

const MOTIF: &str = "Module voix desactive dans cette compilation : \
                     il reclame la bibliotheque native libvosk et une reecriture \
                     contre les API vosk 0.3 / cpal. Reconstruire avec \
                     `--features voice`. En attendant, pilotez les agents au clavier.";

pub struct VoiceState;

impl VoiceState {
    pub fn new(_model_path: &str) -> Result<Self, Box<dyn Error>> {
        Err(MOTIF.into())
    }

    pub fn start_listening(&self) -> Result<String, String> {
        Err(MOTIF.to_string())
    }

    pub fn stop_listening(&self) -> Result<String, String> {
        Err(MOTIF.to_string())
    }

    pub fn process_audio(&self, _audio_data: &[i16]) -> Result<Option<String>, String> {
        Err(MOTIF.to_string())
    }

    pub fn get_partial_result(&self) -> Result<Option<String>, String> {
        Err(MOTIF.to_string())
    }
}

/// La synthese vocale ne depend pas de vosk : elle reste disponible.
pub async fn text_to_speech(text: &str) -> Result<String, String> {
    use std::process::Command;

    const PYTHON_TTS: &str = r##"
import sys
import pyttsx3

engine = pyttsx3.init()
engine.setProperty('rate', 150)
engine.setProperty('volume', 0.9)
engine.say(sys.argv[1])
engine.runAndWait()
print("TTS complete")
"##;

    let lancer = |binaire: &str| {
        Command::new(binaire)
            .arg("-c")
            .arg(PYTHON_TTS)
            .arg(text)
            .output()
    };

    let output = lancer("python3")
        .or_else(|_| lancer("python"))
        .map_err(|e| format!("Failed to run pyttsx3: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("TTS error: {}", stderr));
    }

    Ok("Text spoken successfully".to_string())
}
