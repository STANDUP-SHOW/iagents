//! Parler à la plateforme (MASTER §6, brief §13-§15) : l'identité sur disque, les
//! fichiers du contrat (CONTRAT.md), et chaque appel signé. Rien d'autre dans
//! ce binaire ne touche le réseau.

use std::fs;
use std::path::{Path, PathBuf};

use iagent_identite_box as identite;
use ring::signature::Ed25519KeyPair;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::inventaire::InventaireBox;
use crate::sante::Mesure;

#[derive(Debug)]
pub enum Erreur {
    Usage(String),
    Fichier(String),
    Reseau(String),
    /// A refusal of the platform: its French message, verbatim.
    Plateforme(u16, String),
}

impl Erreur {
    pub fn code(&self) -> u8 {
        match self {
            Erreur::Usage(_) | Erreur::Fichier(_) => 2,
            Erreur::Reseau(_) => 3,
            Erreur::Plateforme(..) => 1,
        }
    }
}

impl std::fmt::Display for Erreur {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Erreur::Usage(m) | Erreur::Fichier(m) | Erreur::Reseau(m) => write!(f, "{}", m),
            Erreur::Plateforme(statut, m) => write!(f, "La plateforme refuse ({}) : {}", statut, m),
        }
    }
}

/// Where the Box keeps its state and its settings; the environment moves them for the benches.
pub struct Chemins {
    pub etat: PathBuf,
    pub conf: PathBuf,
}

impl Chemins {
    pub fn depuis_environnement() -> Chemins {
        Chemins {
            etat: PathBuf::from(std::env::var("IAGENT_ETAT").unwrap_or_else(|_| "/var/lib/iagent".to_string())),
            conf: PathBuf::from(std::env::var("IAGENT_CONF").unwrap_or_else(|_| "/etc/iagent".to_string())),
        }
    }
}

/// Writes `.partiel` then renames, so a half-written file never passes for the real one (same rule as telechargement.rs).
pub fn ecrire_atomique(chemin: &Path, octets: &[u8], mode: u32) -> Result<(), Erreur> {
    let dossier = chemin.parent().ok_or_else(|| Erreur::Fichier(format!("{} : pas de dossier", chemin.display())))?;
    fs::create_dir_all(dossier).map_err(|e| Erreur::Fichier(format!("{} : {}", dossier.display(), e)))?;
    let partiel = chemin.with_extension("partiel");
    fs::write(&partiel, octets).map_err(|e| Erreur::Fichier(format!("{} : {}", partiel.display(), e)))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&partiel, fs::Permissions::from_mode(mode));
    }
    #[cfg(not(unix))]
    let _ = mode;
    fs::rename(&partiel, chemin).map_err(|e| Erreur::Fichier(format!("{} : {}", chemin.display(), e)))
}

pub fn horodatage() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

// ---------------------------------------------------------------------------
// Identity on disk
// ---------------------------------------------------------------------------

pub struct Identite {
    pub paire: Ed25519KeyPair,
    pub chiffrement: [u8; 32],
}

#[derive(Serialize)]
pub struct IdentitePublique {
    pub device_id: String,
    pub identite_publique: String,
    pub cle_chiffrement_publique: String,
}

impl Identite {
    fn fichiers(chemins: &Chemins) -> (PathBuf, PathBuf) {
        let d = chemins.etat.join("identite");
        (d.join("ed25519.pkcs8"), d.join("x25519.secret"))
    }

    pub fn charger(chemins: &Chemins) -> Result<Identite, Erreur> {
        let (f_ed, f_x) = Self::fichiers(chemins);
        let pkcs8 = fs::read(&f_ed).map_err(|_| Erreur::Fichier(format!("Aucune identité en {} : lancez `iagent-device identite`.", f_ed.display())))?;
        let x = fs::read(&f_x).map_err(|_| Erreur::Fichier(format!("Clé de chiffrement absente en {}.", f_x.display())))?;
        let mut chiffrement = [0u8; 32];
        if x.len() != 32 {
            return Err(Erreur::Fichier("La clé de chiffrement ne fait pas 32 octets.".to_string()));
        }
        chiffrement.copy_from_slice(&x);
        Ok(Identite { paire: identite::paire_depuis_pkcs8(&pkcs8).map_err(Erreur::Fichier)?, chiffrement })
    }

    /// Created once, on the first call; never regenerated: the platform knows this key.
    pub fn charger_ou_creer(chemins: &Chemins) -> Result<Identite, Erreur> {
        if let Ok(i) = Self::charger(chemins) {
            return Ok(i);
        }
        let (f_ed, f_x) = Self::fichiers(chemins);
        if f_ed.exists() != f_x.exists() {
            return Err(Erreur::Fichier("Identité à moitié présente : l'une des deux clés manque. Rien n'est régénéré d'office (la plateforme connaît cette Box).".to_string()));
        }
        let (pkcs8, paire) = identite::nouvelle_paire().map_err(Erreur::Fichier)?;
        let chiffrement = identite::nouvelle_cle_chiffrement().map_err(Erreur::Fichier)?;
        ecrire_atomique(&f_ed, &pkcs8, 0o600)?;
        ecrire_atomique(&f_x, &chiffrement, 0o600)?;
        Ok(Identite { paire, chiffrement })
    }

