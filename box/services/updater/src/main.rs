//! iagent-updater : les mises à jour de la Box (brief §31-§33), un seul updater
//! sur la machine (l'updater Tauri est éteint en édition Box sous Linux).
//!
//!   iagent-updater verifier    relève ce que la plateforme vise, vérifie chaque
//!                              signature, n'installe rien (test d'usine « ota »)
//!   iagent-updater appliquer   télécharge, vérifie empreinte ET signature, pose
//!                              le .deb, contrôle la santé, revient en arrière sinon
//!
//! Il signe ses propres requêtes avec l'identité de la Box (root lit la clé),
//! et lit la clé publique de la plateforme dans /etc/iagent/device.json, posée à
//! l'enrôlement : un paquet dont la signature ne tombe pas juste n'est jamais
//! donné à apt. Ce qui se décide sans la machine (quelle version pose-t-on,
//! l'empreinte est-elle la bonne, revient-on en arrière) est pur et éprouvé ;
//! la pose réelle par apt est « non constatée » tant qu'aucune Box n'a tourné.

use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};

use iagent_identite_box as identite;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

const COMPOSANTS_DEB: [&str; 4] = ["device", "updater", "watchdog", "desktop"];
const SERVICES_SANTE: [&str; 2] = ["iagent-device", "iagent-watchdog"];

#[derive(Debug, Clone, Deserialize)]
struct Device {
    plateforme: String,
    cle_plateforme: String,
    device_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Visee {
    pub composant: String,
    pub version: String,
    pub url: String,
    pub empreinte: String,
    pub signature: String,
    pub actuelle: Option<String>,
    pub a_jour: Option<bool>,
}

/// What is installed, per component, as dpkg says (`dpkg-query -W`), Debian revision dropped.
fn installees() -> std::collections::BTreeMap<String, String> {
    let mut m = std::collections::BTreeMap::new();
    if let Ok(o) = Command::new("dpkg-query").args(["-W", "-f=${binary:Package} ${Version}\n", "iagent-device", "iagent-updater", "iagent-watchdog", "iagent-desktop"]).output() {
        for l in String::from_utf8_lossy(&o.stdout).lines() {
            if let Some((p, v)) = l.split_once(' ') {
                m.insert(p.trim_start_matches("iagent-").to_string(), v.split('-').next().unwrap_or(v).to_string());
            }
        }
    }
    m
}

// --- pure decisions ----------------------------------------------------------------

/// Semver precedence by numbers (same rule as regles.ts comparerVersions, without pre-releases: a Box never follows `beta`).
pub fn comparer_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let n = |s: &str| -> Vec<u64> { s.split('-').next().unwrap_or(s).split('.').map(|p| p.parse().unwrap_or(0)).collect() };
    n(a).cmp(&n(b))
}

/// Keeps the targets whose signature the platform key verifies; refuses the others with a reason.
pub fn verifier_visees(cle_plateforme: &str, visees: &[Visee]) -> (Vec<Visee>, Vec<String>) {
    let mut bonnes = vec![];
    let mut refus = vec![];
    for v in visees {
        if v.empreinte.len() != 64 || !v.empreinte.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()) {
            refus.push(format!("{} {} : empreinte mal formée", v.composant, v.version));
        } else if !v.url.starts_with("https://") {
            refus.push(format!("{} {} : adresse en clair refusée", v.composant, v.version));
        } else if !identite::verifier_mise_a_jour(cle_plateforme, &v.composant, &v.version, &v.empreinte, &v.signature) {
            refus.push(format!("{} {} : la signature de la plateforme ne tombe pas juste", v.composant, v.version));
        } else {
            bonnes.push(v.clone());
        }
    }
    (bonnes, refus)
}

/// Which verified targets to install: a .deb component whose version is above what dpkg reports.
pub fn a_poser(verifiees: &[Visee], installees: &std::collections::BTreeMap<String, String>) -> Vec<Visee> {
    verifiees
        .iter()
        .filter(|v| COMPOSANTS_DEB.contains(&v.composant.as_str()))
        .filter(|v| match installees.get(&v.composant) {
            Some(actuelle) => comparer_versions(&v.version, actuelle) == std::cmp::Ordering::Greater,
            None => false, // never install a component the Box does not already carry
        })
        .cloned()
        .collect()
}

pub fn empreinte_fichier(chemin: &Path) -> std::io::Result<String> {
    Ok(Sha256::digest(fs::read(chemin)?).iter().map(|b| format!("{:02x}", b)).collect())
}

// --- the machine ---------------------------------------------------------------------

fn etat() -> PathBuf {
    PathBuf::from(std::env::var("IAGENT_ETAT").unwrap_or_else(|_| "/var/lib/iagent".to_string()))
}

