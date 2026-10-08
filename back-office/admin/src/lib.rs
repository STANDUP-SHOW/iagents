//! Calls to the iAgent platform on behalf of the back-office (MASTER §15).
//!
//! Three rules live here and nowhere else on the Rust side:
//! - the admin token lives in the system keyring; it is set once, never
//!   returned to the interface, never written in an error or a log;
//! - only the routes of `back-office/src/routes.json` can be called (the same
//!   table the screens read; the bench checks each one is `admin` or `public`
//!   in docs/master/routes.md), so the token cannot be sent anywhere else;
//! - a platform answer `{ "erreur": "<phrase>" }` comes back as that exact
//!   sentence, never as a success (`temoins/reponses.json`, played by the JS
//!   bench too).
//!
//! No Tauri here: the back-office app and the Desktop Commander both wrap these
//! functions in their own commands.

use serde::Serialize;
use serde_json::Value;
use std::path::Path;

const TABLE_DES_ROUTES: &str = include_str!("../../src/routes.json");
const SERVICE_TROUSSEAU: &str = "iagent-back-office";
const ENTREE_TROUSSEAU: &str = "jeton-admin";
/// The platform refuses to start with a shorter secret (plateforme/serveur.ts).
const LONGUEUR_MIN_JETON: usize = 24;

/// What the interface receives when a call fails. `plateforme` is false when
/// nothing left this machine (no token, bad address, undeclared route).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ErreurAppel {
    pub erreur: String,
    pub statut: u16,
    pub plateforme: bool,
}

impl ErreurAppel {
    fn locale(message: impl Into<String>) -> Self {
        ErreurAppel { erreur: message.into(), statut: 0, plateforme: false }
    }
    fn plateforme(message: impl Into<String>, statut: u16) -> Self {
        ErreurAppel { erreur: message.into(), statut, plateforme: true }
    }
}

// ---- routes ---------------------------------------------------------------

fn table() -> Value {
    serde_json::from_str(TABLE_DES_ROUTES).expect("routes.json is read at build time and must stay valid JSON")
}

/// Is `methode chemin` the route `nom` of routes.json, with plain parameters?
pub fn route_permise(nom: &str, methode: &str, chemin: &str) -> Result<(), ErreurAppel> {
    let t = table();
    let route = t["routes"].get(nom).ok_or_else(|| ErreurAppel::locale(format!("Route inconnue du back-office : {nom}.")))?;
    let attendue = route["methode"].as_str().unwrap_or("");
    let modele = route["chemin"].as_str().unwrap_or("");
    if methode != attendue {
        return Err(ErreurAppel::locale(format!("La route {nom} se joint en {attendue}, pas en {methode}.")));
    }
    let (chemin_seul, requete) = match chemin.split_once('?') {
        Some((c, q)) => (c, Some(q)),
        None => (chemin, None),
    };
    let a: Vec<&str> = modele.split('/').filter(|s| !s.is_empty()).collect();
    let b: Vec<&str> = chemin_seul.split('/').filter(|s| !s.is_empty()).collect();
    let refus = || ErreurAppel::locale(format!("Le chemin {chemin_seul} ne correspond pas à la route {nom} ({modele})."));
    if a.len() != b.len() || !chemin_seul.starts_with('/') || chemin_seul.contains("//") {
        return Err(refus());
    }
    for (m, c) in a.iter().zip(b.iter()) {
        if m.starts_with(':') {
            // A parameter is one encoded segment: never `..`, never a raw separator.
            if c.is_empty() || *c == "." || *c == ".." || c.contains(['?', '#', '\\']) {
                return Err(refus());
            }
        } else if m != c {
            return Err(refus());
        }
    }
    if let Some(q) = requete {
        for paire in q.split('&') {
            let cle = paire.split('=').next().unwrap_or("");
            if cle.is_empty() || !cle.chars().all(|ch| ch.is_ascii_lowercase() || ch == '_') {
                return Err(ErreurAppel::locale(format!("Paramètre de requête refusé : « {cle} ».")));
            }
        }
    }
    Ok(())
}

// ---- address --------------------------------------------------------------

