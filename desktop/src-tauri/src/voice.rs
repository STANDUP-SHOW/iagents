use std::error::Error;
use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Whisper travaille en 16 kHz mono : tout ce qui entre est ramené à ce taux.
const TAUX_WHISPER: u32 = 16_000;

/// The buffer never holds more than this: a room nobody polls must not fill
/// memory. The cutter below empties it far sooner.
const TAMPON_MAXIMUM: usize = 60 * TAUX_WHISPER as usize;

/// The cutter looks at the sound a tenth of a second at a time.
const MORCEAU: usize = TAUX_WHISPER as usize / 10;
/// How long a pause ends a sentence. Shorter cuts people who breathe between
/// two clauses; longer makes the agent seem slow to answer.
const PAUSE_DE_FIN: usize = 8;
/// Below this much speech, what stood out was a click or a cough.
const PAROLE_MINIMUM: usize = 3;
/// A sentence longer than this is cut and handed on anyway.
const PHRASE_MAXIMUM: usize = 25 * TAUX_WHISPER as usize;
/// Sound kept before the first loud tenth of a second: the start of a word is
/// quieter than its middle, and Whisper needs it to hear the first syllable.
const AVANT_LA_PAROLE: usize = 3 * MORCEAU;
/// What the listening keeps while nobody speaks.
const ATTENTE_GARDEE: usize = 5 * MORCEAU;

/// True while the application speaks: what the microphone hears then is the
/// agent's own voice, and fed back to the listening it would answer itself as
/// soon as a conversation is open.
pub static EN_TRAIN_DE_PARLER: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// When the application last stopped speaking: an open conversation waits
/// for the client from there, not from when the question was asked.
pub static FIN_DE_PAROLE: Mutex<Option<std::time::Instant>> = Mutex::new(None);

/// Cuts what the microphone hears into whole sentences.
///
/// Before 12/10/2026 the screen transcribed the last 8 seconds five times a
/// second and took the last result after a second without change. A sentence
/// longer than the window lost its start (« Vait Victorstellen » on max's PC),
/// the same words were transcribed over and over, and the empty room was
/// transcribed too, keeping two cores busy. Now nothing is transcribed until
/// someone has spoken and stopped, and then the whole sentence is, once.
///
/// Speech is told from the room by its level against the room's own floor,
/// which follows the room slowly: microphones differ by ten times, and a fan
/// that starts must not read as someone speaking for ever.
#[derive(Debug, Default)]
pub struct Decoupeur {
    fond: Option<f32>,
    vus: usize,
    debut: Option<usize>,
    derniere: usize,
    parles: usize,
}

impl Decoupeur {
    /// Reads what arrived since the last call. Returns a whole sentence when
    /// one has just ended, and drops from `tampon` what can no longer be part
    /// of one.
    pub fn avancer(&mut self, tampon: &mut Vec<f32>) -> Option<Vec<f32>> {
        if self.vus > tampon.len() {
            // The buffer was cut behind our back (nobody polled for a minute).
            *self = Decoupeur { fond: self.fond, ..Default::default() };
        }
        while self.vus + MORCEAU <= tampon.len() {
            let niveau = rms(&tampon[self.vus..self.vus + MORCEAU]);
            let fond = *self.fond.get_or_insert(niveau);
            if niveau > (3.0 * fond).max(0.004) {
                self.debut.get_or_insert(self.vus);
                self.derniere = self.vus + MORCEAU;
                self.parles += 1;
            } else {
                self.fond = Some(if niveau < fond { niveau } else { fond * 0.98 + niveau * 0.02 });
            }
            self.vus += MORCEAU;

            let Some(debut) = self.debut else { continue };
            let fini = self.vus - self.derniere >= PAUSE_DE_FIN * MORCEAU;
            let trop_long = self.vus - debut >= PHRASE_MAXIMUM;
            if !(fini || trop_long) {
                continue;
            }
            let phrase = (self.parles >= PAROLE_MINIMUM).then(|| {
                let de = debut.saturating_sub(AVANT_LA_PAROLE);
                let a = if trop_long { self.vus } else { (self.derniere + 2 * MORCEAU).min(self.vus) };
                tampon[de..a].to_vec()
            });
            let jusque = if trop_long { self.vus } else { self.derniere };
            tampon.drain(..jusque);
            self.vus -= jusque;
            self.debut = None;
            self.parles = 0;
            if phrase.is_some() {
                return phrase;
            }
        }
        if self.debut.is_none() && tampon.len() > ATTENTE_GARDEE {
            let trop = tampon.len() - ATTENTE_GARDEE;
            tampon.drain(..trop);
            self.vus = self.vus.saturating_sub(trop);
        }
        None
    }
}

