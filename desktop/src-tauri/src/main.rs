#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::State;
use std::sync::Mutex;

mod voice;
mod fiches;
mod courriel;
mod journal;
mod navigateur;
mod agents;
mod connectors;
mod database;
mod llm;
mod voiceprint;
mod telegram;

use voice::VoiceState;
use agents::{AgentRouter, AgentCommand};
use llm::{LLMService, AgentPersona};
use voiceprint::{VoicePrintService, VoicePrint};
use telegram::{TelegramService, TelegramCredentials};
use database::Database;
use std::sync::Arc;

pub struct AppState {
    voice: Mutex<Option<VoiceState>>,
    agents: Mutex<AgentRouter>,
    llm: Mutex<Option<LLMService>>,
    telegram: Mutex<Option<TelegramCredentials>>,
    db: Arc<Mutex<Option<Database>>>,
}

/// Enrollment and verification must extract features at the same rate, or the
/// frames do not line up and the comparison is meaningless.
const TAUX_ECHANTILLONNAGE: u32 = 44_100;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
fn init_voice(state: State<AppState>) -> Result<String, String> {
    // Initialize voice with default model path (typically bundled)
    let model_path = voice::chemin_modele_ecoute();

    match VoiceState::new(&model_path) {
        Ok(voice_state) => {
            let mut voice = state.voice.lock().unwrap();
            *voice = Some(voice_state);
            Ok("Voice module initialized".to_string())
        }
        Err(e) => Err(format!("Failed to initialize voice: {}", e))
    }
}

#[tauri::command]
fn start_voice_recognition(state: State<AppState>) -> Result<String, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.start_listening()
    } else {
        Err("Voice not initialized. Call init_voice first.".to_string())
    }
}

#[tauri::command]
fn stop_voice_recognition(state: State<AppState>) -> Result<String, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.stop_listening()
    } else {
        Err("Voice not initialized".to_string())
    }
}

#[tauri::command]
fn process_voice_audio(audio_data: Vec<i16>, state: State<AppState>) -> Result<Option<String>, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.process_audio(&audio_data)
    } else {
        Err("Voice not initialized".to_string())
    }
}

#[tauri::command]
fn get_partial_result(state: State<AppState>) -> Result<Option<String>, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.get_partial_result().map(Some)
    } else {
        Err("Voice not initialized".to_string())
    }
}

#[tauri::command]
fn init_llm(state: State<AppState>) -> Result<String, String> {
    match LLMService::new() {
        Ok(service) => {
            let mut llm = state.llm.lock().unwrap();
            *llm = Some(service);
            Ok("LLM service initialized".to_string())
        }
        Err(e) => Err(format!("Failed to initialize LLM: {}", e))
    }
}

#[tauri::command]
async fn call_agent_llm(
    agent_id: String,
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let agent = {
        let agents = state.agents.lock().unwrap();
        agents
            .list_agents()
            .iter()
            .find(|a| a.id == agent_id)
            .cloned()
            .ok_or("Agent not found".to_string())?
    };

    // Le service est copié puis le verrou relâché : le garder à travers le .await
    // rendrait la commande non transmissible entre fils d'exécution.
    let llm_service = {
        let llm = state.llm.lock().unwrap();
        llm.as_ref().ok_or("LLM not initialized")?.clone()
    };

    let persona = AgentPersona {
        id: agent.id.clone(),
        name: agent.name.clone(),
        role: agent.description.clone(),
        system_prompt: format!(
            "You are {}, a {}. Respond concisely and helpfully to user requests.",
            agent.name, agent.description
        ),
    };

    llm_service.call_agent_llm(&persona, &command).await
}

/// Le prompt vient de l'interface, qui l'assemble depuis la vraie fiche :
/// consigne d'expert, connaissances du metier, savoir de la maison, genre choisi
/// par le client. Le construire ici a partir du routeur code en dur donnerait un
/// agent generique, en anglais, qui ignore tout ce que la fiche decrit.
#[tauri::command]
async fn repondre(
    prenom: String,
    prompt_systeme: String,
    enonce: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if prompt_systeme.trim().is_empty() {
        return Err("prompt systeme vide : la fiche n a pas ete chargee".to_string());
    }

    let llm_service = {
        let llm = state.llm.lock().unwrap();
        llm.as_ref().ok_or("LLM not initialized")?.clone()
    };

    let persona = AgentPersona {
        id: prenom.clone(),
        name: prenom,
        role: String::new(),
        system_prompt: prompt_systeme,
    };

    llm_service.call_agent_llm(&persona, &enonce).await
}

