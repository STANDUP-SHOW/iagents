//! iagent-device : l'agent de la Box (brief §15). Voir CONTRAT.md pour les
//! fichiers, les sous-commandes et l'API locale du mode usine.
//!
//! Un seul binaire, plusieurs rôles, parce qu'ils partagent l'identité et la
//! façon de parler à la plateforme ; un seul endroit signe (`plateforme.rs`),
//! un seul endroit relève la machine (`inventaire.rs`), un seul endroit mesure
//! la santé (`sante.rs`). Les règles qui ne touchent pas la machine sont des
//! fonctions pures éprouvées par `cargo test` sur des relevés figés.

mod inventaire;
mod plateforme;
mod sante;
mod usine;

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Duration;

use plateforme::{Chemins, Erreur};

const INTERVALLE_TELEMETRIE: Duration = Duration::from_secs(300);
const BATTEMENT_WATCHDOG: Duration = Duration::from_secs(30);

fn usage() -> &'static str {
    "iagent-device identite | inventaire [--sortie f] | enroler --profil-materiel <id> [--jeton <t>] | telemetrie [--une-fois] | rapport <fichier> | mises-a-jour | servir | usine --ecouter <adresse:port>"
}

fn argument(args: &[String], nom: &str) -> Option<String> {
    args.iter().position(|a| a == nom).and_then(|i| args.get(i + 1).cloned())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let chemins = Chemins::depuis_environnement();
    let issue = match args.first().map(String::as_str) {
        Some("identite") => identite(&chemins),
        Some("inventaire") => inventaire(&chemins, argument(&args, "--sortie")),
        Some("enroler") => enroler(&chemins, argument(&args, "--profil-materiel"), argument(&args, "--jeton")),
        Some("telemetrie") => telemetrie(&chemins),
        Some("rapport") => rapport(&chemins, args.get(1).cloned()),
        Some("mises-a-jour") => mises_a_jour(&chemins),
        Some("servir") => servir(&chemins),
        Some("usine") => usine::servir(&chemins, &argument(&args, "--ecouter").unwrap_or_else(|| "127.0.0.1:8787".to_string())),
        _ => Err(Erreur::Usage(usage().to_string())),
    };
    match issue {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{}", e);
            ExitCode::from(e.code())
        }
    }
}

fn identite(chemins: &Chemins) -> Result<(), Erreur> {
    let id = plateforme::Identite::charger_ou_creer(chemins)?;
    println!("{}", serde_json::to_string_pretty(&id.publique()).expect("json"));
    Ok(())
}

fn inventaire(chemins: &Chemins, sortie: Option<String>) -> Result<(), Erreur> {
    let inv = inventaire::relever();
    let texte = serde_json::to_string_pretty(&inv).expect("json");
    let chemin = sortie.map(PathBuf::from).unwrap_or_else(|| chemins.etat.join("usine").join("inventaire.json"));
    plateforme::ecrire_atomique(&chemin, texte.as_bytes(), 0o640)?;
    println!("{}", texte);
    Ok(())
}