/// Keeps only the end of the buffer.
fn garder_la_fin(t: &mut Vec<f32>, garder: usize) {
    if t.len() > garder {
        let trop = t.len() - garder;
        t.drain(..trop);
    }
}

pub struct VoiceState {
    contexte: Arc<WhisperContext>,
    /// Audio capté depuis le dernier vidage, déjà ramené en 16 kHz mono.
    tampon: Arc<Mutex<Vec<f32>>>,
    decoupeur: Mutex<Decoupeur>,
    /// The last whole sentence, kept for a better transcription online.
    derniere: Mutex<Option<Vec<f32>>>,
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
            decoupeur: Mutex::new(Decoupeur::default()),
            derniere: Mutex::new(None),
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
        self.oublier();
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

    /// The model and the sentence just finished, if one is: the caller
    /// transcribes it WITHOUT holding any lock, since that takes seconds on a
    /// modest processor and everything else waiting on the voice would wait
    /// with it.
    pub fn phrase_finie(&self) -> (Arc<WhisperContext>, Option<Vec<f32>>) {
        let mut t = self.tampon.lock().unwrap();
        let phrase = self.decoupeur.lock().unwrap().avancer(&mut t);
        if phrase.is_some() {
            *self.derniere.lock().unwrap() = phrase.clone();
        }
        (Arc::clone(&self.contexte), phrase)
    }

    /// The sentence `phrase_finie` last handed on.
    pub fn derniere_phrase(&self) -> Option<Vec<f32>> {
        self.derniere.lock().unwrap().clone()
    }

    /// How loud the microphone is right now: the RMS of the last fifth of a
    /// second, 0 when nothing arrives. The screen draws it, so the client sees
    /// whether his voice reaches the application at all.
    pub fn niveau(&self) -> f32 {
        let t = self.tampon.lock().unwrap();
        let debut = t.len().saturating_sub(TAUX_WHISPER as usize / 5);
        rms(&t[debut..])
    }

    /// Forgets what was heard: a microphone switched off and on again must not
    /// hand back half a sentence from before.
    pub fn oublier(&self) {
        self.tampon.lock().unwrap().clear();
        let mut d = self.decoupeur.lock().unwrap();
        *d = Decoupeur { fond: d.fond, ..Default::default() };
    }

    fn transcrire(&self, echantillons: &[f32]) -> Result<String, String> {
        transcrire(&self.contexte, echantillons)
    }
}

fn rms(e: &[f32]) -> f32 {
    if e.is_empty() {
        return 0.0;
    }
    (e.iter().map(|v| v * v).sum::<f32>() / e.len() as f32).sqrt()
}

