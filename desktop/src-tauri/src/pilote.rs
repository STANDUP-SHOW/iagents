//! L'agent aux commandes du navigateur du client.
//!
//! max, 16/10/2026 : « quand mes agents travaillent, je peux m'absenter toute
//! la journée ; les agents doivent continuer à travailler ». Le navigateur
//! intégré (`navigateur.rs`) ne faisait qu'ouvrir une page où le client se
//! connecte. Ce module y donne à l'agent ce qu'un opérateur humain fait :
//! lire la page (ses champs, ses boutons, ses messages d'erreur), cliquer,
//! taper, choisir, cocher, téléverser un fichier, aller à une adresse, et
//! vérifier le résultat.
//!
//! Le sens du pilotage ne s'inverse jamais : c'est l'application qui agit sur
//! la page, la page n'atteint rien de l'application.
//!   - la fenêtre `navigateur` reste absente de `capabilities/default.json` :
//!     un site visité n'appelle aucune commande ;
//!   - le code exécuté dans la page est fixe (`pilote.js`, compilé dans le
//!     binaire) ; ce que l'agent veut taper arrive en argument JSON, jamais
//!     collé dans le code ;
//!   - sous Windows, les clics et la frappe passent par le protocole DevTools
//!     de WebView2 appelé de l'intérieur (`CallDevToolsProtocolMethod`) : de
//!     vrais événements de souris et de clavier, comme un humain, et aucun
//!     port de débogage ouvert sur le poste, qu'un autre programme pourrait
//!     joindre pour prendre la main sur les sessions du client ;
//!   - un fichier ne se téléverse que depuis le dossier
//!     `Documents/iAgent/Televersements`, que le client remplit lui-même ;
//!   - LinkedIn reste hors d'atteinte (règle de max : jamais d'automatisme) ;
//!   - aucune autorisation de la page (micro, caméra) n'est accordée d'office.

use serde_json::{json, Value};
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::time::Duration;
use tauri::Url;

/// Le code qui tourne dans la page. Fixe, relu, compilé avec l'application.
pub const SCRIPT: &str = include_str!("pilote.js");
/// Au-delà, un fichier n'est pas un logo ni une bannière, et le faire passer
/// en base64 par la page la figerait.
const TELEVERSEMENT_MAX: u64 = 15 * 1024 * 1024;
const CHARGEMENT_MAX: Duration = Duration::from_secs(25);
const REPONSE_MAX: Duration = Duration::from_secs(20);

pub type Futur<'a, T> = Pin<Box<dyn Future<Output = Result<T, String>> + Send + 'a>>;

/// Ce dont le pilote a besoin d'une page. La vraie est la fenêtre du
/// navigateur ; les bancs en donnent une fausse.
pub trait Page: Send + Sync {
    /// Exécute une action de `pilote.js` et rend son résultat.
    fn script<'a>(&'a self, action: &'a str, args: Value) -> Futur<'a, Value>;
    /// Appelle une méthode du protocole DevTools. `Err` là où il n'existe pas
    /// (hors Windows) : le pilote se replie alors sur les événements de page.
    fn cdp<'a>(&'a self, methode: &'a str, params: Value) -> Futur<'a, Value>;
    /// Emmène la page à une adresse déjà vérifiée.
    fn naviguer(&self, url: Url) -> Result<(), String>;
}

/// Le texte complet envoyé à la page pour une action. Les arguments sont du
/// JSON produit par serde : un littéral, jamais du code. U+2028 et U+2029 sont
/// échappés parce que certains moteurs les lisent comme des fins de ligne.
pub fn code_de(action: &str, args: &Value) -> String {
    let echappe = |v: String| v.replace('\u{2028}', "\\u2028").replace('\u{2029}', "\\u2029");
    let action = echappe(serde_json::to_string(action).unwrap_or_else(|_| "\"\"".into()));
    let args = echappe(serde_json::to_string(args).unwrap_or_else(|_| "{}".into()));
    format!(
        "(function(){{try{{return JSON.stringify({{ok:({})({},{})}})}}catch(e){{return JSON.stringify({{erreur:String(e&&e.message||e)}})}}}})()",
        SCRIPT.trim().trim_end_matches(';'),
        action,
        args
    )
}

