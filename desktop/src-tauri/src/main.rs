#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{Manager, State};
use std::sync::Mutex;

mod voice;
mod chemins;
mod fiches;
mod courriel;
mod journal;
mod mcp;
mod modele;
mod navigateur;
mod tache;
mod equipe;
mod document;
mod jauge;
mod ressources;
mod reveil;
mod telechargement;
mod pdf;
mod lecture;
mod agents;
mod database;
mod llm;
mod voiceprint;
mod telegram;
mod whatsapp;
mod mise_a_jour;
mod partage;
mod mission;
mod voix_api;
mod transcription;
mod plateforme;
mod administration;

use voice::VoiceState;
use agents::{AgentRouter, AgentCommand};
use llm::{LLMService, AgentPersona};
use voiceprint::Comparaison;
use database::Database;
use std::sync::Arc;

pub struct AppState {
    voice: Mutex<Option<VoiceState>>,
    /// Les phrases enregistrées pendant l'entretien, le temps de l'entretien.
    ///
    /// Le son ne traverse jamais l'écran : ce qui en sort est une empreinte de
    /// douze nombres. Faire l'aller-retour en JSON coûterait un mégaoctet par
    /// empreinte et mettrait la voix du client dans la fenêtre du navigateur.
    empreinte_en_cours: Mutex<Vec<Vec<i16>>>,
    agents: Mutex<AgentRouter>,
    llm: Mutex<Option<LLMService>>,
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
    /// Quand le client a parle a un agent pour la derniere fois.
    dernier_echange: Option<std::time::Instant>,
}

impl Default for Ecoute {
    fn default() -> Self {
        // Allumee par defaut : le produit se vend sur le fait qu'on lui parle.
        Ecoute { active: true, ou_en_est: reveil::Etat::Dormante, dernier_echange: None }
    }
}

impl Ecoute {
    /// Closes a conversation the client left: nothing said to the agent for
    /// `CONVERSATION_OUVERTE` since it last spoke or was last spoken to.
    fn fermer_si_delaissee(&mut self) {
        // Never while the agent is still speaking: a long answer outlasted the
        // window, and the client's follow-ups were lost (max, 12/10/2026).
        if matches!(self.ou_en_est, reveil::Etat::Dormante)
            || voice::EN_TRAIN_DE_PARLER.load(std::sync::atomic::Ordering::Acquire)
        {
            return;
        }
        let parle = *voice::FIN_DE_PAROLE.lock().unwrap();
        let depuis = [self.dernier_echange, parle].into_iter().flatten().max();
        if depuis.is_none_or(|t| t.elapsed() > CONVERSATION_OUVERTE) {
            self.ou_en_est = reveil::Etat::Dormante;
        }
    }
}

/// Ce que l'ecran lit pour peindre le bouton VOICE et le noyau anime.
/// `avec` : l'agent avec qui la conversation est ouverte.
#[derive(serde::Serialize)]
struct EcouteVue {
    active: bool,
    ou_en_est: &'static str,
    avec: Option<String>,
}

impl EcouteVue {
    fn de(e: &Ecoute) -> Self {
        EcouteVue { active: e.active, ou_en_est: e.ou_en_est.nom(), avec: e.ou_en_est.avec() }
    }
}

/// How long an open conversation waits for the client once the agent has
/// spoken (or, before it speaks, once it was called). After that the next
/// sentence needs the agent's first name again.
const CONVERSATION_OUVERTE: std::time::Duration = std::time::Duration::from_secs(60);

/// L'etat de l'ecoute, pour le bouton VOICE (vert = actif, rouge = inactif).
#[tauri::command]
fn voix_ecoute_etat(state: State<'_, AppState>) -> EcouteVue {
    let mut e = state.ecoute.lock().unwrap();
    e.fermer_si_delaissee();
    EcouteVue::de(&e)
}

