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
mod mcp;
mod modele;
mod navigateur;
mod tache;
mod document;
mod jauge;
mod ressources;
mod reveil;
mod telechargement;
mod pdf;
mod lecture;
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
    /// Ou en est le mot de reveil, et si l'ecoute est allumee. L'etat vit ici
    /// et pas a l'ecran : c'est le code qui doit tenir la regle de max, pas une
    /// variable React qu'un rechargement de page remettrait a zero.
    ecoute: Mutex<Ecoute>,
}

/// L'ecoute telle que le bouton VOICE la montre, et telle que le mot de reveil
/// la fait avancer.
struct Ecoute {
    /// Vert ou rouge : le client peut couper le micro d'un clic. Eteinte, plus
    /// rien n'est ecoute, meme pas le mot de reveil.
    active: bool,
    ou_en_est: reveil::Etat,
}

impl Default for Ecoute {
    fn default() -> Self {
        // Allumee par defaut : le produit se vend sur le fait qu'on lui parle.
        Ecoute { active: true, ou_en_est: reveil::Etat::Dormante }
    }
}

/// Ce que l'ecran lit pour peindre le bouton VOICE et le noyau anime.
#[derive(serde::Serialize)]
struct EcouteVue {
    active: bool,
    ou_en_est: reveil::Etat,
}

/// L'etat de l'ecoute, pour le bouton VOICE (vert = actif, rouge = inactif).
#[tauri::command]
fn voix_ecoute_etat(state: State<'_, AppState>) -> EcouteVue {
    let e = state.ecoute.lock().unwrap();
    EcouteVue { active: e.active, ou_en_est: e.ou_en_est.clone() }
}

/// Allume ou coupe l'ecoute. Couper rendort aussi le mot de reveil : sinon
/// l'ecoute reprendrait la ou elle en etait, et le client qui a coupe pour
/// parler tranquillement retrouverait un agent qui attend son prenom.
#[tauri::command]
fn voix_ecoute_basculer(active: bool, state: State<'_, AppState>) -> EcouteVue {
    let mut e = state.ecoute.lock().unwrap();
    e.active = active;
    e.ou_en_est = reveil::Etat::Dormante;
    EcouteVue { active: e.active, ou_en_est: e.ou_en_est.clone() }
}

/// Ce que l'ecoute conclut de ce qu'elle vient d'entendre.
///
/// L'ecran transcrit et passe le texte ici ; c'est Rust qui decide, parce que
/// c'est la regle de max et qu'une regle tenue par l'ecran se perd au premier
/// rechargement. Les prenoms viennent de `installation.json`, jamais de
/// l'ecran : un agent qu'on n'a pas embauche ne repond pas.
#[tauri::command]
fn voix_entendu(texte: String, state: State<'_, AppState>) -> reveil::Reaction {
    let mut e = state.ecoute.lock().unwrap();
    if !e.active {
        return reveil::Reaction::Rien;
    }
    let prenoms = prenoms_embauches();
    let (apres, reaction) = reveil::entendu(&e.ou_en_est, &texte, &prenoms);
    e.ou_en_est = apres;
    reaction
}

/// Les prenoms que ce client a donnes a SES agents. Une installation illisible
/// ne fait repondre personne, ce qui est le bon sens de l'echec ici.
fn prenoms_embauches() -> Vec<String> {
    crate::fiches::lire_installation()
        .ok()
        .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
        .and_then(|c| c.get("agents")?.as_array().cloned())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.get("prenom")?.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
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
    // Ce qui manque se dit AVANT d'essayer. whisper-rs rend « failed to load
    // model », qui ne nomme ni le fichier ni ce que le client peut y faire, et
    // l'écran le montrait tel quel, en anglais, à un client francophone.
    if let Some(manque) = ressources::manque_pour_ecouter() {
        return Err(manque);
    }

    let model_path = voice::chemin_modele_ecoute();
    match VoiceState::new(&model_path) {
        Ok(voice_state) => {
            let mut voice = state.voice.lock().unwrap();
            *voice = Some(voice_state);
            Ok("Écoute prête.".to_string())
        }
        // Le fichier est là et ne se charge pas : ce n'est plus le même problème,
        // et renvoyer au README enverrait le client retélécharger pour rien.
        Err(e) => Err(format!(
            "Le modèle d'écoute est bien là mais n'a pas pu être chargé : {}",
            e
        )),
    }
}

#[tauri::command]
fn start_voice_recognition(state: State<AppState>) -> Result<String, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.start_listening()
    } else {
        Err("L'écoute n'est pas prête sur ce poste.".to_string())
    }
}

#[tauri::command]
fn stop_voice_recognition(state: State<AppState>) -> Result<String, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.stop_listening()
    } else {
        Err("L'écoute n'est pas prête sur ce poste.".to_string())
    }
}

