//! La santé de la Box pour `POST /controle/box/telemetrie` (brief §15) : CPU,
//! mémoire, disque, température en pourcents et degrés, versions des services
//! d'après dpkg, et les alertes laissées par le watchdog. Les calculs sont
//! purs ; la lecture demande la machine.

use std::fs;
use std::process::Command;

use serde_json::{json, Map, Value};

use crate::inventaire::semver_depuis_dpkg;
use crate::plateforme::Chemins;

pub struct Mesure {
    pub cpu: Option<f64>,
    pub memoire: Option<f64>,
    pub disque: Option<f64>,
    pub temperature: Option<f64>,
    pub version_desktop: String,
    pub versions: Map<String, Value>,
    pub alertes: Vec<Value>,
}

impl Mesure {
    pub fn corps(&self) -> Value {
        let mut c = json!({ "version_desktop": self.version_desktop, "versions": self.versions });
        if let Some(v) = self.cpu { c["cpu"] = json!(v); }
        if let Some(v) = self.memoire { c["memoire"] = json!(v); }
        if let Some(v) = self.disque { c["disque"] = json!(v); }
        if let Some(v) = self.temperature { c["temperature"] = json!(v); }
        c
    }
}

/// 1-minute load as a share of the cores, in percent, bounded to [0, 100].
pub fn cpu_depuis_loadavg(loadavg: &str, coeurs: u32) -> Option<f64> {
    let charge: f64 = loadavg.split_whitespace().next()?.parse().ok()?;
    Some((charge / coeurs.max(1) as f64 * 100.0).clamp(0.0, 100.0).round())
}

/// Used memory in percent from MemTotal and MemAvailable.
pub fn memoire_depuis_meminfo(texte: &str) -> Option<f64> {
    let lire = |cle: &str| texte.lines().find_map(|l| l.strip_prefix(cle)).and_then(|v| v.trim().trim_end_matches("kB").trim().parse::<f64>().ok());
    let total = lire("MemTotal:")?;
    let dispo = lire("MemAvailable:")?;
    if total <= 0.0 {
        return None;
    }
    Some(((total - dispo) / total * 100.0).clamp(0.0, 100.0).round())
}

/// `df --output=pcent <chemin>` : "Use%\n 34%".
pub fn disque_depuis_df(sortie: &str) -> Option<f64> {
    sortie.lines().last()?.trim().trim_end_matches('%').parse::<f64>().ok().map(|v| v.clamp(0.0, 100.0))
}

/// The hottest thermal zone, in °C, from the millidegree files of /sys/class/thermal.
pub fn temperature_depuis_zones(millidegres: &[i64]) -> Option<f64> {
    millidegres.iter().max().map(|m| (*m as f64 / 1000.0).clamp(-40.0, 130.0).round())
}

/// `dpkg-query -W -f='${binary:Package} ${Version}\n' <paquets>` → {service: semver}, Debian revision dropped, unknown versions skipped.
pub fn versions_depuis_dpkg(sortie: &str) -> Map<String, Value> {
    let mut m = Map::new();
    for ligne in sortie.lines() {
        let Some((paquet, version)) = ligne.trim().split_once(' ') else { continue };
        let service = paquet.strip_prefix("iagent-").unwrap_or(paquet);
        if let Some(v) = semver_depuis_dpkg(version) {
            m.insert(service.to_string(), Value::String(v));
        }
    }
    m
}

pub fn mesurer(chemins: &Chemins) -> Mesure {
    let coeurs = std::thread::available_parallelism().map(|n| n.get() as u32).unwrap_or(1);
    let commande = |prog: &str, args: &[&str]| Command::new(prog).args(args).output().ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).to_string());
    let zones: Vec<i64> = fs::read_dir("/sys/class/thermal")
        .map(|d| d.flatten().filter(|e| e.file_name().to_string_lossy().starts_with("thermal_zone")).filter_map(|e| fs::read_to_string(e.path().join("temp")).ok()).filter_map(|t| t.trim().parse::<i64>().ok()).collect())
        .unwrap_or_default();
    let versions = commande("dpkg-query", &["-W", "-f=${binary:Package} ${Version}\n", "iagent-device", "iagent-updater", "iagent-watchdog", "iagent-desktop"]).map(|s| versions_depuis_dpkg(&s)).unwrap_or_default();
    let version_desktop = versions.get("desktop").and_then(Value::as_str).unwrap_or("0.0.0").to_string();
    let alertes: Vec<Value> = fs::read_to_string(chemins.etat.join("alertes.json")).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    Mesure {
        cpu: fs::read_to_string("/proc/loadavg").ok().and_then(|l| cpu_depuis_loadavg(&l, coeurs)),
        memoire: fs::read_to_string("/proc/meminfo").ok().and_then(|m| memoire_depuis_meminfo(&m)),
        disque: commande("df", &["--output=pcent", &chemins.etat.to_string_lossy()]).and_then(|s| disque_depuis_df(&s)),
        temperature: temperature_depuis_zones(&zones),
        version_desktop,
        versions,
        alertes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn les_mesures_se_calculent_depuis_les_fichiers_du_systeme() {
        assert_eq!(cpu_depuis_loadavg("1.00 0.50 0.25 1/300 4567", 8), Some(13.0));
        assert_eq!(cpu_depuis_loadavg("40.0 1 1", 8), Some(100.0));
        assert_eq!(memoire_depuis_meminfo("MemTotal:       65711196 kB\nMemFree:  1 kB\nMemAvailable:   25627366 kB\n"), Some(61.0));
        assert_eq!(disque_depuis_df("Use%\n 34%\n"), Some(34.0));
        assert_eq!(temperature_depuis_zones(&[42000, 58000, 51000]), Some(58.0));
        assert_eq!(temperature_depuis_zones(&[]), None);
    }

    #[test]
    fn les_versions_dpkg_deviennent_des_semver_par_service() {
        let v = versions_depuis_dpkg("iagent-device 0.1.0-1\niagent-desktop 0.2.0\niagent-watchdog pas-une-version\n");
        assert_eq!(v.get("device").and_then(Value::as_str), Some("0.1.0"));
        assert_eq!(v.get("desktop").and_then(Value::as_str), Some("0.2.0"));
        assert!(v.get("watchdog").is_none());
    }

    #[test]
    fn le_corps_ne_porte_que_les_mesures_presentes() {
        let m = Mesure { cpu: Some(12.0), memoire: None, disque: Some(40.0), temperature: None, version_desktop: "0.2.0".into(), versions: Map::new(), alertes: vec![] };
        let c = m.corps();
        assert_eq!(c["cpu"], 12.0);
        assert!(c.get("memoire").is_none());
        assert_eq!(c["version_desktop"], "0.2.0");
    }
}