/// Allume ou coupe l'ecoute. Couper rendort aussi le mot de reveil : sinon
/// l'ecoute reprendrait la ou elle en etait, et le client qui a coupe pour
/// parler tranquillement retrouverait un agent qui attend son prenom.
#[tauri::command]
fn voix_ecoute_basculer(active: bool, state: State<'_, AppState>) -> Result<EcouteVue, String> {
    // Le micro suit le bouton ICI, et pas a l'ecran. Il y avait deux etats pour
    // une seule chose — `isListening` en React et `active` en Rust — ce qui est
    // la garantie qu'un jour le bouton serait vert pendant que l'ecoute est
    // morte. Un bouton rouge doit vouloir dire que le micro est coupe, pas
    // seulement que le mot de reveil est ignore.
    //
    // Le micro d'abord, l'etat ensuite, et les deux sens ne se valent pas :
    //
    // Allumer qui echoue ne s'enregistre pas. La version precedente posait
    // `active = true` puis jetait l'echec de `micro()` — exactement le bouton
    // vert sur ecoute morte que le commentaire ci-dessus dit vouloir eviter, et
    // pas en theorie : `micro()` echoue des que la voix n'est pas prete sur ce
    // poste, ce qui est le cas de toute installation ou les fichiers de voix
    // n'ont pas ete poses. L'echec remonte donc a l'ecran, qui garde le bouton
    // rouge et affiche le motif.
    //
    // Couper qui echoue s'enregistre quand meme : le client a demande a couper,
    // et couper a echoue faute d'ecoute prete, ce qui revient au meme.
    if active {
        micro(&state, true)?;
    } else {
        let _ = micro(&state, false);
    }
    let mut e = state.ecoute.lock().unwrap();
    e.active = active;
    e.ou_en_est = reveil::Etat::Dormante;
    Ok(EcouteVue::de(&e))
}

/// Allume ou coupe le micro. `Err` quand l'ecoute n'est pas prete sur ce poste
/// (modele absent) : l'appelant decide si c'est une faute chez lui.
fn micro(state: &State<'_, AppState>, allume: bool) -> Result<String, String> {
    let voice_guard = state.voice.lock().unwrap();
    let Some(voice) = voice_guard.as_ref() else {
        return Err("L'écoute n'est pas prête sur ce poste.".to_string());
    };
    if allume { voice.start_listening() } else { voice.stop_listening() }
}

/// Ce que l'ecoute conclut de ce qu'elle vient d'entendre, et par qui la
/// phrase a ete transcrite.
#[derive(serde::Serialize)]
struct Entendu {
    #[serde(flatten)]
    reaction: reveil::Reaction,
    /// « google » quand Gemini a transcrit la phrase, « poste » sinon.
    transcrite_par: &'static str,
    /// Pourquoi Gemini n'a pas transcrit alors qu'une cle est rangee.
    motif: Option<String>,
}