fn device() -> Result<Device, String> {
    let c = PathBuf::from(std::env::var("IAGENT_CONF").unwrap_or_else(|_| "/etc/iagent".to_string())).join("device.json");
    let t = fs::read_to_string(&c).map_err(|_| format!("Cette Box n'est pas enrôlée ({} absent).", c.display()))?;
    serde_json::from_str(&t).map_err(|e| format!("{} illisible : {}", c.display(), e))
}

fn identite_box() -> Result<ring::signature::Ed25519KeyPair, String> {
    let f = etat().join("identite").join("ed25519.pkcs8");
    let pkcs8 = fs::read(&f).map_err(|_| format!("Identité de la Box absente ({}).", f.display()))?;
    identite::paire_depuis_pkcs8(&pkcs8)
}

fn relever(d: &Device) -> Result<Vec<Visee>, String> {
    let paire = identite_box()?;
    let chemin = "/controle/box/mises-a-jour";
    let h = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let e = identite::en_tetes(&paire, &d.device_id, "GET", chemin, &h, "");
    let r = ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(20)).build()
        .get(&format!("{}{}", d.plateforme.trim_end_matches('/'), chemin))
        .set("x-box-id", &e.box_id).set("x-horodatage", &e.horodatage).set("x-signature", &e.signature)
        .call();
    let v: Value = match r {
        Ok(rep) => rep.into_json().map_err(|e| format!("Réponse illisible : {}", e))?,
        Err(ureq::Error::Status(code, rep)) => {
            let c: Value = rep.into_json().unwrap_or(Value::Null);
            return Err(format!("La plateforme refuse ({}) : {}", code, c["erreur"].as_str().unwrap_or("(sans message)")));
        }
        Err(ureq::Error::Transport(t)) => return Err(format!("Plateforme injoignable : {}", t)),
    };
    serde_json::from_value(v["mises_a_jour"].clone()).map_err(|e| format!("Liste de mises à jour illisible : {}", e))
}

fn verifier() -> Result<(), String> {
    let d = device()?;
    let visees = relever(&d)?;
    let (bonnes, refus) = verifier_visees(&d.cle_plateforme, &visees);
    for r in &refus {
        eprintln!("refusée : {}", r);
    }
    if bonnes.is_empty() && refus.is_empty() {
        println!("aucune mise à jour publiée ; la chaîne répond");
    }
    for v in &bonnes {
        println!("{} {} visé, signature vérifiée{}", v.composant, v.version, match v.a_jour { Some(true) => " (à jour)", Some(false) => " (en retard)", None => "" });
    }
    if refus.is_empty() { Ok(()) } else { Err(format!("{} mise(s) à jour refusée(s)", refus.len())) }
}

fn telecharger(v: &Visee, dossier: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(dossier).map_err(|e| e.to_string())?;
    let cible = dossier.join(format!("iagent-{}_{}_amd64.deb", v.composant, v.version));
    if cible.exists() && empreinte_fichier(&cible).map_err(|e| e.to_string())? == v.empreinte {
        return Ok(cible);
    }
    let partiel = cible.with_extension("partiel");
    let rep = ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(600)).build().get(&v.url).call().map_err(|e| format!("téléchargement de {} : {}", v.composant, e))?;
    let mut f = fs::File::create(&partiel).map_err(|e| e.to_string())?;
    std::io::copy(&mut rep.into_reader().take(2 * 1024 * 1024 * 1024), &mut f).map_err(|e| e.to_string())?;
    let lue = empreinte_fichier(&partiel).map_err(|e| e.to_string())?;
    if lue != v.empreinte {
        let _ = fs::remove_file(&partiel);
        return Err(format!("{} {} : empreinte {} au lieu de {} ; paquet jeté", v.composant, v.version, &lue[..16], &v.empreinte[..16]));
    }
    fs::rename(&partiel, &cible).map_err(|e| e.to_string())?;
    Ok(cible)
}

fn sante() -> bool {
    std::thread::sleep(std::time::Duration::from_secs(20));
    SERVICES_SANTE.iter().all(|s| Command::new("systemctl").args(["is-active", "--quiet", s]).status().map(|st| st.success()).unwrap_or(false))
}

fn poser(deb: &Path) -> Result<(), String> {
    let st = Command::new("apt-get").args(["install", "-y", "--no-install-recommends", "--allow-downgrades"]).arg(deb).env("DEBIAN_FRONTEND", "noninteractive").status().map_err(|e| e.to_string())?;
    if st.success() { Ok(()) } else { Err(format!("apt-get install {} : code {:?}", deb.display(), st.code())) }
}

