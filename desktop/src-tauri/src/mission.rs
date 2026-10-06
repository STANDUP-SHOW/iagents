//! Une demande dite au chef d'équipe, et l'équipe qui la fait.
//!
//! max, 06/10/2026 : « vous n'avez plus besoin de savoir comment utiliser l'IA,
//! vous devez simplement savoir ce que vous voulez accomplir ». Le client parle
//! à UN agent, son bras droit ; celui-ci découpe la demande, la confie aux
//! spécialistes embauchés, et revient avec un résultat consolidé et ce qui
//! attend une décision du client. Avant, chaque agent ne travaillait que sur
//! les fichiers qu'on avait déposés dans ses dossiers, et ne cherchait rien.
//!
//! Ce qui est tenu ici, et pas dans une consigne au modèle :
//! - le plan ne peut confier une mission qu'à un agent réellement embauché ;
//! - rien ne part du poste : les agents écrivent des documents, aucun courriel,
//!   aucun message, aucun formulaire ;
//! - la recherche sur le web ne lit pas LinkedIn (règle de max : jamais de
//!   recueil automatique), l'agent dit au client quoi y chercher lui-même ;
//! - chaque document porte ses sources, et l'agent dit ce qu'il n'a pas trouvé
//!   plutôt que de l'inventer.
//!
//! Tout passe par l'API : la recherche sur le web est un outil du serveur
//! d'Anthropic, aucun moteur local ne l'offre.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

use crate::tache::Savoir;

/// La fiche du chef d'équipe, au socle.
pub const FICHE_CHEF: &str = "AG-0000";
const ADRESSE_API: &str = "https://api.anthropic.com/v1/messages";
/// Au-delà, le plan est refusé : un chef qui découpe en vingt missions ne
/// coordonne plus rien, et la facture du client suit le nombre de missions.
const MISSIONS_MAX: usize = 8;
const VAGUES_MAX: u64 = 4;
/// Ce qu'un spécialiste peut chercher sur le web pour une mission.
const RECHERCHES_PAR_MISSION: u64 = 8;
/// Le serveur rend la main après dix tours d'outil ; on le relance, mais pas
/// sans fin.
const REPRISES_MAX: usize = 5;
/// Ce qu'un agent lit du travail d'un collègue : assez pour s'en servir, pas
/// au point de faire exploser la requête.
const EXTRAIT_PAR_COLLEGUE: usize = 8_000;
/// La règle de max : aucun recueil automatique sur LinkedIn.
const DOMAINES_INTERDITS: [&str; 1] = ["linkedin.com"];

/// Un agent de l'équipe, tel que le chef le connaît.
#[derive(Debug, Clone)]
pub struct Membre {
    pub prenom: String,
    pub fiche_id: String,
    pub poste: String,
    pub description: String,
    pub consigne: String,
    pub connaissances: Vec<Savoir>,
    pub competences: Vec<Savoir>,
    pub regles: Vec<String>,
}

/// Une mission du plan.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Etape {
    pub prenom: String,
    pub consigne: String,
    pub vague: u64,
}

/// Ce que le chef répond quand on lui confie une demande.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Plan {
    pub reponse: String,
    pub questions: Vec<String>,
    pub etapes: Vec<Etape>,
}

/// Une source qu'un agent a lue.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Source {
    pub titre: String,
    pub adresse: String,
}

/// Où en est une mission : ce que l'écran affiche, et ce qui est gardé.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Avancee {
    pub prenom: String,
    pub poste: String,
    pub consigne: String,
    pub vague: u64,
    /// « a-faire », « en-cours », « fait » ou « echec ».
    pub statut: String,
    pub fichier: Option<String>,
    pub erreur: Option<String>,
    pub sources: usize,
}

/// Une mission entière : la demande, le plan, chaque étape, et la synthèse.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mission {
    pub id: String,
    pub demande: String,
    pub chef: String,
    pub reponse: String,
    pub questions: Vec<String>,
    pub etapes: Vec<Avancee>,
    pub synthese: Option<String>,
    pub fichier_synthese: Option<String>,
    /// « en-cours », « terminee » ou « echec ».
    pub statut: String,
    pub commencee: u64,
}

// ---------------------------------------------------------------------------
// L'équipe
// ---------------------------------------------------------------------------

fn savoirs(v: Option<&Value>) -> Vec<Savoir> {
    v.and_then(Value::as_array)
        .map(|a| a.iter().filter_map(|s| serde_json::from_value(s.clone()).ok()).collect())
        .unwrap_or_default()
}

