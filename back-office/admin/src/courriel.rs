//! Sending the e-mail studio's messages through iAgent's own mailbox (OVH SMTP).
//!
//! Rules that live here and nowhere else:
//! - the mailbox password lives in the system keyring, is set once, and never
//!   comes back to the interface;
//! - one message goes to ONE recipient, on one click: there is no list, no
//!   queue, no loop anywhere in this crate;
//! - what leaves is exactly what was read: the interface sends the fingerprint
//!   of the draft it displayed (`src/emails/modeles.js`, `empreinteSource`) and
//!   the message is refused if the recomputed one differs; the same fingerprint
//!   twice is refused too (double click, or the same message sent again);
//! - TLS always (SSL on 465 or STARTTLS on 587), never a clear connection;
//! - images are attached (`cid:`), never left « to host »: the logo and
//!   illustrations are compiled in, the portraits are fetched from
//!   iagent.agency and converted to JPEG, because Outlook shows no WebP;
//! - every message sent is written in `courriels-envoyes.json`.

use lettre::message::header::{ContentType, HeaderName, HeaderValue};
use lettre::message::{Attachment, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

const SERVICE_TROUSSEAU: &str = "iagent-back-office";
const ENTREE_MOT_DE_PASSE: &str = "smtp-mot-de-passe";
const FICHIER_REGLAGES: &str = "smtp.json";
const FICHIER_JOURNAL: &str = "courriels-envoyes.json";
const SITE_DES_PORTRAITS: &str = "https://iagent.agency/portraits/agents/";

const LOGO: &[u8] = include_bytes!("../../src/emails/assets/iagent-logo-officiel.png");
const HERO_INVESTOR: &[u8] = include_bytes!("../../src/emails/assets/hero-investor.jpg");
const HERO_WELCOME: &[u8] = include_bytes!("../../src/emails/assets/hero-welcome.jpg");
const HERO_MARKETING: &[u8] = include_bytes!("../../src/emails/assets/hero-marketing.jpg");

/// The mailbox settings. Not a secret: the password is in the keyring only.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Reglages {
    pub hote: String,
    pub port: u16,
    /// "ssl" (implicit TLS, 465) or "starttls" (587). Nothing else.
    pub securite: String,
    pub utilisateur: String,
    pub expediteur_nom: String,
    pub expediteur_adresse: String,
}

impl Default for Reglages {
    /// OVH's mail server for the domains it hosts, and iAgent's address.
    fn default() -> Self {
        Reglages {
            hote: "ssl0.ovh.net".into(),
            port: 465,
            securite: "ssl".into(),
            utilisateur: "contact@iagent.agency".into(),
            expediteur_nom: "iAgent".into(),
            expediteur_adresse: "contact@iagent.agency".into(),
        }
    }
}

/// One message, as the studio prepared it.
#[derive(Debug, Clone, Deserialize)]
pub struct Envoi {
    pub destinataire: String,
    pub objet: String,
    pub html: String,
    pub texte: String,
    pub modele: String,
    #[serde(default)]
    pub adresse_reponse: String,
    #[serde(default)]
    pub desinscription: String,
    pub empreinte: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Trace {
    /// Seconds since 1970 (UTC).
    pub quand: u64,
    pub destinataire: String,
    pub objet: String,
    pub modele: String,
    pub empreinte: String,
    pub reponse_serveur: String,
}

// ---- settings and password -------------------------------------------------

fn adresse_mail(a: &str) -> Result<Mailbox, String> {
    let propre = a.trim();
    if propre.is_empty() || propre.contains([',', ';', '<', '>', ' ']) || propre.matches('@').count() != 1 {
        return Err(format!("« {propre} » n'est pas une adresse e-mail unique."));
    }
    propre.parse::<Mailbox>().map_err(|_| format!("« {propre} » n'est pas une adresse e-mail valide."))
}

pub fn reglages_recevables(r: &Reglages) -> Result<Reglages, String> {
    let hote = r.hote.trim().to_ascii_lowercase();
    if hote.is_empty() || !hote.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') || !hote.contains('.') {
        return Err("Le serveur d'envoi est un nom comme ssl0.ovh.net, sans https:// ni port.".into());
    }
    let securite = r.securite.trim().to_ascii_lowercase();
    if securite != "ssl" && securite != "starttls" {
        return Err("La connexion est chiffrée : « ssl » (port 465) ou « starttls » (port 587). Une connexion en clair ferait passer le mot de passe lisible.".into());
    }
    if r.port == 0 {
        return Err("Le port du serveur d'envoi manque (465 en SSL chez OVH).".into());
    }
    adresse_mail(&r.utilisateur).map_err(|e| format!("Identifiant de la boîte : {e}"))?;
    adresse_mail(&r.expediteur_adresse).map_err(|e| format!("Adresse d'expédition : {e}"))?;
    if r.expediteur_nom.contains(['\r', '\n', '<', '>', '"']) {
        return Err("Le nom d'expéditeur ne contient ni guillemet, ni chevron, ni retour à la ligne.".into());
    }
    Ok(Reglages {
        hote,
        port: r.port,
        securite,
        utilisateur: r.utilisateur.trim().into(),
        expediteur_nom: r.expediteur_nom.trim().into(),
        expediteur_adresse: r.expediteur_adresse.trim().into(),
    })
}

