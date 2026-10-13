// iAgent Back-office: the internal desktop app that administers the platform.
//
// The interface never sees the admin token after typing it: `jeton_poser`
// puts it in the system keyring, and `plateforme_appeler` attaches it in Rust.
// All the rules (declared routes, address, verbatim errors) live in the
// `iagent-back-office-admin` crate, shared with the Desktop Commander.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use iagent_back_office_admin as admin;
use serde_json::Value;
use tauri::Manager;

fn dossier_reglages(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_config_dir().map_err(|e| format!("Le dossier des réglages est introuvable : {e}"))
}

#[tauri::command]
async fn plateforme_appeler(app: tauri::AppHandle, nom: String, methode: String, chemin: String, corps: Option<Value>) -> Result<Value, admin::ErreurAppel> {
    let dossier = dossier_reglages(&app).map_err(|e| admin::ErreurAppel { erreur: e, statut: 0, plateforme: false })?;
    let adresse = admin::adresse_lire(&dossier);
    if adresse.is_empty() {
        return Err(admin::ErreurAppel { erreur: "Aucune adresse de plateforme n'est réglée : rien n'a été envoyé.".into(), statut: 0, plateforme: false });
    }
    admin::appeler(&adresse, &nom, &methode, &chemin, corps).await
}

#[tauri::command]
fn jeton_poser(jeton: String) -> Result<String, String> {
    admin::jeton_poser(&jeton)
}

#[tauri::command]
fn jeton_present() -> bool {
    admin::jeton_present()
}

#[tauri::command]
fn jeton_oublier() -> Result<String, String> {
    admin::jeton_oublier()
}

#[tauri::command]
fn adresse_lire(app: tauri::AppHandle) -> Result<String, String> {
    Ok(admin::adresse_lire(&dossier_reglages(&app)?))
}

#[tauri::command]
fn adresse_poser(app: tauri::AppHandle, adresse: String) -> Result<String, String> {
    admin::adresse_poser(&dossier_reglages(&app)?, &adresse)
}

// ---- e-mail studio (admin/src/courriel.rs) ---------------------------------

#[derive(serde::Serialize)]
struct EtatSmtp {
    #[serde(flatten)]
    reglages: admin::courriel::Reglages,
    mot_de_passe_present: bool,
}

#[tauri::command]
fn smtp_reglages(app: tauri::AppHandle) -> Result<EtatSmtp, String> {
    Ok(EtatSmtp { reglages: admin::courriel::reglages_lire(&dossier_reglages(&app)?), mot_de_passe_present: admin::courriel::mot_de_passe_present() })
}

#[tauri::command]
fn smtp_poser_reglages(app: tauri::AppHandle, reglages: admin::courriel::Reglages) -> Result<String, String> {
    let r = admin::courriel::reglages_poser(&dossier_reglages(&app)?, &reglages)?;
    Ok(format!("Réglages enregistrés : {} port {} ({}), identifiant {}.", r.hote, r.port, r.securite, r.utilisateur))
}

#[tauri::command]
fn smtp_poser_mot_de_passe(mot_de_passe: String) -> Result<String, String> {
    admin::courriel::mot_de_passe_poser(&mot_de_passe)
}

#[tauri::command]
fn smtp_oublier_mot_de_passe() -> Result<String, String> {
    admin::courriel::mot_de_passe_oublier()
}

/// One message, one recipient, one click: there is no list and no loop.
#[tauri::command]
async fn courriel_envoyer(app: tauri::AppHandle, envoi: admin::courriel::Envoi) -> Result<admin::courriel::Trace, String> {
    admin::courriel::envoyer(&dossier_reglages(&app)?, &envoi).await
}

#[tauri::command]
fn courriel_journal(app: tauri::AppHandle) -> Result<Vec<admin::courriel::Trace>, String> {
    Ok(admin::courriel::journal_lire(&dossier_reglages(&app)?))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            plateforme_appeler, jeton_poser, jeton_present, jeton_oublier, adresse_lire, adresse_poser,
            smtp_reglages, smtp_poser_reglages, smtp_poser_mot_de_passe, smtp_oublier_mot_de_passe, courriel_envoyer, courriel_journal
        ])
        .run(tauri::generate_context!())
        .expect("iAgent Back-office ne démarre pas");
}