fn enroler(chemins: &Chemins, profil_materiel: Option<String>, jeton: Option<String>) -> Result<(), Erreur> {
    let profil_materiel = profil_materiel.ok_or_else(|| Erreur::Usage("--profil-materiel <id> manque (un fichier de box/materiel/).".to_string()))?;
    let graine = plateforme::Graine::lire(chemins)?;
    let jeton = jeton.or(graine.jeton.clone()).ok_or_else(|| Erreur::Usage("Aucun jeton d'usine : --jeton <t>, ou /etc/iagent/usine.json (jeton) écrit par l'ISO.".to_string()))?;
    let adresse = graine.plateforme.clone().ok_or_else(|| Erreur::Usage("Adresse de la plateforme inconnue : /etc/iagent/usine.json (plateforme).".to_string()))?;
    let identite = plateforme::Identite::charger_ou_creer(chemins)?;
    let inv = inventaire::relever();
    plateforme::ecrire_atomique(&chemins.etat.join("usine").join("inventaire.json"), serde_json::to_string_pretty(&inv).expect("json").as_bytes(), 0o640)?;
    let manifeste = plateforme::Manifeste::lire(chemins)?;
    let box_ = plateforme::enroler(&adresse, &jeton, &identite, &profil_materiel, &inv, &manifeste, graine.operateur.as_deref().unwrap_or("atelier"))?;
    let cle_plateforme = plateforme::cle_publique_plateforme(&adresse)?;
    let device = plateforme::Device {
        plateforme: adresse,
        cle_plateforme,
        device_id: box_["device_id"].as_str().unwrap_or_default().to_string(),
        reference: box_["reference"].as_str().unwrap_or_default().to_string(),
        serial: box_["serial"].as_str().unwrap_or_default().to_string(),
        gamme: box_["gamme"].as_str().unwrap_or_default().to_string(),
        profil_materiel,
        lot: graine.lot.clone(),
        enrolee_le: plateforme::horodatage(),
    };
    device.ecrire(chemins)?;
    graine.oublier_le_jeton(chemins)?;
    println!("{}", serde_json::to_string_pretty(&box_).expect("json"));
    Ok(())
}

fn telemetrie(chemins: &Chemins) -> Result<(), Erreur> {
    let device = plateforme::Device::lire(chemins)?;
    let identite = plateforme::Identite::charger(chemins)?;
    let mesure = sante::mesurer(chemins);
    let reponse = plateforme::telemetrie(&device, &identite, &mesure)?;
    println!("{}", reponse);
    Ok(())
}

fn rapport(chemins: &Chemins, fichier: Option<String>) -> Result<(), Erreur> {
    let fichier = fichier.ok_or_else(|| Erreur::Usage("rapport <fichier.json> : le rapport écrit par lancer.py.".to_string()))?;
    let texte = std::fs::read_to_string(&fichier).map_err(|e| Erreur::Fichier(format!("{} : {}", fichier, e)))?;
    let device = plateforme::Device::lire(chemins)?;
    let identite = plateforme::Identite::charger(chemins)?;
    let reponse = plateforme::deposer_rapport(&device, &identite, &texte)?;
    let statut = reponse["box"]["statut"].as_str().unwrap_or("?");
    if statut == "qualifiee" || statut == "provisionnee" {
        plateforme::ecrire_atomique(&chemins.etat.join("usine").join("qualifiee"), statut.as_bytes(), 0o644)?;
    }
    println!("{}", serde_json::to_string_pretty(&reponse).expect("json"));
    Ok(())
}

fn mises_a_jour(chemins: &Chemins) -> Result<(), Erreur> {
    let device = plateforme::Device::lire(chemins)?;
    let identite = plateforme::Identite::charger(chemins)?;
    let liste = plateforme::mises_a_jour(&device, &identite)?;
    println!("{}", serde_json::to_string_pretty(&liste).expect("json"));
    Ok(())
}

/// The daemon of iagent-device.service: Type=notify, telemetry every five minutes, watchdog heartbeat every thirty seconds.
fn servir(chemins: &Chemins) -> Result<(), Erreur> {
    let _ = sd_notify::notify(false, &[sd_notify::NotifyState::Ready]);
    let mut depuis = Duration::from_secs(u64::MAX / 4);
    loop {
        if depuis >= INTERVALLE_TELEMETRIE {
            depuis = Duration::ZERO;
            match (plateforme::Device::lire(chemins), plateforme::Identite::charger(chemins)) {
                (Ok(device), Ok(identite)) => match plateforme::telemetrie(&device, &identite, &sante::mesurer(chemins)) {
                    Ok(r) => eprintln!("télémétrie acceptée : {}", r),
                    Err(e) => eprintln!("télémétrie refusée ou injoignable : {}", e),
                },
                (Err(e), _) | (_, Err(e)) => eprintln!("pas encore enrôlée : {}", e),
            }
        }
        let _ = sd_notify::notify(false, &[sd_notify::NotifyState::Watchdog]);
        std::thread::sleep(BATTEMENT_WATCHDOG);
        depuis += BATTEMENT_WATCHDOG;
    }
}
