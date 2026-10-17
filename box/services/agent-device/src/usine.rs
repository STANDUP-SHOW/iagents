//! Le mode usine (brief §44-§45) : un petit serveur HTTP sur 127.0.0.1 qui sert
//! l'écran opérateur (box/usine/ui, construit en statique) et son API
//! (CONTRAT.md). Sans cadre web : une requête à la fois, du JSON, des chemins
//! connus ; cog l'affiche en plein écran dans cage. Rien n'écoute ailleurs que
//! sur la boucle locale, et nftables ferme tout le reste.

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use serde_json::{json, Value};

use crate::inventaire;
use crate::plateforme::{self, Chemins, Erreur, Identite};

#[derive(Default)]
struct Etat {
    etape: String, // attente | enrolement | tests | rapport | qualifiee | echec
    operateur: Option<String>,
    profil_materiel: Option<String>,
    tests: Vec<Value>,
    verdict: Option<Value>,
    reponse_plateforme: Option<Value>,
    erreur: Option<String>,
}

type Partage = Arc<Mutex<Etat>>;

pub fn servir(chemins: &Chemins, adresse: &str) -> Result<(), Erreur> {
    if !adresse.starts_with("127.0.0.1:") && !adresse.starts_with("localhost:") {
        return Err(Erreur::Usage("Le mode usine n'écoute que sur 127.0.0.1 : aucun port entrant sur une Box (brief §38).".to_string()));
    }
    let ecoute = TcpListener::bind(adresse).map_err(|e| Erreur::Reseau(format!("{} : {}", adresse, e)))?;
    let etat: Partage = Arc::new(Mutex::new(Etat { etape: "attente".to_string(), ..Default::default() }));
    let ui = PathBuf::from(std::env::var("IAGENT_UI").unwrap_or_else(|_| "/opt/iagent/usine/ui".to_string()));
    let tests = PathBuf::from(std::env::var("IAGENT_TESTS").unwrap_or_else(|_| "/opt/iagent/usine".to_string()));
    eprintln!("mode usine : écran opérateur sur http://{}/", adresse);
    for flux in ecoute.incoming() {
        let Ok(flux) = flux else { continue };
        let (etat, chemins, ui, tests) = (etat.clone(), Chemins { etat: chemins.etat.clone(), conf: chemins.conf.clone() }, ui.clone(), tests.clone());
        std::thread::spawn(move || {
            if let Err(e) = traiter(flux, &etat, &chemins, &ui, &tests) {
                eprintln!("requête usine : {}", e);
            }
        });
    }
    Ok(())
}

struct Requete {
    methode: String,
    chemin: String,
    corps: String,
}

fn lire_requete(flux: &mut TcpStream) -> std::io::Result<Requete> {
    let mut lecteur = BufReader::new(flux.try_clone()?);
    let mut ligne = String::new();
    lecteur.read_line(&mut ligne)?;
    let mut morceaux = ligne.split_whitespace();
    let methode = morceaux.next().unwrap_or("GET").to_string();
    let chemin = morceaux.next().unwrap_or("/").split('?').next().unwrap_or("/").to_string();
    let mut longueur = 0usize;
    loop {
        let mut l = String::new();
        if lecteur.read_line(&mut l)? == 0 || l == "\r\n" || l == "\n" {
            break;
        }
        if let Some(v) = l.to_ascii_lowercase().strip_prefix("content-length:") {
            longueur = v.trim().parse().unwrap_or(0).min(1 << 20);
        }
    }
    let mut corps = vec![0u8; longueur];
    if longueur > 0 {
        lecteur.read_exact(&mut corps)?;
    }
    Ok(Requete { methode, chemin, corps: String::from_utf8_lossy(&corps).to_string() })
}

fn repondre(flux: &mut TcpStream, statut: u16, type_: &str, corps: &[u8]) -> std::io::Result<()> {
    let libelle = match statut { 200 => "OK", 201 => "Created", 400 => "Bad Request", 404 => "Not Found", 409 => "Conflict", 500 => "Internal Server Error", _ => "OK" };
    write!(flux, "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", statut, libelle, type_, corps.len())?;
    flux.write_all(corps)?;
    flux.flush()
}

fn json_(flux: &mut TcpStream, statut: u16, v: Value) -> std::io::Result<()> {
    repondre(flux, statut, "application/json; charset=utf-8", v.to_string().as_bytes())
}