/// Ce que l'ecoute conclut de ce qu'elle vient d'entendre.
///
/// L'ecran passe le texte que le poste a transcrit ; c'est Rust qui decide,
/// parce que c'est la regle de max et qu'une regle tenue par l'ecran se perd au
/// premier rechargement. Les prenoms viennent de `installation.json`, jamais de
/// l'ecran : un agent qu'on n'a pas embauche ne repond pas.
///
/// Quand la phrase s'adresse a un agent et qu'une cle Google AI Studio est
/// rangee, elle est retranscrite par Gemini (decision de max, 12/10/2026) :
/// seule cette phrase part, jamais la piece. Si Gemini echoue, la phrase du
/// poste sert, et le motif est rendu.
#[tauri::command]
async fn voix_entendu(texte: String, parle: bool, state: State<'_, AppState>) -> Result<Entendu, String> {
    let prenoms = prenoms_embauches();
    let avant = {
        let mut e = state.ecoute.lock().unwrap();
        if !e.active {
            return Ok(Entendu { reaction: reveil::Reaction::Rien, transcrite_par: "poste", motif: None });
        }
        e.fermer_si_delaissee();
        e.ou_en_est.clone()
    };
    let (mut apres, mut reaction) = reveil::entendu(&avant, &texte, &prenoms);
    let mut transcrite_par = "poste";
    let mut motif = None;

    // A typed sentence has no sound: the last one heard belongs to something else.
    let phrase = if parle { state.voice.lock().unwrap().as_ref().and_then(|v| v.derniere_phrase()) } else { None };
    if let (reveil::Reaction::Appel { .. }, Some(son), true) =
        (&reaction, phrase, transcription::en_ligne())
    {
        match transcription::transcrire(&son, &prenoms).await {
            Ok(mieux) => {
                let (a, r) = reveil::entendu(&avant, &mieux, &prenoms);
                if matches!(r, reveil::Reaction::Appel { .. }) {
                    (apres, reaction) = (a, r);
                } else if matches!(avant, reveil::Etat::Dormante) {
                    // Two ears must hear the call: when Gemini does not hear
                    // a first name opening the sentence, nobody was called.
                    (apres, reaction) = (reveil::Etat::Dormante, reveil::Reaction::Rien);
                } else if let reveil::Reaction::Appel { prenom, .. } = &reaction {
                    // Gemini heard the sentence without the first name the
                    // PC heard: same agent, Gemini's words.
                    let demande = match &avant {
                        reveil::Etat::EnConversation { .. } => mieux.clone(),
                        reveil::Etat::Dormante => mieux
                            .split_once(|c: char| c == ',' || c.is_whitespace())
                            .map(|(_, reste)| reste.trim().to_string())
                            .unwrap_or_default(),
                    };
                    reaction = reveil::Reaction::Appel { prenom: prenom.clone(), demande };
                }
                transcrite_par = "google";
            }
            Err(m) => motif = Some(m),
        }
    }

    let mut e = state.ecoute.lock().unwrap();
    // Every sentence said in the conversation keeps it open, not only the call.
    if matches!(apres, reveil::Etat::EnConversation { .. }) {
        e.dernier_echange = Some(std::time::Instant::now());
    }
    e.ou_en_est = apres;
    Ok(Entendu { reaction, transcrite_par, motif })
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

/// Un seul propriétaire par poste.
///
/// Les agents répondent à la personne qui les a embauchés, et rien dans le
/// produit ne distingue encore deux humains sur la même machine. Une clef en dur
/// dit ça franchement, là où un identifiant inventé par l'écran laisserait croire
/// à plusieurs comptes.
const PROPRIETAIRE: &str = "proprietaire";

/// Combien de phrases l'entretien enregistre au plus. Trois suffisent à mesurer
/// ce que la voix a de constant ; au-delà, on remplit la mémoire pour rien.
const PHRASES_MAXIMUM: usize = 5;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

/// `async`, et le modele charge hors du fil de la fenetre : 190 Mo a lire au
/// lancement figeaient l'ecran le temps du chargement.
#[tauri::command]
async fn init_voice(state: State<'_, AppState>) -> Result<String, String> {
    // Ce qui manque se dit AVANT d'essayer. whisper-rs rend « failed to load
    // model », qui ne nomme ni le fichier ni ce que le client peut y faire, et
    // l'écran le montrait tel quel, en anglais, à un client francophone.
    if let Some(manque) = ressources::manque_pour_ecouter() {
        return Err(manque);
    }

    let model_path = voice::chemin_modele_ecoute();
    let charge = tauri::async_runtime::spawn_blocking(move || {
        VoiceState::new(&model_path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("chargement interrompu : {}", e))?;
    match charge {
        Ok(voice_state) => {
            {
                let mut voice = state.voice.lock().unwrap();
                *voice = Some(voice_state);
            }
            // « L'application est toujours a l'ecoute » (max, 24/09/2026) : le
            // micro demarre donc seul, sans que le client ait a cliquer. Ce qui
            // rend ca acceptable est le mot de reveil — rien n'est ecoute POUR
            // etre suivi tant que « Voice » n'a pas ete prononce (`reveil.rs`).
            // S'il a coupe le bouton, on respecte son choix.
            let demarre = state.ecoute.lock().unwrap().active;
            if demarre {
                // Meme regle qu'au bouton : le modele charge ne prouve pas que
                // le micro tourne. Jeter cet echec laissait `active` a vrai, et
                // `voix_ecoute_etat` repondait « allumee » a un ecran qui
                // venait de lire « Écoute prête. ».
                if let Err(motif) = micro(&state, true) {
                    state.ecoute.lock().unwrap().active = false;
                    return Err(format!(
                        "Le modèle d'écoute est chargé mais le micro n'a pas démarré : {}",
                        motif
                    ));
                }
            }
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

/// Vrai pendant qu'une transcription tourne : l'ecran interroge toutes les
/// 200 ms, et une transcription prend plus longtemps que ca sur un processeur
/// modeste. Pendant ce temps le micro continue de remplir le tampon, et la
/// phrase suivante attend son tour au lieu d'etre perdue.
static TRANSCRIPTION_EN_COURS: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// La phrase que le client vient de finir, transcrite sur le poste ; vide tant
/// que personne n'a parle puis ne s'est tu.
///
/// Rien n'est transcrit tant que la phrase n'est pas finie (`voice::Decoupeur`)
/// : avant le 12/10/2026 l'ecran transcrivait les 8 dernieres secondes cinq
/// fois par seconde, coupait le debut des phrases longues, et occupait deux
/// coeurs a transcrire la piece vide.
///
/// `async` n'est pas un detail : une commande Tauri synchrone tourne sur le fil
/// de la fenetre, et une transcription la gelait (Big Work, 10/10/2026).
#[tauri::command]
async fn get_partial_result(state: State<'_, AppState>) -> Result<Option<String>, String> {
    use std::sync::atomic::Ordering;

    if TRANSCRIPTION_EN_COURS.load(Ordering::Acquire) {
        return Ok(None);
    }
    let (contexte, phrase) = {
        let voice_guard = state.voice.lock().unwrap();
        let Some(voice) = voice_guard.as_ref() else {
            return Err("L'écoute n'est pas prête sur ce poste.".to_string());
        };
        voice.phrase_finie()
    };
    let Some(phrase) = phrase else {
        return Ok(Some(String::new()));
    };
    if TRANSCRIPTION_EN_COURS.swap(true, Ordering::AcqRel) {
        return Ok(None);
    }
    let resultat = tauri::async_runtime::spawn_blocking(move || {
        voice::transcrire(&contexte, &phrase)
    })
    .await;
    TRANSCRIPTION_EN_COURS.store(false, Ordering::Release);
    resultat
        .map_err(|e| format!("transcription interrompue : {}", e))?
        .map(Some)
}

/// Le niveau du micro, de 0 a 1, pour la jauge de l'ecran. `None` quand
/// l'ecoute n'est pas prete.
#[tauri::command]
fn voix_niveau(state: State<AppState>) -> Option<f32> {
    state.voice.lock().unwrap().as_ref().map(|v| v.niveau())
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
    // These sample agents have no catalogue sheet, hence no right: on a
    // provisioned Box they never run.
    plateforme::autoriser(&agent_id).await?;
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
    let _travail = mise_a_jour::travail()?;
    // On a provisioned Box, no right, no answer (plateforme.rs).
    plateforme::autoriser(&fiche_id).await?;
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
    let _travail = mise_a_jour::travail()?;
    // On a provisioned Box, no right, no task: refused before anything is read
    // or written (plateforme.rs).
    plateforme::autoriser(&fiche_id).await?;
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

/// Enregistre une phrase de plus pour l'empreinte, et dit combien sont prêtes.
///
/// Le refus tombe ici, phrase par phrase : le dire après la troisième
/// obligerait le client à tout refaire parce que la première était muette.
#[tauri::command]
async fn empreinte_capturer(secondes: f32, etat: State<'_, AppState>) -> Result<usize, String> {
    // `spawn_blocking` parce que l'enregistrement dort trois secondes : sur le
    // fil de l'interface, la fenêtre se figerait.
    let echantillons = tokio::task::spawn_blocking(move || voice::capturer(secondes))
        .await
        .map_err(|e| format!("enregistrement interrompu : {}", e))??;

    voiceprint::signature(&echantillons, voiceprint::TAUX_EMPREINTE)?;

    let mut phrases = etat.empreinte_en_cours.lock().unwrap();
    if phrases.len() >= PHRASES_MAXIMUM {
        return Err(format!(
            "{} phrases sont déjà enregistrées : enregistrez l'empreinte ou recommencez.",
            phrases.len()
        ));
    }
    phrases.push(echantillons);
    Ok(phrases.len())
}

/// Oublie les phrases en cours. Le bouton « Recommencer » de l'écran.
#[tauri::command]
fn empreinte_oublier(etat: State<AppState>) -> usize {
    let mut phrases = etat.empreinte_en_cours.lock().unwrap();
    phrases.clear();
    phrases.len()
}

/// Range l'empreinte du propriétaire, à partir des phrases enregistrées.
///
/// Une empreinte qui n'a pas été écrite ne peut pas être comparée plus tard :
/// annoncer le succès sur une écriture échouée laisserait le client croire que sa
/// voix est connue, alors que chaque vérification ne trouverait rien.
#[tauri::command]
fn empreinte_enregistrer(etat: State<AppState>) -> Result<usize, String> {
    let phrases = etat.empreinte_en_cours.lock().unwrap().clone();
    let empreinte = voiceprint::empreinte(&phrases, voiceprint::TAUX_EMPREINTE)?;
    let combien = empreinte.signatures.len();

    let brut = serde_json::to_string(&empreinte)
        .map_err(|e| format!("écriture de l'empreinte : {}", e))?;

    let verrou = etat
        .db
        .lock()
        .map_err(|_| "la base du poste est verrouillée".to_string())?;
    let base = verrou
        .as_ref()
        .ok_or("aucune base sur ce poste : l'empreinte ne pourrait pas être relue")?;
    base.save_voice_print(PROPRIETAIRE, &brut)
        .map_err(|e| format!("enregistrement de l'empreinte : {}", e))?;
    drop(verrou);

    etat.empreinte_en_cours.lock().unwrap().clear();
    Ok(combien)
}

/// Une empreinte est-elle rangée sur ce poste ?
///
/// L'écran le demande en s'ouvrant : sans ça il proposerait de vérifier une voix
/// que personne n'a enregistrée, et le refus arriverait après l'enregistrement.
#[tauri::command]
fn empreinte_presente(etat: State<AppState>) -> Result<bool, String> {
    let verrou = etat
        .db
        .lock()
        .map_err(|_| "la base du poste est verrouillée".to_string())?;
    match verrou.as_ref() {
        Some(base) => Ok(base.get_voice_print(PROPRIETAIRE)?.is_some()),
        None => Ok(false),
    }
}

/// Enregistre une phrase et la compare à l'empreinte rangée.
///
/// **Le score n'ouvre rien.** Les marges du verdict ne sont pas mesurées sur de
/// vraies personnes : `voiceprint` dit pourquoi, et l'écran le répète au client.
#[tauri::command]
async fn empreinte_verifier(
    secondes: f32,
    etat: State<'_, AppState>,
) -> Result<Comparaison, String> {
    let rangee = {
        let verrou = etat
            .db
            .lock()
            .map_err(|_| "la base du poste est verrouillée".to_string())?;
        let base = verrou
            .as_ref()
            .ok_or("aucune base sur ce poste : rien n'a jamais été enregistré")?;
        base.get_voice_print(PROPRIETAIRE)?
            .ok_or("aucune empreinte enregistrée sur ce poste")?
    };
    let empreinte: voiceprint::Empreinte = serde_json::from_str(&rangee.mfcc_data).map_err(|_| {
        "l'empreinte rangée est illisible : enregistrez votre voix à nouveau.".to_string()
    })?;

    let echantillons = tokio::task::spawn_blocking(move || voice::capturer(secondes))
        .await
        .map_err(|e| format!("enregistrement interrompu : {}", e))??;

    voiceprint::comparer(&echantillons, &empreinte, voiceprint::TAUX_EMPREINTE)
}

/// Ce que répond `train_voice`, et pourquoi il ne répond que ça.
///
/// La reconnaissance du propriétaire se fait sur du son, pas sur des phrases
/// écrites : `empreinte_capturer` prend de vrais échantillons au microphone,
/// `empreinte_enregistrer` en range la signature et `empreinte_verifier` s'y
/// compare. Du texte n'apprend rien à personne.
const APPRENTISSAGE_PAR_LE_SON: &str = "La voix ne s'apprend pas sur des phrases écrites : \
il faut enregistrer de vrais échantillons de son. Rien n'a été appris.";

/// Restait de l'époque où l'on croyait pouvoir apprendre une voix sur du texte.
///
/// Elle jetait ses `utterances`, en imprimait le nombre sur la sortie standard,
/// et rendait `Ok("Voice training prepared…")` — un succès que personne n'avait
/// gagné, sur une commande que Tauri expose. C'est la même faute que
/// `telegram.rs` : le premier écran qui l'aurait appelée aurait annoncé au
/// client que sa voix était apprise. Elle refuse maintenant, en français et en
/// disant par où passer, plutôt que de disparaître d'un coup du carnet de
/// commandes où l'interface pourrait encore la chercher.
#[tauri::command]
fn train_voice(utterances: Vec<String>) -> Result<String, String> {
    // Le nom de l'argument reste `utterances` : Tauri en fait la clef
    // attendue cote interface, et la renommer rendrait une erreur de
    // desserialisation illisible au lieu du refus en francais.
    let _ = utterances;
    Err(APPRENTISSAGE_PAR_LE_SON.to_string())
}

#[tauri::command]
async fn text_to_speech(text: String, prenom: Option<String>) -> Result<String, String> {
    voice::parler(prenom.as_deref(), &text).await
}

/// Ouvre la base du poste, une fois le dossier de données connu.
///
/// Elle s'ouvrait dans `main` sur `"iagent.db"`, un chemin **relatif au dossier
/// courant**. Constaté chez max le 25/09/2026 : lancée depuis la fin de
/// l'installeur, l'application avait posé sa base dans son dossier de
/// téléchargements ; lancée le lendemain depuis le menu Démarrer, elle n'y
/// retournait pas et ses embauches semblaient perdues.
///
/// Un échec ici ne ferme pas l'application : les commandes qui ont besoin de la
/// base le disent une par une, ce qui vaut mieux qu'un démarrage refusé sans
/// dire pourquoi.
fn ouvrir_la_base(app: &tauri::App) {
    match app.path().app_local_data_dir() {
        Ok(dossier) => {
            if let Err(motif) = chemins::poser_dossier_donnees(dossier) {
                eprintln!("{}", motif);
            }
        }
        Err(e) => {
            eprintln!(
                "dossier de données introuvable ({}) : l'application écrira dans un \
                 dossier de secours et ne retrouvera rien au prochain lancement.",
                e
            );
            return;
        }
    }

    let chemin = chemins::pour_ecrire("iagent.db");
    match Database::new(&chemin) {
        Ok(base) => {
            if let Err(e) = base.init() {
                eprintln!("initialisation de {} : {}", chemin.display(), e);
            }
            *app.state::<AppState>().db.lock().unwrap() = Some(base);
        }
        Err(motif) => eprintln!("{}", motif),
    }
}

fn main() {
    let state = AppState {
        voice: Mutex::new(None),
        empreinte_en_cours: Mutex::new(Vec::new()),
        agents: Mutex::new(AgentRouter::new()),
        llm: Mutex::new(None),
        // La base ne s'ouvre pas ici : son chemin dépend du dossier de données du
        // poste, que seul Tauri sait nommer, et qui n'existe pas avant `setup`.
        db: Arc::new(Mutex::new(None)),
        ecoute: Mutex::new(Ecoute::default()),
    };

    tauri::Builder::default()
        .manage(state)
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Avant tout le reste : sans dossier de données, une embauche ne
            // s'écrit pas et les pièces de la voix ne se téléchargent pas.
            ouvrir_la_base(app);
            mise_a_jour::demarrer(app.handle());
            // Les recettes que le catalogue commun n'a pas encore reçues.
            tauri::async_runtime::spawn(partage::envoyer_la_file());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            init_voice,
            start_voice_recognition,
            stop_voice_recognition,
            process_voice_audio,
            get_partial_result,
            voix_niveau,
            text_to_speech,
            empreinte_capturer,
            empreinte_oublier,
            empreinte_enregistrer,
            empreinte_presente,
            empreinte_verifier,
            init_llm,
            call_agent_llm,
            route_voice_command,
            get_agents,
            activate_agent,
            deactivate_agent,
            train_voice,
            telegram::telegram_brancher,
            telegram::telegram_branche,
            telegram::telegram_debrancher,
            telegram::telegram_envoyer,
            telegram::telegram_relever,
            telegram::telegram_mode_d_emploi,
            whatsapp::whatsapp_brancher,
            whatsapp::whatsapp_branche,
            whatsapp::whatsapp_debrancher,
            whatsapp::whatsapp_repondre,
            whatsapp::whatsapp_relever,
            fiches::lire_installation,
            fiches::lire_fiche,
            fiches::installation_ecrire,
            fiches::lire_referentiel,
            fiches::lire_postes,
            fiches::enregistrer_fiche_composee,
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
            mission::mission_lancer,
            mission::mission_historique,
            mission::mission_ouvrir,
            voix_api::voix_api_etat,
            voix_api::voix_api_ranger,
            voix_api::voix_api_retirer,
            voix_api::voix_api_preferer,
            tache::dossier_de_travail,
            tache::montrer_resultat,
            repondre,
            courriel::courriel_enregistrer_motdepasse,
            courriel::courriel_motdepasse_present,
            courriel::courriel_relever,
            courriel::courriel_envoyer,
            courriel::courriel_envois,
            equipe::equipe_regler,
            equipe::equipe_annuler,
            equipe::equipe_changements,
            equipe::equipe_productions,
            equipe::equipe_lire_production,
            journal::journal_lire,
            journal::journal_ajouter,
            navigateur::navigateur_ouvrir,
            navigateur::navigateur_fermer,
            navigateur::navigateur_sites,
            navigateur::navigateur_declarer_site,
            navigateur::navigateur_oublier_site,
            navigateur::navigateur_effacer_sessions,
            mise_a_jour::mise_a_jour_etat,
            plateforme::plateforme_etat,
            plateforme::plateforme_identite,
            plateforme::plateforme_regler,
            plateforme::plateforme_droits,
            plateforme::plateforme_sante,
            plateforme::plateforme_telemetrie_envoyer,
            plateforme::plateforme_mises_a_jour,
            plateforme::plateforme_skills,
            plateforme::plateforme_skill_ouvrir,
            plateforme::plateforme_appels,
            plateforme::plateforme_handoffs,
            plateforme::plateforme_handoff_decider,
            plateforme::plateforme_consommation,
            plateforme::plateforme_projets,
            plateforme::plateforme_projet_creer,
            administration::admin_present,
            administration::plateforme_appeler,
            administration::jeton_poser,
            administration::jeton_present,
            administration::jeton_oublier,
            administration::adresse_lire,
            administration::adresse_poser,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