/// Ce que rend la page : du JSON, parfois emballé une seconde fois en chaîne
/// selon le moteur (WebView2 sérialise le résultat de `ExecuteScript`).
pub fn lire_reponse(brut: &str) -> Result<Value, String> {
    let mut v: Value = serde_json::from_str(brut).map_err(|_| "la page a rendu une réponse illisible".to_string())?;
    if let Value::String(s) = &v {
        v = serde_json::from_str(s).map_err(|_| "la page a rendu une réponse illisible".to_string())?;
    }
    if let Some(e) = v.get("erreur").and_then(Value::as_str) {
        return Err(e.to_string());
    }
    match v.get("ok") {
        Some(ok) => Ok(ok.clone()),
        // Le script n'a pas tourné : page vide, ou document qui se charge.
        None => Err("la page ne répond pas encore : attendez son chargement puis relisez-la".to_string()),
    }
}

/// Une adresse où l'agent peut aller : celle du navigateur, et pas LinkedIn.
pub fn adresse_permise(adresse: &str) -> Result<Url, String> {
    let url = crate::navigateur::adresse_valide(adresse)?;
    hote_permis(&url)?;
    Ok(url)
}

fn hote_permis(url: &Url) -> Result<(), String> {
    let hote = url.host_str().unwrap_or("").to_lowercase();
    for interdit in crate::mission::DOMAINES_INTERDITS {
        if hote == interdit || hote.ends_with(&format!(".{}", interdit)) {
            return Err(format!(
                "{} est hors d'atteinte des agents : sur ce site, c'est vous qui agissez",
                interdit
            ));
        }
    }
    Ok(())
}

/// Avant chaque geste : la page peut avoir redirigé ailleurs depuis la
/// dernière lecture.
async fn verifier_ou_on_est(page: &dyn Page) -> Result<(), String> {
    let etat = page.script("etat", json!({})).await?;
    if let Some(adresse) = etat.get("adresse").and_then(Value::as_str) {
        if let Ok(url) = Url::parse(adresse) {
            if matches!(url.scheme(), "http" | "https") {
                hote_permis(&url)?;
            }
        }
    }
    Ok(())
}

/// Attend que le document soit chargé, puis laisse aux scripts de la page le
/// temps de poser leurs champs.
pub async fn attendre_chargement(page: &dyn Page) -> Result<Value, String> {
    let debut = std::time::Instant::now();
    loop {
        match page.script("etat", json!({})).await {
            Ok(etat) if etat.get("pret").and_then(Value::as_str) == Some("complete") => {
                tokio::time::sleep(Duration::from_millis(700)).await;
                return Ok(etat);
            }
            _ if debut.elapsed() > CHARGEMENT_MAX => {
                return Err("la page ne finit pas de se charger".to_string())
            }
            _ => tokio::time::sleep(Duration::from_millis(300)).await,
        }
    }
}

pub async fn lire(page: &dyn Page) -> Result<Value, String> {
    page.script("lire", json!({})).await
}

pub async fn aller(page: &dyn Page, adresse: &str) -> Result<Value, String> {
    let url = adresse_permise(adresse)?;
    page.naviguer(url)?;
    // Laisse partir la navigation avant de demander l'état : sinon on lit
    // « complete » sur l'ancienne page.
    tokio::time::sleep(Duration::from_millis(400)).await;
    attendre_chargement(page).await
}

