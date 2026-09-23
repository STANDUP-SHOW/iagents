//! Le client MCP de l'application.
//!
//! Un agent ne sait rien faire tout seul : il parle, et pour agir il appelle des
//! outils. MCP est le protocole par lequel ces outils arrivent. Ce module est le
//! seul endroit où un outil extérieur peut être appelé, et il est écrit pour
//! refuser plus souvent qu'il n'accepte.
//!
//! Quatre refus sont dans le code, pas dans une consigne au modèle :
//!   - **liste blanche par agent.** Un agent n'appelle que les outils que sa
//!     fiche nomme. Tout le reste est refusé, y compris un outil que le serveur
//!     vient d'ajouter entre deux lancements : un serveur qui grandit ne doit pas
//!     élargir ce qu'un agent a le droit de faire.
//!   - **rien ne s'écrit sans que le client ait validé.** Un outil que le serveur
//!     ne déclare pas en lecture seule exige une validation explicite, passée à
//!     l'appel. C'est la règle du dépôt (« l'agent remplit, le client valide »)
//!     appliquée au protocole.
//!   - **quota et délai.** Un agent qui part en boucle s'arrête au compte, et un
//!     serveur qui ne répond pas rend la main au lieu de figer l'application.
//!   - **arrêt immédiat.** Un interrupteur coupe les appels en cours et refuse
//!     les suivants, sans attendre la fin de quoi que ce soit.
//!
//! Tout appel est journalisé, abouti ou refusé, parce que le client a le droit de
//! savoir ce que son employé a fait de ses accès.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// La version du protocole que ce client sait parler.
pub const VERSION_PROTOCOLE: &str = "2025-06-18";

/// Au-delà, on considère que le serveur ne répondra pas.
pub const DELAI_PAR_DEFAUT: Duration = Duration::from_secs(30);

// ---------------------------------------------------------------------------
// Ce qu'un agent a le droit de faire
// ---------------------------------------------------------------------------

/// Les outils qu'un agent peut appeler, et jusqu'où.
///
/// Rien n'est permis par défaut : une autorisation absente est une autorisation
/// refusée. C'est l'inverse d'un réglage, et c'est voulu — un agent livré avec
/// une liste vide ne peut rien casser.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Autorisations {
    /// `serveur/outil`, exactement comme le serveur les nomme.
    pub outils: Vec<String>,
    /// Nombre maximal d'appels pour une exécution. 0 = aucun appel.
    pub quota: u32,
}

impl Autorisations {
    pub fn permet(&self, serveur: &str, outil: &str) -> bool {
        let entier = format!("{}/{}", serveur, outil);
        self.outils.iter().any(|o| o == &entier)
    }
}

/// Pourquoi un appel n'a pas eu lieu. Chaque cas se dit en clair au client :
/// une erreur muette passerait pour une panne de l'outil.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Refus {
    HorsListe { serveur: String, outil: String },
    QuotaAtteint { quota: u32 },
    ValidationManquante { outil: String },
    Arrete,
    Injoignable { detail: String },
    DelaiDepasse { secondes: u64 },
}

impl Refus {
    /// La phrase que lit le client. Pas de code, pas de nom de fonction.
    pub fn en_clair(&self) -> String {
        match self {
            Refus::HorsListe { serveur, outil } => format!(
                "Votre agent a voulu se servir de « {} » dans {}, qui ne fait pas partie de ce que vous lui avez confié.",
                outil, serveur
            ),
            Refus::QuotaAtteint { quota } => format!(
                "Votre agent s'est arrêté après {} actions sur cette tâche. C'est la limite que vous lui avez donnée.",
                quota
            ),
            Refus::ValidationManquante { outil } => format!(
                "« {} » modifie quelque chose chez vous. Votre agent attend que vous validiez avant de le faire.",
                outil
            ),
            Refus::Arrete => "Vous avez arrêté votre agent. Rien d'autre ne sera fait.".to_string(),
            Refus::Injoignable { detail } => {
                format!("L'outil n'a pas répondu : {}", detail)
            }
            Refus::DelaiDepasse { secondes } => format!(
                "L'outil n'a rien répondu en {} secondes. Votre agent est passé à la suite.",
                secondes
            ),
        }
    }
}

// ---------------------------------------------------------------------------
// Le journal : ce que l'agent a fait des accès du client
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appel {
    pub date: String,
    pub agent: String,
    pub serveur: String,
    pub outil: String,
    /// `true` quand l'appel a eu lieu, `false` quand il a été refusé.
    pub abouti: bool,
    /// Le motif en clair quand l'appel n'a pas eu lieu.
    pub motif: String,
}

/// Le journal vit en mémoire pendant l'exécution et se relit entier. Il n'est
/// pas taillé : un agent qui aurait fait mille appels doit pouvoir le montrer.
#[derive(Debug, Default)]
pub struct Journal {
    appels: Vec<Appel>,
}

impl Journal {
    pub fn nouveau() -> Self {
        Journal { appels: Vec::new() }
    }

    pub fn inscrire(&mut self, appel: Appel) {
        self.appels.push(appel);
    }

    pub fn appels(&self) -> &[Appel] {
        &self.appels
    }

    pub fn refuses(&self) -> usize {
        self.appels.iter().filter(|a| !a.abouti).count()
    }
}

// ---------------------------------------------------------------------------
// Le transport
// ---------------------------------------------------------------------------

/// Ce qu'il faut savoir faire pour porter du JSON-RPC : envoyer une ligne, en
/// lire une. Le passer en trait laisse le banc éprouver tout le module sans
/// lancer un seul processus, et sans dépendre de ce qui est installé sur la
/// machine qui fait tourner les tests.
pub trait Transport: Send {
    fn envoyer(&mut self, ligne: &str) -> Result<(), String>;
    fn lire(&mut self, delai: Duration) -> Result<String, String>;
    /// Coupe le lien. Appelé à l'arrêt, y compris au milieu d'un appel.
    fn couper(&mut self);
}

/// Un outil tel que le serveur le décrit.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Outil {
    pub nom: String,
    pub description: String,
    /// Le serveur affirme que cet outil ne modifie rien. Absent = on suppose
    /// qu'il modifie : mieux vaut demander une validation de trop qu'écrire
    /// chez le client sans le lui dire.
    pub lecture_seule: bool,
}

// ---------------------------------------------------------------------------
// Le client
// ---------------------------------------------------------------------------

pub struct Client {
    serveur: String,
    transport: Box<dyn Transport>,
    autorisations: Autorisations,
    journal: Journal,
    appels: AtomicU32,
    arret: Arc<AtomicBool>,
    prochain_id: u64,
    outils: Vec<Outil>,
    delai: Duration,
    /// Les outils que le dépôt affirme en lecture seule là où le serveur ne dit
    /// rien. Voir `OutilDeclare::lecture_seule`.
    lectures_seules_affirmees: Vec<String>,
}

impl Client {
    pub fn nouveau(
        serveur: &str,
        transport: Box<dyn Transport>,
        autorisations: Autorisations,
        arret: Arc<AtomicBool>,
    ) -> Self {
        Client {
            serveur: serveur.to_string(),
            transport,
            autorisations,
            journal: Journal::nouveau(),
            appels: AtomicU32::new(0),
            arret,
            prochain_id: 1,
            outils: Vec::new(),
            delai: DELAI_PAR_DEFAUT,
            lectures_seules_affirmees: Vec::new(),
        }
    }

    /// Les outils que le dépôt affirme en lecture seule, faute d'annotation du
    /// serveur. Ils passeront sans validation du client ; c'est pour ça que la
    /// déclaration exige d'écrire pourquoi.
    pub fn avec_lectures_seules(mut self, noms: Vec<String>) -> Self {
        self.lectures_seules_affirmees = noms;
        self
    }

    pub fn avec_delai(mut self, delai: Duration) -> Self {
        self.delai = delai;
        self
    }

    pub fn journal(&self) -> &Journal {
        &self.journal
    }

    pub fn outils(&self) -> &[Outil] {
        &self.outils
    }

    fn id_suivant(&mut self) -> u64 {
        let id = self.prochain_id;
        self.prochain_id += 1;
        id
    }