/// Les agents embauchés, avec ce que leur fiche dit d'eux.
///
/// `fiche_de` rend la fiche d'un identifiant : séparé pour que le banc n'ait
/// pas besoin du disque.
pub fn equipe_de(
    installation: &Value,
    fiche_de: impl Fn(&str) -> Option<Value>,
) -> Vec<Membre> {
    let mut membres = Vec::new();
    for agent in installation.get("agents").and_then(Value::as_array).into_iter().flatten() {
        let (Some(prenom), Some(fiche_id)) = (
            agent.get("prenom").and_then(Value::as_str),
            agent.get("ficheId").and_then(Value::as_str),
        ) else {
            continue;
        };
        let Some(fiche) = fiche_de(fiche_id) else { continue };
        let expert = fiche.get("expert").cloned().unwrap_or(Value::Null);
        membres.push(Membre {
            prenom: prenom.trim().to_string(),
            fiche_id: fiche_id.to_string(),
            poste: fiche.get("nom").and_then(Value::as_str).unwrap_or(fiche_id).to_string(),
            description: fiche.get("description").and_then(Value::as_str).unwrap_or("").to_string(),
            consigne: expert.get("consigne").and_then(Value::as_str).unwrap_or("").to_string(),
            connaissances: savoirs(expert.get("connaissances")),
            competences: savoirs(agent.get("competences")),
            regles: expert
                .get("regles")
                .and_then(Value::as_array)
                .map(|a| a.iter().filter_map(|r| r.as_str().map(str::to_string)).collect())
                .unwrap_or_default(),
        });
    }
    membres
}

/// Le chef d'équipe embauché, s'il y en a un. Sans lui, le premier agent ne
/// devient pas chef : le client n'en a pas choisi, on parle en son nom.
pub fn chef_de(equipe: &[Membre]) -> Option<&Membre> {
    equipe.iter().find(|m| m.fiche_id == FICHE_CHEF)
}

// ---------------------------------------------------------------------------
// Le plan
// ---------------------------------------------------------------------------

/// La forme exacte que le chef doit rendre : le serveur la tient, on n'a pas à
/// deviner un JSON dans une phrase.
pub fn schema_du_plan() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["reponse", "questions", "etapes"],
        "properties": {
            "reponse": { "type": "string" },
            "questions": { "type": "array", "items": { "type": "string" } },
            "etapes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["prenom", "consigne", "vague"],
                    "properties": {
                        "prenom": { "type": "string" },
                        "consigne": { "type": "string" },
                        "vague": { "type": "integer" }
                    }
                }
            }
        }
    })
}

/// Ce que le chef sait pour découper la demande.
pub fn consigne_du_chef(chef: Option<&Membre>, equipe: &[Membre]) -> String {
    let nom = chef.map(|c| c.prenom.as_str()).unwrap_or("le bras droit");
    let mut s = String::new();
    if let Some(c) = chef {
        s.push_str(c.consigne.trim());
        s.push_str("\n\n");
    }
    s.push_str(&format!(
        "Vous vous appelez {}. Vous êtes le bras droit du dirigeant : il vous dit ce qu'il veut accomplir, et vous faites travailler l'équipe pour l'obtenir. Il ne configure rien et ne dépose rien : c'est à vous de répartir le travail.\n\nVotre équipe :\n",
        nom
    ));
    for m in equipe.iter().filter(|m| m.fiche_id != FICHE_CHEF) {
        s.push_str(&format!("- {} : {}. {}\n", m.prenom, m.poste, m.description.trim()));
    }
    s.push_str(
        "\nRendez un plan :\n\
         - « reponse » : ce que vous dites au dirigeant, en deux ou trois phrases, à l'oral, comme un collègue ;\n\
         - « etapes » : une mission par agent concerné, avec son prénom exact tel qu'il est écrit ci-dessus, une consigne précise et autonome (ce qu'il doit produire, pour quoi faire), et une vague : 1 pour ce qui peut commencer tout de suite, 2 pour ce qui a besoin du travail de la vague 1, et ainsi de suite jusqu'à 4 ;\n\
         - « questions » : seulement ce que l'équipe ne peut pas trouver seule et sans quoi le travail serait faux (un montant, une échéance). Pas de question de politesse.\n\
         N'employez que les agents utiles. Pas plus de huit missions. Les agents peuvent chercher sur le web et écrire des documents ; ils n'envoient rien, ne contactent personne et ne remplissent aucun formulaire : tout envoi attend l'accord du dirigeant.",
    );
    s
}

/// Le plan tel que le chef l'a rendu, refusé s'il confie une mission à qui
/// n'est pas embauché.
pub fn plan_recevable(brut: &Value, equipe: &[Membre]) -> Result<Plan, String> {
    let plan: Plan = serde_json::from_value(brut.clone())
        .map_err(|e| format!("le plan du chef d'équipe est illisible : {}", e))?;
    if plan.etapes.len() > MISSIONS_MAX {
        return Err(format!(
            "le chef d'équipe a découpé la demande en {} missions ; on en accepte {} au plus",
            plan.etapes.len(),
            MISSIONS_MAX
        ));
    }
    for e in &plan.etapes {
        let connu = equipe
            .iter()
            .any(|m| m.fiche_id != FICHE_CHEF && m.prenom.eq_ignore_ascii_case(e.prenom.trim()));
        if !connu {
            return Err(format!(
                "le chef d'équipe a confié une mission à « {} », qui n'est pas dans votre équipe",
                e.prenom
            ));
        }
        if e.vague == 0 || e.vague > VAGUES_MAX {
            return Err(format!("la mission de {} n'a pas d'ordre valable", e.prenom));
        }
        if e.consigne.trim().is_empty() {
            return Err(format!("la mission de {} est vide", e.prenom));
        }
    }
    Ok(plan)
}