/// Transcribes 16 kHz mono samples. A free function so that it can run on a
/// worker thread with only the model in hand.
pub fn transcrire(contexte: &WhisperContext, echantillons: &[f32]) -> Result<String, String> {
    {
        // Whisper refuse les fragments trop courts : moins d'une seconde ne
        // porte pas de phrase exploitable.
        if echantillons.len() < TAUX_WHISPER as usize {
            return Ok(String::new());
        }

        let mut etat = contexte
            .create_state()
            .map_err(|e| format!("initialisation de la transcription : {}", e))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("fr"));
        // Whisper pads every window to 30 s and encodes all of it. Encoding only
        // what was heard (50 frames per second, plus a margin) is what makes an
        // 8 s window cost a fraction of a 30 s one on a 4-core office PC.
        let secondes = echantillons.len() as f32 / TAUX_WHISPER as f32;
        params.set_audio_ctx(((secondes * 50.0).ceil() as i32 + 64).min(1500));
        let coeurs = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
        params.set_n_threads(coeurs.clamp(1, 8) as i32);
        // One pass, bounded. When a pass looks unsure, Whisper decodes again at
        // a higher temperature, up to five times, and a pass that loops runs
        // to its token limit: the CI bench went from 3 s to 99 s on the same
        // 8 s of sound (12/10/2026). A sentence for an agent is short; a
        // doubtful one is better handed on as is, and Gemini retranscribes it.
        params.set_temperature_inc(0.0);
        params.set_no_context(true);
        params.set_max_tokens((secondes * 16.0) as i32 + 32);
        // No « *musique* » or « [Applaudissements] » for what is not speech.
        params.set_suppress_nst(true);
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
                if !*actif_f32.lock().unwrap() || EN_TRAIN_DE_PARLER.load(std::sync::atomic::Ordering::Acquire) {
                    return;
                }
                let mut t = tampon_f32.lock().unwrap();
                t.extend(reduire(donnees, canaux, pas));
                garder_la_fin(&mut t, TAMPON_MAXIMUM);
            },
            sur_erreur,
            None,
        ),
        SampleFormat::I16 => peripherique.build_input_stream(
            &config,
            move |donnees: &[i16], _: &cpal::InputCallbackInfo| {
                if !*actif.lock().unwrap() || EN_TRAIN_DE_PARLER.load(std::sync::atomic::Ordering::Acquire) {
                    return;
                }
                let en_f32: Vec<f32> = donnees
                    .iter()
                    .map(|e| *e as f32 / i16::MAX as f32)
                    .collect();
                let mut t = tampon.lock().unwrap();
                t.extend(reduire(&en_f32, canaux, pas));
                garder_la_fin(&mut t, TAMPON_MAXIMUM);
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

/// The agent speaks: through the client's voice API when a key is saved,
/// locally otherwise. When the API fails, the local voice takes over and the
/// reason is said, so a dead key never silences the agent without a word.
/// Most sentences an agent says aloud; the rest of its answer stays written
/// on the screen. Measured on max's PC, 12/10/2026: the online voice made the
/// whole answer before saying a word, about 7 s for one short sentence, so a
/// status report took over a minute to start, read with its markdown.
const PHRASES_A_DIRE: usize = 3;
const CARACTERES_A_DIRE: usize = 450;
const LE_RESTE_EST_ECRIT: &str = "Le détail est à l'écran.";

/// What is said aloud of a written answer, in the pieces it is made in: the
/// first sentence alone, so the voice starts as soon as it is ready, then the
/// rest of the spoken part. Titles, lists, emphasis and links lose their
/// marks; tables and code are not read.
pub fn a_dire(texte: &str) -> Vec<String> {
    let mut phrases: Vec<String> = Vec::new();
    let mut dans_le_code = false;
    for ligne in texte.lines() {
        let ligne = ligne.trim();
        if ligne.starts_with("```") {
            dans_le_code = !dans_le_code;
            continue;
        }
        if dans_le_code || ligne.starts_with('|') || ligne.chars().all(|c| "-*_=#> ".contains(c)) {
            continue;
        }
        let ligne = ligne
            .trim_start_matches(|c: char| c == '#' || c == '>' || c.is_whitespace())
            .trim_start_matches(|c: char| c == '-' || c == '*' || c == '•')
            .trim_start();
        let ligne = sans_marques(ligne);
        let mut phrase = String::new();
        let mut caracteres = ligne.chars().peekable();
        while let Some(c) = caracteres.next() {
            phrase.push(c);
            if matches!(c, '.' | '!' | '?' | '…') && caracteres.peek().map_or(true, |s| s.is_whitespace()) {
                if !phrase.trim().is_empty() {
                    phrases.push(phrase.trim().to_string());
                }
                phrase.clear();
            }
        }
        if !phrase.trim().is_empty() {
            // A line without a full stop (a title, a list item) is still a
            // sentence to the ear.
            let mut fin = phrase.trim().trim_end_matches([':', ';', ',']).to_string();
            if !fin.ends_with(['.', '!', '?', '…']) {
                fin.push('.');
            }
            phrases.push(fin);
        }
    }

    let mut dites: Vec<String> = Vec::new();
    let mut longueur = 0;
    for phrase in &phrases {
        if dites.len() == PHRASES_A_DIRE || (!dites.is_empty() && longueur + phrase.chars().count() > CARACTERES_A_DIRE) {
            break;
        }
        longueur += phrase.chars().count();
        dites.push(phrase.clone());
    }
    let coupe = dites.len() < phrases.len();
    let mut morceaux = Vec::new();
    if let Some(premiere) = dites.first() {
        morceaux.push(premiere.clone());
    }
    let mut suite = dites.iter().skip(1).cloned().collect::<Vec<_>>().join(" ");
    if coupe {
        if !suite.is_empty() {
            suite.push(' ');
        }
        suite.push_str(LE_RESTE_EST_ECRIT);
    }
    if !suite.is_empty() {
        morceaux.push(suite);
    }
    morceaux
}

/// `**gras**`, `_italique_`, `` `code` `` and `[lien](adresse)` as the ear
/// should hear them.
fn sans_marques(ligne: &str) -> String {
    let mut sortie = String::with_capacity(ligne.len());
    let mut reste = ligne;
    while let Some(c) = reste.chars().next() {
        if c == '[' {
            if let Some(fin) = reste.find("](") {
                if let Some(ferme) = reste[fin..].find(')') {
                    sortie.push_str(&reste[1..fin]);
                    reste = &reste[fin + ferme + 1..];
                    continue;
                }
            }
        }
        if !matches!(c, '*' | '`') && !(c == '_' && (sortie.is_empty() || sortie.ends_with(' ') || reste[1..].starts_with([' ', '.', ',']) || reste.len() == 1)) {
            sortie.push(c);
        }
        reste = &reste[c.len_utf8()..];
    }
    sortie
}

pub async fn parler(prenom: Option<&str>, text: &str) -> Result<String, String> {
    let morceaux = a_dire(text);
    if morceaux.is_empty() {
        return Ok("rien à prononcer".to_string());
    }
    // Each piece is made while the one before it plays.
    let prenom = prenom.map(str::to_string);
    let fabriquer = |texte: String| {
        let prenom = prenom.clone();
        tokio::spawn(async move { crate::voix_api::parler(prenom.as_deref(), &texte).await })
    };
    let mut suivant = Some(fabriquer(morceaux[0].clone()));
    let mut _parle: Option<Parle> = None;
    let mut secours: Vec<String> = Vec::new();
    let mut motif = None;
    let mut depuis = 0;
    while let Some(en_cours) = suivant.take() {
        let i = depuis;
        let recu = en_cours.await.unwrap_or_else(|_| Some(Err("la voix s'est interrompue".to_string())));
        if i + 1 < morceaux.len() {
            suivant = Some(fabriquer(morceaux[i + 1].clone()));
        }
        let parole = match recu {
            None => break,
            Some(Err(e)) => {
                motif = Some(e);
                break;
            }
            Some(Ok(parole)) => parole,
        };
        _parle.get_or_insert_with(Parle::commencer);
        let fichier = std::env::temp_dir().join(format!("iagent-api-{}-{}.wav", std::process::id(), i));
        std::fs::write(&fichier, &parole.wav)
            .map_err(|_| "le son reçu n'a pas pu être posé sur le poste".to_string())?;
        let a_jouer = fichier.clone();
        let joue = tokio::task::spawn_blocking(move || jouer_wav(&a_jouer))
            .await
            .unwrap_or_else(|_| Err("la lecture s'est interrompue".to_string()));
        let _ = std::fs::remove_file(&fichier);
        if let Err(e) = joue {
            motif = Some(e);
            break;
        }
        if !parole.echecs.is_empty() {
            secours.push(format!("{}, faute de mieux : {}", parole.moteur.nom(), parole.echecs.join(" ; ")));
        }
        depuis = i + 1;
    }
    if let Some(reste) = suivant.take() {
        reste.abort();
    }
    if depuis == morceaux.len() {
        return Ok(match secours.first() {
            Some(s) => format!("texte prononcé avec {}", s),
            None => "texte prononcé".to_string(),
        });
    }
    // What the online voice did not say, the PC's own voice says.
    let reste = morceaux[depuis..].join(" ");
    match (text_to_speech(&reste).await, motif) {
        (Ok(_), Some(m)) => Ok(format!("voix du poste, faute de mieux : {}", m)),
        (Ok(r), None) => Ok(r),
        (Err(e), Some(m)) => Err(format!("{} ; et la voix du poste non plus : {}", m, e)),
        (Err(e), None) => Err(e),
    }
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

/// Marks the application as speaking for as long as it lives, whatever way
/// the playing ends.
struct Parle;

/// How many `Parle` guards are alive: a whole answer holds one while each of
/// its pieces holds its own, and the microphone must stay shut in the gap
/// between two pieces.
static PAROLES: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

impl Parle {
    fn commencer() -> Self {
        PAROLES.fetch_add(1, std::sync::atomic::Ordering::AcqRel);
        EN_TRAIN_DE_PARLER.store(true, std::sync::atomic::Ordering::Release);
        Parle
    }
}

impl Drop for Parle {
    fn drop(&mut self) {
        if PAROLES.fetch_sub(1, std::sync::atomic::Ordering::AcqRel) > 1 {
            return;
        }
        // The room keeps the voice a moment after the last sample left.
        std::thread::sleep(std::time::Duration::from_millis(250));
        if PAROLES.load(std::sync::atomic::Ordering::Acquire) == 0 {
            EN_TRAIN_DE_PARLER.store(false, std::sync::atomic::Ordering::Release);
            *FIN_DE_PAROLE.lock().unwrap() = Some(std::time::Instant::now());
        }
    }
}

fn jouer_wav(chemin: &std::path::Path) -> Result<(), String> {
    let _parle = Parle::commencer();
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

#[cfg(test)]
mod tests {

    #[test]
    fn la_premiere_phrase_part_seule_pour_que_la_voix_commence_tot() {
        let m = a_dire("Bonjour, je suis Victor. Test de délai.");
        assert_eq!(m, vec!["Bonjour, je suis Victor.".to_string(), "Test de délai.".to_string()]);
    }

    #[test]
    fn une_longue_reponse_se_dit_en_trois_phrases_et_renvoie_a_l_ecran() {
        let texte = "## Où en est l'équipe\n\n**Hugo** a fini la note. Nora prépare la liste.\n\n- Point 1 : les [investisseurs](https://x.fr) sont relancés.\n- Point 2 : le `dossier` est prêt.\n\n| a | b |\n|---|---|\n";
        let m = a_dire(texte);
        assert_eq!(m[0], "Où en est l'équipe.");
        assert_eq!(m[1], "Hugo a fini la note. Nora prépare la liste. Le détail est à l'écran.");
        assert!(!m.join(" ").contains(['*', '#', '|', '`', '[']));
    }

    #[test]
    fn une_reponse_courte_se_dit_en_entier_sans_renvoi() {
        let m = a_dire("Oui, je t'entends. Que veux-tu ?");
        assert_eq!(m.join(" "), "Oui, je t'entends. Que veux-tu ?");
        assert!(a_dire("  \n```\ncode\n```").is_empty());
    }

    #[test]
    fn un_mot_avec_un_tiret_bas_le_garde() {
        assert_eq!(sans_marques("_vraiment_ le fichier mon_dossier"), "vraiment le fichier mon_dossier");
    }

    #[test]
    fn la_parole_d_une_reponse_tient_le_micro_ferme_entre_deux_morceaux() {
        let toute = Parle::commencer();
        drop(Parle::commencer());
        assert!(EN_TRAIN_DE_PARLER.load(std::sync::atomic::Ordering::Acquire));
        drop(toute);
        assert!(!EN_TRAIN_DE_PARLER.load(std::sync::atomic::Ordering::Acquire));
    }
    use super::*;

    /// The listening engine must keep up with speech on the client's PC.
    /// Ignored by default (needs the real model): CI runs it on the Windows
    /// build with IAGENT_MODELE_ECOUTE set. On 12/10/2026 an 8 s window took
    /// 99 s on max's i5-4460 because ggml was built without AVX2; whisper pads
    /// every window to 30 s, so the content of the samples barely matters.
    #[test]
    #[ignore]
    fn banc_vitesse_ecoute() {
        let chemin = chemin_modele_ecoute();
        let contexte = WhisperContext::new_with_params(
            &chemin.to_string_lossy(),
            WhisperContextParameters::default(),
        )
        .expect("modèle d'écoute");
        let n = 8 * TAUX_WHISPER as usize;
        let son: Vec<f32> = (0..n)
            .map(|i| 0.1 * ((i as f32) * 0.05).sin() * ((i as f32) * 0.0007).sin())
            .collect();
        let limite: f64 = std::env::var("IAGENT_BANC_ECOUTE_SECONDES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(10.0);
        let debut = std::time::Instant::now();
        transcrire(&contexte, &son).expect("transcription");
        let duree = debut.elapsed().as_secs_f64();
        println!("8 s d'écoute transcrites en {:.2} s ; {}", duree, whisper_rs::print_system_info());
        assert!(duree < limite, "8 s d'écoute transcrites en {:.1} s, limite {} s", duree, limite);
    }

    /// A room's hiss, then `voix` seconds of speech, then `apres` seconds of room.
    fn piece_puis_parole(avant: f32, voix: f32, apres: f32) -> Vec<f32> {
        let n = TAUX_WHISPER as f32;
        let mut s: Vec<f32> = (0..(avant * n) as usize).map(|i| 0.002 * ((i as f32) * 0.37).sin()).collect();
        s.extend((0..(voix * n) as usize).map(|i| 0.08 * ((i as f32) * 0.05).sin()));
        s.extend((0..(apres * n) as usize).map(|i| 0.002 * ((i as f32) * 0.37).sin()));
        s
    }

    /// Feeds `son` to the cutter the way the microphone does, a fifth of a
    /// second at a time, and collects the sentences it hands back.
    fn decouper(son: &[f32]) -> (Vec<Vec<f32>>, usize) {
        let mut d = Decoupeur::default();
        let mut tampon = Vec::new();
        let mut phrases = Vec::new();
        for paquet in son.chunks(TAUX_WHISPER as usize / 5) {
            tampon.extend_from_slice(paquet);
            while let Some(p) = d.avancer(&mut tampon) {
                phrases.push(p);
            }
        }
        (phrases, tampon.len())
    }

    #[test]
    fn le_silence_n_est_jamais_transcrit() {
        // Seen on max's PC, 12/10/2026: the empty room transcribed as
        // « *musique* » and « ... », two cores busy doing it.
        let (phrases, garde) = decouper(&piece_puis_parole(10.0, 0.0, 0.0));
        assert!(phrases.is_empty());
        assert!(garde <= ATTENTE_GARDEE + TAUX_WHISPER as usize / 5, "le tampon garde {} échantillons", garde);
        let (phrases, _) = decouper(&vec![0.0; 5 * TAUX_WHISPER as usize]);
        assert!(phrases.is_empty());
    }

    #[test]
    fn une_phrase_est_rendue_entiere_une_fois_finie() {
        // Twelve seconds of speech: longer than the old 8 s window, which lost
        // the start of the sentence and the first name with it.
        let (phrases, _) = decouper(&piece_puis_parole(2.0, 12.0, 0.5));
        assert!(phrases.is_empty(), "rien avant la pause de fin");
        let (phrases, _) = decouper(&piece_puis_parole(2.0, 12.0, 1.5));
        assert_eq!(phrases.len(), 1);
        let secondes = phrases[0].len() as f32 / TAUX_WHISPER as f32;
        assert!((12.0..13.0).contains(&secondes), "phrase de {secondes} s");
    }

    #[test]
    fn deux_phrases_separees_d_une_pause_sont_deux_phrases() {
        let mut son = piece_puis_parole(1.0, 2.0, 1.5);
        son.extend(piece_puis_parole(0.0, 3.0, 1.5));
        let (phrases, _) = decouper(&son);
        assert_eq!(phrases.len(), 2);
    }

    #[test]
    fn un_clic_n_est_pas_une_phrase() {
        let (phrases, _) = decouper(&piece_puis_parole(1.0, 0.15, 2.0));
        assert!(phrases.is_empty());
    }

    #[test]
    fn une_voix_douce_compte_si_elle_se_detache_de_la_piece() {
        let n = TAUX_WHISPER as usize;
        let mut son = vec![0.0004; 2 * n];
        son.extend((0..2 * n).map(|i| 0.01 * ((i as f32) * 0.05).sin()));
        son.extend(vec![0.0004; 2 * n]);
        let (phrases, _) = decouper(&son);
        assert_eq!(phrases.len(), 1);
    }

    #[test]
    fn qui_parle_sans_s_arreter_est_coupe_quand_meme() {
        let (phrases, _) = decouper(&piece_puis_parole(1.0, 30.0, 0.0));
        assert_eq!(phrases.len(), 1);
        assert!(phrases[0].len() <= PHRASE_MAXIMUM + AVANT_LA_PAROLE);
    }

    #[test]
    fn le_tampon_ne_garde_que_la_fin() {
        let mut t: Vec<f32> = (0..10).map(|i| i as f32).collect();
        garder_la_fin(&mut t, 4);
        assert_eq!(t, vec![6.0, 7.0, 8.0, 9.0]);
        garder_la_fin(&mut t, 10);
        assert_eq!(t.len(), 4, "un tampon plus court que la limite reste entier");
    }

}