    pub fn device_id(&self) -> String {
        identite::device_id(&self.paire)
    }

    pub fn publique(&self) -> IdentitePublique {
        IdentitePublique {
            device_id: self.device_id(),
            identite_publique: identite::cle_publique_pem(&self.paire),
            cle_chiffrement_publique: identite::cle_chiffrement_publique(&self.chiffrement),
        }
    }
}

impl From<String> for Erreur {
    fn from(m: String) -> Erreur {
        Erreur::Fichier(m)
    }
}
impl From<&str> for Erreur {
    fn from(m: &str) -> Erreur {
        Erreur::Fichier(m.to_string())
    }
}

// ---------------------------------------------------------------------------
// Files of the contract
// ---------------------------------------------------------------------------

/// /etc/iagent/device.json : what links this Box to its platform. Nothing secret.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub plateforme: String,
    pub cle_plateforme: String,
    pub device_id: String,
    pub reference: String,
    pub serial: String,
    pub gamme: String,
    pub profil_materiel: String,
    pub lot: Option<String>,
    pub enrolee_le: String,
}

impl Device {
    pub fn chemin(chemins: &Chemins) -> PathBuf {
        chemins.conf.join("device.json")
    }
    pub fn lire(chemins: &Chemins) -> Result<Device, Erreur> {
        let c = Self::chemin(chemins);
        let t = fs::read_to_string(&c).map_err(|_| Erreur::Fichier(format!("Cette Box n'est pas enrôlée ({} absent) : lancez `iagent-device enroler`.", c.display())))?;
        serde_json::from_str(&t).map_err(|e| Erreur::Fichier(format!("{} illisible : {}", c.display(), e)))
    }
    pub fn ecrire(&self, chemins: &Chemins) -> Result<(), Erreur> {
        ecrire_atomique(&Self::chemin(chemins), serde_json::to_string_pretty(self).expect("json").as_bytes(), 0o644)
    }
}

/// /etc/iagent/usine.json : the seed the ISO carried (operator, lot, platform, factory token).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Graine {
    pub operateur: Option<String>,
    pub lot: Option<String>,
    pub plateforme: Option<String>,
    pub jeton: Option<String>,
}

impl Graine {
    pub fn lire(chemins: &Chemins) -> Result<Graine, Erreur> {
        let c = chemins.conf.join("usine.json");
        match fs::read_to_string(&c) {
            Ok(t) => serde_json::from_str(&t).map_err(|e| Erreur::Fichier(format!("{} illisible : {}", c.display(), e))),
            Err(_) => Ok(Graine::default()),
        }
    }
    /// The factory token has served: it leaves the disk, the rest of the seed stays (operator, lot, platform).
    pub fn oublier_le_jeton(&self, chemins: &Chemins) -> Result<(), Erreur> {
        let c = chemins.conf.join("usine.json");
        if !c.exists() {
            return Ok(());
        }
        let sans = Graine { jeton: None, ..self.clone() };
        ecrire_atomique(&c, serde_json::to_string_pretty(&sans).expect("json").as_bytes(), 0o600)
    }
}

/// /opt/iagent/manifeste.json : installer version, build id, commit (box/usine/iso/manifeste.ts).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Installateur {
    pub version: String,
    pub build_id: String,
    pub commit: String,
}
#[derive(Debug, Clone, Deserialize)]
pub struct Manifeste {
    pub installateur: Installateur,
}
impl Manifeste {
    pub fn lire(_chemins: &Chemins) -> Result<Manifeste, Erreur> {
        let c = PathBuf::from(std::env::var("IAGENT_MANIFESTE").unwrap_or_else(|_| "/opt/iagent/manifeste.json".to_string()));
        let t = fs::read_to_string(&c).map_err(|_| Erreur::Fichier(format!("Manifeste de l'installateur absent ({}).", c.display())))?;
        serde_json::from_str(&t).map_err(|e| Erreur::Fichier(format!("{} illisible : {}", c.display(), e)))
    }
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

fn adresse_recevable(adresse: &str) -> Result<String, Erreur> {
    let a = adresse.trim().trim_end_matches('/');
    if !a.starts_with("https://") && !a.starts_with("http://127.0.0.1") && !a.starts_with("http://localhost") && !a.starts_with("http://10.0.2.2") {
        return Err(Erreur::Usage("L'adresse de la plateforme doit être en https (ou la boucle locale / l'hôte QEMU pour les bancs).".to_string()));
    }
    Ok(a.to_string())
}

fn lire_reponse(r: Result<ureq::Response, ureq::Error>) -> Result<Value, Erreur> {
    match r {
        Ok(rep) => rep.into_json::<Value>().map_err(|e| Erreur::Reseau(format!("Réponse illisible : {}", e))),
        Err(ureq::Error::Status(code, rep)) => {
            let corps: Value = rep.into_json().unwrap_or(Value::Null);
            Err(Erreur::Plateforme(code, corps["erreur"].as_str().unwrap_or("(sans message)").to_string()))
        }
        Err(ureq::Error::Transport(t)) => Err(Erreur::Reseau(format!("Plateforme injoignable : {}", t))),
    }
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(20)).user_agent("iagent-device").build()
}