/// https, or plain http on this machine only; no user, no query, no path.
/// The token travels in every request: in clear it would be read on the way.
pub fn adresse_recevable(adresse: &str) -> Result<String, String> {
    let propre = adresse.trim().trim_end_matches('/').to_string();
    let refus = || {
        "L'adresse doit commencer par https:// (ou http://127.0.0.1 pour une plateforme sur ce poste), sans identifiant ni paramètre : le jeton ne part jamais en clair.".to_string()
    };
    if propre.is_empty() {
        return Err("Saisissez l'adresse de la plateforme.".to_string());
    }
    let (schema, reste) = propre.split_once("://").ok_or_else(refus)?;
    let hote_valide = |h: &str| !h.is_empty() && h.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':');
    match schema {
        "https" if hote_valide(reste) => Ok(propre),
        "http" => {
            let (hote, port) = match reste.split_once(':') {
                Some((h, p)) => (h, Some(p)),
                None => (reste, None),
            };
            let port_ok = port.map_or(true, |p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()));
            if (hote == "127.0.0.1" || hote == "localhost") && port_ok { Ok(propre) } else { Err(refus()) }
        }
        _ => Err(refus()),
    }
}

/// The platform address is a setting, not a secret: a small file in the
/// app's configuration folder.
pub fn adresse_lire(dossier: &Path) -> String {
    std::fs::read_to_string(dossier.join("reglages.json"))
        .ok()
        .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        .and_then(|v| v["adresse"].as_str().map(str::to_string))
        .unwrap_or_default()
}

pub fn adresse_poser(dossier: &Path, adresse: &str) -> Result<String, String> {
    let propre = adresse_recevable(adresse)?;
    std::fs::create_dir_all(dossier).map_err(|e| format!("Le dossier des réglages ne peut pas être créé : {e}"))?;
    let partiel = dossier.join("reglages.json.partiel");
    std::fs::write(&partiel, serde_json::json!({ "adresse": propre }).to_string())
        .map_err(|e| format!("Les réglages ne peuvent pas être écrits : {e}"))?;
    std::fs::rename(&partiel, dossier.join("reglages.json")).map_err(|e| format!("Les réglages ne peuvent pas être écrits : {e}"))?;
    Ok(propre)
}

// ---- token ----------------------------------------------------------------

fn trousseau() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, ENTREE_TROUSSEAU).map_err(|e| format!("Le trousseau du système est indisponible : {e}"))
}

/// What counts as a token, before opening the keyring. Never echoes it.
pub fn jeton_recevable(jeton: &str) -> Result<String, String> {
    let j = jeton.trim();
    if j.is_empty() {
        return Err("Saisissez le jeton du back-office.".to_string());
    }
    if j.chars().any(char::is_whitespace) {
        return Err("Le jeton ne contient pas d'espace : vérifiez le copier-coller.".to_string());
    }
    if j.chars().count() < LONGUEUR_MIN_JETON {
        return Err(format!("Ce jeton est trop court : celui de la plateforme compte au moins {LONGUEUR_MIN_JETON} caractères."));
    }
    Ok(j.to_string())
}

pub fn jeton_poser(jeton: &str) -> Result<String, String> {
    let j = jeton_recevable(jeton)?;
    trousseau()?.set_password(&j).map_err(|e| format!("Le jeton n'a pas pu être rangé dans le trousseau : {e}"))?;
    Ok("Jeton rangé dans le trousseau de cet ordinateur.".to_string())
}

pub fn jeton_present() -> bool {
    jeton_lire().is_some()
}

pub fn jeton_oublier() -> Result<String, String> {
    match trousseau()?.delete_credential() {
        Ok(()) => Ok("Jeton retiré de cet ordinateur.".to_string()),
        Err(keyring::Error::NoEntry) => Ok("Aucun jeton n'était rangé.".to_string()),
        Err(e) => Err(format!("Le jeton n'a pas pu être retiré du trousseau : {e}")),
    }
}

/// Private on purpose: the token never leaves this crate.
fn jeton_lire() -> Option<String> {
    trousseau().ok()?.get_password().ok().map(|j| j.trim().to_string()).filter(|j| !j.is_empty())
}

// ---- answers --------------------------------------------------------------