/// Un vrai clic de souris au centre de l'élément ; à défaut, `click()`.
pub async fn cliquer(page: &dyn Page, r#ref: u64, libelle: &str) -> Result<String, String> {
    verifier_ou_on_est(page).await?;
    let cible = page.script("cible", json!({ "ref": r#ref, "libelle": libelle })).await?;
    let (x, y) = (
        cible.get("x").and_then(Value::as_f64).unwrap_or(0.0),
        cible.get("y").and_then(Value::as_f64).unwrap_or(0.0),
    );
    let reel = async {
        for (genre, boutons) in [("mouseMoved", 0), ("mousePressed", 1), ("mouseReleased", 1)] {
            let mut p = json!({ "type": genre, "x": x, "y": y });
            if boutons == 1 {
                p["button"] = json!("left");
                p["clickCount"] = json!(1);
                p["buttons"] = json!(1);
            }
            page.cdp("Input.dispatchMouseEvent", p).await?;
        }
        Ok::<(), String>(())
    }
    .await;
    if reel.is_err() {
        page.script("cliquer", json!({ "ref": r#ref, "libelle": libelle })).await?;
    }
    let _ = attendre_chargement(page).await;
    Ok(format!("cliqué sur « {} »", libelle))
}

/// Une vraie frappe dans le champ ; à défaut, la valeur posée comme le ferait
/// la frappe. `secret` n'est vrai que pour un mot de passe tiré du coffre.
async fn taper(page: &dyn Page, r#ref: u64, libelle: &str, texte: &str, secret: bool) -> Result<(), String> {
    verifier_ou_on_est(page).await?;
    let args = json!({ "ref": r#ref, "libelle": libelle, "texte": texte, "secret": secret });
    page.script("focaliser", args.clone()).await?;
    match page.cdp("Input.insertText", json!({ "text": texte })).await {
        Ok(_) => {
            page.script("confirmer", args).await?;
        }
        Err(_) => {
            page.script("saisir", args).await?;
        }
    }
    Ok(())
}

pub async fn saisir(page: &dyn Page, r#ref: u64, libelle: &str, texte: &str) -> Result<String, String> {
    taper(page, r#ref, libelle, texte, false).await?;
    Ok(format!("saisi dans « {} »", libelle))
}

pub async fn choisir(page: &dyn Page, r#ref: u64, libelle: &str, option: &str) -> Result<String, String> {
    verifier_ou_on_est(page).await?;
    let r = page
        .script("choisir", json!({ "ref": r#ref, "libelle": libelle, "option": option }))
        .await?;
    Ok(format!(
        "choisi « {} » dans « {} »",
        r.get("choisi").and_then(Value::as_str).unwrap_or(option),
        libelle
    ))
}

pub async fn cocher(page: &dyn Page, r#ref: u64, libelle: &str, coche: bool) -> Result<String, String> {
    verifier_ou_on_est(page).await?;
    let r = page
        .script("cocher", json!({ "ref": r#ref, "libelle": libelle, "coche": coche }))
        .await?;
    let est = r.get("coche").and_then(Value::as_bool).unwrap_or(coche);
    Ok(format!("« {} » {}", libelle, if est { "coché" } else { "décoché" }))
}

pub async fn appuyer(page: &dyn Page, touche: &str) -> Result<String, String> {
    verifier_ou_on_est(page).await?;
    let (code, cle) = match touche {
        "Enter" => (13, "Enter"),
        "Tab" => (9, "Tab"),
        "Escape" => (27, "Escape"),
        autre => return Err(format!("touche non prise en charge : {} (Enter, Tab ou Escape)", autre)),
    };
    let reel = async {
        for genre in ["keyDown", "keyUp"] {
            let mut p = json!({ "type": genre, "key": cle, "code": cle, "windowsVirtualKeyCode": code, "nativeVirtualKeyCode": code });
            if genre == "keyDown" && cle == "Enter" {
                p["text"] = json!("\r");
            }
            page.cdp("Input.dispatchKeyEvent", p).await?;
        }
        Ok::<(), String>(())
    }
    .await;
    if reel.is_err() {
        page.script("appuyer", json!({ "touche": cle })).await?;
    }
    let _ = attendre_chargement(page).await;
    Ok(format!("touche {} appuyée", cle))
}

/// Le seul dossier d'où un fichier part vers un site.
pub fn dossier_televersements() -> Result<PathBuf, String> {
    let maison = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or("impossible de trouver le dossier personnel sur cet ordinateur")?;
    Ok(PathBuf::from(maison).join("Documents").join("iAgent").join("Televersements"))
}

/// Un nom de fichier relatif au dossier de téléversement, qui y reste.
pub fn fichier_permis(dossier: &Path, nom: &str) -> Result<PathBuf, String> {
    let nom = nom.trim();
    if nom.is_empty() {
        return Err("aucun fichier nommé".to_string());
    }
    let racine = dossier
        .canonicalize()
        .map_err(|_| format!("le dossier {} n'existe pas encore : déposez-y les fichiers à envoyer", dossier.display()))?;
    let chemin = racine
        .join(nom)
        .canonicalize()
        .map_err(|_| format!("« {} » n'est pas dans {}", nom, dossier.display()))?;
    if !chemin.starts_with(&racine) || !chemin.is_file() {
        return Err(format!("« {} » n'est pas un fichier de {}", nom, dossier.display()));
    }
    Ok(chemin)
}

fn type_de(chemin: &Path) -> &'static str {
    match chemin
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("pdf") => "application/pdf",
        Some("mp4") => "video/mp4",
        _ => "application/octet-stream",
    }
}

pub async fn televerser(page: &dyn Page, r#ref: u64, libelle: &str, noms: &[String]) -> Result<String, String> {
    use base64::Engine;
    verifier_ou_on_est(page).await?;
    let dossier = dossier_televersements()?;
    let mut fichiers = Vec::new();
    for nom in noms {
        let chemin = fichier_permis(&dossier, nom)?;
        let taille = std::fs::metadata(&chemin).map(|m| m.len()).unwrap_or(0);
        if taille > TELEVERSEMENT_MAX {
            return Err(format!("« {} » pèse plus de 15 Mo", nom));
        }
        let octets = std::fs::read(&chemin).map_err(|e| format!("lecture de « {} » : {}", nom, e))?;
        fichiers.push(json!({
            "nom": chemin.file_name().and_then(|n| n.to_str()).unwrap_or(nom),
            "type": type_de(&chemin),
            "base64": base64::engine::general_purpose::STANDARD.encode(octets),
        }));
    }
    let r = page
        .script("televerser", json!({ "ref": r#ref, "libelle": libelle, "fichiers": fichiers }))
        .await?;
    Ok(format!("joint à « {} » : {}", libelle, r.get("fichiers").cloned().unwrap_or(json!([]))))
}

/// Une capture de la page, pour vérifier à l'œil ce que la structure ne dit
/// pas (une image, un code à recopier). Windows seulement.
pub async fn capture(page: &dyn Page) -> Result<String, String> {
    let r = page
        .cdp("Page.captureScreenshot", json!({ "format": "jpeg", "quality": 60 }))
        .await
        .map_err(|_| "la capture d'écran n'est disponible que sous Windows".to_string())?;
    r.get("data")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "capture vide".to_string())
}

// ---------------------------------------------------------------------------
// Les mots de passe des comptes que l'agent crée
// ---------------------------------------------------------------------------

const SERVICE_COMPTES: &str = "iagent-comptes";

/// Un mot de passe tiré au hasard : 24 caractères, quatre familles. Il ne
/// passe jamais par le modèle ni par l'écran.
pub fn mot_de_passe_neuf() -> String {
    const MIN: &[u8] = b"abcdefghijkmnpqrstuvwxyz";
    const MAJ: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
    const CHI: &[u8] = b"23456789";
    const SYM: &[u8] = b"!#%+-=?@_";
    let mut alea: Vec<u8> = Vec::new();
    while alea.len() < 48 {
        alea.extend_from_slice(uuid::Uuid::new_v4().as_bytes());
    }
    let familles = [MIN, MAJ, CHI, SYM];
    (0..24)
        .map(|i| {
            // Les quatre premiers garantissent une lettre de chaque famille ;
            // ils sont répartis dans le mot par le tirage suivant.
            let famille = if i < 4 { familles[i] } else { familles[(alea[24 + i] % 4) as usize] };
            famille[alea[i] as usize % famille.len()] as char
        })
        .collect()
}

fn coffre_du_site(hote: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_COMPTES, hote).map_err(|e| format!("coffre du système indisponible : {}", e))
}

/// Tape le mot de passe du compte de ce site : celui du coffre s'il existe,
/// sinon un neuf, rangé avant d'être tapé.
pub async fn saisir_mot_de_passe(page: &dyn Page, r#ref: u64, libelle: &str) -> Result<String, String> {
    let etat = page.script("etat", json!({})).await?;
    let adresse = etat.get("adresse").and_then(Value::as_str).unwrap_or("");
    let url = adresse_permise(adresse)?;
    let hote = url.host_str().unwrap_or("").to_lowercase();
    let coffre = coffre_du_site(&hote)?;
    let (secret, neuf) = match coffre.get_password() {
        Ok(s) if !s.is_empty() => (s, false),
        _ => {
            let s = mot_de_passe_neuf();
            coffre
                .set_password(&s)
                .map_err(|e| format!("rangement du mot de passe : {}", e))?;
            (s, true)
        }
    };
    taper(page, r#ref, libelle, &secret, true).await?;
    Ok(if neuf {
        format!("mot de passe créé et saisi ; il est rangé dans le coffre du système sous « {} / {} »", SERVICE_COMPTES, hote)
    } else {
        format!("mot de passe du coffre saisi pour {}", hote)
    })
}

// ---------------------------------------------------------------------------
// La vraie page : la fenêtre du navigateur
// ---------------------------------------------------------------------------

pub struct Fenetre {
    pub app: tauri::AppHandle,
}

impl Fenetre {
    fn fenetre(&self) -> Result<tauri::WebviewWindow, String> {
        use tauri::Manager;
        self.app
            .get_webview_window(crate::navigateur::ETIQUETTE)
            .ok_or_else(|| "le navigateur est fermé".to_string())
    }
}

impl Page for Fenetre {
    fn script<'a>(&'a self, action: &'a str, args: Value) -> Futur<'a, Value> {
        Box::pin(async move {
            let fenetre = self.fenetre()?;
            let (tx, rx) = tokio::sync::oneshot::channel::<String>();
            let tx = std::sync::Mutex::new(Some(tx));
            fenetre
                .eval_with_callback(code_de(action, &args), move |brut| {
                    if let Some(tx) = tx.lock().ok().and_then(|mut t| t.take()) {
                        let _ = tx.send(brut);
                    }
                })
                .map_err(|e| format!("la page ne répond pas : {}", e))?;
            let brut = tokio::time::timeout(REPONSE_MAX, rx)
                .await
                .map_err(|_| "la page n'a pas répondu à temps".to_string())?
                .map_err(|_| "la page n'a pas répondu".to_string())?;
            lire_reponse(&brut)
        })
    }

    #[cfg(windows)]
    fn cdp<'a>(&'a self, methode: &'a str, params: Value) -> Futur<'a, Value> {
        Box::pin(async move {
            use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
            use windows::core::HSTRING;
            let fenetre = self.fenetre()?;
            let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
            let methode_w = methode.to_string();
            let params_w = params.to_string();
            fenetre
                .with_webview(move |w| {
                    let gestion = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                        move |hr: windows::core::Result<()>, json: String| {
                            let _ = tx.send(hr.map(|_| json).map_err(|e| e.message().to_string()));
                            Ok(())
                        },
                    ));
                    unsafe {
                        if let Ok(coeur) = w.controller().CoreWebView2() {
                            let _ = coeur.CallDevToolsProtocolMethod(
                                &HSTRING::from(methode_w.as_str()),
                                &HSTRING::from(params_w.as_str()),
                                &gestion,
                            );
                        }
                    }
                })
                .map_err(|e| format!("le navigateur ne répond pas : {}", e))?;
            let brut = tokio::time::timeout(REPONSE_MAX, rx)
                .await
                .map_err(|_| format!("{} : pas de réponse du navigateur", methode))?
                .map_err(|_| format!("{} : pas de réponse du navigateur", methode))??;
            serde_json::from_str(&brut).map_err(|_| format!("{} : réponse illisible", methode))
        })
    }

    #[cfg(not(windows))]
    fn cdp<'a>(&'a self, methode: &'a str, _params: Value) -> Futur<'a, Value> {
        Box::pin(async move { Err(format!("{} : le protocole DevTools n'existe que sous Windows (WebView2)", methode)) })
    }

    fn naviguer(&self, url: Url) -> Result<(), String> {
        crate::navigateur::ouvrir(&self.app, url, false).map(|_| ())
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Une page de banc : rend ce qu'on lui a dit, note ce qu'on lui demande.
    #[derive(Default)]
    pub struct FaussePage {
        pub adresse: Mutex<String>,
        pub appels: Mutex<Vec<String>>,
        pub cdp_dispo: bool,
        pub lecture: Mutex<Value>,
    }

    impl Page for FaussePage {
        fn script<'a>(&'a self, action: &'a str, args: Value) -> Futur<'a, Value> {
            Box::pin(async move {
                self.appels.lock().unwrap().push(format!("script:{}:{}", action, args));
                Ok(match action {
                    "etat" => json!({ "pret": "complete", "adresse": *self.adresse.lock().unwrap() }),
                    "lire" => self.lecture.lock().unwrap().clone(),
                    "cible" => json!({ "x": 10.0, "y": 20.0 }),
                    "choisir" => json!({ "choisi": args["option"] }),
                    "cocher" => json!({ "coche": args["coche"] }),
                    _ => json!({ "fait": true }),
                })
            })
        }
        fn cdp<'a>(&'a self, methode: &'a str, params: Value) -> Futur<'a, Value> {
            Box::pin(async move {
                self.appels.lock().unwrap().push(format!("cdp:{}:{}", methode, params));
                if self.cdp_dispo {
                    Ok(json!({}))
                } else {
                    Err("absent".into())
                }
            })
        }
        fn naviguer(&self, url: Url) -> Result<(), String> {
            *self.adresse.lock().unwrap() = url.to_string();
            self.appels.lock().unwrap().push(format!("aller:{}", url));
            Ok(())
        }
    }

    fn page(adresse: &str, cdp: bool) -> FaussePage {
        let p = FaussePage { cdp_dispo: cdp, ..Default::default() };
        *p.adresse.lock().unwrap() = adresse.to_string();
        p
    }

    #[test]
    fn les_arguments_ne_deviennent_jamais_du_code() {
        let piege = "\"});alert(1);({\u{2028}";
        let code = code_de("saisir", &json!({ "texte": piege }));
        // Le texte n'apparaît qu'échappé, dans un littéral JSON : chaque
        // guillemet qu'il porte est précédé d'une barre.
        assert_eq!(code.matches("\"});alert(1)").count(), code.matches("\\\"});alert(1)").count());
        assert!(code.contains("\\\"});alert(1);({\\u2028"));
        assert!(code.starts_with("(function(){try{return JSON.stringify({ok:(// "));
        assert!(code.ends_with(")(\"saisir\",{\"texte\":\"\\\"});alert(1);({\\u2028\"})})}catch(e){return JSON.stringify({erreur:String(e&&e.message||e)})}})()"));
    }

    #[test]
    fn une_reponse_se_lit_simple_ou_emballee() {
        assert_eq!(lire_reponse(r#"{"ok":{"fait":true}}"#).unwrap(), json!({ "fait": true }));
        assert_eq!(lire_reponse(r#""{\"ok\":3}""#).unwrap(), json!(3));
        assert_eq!(lire_reponse(r#"{"erreur":"la page a changé"}"#).unwrap_err(), "la page a changé");
        assert!(lire_reponse("null").is_err());
        assert!(lire_reponse("pas du json").is_err());
    }

    #[test]
    fn linkedin_reste_hors_d_atteinte() {
        assert!(adresse_permise("https://www.linkedin.com/company/x").is_err());
        assert!(adresse_permise("https://linkedin.com").is_err());
        assert!(adresse_permise("https://fr.linkedin.com/in/x").is_err());
        assert!(adresse_permise("https://notlinkedin.com").is_ok());
        assert!(adresse_permise("https://www.producthunt.com/").is_ok());
        assert!(adresse_permise("file:///etc/passwd").is_err());
        assert!(adresse_permise("javascript:alert(1)").is_err());
    }

    #[tokio::test]
    async fn sous_windows_le_clic_est_un_vrai_clic_de_souris() {
        let p = page("https://exemple.fr/inscription", true);
        cliquer(&p, 3, "Créer mon compte").await.unwrap();
        let appels = p.appels.lock().unwrap().join("\n");
        assert!(appels.contains("cdp:Input.dispatchMouseEvent:{\"type\":\"mouseMoved\",\"x\":10.0,\"y\":20.0}"));
        assert!(appels.contains("mousePressed"));
        assert!(appels.contains("mouseReleased"));
        assert!(!appels.contains("script:cliquer"));
    }

    #[tokio::test]
    async fn sans_protocole_le_clic_se_replie_sur_la_page() {
        let p = page("https://exemple.fr/", false);
        cliquer(&p, 3, "OK").await.unwrap();
        assert!(p.appels.lock().unwrap().iter().any(|a| a.starts_with("script:cliquer:")));
    }

    #[tokio::test]
    async fn la_frappe_reelle_puis_la_confirmation() {
        let p = page("https://exemple.fr/", true);
        saisir(&p, 1, "Nom de l'entreprise", "iAgent Tech").await.unwrap();
        let appels = p.appels.lock().unwrap().clone();
        let i = appels.iter().position(|a| a.starts_with("script:focaliser")).unwrap();
        assert!(appels[i + 1].starts_with("cdp:Input.insertText:{\"text\":\"iAgent Tech\"}"));
        assert!(appels[i + 2].starts_with("script:confirmer"));
    }

    #[tokio::test]
    async fn on_n_agit_pas_sur_une_page_qui_a_glisse_vers_linkedin() {
        let p = page("https://www.linkedin.com/feed/", true);
        assert!(cliquer(&p, 0, "Publier").await.is_err());
        assert!(saisir(&p, 0, "Message", "x").await.is_err());
        assert!(!p.appels.lock().unwrap().iter().any(|a| a.contains("Input.")));
    }

    #[tokio::test]
    async fn aller_verifie_l_adresse_avant_de_partir() {
        let p = page("https://exemple.fr/", true);
        assert!(aller(&p, "file:///C:/Windows").await.is_err());
        assert!(aller(&p, "https://linkedin.com").await.is_err());
        assert!(!p.appels.lock().unwrap().iter().any(|a| a.starts_with("aller:")));
        aller(&p, "https://www.producthunt.com/").await.unwrap();
        assert!(p.appels.lock().unwrap().iter().any(|a| a == "aller:https://www.producthunt.com/"));
    }

    #[test]
    fn un_fichier_ne_part_que_du_dossier_de_televersement() {
        let base = std::env::temp_dir().join(format!("iagent-tel-{}", uuid::Uuid::new_v4()));
        let dossier = base.join("Televersements");
        std::fs::create_dir_all(&dossier).unwrap();
        std::fs::write(dossier.join("logo.png"), b"x").unwrap();
        std::fs::write(base.join("secret.txt"), b"x").unwrap();
        assert!(fichier_permis(&dossier, "logo.png").is_ok());
        assert!(fichier_permis(&dossier, "../secret.txt").is_err());
        assert!(fichier_permis(&dossier, base.join("secret.txt").to_str().unwrap()).is_err());
        assert!(fichier_permis(&dossier, "absent.png").is_err());
        assert!(fichier_permis(&dossier, "").is_err());
        assert!(fichier_permis(&base.join("nulle-part"), "logo.png").is_err());
        let _ = std::fs::remove_dir_all(base);
    }

    #[test]
    fn un_mot_de_passe_neuf_est_long_varie_et_unique() {
        let a = mot_de_passe_neuf();
        let b = mot_de_passe_neuf();
        assert_eq!(a.chars().count(), 24);
        assert_ne!(a, b);
        assert!(a.chars().any(|c| c.is_ascii_lowercase()));
        assert!(a.chars().any(|c| c.is_ascii_uppercase()));
        assert!(a.chars().any(|c| c.is_ascii_digit()));
        assert!(a.chars().any(|c| "!#%+-=?@_".contains(c)));
    }
}
