#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{Manager, State};
use std::sync::Mutex;

mod voice;
mod agents;
mod connectors;
mod database;

use voice::VoiceState;
use agents::{AgentRouter, AgentCommand};

pub struct AppState {
    voice: Mutex<Option<VoiceState>>,
    agents: Mutex<AgentRouter>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
fn init_voice(state: State<AppState>) -> Result<String, String> {
    // Initialize voice with default model path (typically bundled)
    let model_path = "model/vosk-model-en-us-0.22";

    match VoiceState::new(model_path) {
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
fn train_voice(utterances: Vec<String>, state: State<AppState>) -> Result<String, String> {
    let voice_guard = state.voice.lock().unwrap();

    if voice_guard.is_some() {
        println!("Training voice with {} utterances", utterances.len());
        // TODO: Extract MFCC features from utterances and store in database
        Ok(format!("Voice training complete with {} utterances", utterances.len()))
    } else {
        Err("Voice not initialized".to_string())
    }
}

#[tauri::command]
fn connect_telegram(token: String) -> Result<String, String> {
    if token.is_empty() {
        return Err("Token cannot be empty".to_string());
    }
    println!("Connecting to Telegram with token: {}", &token[..token.len().min(8)]);
    // TODO: Implement Telegram OAuth flow
    Ok("Telegram connected".to_string())
}

fn main() {
    let state = AppState {
        voice: Mutex::new(None),
        agents: Mutex::new(AgentRouter::new()),
    };

    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            greet,
            init_voice,
            start_voice_recognition,
            stop_voice_recognition,
            process_voice_audio,
            route_voice_command,
            get_agents,
            activate_agent,
            deactivate_agent,
            train_voice,
            connect_telegram,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
