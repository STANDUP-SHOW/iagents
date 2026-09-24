//! Mise à jour des postes sans rien demander au client.
//!
//! Quand une nouvelle version est publiée, le poste la trouve, la télécharge en
//! arrière-plan, vérifie sa signature, puis l'installe au premier moment calme :
//! aucune tâche ni réponse d'agent en cours, et aucune depuis deux minutes.
//! Un agent n'est jamais coupé au milieu d'un travail : pendant qu'il travaille,
//! la mise à jour attend ; pendant qu'elle s'installe, un nouveau travail est
//! refusé avec un motif lisible plutôt que perdu à mi-chemin.
//!
//! Où chercher et avec quelle clé vérifier ne sont pas écrits ici : ils entrent
//! dans la configuration au moment de construire une version signée
//! (`plugins.updater.endpoints` et `pubkey`, voir le flux du MSI). Une
//! construction sans eux, comme celle de chaque PR, ne cherche rien et le dit.

use serde::Serialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};
use tauri_plugin_updater::UpdaterExt;

/// Le premier regard attend que l'application ait fini de démarrer.
const PREMIER_REGARD: Duration = Duration::from_secs(60);
/// Ensuite, un regard toutes les quatre heures suffit : une version par jour
/// au plus, et un poste allumé en permanence la reçoit dans la demi-journée.
const INTERVALLE: Duration = Duration::from_secs(4 * 3600);
/// Un agent qui enchaîne ses tâches laisse des trous de quelques secondes entre
/// deux ; installer dans ce trou le couperait quand même au milieu de sa série.
const CALME: Duration = Duration::from_secs(120);
/// Tant que ce n'est pas calme, on revient voir toutes les trente secondes.
const REPRISE: Duration = Duration::from_secs(30);

/// Ce qui tourne sur le poste, du point de vue de la mise à jour.
#[derive(Debug, Default)]
pub struct Veille {
    en_cours: u32,
    derniere_fin: Option<Instant>,
    installation: bool,
}

impl Veille {
    /// Un travail commence. Refusé si l'installation a déjà la main : le
    /// processus va s'arrêter, et un travail commencé maintenant serait perdu.
    fn commencer(&mut self) -> Result<(), String> {
        if self.installation {
            return Err(
                "une mise a jour de l application s installe : recommencez dans une minute"
                    .to_string(),
            );
        }
        self.en_cours += 1;
        Ok(())
    }

    fn finir(&mut self, maintenant: Instant) {
        self.en_cours = self.en_cours.saturating_sub(1);
        self.derniere_fin = Some(maintenant);
    }

    /// Prend la main pour installer si rien ne tourne et que rien n'a tourné
    /// depuis `calme`. Tout se décide sous le même verrou que `commencer` :
    /// aucun travail ne peut se glisser entre la vérification et l'installation.
    fn prendre_la_main(&mut self, maintenant: Instant, calme: Duration) -> bool {
        let calme_atteint = match self.derniere_fin {
            Some(fin) => maintenant.saturating_duration_since(fin) >= calme,
            None => true,
        };
        if self.en_cours == 0 && calme_atteint {
            self.installation = true;
        }
        self.installation
    }

    fn rendre_la_main(&mut self) {
        self.installation = false;
    }
}

static VEILLE: Mutex<Veille> = Mutex::new(Veille {
    en_cours: 0,
    derniere_fin: None,
    installation: false,
});

/// Tenu tant qu'un agent travaille. À poser au début de toute commande qui
/// fait travailler un agent : `let _travail = mise_a_jour::travail()?;`
pub struct Travail;

pub fn travail() -> Result<Travail, String> {
    VEILLE.lock().unwrap_or_else(|e| e.into_inner()).commencer()?;
    Ok(Travail)
}

impl Drop for Travail {
    fn drop(&mut self) {
        VEILLE
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .finir(Instant::now());
    }
}

/// Ce que l'écran peut dire de la mise à jour.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Etat {
    pub version: String,
    /// La version téléchargée qui attend un moment calme, s'il y en a une.
    pub prete: Option<String>,
    pub message: String,
}

static ETAT: Mutex<Option<Etat>> = Mutex::new(None);

fn dire(version: &str, prete: Option<String>, message: impl Into<String>) {
    let etat = Etat {
        version: version.to_string(),
        prete,
        message: message.into(),
    };
    *ETAT.lock().unwrap_or_else(|e| e.into_inner()) = Some(etat);
}

#[tauri::command]
pub fn mise_a_jour_etat(app: AppHandle) -> Etat {
    ETAT.lock()
        .unwrap_or_else(|e| e.into_inner())
        .clone()
        .unwrap_or(Etat {
            version: app.package_info().version.to_string(),
            prete: None,
            message: String::new(),
        })
}

