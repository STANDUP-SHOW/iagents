//! Une procédure web confiée à un agent, qui attend le client sans s'arrêter
//! de vivre, et reprend où elle en était.
//!
//! max, 16/10/2026 : un assistant concurrent est resté bloqué tout un
//! après-midi sur une inscription, à attendre qu'il revienne. Ici :
//!   - l'agent mène la procédure seul dans le navigateur du client
//!     (`pilote.rs`) : il lit, remplit, envoie, vérifie, passe à la page
//!     suivante ;
//!   - quand il lui faut ce que lui seul ne peut pas avoir (un code reçu par
//!     SMS, un captcha, une décision), il le demande en une phrase et la
//!     procédure passe « en attente ». Tout son état est écrit sur le disque :
//!     la conversation, les gestes faits, la question posée. Le reste du
//!     travail continue ; le planificateur et les missions ne l'attendent pas ;
//!   - la réponse du client la fait repartir au geste exact où elle s'était
//!     arrêtée, même après un redémarrage de l'application, dans la même
//!     session du navigateur (le profil est persistant).
//!
//! Ce qui est tenu ici, et pas dans une consigne au modèle : un seul agent
//! tient le navigateur à la fois (une fenêtre, une page) ; un plafond de gestes
//! par passage, au-delà duquel l'agent demande plutôt que de tourner en rond ;
//! les gardes de `pilote.rs` (adresses, LinkedIn, fichiers, mots de passe).

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::Mutex;

use crate::pilote::{self, Futur, Page};