    fn maintenant() -> String {
        // L'heure de l'appel, en secondes depuis l'époque. Le format lisible est
        // l'affaire de l'interface, pas celle d'un journal qu'on relit à la machine.
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs().to_string())
            .unwrap_or_else(|_| "0".to_string())
    }

    fn noter(&mut self, agent: &str, outil: &str, abouti: bool, motif: &str) {
        let appel = Appel {
            date: Self::maintenant(),
            agent: agent.to_string(),
            serveur: self.serveur.clone(),
            outil: outil.to_string(),
            abouti,
            motif: motif.to_string(),
        };
        self.journal.inscrire(appel);
    }

    /// Un aller-retour JSON-RPC. Les notifications n'attendent pas de réponse.
    fn demander(&mut self, methode: &str, params: serde_json::Value) -> Result<serde_json::Value, Refus> {
        if self.arret.load(Ordering::SeqCst) {
            return Err(Refus::Arrete);
        }
        let id = self.id_suivant();
        let requete = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": methode,
            "params": params,
        });
        self.transport
            .envoyer(&requete.to_string())
            .map_err(|e| Refus::Injoignable { detail: e })?;

        // Un serveur peut intercaler ses propres notifications et requêtes avant
        // de répondre. On lit jusqu'à trouver la réponse portant notre identifiant
        // plutôt que de prendre la première ligne venue pour la nôtre.
        loop {
            if self.arret.load(Ordering::SeqCst) {
                self.transport.couper();
                return Err(Refus::Arrete);
            }
            let ligne = self.transport.lire(self.delai).map_err(|e| {
                if e.contains("délai") {
                    Refus::DelaiDepasse { secondes: self.delai.as_secs() }
                } else {
                    Refus::Injoignable { detail: e }
                }
            })?;
            let valeur: serde_json::Value = serde_json::from_str(&ligne)
                .map_err(|e| Refus::Injoignable { detail: format!("réponse illisible : {}", e) })?;
            if valeur.get("id").and_then(serde_json::Value::as_u64) != Some(id) {
                continue;
            }
            if let Some(erreur) = valeur.get("error") {
                let message = erreur
                    .get("message")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("erreur sans message");
                return Err(Refus::Injoignable { detail: message.to_string() });
            }
            return Ok(valeur.get("result").cloned().unwrap_or(serde_json::Value::Null));
        }
    }

    fn notifier(&mut self, methode: &str) -> Result<(), Refus> {
        let notification = serde_json::json!({ "jsonrpc": "2.0", "method": methode });
        self.transport
            .envoyer(&notification.to_string())
            .map_err(|e| Refus::Injoignable { detail: e })
    }

    /// La poignée de main, puis la liste des outils que le serveur propose.
    ///
    /// On garde cette liste : un outil qui apparaîtrait après coup ne sera pas
    /// appelable, même s'il figure dans la liste blanche. Un serveur qui grandit
    /// en cours de route n'a pas à élargir ce qu'un agent peut faire.
    pub fn ouvrir(&mut self) -> Result<(), Refus> {
        let params = serde_json::json!({
            "protocolVersion": VERSION_PROTOCOLE,
            "capabilities": {},
            "clientInfo": { "name": "iAgent Desktop", "version": env!("CARGO_PKG_VERSION") },
        });
        self.demander("initialize", params)?;
        self.notifier("notifications/initialized")?;

        let resultat = self.demander("tools/list", serde_json::json!({}))?;
        let affirmees = self.lectures_seules_affirmees.clone();
        self.outils = resultat
            .get("tools")
            .and_then(serde_json::Value::as_array)
            .map(|outils| {
                outils
                    .iter()
                    .map(|o| {
                        let nom = o
                            .get("name")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                            .to_string();
                        Outil {
                        description: o
                            .get("description")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                            .to_string(),
                        // Absent vaut « modifie » : on ne suppose pas l'innocuité.
                        // Le dépôt peut affirmer le contraire, mais seulement
                        // après avoir écrit ce que l'outil fait.
                        lecture_seule: o
                            .get("annotations")
                            .and_then(|a| a.get("readOnlyHint"))
                            .and_then(serde_json::Value::as_bool)
                            .unwrap_or(false)
                            || affirmees.contains(&nom),
                        nom,
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(())
    }

    /// Les outils que CET agent peut réellement appeler : l'intersection de ce
    /// que le serveur propose et de ce que sa fiche lui confie.
    pub fn outils_permis(&self) -> Vec<&Outil> {
        self.outils
            .iter()
            .filter(|o| self.autorisations.permet(&self.serveur, &o.nom))
            .collect()
    }

    /// Le seul chemin vers un outil.
    ///
    /// `valide` est la validation du client pour cet appel précis. Un outil que le
    /// serveur ne déclare pas en lecture seule ne part pas sans elle : c'est ici
    /// que « l'agent remplit, le client valide » cesse d'être une intention.
    pub fn appeler(
        &mut self,
        agent: &str,
        outil: &str,
        arguments: serde_json::Value,
        valide: bool,
    ) -> Result<serde_json::Value, Refus> {
        if self.arret.load(Ordering::SeqCst) {
            let refus = Refus::Arrete;
            self.noter(agent, outil, false, &refus.en_clair());
            return Err(refus);
        }

        if !self.autorisations.permet(&self.serveur, outil) {
            let refus = Refus::HorsListe {
                serveur: self.serveur.clone(),
                outil: outil.to_string(),
            };
            self.noter(agent, outil, false, &refus.en_clair());
            return Err(refus);
        }

        // Un outil que le serveur n'a pas annoncé n'existe pas pour nous, même
        // autorisé : la liste blanche dit ce qui est permis, pas ce qui existe.
        let connu = self.outils.iter().find(|o| o.nom == outil).cloned();
        let Some(connu) = connu else {
            let refus = Refus::HorsListe {
                serveur: self.serveur.clone(),
                outil: outil.to_string(),
            };
            self.noter(agent, outil, false, &refus.en_clair());
            return Err(refus);
        };

        if !connu.lecture_seule && !valide {
            let refus = Refus::ValidationManquante { outil: outil.to_string() };
            self.noter(agent, outil, false, &refus.en_clair());
            return Err(refus);
        }

        // Le quota se compte avant l'appel : un appel parti compte, même s'il échoue.
        let faits = self.appels.fetch_add(1, Ordering::SeqCst);
        if faits >= self.autorisations.quota {
            let refus = Refus::QuotaAtteint { quota: self.autorisations.quota };
            self.noter(agent, outil, false, &refus.en_clair());
            return Err(refus);
        }

        let params = serde_json::json!({ "name": outil, "arguments": arguments });
        match self.demander("tools/call", params) {
            Ok(resultat) => {
                self.noter(agent, outil, true, "");
                Ok(resultat)
            }
            Err(refus) => {
                self.noter(agent, outil, false, &refus.en_clair());
                Err(refus)
            }
        }
    }

    /// Arrête tout, maintenant. Les appels en cours rendent la main et les
    /// suivants sont refusés sans que personne n'ait à attendre.
    pub fn arreter(&mut self) {
        self.arret.store(true, Ordering::SeqCst);
        self.transport.couper();
    }
}

// ---------------------------------------------------------------------------
// Les serveurs déclarés
// ---------------------------------------------------------------------------

/// Un serveur MCP tel que l'application sait le lancer.
///
/// Aucun secret ici : `env` ne porte que des noms de variables, dont la valeur
/// est lue dans le trousseau du système au lancement. Une clé écrite dans un
/// fichier de configuration se retrouverait dans une sauvegarde, dans un
/// journal, ou dans le dépôt.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServeurDeclare {
    pub nom: String,
    /// La commande qui lance un serveur sur le poste. Vide pour un serveur
    /// distant, qui porte une `url` à la place.
    #[serde(default)]
    pub commande: String,
    #[serde(default)]
    pub arguments: Vec<String>,
    /// L'adresse d'un serveur distant, en « Streamable HTTP ». C'est l'autre
    /// façon d'avoir un serveur : ou bien on le lance, ou bien on le joint.
    #[serde(default)]
    pub url: Option<String>,
    /// Le NOM de la variable dont la valeur, lue au trousseau, sert de jeton
    /// porteur vers un serveur distant. Jamais le jeton lui-même.
    #[serde(default)]
    pub jeton: Option<String>,
    /// Les NOMS des variables d'environnement à remplir depuis le trousseau.
    #[serde(default)]
    pub secrets: Vec<String>,
    /// Le connecteur du catalogue dont ce serveur est la mise en œuvre, quand il
    /// y en a un. C'est par lui que passe la règle d'activation.
    #[serde(default)]
    pub connecteur: Option<String>,
    /// Les outils de ce serveur que le dépôt retient, relevés sur un serveur qui
    /// tourne et non devinés. La liste est ici et pas chez le serveur : un
    /// serveur qui grandit entre deux lancements n'élargit rien.
    #[serde(default)]
    pub outils: Vec<OutilDeclare>,
}

/// Un outil retenu, tel que le dépôt le déclare.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OutilDeclare {
    pub nom: String,
    /// Affirme que cet outil ne modifie rien, quand le serveur ne l'annonce pas.
    ///
    /// C'est un affaiblissement d'une règle de sûreté : sans cette ligne, un
    /// outil non annoncé exige une validation du client à chaque appel. On ne
    /// l'écrit donc qu'après avoir lu ce que l'outil fait, et `pourquoi` porte
    /// cette lecture — `declaration_recevable` refuse l'affirmation sans elle.
    ///
    /// Le fichier l'écrit `lectureSeule`, comme le reste des données du dépôt.
    #[serde(default, rename = "lectureSeule")]
    pub lecture_seule: Option<bool>,
    #[serde(default)]
    pub pourquoi: String,
}

impl ServeurDeclare {
    /// Tous les noms de variables que ce serveur attend : ses secrets, et son
    /// jeton s'il en faut un. Une seule liste, pour que le trousseau, l'écran et
    /// la vérification de recevabilité ne finissent pas par en connaître trois.
    pub fn variables_attendues(&self) -> Vec<String> {
        let mut noms = self.secrets.clone();
        if let Some(jeton) = &self.jeton {
            noms.push(jeton.clone());
        }
        noms
    }

    /// Un serveur qu'on joint par le réseau plutôt qu'en le lançant.
    pub fn est_distant(&self) -> bool {
        self.url.is_some()
    }
}

/// Refuse une déclaration qui porterait une valeur de secret plutôt qu'un nom,
/// ou une adresse par laquelle un jeton traverserait le réseau en clair.
///
/// Le piège est facile : on écrit `"secrets": ["sk-ant-..."]` pour essayer, et la
/// clé part au dépôt. Un nom de variable n'a ni tiret ni point ni espace.
pub fn declaration_recevable(serveur: &ServeurDeclare) -> Result<(), String> {
    if serveur.nom.trim().is_empty() {
        return Err("un serveur sans nom ne peut pas être appelé".to_string());
    }

    // Ou bien on lance le serveur, ou bien on le joint : pas les deux, et jamais
    // ni l'un ni l'autre. Les deux ensemble laisseraient le choix du transport à
    // l'ordre des conditions plutôt qu'à la déclaration.
    let a_commande = !serveur.commande.trim().is_empty();
    match (&serveur.url, a_commande) {
        (None, false) => {
            return Err(format!(
                "{} : ni commande à lancer, ni adresse à joindre",
                serveur.nom
            ))
        }
        (Some(_), true) => {
            return Err(format!(
                "{} : une commande et une adresse à la fois, on ne sait pas lequel des deux serveurs vous voulez",
                serveur.nom
            ))
        }
        _ => {}
    }

    if let Some(url) = &serveur.url {
        adresse_recevable(&serveur.nom, url)?;
    }

    // Un serveur sans outil retenu n'est utilisable par personne, et c'est voulu :
    // la liste se remplit en lançant le serveur une fois et en lisant ce qu'il
    // annonce. Tant qu'elle est vide, personne n'a fait ce relevé.
    if serveur.outils.is_empty() {
        return Err(format!(
            "{} : aucun outil retenu. La liste se relève sur un serveur qui tourne, elle ne se devine pas.",
            serveur.nom
        ));
    }
    for outil in &serveur.outils {
        if outil.nom.trim().is_empty() {
            return Err(format!("{} : un outil sans nom", serveur.nom));
        }
        if outil.lecture_seule == Some(true) && outil.pourquoi.trim().is_empty() {
            return Err(format!(
                "{} : « {} » est affirmé en lecture seule sans dire pourquoi. Cette affirmation dispense le client de valider, elle ne s'écrit pas sans l'avoir lue.",
                serveur.nom, outil.nom
            ));
        }
    }

    for variable in serveur.variables_attendues() {
        let nom_de_variable = !variable.is_empty()
            && variable
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_');
        if !nom_de_variable {
            return Err(format!(
                "{} : « {} » n'est pas un nom de variable. Les secrets se lisent dans le trousseau du système, ils ne s'écrivent pas ici.",
                serveur.nom, variable
            ));
        }
    }
    Ok(())
}

/// Ce qu'une adresse de serveur distant a le droit d'être.
///
/// Deux refus, pour la même raison : un jeton porteur part avec chaque appel.
///   - **le lien doit être chiffré.** En clair, le jeton se lit sur le chemin.
///     La boucle locale est la seule exception, parce qu'elle ne sort pas de la
///     machine — c'est aussi ce que la spécification du protocole admet.
///   - **rien avant l'hôte, rien après le chemin.** Un `?cle=...` ou un
///     `https://jeton@serveur` mettrait un secret dans un fichier du dépôt,
///     exactement ce que `secrets` interdit par ailleurs.
fn adresse_recevable(nom: &str, url: &str) -> Result<(), String> {
    let reste = if let Some(r) = url.strip_prefix("https://") {
        r
    } else if let Some(r) = url.strip_prefix("http://") {
        let hote = r.split(['/', ':']).next().unwrap_or("");
        if hote != "127.0.0.1" && hote != "localhost" && hote != "[::1]" {
            return Err(format!(
                "{} : « {} » n'est pas chiffré. Le jeton d'accès du client partirait en clair à chaque appel.",
                nom, url
            ));
        }
        r
    } else {
        return Err(format!(
            "{} : « {} » n'est pas une adresse web. Un serveur distant se joint en https.",
            nom, url
        ));
    };

    if reste.contains('?') {
        return Err(format!(
            "{} : l'adresse porte des paramètres. Ce qui est secret se range au trousseau du système, pas dans une adresse écrite en clair.",
            nom
        ));
    }
    let avant_le_chemin = reste.split('/').next().unwrap_or("");
    if avant_le_chemin.contains('@') {
        return Err(format!(
            "{} : l'adresse porte un identifiant. Ce qui est secret se range au trousseau du système, pas dans une adresse écrite en clair.",
            nom
        ));
    }
    if avant_le_chemin.is_empty() {
        return Err(format!("{} : l'adresse ne nomme aucun serveur", nom));
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Le transport réel : un processus, ses tuyaux
// ---------------------------------------------------------------------------

/// Parle à un serveur MCP lancé en processus fils, par son entrée et sa sortie
/// standard, une ligne de JSON à la fois.
///
/// La lecture passe par un fil d'exécution dédié qui pousse les lignes dans un
/// canal. C'est ce qui rend le délai tenable : lire directement sur la sortie du
/// fils bloquerait l'application jusqu'à ce qu'il parle, et un serveur qui ne
/// parle jamais figerait l'écran sans rien pour l'interrompre.
pub struct ProcessusTransport {
    fils: std::process::Child,
    entree: Option<std::process::ChildStdin>,
    lignes: std::sync::mpsc::Receiver<String>,
}

impl ProcessusTransport {
    /// Lance le serveur. `secrets` porte les valeurs lues dans le trousseau, que
    /// l'appelant est allé chercher : ce module ne les touche pas autrement que
    /// pour les poser dans l'environnement du fils, et ne les journalise jamais.
    pub fn lancer(
        serveur: &ServeurDeclare,
        secrets: &[(String, String)],
    ) -> Result<Self, String> {
        declaration_recevable(serveur)?;

        let mut commande = std::process::Command::new(&serveur.commande);
        commande
            .args(&serveur.arguments)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            // La sortie d'erreur du serveur part au néant plutôt que dans nos
            // tuyaux : elle contient souvent des chemins, parfois des jetons, et
            // rien de ce qu'elle dit n'est du JSON-RPC.
            .stderr(std::process::Stdio::null());
        for (nom, valeur) in secrets {
            commande.env(nom, valeur);
        }

        let mut fils = commande
            .spawn()
            .map_err(|e| format!("{} n'a pas pu être lancé : {}", serveur.commande, e))?;

        let entree = fils.stdin.take().ok_or("entrée du serveur indisponible")?;
        let sortie = fils.stdout.take().ok_or("sortie du serveur indisponible")?;

        let (envoi, lignes) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            use std::io::BufRead;
            let lecteur = std::io::BufReader::new(sortie);
            for ligne in lecteur.lines() {
                match ligne {
                    // Le canal fermé veut dire que le client est parti : on s'arrête
                    // au lieu de lire dans le vide jusqu'à la fin du processus.
                    Ok(l) => {
                        if envoi.send(l).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(ProcessusTransport { fils, entree: Some(entree), lignes })
    }
}

impl Transport for ProcessusTransport {
    fn envoyer(&mut self, ligne: &str) -> Result<(), String> {
        use std::io::Write;
        let entree = self.entree.as_mut().ok_or("le lien avec le serveur est coupé")?;
        // Le saut de ligne fait la trame : sans lui le serveur attend la suite du
        // message. Le vidage force l'envoi, sinon tout reste dans le tampon.
        writeln!(entree, "{}", ligne).map_err(|e| format!("écriture vers le serveur : {}", e))?;
        entree.flush().map_err(|e| format!("envoi au serveur : {}", e))
    }

    fn lire(&mut self, delai: Duration) -> Result<String, String> {
        match self.lignes.recv_timeout(delai) {
            Ok(ligne) => Ok(ligne),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                Err(format!("délai de {} s dépassé", delai.as_secs()))
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                Err("le serveur s'est arrêté".to_string())
            }
        }
    }

    fn couper(&mut self) {
        // L'entrée se ferme d'abord : un serveur bien élevé s'arrête de lui-même
        // quand son entrée se tarit. On le tue ensuite sans attendre, parce que
        // « arrêt immédiat » veut dire immédiat.
        self.entree = None;
        let _ = self.fils.kill();
        let _ = self.fils.wait();
    }
}

impl Drop for ProcessusTransport {
    fn drop(&mut self) {
        self.couper();
    }
}

// ---------------------------------------------------------------------------
// Le transport distant : une adresse, du JSON-RPC par-dessus HTTP
// ---------------------------------------------------------------------------

/// La marge laissée au fil pour rendre son propre message de délai.
///
/// Les deux attentes se superposent : celle du client HTTP, qui sait combien de
/// secondes il a patienté, et celle du canal. Sans marge, c'est le canal qui
/// expire le premier et le client perd la raison exacte au profit d'un silence.
const MARGE_DU_CANAL: Duration = Duration::from_secs(5);

/// Parle à un serveur MCP distant, en « Streamable HTTP ».
///
/// C'est le transport de la grande majorité du catalogue : 109 connecteurs sur
/// 137 l'annoncent, contre 9 en processus local. Sans lui, le client MCP de
/// l'application ne joint presque rien de ce que la boutique propose.
///
/// Le travail se fait sur un fil dédié qui porte sa propre boucle d'exécution,
/// pour la même raison que les tuyaux d'un processus : l'application ne doit
/// jamais attendre un serveur. Un appel réseau posé au milieu de l'interface la
/// figerait le temps que le serveur réponde, ou ne réponde pas.
///
/// Ce qui n'est PAS fait ici, et qu'il faudra : l'authentification OAuth du
/// protocole. Le jeton porteur vient du trousseau, rangé à la main par le
/// client. Un serveur qui exige le parcours d'autorisation complet ne se
/// connectera pas encore.
pub struct HttpTransport {
    /// Fermer cet envoi termine le fil. `None` veut dire « lien coupé ».
    requetes: Option<std::sync::mpsc::Sender<String>>,
    retours: std::sync::mpsc::Receiver<Result<Vec<String>, String>>,
    /// Une réponse peut porter plusieurs messages ; le client les lit un à un.
    attente: std::collections::VecDeque<String>,
}

/// Défait un corps de réponse en messages JSON-RPC.
///
/// Un serveur a le droit de répondre à plusieurs messages d'un coup, dans un
/// tableau. On défait le lot ici : laissé entier, il passerait pour une réponse
/// unique que le client ne reconnaîtrait pas, et il attendrait la sienne
/// indéfiniment.
fn messages_du_corps(corps: &str) -> Vec<String> {
    match serde_json::from_str::<serde_json::Value>(corps) {
        Ok(serde_json::Value::Array(lot)) => lot.iter().map(|m| m.to_string()).collect(),
        // Illisible : on le transmet tel quel, c'est le client qui dira pourquoi.
        _ => vec![corps.to_string()],
    }
}

/// Extrait les messages d'un flux d'événements.
///
/// Seules les lignes `data:` portent du JSON-RPC ; `event:`, `id:`, `retry:` et
/// les commentaires sont le cadre du flux et ne nous concernent pas. Un
/// événement peut tenir sur plusieurs lignes `data:`, qui se recollent avec un
/// saut de ligne, et une ligne vide le termine.
fn messages_du_flux(corps: &str) -> Vec<String> {
    let mut messages = Vec::new();
    let mut courant = String::new();
    for ligne in corps.lines() {
        if let Some(reste) = ligne.strip_prefix("data:") {
            if !courant.is_empty() {
                courant.push('\n');
            }
            courant.push_str(reste.strip_prefix(' ').unwrap_or(reste));
        } else if ligne.is_empty() && !courant.is_empty() {
            messages.extend(messages_du_corps(&std::mem::take(&mut courant)));
        }
    }
    if !courant.is_empty() {
        messages.extend(messages_du_corps(&courant));
    }
    messages
}

/// Le nom d'hôte seul, pour le dire au client sans recopier l'adresse entière.
fn hote(url: &str) -> String {
    url.split("://")
        .nth(1)
        .and_then(|r| r.split('/').next())
        .unwrap_or(url)
        .to_string()
}

impl HttpTransport {
    /// Ouvre le lien. `jeton` est la valeur lue au trousseau par l'appelant :
    /// ce module ne va pas la chercher, ne la journalise pas, et ne la remet
    /// jamais dans un message d'erreur.
    pub fn ouvrir(
        serveur: &ServeurDeclare,
        jeton: Option<String>,
        delai: Duration,
    ) -> Result<Self, String> {
        declaration_recevable(serveur)?;
        let adresse = serveur
            .url
            .clone()
            .ok_or_else(|| format!("{} : aucune adresse à joindre", serveur.nom))?;

        let (envoi_requetes, requetes) = std::sync::mpsc::channel::<String>();
        let (envoi_retours, retours) = std::sync::mpsc::channel::<Result<Vec<String>, String>>();

        std::thread::spawn(move || {
            Self::servir(adresse, jeton, delai, requetes, envoi_retours);
        });

        Ok(HttpTransport {
            requetes: Some(envoi_requetes),
            retours,
            attente: std::collections::VecDeque::new(),
        })
    }

    /// La boucle du fil : une requête entre, un aller-retour HTTP, des messages
    /// ressortent. Elle s'arrête quand le client ferme son envoi.
    fn servir(
        adresse: String,
        jeton: Option<String>,
        delai: Duration,
        requetes: std::sync::mpsc::Receiver<String>,
        retours: std::sync::mpsc::Sender<Result<Vec<String>, String>>,
    ) {
        let execution = match tokio::runtime::Builder::new_current_thread().enable_all().build() {
            Ok(e) => e,
            Err(_) => {
                let _ = retours.send(Err("le réseau n'est pas disponible sur ce poste".to_string()));
                return;
            }
        };
        let client = match reqwest::Client::builder().timeout(delai).build() {
            Ok(c) => c,
            Err(_) => {
                let _ = retours.send(Err("le réseau n'est pas disponible sur ce poste".to_string()));
                return;
            }
        };

        let mut session: Option<String> = None;

        while let Ok(ligne) = requetes.recv() {
            // Une notification n'a pas d'identifiant, donc pas de réponse à
            // attendre. On ne renvoie rien au client pour elle : un message posé
            // dans le canal serait pris pour la réponse de l'appel suivant.
            // Sauf si elle échoue — là il faut bien que quelqu'un l'apprenne.
            let attend_reponse = serde_json::from_str::<serde_json::Value>(&ligne)
                .map(|v| v.get("id").is_some())
                .unwrap_or(true);

            let resultat = execution.block_on(Self::aller_retour(
                &client, &adresse, &jeton, &session, delai, ligne,
            ));

            match resultat {
                Ok((nouvelle_session, messages)) => {
                    if session.is_none() {
                        session = nouvelle_session;
                    }
                    if attend_reponse && retours.send(Ok(messages)).is_err() {
                        break;
                    }
                }
                Err(motif) => {
                    if retours.send(Err(motif)).is_err() {
                        break;
                    }
                }
            }
        }

        // Le client est parti. On prévient le serveur que la session peut être
        // oubliée, sans quoi elle reste ouverte chez lui jusqu'à son propre
        // délai. C'est une politesse : son échec ne regarde personne, et on ne
        // l'attend que deux secondes.
        if let Some(s) = session {
            let _ = execution.block_on(async {
                tokio::time::timeout(
                    Duration::from_secs(2),
                    client
                        .delete(&adresse)
                        .header("Mcp-Session-Id", s)
                        .header("MCP-Protocol-Version", VERSION_PROTOCOLE)
                        .send(),
                )
                .await
            });
        }
    }

    /// Un aller-retour HTTP. Rend l'identifiant de session que le serveur vient
    /// d'attribuer, s'il en attribue un, et les messages qu'il a renvoyés.
    async fn aller_retour(
        client: &reqwest::Client,
        adresse: &str,
        jeton: &Option<String>,
        session: &Option<String>,
        delai: Duration,
        ligne: String,
    ) -> Result<(Option<String>, Vec<String>), String> {
        let mut demande = client
            .post(adresse)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            // Les deux types doivent figurer, et dans un seul en-tête : un
            // serveur qui n'en voit qu'un répond 406 et rien ne se connecte. Sur
            // les clients MCP c'est le travers le plus souvent rapporté.
            .header(
                reqwest::header::ACCEPT,
                "application/json, text/event-stream",
            )
            .header("MCP-Protocol-Version", VERSION_PROTOCOLE);
        if let Some(s) = session {
            demande = demande.header("Mcp-Session-Id", s.as_str());
        }
        if let Some(j) = jeton {
            demande = demande.bearer_auth(j);
        }

        let reponse = demande.body(ligne).send().await.map_err(|e| {
            // On dit la nature de la panne, pas le message de la bibliothèque :
            // il recopie l'adresse entière, et une adresse peut porter ce qu'on
            // ne veut voir ni dans un journal ni à l'écran.
            if e.is_timeout() {
                format!("délai de {} s dépassé", delai.as_secs())
            } else if e.is_connect() {
                format!("{} n'a pas répondu à la connexion", hote(adresse))
            } else {
                format!("l'échange avec {} a échoué", hote(adresse))
            }
        })?;

        let statut = reponse.status();
        let nouvelle_session = reponse
            .headers()
            .get("mcp-session-id")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);

        if !statut.is_success() {
            return Err(match statut.as_u16() {
                401 | 403 => format!(
                    "{} a refusé l'accès. Le jeton rangé au trousseau est absent, périmé, ou ne porte pas les droits demandés.",
                    hote(adresse)
                ),
                // Le 404 sur une session ouverte veut dire que le serveur l'a
                // oubliée : ce n'est pas une adresse fausse, c'est une session
                // expirée, et la relance repart d'une poignée de main.
                404 if session.is_some() => {
                    format!("la session avec {} a expiré, il faut se reconnecter", hote(adresse))
                }
                404 => format!("{} ne propose rien à cette adresse", hote(adresse)),
                _ => format!("{} a répondu {}", hote(adresse), statut.as_u16()),
            });
        }

        let type_contenu = reponse
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_lowercase();

        let corps = reponse
            .text()
            .await
            .map_err(|_| format!("la réponse de {} s'est interrompue", hote(adresse)))?;

        let messages = if type_contenu.contains("text/event-stream") {
            messages_du_flux(&corps)
        } else if corps.trim().is_empty() {
            // 202 : le serveur a pris la notification et n'a rien à dire.
            Vec::new()
        } else {
            messages_du_corps(&corps)
        };

        Ok((nouvelle_session, messages))
    }
}

impl Transport for HttpTransport {
    fn envoyer(&mut self, ligne: &str) -> Result<(), String> {
        let requetes = self
            .requetes
            .as_ref()
            .ok_or("le lien avec le serveur est coupé")?;
        requetes
            .send(ligne.to_string())
            .map_err(|_| "le lien avec le serveur est coupé".to_string())
    }

    fn lire(&mut self, delai: Duration) -> Result<String, String> {
        if let Some(message) = self.attente.pop_front() {
            return Ok(message);
        }
        match self.retours.recv_timeout(delai + MARGE_DU_CANAL) {
            Ok(Ok(messages)) => {
                self.attente.extend(messages);
                self.attente
                    .pop_front()
                    .ok_or_else(|| "le serveur n'a rien répondu".to_string())
            }
            Ok(Err(motif)) => Err(motif),
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                Err(format!("délai de {} s dépassé", delai.as_secs()))
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                Err("le serveur s'est arrêté".to_string())
            }
        }
    }

    fn couper(&mut self) {
        // Fermer l'envoi suffit : le fil sort de sa boucle, dit au serveur que la
        // session est finie, et s'arrête. On ne l'attend pas — « arrêt immédiat »
        // veut dire immédiat, et ce dernier message n'intéresse que le serveur.
        self.requetes = None;
        self.attente.clear();
    }
}

/// Choisit le transport d'après la déclaration : une commande se lance, une
/// adresse se joint. C'est le seul endroit du code où ce choix se fait.
pub fn ouvrir_transport(
    serveur: &ServeurDeclare,
    secrets: &[(String, String)],
    delai: Duration,
) -> Result<Box<dyn Transport>, String> {
    if serveur.est_distant() {
        let jeton = serveur.jeton.as_ref().and_then(|nom| {
            secrets
                .iter()
                .find(|(n, _)| n == nom)
                .map(|(_, valeur)| valeur.clone())
        });
        Ok(Box::new(HttpTransport::ouvrir(serveur, jeton, delai)?))
    } else {
        Ok(Box::new(ProcessusTransport::lancer(serveur, secrets)?))
    }
}

// ---------------------------------------------------------------------------
// Ce que l'application expose
// ---------------------------------------------------------------------------

/// Un serveur déclaré, tel qu'il se montre à l'écran : la commande et le rôle,
/// jamais un secret.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServeurVisible {
    pub nom: String,
    /// La commande lancée sur le poste, vide pour un serveur distant.
    pub commande: String,
    /// L'adresse jointe par le réseau, absente pour un serveur local.
    pub adresse: Option<String>,
    /// `local` ou `distant` : ce que l'écran dit au client, en un mot.
    pub voie: String,
    pub role: String,
    pub connecteur: Option<String>,
    /// Les noms des variables attendues. Leur valeur reste au trousseau.
    pub secrets_attendus: Vec<String>,
    /// `true` quand chaque variable attendue est effectivement au trousseau.
    pub pret: bool,
}

const SERVICE_TROUSSEAU: &str = "iagent-mcp";

fn trousseau(nom_de_variable: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, nom_de_variable)
        .map_err(|e| format!("coffre du système indisponible : {}", e))
}

/// Lit les valeurs des secrets d'un serveur. Un secret absent n'est pas une
/// erreur ici : c'est `pret` qui le dit, et le lancement échouera de lui-même
/// avec le message du serveur plutôt qu'avec le nôtre.
fn secrets_du_trousseau(serveur: &ServeurDeclare) -> Vec<(String, String)> {
    serveur
        .variables_attendues()
        .into_iter()
        .filter_map(|nom| {
            trousseau(&nom)
                .ok()
                .and_then(|e| e.get_password().ok())
                .map(|valeur| (nom, valeur))
        })
        .collect()
}

fn fichier_des_serveurs() -> std::path::PathBuf {
    crate::fiches::dossier_ressources().join("connecteurs/serveurs-mcp.json")
}

#[derive(Deserialize)]
struct FichierServeurs {
    serveurs: Vec<ServeurComplet>,
}

#[derive(Deserialize)]
struct ServeurComplet {
    #[serde(flatten)]
    declare: ServeurDeclare,
    #[serde(default)]
    role: String,
}

fn lire_serveurs() -> Result<Vec<ServeurComplet>, String> {
    let chemin = fichier_des_serveurs();
    let brut = std::fs::read_to_string(&chemin).map_err(|e| {
        format!(
            "lecture de {} : {} — la liste des serveurs n'a pas été installée avec l'application",
            chemin.display(),
            e
        )
    })?;
    let fichier: FichierServeurs =
        serde_json::from_str(&brut).map_err(|e| format!("liste des serveurs illisible : {}", e))?;
    // Un fichier qui porterait une clé en clair ne se charge pas du tout : mieux
    // vaut une application qui refuse de démarrer qu'un secret qui circule.
    for s in &fichier.serveurs {
        declaration_recevable(&s.declare)?;
    }
    Ok(fichier.serveurs)
}

/// Les serveurs que l'application sait lancer, et s'ils sont prêts.
#[tauri::command]
pub fn mcp_serveurs() -> Result<Vec<ServeurVisible>, String> {
    Ok(lire_serveurs()?
        .into_iter()
        .map(|s| {
            let attendues = s.declare.variables_attendues();
            let presents = secrets_du_trousseau(&s.declare).len();
            ServeurVisible {
                pret: presents == attendues.len(),
                voie: if s.declare.est_distant() { "distant" } else { "local" }.to_string(),
                nom: s.declare.nom,
                commande: s.declare.commande,
                adresse: s.declare.url,
                role: s.role,
                connecteur: s.declare.connecteur,
                secrets_attendus: attendues,
            }
        })
        .collect())
}

/// Range au trousseau la valeur d'un secret attendu par un serveur déclaré.
///
/// Le nom est vérifié contre la liste des serveurs : sans cela, l'interface
/// pourrait écrire n'importe quelle entrée dans le trousseau du système.
#[tauri::command]
pub fn mcp_ranger_secret(nom_de_variable: String, valeur: String) -> Result<String, String> {
    if valeur.is_empty() {
        return Err("valeur vide".to_string());
    }
    let attendu = lire_serveurs()?
        .iter()
        .any(|s| s.declare.variables_attendues().contains(&nom_de_variable));
    if !attendu {
        return Err(format!(
            "aucun serveur déclaré n'attend « {} »",
            nom_de_variable
        ));
    }
    trousseau(&nom_de_variable)?
        .set_password(&valeur)
        .map_err(|e| format!("enregistrement dans le coffre : {}", e))?;
    Ok(format!("{} est rangé dans le coffre du système", nom_de_variable))
}

/// Ce qu'un agent peut réellement faire sur un serveur : on le lance, on lui
/// demande ses outils, et on croise avec ce que la fiche de l'agent lui confie.
///
/// Le serveur est arrêté avant de rendre la main : cette commande sert à montrer
/// une liste, pas à laisser un processus ouvert derrière elle.
#[tauri::command]
pub fn mcp_outils_permis(
    serveur: String,
    outils_autorises: Vec<String>,
) -> Result<Vec<Outil>, String> {
    let serveurs = lire_serveurs()?;
    let trouve = serveurs
        .iter()
        .find(|s| s.declare.nom == serveur)
        .ok_or_else(|| format!("aucun serveur déclaré sous le nom « {} »", serveur))?;

    let transport = ouvrir_transport(
        &trouve.declare,
        &secrets_du_trousseau(&trouve.declare),
        DELAI_PAR_DEFAUT,
    )?;
    let autorisations = Autorisations { outils: outils_autorises, quota: 0 };
    let mut client = Client::nouveau(
        &serveur,
        transport,
        autorisations,
        Arc::new(AtomicBool::new(false)),
    );
    client.ouvrir().map_err(|r| r.en_clair())?;
    let permis: Vec<Outil> = client.outils_permis().into_iter().cloned().collect();
    client.arreter();
    Ok(permis)
}

// ---------------------------------------------------------------------------
// Ce qu'un agent a le droit d'appeler, dérivé de sa fiche
// ---------------------------------------------------------------------------

/// Combien d'appels d'outils une conversation peut faire.
///
/// C'est un coupe-circuit, pas un budget : il existe pour qu'un agent parti en
/// boucle s'arrête, pas pour rationner son travail. Le volume attendu d'un poste
/// se lit ailleurs, dans `execution.appelsParJourEstimes` de sa fiche, et ces
/// deux nombres ne veulent pas dire la même chose.
pub const APPELS_PAR_CONVERSATION: u32 = 25;

/// Les besoins que la fiche d'un agent déclare : huit mots, jamais un produit.
fn besoins_de_la_fiche(fiche_id: &str) -> Result<Vec<String>, String> {
    let brut = crate::fiches::lire_fiche(fiche_id.to_string())?;
    let fiche: serde_json::Value =
        serde_json::from_str(&brut).map_err(|e| format!("fiche {} illisible : {}", fiche_id, e))?;
    Ok(fiche
        .get("connecteurs")
        .and_then(serde_json::Value::as_array)
        .map(|v| {
            v.iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default())
}

/// Les connecteurs du catalogue qui servent au moins un de ces besoins.
///
/// C'est le champ dérivé `sert`, calculé à l'import par `outils/capacites.ts` :
/// la jointure se fait là-bas une fois pour toutes, pas ici à chaque appel.
fn connecteurs_servant(besoins: &[String]) -> Result<Vec<String>, String> {
    let brut = crate::fiches::lire_referentiel("connecteurs".to_string())?;
    let catalogue: serde_json::Value =
        serde_json::from_str(&brut).map_err(|e| format!("catalogue illisible : {}", e))?;
    let connecteurs = catalogue
        .get("connecteurs")
        .and_then(serde_json::Value::as_array)
        .ok_or("catalogue des connecteurs vide")?;

    Ok(connecteurs
        .iter()
        .filter(|c| {
            c.get("sert")
                .and_then(serde_json::Value::as_array)
                .map(|sert| {
                    sert.iter()
                        .filter_map(serde_json::Value::as_str)
                        .any(|capacite| besoins.iter().any(|b| b == capacite))
                })
                .unwrap_or(false)
        })
        .filter_map(|c| c.get("id").and_then(serde_json::Value::as_str))
        .map(str::to_string)
        .collect())
}

/// Ce qu'un agent a le droit d'appeler sur un serveur, dérivé de sa fiche.
///
/// La chaîne, de bout en bout : la fiche déclare un besoin (« fichiers »), le
/// catalogue dit quels connecteurs le servent, la déclaration dit quel serveur
/// met en œuvre quel connecteur, et ce serveur dit quels outils le dépôt a
/// retenus. **Rien ne vient de l'écran** : ce que l'écran demanderait, l'écran
/// pourrait le mentir, et la liste blanche ne serait plus une règle.
///
/// Un serveur sans connecteur n'est à la portée d'aucun agent. C'est voulu :
/// tant que personne n'a dit à quel besoin il répond, personne n'en a besoin.
fn autorisations_pour(
    serveur: &ServeurComplet,
    connecteurs_utiles: &[String],
) -> Result<Autorisations, String> {
    let Some(connecteur) = &serveur.declare.connecteur else {
        return Err(format!(
            "« {} » n'est rattaché à aucun besoin : aucun agent ne peut s'en servir tant que ce n'est pas écrit.",
            serveur.declare.nom
        ));
    };

    if !connecteurs_utiles.iter().any(|c| c == connecteur) {
        return Err(format!(
            "ce poste n'a pas déclaré avoir besoin de « {} » : il ne travaille pas là-dedans.",
            serveur.declare.nom
        ));
    }

    Ok(Autorisations {
        outils: serveur
            .declare
            .outils
            .iter()
            .map(|o| format!("{}/{}", serveur.declare.nom, o.nom))
            .collect(),
        quota: APPELS_PAR_CONVERSATION,
    })
}

/// Est-ce bien cet agent-là, et est-il seulement embauché ?
///
/// Sans ce contrôle, l'écran pourrait annoncer la fiche du catalogue qui déclare
/// le plus de besoins et ouvrir des serveurs que l'agent qui parle n'a pas. La
/// liste blanche se dérive de la fiche : encore faut-il que ce soit la sienne.
fn est_embauche(installation: &str, prenom: &str, fiche_id: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(installation)
        .ok()
        .and_then(|v| v.get("agents").and_then(serde_json::Value::as_array).cloned())
        .map(|agents| {
            agents.iter().any(|a| {
                a.get("prenom").and_then(serde_json::Value::as_str) == Some(prenom)
                    && a.get("ficheId").and_then(serde_json::Value::as_str) == Some(fiche_id)
            })
        })
        .unwrap_or(false)
}

/// Le journal des outils d'un agent, à côté de l'application.
fn chemin_du_journal(prenom: &str) -> Result<std::path::PathBuf, String> {
    Ok(crate::fiches::dossier_ressources()
        .join("config")
        .join(format!("outils-{}.json", crate::journal::nom_propre(prenom)?)))
}

/// Ajoute au journal ce que l'agent vient de faire des accès du client.
///
/// L'échec d'écriture n'annule pas l'appel : il a eu lieu, le nier serait pire.
/// Mais il se dit, parce qu'un journal qu'on croit tenu et qui ne l'est pas vaut
/// moins que pas de journal du tout.
fn inscrire_au_journal(prenom: &str, appels: &[Appel]) -> Result<(), String> {
    let chemin = chemin_du_journal(prenom)?;
    if let Some(dossier) = chemin.parent() {
        std::fs::create_dir_all(dossier)
            .map_err(|e| format!("création de {} : {}", dossier.display(), e))?;
    }
    let mut tout: Vec<Appel> = std::fs::read_to_string(&chemin)
        .ok()
        .and_then(|brut| serde_json::from_str(&brut).ok())
        .unwrap_or_default();
    tout.extend_from_slice(appels);
    let contenu = serde_json::to_string_pretty(&tout)
        .map_err(|e| format!("écriture du journal : {}", e))?;
    std::fs::write(&chemin, contenu)
        .map_err(|e| format!("écriture de {} : {}", chemin.display(), e))
}

/// Ce que cet agent a fait des accès du client, appels refusés compris.
#[tauri::command]
pub fn mcp_journal(prenom: String) -> Result<Vec<Appel>, String> {
    let chemin = chemin_du_journal(&prenom)?;
    match std::fs::read_to_string(&chemin) {
        Ok(brut) => serde_json::from_str(&brut).map_err(|e| format!("journal illisible : {}", e)),
        // Pas de fichier veut dire pas encore d'appel, pas une panne.
        Err(_) => Ok(Vec::new()),
    }
}

/// Appelle un outil pour le compte d'un agent. C'est le seul chemin.
///
/// `valide` est le clic du client sur CET appel, et rien d'autre ne peut le
/// remplacer : ni une case cochée ailleurs, ni un réglage, ni le modèle. Un
/// outil que le serveur ne déclare pas en lecture seule — et que le dépôt
/// n'affirme pas telle — ne part pas sans lui.
///
/// Le serveur est lancé pour l'appel puis arrêté. C'est plus coûteux qu'une
/// session tenue ouverte, et c'est volontaire tant que personne n'a mesuré ce
/// que coûte l'autre : un processus oublié derrière l'application est un défaut
/// plus difficile à voir qu'une lenteur.
#[tauri::command]
pub fn mcp_appeler(
    fiche_id: String,
    prenom: String,
    serveur: String,
    outil: String,
    arguments: serde_json::Value,
    valide: bool,
) -> Result<serde_json::Value, String> {
    if !est_embauche(&crate::fiches::lire_installation()?, &prenom, &fiche_id) {
        return Err(format!(
            "{} ne fait pas partie de vos agents, ou ce n'est pas son poste.",
            prenom
        ));
    }

    let serveurs = lire_serveurs()?;
    let trouve = serveurs
        .iter()
        .find(|s| s.declare.nom == serveur)
        .ok_or_else(|| format!("aucun serveur déclaré sous le nom « {} »", serveur))?;

    let besoins = besoins_de_la_fiche(&fiche_id)?;
    let autorisations = autorisations_pour(trouve, &connecteurs_servant(&besoins)?)?;
    let affirmees: Vec<String> = trouve
        .declare
        .outils
        .iter()
        .filter(|o| o.lecture_seule == Some(true))
        .map(|o| o.nom.clone())
        .collect();

    let transport = ouvrir_transport(
        &trouve.declare,
        &secrets_du_trousseau(&trouve.declare),
        DELAI_PAR_DEFAUT,
    )?;
    let mut client = Client::nouveau(
        &serveur,
        transport,
        autorisations,
        Arc::new(AtomicBool::new(false)),
    )
    .avec_lectures_seules(affirmees);

    let ouverture = client.ouvrir();
    let resultat = match ouverture {
        Ok(()) => client.appeler(&prenom, &outil, arguments, valide),
        Err(refus) => Err(refus),
    };
    let appels: Vec<Appel> = client.journal().appels().to_vec();
    client.arreter();

    // Le journal s'écrit dans les deux cas : un refus est justement ce que le
    // client a le plus de raisons de vouloir relire.
    let tenue = inscrire_au_journal(&prenom, &appels);
    let resultat = resultat.map_err(|refus| refus.en_clair())?;
    tenue?;
    Ok(resultat)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    /// Un serveur MCP de banc : on lui donne d'avance ce qu'il répondra.
    struct TransportFactice {
        reponses: VecDeque<String>,
        envoyes: Vec<String>,
        coupe: bool,
        /// Quand c'est vrai, `lire` se comporte comme un serveur qui ne répond pas.
        muet: bool,
    }

    impl TransportFactice {
        fn avec(reponses: Vec<&str>) -> Self {
            TransportFactice {
                reponses: reponses.into_iter().map(String::from).collect(),
                envoyes: Vec::new(),
                coupe: false,
                muet: false,
            }
        }
    }

    impl Transport for TransportFactice {
        fn envoyer(&mut self, ligne: &str) -> Result<(), String> {
            if self.coupe {
                return Err("lien coupé".to_string());
            }
            self.envoyes.push(ligne.to_string());
            Ok(())
        }
        fn lire(&mut self, delai: Duration) -> Result<String, String> {
            if self.muet {
                return Err(format!("délai de {} s dépassé", delai.as_secs()));
            }
            self.reponses.pop_front().ok_or_else(|| "plus rien à lire".to_string())
        }
        fn couper(&mut self) {
            self.coupe = true;
        }
    }

    const INIT: &str = r#"{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{},"serverInfo":{"name":"banc","version":"1"}}}"#;
    const OUTILS: &str = r#"{"jsonrpc":"2.0","id":2,"result":{"tools":[
        {"name":"lire_fichier","description":"Lit un fichier","annotations":{"readOnlyHint":true}},
        {"name":"ecrire_fichier","description":"Écrit un fichier","annotations":{"readOnlyHint":false}},
        {"name":"sans_annotation","description":"Le serveur ne dit rien de lui"}
    ]}}"#;

    /// Ce qu'une déclaration de banc porte d'outils : un seul, suffisant pour
    /// qu'elle soit recevable quand ce n'est pas la liste qu'on éprouve.
    fn un_outil() -> Vec<OutilDeclare> {
        vec![OutilDeclare { nom: "essai".into(), ..Default::default() }]
    }

    fn client(outils: Vec<&str>, quota: u32, reponses: Vec<&str>) -> Client {
        let autorisations = Autorisations {
            outils: outils.into_iter().map(String::from).collect(),
            quota,
        };
        Client::nouveau(
            "fichiers",
            Box::new(TransportFactice::avec(reponses)),
            autorisations,
            Arc::new(AtomicBool::new(false)),
        )
    }

    #[test]
    fn la_poignee_de_main_retient_les_outils_et_leur_innocuite() {
        let mut c = client(vec![], 10, vec![INIT, OUTILS]);
        c.ouvrir().expect("ouverture");
        assert_eq!(c.outils().len(), 3);
        assert!(c.outils()[0].lecture_seule);
        assert!(!c.outils()[1].lecture_seule);
        // Le serveur qui ne dit rien est traité comme modifiant : on ne suppose
        // pas l'innocuité d'un outil dont personne n'a rien promis.
        assert!(!c.outils()[2].lecture_seule);
    }

    #[test]
    fn un_outil_hors_liste_est_refuse_meme_si_le_serveur_le_propose() {
        let mut c = client(vec!["fichiers/lire_fichier"], 10, vec![INIT, OUTILS]);
        c.ouvrir().expect("ouverture");
        let r = c.appeler("Marie", "ecrire_fichier", serde_json::json!({}), true);
        assert_eq!(
            r.unwrap_err(),
            Refus::HorsListe { serveur: "fichiers".into(), outil: "ecrire_fichier".into() }
        );
        assert_eq!(c.journal().refuses(), 1);
    }

    #[test]
    fn un_outil_autorise_mais_inconnu_du_serveur_est_refuse() {
        // La liste blanche dit ce qui est permis, pas ce qui existe.
        let mut c = client(vec!["fichiers/effacer_tout"], 10, vec![INIT, OUTILS]);
        c.ouvrir().expect("ouverture");
        let r = c.appeler("Marie", "effacer_tout", serde_json::json!({}), true);
        assert!(matches!(r.unwrap_err(), Refus::HorsListe { .. }));
    }

    #[test]
    fn un_outil_qui_modifie_ne_part_pas_sans_validation() {
        let reponse = r#"{"jsonrpc":"2.0","id":3,"result":{"content":[]}}"#;
        let mut c = client(vec!["fichiers/ecrire_fichier"], 10, vec![INIT, OUTILS, reponse]);
        c.ouvrir().expect("ouverture");

        let refuse = c.appeler("Marie", "ecrire_fichier", serde_json::json!({}), false);
        assert_eq!(
            refuse.unwrap_err(),
            Refus::ValidationManquante { outil: "ecrire_fichier".into() }
        );

        let accepte = c.appeler("Marie", "ecrire_fichier", serde_json::json!({}), true);
        assert!(accepte.is_ok());
    }

    #[test]
    fn un_outil_en_lecture_seule_part_sans_validation() {
        let reponse = r#"{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"bonjour"}]}}"#;
        let mut c = client(vec!["fichiers/lire_fichier"], 10, vec![INIT, OUTILS, reponse]);
        c.ouvrir().expect("ouverture");
        assert!(c.appeler("Marie", "lire_fichier", serde_json::json!({}), false).is_ok());
    }

    #[test]
    fn le_quota_arrete_un_agent_qui_boucle() {
        let ok = r#"{"jsonrpc":"2.0","id":3,"result":{"content":[]}}"#;
        let ok2 = r#"{"jsonrpc":"2.0","id":4,"result":{"content":[]}}"#;
        let mut c = client(vec!["fichiers/lire_fichier"], 2, vec![INIT, OUTILS, ok, ok2]);
        c.ouvrir().expect("ouverture");
        assert!(c.appeler("Marie", "lire_fichier", serde_json::json!({}), false).is_ok());
        assert!(c.appeler("Marie", "lire_fichier", serde_json::json!({}), false).is_ok());
        let troisieme = c.appeler("Marie", "lire_fichier", serde_json::json!({}), false);
        assert_eq!(troisieme.unwrap_err(), Refus::QuotaAtteint { quota: 2 });
    }

    #[test]
    fn un_quota_nul_ne_laisse_passer_aucun_appel() {
        let mut c = client(vec!["fichiers/lire_fichier"], 0, vec![INIT, OUTILS]);
        c.ouvrir().expect("ouverture");
        assert!(matches!(
            c.appeler("Marie", "lire_fichier", serde_json::json!({}), false).unwrap_err(),
            Refus::QuotaAtteint { .. }
        ));
    }

    #[test]
    fn l_arret_coupe_immediatement_et_refuse_la_suite() {
        let ok = r#"{"jsonrpc":"2.0","id":3,"result":{"content":[]}}"#;
        let mut c = client(vec!["fichiers/lire_fichier"], 10, vec![INIT, OUTILS, ok]);
        c.ouvrir().expect("ouverture");
        c.arreter();
        let r = c.appeler("Marie", "lire_fichier", serde_json::json!({}), false);
        assert_eq!(r.unwrap_err(), Refus::Arrete);
    }

    #[test]
    fn un_serveur_muet_rend_la_main_au_lieu_de_figer() {
        let autorisations = Autorisations {
            outils: vec!["fichiers/lire_fichier".into()],
            quota: 5,
        };
        let mut transport = TransportFactice::avec(vec![INIT, OUTILS]);
        transport.muet = false;
        let mut c = Client::nouveau(
            "fichiers",
            Box::new(transport),
            autorisations,
            Arc::new(AtomicBool::new(false)),
        )
        .avec_delai(Duration::from_secs(2));
        c.ouvrir().expect("ouverture");
        // Plus aucune réponse en réserve : le transport se comporte comme un
        // serveur qui a cessé de parler.
        let r = c.appeler("Marie", "lire_fichier", serde_json::json!({}), false);
        assert!(matches!(r.unwrap_err(), Refus::Injoignable { .. }));
    }

    #[test]
    fn une_notification_du_serveur_ne_passe_pas_pour_une_reponse() {
        // Un serveur bavard intercale ses propres messages. Prendre la première
        // ligne venue pour sa réponse ferait lire un résultat qui n'en est pas un.
        let bruit = r#"{"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info"}}"#;
        let vraie = r#"{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"ok"}]}}"#;
        let mut c = client(vec!["fichiers/lire_fichier"], 5, vec![INIT, OUTILS, bruit, vraie]);
        c.ouvrir().expect("ouverture");
        let r = c.appeler("Marie", "lire_fichier", serde_json::json!({}), false).expect("appel");
        assert_eq!(r["content"][0]["text"], "ok");
    }

    #[test]
    fn une_erreur_du_serveur_est_rendue_en_clair() {
        let erreur = r#"{"jsonrpc":"2.0","id":3,"error":{"code":-32602,"message":"chemin hors du dossier autorisé"}}"#;
        let mut c = client(vec!["fichiers/lire_fichier"], 5, vec![INIT, OUTILS, erreur]);
        c.ouvrir().expect("ouverture");
        let r = c.appeler("Marie", "lire_fichier", serde_json::json!({}), false);
        assert_eq!(
            r.unwrap_err(),
            Refus::Injoignable { detail: "chemin hors du dossier autorisé".into() }
        );
    }

    #[test]
    fn tout_appel_laisse_une_trace_abouti_ou_non() {
        let ok = r#"{"jsonrpc":"2.0","id":3,"result":{"content":[]}}"#;
        let mut c = client(vec!["fichiers/lire_fichier"], 5, vec![INIT, OUTILS, ok]);
        c.ouvrir().expect("ouverture");
        c.appeler("Marie", "lire_fichier", serde_json::json!({}), false).expect("appel");
        c.appeler("Marie", "ecrire_fichier", serde_json::json!({}), true).ok();
        assert_eq!(c.journal().appels().len(), 2);
        assert!(c.journal().appels()[0].abouti);
        assert!(!c.journal().appels()[1].abouti);
        assert_eq!(c.journal().appels()[0].agent, "Marie");
        // Le motif est une phrase pour le client, pas un code.
        assert!(c.journal().appels()[1].motif.contains("ne fait pas partie"));
    }

    #[test]
    fn les_outils_permis_sont_l_intersection_des_deux_listes() {
        let mut c = client(
            vec!["fichiers/lire_fichier", "fichiers/outil_absent", "autre/lire_fichier"],
            5,
            vec![INIT, OUTILS],
        );
        c.ouvrir().expect("ouverture");
        let permis: Vec<&str> = c.outils_permis().iter().map(|o| o.nom.as_str()).collect();
        assert_eq!(permis, vec!["lire_fichier"]);
    }

    /// Le fichier du dépôt se charge vraiment, et aucune de ses lignes ne porte de
    /// clé. On le lit par son chemin plutôt que par `dossier_ressources()` pour ne
    /// pas toucher à une variable d'environnement que d'autres tests règlent aussi.
    #[test]
    fn les_serveurs_declares_du_depot_se_chargent_et_ne_portent_aucune_cle() {
        let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../../connecteurs/serveurs-mcp.json");
        let brut = std::fs::read_to_string(chemin).expect("serveurs-mcp.json introuvable");
        let fichier: FichierServeurs =
            serde_json::from_str(&brut).expect("serveurs-mcp.json mal formé");
        assert!(!fichier.serveurs.is_empty(), "aucun serveur déclaré");
        for s in &fichier.serveurs {
            declaration_recevable(&s.declare)
                .unwrap_or_else(|e| panic!("{} refusé : {}", s.declare.nom, e));
            assert!(!s.role.trim().is_empty(), "{} : aucun rôle écrit", s.declare.nom);
        }
    }

    /// Le chemin que le code construit doit être celui que l'installeur pose.
    /// Les deux vivent dans deux fichiers différents ; rien ne les tient ensemble
    /// sinon ce test, et une divergence ne se verrait qu'à l'exécution chez le client.
    #[test]
    fn l_installeur_pose_les_serveurs_la_ou_le_code_les_cherche() {
        let conf = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tauri.conf.json"))
            .expect("tauri.conf.json introuvable");
        let conf: serde_json::Value = serde_json::from_str(&conf).expect("tauri.conf.json mal formé");
        let pose = conf["bundle"]["resources"]["../../connecteurs/serveurs-mcp.json"]
            .as_str()
            .expect("serveurs-mcp.json n'est pas embarqué par l'installeur");
        // `fichier_des_serveurs()` joint exactement ce chemin au dossier d'installation.
        assert_eq!(pose, "connecteurs/serveurs-mcp.json");
    }

    #[test]
    fn un_fichier_de_serveurs_qui_porte_une_cle_ne_se_charge_pas() {
        // Le piège est facile : on colle la clé pour essayer, elle part au dépôt.
        let truque = r#"{"serveurs":[{"nom":"essai","commande":"npx","arguments":[],
            "secrets":["ghp_uneVraieCleDeTest"],"role":"essai",
            "outils":[{"nom":"essai"}]}]}"#;
        let fichier: FichierServeurs = serde_json::from_str(truque).expect("JSON de banc");
        let erreur = declaration_recevable(&fichier.serveurs[0].declare).unwrap_err();
        assert!(erreur.contains("trousseau"), "message peu parlant : {}", erreur);
    }

    #[test]
    fn une_declaration_qui_porte_une_cle_est_refusee() {
        let avec_cle = ServeurDeclare {
            nom: "essai".into(),
            commande: "npx".into(),
            secrets: vec!["sk-ant-api03-quelque-chose".into()],
            outils: un_outil(),
            ..Default::default()
        };
        let erreur = declaration_recevable(&avec_cle).unwrap_err();
        assert!(erreur.contains("trousseau"));

        let propre = ServeurDeclare {
            secrets: vec!["GITHUB_TOKEN".into()],
            ..avec_cle
        };
        assert!(declaration_recevable(&propre).is_ok());
    }

    #[test]
    fn une_declaration_sans_commande_est_refusee() {
        let vide = ServeurDeclare {
            nom: "essai".into(),
            commande: "  ".into(),
            outils: un_outil(),
            ..Default::default()
        };
        assert!(declaration_recevable(&vide).is_err());
    }

    /// Le jeton d'un serveur distant suit la même règle que les autres secrets :
    /// un NOM de variable, jamais la valeur. Le chemin est différent (`jeton` et
    /// non `secrets`), la règle est la même, et c'est ce test qui le tient.
    #[test]
    fn un_jeton_ecrit_en_clair_est_refuse_comme_un_secret() {
        let avec_jeton = ServeurDeclare {
            nom: "notion".into(),
            url: Some("https://exemple.test/mcp".into()),
            jeton: Some("ntn_1234567890abcdef".into()),
            outils: un_outil(),
            ..Default::default()
        };
        let erreur = declaration_recevable(&avec_jeton).unwrap_err();
        assert!(erreur.contains("trousseau"), "message peu parlant : {}", erreur);

        let propre = ServeurDeclare {
            jeton: Some("NOTION_TOKEN".into()),
            ..avec_jeton
        };
        assert!(declaration_recevable(&propre).is_ok());
        // Le jeton compte parmi les variables attendues : sans ça, l'écran
        // annoncerait « prêt » à un serveur auquel il manque de quoi entrer.
        assert_eq!(propre.variables_attendues(), vec!["NOTION_TOKEN".to_string()]);
    }

    /// Un jeton porteur part avec chaque appel : l'adresse qui le transporte doit
    /// être chiffrée, et ne doit rien porter elle-même.
    #[test]
    fn une_adresse_qui_laisserait_fuir_le_jeton_est_refusee() {
        let avec = |url: &str| ServeurDeclare {
            nom: "essai".into(),
            url: Some(url.into()),
            outils: un_outil(),
            ..Default::default()
        };

        for mauvaise in [
            "http://mcp.exemple.test/mcp",              // en clair sur le réseau
            "ftp://exemple.test/mcp",                   // pas une adresse web
            "https://exemple.test/mcp?cle=secrete",     // un secret dans le dépôt
            "https://jeton@exemple.test/mcp",           // un identifiant dans le dépôt
        ] {
            let erreur = declaration_recevable(&avec(mauvaise)).unwrap_err();
            assert!(!erreur.is_empty(), "adresse acceptée à tort : {}", mauvaise);
        }

        assert!(declaration_recevable(&avec("https://mcp.exemple.test/mcp")).is_ok());
        // La boucle locale ne sort pas de la machine : c'est la seule exception,
        // et c'est elle qui rend le banc ci-dessous possible.
        assert!(declaration_recevable(&avec("http://127.0.0.1:8931/mcp")).is_ok());
        assert!(declaration_recevable(&avec("http://localhost:8931/mcp")).is_ok());
    }

    /// Ou bien on lance le serveur, ou bien on le joint. Les deux à la fois
    /// laisseraient le choix du transport à l'ordre des conditions.
    #[test]
    fn une_declaration_qui_veut_les_deux_transports_est_refusee() {
        let deux = ServeurDeclare {
            nom: "essai".into(),
            commande: "npx".into(),
            url: Some("https://exemple.test/mcp".into()),
            outils: un_outil(),
            ..Default::default()
        };
        assert!(declaration_recevable(&deux).is_err());
    }

    /// Le tuyau, pour de vrai.
    ///
    /// Tout ce qui précède éprouve la logique sur un transport de banc. Ce test-ci
    /// lance un vrai processus, lui écrit une requête sur son entrée standard et
    /// lit sa réponse sur sa sortie : c'est le seul endroit où l'on vérifie que la
    /// trame (une ligne, un saut de ligne, un vidage) est la bonne.
    ///
    /// Unix seulement, faute d'un interpréteur présent partout. Le chemin n'a donc
    /// **pas encore été constaté sous Windows**, qui est la cible du produit.
    #[cfg(unix)]
    #[test]
    fn un_vrai_processus_repond_par_ses_tuyaux() {
        // Quatre lectures pour trois réponses : la poignée de main comporte une
        // notification, `notifications/initialized`, qui est une ligne de plus
        // envoyée au serveur et dont il n'a rien à répondre. L'oublier laissait le
        // script se terminer avant le dernier appel, et le test échouait une fois
        // sur deux sur un tuyau déjà fermé.
        let script = concat!(
            "read requete\n",                                   // initialize
            r#"echo '{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18"}}'"#,
            "\n",
            "read requete\n",                                   // notifications/initialized
            "read requete\n",                                   // tools/list
            r#"echo '{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"dire_bonjour","description":"d","annotations":{"readOnlyHint":true}}]}}'"#,
            "\n",
            "read requete\n",                                   // tools/call
            r#"echo '{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"bonjour"}]}}'"#,
            "\n",
        );
        let serveur = ServeurDeclare {
            nom: "banc".into(),
            commande: "sh".into(),
            arguments: vec!["-c".into(), script.to_string()],
            outils: un_outil(),
            ..Default::default()
        };
        let transport = ProcessusTransport::lancer(&serveur, &[]).expect("lancement");
        let autorisations = Autorisations {
            outils: vec!["banc/dire_bonjour".into()],
            quota: 5,
        };
        let mut c = Client::nouveau(
            "banc",
            Box::new(transport),
            autorisations,
            Arc::new(AtomicBool::new(false)),
        )
        .avec_delai(Duration::from_secs(10));

        c.ouvrir().expect("poignée de main sur un vrai processus");
        assert_eq!(c.outils().len(), 1);
        let r = c
            .appeler("Marie", "dire_bonjour", serde_json::json!({}), false)
            .expect("appel");
        assert_eq!(r["content"][0]["text"], "bonjour");
    }

    /// Un serveur qui se tait ne fige pas l'application : elle rend la main.
    #[cfg(unix)]
    #[test]
    fn un_vrai_processus_muet_rend_la_main_au_delai() {
        let serveur = ServeurDeclare {
            nom: "muet".into(),
            commande: "sh".into(),
            arguments: vec!["-c".into(), "sleep 30".into()],
            outils: un_outil(),
            ..Default::default()
        };
        let transport = ProcessusTransport::lancer(&serveur, &[]).expect("lancement");
        let mut c = Client::nouveau(
            "muet",
            Box::new(transport),
            Autorisations::default(),
            Arc::new(AtomicBool::new(false)),
        )
        .avec_delai(Duration::from_secs(1));
        let debut = std::time::Instant::now();
        let r = c.ouvrir();
        assert!(matches!(r.unwrap_err(), Refus::DelaiDepasse { .. }));
        // Le délai est tenu, pas subi : on n'a pas attendu les 30 secondes du dormeur.
        assert!(debut.elapsed() < Duration::from_secs(5));
    }

    /// Une commande qui n'existe pas se dit tout de suite, pas au premier appel.
    #[test]
    fn une_commande_introuvable_echoue_au_lancement() {
        let serveur = ServeurDeclare {
            nom: "fantome".into(),
            commande: "iagent-commande-qui-n-existe-pas".into(),
            outils: un_outil(),
            ..Default::default()
        };
        assert!(ProcessusTransport::lancer(&serveur, &[]).is_err());
    }

    // -----------------------------------------------------------------------
    // Le transport distant, pour de vrai
    // -----------------------------------------------------------------------

    /// Une requête telle que le serveur de banc l'a reçue.
    struct RequeteRecue {
        methode: String,
        entetes: Vec<(String, String)>,
        corps: String,
    }

    impl RequeteRecue {
        fn entete(&self, nom: &str) -> Option<&str> {
            self.entetes
                .iter()
                .find(|(n, _)| n == nom)
                .map(|(_, v)| v.as_str())
        }
    }

    /// Un serveur HTTP de banc, minuscule : il lit une requête, la note, et rend
    /// la réponse suivante de la pile.
    ///
    /// Écrit à la main plutôt qu'avec une bibliothèque, pour que le banc ne
    /// dépende de rien de plus que ce qui est déjà dans le dépôt — et pour qu'il
    /// tourne sous Windows, ce que le banc du processus local ne fait pas.
    fn serveur_de_banc(reponses: Vec<String>) -> (String, std::sync::Arc<std::sync::Mutex<Vec<RequeteRecue>>>) {
        let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute locale");
        let port = ecoute.local_addr().expect("adresse").port();
        let recues = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let journal = recues.clone();

        std::thread::spawn(move || {
            let mut restantes = reponses.into_iter();
            for flux in ecoute.incoming() {
                let Ok(mut flux) = flux else { break };
                let Some(requete) = lire_requete(&mut flux) else { continue };
                // Le DELETE de fin de session ne consomme pas de réponse : il
                // arrive après tout le reste et on ne veut pas qu'il décale la pile.
                let fin = requete.methode == "DELETE";
                journal.lock().expect("journal").push(requete);
                let reponse = if fin {
                    "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string()
                } else {
                    restantes.next().unwrap_or_else(|| {
                        "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string()
                    })
                };
                use std::io::Write;
                let _ = flux.write_all(reponse.as_bytes());
                let _ = flux.flush();
                if fin {
                    break;
                }
            }
        });

        (format!("http://127.0.0.1:{}/mcp", port), recues)
    }

    fn lire_requete(flux: &mut std::net::TcpStream) -> Option<RequeteRecue> {
        use std::io::{BufRead, BufReader, Read};
        let mut lecteur = BufReader::new(flux.try_clone().ok()?);
        let mut premiere = String::new();
        lecteur.read_line(&mut premiere).ok()?;
        if premiere.trim().is_empty() {
            return None;
        }
        let methode = premiere.split_whitespace().next()?.to_string();

        let mut entetes = Vec::new();
        let mut taille = 0usize;
        loop {
            let mut ligne = String::new();
            if lecteur.read_line(&mut ligne).ok()? == 0 || ligne.trim().is_empty() {
                break;
            }
            if let Some((nom, valeur)) = ligne.split_once(':') {
                let nom = nom.trim().to_lowercase();
                let valeur = valeur.trim().to_string();
                if nom == "content-length" {
                    taille = valeur.parse().unwrap_or(0);
                }
                entetes.push((nom, valeur));
            }
        }

        let mut corps = vec![0u8; taille];
        if taille > 0 {
            lecteur.read_exact(&mut corps).ok()?;
        }
        Some(RequeteRecue {
            methode,
            entetes,
            corps: String::from_utf8_lossy(&corps).to_string(),
        })
    }

    fn reponse_json(corps: &str, session: Option<&str>) -> String {
        let mut entetes = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n",
            corps.len()
        );
        if let Some(s) = session {
            entetes.push_str(&format!("Mcp-Session-Id: {}\r\n", s));
        }
        format!("{}\r\n{}", entetes, corps)
    }

    /// Le 202 d'une notification : le serveur a pris, il n'a rien à dire.
    fn reponse_acceptee() -> String {
        "HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string()
    }

    fn reponse_flux(evenements: &[&str]) -> String {
        let corps: String = evenements
            .iter()
            .map(|e| format!("event: message\ndata: {}\n\n", e))
            .collect();
        format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            corps.len(),
            corps
        )
    }

    fn client_distant(url: &str, outils: Vec<&str>, quota: u32, delai: Duration) -> Client {
        let serveur = ServeurDeclare {
            nom: "distant".into(),
            url: Some(url.to_string()),
            jeton: Some("BANC_JETON".into()),
            outils: un_outil(),
            ..Default::default()
        };
        let transport = HttpTransport::ouvrir(
            &serveur,
            Some("jeton-de-banc".to_string()),
            delai,
        )
        .expect("ouverture du lien");
        Client::nouveau(
            "distant",
            Box::new(transport),
            Autorisations {
                outils: outils.into_iter().map(String::from).collect(),
                quota,
            },
            Arc::new(AtomicBool::new(false)),
        )
        .avec_delai(delai)
    }

    /// L'aller-retour complet contre un vrai serveur HTTP : poignée de main,
    /// notification, liste des outils, appel. C'est le pendant du banc des
    /// tuyaux, pour les 109 connecteurs du catalogue qui sont distants.
    #[test]
    fn un_vrai_serveur_http_repond_et_la_session_le_suit() {
        let (url, recues) = serveur_de_banc(vec![
            reponse_json(
                r#"{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18"}}"#,
                Some("session-de-banc"),
            ),
            reponse_acceptee(),
            reponse_json(
                r#"{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"lire_note","description":"d","annotations":{"readOnlyHint":true}}]}}"#,
                None,
            ),
            reponse_json(
                r#"{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"bonjour"}]}}"#,
                None,
            ),
        ]);

        let mut c = client_distant(&url, vec!["distant/lire_note"], 5, Duration::from_secs(10));
        c.ouvrir().expect("poignée de main sur un vrai serveur");
        assert_eq!(c.outils().len(), 1);
        let r = c
            .appeler("Marie", "lire_note", serde_json::json!({}), false)
            .expect("appel");
        assert_eq!(r["content"][0]["text"], "bonjour");

        let journal = recues.lock().expect("journal");
        assert_eq!(journal.len(), 4, "quatre échanges attendus");

        // Les deux types doivent figurer dans le même en-tête : c'est ce que les
        // serveurs vérifient, et l'oublier vaut un 406 avant le premier outil.
        let accept = journal[0].entete("accept").expect("en-tête accept");
        assert!(accept.contains("application/json"), "accept : {}", accept);
        assert!(accept.contains("text/event-stream"), "accept : {}", accept);
        assert_eq!(journal[0].entete("mcp-protocol-version"), Some(VERSION_PROTOCOLE));

        // La session est attribuée à la poignée de main et suit tout le reste,
        // la notification comprise : un serveur qui ne la voit pas repart de zéro.
        assert_eq!(journal[0].entete("mcp-session-id"), None);
        for echange in journal.iter().skip(1) {
            assert_eq!(
                echange.entete("mcp-session-id"),
                Some("session-de-banc"),
                "session absente de : {}",
                echange.corps
            );
        }
        assert_eq!(journal[1].entete("authorization"), Some("Bearer jeton-de-banc"));
        assert!(journal[1].corps.contains("notifications/initialized"));
    }

    /// Un serveur a le droit de répondre en flux d'événements, et d'y glisser ses
    /// propres messages avant le nôtre. On doit retrouver le nôtre quand même.
    #[test]
    fn une_reponse_en_flux_d_evenements_se_lit() {
        let (url, _) = serveur_de_banc(vec![
            reponse_flux(&[r#"{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18"}}"#]),
            reponse_acceptee(),
            reponse_flux(&[
                r#"{"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info"}}"#,
                r#"{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"lire_note","description":"d","annotations":{"readOnlyHint":true}}]}}"#,
            ]),
        ]);

        let mut c = client_distant(&url, vec![], 0, Duration::from_secs(10));
        c.ouvrir().expect("poignée de main en flux");
        assert_eq!(c.outils().len(), 1);
        assert_eq!(c.outils()[0].nom, "lire_note");
    }

    /// Un serveur qui accepte la connexion et se tait ne fige pas l'application.
    #[test]
    fn un_serveur_distant_muet_rend_la_main_au_delai() {
        let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute locale");
        let port = ecoute.local_addr().expect("adresse").port();
        std::thread::spawn(move || {
            // On accepte, et on garde la connexion sans rien répondre.
            let mut ouvertes = Vec::new();
            for flux in ecoute.incoming() {
                match flux {
                    Ok(f) => ouvertes.push(f),
                    Err(_) => break,
                }
            }
        });

        let url = format!("http://127.0.0.1:{}/mcp", port);
        let mut c = client_distant(&url, vec![], 0, Duration::from_secs(1));
        let debut = std::time::Instant::now();
        let refus = c.ouvrir().expect_err("un serveur muet ne peut pas aboutir");
        assert!(matches!(refus, Refus::DelaiDepasse { .. }), "refus inattendu : {:?}", refus);
        // Le délai est tenu, pas subi.
        assert!(debut.elapsed() < Duration::from_secs(8));
    }

    /// Un refus d'accès se dit au client dans ses mots, et lui dit où regarder.
    #[test]
    fn un_acces_refuse_se_dit_en_clair() {
        let (url, _) = serveur_de_banc(vec![
            "HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string(),
        ]);
        let mut c = client_distant(&url, vec![], 0, Duration::from_secs(10));
        let refus = c.ouvrir().expect_err("401 ne peut pas aboutir");
        let phrase = refus.en_clair();
        assert!(phrase.contains("trousseau"), "phrase peu utile : {}", phrase);
        assert!(!phrase.contains("401"), "code technique à l'écran : {}", phrase);
    }

    /// Un lot de réponses dans un seul corps se défait : sinon le client attend
    /// une réponse qu'il a déjà reçue sans la reconnaître.
    #[test]
    fn un_lot_de_messages_se_defait() {
        let messages = messages_du_corps(
            r#"[{"jsonrpc":"2.0","id":1,"result":{}},{"jsonrpc":"2.0","id":2,"result":{}}]"#,
        );
        assert_eq!(messages.len(), 2);
        assert!(messages[1].contains("\"id\":2"));
    }

    /// Le cadre du flux n'est pas du JSON-RPC : seules les lignes `data:` comptent.
    #[test]
    fn le_cadre_du_flux_ne_passe_pas_pour_un_message() {
        let flux = ": un commentaire\nevent: message\nid: 7\nretry: 100\ndata: {\"jsonrpc\":\"2.0\",\"id\":1}\n\n";
        let messages = messages_du_flux(flux);
        assert_eq!(messages.len(), 1);
        assert!(messages[0].contains("jsonrpc"));
    }

    // -----------------------------------------------------------------------
    // Ce qu'un agent a le droit d'appeler
    // -----------------------------------------------------------------------

    fn serveur_complet(connecteur: Option<&str>, outils: Vec<&str>) -> ServeurComplet {
        ServeurComplet {
            declare: ServeurDeclare {
                nom: "fichiers".into(),
                commande: "npx".into(),
                connecteur: connecteur.map(str::to_string),
                outils: outils
                    .into_iter()
                    .map(|n| OutilDeclare { nom: n.into(), ..Default::default() })
                    .collect(),
                ..Default::default()
            },
            role: "essai".into(),
        }
    }

    /// La liste blanche d'un agent se dérive de sa fiche, jamais de l'écran.
    #[test]
    fn un_agent_n_atteint_que_les_serveurs_dont_son_poste_a_besoin() {
        let serveur = serveur_complet(Some("OFF029"), vec!["list_directory", "write_file"]);

        // Un poste qui a besoin de ce connecteur : les outils retenus, et eux seuls.
        let permis = autorisations_pour(&serveur, &["OFF029".into(), "COM012".into()])
            .expect("le poste a bien ce besoin");
        assert_eq!(
            permis.outils,
            vec!["fichiers/list_directory", "fichiers/write_file"]
        );
        assert_eq!(permis.quota, APPELS_PAR_CONVERSATION);
        assert!(permis.permet("fichiers", "list_directory"));
        assert!(!permis.permet("fichiers", "outil_que_le_serveur_ajouterait"));

        // Un poste qui n'en a pas besoin : refusé, et le refus dit pourquoi.
        let refus = autorisations_pour(&serveur, &["CRM001".into()]).unwrap_err();
        assert!(refus.contains("besoin"), "refus peu parlant : {}", refus);
        assert!(refus.ends_with('.'), "refus sans point : {}", refus);
    }

    /// Un serveur qu'on n'a rattaché à aucun besoin n'est à la portée de personne.
    #[test]
    fn un_serveur_sans_connecteur_n_est_permis_a_aucun_agent() {
        let orphelin = serveur_complet(None, vec!["fetch"]);
        assert!(autorisations_pour(&orphelin, &["OFF029".into()]).is_err());
        // Même en lui tendant tout le catalogue.
        assert!(autorisations_pour(&orphelin, &[]).is_err());
    }

    /// Un serveur dont personne n'a relevé les outils n'est pas déclarable : la
    /// liste vide ne veut pas dire « tous », elle veut dire « pas encore lu ».
    #[test]
    fn un_serveur_sans_outils_releves_est_refuse() {
        let sans = ServeurDeclare {
            nom: "essai".into(),
            commande: "npx".into(),
            ..Default::default()
        };
        let erreur = declaration_recevable(&sans).unwrap_err();
        assert!(erreur.contains("relève"), "message peu parlant : {}", erreur);
    }

    /// Affirmer qu'un outil ne modifie rien dispense le client de valider. Ça ne
    /// s'écrit pas sans avoir dit ce qu'on a lu.
    #[test]
    fn affirmer_la_lecture_seule_sans_raison_est_refuse() {
        let affirme = |pourquoi: &str| ServeurDeclare {
            nom: "essai".into(),
            commande: "npx".into(),
            outils: vec![OutilDeclare {
                nom: "fetch".into(),
                lecture_seule: Some(true),
                pourquoi: pourquoi.into(),
            }],
            ..Default::default()
        };
        assert!(declaration_recevable(&affirme("")).is_err());
        assert!(declaration_recevable(&affirme("relevé le 23/09 : ne touche pas au poste")).is_ok());
    }

    /// Et l'affirmation doit se voir à l'appel : sans elle, l'outil non annoncé
    /// exige une validation ; avec elle, il part.
    #[test]
    fn l_affirmation_du_depot_vaut_annotation_absente() {
        let sans_annotation: &str = r#"{"jsonrpc":"2.0","id":2,"result":{"tools":[
            {"name":"fetch","description":"Récupère une page"}
        ]}}"#;

        let strict = client(vec!["distant/fetch"], 5, vec![INIT, sans_annotation]);
        let mut strict = strict;
        strict.ouvrir().expect("ouverture");
        assert!(!strict.outils()[0].lecture_seule);

        let mut souple = Client::nouveau(
            "distant",
            Box::new(TransportFactice::avec(vec![INIT, sans_annotation])),
            Autorisations { outils: vec!["distant/fetch".into()], quota: 5 },
            Arc::new(AtomicBool::new(false)),
        )
        .avec_lectures_seules(vec!["fetch".into()]);
        souple.ouvrir().expect("ouverture");
        assert!(souple.outils()[0].lecture_seule, "l'affirmation du dépôt n'a pas porté");
    }

    /// Un agent qu'on n'a pas embauché n'appelle rien, et une fiche qui n'est pas
    /// la sienne non plus.
    #[test]
    fn seul_un_agent_embauche_appelle_un_outil() {
        let installation = r#"{"agents":[
            {"prenom":"Marie","ficheId":"AG-0001","voix":""},
            {"prenom":"Paul","ficheId":"AG-0042","voix":""}
        ]}"#;
        assert!(est_embauche(installation, "Marie", "AG-0001"));
        assert!(est_embauche(installation, "Paul", "AG-0042"));
        // Le bon prénom sur la fiche d'un autre : refusé. C'est le cas qui
        // compte, parce qu'il ouvrirait les besoins de l'autre poste.
        assert!(!est_embauche(installation, "Marie", "AG-0042"));
        assert!(!est_embauche(installation, "Inconnue", "AG-0001"));
        assert!(!est_embauche(r#"{"agents":[]}"#, "Marie", "AG-0001"));
        assert!(!est_embauche("pas du JSON", "Marie", "AG-0001"));
    }

    /// Le serveur `distant` de ce banc n'est pas celui du client : la liste
    /// blanche nomme le serveur, donc un outil du bon nom sur un autre serveur
    /// reste refusé.
    #[test]
    fn la_liste_blanche_nomme_le_serveur_autant_que_l_outil() {
        let permis = Autorisations {
            outils: vec!["fichiers/list_directory".into()],
            quota: 5,
        };
        assert!(permis.permet("fichiers", "list_directory"));
        assert!(!permis.permet("web", "list_directory"));
    }

    #[test]
    fn chaque_refus_se_dit_sans_jargon() {
        // Ce que lit le client ne doit contenir ni nom de fonction, ni code
        // d'erreur, ni mot anglais : c'est la seule explication qu'il aura.
        let refus = vec![
            Refus::HorsListe { serveur: "fichiers".into(), outil: "effacer".into() },
            Refus::QuotaAtteint { quota: 20 },
            Refus::ValidationManquante { outil: "envoyer".into() },
            Refus::Arrete,
            Refus::DelaiDepasse { secondes: 30 },
        ];
        for r in refus {
            let phrase = r.en_clair();
            assert!(phrase.len() > 30, "refus trop court : {}", phrase);
            assert!(phrase.ends_with('.'), "refus sans point : {}", phrase);
            for jargon in ["null", "Err", "None", "error", "MCP", "JSON"] {
                assert!(!phrase.contains(jargon), "jargon « {} » dans : {}", jargon, phrase);
            }
        }
    }
}
