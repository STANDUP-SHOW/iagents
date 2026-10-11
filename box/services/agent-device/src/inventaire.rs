//! Le relevé de la machine (brief §6, §13) : ce que `InventaireBox` de
//! plateforme/modele.ts attend, lu dans /proc, /sys, dmidecode, lsblk et ip.
//! Chaque lecture est séparée de son analyse : les analyseurs sont des
//! fonctions pures éprouvées sur des relevés figés, la lecture ne l'est pas
//! (elle demande la machine).

use std::collections::BTreeMap;
use std::fs;
use std::process::Command;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Disque {
    pub modele: String,
    pub capacite_go: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Mac {
    pub eth0: Option<String>,
    pub eth1: Option<String>,
    pub wifi: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Bios {
    pub fournisseur: String,
    pub version: String,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Tpm {
    pub present: bool,
    pub version: Option<String>,
}

/// `InventaireBox` of plateforme/modele.ts, plus what the enrolment needs beside it (serial, os, desktop version), skipped when serialised into the inventory.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InventaireBox {
    pub cpu: String,
    pub coeurs: u32,
    pub memoire_go: f64,
    pub disque: Disque,
    pub mac: Mac,
    pub bios: Bios,
    pub tpm: Tpm,
    pub uefi: bool,
    pub secure_boot: Option<bool>,
    pub releve_le: String,
    #[serde(skip)]
    pub serial_machine: String,
    #[serde(skip)]
    pub os: String,
    #[serde(skip)]
    pub version_desktop: Option<String>,
}

impl InventaireBox {
    /// The gamme is not a hardware fact: the ISO was built for one profile (/etc/iagent/profil); the hardware profile only has to serve it.
    pub fn gamme_supposee(&self, _profil_materiel: &str) -> String {
        fs::read_to_string(std::env::var("IAGENT_CONF").map(|c| format!("{}/profil", c)).unwrap_or_else(|_| "/etc/iagent/profil".to_string()))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|_| "business".to_string())
    }
}

fn commande(prog: &str, args: &[&str]) -> Option<String> {
    Command::new(prog).args(args).output().ok().filter(|o| o.status.success()).map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

// --- pure parsers -----------------------------------------------------------------

/// Model name and physical cores from /proc/cpuinfo: cores are distinct (physical id, core id) pairs, processors when the file has none.
pub fn cpu_depuis_cpuinfo(texte: &str) -> (String, u32) {
    let mut modele = String::new();
    let mut physique = String::new();
    let mut coeurs = std::collections::BTreeSet::new();
    let mut processeurs = 0u32;
    for ligne in texte.lines() {
        let Some((cle, val)) = ligne.split_once(':') else { continue };
        let (cle, val) = (cle.trim(), val.trim());
        match cle {
            "model name" if modele.is_empty() => modele = val.to_string(),
            "processor" => processeurs += 1,
            "physical id" => physique = val.to_string(),
            "core id" => {
                coeurs.insert(format!("{}:{}", physique, val));
            }
            _ => {}
        }
    }
    (modele, if coeurs.is_empty() { processeurs } else { coeurs.len() as u32 })
}

/// MemTotal of /proc/meminfo in GiB, one decimal.
pub fn memoire_depuis_meminfo(texte: &str) -> f64 {
    texte.lines().find_map(|l| l.strip_prefix("MemTotal:")).and_then(|v| v.trim().trim_end_matches("kB").trim().parse::<f64>().ok()).map(|ko| (ko / 1024.0 / 1024.0 * 10.0).round() / 10.0).unwrap_or(0.0)
}

/// The largest disk of `lsblk -J -b -d -o NAME,MODEL,SIZE,TYPE,TRAN`: model and size in GB (10^9, as sold).
pub fn disque_depuis_lsblk(json: &Value) -> Disque {
    let mut meilleur = Disque { modele: "inconnu".to_string(), capacite_go: 0.0 };
    for d in json["blockdevices"].as_array().into_iter().flatten() {
        if d["type"].as_str() != Some("disk") || d["tran"].as_str() == Some("usb") {
            continue;
        }
        let taille = d["size"].as_f64().or_else(|| d["size"].as_str().and_then(|s| s.parse().ok())).unwrap_or(0.0) / 1e9;
        if taille > meilleur.capacite_go {
            meilleur = Disque { modele: d["model"].as_str().unwrap_or("inconnu").trim().to_string(), capacite_go: (taille * 10.0).round() / 10.0 };
        }
    }
    meilleur
}

/// MACs of `ip -j link`: wired ports in name order (en*, eth*), the first wireless (wl*). Lowercase, as the platform stores them.
pub fn mac_depuis_ip(json: &Value) -> Mac {
    let mut filaires: BTreeMap<String, String> = BTreeMap::new();
    let mut wifi = None;
    for l in json.as_array().into_iter().flatten() {
        let (Some(nom), Some(mac)) = (l["ifname"].as_str(), l["address"].as_str()) else { continue };
        if l["link_type"].as_str() != Some("ether") || mac == "00:00:00:00:00:00" {
            continue;
        }
        if nom.starts_with("wl") {
            wifi.get_or_insert(mac.to_lowercase());
        } else if nom.starts_with("en") || nom.starts_with("eth") {
            filaires.insert(nom.to_string(), mac.to_lowercase());
        }
    }
    let mut it = filaires.into_values();
    Mac { eth0: it.next(), eth1: it.next(), wifi }
}

/// `mokutil --sb-state` : "SecureBoot enabled" / "SecureBoot disabled" ; None when the tool cannot tell.
pub fn secure_boot_depuis_mokutil(sortie: Option<&str>) -> Option<bool> {
    let s = sortie?.to_lowercase();
    if s.contains("enabled") {
        Some(true)
    } else if s.contains("disabled") {
        Some(false)
    } else {
        None
    }
}

/// Version of a dpkg package as semver: "0.2.0-1" → "0.2.0" (the Debian revision is not part of the software version).
pub fn semver_depuis_dpkg(version: &str) -> Option<String> {
    let v = version.trim().split_once('-').map(|(a, _)| a).unwrap_or(version.trim());
    let v = v.split_once(':').map(|(_, b)| b).unwrap_or(v);
    let ok = v.split('.').count() == 3 && v.split('.').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()));
    ok.then(|| v.to_string())
}