pub fn reglages_lire(dossier: &Path) -> Reglages {
    std::fs::read_to_string(dossier.join(FICHIER_REGLAGES))
        .ok()
        .and_then(|t| serde_json::from_str::<Reglages>(&t).ok())
        .and_then(|r| reglages_recevables(&r).ok())
        .unwrap_or_default()
}

fn ecrire(dossier: &Path, nom: &str, contenu: &str) -> Result<(), String> {
    std::fs::create_dir_all(dossier).map_err(|e| format!("Le dossier des réglages ne peut pas être créé : {e}"))?;
    let partiel = dossier.join(format!("{nom}.partiel"));
    std::fs::write(&partiel, contenu).map_err(|e| format!("{nom} ne peut pas être écrit : {e}"))?;
    std::fs::rename(&partiel, dossier.join(nom)).map_err(|e| format!("{nom} ne peut pas être écrit : {e}"))
}

pub fn reglages_poser(dossier: &Path, r: &Reglages) -> Result<Reglages, String> {
    let propre = reglages_recevables(r)?;
    ecrire(dossier, FICHIER_REGLAGES, &serde_json::to_string_pretty(&propre).unwrap_or_default())?;
    Ok(propre)
}

fn trousseau() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_TROUSSEAU, ENTREE_MOT_DE_PASSE).map_err(|e| format!("Le trousseau du système est indisponible : {e}"))
}

pub fn mot_de_passe_poser(mot_de_passe: &str) -> Result<String, String> {
    if mot_de_passe.is_empty() {
        return Err("Saisissez le mot de passe de la boîte e-mail.".into());
    }
    trousseau()?.set_password(mot_de_passe).map_err(|e| format!("Le mot de passe n'a pas pu être rangé dans le trousseau : {e}"))?;
    Ok("Mot de passe rangé dans le coffre de cet ordinateur.".into())
}

pub fn mot_de_passe_present() -> bool {
    mot_de_passe_lire().is_some()
}

pub fn mot_de_passe_oublier() -> Result<String, String> {
    match trousseau()?.delete_credential() {
        Ok(()) => Ok("Mot de passe retiré de cet ordinateur.".into()),
        Err(keyring::Error::NoEntry) => Ok("Aucun mot de passe n'était rangé.".into()),
        Err(e) => Err(format!("Le mot de passe n'a pas pu être retiré du trousseau : {e}")),
    }
}

/// Private on purpose: the password never leaves this module.
fn mot_de_passe_lire() -> Option<String> {
    trousseau().ok()?.get_password().ok().filter(|m| !m.is_empty())
}

// ---- checks before anything leaves ------------------------------------------

/// The string the fingerprint covers; `empreinteSource` in src/emails/modeles.js builds the same one.
pub fn empreinte(destinataire: &str, objet: &str, html: &str, texte: &str) -> String {
    let mut h = Sha256::new();
    h.update(format!("{destinataire}\n{objet}\n{html}\n{texte}").as_bytes());
    h.finalize().iter().map(|o| format!("{o:02x}")).collect()
}

