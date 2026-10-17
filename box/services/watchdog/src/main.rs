//! iagent-watchdog : la surveillance des services de la Box (brief §30).
//!
//! systemd relance déjà un service qui tombe (Restart= dans chaque unité). Ce
//! qu'il ne fait pas, c'est compter : trois échecs du même service en dix
//! minutes veulent dire que la relance ne soigne rien, et quelqu'un doit le
//! savoir. Le watchdog lit `systemctl show` toutes les trente secondes pour les
//! services actifs du profil, garde une fenêtre glissante par service, et écrit
//! une alerte dans /var/lib/iagent/alertes.json, que iagent-device porte dans sa
//! télémétrie. Il ne relance rien lui-même : systemd s'en charge, et deux
//! mains sur le même service se gêneraient. La règle de comptage est pure et
//! éprouvée ; la lecture de systemctl demande la machine.

use std::collections::{BTreeMap, VecDeque};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use serde_json::{json, Value};

const PERIODE: Duration = Duration::from_secs(30);
const FENETRE_S: i64 = 600;
const SEUIL: usize = 3;

#[derive(Debug, Clone, PartialEq)]
pub struct Observation {
    pub quand_s: i64,
    pub relances: u64,
    pub actif: bool,
}

/// One service's sliding window of restarts: an alert when `SEUIL` new restarts (or failures) fall inside `FENETRE_S`.
#[derive(Debug, Default)]
pub struct Fenetre {
    derniere_relance: Option<u64>,
    echecs: VecDeque<i64>,
    alerte_emise: bool,
}

impl Fenetre {
    /// Feeds an observation; returns true the moment the threshold is crossed (once per streak).
    pub fn observer(&mut self, o: &Observation) -> bool {
        if let Some(d) = self.derniere_relance {
            for _ in d..o.relances {
                self.echecs.push_back(o.quand_s);
            }
        }
        self.derniere_relance = Some(o.relances);
        if !o.actif {
            if self.echecs.back() != Some(&o.quand_s) {
                self.echecs.push_back(o.quand_s);
            }
        }
        while let Some(t) = self.echecs.front() {
            if o.quand_s - *t > FENETRE_S { self.echecs.pop_front(); } else { break; }
        }
        if self.echecs.len() >= SEUIL {
            if !self.alerte_emise {
                self.alerte_emise = true;
                return true;
            }
        } else if o.actif && self.echecs.is_empty() {
            self.alerte_emise = false;
        }
        false
    }
}

/// Parses `systemctl show -p NRestarts,ActiveState <unit>`.
pub fn lire_show(sortie: &str, quand_s: i64) -> Option<Observation> {
    let mut relances = None;
    let mut actif = None;
    for l in sortie.lines() {
        if let Some(v) = l.strip_prefix("NRestarts=") { relances = v.trim().parse().ok(); }
        if let Some(v) = l.strip_prefix("ActiveState=") { actif = Some(v.trim() == "active"); }
    }
    Some(Observation { quand_s, relances: relances?, actif: actif? })
}

fn services_du_profil() -> Vec<String> {
    let conf = PathBuf::from(std::env::var("IAGENT_CONF").unwrap_or_else(|_| "/etc/iagent".to_string()));
    let profils = PathBuf::from(std::env::var("IAGENT_PROFILS").unwrap_or_else(|_| "/opt/iagent/profils".to_string()));
    let profil = fs::read_to_string(conf.join("profil")).map(|s| s.trim().to_string()).unwrap_or_else(|_| "business".to_string());
    fs::read_to_string(profils.join(format!("{}.json", profil)))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|p| p["services_actifs"].as_array().map(|a| a.iter().filter_map(|s| s.as_str().map(str::to_string)).filter(|s| s != "iagent-watchdog" && s != "iagent-commander").collect()))
        .unwrap_or_else(|| vec!["iagent-device".to_string()])
}

fn alerter(service: &str, fenetre: &Fenetre) {
    let etat = PathBuf::from(std::env::var("IAGENT_ETAT").unwrap_or_else(|_| "/var/lib/iagent".to_string()));
    let f = etat.join("alertes.json");
    let mut alertes: Vec<Value> = fs::read_to_string(&f).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    alertes.push(json!({ "quand": chrono::Utc::now().to_rfc3339(), "service": service, "echecs_10_min": fenetre.echecs.len(), "motif": "trois échecs en dix minutes : la relance par systemd ne suffit pas" }));
    let _ = fs::create_dir_all(&etat);
    let _ = fs::write(&f, serde_json::to_string_pretty(&alertes).unwrap_or_default());
    // SyslogIdentifier=device in the unit; the word « security » lets `journalctl -g security` find it as the convention asks.
    eprintln!("ALERTE security : {} a échoué {} fois en dix minutes ; alerte écrite dans {}", service, fenetre.echecs.len(), f.display());
}

fn main() {
    let mut fenetres: BTreeMap<String, Fenetre> = BTreeMap::new();
    loop {
        let quand_s = chrono::Utc::now().timestamp();
        for service in services_du_profil() {
            let sortie = Command::new("systemctl").args(["show", "-p", "NRestarts,ActiveState", &format!("{}.service", service)]).output().ok().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default();
            let Some(o) = lire_show(&sortie, quand_s) else { continue };
            let f = fenetres.entry(service.clone()).or_default();
            if f.observer(&o) {
                alerter(&service, f);
            }
        }
        std::thread::sleep(PERIODE);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn obs(t: i64, relances: u64, actif: bool) -> Observation {
        Observation { quand_s: t, relances, actif }
    }

    #[test]
    fn trois_relances_en_dix_minutes_font_une_alerte_une_seule_fois() {
        let mut f = Fenetre::default();
        assert!(!f.observer(&obs(0, 0, true)));
        assert!(!f.observer(&obs(30, 1, true)));
        assert!(!f.observer(&obs(60, 2, true)));
        assert!(f.observer(&obs(90, 3, true)), "troisième relance : alerte");
        assert!(!f.observer(&obs(120, 4, true)), "pas de seconde alerte pour la même série");
    }

    #[test]
    fn des_relances_espacees_de_plus_de_dix_minutes_ne_s_additionnent_pas() {
        let mut f = Fenetre::default();
        f.observer(&obs(0, 0, true));
        f.observer(&obs(100, 1, true));
        f.observer(&obs(800, 2, true));
        assert!(!f.observer(&obs(1500, 3, true)));
    }

    #[test]
    fn un_service_tombe_sans_relance_compte_aussi_puis_se_remet() {
        let mut f = Fenetre::default();
        f.observer(&obs(0, 0, true));
        assert!(!f.observer(&obs(30, 0, false)));
        assert!(!f.observer(&obs(60, 0, false)));
        assert!(f.observer(&obs(90, 0, false)));
        // Back for more than the window: the streak resets and a new one can alert again.
        assert!(!f.observer(&obs(800, 0, true)));
        assert!(!f.observer(&obs(830, 1, true)));
        assert!(!f.observer(&obs(860, 2, true)));
        assert!(f.observer(&obs(890, 3, true)));
    }

    #[test]
    fn systemctl_show_se_lit() {
        let o = lire_show("NRestarts=2\nActiveState=active\n", 10).unwrap();
        assert_eq!(o, obs(10, 2, true));
        assert_eq!(lire_show("ActiveState=failed\n", 10), None);
    }
}