// ---------------------------------------------------------------------------
// Le travail d'un spécialiste
// ---------------------------------------------------------------------------

/// Ce qu'un spécialiste reçoit : sa fiche, sa mission, et le travail déjà fait
/// par ses collègues.
pub fn consigne_du_specialiste(
    membre: &Membre,
    chef: &str,
    demande: &str,
    consigne: &str,
    repris: &[String],
    collegues: &[(String, String)],
) -> (String, String) {
    let (mut systeme, _) = crate::tache::consigne_de_la_tache(
        &membre.consigne,
        &membre.prenom,
        &membre.connaissances,
        &membre.competences,
        repris,
        &membre.regles,
        "",
        "",
        "docx",
        true,
    );
    systeme.push_str(
        "\n\nVous pouvez chercher sur le web. Citez vos sources : terminez le document par une partie « ## Sources » qui donne l'adresse de chaque page dont vous tirez un fait. N'inventez aucun nom, aucun chiffre, aucune adresse de courriel, aucun numéro : ce que vous n'avez pas trouvé, écrivez-le tel quel. LinkedIn ne se lit pas automatiquement : si un profil y serait utile, dites au dirigeant quoi y chercher lui-même. Vous n'envoyez rien et ne contactez personne.",
    );
    let mut enonce = format!(
        "Mission confiée par {} :\n{}\n\nCe que le dirigeant a demandé, dans ses mots :\n« {} »",
        chef,
        consigne.trim(),
        demande.trim()
    );
    for (qui, texte) in collegues {
        let extrait: String = texte.chars().take(EXTRAIT_PAR_COLLEGUE).collect();
        enonce.push_str(&format!("\n\nTravail de {} :\n{}", qui, extrait));
    }
    (systeme, enonce)
}

/// La requête d'un spécialiste : la recherche sur le web, sans LinkedIn.
pub fn corps_du_specialiste(modele: &str, systeme: &str, messages: &[Value]) -> Value {
    json!({
        "model": modele,
        "max_tokens": 16000,
        "output_config": { "effort": "medium" },
        "system": systeme,
        "messages": messages,
        "tools": [{
            "type": "web_search_20260209",
            "name": "web_search",
            "max_uses": RECHERCHES_PAR_MISSION,
            "blocked_domains": DOMAINES_INTERDITS,
        }],
    })
}

/// Le texte d'une réponse, et les pages lues pour l'écrire.
///
/// Tout le texte, pas le premier bloc : avec la recherche, la réponse se coupe
/// en morceaux autour des citations, et un bloc de réflexion peut venir avant.
pub fn texte_et_sources(contenu: &[Value]) -> (String, Vec<Source>) {
    let mut texte = String::new();
    let mut sources: Vec<Source> = Vec::new();
    let mut ajouter = |titre: &str, adresse: &str| {
        if !adresse.is_empty() && !sources.iter().any(|s| s.adresse == adresse) {
            sources.push(Source { titre: titre.to_string(), adresse: adresse.to_string() });
        }
    };
    for bloc in contenu {
        match bloc.get("type").and_then(Value::as_str) {
            Some("text") => {
                texte.push_str(bloc.get("text").and_then(Value::as_str).unwrap_or(""));
                for c in bloc.get("citations").and_then(Value::as_array).into_iter().flatten() {
                    ajouter(
                        c.get("title").and_then(Value::as_str).unwrap_or(""),
                        c.get("url").and_then(Value::as_str).unwrap_or(""),
                    );
                }
            }
            Some("web_search_tool_result") => {
                // Une erreur de recherche est un objet, un succès une liste.
                for r in bloc.get("content").and_then(Value::as_array).into_iter().flatten() {
                    ajouter(
                        r.get("title").and_then(Value::as_str).unwrap_or(""),
                        r.get("url").and_then(Value::as_str).unwrap_or(""),
                    );
                }
            }
            _ => {}
        }
    }
    (texte.trim().to_string(), sources)
}

// ---------------------------------------------------------------------------
// L'appel
// ---------------------------------------------------------------------------

async fn appeler_une_fois(
    client: &reqwest::Client,
    adresse: &str,
    cle: &str,
    corps: &Value,
) -> Result<Value, String> {
    let reponse = client
        .post(adresse)
        .header("x-api-key", cle)
        .header("anthropic-version", "2023-06-01")
        .json(corps)
        .send()
        .await
        .map_err(|_| "le service d'Anthropic ne répond pas : vérifiez la connexion à Internet".to_string())?;
    let statut = reponse.status();
    let brut: Value = reponse
        .json()
        .await
        .map_err(|_| "le service d'Anthropic a rendu une réponse illisible".to_string())?;
    if statut.as_u16() == 401 {
        return Err("la clé d'API est refusée : vérifiez-la dans « Vos connexions »".to_string());
    }
    if !statut.is_success() {
        let message = brut.pointer("/error/message").and_then(Value::as_str).unwrap_or("");
        return Err(format!("le service d'Anthropic a refusé la demande ({}) : {}", statut.as_u16(), message));
    }
    Ok(brut)
}