#[tauri::command]
fn route_voice_command(utterance: String, state: State<AppState>) -> Result<AgentCommand, String> {
    let agents = state.agents.lock().unwrap();
    agents.route_voice_command(&utterance)
}

#[tauri::command]
fn get_agents(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let agents = state.agents.lock().unwrap();
    let agent_list = agents.list_agents();

    Ok(agent_list
        .iter()
        .map(|a| serde_json::json!({
            "id": a.id,
            "name": a.name,
            "description": a.description,
            "status": a.status,
        }))
        .collect())
}

#[tauri::command]
fn activate_agent(agent_id: String, state: State<AppState>) -> Result<serde_json::Value, String> {
    let mut agents = state.agents.lock().unwrap();
    match agents.activate_agent(&agent_id) {
        Ok(agent) => Ok(serde_json::json!({
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "status": agent.status,
        })),
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn deactivate_agent(agent_id: String, state: State<AppState>) -> Result<serde_json::Value, String> {
    let mut agents = state.agents.lock().unwrap();
    match agents.deactivate_agent(&agent_id) {
        Ok(agent) => Ok(serde_json::json!({
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "status": agent.status,
        })),
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn enroll_voice(
    user_id: String,
    audio_samples: Vec<Vec<i16>>,
    state: State<AppState>,
) -> Result<String, String> {
    if audio_samples.is_empty() {
        return Err("No audio samples provided".to_string());
    }

    let voice_print = VoicePrintService::create_voice_print(&user_id, audio_samples, TAUX_ECHANTILLONNAGE)
        .map_err(|e| format!("Voice enrollment failed: {}", e))?;

    // An enrollment that was not persisted cannot be verified later. Reporting
    // success on a failed write would leave the user believing their voice is
    // known, while every verification would find nothing to compare against.
    let mfcc_json = serde_json::to_string(&voice_print.mfcc_features)
        .map_err(|e| format!("Voice enrollment failed: {}", e))?;

    let verrou = state
        .db
        .lock()
        .map_err(|_| "Voice enrollment failed: database is locked".to_string())?;
    let db = verrou
        .as_ref()
        .ok_or("Voice enrollment failed: no database on this machine")?;
    db.save_voice_print(&user_id, &mfcc_json)
        .map_err(|e| format!("Voice enrollment failed: {}", e))?;

    Ok(format!(
        "Voice enrollment complete. Voice print ID: {}",
        voice_print.id
    ))
}

/// Compare a sample against the voice print enrolled for this user.
///
/// The score is real, but the features behind it are not a biometric: the
/// extractor in `voiceprint.rs` computes zero-crossing rate, energy and a
/// spectral approximation, not true MFCCs. Two different speakers in the same
/// room score close together. **This score must not, on its own, grant access
/// to anything.** Until the extractor is replaced by a real one and measured
/// against a false-acceptance target, the interface says the agent answers to
/// its first name, not to a voice.
#[tauri::command]
fn verify_voice(
    user_id: String,
    audio_sample: Vec<i16>,
    state: State<AppState>,
) -> Result<f32, String> {
    if audio_sample.is_empty() {
        return Err("No audio sample provided".to_string());
    }

    let stocke = {
        let verrou = state
            .db
            .lock()
            .map_err(|_| "Database is locked".to_string())?;
        let db = verrou
            .as_ref()
            .ok_or("No database on this machine: nothing was ever enrolled")?;
        db.get_voice_print(&user_id)?
    };

    // No enrollment means no comparison. Returning a passing score here was the
    // whole bug: an unknown speaker scored as well as the owner.
    let stocke = stocke.ok_or_else(|| format!("No voice print enrolled for {}", user_id))?;

    let mfcc_features: Vec<Vec<f32>> = serde_json::from_str(&stocke.mfcc_data)
        .map_err(|e| format!("Stored voice print is unreadable: {}", e))?;
    if mfcc_features.is_empty() {
        return Err(format!("Voice print enrolled for {} is empty", user_id));
    }

    let empreinte = VoicePrint {
        id: stocke.id,
        user_id: stocke.user_id,
        mfcc_features,
        enrollment_date: stocke.created_at,
        is_active: true,
    };

    Ok(VoicePrintService::verify_voice(
        &audio_sample,
        &empreinte,
        TAUX_ECHANTILLONNAGE,
    ))
}

#[tauri::command]
fn train_voice(utterances: Vec<String>, state: State<AppState>) -> Result<String, String> {
    let voice_guard = state.voice.lock().unwrap();

    if voice_guard.is_some() {
        println!("Training voice with {} utterances", utterances.len());
        // Voice training now done via enroll_voice with actual audio samples
        Ok(format!(
            "Voice training prepared. Use enroll_voice with audio samples to complete."
        ))
    } else {
        Err("Voice not initialized".to_string())
    }
}

#[tauri::command]
async fn text_to_speech(text: String) -> Result<String, String> {
    voice::text_to_speech(&text).await
}

#[tauri::command]
async fn connect_telegram(
    bot_token: String,
    chat_id: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if bot_token.is_empty() || chat_id.is_empty() {
        return Err("Token and Chat ID cannot be empty".to_string());
    }

    match TelegramService::connect_telegram(bot_token, chat_id).await {
        Ok(credentials) => {
            // Le jeton du bot reste en mémoire, jamais sur le disque : il était
            // écrit en clair dans le SQLite du poste et jamais relu. Le jour où
            // la connexion devra survivre à un redémarrage, elle passera par le
            // coffre du système (Credential Manager, Trousseau), pas par cette base.
            let mut telegram = state.telegram.lock().unwrap();
            *telegram = Some(credentials);
            Ok("Telegram connected successfully".to_string())
        }
        Err(e) => Err(format!("Failed to connect Telegram: {}", e)),
    }
}

#[tauri::command]
fn get_telegram_instructions() -> Result<String, String> {
    Ok(TelegramService::get_connection_instructions())
}

#[tauri::command]
async fn send_telegram_message(
    text: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let credentials = {
        let telegram = state.telegram.lock().unwrap();
        telegram.clone()
    };

    match credentials {
        Some(credentials) => TelegramService::send_message(&credentials, &text).await,
        None => Err("Telegram not connected. Call connect_telegram first.".to_string()),
    }
}

fn main() {
    // Initialize database
    let db = match Database::new("iagent.db") {
        Ok(database) => {
            if let Err(e) = database.init() {
                eprintln!("Failed to initialize database: {}", e);
            }
            Some(database)
        }
        Err(e) => {
            eprintln!("Failed to create database: {}", e);
            None
        }
    };

    let state = AppState {
        voice: Mutex::new(None),
        agents: Mutex::new(AgentRouter::new()),
        llm: Mutex::new(None),
        telegram: Mutex::new(None),
        db: Arc::new(Mutex::new(db)),
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            greet,
            init_voice,
            start_voice_recognition,
            stop_voice_recognition,
            process_voice_audio,
            get_partial_result,
            text_to_speech,
            enroll_voice,
            verify_voice,
            init_llm,
            call_agent_llm,
            route_voice_command,
            get_agents,
            activate_agent,
            deactivate_agent,
            train_voice,
            connect_telegram,
            get_telegram_instructions,
            send_telegram_message,
            fiches::lire_installation,
            fiches::lire_fiche,
            repondre,
            courriel::courriel_enregistrer_motdepasse,
            courriel::courriel_motdepasse_present,
            courriel::courriel_relever,
            courriel::courriel_envoyer,
            courriel::courriel_envois,
            journal::journal_lire,
            journal::journal_ajouter,
            navigateur::navigateur_ouvrir,
            navigateur::navigateur_fermer,
            navigateur::navigateur_sites,
            navigateur::navigateur_declarer_site,
            navigateur::navigateur_oublier_site,
            navigateur::navigateur_effacer_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