/// An image the message names, and how Rust provides it.
#[derive(Debug, Clone, PartialEq)]
pub enum Image {
    Compilee(&'static str, &'static [u8], &'static str),
    /// a three-digit portrait number, fetched from iagent.agency.
    Portrait(String),
}

fn image_de(cid: &str) -> Option<Image> {
    match cid {
        "logo" => Some(Image::Compilee("logo", LOGO, "image/png")),
        "hero-investor" => Some(Image::Compilee("hero-investor", HERO_INVESTOR, "image/jpeg")),
        "hero-welcome" => Some(Image::Compilee("hero-welcome", HERO_WELCOME, "image/jpeg")),
        "hero-marketing" => Some(Image::Compilee("hero-marketing", HERO_MARKETING, "image/jpeg")),
        _ => {
            let n = cid.strip_prefix("portrait-a")?;
            (n.len() == 3 && n.chars().all(|c| c.is_ascii_digit())).then(|| Image::Portrait(n.to_string()))
        }
    }
}

/// Every check that does not need the network. Returns the images to attach.
pub fn verifier_envoi(e: &Envoi, deja_envoyes: &[Trace]) -> Result<Vec<Image>, String> {
    adresse_mail(&e.destinataire).map_err(|m| format!("Destinataire : {m} Rien n'est parti."))?;
    if e.objet.trim().is_empty() || e.objet.contains(['\r', '\n']) {
        return Err("L'objet est vide ou porte un retour à la ligne : rien n'est parti.".into());
    }
    if e.html.to_ascii_lowercase().contains("<script") {
        return Err("Le message contient un script : rien n'est parti.".into());
    }
    let attendue = empreinte(e.destinataire.trim(), &e.objet, &e.html, &e.texte);
    if attendue != e.empreinte {
        return Err("Le message a changé entre l'aperçu et l'envoi : rien n'est parti. Relisez l'aperçu et cliquez de nouveau.".into());
    }
    if deja_envoyes.iter().any(|t| t.empreinte == attendue) {
        return Err(format!("Ce message exact est déjà parti à {} : il n'est pas renvoyé. Modifiez-le pour en envoyer un nouveau.", e.destinataire.trim()));
    }
    if !e.adresse_reponse.trim().is_empty() {
        adresse_mail(&e.adresse_reponse).map_err(|m| format!("Adresse de réponse : {m} Rien n'est parti."))?;
    }
    let d = e.desinscription.trim();
    if !d.is_empty() && !(d.starts_with("https://") || d.starts_with("mailto:")) || d.contains(['\r', '\n', '<', '>']) {
        return Err("Le lien de désinscription commence par https:// ou mailto: : rien n'est parti.".into());
    }
    let mut images = Vec::new();
    for morceau in e.html.split("cid:").skip(1) {
        let cid: String = morceau.chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
        let image = image_de(&cid).ok_or_else(|| format!("Le message cite une image inconnue (« cid:{cid} ») : rien n'est parti."))?;
        if !images.contains(&image) {
            images.push(image);
        }
    }
    Ok(images)
}

/// A portrait of the site, as JPEG. Outlook for Windows shows no WebP.
async fn portrait_en_jpeg(numero: &str) -> Result<Vec<u8>, String> {
    let url = format!("{SITE_DES_PORTRAITS}a{numero}.webp");
    let refus = |m: String| format!("Le portrait a{numero} n'a pas pu être joint ({m}) : rien n'est parti.");
    let reponse = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| refus(e.to_string()))?
        .get(&url)
        .send()
        .await
        .map_err(|_| refus("iagent.agency ne répond pas".into()))?;
    if !reponse.status().is_success() {
        return Err(refus(format!("iagent.agency a répondu {}", reponse.status().as_u16())));
    }
    let octets = reponse.bytes().await.map_err(|e| refus(e.to_string()))?;
    webp_en_jpeg(&octets).map_err(refus)
}

pub fn webp_en_jpeg(octets: &[u8]) -> Result<Vec<u8>, String> {
    let image = image::load_from_memory_with_format(octets, image::ImageFormat::WebP).map_err(|e| format!("image illisible : {e}"))?;
    let mut sortie = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(image.to_rgb8())
        .write_to(&mut sortie, image::ImageFormat::Jpeg)
        .map_err(|e| format!("conversion impossible : {e}"))?;
    Ok(sortie.into_inner())
}