/// Reads a platform answer (mirrors `interpreter` in src/api.js).
pub fn interpreter(statut: u16, texte: &str, methode: &str, chemin: &str) -> Result<Value, ErreurAppel> {
    let json: Option<Value> = if texte.is_empty() { Some(Value::Null) } else { serde_json::from_str(texte).ok() };
    if let Some(Value::Object(o)) = &json {
        if let Some(Value::String(phrase)) = o.get("erreur") {
            return Err(ErreurAppel::plateforme(phrase.clone(), statut));
        }
    }
    if !(200..300).contains(&statut) {
        return Err(ErreurAppel::plateforme(format!("La plateforme a répondu {statut} sans phrase d'erreur lisible ({methode} {chemin})."), statut));
    }
    json.ok_or_else(|| {
        ErreurAppel::plateforme(
            format!("La plateforme a répondu à {methode} {chemin}, mais pas en JSON : l'adresse vise sans doute autre chose que la plateforme."),
            statut,
        )
    })
}

/// One call: declared route, valid address, token from the keyring.
pub async fn appeler(adresse: &str, nom: &str, methode: &str, chemin: &str, corps: Option<Value>) -> Result<Value, ErreurAppel> {
    let jeton = jeton_lire().ok_or_else(|| ErreurAppel::locale("Aucun jeton du back-office n'est rangé sur cet ordinateur : rien n'a été envoyé."))?;
    appeler_avec(adresse, &jeton, nom, methode, chemin, corps).await
}