#[tauri::command]
fn process_voice_audio(audio_data: Vec<i16>, state: State<AppState>) -> Result<Option<String>, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.process_audio(&audio_data)
    } else {
        Err("L'écoute n'est pas prête sur ce poste.".to_string())
    }
}

#[tauri::command]
fn get_partial_result(state: State<AppState>) -> Result<Option<String>, String> {
    let voice_guard = state.voice.lock().unwrap();

    if let Some(voice) = voice_guard.as_ref() {
        voice.get_partial_result().map(Some)
    } else {
        Err("L'écoute n'est pas prête sur ce poste.".to_string())
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
/// Ce que l'agent a repondu, et par ou il est passe pour le dire.
///
/// La voie fait partie de la reponse et pas d'un reglage cache : un agent qui
/// bascule sur l'API se met a couter des jetons, et le client a le droit de
/// l'apprendre en le lisant plutot que sur sa facture.
#[derive(serde::Serialize)]
struct ReponseAgent {
    texte: String,
    motif: String,
    bascule: bool,
}

#[tauri::command]
async fn repondre(
    prenom: String,
    fiche_id: String,
    prompt_systeme: String,
    enonce: String,
    state: State<'_, AppState>,
) -> Result<ReponseAgent, String> {
    if prompt_systeme.trim().is_empty() {
        return Err("prompt systeme vide : la fiche n a pas ete chargee".to_string());
    }

    // La fiche dit ou ce poste travaille. Jusqu'ici personne ne le lisait et
    // tout passait par l'API, quoi qu'elle dise. Ce que le client a repondu a
    // l'entretien restreint ensuite ce que la fiche permet : il l'a choisi en
    // connaissant la facture, et la question le lui promettait.
    let (fiche_dit, exemples) = modele::contexte_de_la_fiche(&fiche_id)?;
    let execution = modele::selon_le_client(
        &fiche_dit,
        crate::fiches::lire_installation()
            .ok()
            .and_then(|c| modele::repartition_du_client(&c, &prenom))
            .as_deref(),
    );
    let offre = modele::Offre {
        locaux: modele::modeles_installes(modele::ADRESSE_LOCALE).await.ok(),
        cle_api: llm::cle_api().is_some(),
        memoire_insuffisante: jauge::memoire_insuffisante_pour(&fiche_id),
    };
    let choix = modele::choisir(&execution, &exemples, &offre, llm::MODELE_API)?;

    let texte = match &choix.voie {
        modele::Voie::Local { modele: nom } => {
            modele::repondre_en_local(modele::ADRESSE_LOCALE, nom, &prompt_systeme, &enonce).await?
        }
        modele::Voie::Api { .. } => {
            let llm_service = {
                let llm = state.llm.lock().unwrap();
                llm.as_ref()
                    .ok_or("aucune cle d API n est enregistree sur cet ordinateur")?
                    .clone()
            };
            let persona = AgentPersona {
                id: prenom.clone(),
                name: prenom,
                role: String::new(),
                system_prompt: prompt_systeme,
            };
            llm_service.call_agent_llm(&persona, &enonce).await?
        }
    };

    Ok(ReponseAgent { texte, motif: choix.motif, bascule: choix.bascule })
}

/// Exécute une tâche de l'agent et pose le résultat dans le dossier du client.
///
/// Le parcours minimal du cadrage s'arrêtait ici : les fiches décrivent
/// 9 233 tâches et aucune ne pouvait s'exécuter. Ce qui décide — l'agent est-il
/// embauché, la tâche est-elle allumée, le dossier a-t-il été choisi, le format
/// est-il seulement écrivable — est dans `tache::preparer`, éprouvé à part ;
/// cette commande ne fait que le suivre, appeler le modèle par la même route que
/// la conversation, et écrire.
///
/// Rien ne part du poste : un résultat qui attend un accord est écrit et le dit.
#[tauri::command]
async fn executer_tache(
    prenom: String,
    fiche_id: String,
    tache_id: String,
    state: State<'_, AppState>,
) -> Result<tache::Resultat, String> {
    let installation = fiches::lire_installation()?;
    let fiche = fiches::lire_fiche(fiche_id.clone())?;
    let maintenant = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Ce que l'employeur a déjà repris à cet agent le suit dans son travail
    // écrit, pas seulement dans la conversation : une correction qui ne vaut
    // que pour ce qu'il dit, il la refait dans ce qu'il rend.
    let repris: Vec<String> = journal::journal_lire(prenom.clone())
        .unwrap_or_default()
        .into_iter()
        .map(|e| e.raison)
        .collect();
    let prep = tache::preparer(
        &installation, &fiche, &prenom, &fiche_id, &tache_id, maintenant, &repris,
    )?;

    // La matière d'abord : un agent à qui on ne donne rien produit un résultat
    // vraisemblable et faux, que le client n'a aucun moyen de démentir.
    let mut matiere = tache::Matiere::default();
    for source in &prep.sources {
        let lue = tache::lire_matiere(source);
        matiere.textes.extend(lue.textes);
        matiere.non_lus.extend(lue.non_lus);
        matiere.tronque |= lue.tronque;
    }
    let enonce = format!(
        "{}{}",
        prep.enonce,
        tache::matiere_en_mots(&matiere, prep.source_declaree)
    );

    // Meme regle qu'en conversation : la fiche d'abord, le choix du client
    // ensuite. Les deux chemins doivent trancher pareil, sinon l'agent parlerait
    // en local et travaillerait par l'API.
    let (fiche_dit, exemples) = modele::contexte_de_la_fiche(&fiche_id)?;
    let execution = modele::selon_le_client(
        &fiche_dit,
        crate::fiches::lire_installation()
            .ok()
            .and_then(|c| modele::repartition_du_client(&c, &prenom))
            .as_deref(),
    );
    let offre = modele::Offre {
        locaux: modele::modeles_installes(modele::ADRESSE_LOCALE).await.ok(),
        cle_api: llm::cle_api().is_some(),
        memoire_insuffisante: jauge::memoire_insuffisante_pour(&fiche_id),
    };
    let choix = modele::choisir(&execution, &exemples, &offre, llm::MODELE_API)?;

    let texte = match &choix.voie {
        modele::Voie::Local { modele: nom } => {
            modele::repondre_en_local(modele::ADRESSE_LOCALE, nom, &prep.systeme, &enonce).await?
        }
        modele::Voie::Api { .. } => {
            let llm_service = {
                let llm = state.llm.lock().unwrap();
                llm.as_ref()
                    .ok_or("aucune cle d API n est enregistree sur cet ordinateur")?
                    .clone()
            };
            let persona = AgentPersona {
                id: prenom.clone(),
                name: prenom.clone(),
                role: String::new(),
                system_prompt: prep.systeme.clone(),
            };
            llm_service.call_agent_llm(&persona, &enonce).await?
        }
    };

    // Un fichier vide serait pire qu'une erreur : le client croirait le travail
    // fait. Le modèle qui n'a rien rendu est un échec, pas un résultat.
    if texte.trim().is_empty() {
        return Err(format!(
            "{} n'a rien rendu pour cette tâche : aucun fichier n'a été écrit",
            prenom
        ));
    }

    let chemin = if tache::est_un_tableau(&prep.format) {
        // Le modèle rend des lignes ; le classeur, c'est nous.
        tache::poser_tableur(
            &prep.dossier,
            &prep.nom_fichier,
            &tache::lignes_du_tableau(&texte),
        )?
    } else if tache::est_un_courriel(&prep.format) {
        // Le modèle rend un objet et une lettre ; les en-têtes, c'est nous.
        tache::poser_courriel(&prep.dossier, &prep.nom_fichier, prep.epoque, &texte)?
    } else if tache::est_un_document(&prep.format) {
        // Le modèle rend du texte avec ses titres et ses puces ; la boîte,
        // c'est nous — le même texte part en OOXML ou en PDF.
        if prep.format == "pdf" {
            pdf::poser_pdf(&prep.dossier, &prep.nom_fichier, prep.epoque, &texte)?
        } else {
            document::poser_document(&prep.dossier, &prep.nom_fichier, &texte)?
        }
    } else {
        tache::poser(&prep.dossier, &prep.nom_fichier, &texte)?
    };
    Ok(tache::Resultat {
        fichier: chemin.display().to_string(),
        voie: match &choix.voie {
            modele::Voie::Local { .. } => "local".to_string(),
            modele::Voie::Api { .. } => "api".to_string(),
        },
        motif: choix.motif,
        validation_humaine: prep.validation_humaine,
    })
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
        Err("L'écoute n'est pas prête sur ce poste.".to_string())
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
        ecoute: Mutex::new(Ecoute::default()),
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
            fiches::installation_ecrire,
            fiches::lire_referentiel,
            mcp::mcp_serveurs,
            mcp::mcp_ranger_secret,
            mcp::mcp_outils_permis,
            mcp::mcp_appeler,
            mcp::mcp_journal,
            modele::modele_etat,
            jauge::jauge_etat,
            voix_ecoute_etat,
            voix_ecoute_basculer,
            voix_entendu,
            telechargement::voix_a_installer,
            telechargement::voix_installer,
            llm::cle_api_ranger,
            llm::cle_api_presente,
            llm::cle_api_retirer,
            executer_tache,
            tache::dossier_de_travail,
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