const ADRESSE_API: &str = "https://api.anthropic.com/v1/messages";
/// Gestes par passage. Une inscription en demande 20 à 60 ; au-delà l'agent
/// tourne probablement en rond, et c'est au client de le remettre sur la voie.
pub const GESTES_PAR_PASSAGE: u32 = 120;
const JOURNAL_MAX: usize = 400;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Attente {
    /// Pourquoi l'agent s'est arrêté : « code reçu par SMS ».
    pub raison: String,
    /// Ce qu'il demande au client, en une phrase.
    pub demande: String,
    /// L'appel d'outil auquel la réponse du client répondra.
    pub outil: String,
    pub depuis: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pas {
    pub quand: u64,
    pub geste: String,
    pub issue: String,
    pub reussi: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Procedure {
    pub id: String,
    pub titre: String,
    /// Ce que le client a confié : le site, les champs, les textes, les
    /// fichiers, ce qui dit que c'est fini.
    pub consigne: String,
    /// en-file, en-cours, en-attente, interrompue, terminee, echec, abandonnee
    pub statut: String,
    pub attente: Option<Attente>,
    pub journal: Vec<Pas>,
    pub resultat: Option<String>,
    pub erreur: Option<String>,
    pub commencee: u64,
    pub modifiee: u64,
    pub gestes: u32,
    /// La conversation avec le modèle : c'est elle qui permet de reprendre.
    #[serde(default)]
    pub messages: Vec<Value>,
    /// Les réponses aux autres outils du même tour que la question posée,
    /// envoyées avec la réponse du client.
    #[serde(default)]
    pub en_suspens: Vec<Value>,
}

fn maintenant() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

impl Procedure {
    pub fn nouvelle(titre: &str, consigne: &str) -> Result<Self, String> {
        let titre = titre.trim();
        let consigne = consigne.trim();
        if titre.is_empty() || titre.chars().count() > 120 {
            return Err("donnez un titre court à cette procédure".to_string());
        }
        if consigne.is_empty() {
            return Err("dites à l'agent ce qu'il doit faire, sur quel site, avec quelles informations".to_string());
        }
        let t = maintenant();
        Ok(Procedure {
            id: format!("{}-{}", crate::tache::horodatage(t), &uuid::Uuid::new_v4().simple().to_string()[..6]),
            titre: titre.to_string(),
            consigne: consigne.to_string(),
            statut: "en-file".to_string(),
            attente: None,
            journal: Vec::new(),
            resultat: None,
            erreur: None,
            commencee: t,
            modifiee: t,
            gestes: 0,
            messages: vec![json!({ "role": "user", "content": format!("Procédure : {}\n\n{}", titre, consigne) })],
            en_suspens: Vec::new(),
        })
    }

    /// Ce que l'écran reçoit : sans la conversation, qui peut peser lourd.
    pub fn allegee(&self) -> Self {
        Procedure { messages: Vec::new(), en_suspens: Vec::new(), ..self.clone() }
    }

    fn noter(&mut self, geste: String, issue: String, reussi: bool) {
        self.journal.push(Pas { quand: maintenant(), geste, issue, reussi });
        if self.journal.len() > JOURNAL_MAX {
            let trop = self.journal.len() - JOURNAL_MAX;
            self.journal.drain(..trop);
        }
    }

    /// La réponse du client, ou la reprise après une interruption.
    pub fn reprendre(&mut self, reponse: &str) -> Result<(), String> {
        let reponse = reponse.trim();
        match self.statut.as_str() {
            "en-attente" => {
                let attente = self.attente.take().ok_or("aucune question en attente")?;
                if reponse.is_empty() {
                    self.attente = Some(attente);
                    return Err("répondez à la question de l'agent, ou écrivez « c'est fait » si vous avez agi vous-même dans la fenêtre".to_string());
                }
                let mut resultats = vec![json!({
                    "type": "tool_result",
                    "tool_use_id": attente.outil,
                    "content": format!("Réponse du dirigeant : {}", reponse),
                })];
                resultats.append(&mut self.en_suspens);
                self.messages.push(json!({ "role": "user", "content": resultats }));
                self.noter("réponse du dirigeant".into(), reponse.chars().take(200).collect(), true);
            }
            "interrompue" => {
                // Le dernier tour du modèle attend peut-être encore ses
                // réponses : on les lui donne, puis il relit la page.
                let ids = self.messages.last().filter(|m| m["role"] == "assistant").map(outils_demandes).unwrap_or_default();
                let mut bloc: Vec<Value> = ids
                    .iter()
                    .map(|(id, _, _)| json!({ "type": "tool_result", "tool_use_id": id, "content": "Interrompu avant d'être fait. Relisez la page avant de continuer.", "is_error": true }))
                    .collect();
                let note = if reponse.is_empty() {
                    "La procédure a été interrompue. Relisez la page et reprenez où vous en étiez.".to_string()
                } else {
                    format!("La procédure a été interrompue. Le dirigeant ajoute : {}. Relisez la page et reprenez.", reponse)
                };
                if bloc.is_empty() {
                    match self.messages.last_mut() {
                        Some(m) if m["role"] == "user" => {
                            if let Some(c) = m["content"].as_array_mut() {
                                c.push(json!({ "type": "text", "text": note }));
                            } else {
                                let avant = m["content"].as_str().unwrap_or("").to_string();
                                m["content"] = json!(format!("{}\n\n{}", avant, note));
                            }
                        }
                        _ => self.messages.push(json!({ "role": "user", "content": note })),
                    }
                } else {
                    bloc.push(json!({ "type": "text", "text": note }));
                    self.messages.push(json!({ "role": "user", "content": bloc }));
                }
                self.noter("reprise".into(), note, true);
            }
            autre => return Err(format!("cette procédure ne peut pas reprendre : elle est {}", autre)),
        }
        self.statut = "en-file".to_string();
        self.erreur = None;
        self.gestes = 0;
        self.modifiee = maintenant();
        Ok(())
    }
}

/// Les appels d'outil d'un tour du modèle : (identifiant, nom, entrée).
fn outils_demandes(message: &Value) -> Vec<(String, String, Value)> {
    message["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|b| b["type"] == "tool_use")
        .map(|b| {
            (
                b["id"].as_str().unwrap_or("").to_string(),
                b["name"].as_str().unwrap_or("").to_string(),
                b["input"].clone(),
            )
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Ce que l'agent sait faire, et ce qu'on lui dit
// ---------------------------------------------------------------------------

fn outil(nom: &str, description: &str, proprietes: Value, requis: &[&str]) -> Value {
    json!({
        "name": nom,
        "description": description,
        "input_schema": { "type": "object", "properties": proprietes, "required": requis },
    })
}

pub fn outils() -> Value {
    let element = json!({
        "ref": { "type": "integer", "description": "numéro de l'élément dans la dernière lecture" },
        "libelle": { "type": "string", "description": "son libellé tel que lu, pour vérifier que la page n'a pas changé" },
    });
    let avec = |mut base: Value, extra: Value| {
        for (k, v) in extra.as_object().unwrap() {
            base[k] = v.clone();
        }
        base
    };
    json!([
        outil("lire_page", "Lit la page affichée : adresse, titre, texte visible, champs, boutons, liens, cases, listes avec leurs options, champs de fichier, messages d'erreur, présence d'un captcha.", json!({}), &[]),
        outil("aller_a", "Ouvre une adresse http(s) dans le navigateur.", json!({ "adresse": { "type": "string" } }), &["adresse"]),
        outil("cliquer", "Clique un bouton, un lien, une case ou une étiquette.", element.clone(), &["ref", "libelle"]),
        outil("saisir", "Remplace le contenu d'un champ de texte par ce texte. Jamais pour un mot de passe.", avec(element.clone(), json!({ "texte": { "type": "string" } })), &["ref", "libelle", "texte"]),
        outil("saisir_mot_de_passe", "Tape dans ce champ le mot de passe du compte de ce site : celui du coffre s'il existe, sinon un nouveau, fort, rangé dans le coffre du système. Vous ne le voyez jamais. Utilisez-le aussi pour un champ de confirmation.", element.clone(), &["ref", "libelle"]),
        outil("choisir", "Choisit une option dans une liste déroulante simple.", avec(element.clone(), json!({ "option": { "type": "string" } })), &["ref", "libelle", "option"]),
        outil("cocher", "Coche ou décoche une case.", avec(element.clone(), json!({ "coche": { "type": "boolean" } })), &["ref", "libelle", "coche"]),
        outil("televerser", "Joint des fichiers à un champ de fichier. Les noms sont ceux du dossier de téléversement du dirigeant (Documents/iAgent/Televersements).", avec(element.clone(), json!({ "fichiers": { "type": "array", "items": { "type": "string" } } })), &["ref", "libelle", "fichiers"]),
        outil("appuyer", "Appuie sur une touche dans l'élément actif : Enter, Tab ou Escape.", json!({ "touche": { "type": "string", "enum": ["Enter", "Tab", "Escape"] } }), &["touche"]),
        outil("capture", "Photographie la page, pour vérifier ce que la lecture ne montre pas (image, mise en page).", json!({}), &[]),
        outil("attendre_humain", "Met la procédure en attente du dirigeant quand il faut ce que vous ne pouvez pas obtenir : un code reçu par e-mail ou SMS, un captcha, une vérification d'identité, un paiement, une information absente de la consigne. Le reste de son travail continue ; sa réponse vous reviendra ici.", json!({ "raison": { "type": "string", "description": "en quelques mots" }, "demande": { "type": "string", "description": "ce qu'il doit vous donner ou faire, en une phrase" } }), &["raison", "demande"]),
        outil("terminer", "Clôt la procédure avec son compte rendu.", json!({ "reussi": { "type": "boolean" }, "compte_rendu": { "type": "string", "description": "ce qui est fait, l'adresse du compte, l'identifiant employé, ce qui reste à faire" } }), &["reussi", "compte_rendu"]),
    ])
}

pub fn consigne_systeme() -> String {
    format!(
        "Vous êtes un agent d'iAgent qui mène une procédure sur le web pour votre employeur, dans son propre navigateur, où ses sessions sont ouvertes. Il est absent : vous travaillez seul et vous allez au bout.\n\n\
Méthode :\n\
- Lisez la page (lire_page) avant d'agir, et relisez-la après chaque envoi de formulaire ou changement de page pour vérifier le résultat : message de confirmation, erreur, champ refusé.\n\
- Les numéros d'éléments viennent de la DERNIÈRE lecture. Si une action répond que la page a changé, relisez-la.\n\
- Une erreur de formulaire se corrige : lisez le message, corrigez le champ, renvoyez.\n\
- Utilisez exactement les informations de la consigne. N'inventez ni adresse, ni numéro, ni texte de présentation absent de la consigne : s'il en manque un, demandez-le (attendre_humain).\n\
- Mots de passe : uniquement saisir_mot_de_passe, jamais saisir.\n\
- Vous pouvez accepter les conditions d'utilisation et les cookies nécessaires quand la procédure l'exige.\n\n\
Vous vous arrêtez et demandez (attendre_humain) pour : un code reçu par e-mail ou SMS, un captcha, une vérification d'identité ou de téléphone, tout paiement ou abonnement payant, une information absente de la consigne. Ne cherchez jamais à contourner un captcha ou une protection contre les robots. Votre question tient en une phrase précise : ce qu'il doit vous donner ou faire.\n\n\
Interdits : {} (le dirigeant y agit lui-même) ; saisir un numéro de carte bancaire ; publier un contenu que la consigne ne fournit pas.\n\n\
À la fin, appelez terminer avec un compte rendu court : ce qui est fait, l'adresse du compte ou de la page créée, l'identifiant employé, ce qui reste à faire (par exemple un e-mail de validation à ouvrir).",
        crate::mission::DOMAINES_INTERDITS.join(", ")
    )
}

/// Les captures déjà vues ne repartent pas à chaque tour : seule la plus
/// récente garde son image.
pub fn alleger(messages: &[Value]) -> Vec<Value> {
    let derniere = messages.len().saturating_sub(1);
    messages
        .iter()
        .enumerate()
        .map(|(i, m)| {
            if i == derniere || m["role"] != "user" {
                return m.clone();
            }
            let mut m = m.clone();
            if let Some(blocs) = m["content"].as_array_mut() {
                for b in blocs.iter_mut() {
                    if let Some(c) = b["content"].as_array_mut() {
                        for x in c.iter_mut() {
                            if x["type"] == "image" {
                                *x = json!({ "type": "text", "text": "[capture déjà vue]" });
                            }
                        }
                    }
                }
            }
            m
        })
        .collect()
}

// ---------------------------------------------------------------------------
// La boucle
// ---------------------------------------------------------------------------

/// Le modèle, vu de la boucle : un tour de conversation. Le vrai appelle
/// l'API d'Anthropic ; les bancs en jouent un écrit d'avance.
pub trait Modele: Send + Sync {
    fn tour<'a>(&'a self, corps: Value) -> Futur<'a, Value>;
}

fn texte(v: &Value, cle: &str) -> String {
    v[cle].as_str().unwrap_or("").to_string()
}

async fn executer(page: &dyn Page, nom: &str, e: &Value) -> Result<Value, String> {
    let r = e["ref"].as_u64().unwrap_or(u64::MAX);
    let l = texte(e, "libelle");
    Ok(match nom {
        "lire_page" => json!(serde_json::to_string(&pilote::lire(page).await?).unwrap_or_default()),
        "aller_a" => {
            let etat = pilote::aller(page, &texte(e, "adresse")).await?;
            json!(format!("page ouverte : {} — {}", texte(&etat, "adresse"), texte(&etat, "titre")))
        }
        "cliquer" => json!(pilote::cliquer(page, r, &l).await?),
        "saisir" => json!(pilote::saisir(page, r, &l, &texte(e, "texte")).await?),
        "saisir_mot_de_passe" => json!(pilote::saisir_mot_de_passe(page, r, &l).await?),
        "choisir" => json!(pilote::choisir(page, r, &l, &texte(e, "option")).await?),
        "cocher" => json!(pilote::cocher(page, r, &l, e["coche"].as_bool().unwrap_or(true)).await?),
        "televerser" => {
            let noms: Vec<String> = e["fichiers"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|x| x.as_str().map(str::to_string))
                .collect();
            json!(pilote::televerser(page, r, &l, &noms).await?)
        }
        "appuyer" => json!(pilote::appuyer(page, &texte(e, "touche")).await?),
        "capture" => {
            let image = pilote::capture(page).await?;
            json!([
                { "type": "image", "source": { "type": "base64", "media_type": "image/jpeg", "data": image } },
                { "type": "text", "text": "capture de la page affichée" },
            ])
        }
        autre => return Err(format!("outil inconnu : {}", autre)),
    })
}

fn resume_du_geste(nom: &str, e: &Value) -> String {
    match nom {
        "aller_a" => format!("aller à {}", texte(e, "adresse")),
        "saisir" => format!("saisir dans « {} »", texte(e, "libelle")),
        "choisir" => format!("choisir « {} » dans « {} »", texte(e, "option"), texte(e, "libelle")),
        "televerser" => format!("joindre {} à « {} »", e["fichiers"], texte(e, "libelle")),
        "appuyer" => format!("appuyer sur {}", texte(e, "touche")),
        "lire_page" => "lire la page".to_string(),
        "capture" => "photographier la page".to_string(),
        _ if !texte(e, "libelle").is_empty() => format!("{} « {} »", nom.replace('_', " "), texte(e, "libelle")),
        _ => nom.replace('_', " "),
    }
}

/// Fait avancer la procédure jusqu'à la fin, une question, ou une panne.
/// `garder` est appelé après chaque tour : un arrêt brutal ne perd au plus
/// que le tour en cours.
pub async fn avancer(
    p: &mut Procedure,
    page: &dyn Page,
    modele: &dyn Modele,
    modele_id: &str,
    garder: &(dyn Fn(&Procedure) + Send + Sync),
) {
    p.statut = "en-cours".to_string();
    p.modifiee = maintenant();
    garder(p);
    loop {
        if p.gestes >= GESTES_PAR_PASSAGE {
            // Pas d'échec sec : on rend la main avec la question, et la
            // réponse du client relance un passage complet.
            let id = format!("plafond-{}", p.journal.len());
            p.messages.push(json!({ "role": "assistant", "content": [{ "type": "tool_use", "id": id, "name": "attendre_humain", "input": {} }] }));
            p.attente = Some(Attente {
                raison: format!("{} gestes sans aboutir", GESTES_PAR_PASSAGE),
                demande: "L'agent a beaucoup agi sans finir. Regardez la fenêtre du navigateur, puis répondez « continue » ou donnez-lui une indication.".to_string(),
                outil: id,
                depuis: maintenant(),
            });
            p.statut = "en-attente".to_string();
            break;
        }
        let corps = json!({
            "model": modele_id,
            "max_tokens": 4000,
            "system": consigne_systeme(),
            "tools": outils(),
            "messages": alleger(&p.messages),
        });
        let reponse = match modele.tour(corps).await {
            Ok(r) => r,
            Err(e) => {
                p.statut = "interrompue".to_string();
                p.erreur = Some(e);
                break;
            }
        };
        let contenu = reponse["content"].as_array().cloned().unwrap_or_default();
        let message = json!({ "role": "assistant", "content": contenu });
        let appels = outils_demandes(&message);
        p.messages.push(message);

        if appels.is_empty() {
            // Le modèle a répondu sans outil : on prend son texte pour compte
            // rendu plutôt que de boucler.
            let dit: String = contenu.iter().filter_map(|b| b["text"].as_str()).collect::<Vec<_>>().join("\n");
            p.resultat = Some(dit);
            p.statut = if reponse["stop_reason"] == "refusal" { "echec" } else { "terminee" }.to_string();
            break;
        }

        let mut resultats: Vec<Value> = Vec::new();
        let mut arret: Option<&str> = None;
        for (id, nom, entree) in &appels {
            if arret.is_some() {
                resultats.push(json!({ "type": "tool_result", "tool_use_id": id, "content": "Pas fait : la procédure attendait le dirigeant. Relisez la page avant de recommencer." }));
                continue;
            }
            match nom.as_str() {
                "attendre_humain" => {
                    p.attente = Some(Attente {
                        raison: texte(entree, "raison"),
                        demande: texte(entree, "demande"),
                        outil: id.clone(),
                        depuis: maintenant(),
                    });
                    p.noter(format!("attendre le dirigeant : {}", texte(entree, "raison")), texte(entree, "demande"), true);
                    arret = Some("en-attente");
                }
                "terminer" => {
                    let reussi = entree["reussi"].as_bool().unwrap_or(false);
                    p.resultat = Some(texte(entree, "compte_rendu"));
                    p.noter("terminer".into(), if reussi { "réussi" } else { "non abouti" }.into(), reussi);
                    resultats.push(json!({ "type": "tool_result", "tool_use_id": id, "content": "Compte rendu reçu." }));
                    arret = Some(if reussi { "terminee" } else { "echec" });
                }
                _ => {
                    p.gestes += 1;
                    let geste = resume_du_geste(nom, entree);
                    match executer(page, nom, entree).await {
                        Ok(contenu) => {
                            let issue = match &contenu {
                                Value::String(s) if nom != "lire_page" => s.clone(),
                                _ => "fait".to_string(),
                            };
                            p.noter(geste, issue, true);
                            resultats.push(json!({ "type": "tool_result", "tool_use_id": id, "content": contenu }));
                        }
                        Err(e) => {
                            p.noter(geste, e.clone(), false);
                            resultats.push(json!({ "type": "tool_result", "tool_use_id": id, "content": e, "is_error": true }));
                        }
                    }
                }
            }
        }
        match arret {
            Some("en-attente") => {
                p.en_suspens = resultats;
                p.statut = "en-attente".to_string();
                break;
            }
            Some(fin) => {
                p.messages.push(json!({ "role": "user", "content": resultats }));
                p.statut = fin.to_string();
                break;
            }
            None => {
                p.messages.push(json!({ "role": "user", "content": resultats }));
                p.modifiee = maintenant();
                garder(p);
            }
        }
    }
    p.modifiee = maintenant();
    garder(p);
}

// ---------------------------------------------------------------------------
// Dans l'application
// ---------------------------------------------------------------------------

/// Les procédures qui tournent dans CE processus. Une procédure « en-cours »
/// sur le disque qui n'y est pas a été coupée par une fermeture.
static ACTIVES: Mutex<Option<HashSet<String>>> = Mutex::new(None);
/// Une fenêtre, une page : un seul agent tient le navigateur à la fois.
static NAVIGATEUR: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn active(id: &str, oui: bool) {
    if let Ok(mut a) = ACTIVES.lock() {
        let a = a.get_or_insert_with(HashSet::new);
        if oui {
            a.insert(id.to_string());
        } else {
            a.remove(id);
        }
    }
}

fn est_active(id: &str) -> bool {
    ACTIVES.lock().ok().and_then(|a| a.as_ref().map(|a| a.contains(id))).unwrap_or(false)
}

fn fichier(id: &str) -> std::path::PathBuf {
    crate::chemins::pour_ecrire(&format!("config/procedures/{}.json", id))
}

fn ecrire(p: &Procedure) {
    let chemin = fichier(&p.id);
    if let Some(parent) = chemin.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(t) = serde_json::to_string_pretty(p) {
        // Écrit à côté puis renommé : une coupure au milieu ne laisse pas une
        // procédure illisible, donc impossible à reprendre.
        let provisoire = chemin.with_extension("json.partiel");
        if std::fs::write(&provisoire, t).is_ok() {
            let _ = std::fs::rename(&provisoire, &chemin);
        }
    }
}

fn lire(id: &str) -> Result<Procedure, String> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("procédure inconnue".to_string());
    }
    let t = std::fs::read_to_string(fichier(id)).map_err(|_| "procédure introuvable".to_string())?;
    let mut p: Procedure = serde_json::from_str(&t).map_err(|e| format!("procédure illisible : {}", e))?;
    if matches!(p.statut.as_str(), "en-cours" | "en-file") && !est_active(&p.id) {
        p.statut = "interrompue".to_string();
    }
    Ok(p)
}

struct Anthropic {
    cle: String,
    client: reqwest::Client,
}

impl Modele for Anthropic {
    fn tour<'a>(&'a self, corps: Value) -> Futur<'a, Value> {
        Box::pin(async move {
            let r = self
                .client
                .post(ADRESSE_API)
                .header("x-api-key", &self.cle)
                .header("anthropic-version", "2023-06-01")
                .json(&corps)
                .send()
                .await
                .map_err(|_| "le service d'Anthropic ne répond pas : vérifiez la connexion à Internet".to_string())?;
            let statut = r.status();
            let brut: Value = r.json().await.map_err(|_| "réponse illisible du service d'Anthropic".to_string())?;
            if statut.as_u16() == 401 {
                return Err("la clé d'API est refusée : vérifiez-la dans « Vos connexions »".to_string());
            }
            if !statut.is_success() {
                return Err(format!(
                    "le service d'Anthropic a refusé la demande ({}) : {}",
                    statut.as_u16(),
                    brut.pointer("/error/message").and_then(Value::as_str).unwrap_or("")
                ));
            }
            Ok(brut)
        })
    }
}

fn annoncer(app: &tauri::AppHandle, p: &Procedure) {
    use tauri::Emitter;
    ecrire(p);
    let _ = app.emit("procedure", p.allegee());
}

/// Fait tourner une procédure en tâche de fond : l'écran rend la main tout de
/// suite, et le reste du travail des agents continue.
fn lancer_en_fond(app: tauri::AppHandle, mut p: Procedure) -> Result<(), String> {
    let cle = crate::llm::cle_api().ok_or(
        "vos agents agissent sur le web par l'API d'Anthropic : posez votre clé dans « Vos connexions »",
    )?;
    active(&p.id, true);
    annoncer(&app, &p);
    tauri::async_runtime::spawn(async move {
        let _navigateur = NAVIGATEUR.lock().await;
        let page = pilote::Fenetre { app: app.clone() };
        // Le navigateur doit être ouvert pour que l'agent y travaille ; s'il
        // est fermé, il s'ouvre derrière, sur la dernière adresse connue ou
        // une page vide du web.
        if page.script("etat", json!({})).await.is_err() {
            if let Ok(url) = tauri::Url::parse("https://www.google.com/") {
                let _ = crate::navigateur::ouvrir(&app, url, false);
                let _ = pilote::attendre_chargement(&page).await;
            }
        }
        let modele = Anthropic { cle, client: reqwest::Client::new() };
        let app_garde = app.clone();
        let garder = move |p: &Procedure| annoncer(&app_garde, p);
        avancer(&mut p, &page, &modele, crate::llm::MODELE_API, &garder).await;
        active(&p.id, false);
        annoncer(&app, &p);
    });
    Ok(())
}

#[tauri::command]
pub fn procedure_lancer(app: tauri::AppHandle, titre: String, consigne: String) -> Result<Procedure, String> {
    let p = Procedure::nouvelle(&titre, &consigne)?;
    lancer_en_fond(app, p.clone())?;
    Ok(p.allegee())
}

/// La réponse du client à la question de l'agent, ou « continue » après une
/// interruption : la procédure repart au geste où elle s'était arrêtée.
#[tauri::command]
pub fn procedure_reprendre(app: tauri::AppHandle, id: String, reponse: String) -> Result<Procedure, String> {
    if est_active(&id) {
        return Err("cette procédure est déjà en cours".to_string());
    }
    let mut p = lire(&id)?;
    p.reprendre(&reponse)?;
    lancer_en_fond(app, p.clone())?;
    Ok(p.allegee())
}

#[tauri::command]
pub fn procedure_abandonner(app: tauri::AppHandle, id: String) -> Result<Procedure, String> {
    if est_active(&id) {
        return Err("attendez que l'agent rende la main (question ou fin) pour abandonner".to_string());
    }
    let mut p = lire(&id)?;
    p.statut = "abandonnee".to_string();
    p.attente = None;
    p.modifiee = maintenant();
    annoncer(&app, &p);
    Ok(p.allegee())
}

/// Les procédures, la plus récemment touchée d'abord.
#[tauri::command]
pub fn procedure_liste() -> Result<Vec<Procedure>, String> {
    let dossier = crate::chemins::pour_ecrire("config/procedures");
    let Ok(entrees) = std::fs::read_dir(&dossier) else { return Ok(Vec::new()) };
    let mut liste: Vec<Procedure> = entrees
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let nom = e.file_name().to_string_lossy().to_string();
            nom.strip_suffix(".json").and_then(|id| lire(id).ok())
        })
        .map(|p| p.allegee())
        .collect();
    liste.sort_by(|a, b| b.modifiee.cmp(&a.modifiee));
    Ok(liste)
}

