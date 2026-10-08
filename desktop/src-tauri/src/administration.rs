//! The « Administration iAgent » space: the back-office screens
//! (`back-office/src/Administration.jsx`) mounted in the Desktop Commander.
//!
//! Thin commands only. Every rule — declared routes, address, the admin token
//! in the keyring and never returned, platform errors kept verbatim — lives in
//! the `iagent-back-office-admin` crate, shared with the standalone back-office
//! app (same model as `back-office/src-tauri/src/main.rs`). Writing them twice
//! would make them say two things.
//!
//! The space is hidden unless `admin_present` says true: the admin token is in
//! the keyring (`iagent-back-office` / `jeton-admin`, the same entry the
//! back-office app uses, so a token set there opens the space here). Only the
//! boolean crosses to JavaScript.

use iagent_back_office_admin as admin;
use serde_json::Value;

/// The back-office settings (platform address) live with the rest of what the
/// customer writes: under the writable root, never next to the executable.
fn dossier_reglages() -> std::path::PathBuf {
    crate::chemins::pour_ecrire("config/administration")
}

#[tauri::command]
pub fn admin_present() -> bool {
    admin::jeton_present()
}

#[tauri::command]
pub async fn plateforme_appeler(
    nom: String,
    methode: String,
    chemin: String,
    corps: Option<Value>,
) -> Result<Value, admin::ErreurAppel> {
    let adresse = admin::adresse_lire(&dossier_reglages());
    if adresse.is_empty() {
        return Err(admin::ErreurAppel {
            erreur: "Aucune adresse de plateforme n'est réglée : rien n'a été envoyé.".into(),
            statut: 0,
            plateforme: false,
        });
    }
    admin::appeler(&adresse, &nom, &methode, &chemin, corps).await
}

#[tauri::command]
pub fn jeton_poser(jeton: String) -> Result<String, String> {
    admin::jeton_poser(&jeton)
}

#[tauri::command]
pub fn jeton_present() -> bool {
    admin::jeton_present()
}

#[tauri::command]
pub fn jeton_oublier() -> Result<String, String> {
    admin::jeton_oublier()
}

#[tauri::command]
pub fn adresse_lire() -> Result<String, String> {
    Ok(admin::adresse_lire(&dossier_reglages()))
}

#[tauri::command]
pub fn adresse_poser(adresse: String) -> Result<String, String> {
    admin::adresse_poser(&dossier_reglages(), &adresse)
}