fn appliquer() -> Result<(), String> {
    let d = device()?;
    let visees = relever(&d)?;
    let (bonnes, refus) = verifier_visees(&d.cle_plateforme, &visees);
    for r in &refus {
        eprintln!("refusée : {}", r);
    }
    let courantes = installees();
    let a_faire = a_poser(&bonnes, &courantes);
    if a_faire.is_empty() {
        println!("rien à poser : {} composant(s) à jour", courantes.len());
        return Ok(());
    }
    let dossier = etat().join("paquets");
    for v in &a_faire {
        let deb = telecharger(v, &dossier)?;
        let precedent = courantes.get(&v.composant).map(|ver| dossier.join(format!("iagent-{}_{}_amd64.deb", v.composant, ver)));
        println!("pose de {} {} ({})", v.composant, v.version, deb.display());
        poser(&deb)?;
        if sante() {
            println!("{} {} posé, services en bonne santé", v.composant, v.version);
            let _ = fs::write(dossier.join(format!("courant-{}.json", v.composant)), json!({ "version": v.version, "deb": deb, "quand": chrono::Utc::now().to_rfc3339() }).to_string());
        } else {
            match precedent.filter(|p| p.exists()) {
                Some(p) => {
                    eprintln!("{} {} : services en échec après la pose, retour à {}", v.composant, v.version, p.display());
                    poser(&p)?;
                    return Err(format!("{} {} retiré : retour arrière effectué", v.composant, v.version));
                }
                None => return Err(format!("{} {} : services en échec après la pose et aucun paquet précédent gardé", v.composant, v.version)),
            }
        }
    }
    Ok(())
}

fn main() -> ExitCode {
    let issue = match std::env::args().nth(1).as_deref() {
        Some("verifier") => verifier(),
        Some("appliquer") => appliquer(),
        _ => Err("iagent-updater verifier | appliquer".to_string()),
    };
    match issue {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{}", e);
            ExitCode::from(1)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::Engine;

    fn visee(composant: &str, version: &str, paire: &ring::signature::Ed25519KeyPair) -> Visee {
        let empreinte = "a".repeat(64);
        let sig = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(paire.sign(identite::message_mise_a_jour(composant, version, &empreinte).as_bytes()).as_ref());
        Visee { composant: composant.into(), version: version.into(), url: "https://maj.iagent.agency/x.deb".into(), empreinte, signature: sig, actuelle: None, a_jour: None }
    }

    #[test]
    fn seules_les_visees_signees_par_la_plateforme_passent() {
        let (_, plateforme) = identite::nouvelle_paire().unwrap();
        let (_, autre) = identite::nouvelle_paire().unwrap();
        let pem = identite::cle_publique_pem(&plateforme);
        let bonne = visee("device", "0.2.0", &plateforme);
        let fausse = visee("device", "0.3.0", &autre);
        let mut clair = visee("desktop", "0.3.0", &plateforme);
        clair.url = "http://maj.iagent.agency/x.deb".into();
        let (bonnes, refus) = verifier_visees(&pem, &[bonne.clone(), fausse, clair]);
        assert_eq!(bonnes, vec![bonne]);
        assert_eq!(refus.len(), 2);
        assert!(refus[0].contains("signature") && refus[1].contains("en clair"));
    }

    #[test]
    fn on_ne_pose_que_ce_qui_monte_et_que_la_box_porte_deja() {
        let (_, p) = identite::nouvelle_paire().unwrap();
        let mut installees = std::collections::BTreeMap::new();
        installees.insert("device".to_string(), "0.1.0".to_string());
        installees.insert("desktop".to_string(), "0.2.0".to_string());
        let visees = vec![visee("device", "0.1.1", &p), visee("desktop", "0.2.0", &p), visee("skills", "9.0.0", &p), visee("watchdog", "0.1.0", &p), visee("device", "0.0.9", &p)];
        let a = a_poser(&visees, &installees);
        assert_eq!(a.iter().map(|v| format!("{} {}", v.composant, v.version)).collect::<Vec<_>>(), vec!["device 0.1.1"]);
    }

    #[test]
    fn les_versions_se_comparent_par_nombres() {
        use std::cmp::Ordering::*;
        assert_eq!(comparer_versions("0.10.0", "0.9.0"), Greater);
        assert_eq!(comparer_versions("1.0.0", "1.0.0-1"), Equal);
        assert_eq!(comparer_versions("0.2.0", "0.2.1"), Less);
    }

    #[test]
    fn l_empreinte_d_un_fichier_est_son_sha256() {
        let f = std::env::temp_dir().join(format!("iagent-updater-{}.bin", std::process::id()));
        fs::write(&f, b"abc").unwrap();
        assert_eq!(empreinte_fichier(&f).unwrap(), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        let _ = fs::remove_file(&f);
    }
}
