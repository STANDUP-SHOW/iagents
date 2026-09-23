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
        }
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
        self.outils = resultat
            .get("tools")
            .and_then(serde_json::Value::as_array)
            .map(|outils| {
                outils
                    .iter()
                    .map(|o| Outil {
                        nom: o.get("name").and_then(serde_json::Value::as_str).unwrap_or("").to_string(),
                        description: o
                            .get("description")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("")
                            .to_string(),
                        // Absent vaut « modifie » : on ne suppose pas l'innocuité.
                        lecture_seule: o
                            .get("annotations")
                            .and_then(|a| a.get("readOnlyHint"))
                            .and_then(serde_json::Value::as_bool)
                            .unwrap_or(false),
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServeurDeclare {
    pub nom: String,
    pub commande: String,
    #[serde(default)]
    pub arguments: Vec<String>,
    /// Les NOMS des variables d'environnement à remplir depuis le trousseau.
    #[serde(default)]
    pub secrets: Vec<String>,
    /// Le connecteur du catalogue dont ce serveur est la mise en œuvre, quand il
    /// y en a un. C'est par lui que passe la règle d'activation.
    #[serde(default)]
    pub connecteur: Option<String>,
}

/// Refuse une déclaration qui porterait une valeur de secret plutôt qu'un nom.
///
/// Le piège est facile : on écrit `"secrets": ["sk-ant-..."]` pour essayer, et la
/// clé part au dépôt. Un nom de variable n'a ni tiret ni point ni espace.
pub fn declaration_recevable(serveur: &ServeurDeclare) -> Result<(), String> {
    if serveur.nom.trim().is_empty() {
        return Err("un serveur sans nom ne peut pas être appelé".to_string());
    }
    if serveur.commande.trim().is_empty() {
        return Err(format!("{} : aucune commande à lancer", serveur.nom));
    }
    for secret in &serveur.secrets {
        let nom_de_variable = !secret.is_empty()
            && secret
                .chars()
                .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_');
        if !nom_de_variable {
            return Err(format!(
                "{} : « {} » n'est pas un nom de variable. Les secrets se lisent dans le trousseau du système, ils ne s'écrivent pas ici.",
                serveur.nom, secret
            ));
        }
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
// Ce que l'application expose
// ---------------------------------------------------------------------------

/// Un serveur déclaré, tel qu'il se montre à l'écran : la commande et le rôle,
/// jamais un secret.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServeurVisible {
    pub nom: String,
    pub commande: String,
    pub role: String,
    pub connecteur: Option<String>,
    /// Les noms des variables attendues. Leur valeur reste au trousseau.
    pub secrets_attendus: Vec<String>,
    /// `true` quand chaque secret attendu est effectivement au trousseau.
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
        .secrets
        .iter()
        .filter_map(|nom| {
            trousseau(nom)
                .ok()
                .and_then(|e| e.get_password().ok())
                .map(|valeur| (nom.clone(), valeur))
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
            let presents = secrets_du_trousseau(&s.declare).len();
            ServeurVisible {
                pret: presents == s.declare.secrets.len(),
                nom: s.declare.nom,
                commande: s.declare.commande,
                role: s.role,
                connecteur: s.declare.connecteur,
                secrets_attendus: s.declare.secrets,
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
        .any(|s| s.declare.secrets.contains(&nom_de_variable));
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

    let transport = ProcessusTransport::lancer(&trouve.declare, &secrets_du_trousseau(&trouve.declare))?;
    let autorisations = Autorisations { outils: outils_autorises, quota: 0 };
    let mut client = Client::nouveau(
        &serveur,
        Box::new(transport),
        autorisations,
        Arc::new(AtomicBool::new(false)),
    );
    client.ouvrir().map_err(|r| r.en_clair())?;
    let permis: Vec<Outil> = client.outils_permis().into_iter().cloned().collect();
    client.arreter();
    Ok(permis)
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
            "secrets":["ghp_uneVraieCleDeTest"],"role":"essai"}]}"#;
        let fichier: FichierServeurs = serde_json::from_str(truque).expect("JSON de banc");
        let erreur = declaration_recevable(&fichier.serveurs[0].declare).unwrap_err();
        assert!(erreur.contains("trousseau"), "message peu parlant : {}", erreur);
    }

    #[test]
    fn une_declaration_qui_porte_une_cle_est_refusee() {
        let avec_cle = ServeurDeclare {
            nom: "essai".into(),
            commande: "npx".into(),
            arguments: vec![],
            secrets: vec!["sk-ant-api03-quelque-chose".into()],
            connecteur: None,
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
            arguments: vec![],
            secrets: vec![],
            connecteur: None,
        };
        assert!(declaration_recevable(&vide).is_err());
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
            secrets: vec![],
            connecteur: None,
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
            secrets: vec![],
            connecteur: None,
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
            arguments: vec![],
            secrets: vec![],
            connecteur: None,
        };
        assert!(ProcessusTransport::lancer(&serveur, &[]).is_err());
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