/// Static files of the operator page: only under `ui/`, no `..`, index.html by default.
fn fichier_statique(ui: &Path, chemin: &str) -> Option<(String, Vec<u8>)> {
    let relatif = chemin.trim_start_matches('/');
    if relatif.split('/').any(|s| s == "..") {
        return None;
    }
    let mut p = ui.join(if relatif.is_empty() { "index.html" } else { relatif });
    if !p.exists() && !relatif.contains('.') {
        p = ui.join("index.html");
    }
    let octets = fs::read(&p).ok()?;
    let type_ = match p.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("json") => "application/json; charset=utf-8",
        Some("png") => "image/png",
        _ => "application/octet-stream",
    };
    Some((type_.to_string(), octets))
}

fn journaliser(chemins: &Chemins, evenement: Value) {
    let c = chemins.etat.join("usine").join("journal.ndjson");
    let _ = fs::create_dir_all(c.parent().unwrap());
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&c) {
        let _ = writeln!(f, "{}", json!({ "quand": plateforme::horodatage(), "evenement": evenement }));
    }
}

fn traiter(mut flux: TcpStream, etat: &Partage, chemins: &Chemins, ui: &Path, tests: &Path) -> std::io::Result<()> {
    let req = lire_requete(&mut flux)?;
    match (req.methode.as_str(), req.chemin.as_str()) {
        ("GET", "/api/etat") => {
            let e = etat.lock().unwrap();
            let device = plateforme::Device::lire(chemins).ok();
            let inventaire = fs::read_to_string(chemins.etat.join("usine").join("inventaire.json")).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok());
            let profil = fs::read_to_string(chemins.conf.join("profil")).map(|s| s.trim().to_string()).unwrap_or_default();
            let graine = plateforme::Graine::lire(chemins).unwrap_or_default();
            json_(&mut flux, 200, json!({
                "profil": profil, "device": device, "inventaire": inventaire, "profil_materiel": e.profil_materiel,
                "operateur": e.operateur.clone().or(graine.operateur), "lot": graine.lot, "plateforme": graine.plateforme, "jeton_present": graine.jeton.is_some(),
                "etape": e.etape, "tests": e.tests, "verdict": e.verdict, "reponse_plateforme": e.reponse_plateforme, "erreur": e.erreur,
                "qualifiee": chemins.etat.join("usine").join("qualifiee").exists(),
                "profils_materiel": profils_materiel(),
            }))
        }
        ("POST", "/api/installer") => {
            let corps: Value = serde_json::from_str(&req.corps).unwrap_or(Value::Null);
            let operateur = corps["operateur"].as_str().map(str::trim).filter(|s| !s.is_empty()).map(str::to_string);
            let profil_materiel = corps["profil_materiel"].as_str().map(str::to_string);
            let (Some(operateur), Some(profil_materiel)) = (operateur, profil_materiel) else {
                return json_(&mut flux, 400, json!({ "erreur": "Il faut un opérateur et un profil matériel pour installer." }));
            };
            {
                let mut e = etat.lock().unwrap();
                if e.etape == "enrolement" || e.etape == "tests" {
                    return json_(&mut flux, 409, json!({ "erreur": "Une installation est déjà en cours." }));
                }
                *e = Etat { etape: "enrolement".to_string(), operateur: Some(operateur.clone()), profil_materiel: Some(profil_materiel.clone()), ..Default::default() };
            }
            journaliser(chemins, json!({ "installer": { "operateur": operateur, "profil_materiel": profil_materiel } }));
            let (etat2, chemins2, tests2) = (etat.clone(), Chemins { etat: chemins.etat.clone(), conf: chemins.conf.clone() }, tests.to_path_buf());
            std::thread::spawn(move || installer(&etat2, &chemins2, &tests2, &operateur, &profil_materiel));
            json_(&mut flux, 201, json!({ "etape": "enrolement" }))
        }
        ("GET", "/api/rapport") => match dernier_rapport(chemins) {
            Some((nom, texte)) => repondre(&mut flux, 200, "application/json; charset=utf-8", format!("{{\"fichier\":{},\"rapport\":{}}}", json!(nom), texte).as_bytes()),
            None => json_(&mut flux, 404, json!({ "erreur": "Aucun rapport écrit pour l'instant." })),
        },
        ("POST", "/api/eteindre") => {
            journaliser(chemins, json!({ "eteindre": true }));
            let _ = Command::new("systemctl").arg("poweroff").spawn();
            json_(&mut flux, 200, json!({ "eteindre": true }))
        }
        ("GET", chemin) => match fichier_statique(ui, chemin) {
            Some((type_, octets)) => repondre(&mut flux, 200, &type_, &octets),
            None => repondre(&mut flux, 404, "text/plain; charset=utf-8", "Cette adresse n'existe pas sur l'écran d'usine.".as_bytes()),
        },
        _ => json_(&mut flux, 404, json!({ "erreur": "Cette adresse n'existe pas sur l'écran d'usine." })),
    }
}