/// A signed Box request: the three headers of http.ts, the body as sent.
fn signe(device: &Device, id: &Identite, methode: &str, chemin: &str, corps: Option<&str>) -> Result<Value, Erreur> {
    let adresse = adresse_recevable(&device.plateforme)?;
    let h = horodatage();
    let ent = identite::en_tetes(&id.paire, &device.device_id, methode, chemin, &h, corps.unwrap_or(""));
    let req = agent().request(methode, &format!("{}{}", adresse, chemin)).set("x-box-id", &ent.box_id).set("x-horodatage", &ent.horodatage).set("x-signature", &ent.signature);
    lire_reponse(match corps {
        Some(c) => req.set("content-type", "application/json").send_string(c),
        None => req.call(),
    })
}

pub fn cle_publique_plateforme(adresse: &str) -> Result<String, Erreur> {
    let a = adresse_recevable(adresse)?;
    let v = lire_reponse(agent().get(&format!("{}/controle/cle-publique", a)).call())?;
    v["cle_publique"].as_str().map(str::to_string).ok_or_else(|| Erreur::Reseau("La plateforme ne rend pas sa clé publique.".to_string()))
}

pub fn enroler(adresse: &str, jeton: &str, id: &Identite, profil_materiel: &str, inv: &InventaireBox, manifeste: &Manifeste, operateur: &str) -> Result<Value, Erreur> {
    let a = adresse_recevable(adresse)?;
    let pub_ = id.publique();
    let corps = json!({
        "serial": inv.serial_machine, "gamme": inv.gamme_supposee(profil_materiel), "os": inv.os,
        "version_desktop": inv.version_desktop.clone().unwrap_or_else(|| "0.0.0".to_string()),
        "identite_publique": pub_.identite_publique, "cle_chiffrement_publique": pub_.cle_chiffrement_publique,
        "profil_materiel": profil_materiel, "inventaire": inv, "installateur": manifeste.installateur, "operateur": operateur,
    });
    lire_reponse(agent().post(&format!("{}/controle/usine/enroler", a)).set("x-jeton-usine", jeton).set("content-type", "application/json").send_string(&corps.to_string()))
}

pub fn telemetrie(device: &Device, id: &Identite, m: &Mesure) -> Result<Value, Erreur> {
    signe(device, id, "POST", "/controle/box/telemetrie", Some(&m.corps().to_string()))
}

pub fn deposer_rapport(device: &Device, id: &Identite, rapport_json: &str) -> Result<Value, Erreur> {
    // Sent as read: the platform re-derives the verdict, so the bytes of the report are what the operator saw.
    let v: Value = serde_json::from_str(rapport_json).map_err(|e| Erreur::Fichier(format!("Le rapport n'est pas du JSON : {}", e)))?;
    signe(device, id, "POST", "/controle/box/usine/rapport", Some(&v.to_string()))
}

pub fn mises_a_jour(device: &Device, id: &Identite) -> Result<Value, Erreur> {
    signe(device, id, "GET", "/controle/box/mises-a-jour", None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn l_identite_se_cree_une_fois_et_se_relit() {
        let d = std::env::temp_dir().join(format!("iagent-device-test-{}", std::process::id()));
        let chemins = Chemins { etat: d.join("etat"), conf: d.join("conf") };
        let a = Identite::charger_ou_creer(&chemins).unwrap();
        let b = Identite::charger_ou_creer(&chemins).unwrap();
        assert_eq!(a.device_id(), b.device_id());
        assert_eq!(a.publique().cle_chiffrement_publique, b.publique().cle_chiffrement_publique);
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn la_graine_oublie_le_jeton_et_garde_le_reste() {
        let d = std::env::temp_dir().join(format!("iagent-device-graine-{}", std::process::id()));
        let chemins = Chemins { etat: d.join("etat"), conf: d.join("conf") };
        let g = Graine { operateur: Some("Léa".into()), lot: Some("L1".into()), plateforme: Some("https://p".into()), jeton: Some("UF-secret".into()) };
        ecrire_atomique(&chemins.conf.join("usine.json"), serde_json::to_string(&g).unwrap().as_bytes(), 0o600).unwrap();
        g.oublier_le_jeton(&chemins).unwrap();
        let relue = Graine::lire(&chemins).unwrap();
        assert_eq!(relue.jeton, None);
        assert_eq!(relue.operateur.as_deref(), Some("Léa"));
        assert!(!fs::read_to_string(chemins.conf.join("usine.json")).unwrap().contains("UF-secret"));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn une_adresse_en_clair_est_refusee_hors_boucle_locale() {
        assert!(adresse_recevable("http://plateforme.exemple.fr").is_err());
        assert_eq!(adresse_recevable("https://plateforme.exemple.fr/").unwrap(), "https://plateforme.exemple.fr");
        assert!(adresse_recevable("http://127.0.0.1:8787").is_ok());
    }
}