/// The message itself: multipart/alternative (text, then HTML with its images attached).
pub fn construire(e: &Envoi, r: &Reglages, images: &[(String, Vec<u8>, String)]) -> Result<Message, String> {
    let de = Mailbox::new(Some(r.expediteur_nom.clone()).filter(|n| !n.is_empty()), r.expediteur_adresse.parse().map_err(|_| "Adresse d'expédition invalide.".to_string())?);
    let mut b = Message::builder().from(de).to(adresse_mail(&e.destinataire)?).subject(e.objet.trim());
    if !e.adresse_reponse.trim().is_empty() {
        b = b.reply_to(adresse_mail(&e.adresse_reponse)?);
    }
    if !e.desinscription.trim().is_empty() {
        b = b.raw_header(HeaderValue::new(HeaderName::new_from_ascii_str("List-Unsubscribe"), format!("<{}>", e.desinscription.trim())));
    }
    let mut html = MultiPart::related().singlepart(SinglePart::html(e.html.clone()));
    for (cid, octets, type_mime) in images {
        let ct = ContentType::parse(type_mime).map_err(|_| format!("Type d'image inconnu : {type_mime}"))?;
        html = html.singlepart(Attachment::new_inline(cid.clone()).body(octets.clone(), ct));
    }
    b.multipart(MultiPart::alternative().singlepart(SinglePart::plain(e.texte.clone())).multipart(html))
        .map_err(|err| format!("Le message n'a pas pu être construit : {err}"))
}

