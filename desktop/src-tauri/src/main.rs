#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::Manager;

mod voice;
mod agents;
mod connectors;
mod database;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

#[tauri::command]
fn start_voice_recognition() -> Result<String, String> {
    println!("Starting voice recognition...");
    Ok("Voice recognition started".to_string())
}

#[tauri::command]
fn get_agents() -> Result<Vec<serde_json::Value>, String> {
    // Load sample agents for Phase 1
    let agents = vec![
        serde_json::json!({
            "id": "AG-0001",
            "name": "Albert",
            "description": "Assistant productivité"
        }),
        serde_json::json!({
            "id": "AG-0002",
            "name": "Justine",
            "description": "Assistante communication"
        }),
    ];
    Ok(agents)
}

#[tauri::command]
fn train_voice(utterances: Vec<String>) -> Result<String, String> {
    println!("Training voice with {} utterances", utterances.len());
    Ok("Voice training complete".to_string())
}

#[tauri::command]
fn connect_telegram(token: String) -> Result<String, String> {
    println!("Connecting to Telegram with token: {}", &token[..4]);
    Ok("Telegram connected".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            start_voice_recognition,
            get_agents,
            train_voice,
            connect_telegram
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