async fn appeler_avec(adresse: &str, jeton: &str, nom: &str, methode: &str, chemin: &str, corps: Option<Value>) -> Result<Value, ErreurAppel> {
    route_permise(nom, methode, chemin)?;
    let base = adresse_recevable(adresse).map_err(ErreurAppel::locale)?;
    let hote = base.split_once("://").map(|(_, h)| h.to_string()).unwrap_or_default();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| ErreurAppel::locale(format!("Le client réseau ne démarre pas : {e}")))?;
    let m = reqwest::Method::from_bytes(methode.as_bytes()).map_err(|_| ErreurAppel::locale(format!("Méthode refusée : {methode}.")))?;
    let mut requete = client.request(m, format!("{base}{chemin}")).bearer_auth(jeton).header("accept", "application/json");
    if methode != "GET" {
        requete = requete.json(&corps.unwrap_or_else(|| serde_json::json!({})));
    }
    // A network error names the host only: the request (and its header) is never echoed.
    let reponse = requete.send().await.map_err(|e| {
        let raison = if e.is_timeout() { "délai dépassé" } else if e.is_connect() { "connexion impossible" } else { "échec réseau" };
        ErreurAppel::plateforme(format!("La plateforme ne répond pas sur {hote} ({raison}). Vérifiez l'adresse dans les réglages."), 0)
    })?;
    let statut = reponse.status().as_u16();
    let texte = reponse.text().await.unwrap_or_default();
    interpreter(statut, &texte, methode, chemin.split('?').next().unwrap_or(chemin))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn les_adresses_se_jugent_comme_le_temoin() {
        let t: Value = serde_json::from_str(include_str!("../../temoins/adresses.json")).unwrap();
        let cas = t["cas"].as_array().unwrap();
        assert!(cas.len() >= 10);
        for c in cas {
            let a = c["adresse"].as_str().unwrap();
            assert_eq!(adresse_recevable(a).is_ok(), c["desktop"].as_bool().unwrap(), "adresse « {a} »");
        }
    }

    #[test]
    fn les_reponses_se_lisent_comme_le_temoin() {
        let t: Value = serde_json::from_str(include_str!("../../temoins/reponses.json")).unwrap();
        for c in t["cas"].as_array().unwrap() {
            let r = interpreter(c["statut"].as_u64().unwrap() as u16, c["texte"].as_str().unwrap(), "GET", "/controle/boxes");
            let attendu = c["erreur"].as_str();
            match (r, attendu) {
                (Ok(_), None) => {}
                (Err(e), Some(phrase)) => {
                    assert_eq!(e.erreur, phrase);
                    assert!(e.plateforme);
                }
                (r, a) => panic!("{} : {:?} au lieu de {:?}", c["texte"], r, a),
            }
        }
    }

    #[test]
    fn seules_les_routes_declarees_passent() {
        assert!(route_permise("boxes", "GET", "/controle/boxes").is_ok());
        assert!(route_permise("box", "GET", "/controle/boxes/BOX-1").is_ok());
        assert!(route_permise("entitlements", "GET", "/controle/entitlements?tenant_id=tn-1").is_ok());
        assert!(route_permise("revueSkill", "POST", "/controle/skills/SP-1/revue").is_ok());
        // A box route, an undeclared name, the wrong method, a traversal, an extra segment.
        assert!(route_permise("boxDroits", "GET", "/controle/box/droits").is_err());
        assert!(route_permise("boxes", "GET", "/controle/box/droits").is_err());
        assert!(route_permise("boxes", "POST", "/controle/boxes/x").is_err());
        assert!(route_permise("box", "GET", "/controle/boxes/..").is_err());
        assert!(route_permise("box", "GET", "/controle/boxes/a/b").is_err());
        assert!(route_permise("boxes", "GET", "/controle/boxes?Cle=1").is_err());
        assert!(!TABLE_DES_ROUTES.contains("/box/"), "routes.json ne doit porter aucune route box");
    }

    #[test]
    fn un_jeton_trop_court_ou_vide_est_refuse_sans_etre_repete() {
        assert!(jeton_recevable("").is_err());
        let court = "abc123";
        let e = jeton_recevable(court).unwrap_err();
        assert!(!e.contains(court));
        assert!(jeton_recevable("deux mots qui font plus de vingt-quatre").is_err());
        assert_eq!(jeton_recevable("  jeton-admin-de-banc-0123456789abcdef ").unwrap(), "jeton-admin-de-banc-0123456789abcdef");
    }

    #[test]
    fn l_adresse_se_garde_dans_les_reglages() {
        let dossier = std::env::temp_dir().join(format!("iagent-bo-reglages-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);
        assert_eq!(adresse_lire(&dossier), "");
        assert!(adresse_poser(&dossier, "http://plateforme.exemple.fr").is_err());
        assert_eq!(adresse_lire(&dossier), "");
        assert_eq!(adresse_poser(&dossier, "https://plateforme.exemple.fr/").unwrap(), "https://plateforme.exemple.fr");
        assert_eq!(adresse_lire(&dossier), "https://plateforme.exemple.fr");
        assert!(!dossier.join("reglages.json.partiel").exists());
        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// A real HTTP exchange on the loopback: the token goes as Bearer, the
    /// platform's sentence comes back verbatim, a success comes back as data.
    #[tokio::test]
    async fn un_vrai_appel_rend_la_phrase_de_la_plateforme() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let ecoute = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = ecoute.local_addr().unwrap().port();
        let serveur = tokio::spawn(async move {
            let mut vus = Vec::new();
            for _ in 0..2 {
                let (mut s, _) = ecoute.accept().await.unwrap();
                let mut tampon = vec![0u8; 8192];
                let n = s.read(&mut tampon).await.unwrap();
                let requete = String::from_utf8_lossy(&tampon[..n]).to_string();
                let (statut, corps) = if requete.starts_with("GET /controle/boxes ") {
                    ("200 OK", r#"[{"device_id":"BOX-1"}]"#.to_string())
                } else {
                    ("400 Bad Request", r#"{"erreur":"Le statut « perdu » n’existe pas."}"#.to_string())
                };
                let reponse = format!("HTTP/1.1 {statut}\r\ncontent-type: application/json; charset=utf-8\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{corps}", corps.len());
                s.write_all(reponse.as_bytes()).await.unwrap();
                vus.push(requete);
            }
            vus
        });
        let adresse = format!("http://127.0.0.1:{port}");
        let jeton = "jeton-admin-de-banc-0123456789abcdef";
        let lu = appeler_avec(&adresse, jeton, "boxes", "GET", "/controle/boxes", None).await.unwrap();
        assert_eq!(lu[0]["device_id"], "BOX-1");
        let refus = appeler_avec(&adresse, jeton, "statutBox", "POST", "/controle/boxes/BOX-1/statut", Some(serde_json::json!({"statut":"perdu"}))).await.unwrap_err();
        assert_eq!(refus, ErreurAppel { erreur: "Le statut « perdu » n’existe pas.".into(), statut: 400, plateforme: true });
        let vus = serveur.await.unwrap();
        assert!(vus[0].to_lowercase().contains(&format!("authorization: bearer {jeton}")));
        // Undeclared route: refused before any connection, without the token in the message.
        let local = appeler_avec(&adresse, jeton, "boxes", "GET", "/controle/box/droits", None).await.unwrap_err();
        assert!(!local.plateforme && !local.erreur.contains(jeton));
        // Unreachable platform: the host is named, the token is not.
        let injoignable = appeler_avec("http://127.0.0.1:9", jeton, "boxes", "GET", "/controle/boxes", None).await.unwrap_err();
        assert!(injoignable.erreur.contains("127.0.0.1:9") && !injoignable.erreur.contains(jeton));
    }
}