pub fn journal_lire(dossier: &Path) -> Vec<Trace> {
    std::fs::read_to_string(dossier.join(FICHIER_JOURNAL))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

/// One message to one recipient. Called by one click in the studio, never in a loop.
pub async fn envoyer(dossier: &Path, e: &Envoi) -> Result<Trace, String> {
    let journal = journal_lire(dossier);
    let images = verifier_envoi(e, &journal)?;
    let r = reglages_lire(dossier);
    let mot_de_passe = mot_de_passe_lire().ok_or_else(|| "Le mot de passe de la boîte e-mail n'est pas enregistré sur cet ordinateur : rien n'est parti.".to_string())?;
    let mut jointes = Vec::new();
    for image in images {
        match image {
            Image::Compilee(cid, octets, type_mime) => jointes.push((cid.to_string(), octets.to_vec(), type_mime.to_string())),
            Image::Portrait(n) => jointes.push((format!("portrait-a{n}"), portrait_en_jpeg(&n).await?, "image/jpeg".to_string())),
        }
    }
    let message = construire(e, &r, &jointes)?;
    let builder = if r.securite == "starttls" {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&r.hote)
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&r.hote)
    }
    .map_err(|err| format!("Le serveur {} n'est pas joignable en connexion chiffrée : {err}", r.hote))?;
    let transport = builder
        .port(r.port)
        .credentials(Credentials::new(r.utilisateur.clone(), mot_de_passe))
        .timeout(Some(std::time::Duration::from_secs(30)))
        .build();
    let reponse = transport.send(message).await.map_err(|err| {
        let detail = err.to_string();
        if detail.contains("535") || detail.to_lowercase().contains("authentication") {
            format!("Le serveur {} a refusé l'identifiant ou le mot de passe de {} : rien n'est parti.", r.hote, r.utilisateur)
        } else {
            format!("Le serveur {} n'a pas pris le message ({detail}) : rien n'est parti.", r.hote)
        }
    })?;
    let trace = Trace {
        quand: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0),
        destinataire: e.destinataire.trim().to_string(),
        objet: e.objet.trim().to_string(),
        modele: e.modele.clone(),
        empreinte: e.empreinte.clone(),
        reponse_serveur: format!("{} {}", reponse.code(), reponse.message().collect::<Vec<_>>().join(" ")),
    };
    let mut nouveau = journal;
    nouveau.push(trace.clone());
    // The message is gone: a journal that cannot be written is said, never hidden.
    ecrire(dossier, FICHIER_JOURNAL, &serde_json::to_string_pretty(&nouveau).unwrap_or_default())
        .map_err(|err| format!("Le message est PARTI à {}, mais le journal n'a pas pu être écrit : {err}", trace.destinataire))?;
    Ok(trace)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn envoi(html: &str) -> Envoi {
        let (d, o, t) = ("prospect@exemple.fr", "Bonjour", "Texte");
        Envoi {
            destinataire: d.into(),
            objet: o.into(),
            html: html.into(),
            texte: t.into(),
            modele: "prospection-metier".into(),
            adresse_reponse: "contact@iagent.agency".into(),
            desinscription: "mailto:contact@iagent.agency?subject=D%C3%A9sinscription".into(),
            empreinte: empreinte(d, o, html, t),
        }
    }

    #[test]
    fn empreinte_comme_le_studio() {
        // Same string and hash as src/emails/modeles.js (temoins/empreinte.json, played by the JS bench too).
        let t: serde_json::Value = serde_json::from_str(include_str!("../../temoins/empreinte.json")).unwrap();
        let attendue = t["empreinte"].as_str().unwrap();
        assert_eq!(empreinte(t["destinataire"].as_str().unwrap(), t["objet"].as_str().unwrap(), t["html"].as_str().unwrap(), t["texte"].as_str().unwrap()), attendue);
    }

    #[test]
    fn un_message_change_ne_part_pas() {
        let mut e = envoi("<p>Lu</p>");
        e.html = "<p>Pas lu</p>".into();
        assert!(verifier_envoi(&e, &[]).unwrap_err().contains("a changé"));
    }

    #[test]
    fn un_seul_destinataire() {
        for d in ["a@b.fr, c@d.fr", "a@b.fr;c@d.fr", "pas-une-adresse", "", "a@b@c.fr"] {
            let mut e = envoi("<p>x</p>");
            e.destinataire = d.into();
            e.empreinte = empreinte(d.trim(), &e.objet, &e.html, &e.texte);
            assert!(verifier_envoi(&e, &[]).is_err(), "{d} accepté");
        }
    }

    #[test]
    fn le_meme_message_ne_part_pas_deux_fois() {
        let e = envoi("<p>x</p>");
        let deja = Trace { quand: 1, destinataire: e.destinataire.clone(), objet: e.objet.clone(), modele: e.modele.clone(), empreinte: e.empreinte.clone(), reponse_serveur: "250".into() };
        assert!(verifier_envoi(&e, &[deja]).unwrap_err().contains("déjà parti"));
    }

    #[test]
    fn images_connues_seulement() {
        let e = envoi(r#"<img src="cid:logo"><img src="cid:logo"><img src="cid:hero-welcome"><img src="cid:portrait-a313">"#);
        let images = verifier_envoi(&e, &[]).unwrap();
        assert_eq!(images.len(), 3);
        assert!(images.contains(&Image::Portrait("313".into())));
        for faux in ["cid:portrait-a31", "cid:portrait-../x", "cid:autre"] {
            assert!(verifier_envoi(&envoi(&format!(r#"<img src="{faux}">"#)), &[]).is_err(), "{faux} accepté");
        }
        assert!(verifier_envoi(&envoi("<script>x</script>"), &[]).is_err());
    }

    #[test]
    fn jamais_en_clair() {
        let mut r = Reglages::default();
        assert!(reglages_recevables(&r).is_ok());
        r.securite = "aucune".into();
        assert!(reglages_recevables(&r).is_err());
        r = Reglages { hote: "https://ssl0.ovh.net".into(), ..Reglages::default() };
        assert!(reglages_recevables(&r).is_err());
    }

    #[test]
    fn message_complet() {
        let e = envoi(r#"<p>Bonjour</p><img src="cid:logo">"#);
        let m = construire(&e, &Reglages::default(), &[("logo".into(), LOGO.to_vec(), "image/png".into())]).unwrap();
        let brut = String::from_utf8_lossy(&m.formatted()).to_string();
        for attendu in ["multipart/alternative", "multipart/related", "text/plain", "text/html", "Content-ID: <logo>", "List-Unsubscribe: <mailto:contact@iagent.agency", "Reply-To: contact@iagent.agency", "To: prospect@exemple.fr", "From: iAgent <contact@iagent.agency>"] {
            assert!(brut.contains(attendu), "absent : {attendu}");
        }
    }

    #[test]
    fn un_portrait_webp_devient_jpeg() {
        let mut webp = std::io::Cursor::new(Vec::new());
        image::DynamicImage::new_rgb8(4, 4).write_to(&mut webp, image::ImageFormat::WebP).unwrap();
        let jpeg = webp_en_jpeg(webp.get_ref()).unwrap();
        assert_eq!(&jpeg[..2], &[0xFF, 0xD8]);
        // A real portrait of the site (lossy WebP, as served by iagent.agency).
        let vrai = webp_en_jpeg(include_bytes!("../../../frontend/public/portraits/agents/a313.webp")).unwrap();
        assert!(vrai.len() > 2000 && vrai[..2] == [0xFF, 0xD8]);
    }
}