/// Appelle le modèle jusqu'à la fin du travail, et rend tout le contenu.
///
/// Avec la recherche, le serveur peut rendre la main au milieu (`pause_turn`) :
/// on lui renvoie ce qu'il a déjà fait, sans rien ajouter, et il reprend.
pub async fn appeler(
    client: &reqwest::Client,
    adresse: &str,
    cle: &str,
    corps: Value,
) -> Result<Vec<Value>, String> {
    let mut corps = corps;
    let mut tout: Vec<Value> = Vec::new();
    for _ in 0..=REPRISES_MAX {
        let brut = appeler_une_fois(client, adresse, cle, &corps).await?;
        let contenu = brut.get("content").and_then(Value::as_array).cloned().unwrap_or_default();
        tout.extend(contenu.iter().cloned());
        match brut.get("stop_reason").and_then(Value::as_str) {
            Some("pause_turn") => {
                let messages = corps.get_mut("messages").and_then(Value::as_array_mut).ok_or("requête sans messages")?;
                messages.push(json!({ "role": "assistant", "content": contenu }));
            }
            Some("refusal") => {
                return Err("le modèle a refusé ce travail ; reformulez la demande ou confiez-la à quelqu'un d'autre".to_string())
            }
            Some("max_tokens") => {
                // Le texte est là mais coupé : le dire plutôt que de rendre un
                // document qui s'arrête au milieu d'une phrase sans prévenir.
                tout.push(json!({ "type": "text", "text": "\n\n(Le document s'arrête ici : il dépassait la longueur permise.)" }));
                return Ok(tout);
            }
            _ => return Ok(tout),
        }
    }
    Err("le travail ne s'est pas terminé après plusieurs reprises".to_string())
}

// ---------------------------------------------------------------------------
// La mission entière
// ---------------------------------------------------------------------------

fn nom_du_fichier(prenom: &str, horodatage: &str) -> String {
    let propre: String = prenom
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    format!("mission-{}-{}.docx", horodatage, propre.to_lowercase())
}

fn document_avec_sources(texte: &str, sources: &[Source]) -> String {
    // L'agent écrit ses sources lui-même ; on n'ajoute que si rien ne les dit.
    if sources.is_empty() || texte.contains("## Sources") {
        return texte.to_string();
    }
    let lignes: Vec<String> = sources
        .iter()
        .map(|s| format!("- {} : {}", if s.titre.is_empty() { "page" } else { &s.titre }, s.adresse))
        .collect();
    format!("{}\n\n## Sources\n\n{}", texte, lignes.join("\n"))
}