/// Où chercher, lu dans `plugins.updater` de la configuration embarquée.
/// `None` quand la construction n'a reçu ni adresse ni clé publique : une
/// clé vide ferait échouer chaque vérification, mieux vaut ne rien chercher.
pub fn configuree(updater: Option<&serde_json::Value>) -> bool {
    let Some(updater) = updater else { return false };
    let cle = updater.get("pubkey").and_then(|v| v.as_str()).unwrap_or("");
    let adresses = updater
        .get("endpoints")
        .and_then(|v| v.as_array())
        .map(|a| a.iter().filter_map(|e| e.as_str()).any(|e| !e.trim().is_empty()))
        .unwrap_or(false);
    !cle.trim().is_empty() && adresses
}

/// Lance la veille en arrière-plan. Ne bloque jamais le démarrage.
pub fn demarrer<R: Runtime>(app: &AppHandle<R>) {
    let version = app.package_info().version.to_string();
    if cfg!(debug_assertions) {
        dire(&version, None, "mises a jour automatiques eteintes en developpement");
        return;
    }
    if !configuree(app.config().plugins.0.get("updater")) {
        dire(
            &version,
            None,
            "mises a jour automatiques non configurees dans cette version",
        );
        return;
    }
    dire(&version, None, "a jour");
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(PREMIER_REGARD).await;
        loop {
            if let Err(motif) = une_ronde(&app, &version).await {
                // Pas de réseau, serveur absent : on retente à la ronde
                // suivante, sans rien montrer d'alarmant au client.
                dire(&version, None, format!("derniere verification echouee : {motif}"));
            }
            tokio::time::sleep(INTERVALLE).await;
        }
    });
}

async fn une_ronde<R: Runtime>(app: &AppHandle<R>, version: &str) -> Result<(), String> {
    let updater = app
        .updater_builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;
    let Some(mise_a_jour) = updater.check().await.map_err(|e| e.to_string())? else {
        dire(version, None, "a jour");
        return Ok(());
    };
    let nouvelle = mise_a_jour.version.clone();
    dire(version, None, format!("telechargement de la version {nouvelle}"));
    // La signature est vérifiée ici, avant qu'un seul octet ne s'installe.
    let octets = mise_a_jour
        .download(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    loop {
        let main = VEILLE
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .prendre_la_main(Instant::now(), CALME);
        if main {
            break;
        }
        dire(
            version,
            Some(nouvelle.clone()),
            format!("version {nouvelle} prete : elle s'installera quand les agents auront fini"),
        );
        tokio::time::sleep(REPRISE).await;
    }

    dire(version, Some(nouvelle.clone()), format!("installation de la version {nouvelle}"));
    // Sous Windows, l'installeur prend le relais, ferme l'application et la
    // relance sur la nouvelle version : cet appel ne revient pas s'il réussit.
    match mise_a_jour.install(&octets) {
        Ok(()) => app.restart(),
        Err(e) => {
            VEILLE.lock().unwrap_or_else(|e| e.into_inner()).rendre_la_main();
            Err(e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn rien_ne_tourne_la_mise_a_jour_prend_la_main() {
        let mut v = Veille::default();
        assert!(v.prendre_la_main(Instant::now(), CALME));
    }

    #[test]
    fn un_agent_au_travail_n_est_jamais_coupe() {
        let mut v = Veille::default();
        v.commencer().unwrap();
        let loin = Instant::now() + Duration::from_secs(3600);
        assert!(!v.prendre_la_main(loin, CALME));
    }

    #[test]
    fn entre_deux_taches_la_mise_a_jour_attend_le_calme() {
        let mut v = Veille::default();
        let t0 = Instant::now();
        v.commencer().unwrap();
        v.finir(t0);
        assert!(!v.prendre_la_main(t0 + Duration::from_secs(10), CALME));
        assert!(v.prendre_la_main(t0 + CALME, CALME));
    }

    #[test]
    fn pendant_l_installation_un_nouveau_travail_est_refuse_avec_son_motif() {
        let mut v = Veille::default();
        assert!(v.prendre_la_main(Instant::now(), CALME));
        let motif = v.commencer().unwrap_err();
        assert!(motif.contains("mise a jour"));
        v.rendre_la_main();
        assert!(v.commencer().is_ok());
    }

    #[test]
    fn deux_travaux_en_parallele_il_faut_que_les_deux_finissent() {
        let mut v = Veille::default();
        let t0 = Instant::now();
        v.commencer().unwrap();
        v.commencer().unwrap();
        v.finir(t0);
        assert!(!v.prendre_la_main(t0 + CALME, CALME));
        v.finir(t0);
        assert!(v.prendre_la_main(t0 + CALME, CALME));
    }

    #[test]
    fn sans_cle_ou_sans_adresse_on_ne_cherche_rien() {
        assert!(!configuree(None));
        assert!(!configuree(Some(&json!({ "pubkey": "", "endpoints": [] }))));
        assert!(!configuree(Some(&json!({ "pubkey": "cle", "endpoints": [""] }))));
        assert!(!configuree(Some(&json!({ "pubkey": " ", "endpoints": ["https://a/b.json"] }))));
        assert!(configuree(Some(&json!({ "pubkey": "cle", "endpoints": ["https://a/b.json"] }))));
    }
}