// --- the reading --------------------------------------------------------------------

pub fn relever() -> InventaireBox {
    let (cpu, coeurs) = cpu_depuis_cpuinfo(&fs::read_to_string("/proc/cpuinfo").unwrap_or_default());
    let memoire_go = memoire_depuis_meminfo(&fs::read_to_string("/proc/meminfo").unwrap_or_default());
    let lsblk = commande("lsblk", &["-J", "-b", "-d", "-o", "NAME,MODEL,SIZE,TYPE,TRAN"]).and_then(|s| serde_json::from_str::<Value>(&s).ok()).unwrap_or(Value::Null);
    let ip = commande("ip", &["-j", "link"]).and_then(|s| serde_json::from_str::<Value>(&s).ok()).unwrap_or(Value::Null);
    let dmi = |cle: &str| commande("dmidecode", &["-s", cle]).filter(|s| !s.is_empty());
    let tpm_present = std::path::Path::new("/sys/class/tpm/tpm0").exists();
    let tpm_version = fs::read_to_string("/sys/class/tpm/tpm0/tpm_version_major").ok().map(|v| if v.trim() == "2" { "2.0".to_string() } else { format!("{}.x", v.trim()) });
    let os = fs::read_to_string("/etc/os-release")
        .ok()
        .and_then(|t| t.lines().find_map(|l| l.strip_prefix("PRETTY_NAME=").map(|v| v.trim_matches('"').to_string())))
        .unwrap_or_else(|| "Linux".to_string());
    InventaireBox {
        cpu: if cpu.is_empty() { "inconnu".to_string() } else { cpu },
        coeurs: coeurs.max(1),
        memoire_go: if memoire_go > 0.0 { memoire_go } else { 1.0 },
        disque: disque_depuis_lsblk(&lsblk),
        mac: mac_depuis_ip(&ip),
        bios: Bios { fournisseur: dmi("bios-vendor").unwrap_or_else(|| "inconnu".to_string()), version: dmi("bios-version").unwrap_or_else(|| "inconnue".to_string()), date: dmi("bios-release-date") },
        tpm: Tpm { present: tpm_present, version: if tpm_present { tpm_version } else { None } },
        uefi: std::path::Path::new("/sys/firmware/efi").exists(),
        secure_boot: secure_boot_depuis_mokutil(commande("mokutil", &["--sb-state"]).as_deref()),
        releve_le: crate::plateforme::horodatage(),
        serial_machine: dmi("system-serial-number").filter(|s| !s.eq_ignore_ascii_case("to be filled by o.e.m.") && !s.eq_ignore_ascii_case("default string")).unwrap_or_else(|| format!("SANS-SERIE-{}", &crate::plateforme::horodatage()[..10])),
        os,
        version_desktop: commande("dpkg-query", &["-W", "-f=${Version}", "iagent-desktop"]).and_then(|v| semver_depuis_dpkg(&v)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cpuinfo_rend_le_modele_et_les_coeurs_physiques() {
        let texte = "processor\t: 0\nmodel name\t: AMD Ryzen 7 7840HS w/ Radeon 780M Graphics\nphysical id\t: 0\ncore id\t: 0\n\nprocessor\t: 1\nmodel name\t: AMD Ryzen 7 7840HS w/ Radeon 780M Graphics\nphysical id\t: 0\ncore id\t: 0\n\nprocessor\t: 2\nmodel name\t: AMD Ryzen 7 7840HS\nphysical id\t: 0\ncore id\t: 1\n";
        assert_eq!(cpu_depuis_cpuinfo(texte), ("AMD Ryzen 7 7840HS w/ Radeon 780M Graphics".to_string(), 2));
        assert_eq!(cpu_depuis_cpuinfo("processor\t: 0\nmodel name\t: QEMU Virtual CPU\n\nprocessor\t: 1\nmodel name\t: QEMU Virtual CPU\n"), ("QEMU Virtual CPU".to_string(), 2));
    }

    #[test]
    fn meminfo_en_gio_une_decimale() {
        assert_eq!(memoire_depuis_meminfo("MemTotal:       65711196 kB\nMemFree: 1 kB\n"), 62.7);
        assert_eq!(memoire_depuis_meminfo("MemTotal:        8130100 kB\n"), 7.8);
        assert_eq!(memoire_depuis_meminfo(""), 0.0);
    }

    #[test]
    fn lsblk_prend_le_plus_grand_disque_interne() {
        let j = json!({"blockdevices": [
            {"name": "sda", "model": "USB Flash", "size": 32000000000u64, "type": "disk", "tran": "usb"},
            {"name": "nvme0n1", "model": "Samsung SSD 980 PRO 1TB", "size": 1000204886016u64, "type": "disk", "tran": "nvme"},
            {"name": "sr0", "model": "DVD", "size": 1000, "type": "rom", "tran": "sata"}
        ]});
        assert_eq!(disque_depuis_lsblk(&j), Disque { modele: "Samsung SSD 980 PRO 1TB".to_string(), capacite_go: 1000.2 });
    }

    #[test]
    fn ip_link_range_les_mac_filaires_puis_le_wifi() {
        let j = json!([
            {"ifname": "lo", "link_type": "loopback", "address": "00:00:00:00:00:00"},
            {"ifname": "enp2s0", "link_type": "ether", "address": "A8:B1:C2:D3:E4:F6"},
            {"ifname": "wlp3s0", "link_type": "ether", "address": "A8:B1:C2:D3:E4:F7"},
            {"ifname": "enp1s0", "link_type": "ether", "address": "A8:B1:C2:D3:E4:F5"}
        ]);
        assert_eq!(mac_depuis_ip(&j), Mac { eth0: Some("a8:b1:c2:d3:e4:f5".into()), eth1: Some("a8:b1:c2:d3:e4:f6".into()), wifi: Some("a8:b1:c2:d3:e4:f7".into()) });
        assert_eq!(mac_depuis_ip(&json!([{"ifname": "eth0", "link_type": "ether", "address": "52:54:00:12:34:56"}])), Mac { eth0: Some("52:54:00:12:34:56".into()), eth1: None, wifi: None });
    }

    #[test]
    fn mokutil_et_dpkg_se_lisent() {
        assert_eq!(secure_boot_depuis_mokutil(Some("SecureBoot enabled")), Some(true));
        assert_eq!(secure_boot_depuis_mokutil(Some("SecureBoot disabled")), Some(false));
        assert_eq!(secure_boot_depuis_mokutil(Some("EFI variables are not supported")), None);
        assert_eq!(secure_boot_depuis_mokutil(None), None);
        assert_eq!(semver_depuis_dpkg("0.2.0-1"), Some("0.2.0".into()));
        assert_eq!(semver_depuis_dpkg("1:0.1.0"), Some("0.1.0".into()));
        assert_eq!(semver_depuis_dpkg("0.2"), None);
    }
}
