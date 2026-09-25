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
    pub fn new(chemin_modele: &std::path::Path) -> Result<Self, Box<dyn Error>> {
        if !chemin_modele.exists() {
            return Err(format!(
                "modèle d'écoute introuvable : {}. Déposer un modèle Whisper au format ggml à cet emplacement.",
                chemin_modele.display()
            )
            .into());
        }

        let contexte = WhisperContext::new_with_params(
            &chemin_modele.to_string_lossy(),
            WhisperContextParameters::default(),
        )
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
        let flux = ouvrir_entree(Arc::clone(&self.tampon), Arc::clone(&self.is_listening))?;
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

/// Ouvre le microphone par défaut et verse ce qu'il donne, en mono 16 kHz, dans
/// `tampon`, tant que `actif` est vrai.
///
/// **Le seul endroit du dépôt qui ouvre une entrée audio.** Il y en avait un, lié
/// à `VoiceState`, donc au modèle d'écoute : atteindre le microphone supposait
/// 190 Mo téléchargés et une transcription. L'empreinte vocale n'a rien à
/// transcrire, et elle attendait pourtant ce téléchargement.
fn ouvrir_entree(
    tampon: Arc<Mutex<Vec<f32>>>,
    actif: Arc<Mutex<bool>>,
) -> Result<Stream, String> {
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

    let format = config.sample_format();
    let config: cpal::StreamConfig = config.into();

    let sur_erreur = |e| eprintln!("flux audio : {}", e);

    let tampon_f32 = Arc::clone(&tampon);
    let actif_f32 = Arc::clone(&actif);
    let flux = match format {
        SampleFormat::F32 => peripherique.build_input_stream(
            &config,
            move |donnees: &[f32], _: &cpal::InputCallbackInfo| {
                if !*actif_f32.lock().unwrap() {
                    return;
                }
                let mut t = tampon_f32.lock().unwrap();
                t.extend(reduire(donnees, canaux, pas));
            },
            sur_erreur,
            None,
        ),
        SampleFormat::I16 => peripherique.build_input_stream(
            &config,
            move |donnees: &[i16], _: &cpal::InputCallbackInfo| {
                if !*actif.lock().unwrap() {
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
    Ok(flux)
}

/// Les deux côtés de la capture doivent parler du même taux.
///
/// `capturer` rend du 16 kHz parce que c'est ce que veut le modèle d'écoute, et
/// `voiceprint` découpe ses trames sur `TAUX_EMPREINTE`. Écrits deux fois, les
/// deux nombres finiraient par différer, et l'empreinte se calculerait sur des
/// trames décalées — une comparaison qui ne dirait plus rien, sans une erreur.
/// Vérifié à la compilation plutôt que jamais.
const _: () = assert!(TAUX_WHISPER == crate::voiceprint::TAUX_EMPREINTE);

/// Capte le microphone pendant `secondes` et rend les échantillons en mono
/// 16 kHz, sans rien transcrire.
///
/// Le flux cpal n'est pas `Send` : il naît et meurt dans cet appel, et seuls les
/// échantillons en sortent. L'appelant est une commande `async` qui passe par
/// `spawn_blocking`, sinon l'attente gèlerait l'interface.
pub fn capturer(secondes: f32) -> Result<Vec<i16>, String> {
    if !(0.5..=30.0).contains(&secondes) {
        return Err(format!(
            "durée d'enregistrement hors bornes : {} s (de 0,5 à 30 s)",
            secondes
        ));
    }

    let tampon = Arc::new(Mutex::new(Vec::new()));
    let actif = Arc::new(Mutex::new(true));
    let flux = ouvrir_entree(Arc::clone(&tampon), Arc::clone(&actif))?;

    std::thread::sleep(std::time::Duration::from_secs_f32(secondes));
    *actif.lock().unwrap() = false;
    drop(flux);

    let capte = std::mem::take(&mut *tampon.lock().unwrap());
    if capte.is_empty() {
        return Err(
            "le microphone n'a rien donné : vérifiez qu'il est branché et que l'application \
             a le droit de l'écouter."
                .to_string(),
        );
    }
    Ok(capte
        .iter()
        .map(|v| (v.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
        .collect())
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

fn ressource(variable: &str, defaut: &str) -> std::path::PathBuf {
    match std::env::var_os(variable) {
        Some(v) => std::path::PathBuf::from(v),
        // Ces quatre pièces sont téléchargées au premier lancement, donc sous la
        // racine inscriptible ; `pour_lire` retombe sur le dossier de
        // l'exécutable au cas où un installeur viendrait à les livrer.
        None => crate::chemins::pour_lire(defaut),
    }
}

/// Piper : synthèse neurone sur CPU, c'est ce que le palier « audio-parole »
/// du dimensionnement chiffre. Aucun interpréteur tiers n'est requis sur le
/// poste — mais le binaire et la voix **ne sont pas encore livrés avec
/// l'application** : `crate::ressources` dit ce qui manque et où le prendre.
fn chemin_piper() -> std::path::PathBuf {
    ressource(
        "IAGENT_PIPER",
        if cfg!(windows) { "piper/piper.exe" } else { "piper/piper" },
    )
}

fn chemin_voix() -> std::path::PathBuf {
    ressource("IAGENT_VOIX", "modeles/fr_FR-siwis-medium.onnx")
}

/// Le modèle d'écoute, cherché lui aussi à côté de l'exécutable.
pub fn chemin_modele_ecoute() -> std::path::PathBuf {
    ressource("IAGENT_MODELE_ECOUTE", "modeles/ggml-small-q5_1.bin")
}

pub async fn text_to_speech(text: &str) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    if text.trim().is_empty() {
        return Ok("rien à prononcer".to_string());
    }

    // Les trois pièces d'un coup : le moteur, la voix et ses réglages. Piper lit
    // les réglages tout seul à côté du modèle, donc leur absence ne se voyait
    // qu'à un échec sans message une fois le processus lancé.
    if let Some(manque) = crate::ressources::manque_pour_parler() {
        return Err(manque);
    }
    let binaire = chemin_piper();
    let voix = chemin_voix();

    let sortie_wav = std::env::temp_dir().join(format!("iagent-{}.wav", std::process::id()));

    // Le texte passe par l'entrée standard : il vient du modèle, donc de ce que
    // dit l'appelant, et n'a rien à faire dans une ligne de commande.
    let mut enfant = Command::new(&binaire)
        .arg("--model")
        .arg(&voix)
        .arg("--output_file")
        .arg(&sortie_wav)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("lancement du moteur de voix : {}", e))?;

    {
        let mut entree = enfant
            .stdin
            .take()
            .ok_or_else(|| "entrée standard indisponible".to_string())?;
        entree
            .write_all(text.as_bytes())
            .map_err(|e| format!("écriture vers le moteur de voix : {}", e))?;
    }

    let resultat = enfant
        .wait_with_output()
        .map_err(|e| format!("synthèse interrompue : {}", e))?;

    if !resultat.status.success() {
        let _ = std::fs::remove_file(&sortie_wav);
        return Err(format!(
            "synthèse en échec : {}",
            String::from_utf8_lossy(&resultat.stderr)
        ));
    }

    let joue = jouer_wav(&sortie_wav);
    let _ = std::fs::remove_file(&sortie_wav);
    joue?;

    Ok("texte prononcé".to_string())
}

fn jouer_wav(chemin: &std::path::Path) -> Result<(), String> {
    let mut lecteur = hound::WavReader::open(chemin)
        .map_err(|e| format!("lecture du son synthétisé : {}", e))?;
    let spec = lecteur.spec();

    let echantillons: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            let max = (1i64 << (spec.bits_per_sample - 1)) as f32;
            lecteur
                .samples::<i32>()
                .map(|e| e.map(|v| v as f32 / max))
                .collect::<Result<_, _>>()
                .map_err(|e| format!("décodage du son : {}", e))?
        }
        hound::SampleFormat::Float => lecteur
            .samples::<f32>()
            .collect::<Result<_, _>>()
            .map_err(|e| format!("décodage du son : {}", e))?,
    };

    let hote = cpal::default_host();
    let peripherique = hote
        .default_output_device()
        .ok_or_else(|| "aucune sortie audio disponible".to_string())?;

    let config = cpal::StreamConfig {
        channels: spec.channels,
        sample_rate: spec.sample_rate,
        buffer_size: cpal::BufferSize::Default,
    };

    let total = echantillons.len();
    let restant = Arc::new(Mutex::new(echantillons.into_iter()));
    let fini = Arc::new((Mutex::new(false), std::sync::Condvar::new()));

    let source = Arc::clone(&restant);
    let drapeau = Arc::clone(&fini);

    let flux = peripherique
        .build_output_stream(
            &config,
            move |tampon: &mut [f32], _: &cpal::OutputCallbackInfo| {
                let mut reste = source.lock().unwrap();
                let mut epuise = false;
                for case in tampon.iter_mut() {
                    match reste.next() {
                        Some(v) => *case = v,
                        None => {
                            *case = 0.0;
                            epuise = true;
                        }
                    }
                }
                if epuise {
                    let (verrou, signal) = &*drapeau;
                    *verrou.lock().unwrap() = true;
                    signal.notify_all();
                }
            },
            |e| eprintln!("sortie audio : {}", e),
            None,
        )
        .map_err(|e| format!("ouverture de la sortie audio : {}", e))?;

    flux.play().map_err(|e| format!("lecture du son : {}", e))?;

    // Garde-fou : on n'attend jamais plus que la durée du son plus une seconde.
    let duree = std::time::Duration::from_secs_f32(
        total as f32 / (spec.sample_rate as f32 * spec.channels as f32) + 1.0,
    );
    let (verrou, signal) = &*fini;
    let mut termine = verrou.lock().unwrap();
    while !*termine {
        let (garde, delai) = signal.wait_timeout(termine, duree).unwrap();
        termine = garde;
        if delai.timed_out() {
            break;
        }
    }

    Ok(())
}