/// Où déposer les logos et bannières que les agents joindront.
#[tauri::command]
pub fn procedure_dossier_televersements() -> Result<String, String> {
    let d = pilote::dossier_televersements()?;
    std::fs::create_dir_all(&d).map_err(|e| format!("création de {} : {}", d.display(), e))?;
    Ok(d.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pilote::tests::FaussePage;

    /// Un modèle qui joue une suite de tours écrite d'avance et garde ce
    /// qu'on lui a envoyé.
    struct Joue {
        tours: Mutex<Vec<Value>>,
        recu: Mutex<Vec<Value>>,
    }

    impl Joue {
        fn new(tours: Vec<Value>) -> Self {
            Joue { tours: Mutex::new(tours.into_iter().rev().collect()), recu: Mutex::new(Vec::new()) }
        }
    }

    impl Modele for Joue {
        fn tour<'a>(&'a self, corps: Value) -> Futur<'a, Value> {
            Box::pin(async move {
                self.recu.lock().unwrap().push(corps);
                self.tours.lock().unwrap().pop().ok_or_else(|| "plus de tours".to_string())
            })
        }
    }

    fn appel(id: &str, nom: &str, entree: Value) -> Value {
        json!({ "type": "tool_use", "id": id, "name": nom, "input": entree })
    }

    fn tour(blocs: Vec<Value>) -> Value {
        json!({ "content": blocs, "stop_reason": "tool_use" })
    }

    fn page() -> FaussePage {
        let p = FaussePage { cdp_dispo: true, ..Default::default() };
        *p.adresse.lock().unwrap() = "https://exemple.fr/inscription".to_string();
        *p.lecture.lock().unwrap() = json!({ "adresse": "https://exemple.fr/inscription", "elements": [] });
        p
    }

    fn rien(_: &Procedure) {}

    /// Les messages envoyés au modèle doivent former une conversation que
    /// l'API accepte : chaque tool_use trouve son tool_result au message
    /// suivant, et les rôles alternent.
    fn conversation_valide(messages: &[Value]) {
        for (i, m) in messages.iter().enumerate() {
            let role = if i % 2 == 0 { "user" } else { "assistant" };
            assert_eq!(m["role"], role, "rôle inattendu au message {}", i);
            let ids: Vec<String> = outils_demandes(m).into_iter().map(|(id, _, _)| id).collect();
            if ids.is_empty() {
                continue;
            }
            let suivant = messages.get(i + 1).expect("un tool_use sans réponse");
            let repondus: Vec<String> = suivant["content"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|b| b["type"] == "tool_result")
                .map(|b| b["tool_use_id"].as_str().unwrap().to_string())
                .collect();
            for id in ids {
                assert!(repondus.contains(&id), "tool_use {} sans tool_result", id);
            }
        }
    }

    #[tokio::test]
    async fn la_procedure_attend_le_code_puis_reprend_au_meme_geste() {
        let page = page();
        let mut p = Procedure::nouvelle("Inscription Exemple", "Créer le compte iAgent sur exemple.fr").unwrap();
        let modele = Joue::new(vec![
            tour(vec![appel("a", "lire_page", json!({}))]),
            tour(vec![
                appel("b", "saisir", json!({ "ref": 2, "libelle": "Nom", "texte": "iAgent" })),
                appel("c", "cliquer", json!({ "ref": 5, "libelle": "Créer" })),
            ]),
            tour(vec![
                json!({ "type": "text", "text": "Le site demande un code." }),
                appel("d", "attendre_humain", json!({ "raison": "code reçu par SMS", "demande": "Donnez-moi le code à 6 chiffres reçu au 07 46 47 69 68." })),
                appel("e", "cliquer", json!({ "ref": 7, "libelle": "Valider" })),
            ]),
        ]);
        avancer(&mut p, &page, &modele, "m", &rien).await;
        assert_eq!(p.statut, "en-attente");
        let attente = p.attente.clone().unwrap();
        assert_eq!(attente.outil, "d");
        assert!(attente.demande.contains("code à 6 chiffres"));
        // Le geste demandé après la question n'a pas été fait.
        assert!(!page.appels.lock().unwrap().iter().any(|a| a.contains("Valider")));
        assert_eq!(p.gestes, 3);

        // Elle survit à l'écriture sur le disque et à la relecture.
        let mut p: Procedure = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        assert!(p.reprendre("").is_err(), "une réponse vide ne relance rien");
        p.reprendre("482913").unwrap();
        assert_eq!(p.statut, "en-file");
        let modele = Joue::new(vec![
            tour(vec![appel("f", "saisir", json!({ "ref": 1, "libelle": "Code", "texte": "482913" }))]),
            tour(vec![appel("g", "terminer", json!({ "reussi": true, "compte_rendu": "Compte créé : https://exemple.fr/iagent" }))]),
        ]);
        avancer(&mut p, &page, &modele, "m", &rien).await;
        assert_eq!(p.statut, "terminee");
        assert_eq!(p.resultat.as_deref(), Some("Compte créé : https://exemple.fr/iagent"));
        // Le modèle a reçu la réponse du client à SA question.
        let premier = &modele.recu.lock().unwrap()[0];
        let dernier = premier["messages"].as_array().unwrap().last().unwrap().clone();
        let texte = serde_json::to_string(&dernier).unwrap();
        assert!(texte.contains("\"tool_use_id\":\"d\"") && texte.contains("Réponse du dirigeant : 482913"));
        assert!(texte.contains("\"tool_use_id\":\"e\""));
        conversation_valide(&p.messages);
        assert!(page.appels.lock().unwrap().iter().any(|a| a.contains("482913")));
    }

    #[tokio::test]
    async fn une_panne_du_modele_interrompt_sans_rien_perdre() {
        let page = page();
        let mut p = Procedure::nouvelle("X", "Y").unwrap();
        let modele = Joue::new(vec![tour(vec![appel("a", "lire_page", json!({}))])]);
        avancer(&mut p, &page, &modele, "m", &rien).await;
        assert_eq!(p.statut, "interrompue");
        assert_eq!(p.erreur.as_deref(), Some("plus de tours"));
        p.reprendre("").unwrap();
        let modele = Joue::new(vec![tour(vec![appel("b", "terminer", json!({ "reussi": true, "compte_rendu": "ok" }))])]);
        avancer(&mut p, &page, &modele, "m", &rien).await;
        assert_eq!(p.statut, "terminee");
        conversation_valide(&p.messages);
    }

    #[tokio::test]
    async fn une_coupure_au_milieu_d_un_tour_se_reprend() {
        // L'application s'est fermée après le tour du modèle, avant les
        // réponses : la reprise répond aux outils restés sans réponse.
        let mut p = Procedure::nouvelle("X", "Y").unwrap();
        p.messages.push(json!({ "role": "assistant", "content": [appel("a", "cliquer", json!({ "ref": 1, "libelle": "OK" }))] }));
        p.statut = "interrompue".to_string();
        p.reprendre("").unwrap();
        let page = page();
        let modele = Joue::new(vec![tour(vec![appel("b", "terminer", json!({ "reussi": false, "compte_rendu": "non" }))])]);
        avancer(&mut p, &page, &modele, "m", &rien).await;
        assert_eq!(p.statut, "echec");
        conversation_valide(&p.messages);
    }

    #[tokio::test]
    async fn une_erreur_de_geste_revient_a_l_agent_sans_arreter_la_procedure() {
        let page = page();
        let mut p = Procedure::nouvelle("X", "Y").unwrap();
        let modele = Joue::new(vec![
            tour(vec![appel("a", "aller_a", json!({ "adresse": "https://www.linkedin.com/" }))]),
            tour(vec![appel("b", "terminer", json!({ "reussi": false, "compte_rendu": "LinkedIn est réservé au dirigeant" }))]),
        ]);
        avancer(&mut p, &page, &modele, "m", &rien).await;
        assert_eq!(p.statut, "echec");
        assert!(!p.journal[0].reussi);
        assert!(p.journal[0].issue.contains("hors d'atteinte"));
        let envoye = serde_json::to_string(&modele.recu.lock().unwrap()[1]).unwrap();
        assert!(envoye.contains("\"is_error\":true"));
    }

    #[tokio::test]
    async fn au_plafond_l_agent_demande_au_lieu_de_tourner_en_rond() {
        let page = page();
        let mut p = Procedure::nouvelle("X", "Y").unwrap();
        p.gestes = GESTES_PAR_PASSAGE;
        let modele = Joue::new(vec![]);
        avancer(&mut p, &page, &modele, "m", &rien).await;
        assert_eq!(p.statut, "en-attente");
        p.reprendre("continue").unwrap();
        assert_eq!(p.gestes, 0);
        conversation_valide(&p.messages);
    }

    #[test]
    fn seule_la_derniere_capture_repart() {
        let image = json!({ "type": "image", "source": { "data": "AAA" } });
        let m = vec![
            json!({ "role": "user", "content": "x" }),
            json!({ "role": "assistant", "content": [] }),
            json!({ "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "a", "content": [image.clone()] }] }),
            json!({ "role": "assistant", "content": [] }),
            json!({ "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "b", "content": [image] }] }),
        ];
        let l = serde_json::to_string(&alleger(&m)).unwrap();
        assert_eq!(l.matches("AAA").count(), 1);
        assert!(l.contains("[capture déjà vue]"));
    }

    #[test]
    fn les_outils_et_la_consigne_tiennent_les_regles() {
        let o = outils();
        let noms: Vec<&str> = o.as_array().unwrap().iter().map(|t| t["name"].as_str().unwrap()).collect();
        for n in ["lire_page", "aller_a", "cliquer", "saisir", "saisir_mot_de_passe", "choisir", "cocher", "televerser", "appuyer", "capture", "attendre_humain", "terminer"] {
            assert!(noms.contains(&n), "outil manquant : {}", n);
        }
        let c = consigne_systeme();
        assert!(c.contains("linkedin.com"));
        assert!(c.contains("captcha"));
        assert!(c.contains("saisir_mot_de_passe"));
    }

    #[test]
    fn une_procedure_sans_consigne_est_refusee() {
        assert!(Procedure::nouvelle("", "x").is_err());
        assert!(Procedure::nouvelle("x", "  ").is_err());
        assert!(lire("../../etc/passwd").is_err());
    }
}