fn profils_materiel() -> Vec<Value> {
    let dossier = PathBuf::from(std::env::var("IAGENT_MATERIEL").unwrap_or_else(|_| "/opt/iagent/materiel".to_string()));
    let mut v: Vec<Value> = fs::read_dir(&dossier)
        .map(|d| d.flatten().filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json")).filter_map(|e| fs::read_to_string(e.path()).ok()).filter_map(|t| serde_json::from_str::<Value>(&t).ok()).map(|p| json!({ "id": p["id"], "nom": p["nom"], "gammes": p["gammes"], "a_confirmer": p["a_confirmer"] })).collect())
        .unwrap_or_default();
    v.sort_by_key(|p| p["id"].as_str().unwrap_or("").to_string());
    v
}

fn dernier_rapport(chemins: &Chemins) -> Option<(String, String)> {
    let dossier = chemins.etat.join("usine");
    let mut rapports: Vec<PathBuf> = fs::read_dir(&dossier).ok()?.flatten().map(|e| e.path()).filter(|p| p.file_name().map(|n| n.to_string_lossy().starts_with("IA-FR-")).unwrap_or(false) && p.extension().and_then(|x| x.to_str()) == Some("json")).collect();
    rapports.sort_by_key(|p| fs::metadata(p).and_then(|m| m.modified()).ok());
    let p = rapports.pop()?;
    Some((p.file_name()?.to_string_lossy().to_string(), fs::read_to_string(&p).ok()?))
}

/// The whole run, in a thread: enrol if needed, run lancer.py line by line, deposit the report, write the marker.
fn installer(etat: &Partage, chemins: &Chemins, tests: &Path, operateur: &str, profil_materiel: &str) {
    let echec = |etat: &Partage, m: String| {
        let mut e = etat.lock().unwrap();
        e.etape = "echec".to_string();
        e.erreur = Some(m.clone());
        journaliser(chemins, json!({ "echec": m }));
    };
    // 1. Enrolment, unless the Box already is.
    if plateforme::Device::lire(chemins).is_err() {
        let graine = match plateforme::Graine::lire(chemins) { Ok(g) => g, Err(e) => return echec(etat, e.to_string()) };
        let (Some(adresse), Some(jeton)) = (graine.plateforme.clone(), graine.jeton.clone()) else {
            return echec(etat, "L'ISO ne porte ni adresse de plateforme ni jeton d'usine (usine.json) : enrôlement impossible. Reconstruire l'ISO avec --plateforme et --jeton-fichier.".to_string());
        };
        let identite = match Identite::charger_ou_creer(chemins) { Ok(i) => i, Err(e) => return echec(etat, e.to_string()) };
        let inv = inventaire::relever();
        if let Err(e) = plateforme::ecrire_atomique(&chemins.etat.join("usine").join("inventaire.json"), serde_json::to_string_pretty(&inv).unwrap().as_bytes(), 0o640) { return echec(etat, e.to_string()); }
        let manifeste = match plateforme::Manifeste::lire(chemins) { Ok(m) => m, Err(e) => return echec(etat, e.to_string()) };
        let box_ = match plateforme::enroler(&adresse, &jeton, &identite, profil_materiel, &inv, &manifeste, operateur) { Ok(b) => b, Err(e) => return echec(etat, e.to_string()) };
        let cle = match plateforme::cle_publique_plateforme(&adresse) { Ok(c) => c, Err(e) => return echec(etat, e.to_string()) };
        let device = plateforme::Device {
            plateforme: adresse, cle_plateforme: cle,
            device_id: box_["device_id"].as_str().unwrap_or_default().to_string(), reference: box_["reference"].as_str().unwrap_or_default().to_string(),
            serial: box_["serial"].as_str().unwrap_or_default().to_string(), gamme: box_["gamme"].as_str().unwrap_or_default().to_string(),
            profil_materiel: profil_materiel.to_string(), lot: graine.lot.clone(), enrolee_le: plateforme::horodatage(),
        };
        if let Err(e) = device.ecrire(chemins).and_then(|_| graine.oublier_le_jeton(chemins)) { return echec(etat, e.to_string()); }
        journaliser(chemins, json!({ "enrolee": { "reference": device.reference, "device_id": device.device_id } }));
    }
    let device = match plateforme::Device::lire(chemins) { Ok(d) => d, Err(e) => return echec(etat, e.to_string()) };
    // 2. The tests, one JSON line each, shown as they come.
    etat.lock().unwrap().etape = "tests".to_string();
    let profil_os = fs::read_to_string(chemins.conf.join("profil")).map(|s| s.trim().to_string()).unwrap_or_else(|_| device.gamme.clone());
    let profils = PathBuf::from(std::env::var("IAGENT_PROFILS").unwrap_or_else(|_| "/opt/iagent/profils".to_string()));
    let materiel = PathBuf::from(std::env::var("IAGENT_MATERIEL").unwrap_or_else(|_| "/opt/iagent/materiel".to_string()));
    let manifeste = std::env::var("IAGENT_MANIFESTE").unwrap_or_else(|_| "/opt/iagent/manifeste.json".to_string());
    let mut enfant = match Command::new("python3")
        .arg("-I").arg(tests.join("lancer.py"))
        .arg("--profil-os").arg(profils.join(format!("{}.json", profil_os)))
        .arg("--profil-materiel").arg(materiel.join(format!("{}.json", profil_materiel)))
        .arg("--inventaire").arg(chemins.etat.join("usine").join("inventaire.json"))
        .arg("--device").arg(plateforme::Device::chemin(chemins))
        .arg("--manifeste").arg(&manifeste)
        .arg("--operateur").arg(operateur)
        .arg("--sortie").arg(chemins.etat.join("usine"))
        .arg("--etat").arg(&chemins.etat)
        .arg("--plateforme").arg(&device.plateforme)
        .stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()
    {
        Ok(c) => c,
        Err(e) => return echec(etat, format!("python3 lancer.py : {}", e)),
    };
    let sortie = enfant.stdout.take().unwrap();
    let mut rapport_ecrit: Option<Value> = None;
    for ligne in BufReader::new(sortie).lines().map_while(Result::ok) {
        let Ok(v) = serde_json::from_str::<Value>(&ligne) else { continue };
        if v.get("rapport").is_some() {
            rapport_ecrit = Some(v);
        } else {
            journaliser(chemins, json!({ "test": v }));
            etat.lock().unwrap().tests.push(v);
        }
    }
    let _ = enfant.wait();
    let Some(bilan) = rapport_ecrit else { return echec(etat, "lancer.py n'a pas écrit de rapport.".to_string()) };
    etat.lock().unwrap().verdict = Some(bilan.clone());
    // 3. Deposit; the platform's verdict wins.
    etat.lock().unwrap().etape = "rapport".to_string();
    let fichier = bilan["rapport"].as_str().unwrap_or("").to_string();
    let texte = match fs::read_to_string(&fichier) { Ok(t) => t, Err(e) => return echec(etat, format!("{} : {}", fichier, e)) };
    let identite = match Identite::charger(chemins) { Ok(i) => i, Err(e) => return echec(etat, e.to_string()) };
    match plateforme::deposer_rapport(&device, &identite, &texte) {
        Ok(reponse) => {
            let statut = reponse["box"]["statut"].as_str().unwrap_or("?").to_string();
            if statut == "qualifiee" || statut == "provisionnee" {
                let _ = plateforme::ecrire_atomique(&chemins.etat.join("usine").join("qualifiee"), statut.as_bytes(), 0o644);
            }
            journaliser(chemins, json!({ "rapport_depose": { "verdict": reponse["rapport"]["verdict"], "statut": statut } }));
            let mut e = etat.lock().unwrap();
            e.etape = if statut == "usine" { "echec".to_string() } else { "qualifiee".to_string() };
            e.reponse_plateforme = Some(reponse);
        }
        Err(e) => echec(etat, e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn les_fichiers_statiques_ne_sortent_pas_du_dossier() {
        let d = std::env::temp_dir().join(format!("iagent-ui-{}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("index.html"), "<html>usine</html>").unwrap();
        fs::write(d.join("app.js"), "1").unwrap();
        assert_eq!(fichier_statique(&d, "/").unwrap().0, "text/html; charset=utf-8");
        assert_eq!(fichier_statique(&d, "/app.js").unwrap().0, "text/javascript; charset=utf-8");
        assert!(fichier_statique(&d, "/../etc/passwd").is_none());
        // A client-side route falls back to index.html.
        assert_eq!(fichier_statique(&d, "/termine").unwrap().1, b"<html>usine</html>");
        assert!(fichier_statique(&d, "/absent.css").is_none());
        let _ = fs::remove_dir_all(&d);
    }
}