fn dossier_de(prenom: &str, installation: &Value) -> Result<PathBuf, String> {
    let racine = installation
        .get("agents")
        .and_then(Value::as_array)
        .and_then(|a| a.iter().find(|x| x.get("prenom").and_then(Value::as_str) == Some(prenom)))
        .and_then(|x| x.get("racine"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(PathBuf::from);
    Ok(match racine {
        Some(r) => r,
        None => crate::tache::dossier_par_defaut(prenom)?,
    }
    .join("missions"))
}

fn garder(mission: &Mission) {
    let chemin = crate::chemins::pour_ecrire(&format!("config/missions/{}.json", mission.id));
    if let Some(parent) = chemin.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(texte) = serde_json::to_string_pretty(mission) {
        let _ = std::fs::write(chemin, texte);
    }
}

fn annoncer(app: &tauri::AppHandle, mission: &Mission) {
    use tauri::Emitter;
    garder(mission);
    let _ = app.emit("mission", mission);
}

/// Le client dit au chef ce qu'il veut ; l'équipe le fait.
#[tauri::command]
pub async fn mission_lancer(demande: String, app: tauri::AppHandle) -> Result<Mission, String> {
    let _travail = crate::mise_a_jour::travail()?;
    if demande.trim().is_empty() {
        return Err("dites au chef d'équipe ce que vous voulez obtenir".to_string());
    }
    let cle = crate::llm::cle_api().ok_or(
        "votre équipe cherche sur le web et écrit par l'API d'Anthropic : posez votre clé dans « Vos connexions »",
    )?;
    let installation: Value = serde_json::from_str(&crate::fiches::lire_installation()?)
        .map_err(|e| format!("installation illisible : {}", e))?;
    let equipe = equipe_de(&installation, |id| {
        crate::fiches::lire_fiche(id.to_string()).ok().and_then(|t| serde_json::from_str(&t).ok())
    });
    if equipe.iter().all(|m| m.fiche_id == FICHE_CHEF) {
        return Err("vous n'avez encore embauché aucun spécialiste : le chef d'équipe n'a personne à qui confier le travail".to_string());
    }
    let chef = chef_de(&equipe).cloned();
    let nom_chef = chef.as_ref().map(|c| c.prenom.clone()).unwrap_or_else(|| "votre bras droit".to_string());
    let client = reqwest::Client::new();
    let maintenant = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let horodatage = crate::tache::horodatage(maintenant);

    // 1. Le chef découpe.
    let corps = json!({
        "model": crate::llm::MODELE_API,
        "max_tokens": 8000,
        "output_config": { "effort": "medium", "format": { "type": "json_schema", "schema": schema_du_plan() } },
        "system": consigne_du_chef(chef.as_ref(), &equipe),
        "messages": [{ "role": "user", "content": demande.trim() }],
    });
    let contenu = appeler(&client, ADRESSE_API, &cle, corps).await?;
    let (texte, _) = texte_et_sources(&contenu);
    let brut: Value = serde_json::from_str(&texte)
        .map_err(|_| "le chef d'équipe n'a pas rendu de plan lisible".to_string())?;
    let mut plan = plan_recevable(&brut, &equipe)?;
    plan.etapes.sort_by_key(|e| e.vague);

    let mut mission = Mission {
        id: horodatage.clone(),
        demande: demande.trim().to_string(),
        chef: nom_chef.clone(),
        reponse: plan.reponse.clone(),
        questions: plan.questions.clone(),
        etapes: plan
            .etapes
            .iter()
            .map(|e| {
                let m = equipe.iter().find(|m| m.prenom.eq_ignore_ascii_case(e.prenom.trim()));
                Avancee {
                    prenom: m.map(|m| m.prenom.clone()).unwrap_or_else(|| e.prenom.clone()),
                    poste: m.map(|m| m.poste.clone()).unwrap_or_default(),
                    consigne: e.consigne.clone(),
                    vague: e.vague,
                    statut: "a-faire".to_string(),
                    fichier: None,
                    erreur: None,
                    sources: 0,
                }
            })
            .collect(),
        synthese: None,
        fichier_synthese: None,
        statut: "en-cours".to_string(),
        commencee: maintenant,
    };
    annoncer(&app, &mission);

    // 2. Les spécialistes travaillent, vague par vague ; ceux d'une même vague
    // en même temps. Chacun lit ce que les vagues précédentes ont produit.
    let mut produits: Vec<(String, String)> = Vec::new();
    let vagues: Vec<u64> = {
        let mut v: Vec<u64> = mission.etapes.iter().map(|e| e.vague).collect();
        v.dedup();
        v
    };
    for vague in vagues {
        let indices: Vec<usize> = (0..mission.etapes.len()).filter(|&i| mission.etapes[i].vague == vague).collect();
        let mut taches = tokio::task::JoinSet::new();
        for &i in &indices {
            mission.etapes[i].statut = "en-cours".to_string();
            let membre = equipe
                .iter()
                .find(|m| m.prenom == mission.etapes[i].prenom)
                .cloned()
                .ok_or("agent introuvable")?;
            let repris: Vec<String> = crate::journal::journal_lire(membre.prenom.clone())
                .unwrap_or_default()
                .into_iter()
                .map(|e| e.raison)
                .collect();
            let (systeme, enonce) = consigne_du_specialiste(
                &membre, &nom_chef, &mission.demande, &mission.etapes[i].consigne, &repris, &produits,
            );
            let corps = corps_du_specialiste(
                crate::llm::MODELE_API,
                &systeme,
                &[json!({ "role": "user", "content": enonce })],
            );
            let (client, cle) = (client.clone(), cle.clone());
            taches.spawn(async move { (i, appeler(&client, ADRESSE_API, &cle, corps).await) });
        }
        annoncer(&app, &mission);

        let mut rendus: Vec<(usize, String)> = Vec::new();
        while let Some(fini) = taches.join_next().await {
            let Ok((i, issue)) = fini else { continue };
            let etape = &mut mission.etapes[i];
            match issue.and_then(|contenu| {
                let (texte, sources) = texte_et_sources(&contenu);
                if texte.is_empty() {
                    return Err(format!("{} n'a rien rendu", etape.prenom));
                }
                let document = document_avec_sources(&texte, &sources);
                let chemin = crate::document::poser_document(
                    &dossier_de(&etape.prenom, &installation)?,
                    &nom_du_fichier(&etape.prenom, &horodatage),
                    &document,
                )?;
                Ok((document, chemin, sources.len()))
            }) {
                Ok((document, chemin, n)) => {
                    etape.statut = "fait".to_string();
                    etape.fichier = Some(chemin.display().to_string());
                    etape.sources = n;
                    rendus.push((i, document));
                }
                Err(e) => {
                    etape.statut = "echec".to_string();
                    etape.erreur = Some(e);
                }
            }
            annoncer(&app, &mission);
        }
        rendus.sort_by_key(|(i, _)| *i);
        for (i, document) in rendus {
            produits.push((format!("{} ({})", mission.etapes[i].prenom, mission.etapes[i].poste), document));
        }
    }

    // 3. Le chef rend compte.
    if produits.is_empty() {
        mission.statut = "echec".to_string();
        annoncer(&app, &mission);
        return Err("aucun agent n'a pu rendre son travail ; le détail est dans chaque mission".to_string());
    }
    let mut enonce = format!("Le dirigeant avait demandé :\n« {} »\n", mission.demande);
    for (qui, texte) in &produits {
        let extrait: String = texte.chars().take(EXTRAIT_PAR_COLLEGUE).collect();
        enonce.push_str(&format!("\n\nTravail de {} :\n{}", qui, extrait));
    }
    for e in mission.etapes.iter().filter(|e| e.statut == "echec") {
        enonce.push_str(&format!("\n\n{} n'a pas pu rendre sa mission : {}", e.prenom, e.erreur.clone().unwrap_or_default()));
    }
    let systeme = format!(
        "{}\n\nL'équipe a fini. Rendez compte au dirigeant comme un bras droit : # un titre, puis ce qui a été fait et ce qu'il faut en retenir, puis « ## Ce qui attend votre décision » (ce qu'il doit valider, envoyer lui-même ou trancher), puis « ## Prochaines étapes ». Court, concret, sans jargon. Ne reprenez aucun chiffre ni aucun nom qui ne soit pas dans le travail de l'équipe.",
        consigne_du_chef(chef.as_ref(), &equipe)
    );
    let corps = json!({
        "model": crate::llm::MODELE_API,
        "max_tokens": 8000,
        "output_config": { "effort": "medium" },
        "system": systeme,
        "messages": [{ "role": "user", "content": enonce }],
    });
    match appeler(&client, ADRESSE_API, &cle, corps).await {
        Ok(contenu) => {
            let (synthese, _) = texte_et_sources(&contenu);
            let chemin = crate::document::poser_document(
                &dossier_de(&nom_chef, &installation)?,
                &nom_du_fichier("synthese", &horodatage),
                &synthese,
            )
            .ok();
            mission.fichier_synthese = chemin.map(|c| c.display().to_string());
            mission.synthese = Some(synthese);
            mission.statut = "terminee".to_string();
        }
        Err(e) => {
            mission.synthese = Some(format!("Le travail est fait, mais je n'ai pas pu en faire la synthèse : {}", e));
            mission.statut = "terminee".to_string();
        }
    }
    annoncer(&app, &mission);
    Ok(mission)
}

/// Les missions déjà confiées, la plus récente d'abord.
#[tauri::command]
pub fn mission_historique() -> Result<Vec<Mission>, String> {
    let dossier = crate::chemins::pour_lire("config/missions");
    let Ok(entrees) = std::fs::read_dir(&dossier) else { return Ok(Vec::new()) };
    let mut missions: Vec<Mission> = entrees
        .filter_map(|e| e.ok())
        .filter_map(|e| std::fs::read_to_string(e.path()).ok())
        .filter_map(|t| serde_json::from_str(&t).ok())
        .collect();
    missions.sort_by(|a: &Mission, b: &Mission| b.commencee.cmp(&a.commencee));
    Ok(missions)
}

/// Un fichier qu'une mission a écrit, et seulement celui-là : l'écran ne peut
/// pas faire ouvrir n'importe quel chemin du poste.
pub fn fichier_connu(missions: &[Mission], fichier: &str) -> bool {
    !fichier.is_empty()
        && missions.iter().any(|m| {
            m.fichier_synthese.as_deref() == Some(fichier)
                || m.etapes.iter().any(|e| e.fichier.as_deref() == Some(fichier))
        })
}

/// Ouvre un document écrit par l'équipe dans le logiciel du poste.
#[tauri::command]
pub fn mission_ouvrir(fichier: String) -> Result<(), String> {
    if !fichier_connu(&mission_historique()?, &fichier) {
        return Err("ce document n'a pas été écrit par votre équipe".to_string());
    }
    if !Path::new(&fichier).is_file() {
        return Err("le document n'est plus à sa place : il a peut-être été déplacé".to_string());
    }
    #[cfg(target_os = "windows")]
    let lancement = std::process::Command::new("explorer").arg(&fichier).spawn();
    #[cfg(target_os = "macos")]
    let lancement = std::process::Command::new("open").arg(&fichier).spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let lancement = std::process::Command::new("xdg-open").arg(&fichier).spawn();
    lancement.map(|_| ()).map_err(|_| "le poste n'a pas su ouvrir le document".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn installation() -> Value {
        json!({ "agents": [
            { "prenom": "Victor", "ficheId": "AG-0000" },
            { "prenom": "Hugo", "ficheId": "AG-0669", "competences": [{ "titre": "Maison", "resume": "Jobber Plus" }] },
            { "prenom": "Léa", "ficheId": "AG-1258" },
            { "prenom": "Fantôme", "ficheId": "AG-9999" }
        ]})
    }

    fn fiche(id: &str) -> Option<Value> {
        match id {
            "AG-0000" => Some(json!({ "nom": "Team Holder", "expert": { "consigne": "Vous coordonnez." } })),
            "AG-0669" => Some(json!({ "nom": "Business plan analyst", "description": "Écrit le business plan.",
                "expert": { "consigne": "Vous écrivez des business plans.", "regles": ["Ne jamais inventer un chiffre"] } })),
            "AG-1258" => Some(json!({ "nom": "Chargé de levée de fonds", "expert": { "consigne": "Vous levez des fonds." } })),
            _ => None,
        }
    }

    #[test]
    fn l_equipe_ne_garde_que_les_agents_dont_la_fiche_se_lit() {
        let e = equipe_de(&installation(), fiche);
        assert_eq!(e.iter().map(|m| m.prenom.as_str()).collect::<Vec<_>>(), ["Victor", "Hugo", "Léa"]);
        assert_eq!(chef_de(&e).unwrap().prenom, "Victor");
        assert_eq!(e[1].competences[0].resume, "Jobber Plus");
        assert_eq!(e[1].regles, ["Ne jamais inventer un chiffre"]);
    }

    #[test]
    fn le_chef_connait_son_equipe_mais_ne_se_confie_pas_de_mission() {
        let e = equipe_de(&installation(), fiche);
        let s = consigne_du_chef(chef_de(&e), &e);
        assert!(s.contains("Hugo : Business plan analyst"));
        assert!(s.contains("Léa : Chargé de levée de fonds"));
        assert!(!s.contains("Victor : Team Holder"));
        assert!(s.contains("n'envoient rien"));
    }

    #[test]
    fn un_plan_qui_confie_une_mission_a_un_inconnu_est_refuse() {
        let e = equipe_de(&installation(), fiche);
        let bon = json!({ "reponse": "Je lance.", "questions": [], "etapes": [
            { "prenom": "hugo", "consigne": "Écris le business plan", "vague": 1 },
            { "prenom": "Léa", "consigne": "Liste les investisseurs", "vague": 2 } ]});
        assert_eq!(plan_recevable(&bon, &e).unwrap().etapes.len(), 2);

        let inconnu = json!({ "reponse": "", "questions": [], "etapes": [{ "prenom": "Paul", "consigne": "x", "vague": 1 }]});
        assert!(plan_recevable(&inconnu, &e).unwrap_err().contains("Paul"));
        let chef = json!({ "reponse": "", "questions": [], "etapes": [{ "prenom": "Victor", "consigne": "x", "vague": 1 }]});
        assert!(plan_recevable(&chef, &e).is_err(), "le chef ne se confie pas de mission à lui-même");
        let vague = json!({ "reponse": "", "questions": [], "etapes": [{ "prenom": "Hugo", "consigne": "x", "vague": 9 }]});
        assert!(plan_recevable(&vague, &e).is_err());
        let trop: Vec<Value> = (0..9).map(|_| json!({ "prenom": "Hugo", "consigne": "x", "vague": 1 })).collect();
        assert!(plan_recevable(&json!({ "reponse": "", "questions": [], "etapes": trop }), &e).is_err());
    }

    #[test]
    fn le_specialiste_garde_ses_regles_et_lit_ses_collegues() {
        let e = equipe_de(&installation(), fiche);
        let (systeme, enonce) = consigne_du_specialiste(
            &e[1], "Victor", "Trouver des financements", "Écris le business plan",
            &["Trop long".to_string()], &[("Nora (Marché)".to_string(), "Le marché vaut 2 Md€".to_string())],
        );
        assert!(systeme.contains("Ne jamais inventer un chiffre"));
        assert!(systeme.contains("Trop long"));
        assert!(systeme.contains("Jobber Plus"));
        assert!(systeme.contains("LinkedIn ne se lit pas"));
        assert!(enonce.contains("Mission confiée par Victor"));
        assert!(enonce.contains("Trouver des financements"));
        assert!(enonce.contains("Le marché vaut 2 Md€"));
    }

    #[test]
    fn la_recherche_ne_lit_pas_linkedin() {
        let c = corps_du_specialiste("m", "s", &[]);
        assert_eq!(c["tools"][0]["type"], "web_search_20260209");
        assert_eq!(c["tools"][0]["blocked_domains"][0], "linkedin.com");
    }

    #[test]
    fn tout_le_texte_et_toutes_les_sources_sont_lus() {
        let contenu = vec![
            json!({ "type": "thinking", "thinking": "" }),
            json!({ "type": "server_tool_use", "id": "s1", "name": "web_search", "input": { "query": "q" } }),
            json!({ "type": "web_search_tool_result", "tool_use_id": "s1", "content": [
                { "type": "web_search_result", "title": "Bpifrance", "url": "https://bpifrance.fr" } ] }),
            json!({ "type": "web_search_tool_result", "tool_use_id": "s2", "content": { "type": "web_search_tool_result_error", "error_code": "max_uses_exceeded" } }),
            json!({ "type": "text", "text": "# Plan\n\nLe prêt d'amorçage ", "citations": null }),
            json!({ "type": "text", "text": "existe.", "citations": [{ "type": "web_search_result_location", "url": "https://bpifrance.fr", "title": "Bpifrance" }, { "url": "https://france2030.gouv.fr", "title": "France 2030" }] }),
        ];
        let (texte, sources) = texte_et_sources(&contenu);
        assert_eq!(texte, "# Plan\n\nLe prêt d'amorçage existe.");
        assert_eq!(sources.len(), 2);
        let doc = document_avec_sources(&texte, &sources);
        assert!(doc.ends_with("- France 2030 : https://france2030.gouv.fr"));
        assert_eq!(document_avec_sources("x\n## Sources\n- a", &sources), "x\n## Sources\n- a");
    }

    /// Un serveur de banc qui rend, dans l'ordre, les réponses qu'on lui donne,
    /// et garde les requêtes reçues.
    async fn serveur(reponses: Vec<(u16, Value)>) -> (String, std::sync::Arc<std::sync::Mutex<Vec<Value>>>) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let ecoute = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let adresse = format!("http://{}/v1/messages", ecoute.local_addr().unwrap());
        let recues = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let garde = recues.clone();
        tokio::spawn(async move {
            for (statut, corps) in reponses {
                let (mut s, _) = ecoute.accept().await.unwrap();
                let mut tampon = Vec::new();
                let mut morceau = [0u8; 65536];
                loop {
                    let n = s.read(&mut morceau).await.unwrap();
                    tampon.extend_from_slice(&morceau[..n]);
                    let t = String::from_utf8_lossy(&tampon).to_string();
                    if let Some(fin) = t.find("\r\n\r\n") {
                        let longueur = t[..fin]
                            .lines()
                            .find_map(|l| l.to_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap()))
                            .unwrap_or(0);
                        if tampon.len() >= fin + 4 + longueur {
                            garde.lock().unwrap().push(serde_json::from_slice(&tampon[fin + 4..fin + 4 + longueur]).unwrap());
                            break;
                        }
                    }
                }
                let texte = corps.to_string();
                let reponse = format!(
                    "HTTP/1.1 {} X\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{}",
                    statut, texte.len(), texte
                );
                s.write_all(reponse.as_bytes()).await.unwrap();
            }
        });
        (adresse, recues)
    }

    #[tokio::test]
    async fn une_pause_du_serveur_se_reprend_sans_rien_ajouter() {
        let (adresse, recues) = serveur(vec![
            (200, json!({ "stop_reason": "pause_turn", "content": [
                { "type": "server_tool_use", "id": "s1", "name": "web_search", "input": {} },
                { "type": "text", "text": "Début. " } ] })),
            (200, json!({ "stop_reason": "end_turn", "content": [ { "type": "text", "text": "Fin." } ] })),
        ])
        .await;
        let corps = corps_du_specialiste("m", "s", &[json!({ "role": "user", "content": "go" })]);
        let contenu = appeler(&reqwest::Client::new(), &adresse, "cle", corps).await.unwrap();
        assert_eq!(texte_et_sources(&contenu).0, "Début. Fin.");
        let recues = recues.lock().unwrap();
        assert_eq!(recues.len(), 2);
        let messages = recues[1]["messages"].as_array().unwrap();
        assert_eq!(messages.len(), 2, "la reprise renvoie le tour du modèle, sans message ajouté");
        assert_eq!(messages[1]["role"], "assistant");
    }

    #[tokio::test]
    async fn une_cle_refusee_et_un_refus_se_disent_en_francais() {
        let (adresse, _) = serveur(vec![
            (401, json!({ "error": { "message": "invalid x-api-key" } })),
            (200, json!({ "stop_reason": "refusal", "content": [] })),
        ])
        .await;
        let client = reqwest::Client::new();
        let corps = json!({ "messages": [] });
        let e = appeler(&client, &adresse, "cle", corps.clone()).await.unwrap_err();
        assert!(e.contains("Vos connexions"), "{}", e);
        let e = appeler(&client, &adresse, "cle", corps).await.unwrap_err();
        assert!(e.contains("refusé"), "{}", e);
    }
    #[test]
    fn l_ecran_n_ouvre_que_ce_que_l_equipe_a_ecrit() {
        let m = Mission {
            id: "1".into(), demande: "d".into(), chef: "Victor".into(), reponse: String::new(),
            questions: vec![],
            etapes: vec![Avancee {
                prenom: "Léa".into(), poste: "p".into(), consigne: "c".into(), vague: 1,
                statut: "fait".into(), fichier: Some("/a/mission-1-lea.docx".into()), erreur: None, sources: 2,
            }],
            synthese: None, fichier_synthese: Some("/a/mission-1-victor.docx".into()),
            statut: "terminee".into(), commencee: 1,
        };
        assert!(fichier_connu(&[m.clone()], "/a/mission-1-lea.docx"));
        assert!(fichier_connu(&[m.clone()], "/a/mission-1-victor.docx"));
        assert!(!fichier_connu(&[m.clone()], "C:\\Windows\\System32\\cmd.exe"));
        assert!(!fichier_connu(&[m], ""));
    }

}
