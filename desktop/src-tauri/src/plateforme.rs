//! The Box talking to the iAgent platform (MASTER §6, §14; contract in
//! `docs/master/routes.md`).
//!
//! Three things live here and nowhere else:
//!
//! 1. **The Box identity.** An Ed25519 key pair generated once. The private key
//!    is kept in the system keyring (`iagent-box` / `identite-ed25519`) and is
//!    never returned to the screen nor written to a file; only the public key
//!    (PEM SPKI, the same text `crypto.createPublicKey().export()` gives in
//!    Node) leaves Rust, to be typed into the provisioning form.
//! 2. **Signed requests.** Exactly `messageASigner` of `plateforme/serveur.ts`:
//!    `METHOD\npath\ntimestamp\nsha256hex(body)`, signature in standard base64
//!    in `x-signature`, with `x-box-id` and `x-horodatage`. The Rust test replays
//!    `desktop/temoins-plateforme.json`, produced from the server code by
//!    `desktop/check-plateforme.ts`, so the two sides cannot drift apart.
//! 3. **The licence gate.** When the Box is *provisioned* (a platform address
//!    and a platform public key are set), an agent without a valid right does
//!    not run: `autoriser` is called before a task (`executer_tache`) and
//!    before a conversation turn (`repondre`). When it is not provisioned the
//!    workstation works as before and the screen says « poste non relié ».
//!    Only token v2 is accepted: each right carries `empreinte_fiche`, and the
//!    card read on disk (`fiches::chemin_fiche`) must have that SHA-256.
//!    Grace: renewed before `expire_le`; while the platform is UNREACHABLE
//!    (network, timeout, 5xx — decided in `joignabilite`, nowhere else) the
//!    last token serves until `grace_jusqu_au`; a 401/403 throws it away at
//!    once; past the grace nothing runs.
//! 4. **Skill Packs**, signed and encrypted for this Box (X25519 key in the
//!    keyring, HKDF-SHA256, AES-256-GCM, Ed25519 signature of the platform),
//!    opened in memory only (`ouvrir_skill`). The tests replay the controle
//!    workstream's `plateforme/controle/temoins-signature.json`.
//!
//! What this does NOT protect against, said plainly: the settings file lives in
//! the user's data folder. Someone with write access to that folder can delete
//! it and turn the Box back into an unlinked workstation. The real lock is the
//! appliance itself (§6: locked OS, TPM, encrypted disk), not this file.

use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use chrono::{DateTime, SecondsFormat, Utc};
use ring::signature::{Ed25519KeyPair, KeyPair, UnparsedPublicKey, ED25519};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::Duration;

const SERVICE_TROUSSEAU: &str = "iagent-box";
const ENTREE_IDENTITE: &str = "identite-ed25519";
const ENTREE_CHIFFREMENT: &str = "chiffrement-x25519";

/// What the customer writes lives under the writable root (`chemins.rs`); a
/// file is read there first, then next to the executable. Each path is spelled
/// once, in its own function, right where `chemins::` decides its root.
#[derive(Clone, Copy)]
enum Sens {
    Lire,
    Ecrire,
}

fn fichier_reglages(sens: Sens) -> std::path::PathBuf {
    match sens {
        Sens::Lire => crate::chemins::pour_lire("config/plateforme.json"),
        Sens::Ecrire => crate::chemins::pour_ecrire("config/plateforme.json"),
    }
}

fn fichier_licence(sens: Sens) -> std::path::PathBuf {
    match sens {
        Sens::Lire => crate::chemins::pour_lire("config/licence.json"),
        Sens::Ecrire => crate::chemins::pour_ecrire("config/licence.json"),
    }
}

/// Same tolerance as the server (`DERIVE_HORLOGE_MS`): a token issued more
/// than five minutes in the future means a clock that cannot be trusted.
const DERIVE_HORLOGE_S: i64 = 300;
/// A stored token older than this is refreshed before an agent runs, when the
/// platform answers. It stays usable until its own expiry when it does not.
const RAFRAICHIR_APRES_S: i64 = 3600;
const DELAI_RESEAU: Duration = Duration::from_secs(10);

/// DER prefix of an Ed25519 SubjectPublicKeyInfo (RFC 8410): 12 bytes, then
/// the 32-byte key.
const SPKI_ED25519: [u8; 12] = [
    0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
];

pub const DECISIONS_HANDOFF: [&str; 4] = ["prendre", "refuser", "rappeler", "laisser"];

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/// What links this Box to a platform. Nothing secret: the private key is in
/// the keyring, the platform key and the Box key are public keys.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Reglages {
    /// Platform address. `PLATEFORME_URL` overrides it (development, factory).
    #[serde(default)]
    pub adresse: Option<String>,
    /// The `device_id` the platform gave this Box at provisioning.
    #[serde(default)]
    pub device_id: Option<String>,
    /// Platform public key (PEM). Pinned once; tokens are checked against it.
    #[serde(default)]
    pub cle_plateforme: Option<String>,
    /// This Box's own public key (PEM), copied here when the identity is made
    /// so the token's `cle_box` can be checked without opening the keyring.
    #[serde(default)]
    pub cle_box: Option<String>,
    /// This Box's X25519 public key (raw 32 bytes, base64url without padding):
    /// `cle_chiffrement_publique` at provisioning, so the platform can encrypt
    /// Skill Packs for this Box only. Public, copied here like `cle_box`.
    #[serde(default)]
    pub cle_chiffrement: Option<String>,
}

fn non_vide(v: &Option<String>) -> Option<&str> {
    v.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

impl Reglages {
    /// Provisioned = an address AND a platform key. Only then is the licence
    /// enforced; that is the rule the screen states.
    pub fn provisionnee(&self) -> bool {
        non_vide(&self.adresse).is_some() && non_vide(&self.cle_plateforme).is_some()
    }
}

pub fn lire_reglages() -> Reglages {
    let mut r: Reglages = std::fs::read_to_string(fichier_reglages(Sens::Lire))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    if let Ok(v) = std::env::var("PLATEFORME_URL") {
        if !v.trim().is_empty() {
            r.adresse = Some(v.trim().to_string());
        }
    }
    r
}

fn ecrire_json<T: Serialize>(chemin: std::path::PathBuf, valeur: &T) -> Result<(), String> {
    crate::chemins::preparer(&chemin)?;
    let partiel = chemin.with_extension("json.partiel");
    let texte = serde_json::to_string_pretty(valeur).map_err(|e| e.to_string())?;
    std::fs::write(&partiel, texte)
        .and_then(|_| std::fs::rename(&partiel, &chemin))
        .map_err(|e| format!("impossible d'écrire {} : {}", chemin.display(), e))
}

/// The new settings, from the old ones and what the screen asks.
///
/// Pure, so the two refusals are tested: the platform key, once pinned, is
/// never replaced from the screen (replacing it is the one move that would let
/// a fake platform sign rights), and the `device_id` is set once.
pub fn reglages_modifies(
    avant: &Reglages,
    adresse: Option<String>,
    device_id: Option<String>,
    cle_plateforme: Option<String>,
) -> Result<Reglages, String> {
    let mut r = avant.clone();
    if let Some(a) = adresse.map(|a| a.trim().trim_end_matches('/').to_string()) {
        if !a.is_empty() {
            adresse_recevable(&a)?;
            r.adresse = Some(a);
        }
    }
    if let Some(d) = device_id.map(|d| d.trim().to_string()).filter(|d| !d.is_empty()) {
        match non_vide(&avant.device_id) {
            Some(deja) if deja != d => {
                return Err(format!(
                    "Cette Box porte déjà l'identifiant {}. Il ne se change pas depuis l'écran : c'est la plateforme qui le réattribue.",
                    deja
                ))
            }
            _ => r.device_id = Some(d),
        }
    }
    if let Some(c) = cle_plateforme.filter(|c| !c.trim().is_empty()) {
        let neuve = brute_depuis_pem(&c)?;
        if let Some(deja) = non_vide(&avant.cle_plateforme) {
            if brute_depuis_pem(deja)? != neuve {
                return Err(
                    "La clé de la plateforme est déjà posée sur cette Box et ne se remplace pas depuis l'écran : une autre clé laisserait n'importe quel serveur accorder des droits.".to_string(),
                );
            }
        }
        r.cle_plateforme = Some(pem_depuis_brute(&neuve));
    }
    Ok(r)
}

/// `https` only, except the loopback (development). Same reasons as
/// `mcp::adresse_recevable`: what travels is signed, but the rights and the
/// calls of a customer must not be readable on the way.
pub fn adresse_recevable(url: &str) -> Result<(), String> {
    let reste = if let Some(r) = url.strip_prefix("https://") {
        r
    } else if let Some(r) = url.strip_prefix("http://") {
        let hote = r.split(['/', ':']).next().unwrap_or("");
        if hote != "127.0.0.1" && hote != "localhost" {
            return Err(format!(
                "« {} » n'est pas chiffrée : la plateforme se joint en https (seule la boucle locale est permise en clair, pour le développement).",
                url
            ));
        }
        r
    } else {
        return Err(format!("« {} » n'est pas une adresse web (https://…).", url));
    };
    if reste.contains('?') || reste.contains('@') || reste.is_empty() {
        return Err("L'adresse de la plateforme ne porte ni paramètre, ni identifiant : seulement l'hôte.".to_string());
    }
    Ok(())
}

fn hote(url: &str) -> &str {
    url.split("://").nth(1).and_then(|r| r.split('/').next()).unwrap_or(url)
}

// ---------------------------------------------------------------------------
// Keys and signatures
// ---------------------------------------------------------------------------

pub fn empreinte_hex(octets: &[u8]) -> String {
    Sha256::digest(octets).iter().map(|b| format!("{:02x}", b)).collect()
}

/// `messageASigner` of `plateforme/serveur.ts`, byte for byte.
pub fn message_a_signer(methode: &str, chemin: &str, horodatage: &str, corps: &str) -> String {
    format!("{}\n{}\n{}\n{}", methode, chemin, horodatage, empreinte_hex(corps.as_bytes()))
}

pub fn der_depuis_brute(brute: &[u8; 32]) -> Vec<u8> {
    let mut der = SPKI_ED25519.to_vec();
    der.extend_from_slice(brute);
    der
}

/// The PEM Node writes for an Ed25519 public key (44 DER bytes fit one line).
pub fn pem_depuis_brute(brute: &[u8; 32]) -> String {
    format!(
        "-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----\n",
        STANDARD.encode(der_depuis_brute(brute))
    )
}

pub fn brute_depuis_pem(pem: &str) -> Result<[u8; 32], String> {
    let corps: String = pem
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with("-----"))
        .collect();
    let der = STANDARD
        .decode(corps.as_bytes())
        .map_err(|_| "La clé publique n'est pas un PEM lisible.".to_string())?;
    if der.len() != 44 || der[..12] != SPKI_ED25519 {
        return Err("La clé publique n'est pas une clé Ed25519 (PEM SPKI).".to_string());
    }
    let mut brute = [0u8; 32];
    brute.copy_from_slice(&der[12..]);
    Ok(brute)
}

/// Loads a key pair from PKCS#8 (v1 as Node writes it, or v2 as ring does).
pub fn paire_depuis_pkcs8(pkcs8: &[u8]) -> Result<Ed25519KeyPair, String> {
    Ed25519KeyPair::from_pkcs8_maybe_unchecked(pkcs8)
        .map_err(|_| "L'identité rangée au trousseau est illisible.".to_string())
}

pub fn signer(paire: &Ed25519KeyPair, message: &str) -> String {
    STANDARD.encode(paire.sign(message.as_bytes()).as_ref())
}

pub fn cle_publique_pem(paire: &Ed25519KeyPair) -> String {
    let mut brute = [0u8; 32];
    brute.copy_from_slice(paire.public_key().as_ref());
    pem_depuis_brute(&brute)
}

fn trousseau(service: &str, entree: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(service, entree)
        .map_err(|e| format!("Le coffre du système est indisponible : {}", e))
}

/// The Box key pair, created on first use.
///
/// After creating it, the key is read back through a NEW keyring entry: a
/// keyring that only keeps the value in the object that wrote it (keyring's
/// mock store, which is what a build without a native backend falls back to)
/// would otherwise hand out a new identity at every start, and the platform
/// would never recognise the Box again. That case is refused, not hidden.
fn identite() -> Result<Ed25519KeyPair, String> {
    let pkcs8 = secret_au_trousseau(ENTREE_IDENTITE, "l'identité de la Box", || {
        Ed25519KeyPair::generate_pkcs8(&ring::rand::SystemRandom::new())
            .map(|d| d.as_ref().to_vec())
            .map_err(|_| "Le système n'a pas fourni d'aléa pour créer l'identité de la Box.".to_string())
    })?;
    paire_depuis_pkcs8(&pkcs8)
}

/// The Box encryption key (X25519), created on first use, kept like the
/// identity. Only its public half ever leaves this module.
fn cle_de_chiffrement() -> Result<x25519_dalek::StaticSecret, String> {
    let octets = secret_au_trousseau(ENTREE_CHIFFREMENT, "la clé de chiffrement de la Box", || {
        let mut s = [0u8; 32];
        ring::rand::SecureRandom::fill(&ring::rand::SystemRandom::new(), &mut s)
            .map_err(|_| "Le système n'a pas fourni d'aléa pour créer la clé de chiffrement de la Box.".to_string())?;
        Ok(s.to_vec())
    })?;
    let brute: [u8; 32] = octets
        .try_into()
        .map_err(|_| "La clé de chiffrement rangée au trousseau n'a pas la bonne longueur.".to_string())?;
    Ok(x25519_dalek::StaticSecret::from(brute))
}

/// Raw X25519 public key, base64url without padding (`cle_chiffrement_publique`).
pub fn cle_chiffrement_publique(secret: &x25519_dalek::StaticSecret) -> String {
    URL_SAFE_NO_PAD.encode(x25519_dalek::PublicKey::from(secret).as_bytes())
}

/// Reads a secret from the keyring, or creates it with `creer`, stores it, and
/// reads it back through a NEW entry before trusting it (see `identite`).
fn secret_au_trousseau(
    entree: &str,
    quoi: &str,
    creer: impl FnOnce() -> Result<Vec<u8>, String>,
) -> Result<Vec<u8>, String> {
    match trousseau(SERVICE_TROUSSEAU, entree)?.get_password() {
        Ok(texte) => STANDARD
            .decode(texte.trim())
            .map_err(|_| format!("{} rangée au trousseau est illisible.", majuscule(quoi))),
        Err(keyring::Error::NoEntry) => {
            let octets = creer()?;
            let texte = STANDARD.encode(&octets);
            trousseau(SERVICE_TROUSSEAU, entree)?
                .set_password(&texte)
                .map_err(|e| format!("{} n'a pas pu être rangée au trousseau : {}", majuscule(quoi), e))?;
            let relue = trousseau(SERVICE_TROUSSEAU, entree)?.get_password().ok();
            if relue.as_deref() != Some(texte.as_str()) {
                return Err(format!(
                    "Le coffre du système ne garde pas {} d'une lecture à l'autre : elle changerait à chaque démarrage, et la plateforme ne reconnaîtrait jamais cette Box.",
                    quoi
                ));
            }
            Ok(octets)
        }
        Err(e) => Err(format!("Lecture du trousseau impossible : {}", e)),
    }
}

fn majuscule(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        Some(p) => p.to_uppercase().collect::<String>() + c.as_str(),
        None => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Licence token
// ---------------------------------------------------------------------------

/// One right, as the platform puts it in the token (agreed with the controle
/// module on 07/10/2026).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Droit {
    pub id: String,
    pub agent_template_id: String,
    pub specialisation_id: Option<String>,
    pub licence: String,
    pub fin: Option<String>,
    /// Token v2: SHA-256 hex of the exact bytes of the agent's card. The card
    /// read on disk must have it, or the agent does not run.
    #[serde(default)]
    pub empreinte_fiche: Option<String>,
}

/// The only token format a provisioned Box accepts. v1 carried no card
/// fingerprint: accepting it would let a modified card run.
pub const VERSION_JETON: u32 = 2;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Charge {
    #[serde(default)]
    pub v: Option<u32>,
    pub device_id: String,
    pub tenant_id: Option<String>,
    pub emis_le: String,
    pub expire_le: String,
    pub droits: Vec<Droit>,
    /// SHA-256 hex of the Box public key in DER SPKI; checked when known.
    #[serde(default)]
    pub cle_box: Option<String>,
    /// Issue + 72 h: how long the token still serves when the platform cannot
    /// be reached. Absent = no grace at all.
    #[serde(default)]
    pub grace_jusqu_au: Option<String>,
}

fn date(texte: &str, quoi: &str) -> Result<DateTime<Utc>, String> {
    DateTime::parse_from_rfc3339(texte)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|_| format!("le jeton de licence porte une date illisible ({})", quoi))
}

fn francais(d: &DateTime<Utc>) -> String {
    d.format("%d/%m/%Y à %H:%M UTC").to_string()
}

/// Checks a token completely, or says in French why it does not hold.
pub fn lire_jeton(
    jeton: &str,
    cle_plateforme_pem: &str,
    device_id: &str,
    cle_box_pem: Option<&str>,
    maintenant: DateTime<Utc>,
) -> Result<Charge, String> {
    let (texte_charge, signature) = jeton
        .split_once('.')
        .filter(|(_, s)| !s.contains('.'))
        .ok_or("le jeton de licence n'a pas la forme attendue")?;
    let signature = URL_SAFE_NO_PAD
        .decode(signature)
        .map_err(|_| "la signature du jeton de licence est illisible")?;
    let cle = brute_depuis_pem(cle_plateforme_pem)?;
    UnparsedPublicKey::new(&ED25519, cle)
        .verify(texte_charge.as_bytes(), &signature)
        .map_err(|_| "le jeton de licence n'est pas signé par la plateforme")?;
    let charge: Charge = URL_SAFE_NO_PAD
        .decode(texte_charge)
        .ok()
        .and_then(|o| serde_json::from_slice(&o).ok())
        .ok_or("le contenu du jeton de licence est illisible")?;

    if charge.v != Some(VERSION_JETON) {
        return Err(format!(
            "le jeton de licence est d'un format ancien (v{}) : seule la v{} porte l'empreinte de chaque fiche, la plateforme doit être mise à jour",
            charge.v.map(|v| v.to_string()).unwrap_or_else(|| "1".into()),
            VERSION_JETON
        ));
    }
    if charge.device_id != device_id {
        return Err(format!(
            "le jeton de licence est celui de la Box {}, pas de celle-ci ({})",
            charge.device_id, device_id
        ));
    }
    if let (Some(attendue), Some(pem)) = (charge.cle_box.as_deref(), cle_box_pem) {
        let brute = brute_depuis_pem(pem)?;
        if empreinte_hex(&der_depuis_brute(&brute)) != attendue {
            return Err("le jeton de licence a été émis pour une autre clé que celle de cette Box".to_string());
        }
    }
    let emis = date(&charge.emis_le, "émission")?;
    if (emis - maintenant).num_seconds() > DERIVE_HORLOGE_S {
        return Err("le jeton de licence est daté dans le futur : l'horloge de cette Box ou de la plateforme est fausse".to_string());
    }
    date(&charge.expire_le, "expiration")?;
    if let Some(g) = charge.grace_jusqu_au.as_deref() {
        date(g, "fin de grâce")?;
    }
    Ok(charge)
}

/// Whether the platform could be asked, as far as the licence is concerned.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Joignabilite {
    /// It answered (any 2xx/4xx), or nothing went out because of this Box.
    Joignable,
    /// Network error, timeout, or 5xx: the grace period applies.
    Injoignable,
}

/// How a failed call to the platform ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Issue {
    /// Nothing was sent: no address, no identity, malformed request.
    Locale,
    /// Connection refused, DNS, TLS, timeout.
    Reseau,
    /// The platform answered with this status.
    Statut(u16),
}

/// THE place where reachable and unreachable are told apart (MASTER §6).
/// Only an unreachable platform opens the grace period. A 401/403 means the Box
/// was suspended, returned or replaced: reachable, and worse, revoked.
pub fn joignabilite(issue: &Issue) -> Joignabilite {
    match issue {
        Issue::Reseau => Joignabilite::Injoignable,
        Issue::Statut(s) if *s >= 500 => Joignabilite::Injoignable,
        Issue::Statut(_) | Issue::Locale => Joignabilite::Joignable,
    }
}

/// 401/403: the platform no longer recognises this Box. The stored token is
/// thrown away at once, without grace.
pub fn revoquee(issue: &Issue) -> bool {
    matches!(issue, Issue::Statut(401) | Issue::Statut(403))
}

/// Time validity of a verified token. Before `expire_le` it serves; after,
/// only while the platform is unreachable and until `grace_jusqu_au`.
pub fn validite(charge: &Charge, maintenant: DateTime<Utc>, joignable: Joignabilite) -> Result<(), String> {
    let expire = date(&charge.expire_le, "expiration")?;
    if maintenant < expire {
        return Ok(());
    }
    let grace = charge.grace_jusqu_au.as_deref().map(|g| date(g, "fin de grâce")).transpose()?;
    match (joignable, grace) {
        (Joignabilite::Injoignable, Some(g)) if maintenant < g => Ok(()),
        (Joignabilite::Injoignable, Some(g)) => Err(format!(
            "le centre de contrôle est injoignable et la période de grâce a pris fin le {} ; plus rien ne s'exécute avant de l'avoir rejoint",
            francais(&g)
        )),
        (Joignabilite::Injoignable, None) => Err(format!(
            "le dernier jeton de licence a expiré le {} et ne prévoit aucune période de grâce ; il faut rejoindre la plateforme",
            francais(&expire)
        )),
        (Joignabilite::Joignable, _) => Err(format!(
            "le jeton de licence a expiré le {} et la plateforme, joignable, n'en a pas rendu de nouveau",
            francais(&expire)
        )),
    }
}

/// SHA-256 hex of the exact bytes of a card, as the platform computes it.
pub fn empreinte_fiche(octets: &[u8]) -> String {
    empreinte_hex(octets)
}

/// The right that lets this agent run now, if any.
pub fn droit_pour<'a>(charge: &'a Charge, fiche_id: &str, maintenant: DateTime<Utc>) -> Result<&'a Droit, String> {
    let siens: Vec<&Droit> = charge.droits.iter().filter(|d| d.agent_template_id == fiche_id).collect();
    if siens.is_empty() {
        return Err(format!("aucun droit n'est ouvert pour l'agent {} sur cette Box", fiche_id));
    }
    let mut fin_passee = None;
    for d in siens {
        match d.fin.as_deref() {
            None => return Ok(d),
            Some(f) => {
                let fin = date(f, "fin du droit")?;
                if fin > maintenant {
                    return Ok(d);
                }
                fin_passee = Some(fin);
            }
        }
    }
    Err(format!(
        "le droit de l'agent {} a pris fin le {}",
        fiche_id,
        fin_passee.map(|f| francais(&f)).unwrap_or_default()
    ))
}

/// What `decider` needs to know about the agent and the platform, besides the
/// token: the fingerprint of the card read on disk (None = unreadable) and
/// whether the platform could be reached on the last attempt.
#[derive(Debug, Clone, PartialEq)]
pub struct Contexte<'a> {
    pub fiche_id: &'a str,
    pub empreinte_disque: Option<&'a str>,
    pub joignable: Joignabilite,
}

/// The whole licence decision, without I/O. `jeton` is the last token that
/// was verified and stored.
pub fn decider(reglages: &Reglages, jeton: Option<&str>, ctx: &Contexte, maintenant: DateTime<Utc>) -> Result<(), String> {
    let fiche_id = ctx.fiche_id;
    if !reglages.provisionnee() {
        return Ok(());
    }
    let refus = |motif: String| Err(format!("Cet agent ne s'exécute pas : {}.", motif));
    let Some(device_id) = non_vide(&reglages.device_id) else {
        return refus("la Box est reliée à une plateforme mais n'a pas reçu son identifiant de Box".to_string());
    };
    let Some(jeton) = jeton else {
        return refus("la Box est reliée à la plateforme mais n'a encore reçu aucun droit ; rejoignez-la depuis l'écran Box".to_string());
    };
    let cle = non_vide(&reglages.cle_plateforme).unwrap_or_default();
    let charge = match lire_jeton(jeton, cle, device_id, non_vide(&reglages.cle_box), maintenant) {
        Ok(c) => c,
        Err(m) => return refus(m),
    };
    if let Err(m) = validite(&charge, maintenant, ctx.joignable) {
        return refus(m);
    }
    let droit = match droit_pour(&charge, fiche_id, maintenant) {
        Ok(d) => d,
        Err(m) => return refus(m),
    };
    match (droit.empreinte_fiche.as_deref(), ctx.empreinte_disque) {
        (None, _) => refus(format!("le droit de l'agent {} ne porte pas l'empreinte de sa fiche", fiche_id)),
        (Some(_), None) => refus(format!("la fiche de l'agent {} n'a pas pu être lue sur cette Box", fiche_id)),
        (Some(attendue), Some(lue)) if !attendue.eq_ignore_ascii_case(lue) => refus(format!(
            "la fiche de l'agent {} a été modifiée, ou n'est pas celle de la licence",
            fiche_id
        )),
        _ => Ok(()),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LicenceRangee {
    jeton: String,
    recu_le: String,
}

fn lire_licence() -> Option<LicenceRangee> {
    std::fs::read_to_string(fichier_licence(Sens::Lire))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
}

/// What the screens show about the licence.
#[derive(Debug, Clone, Serialize)]
pub struct EtatLicence {
    /// A verified token is in hand and has not expired.
    pub valide: bool,
    pub expire_le: Option<String>,
    pub recu_le: Option<String>,
    pub droits: Vec<Droit>,
    /// Read from the platform just now (false = last stored token, offline).
    pub en_ligne: bool,
    pub motif: String,
}

/// `joignable`: the outcome of the attempt just made, None when none was made
/// (then the token is judged strictly, without grace).
fn etat_licence(
    reglages: &Reglages,
    rangee: Option<&LicenceRangee>,
    joignable: Option<Joignabilite>,
    maintenant: DateTime<Utc>,
    panne: Option<String>,
) -> EtatLicence {
    let en_ligne = rangee.is_some() && panne.is_none() && joignable == Some(Joignabilite::Joignable);
    let mut e = EtatLicence {
        valide: false,
        expire_le: None,
        recu_le: rangee.map(|r| r.recu_le.clone()),
        droits: vec![],
        en_ligne,
        motif: String::new(),
    };
    if !reglages.provisionnee() {
        e.motif = "Poste non relié : aucune licence n'est exigée, les agents travaillent comme avant.".to_string();
        return e;
    }
    let Some(r) = rangee else {
        e.motif = match panne {
            Some(p) => format!("Aucun droit reçu de la plateforme. {}", p),
            None => "Aucun droit reçu de la plateforme pour l'instant.".to_string(),
        };
        return e;
    };
    match lire_jeton(
        &r.jeton,
        non_vide(&reglages.cle_plateforme).unwrap_or_default(),
        non_vide(&reglages.device_id).unwrap_or_default(),
        non_vide(&reglages.cle_box),
        maintenant,
    ) {
        Ok(c) => {
            e.expire_le = Some(c.expire_le.clone());
            let expire = date(&c.expire_le, "expiration").map(|d| francais(&d)).unwrap_or_default();
            let grace = c
                .grace_jusqu_au
                .as_deref()
                .and_then(|g| date(g, "fin de grâce").ok())
                .map(|d| francais(&d));
            let joignable = joignable.unwrap_or(Joignabilite::Joignable);
            match validite(&c, maintenant, joignable) {
                Ok(()) => {
                    e.valide = true;
                    e.droits = c.droits.clone();
                    let dans_les_temps = date(&c.expire_le, "expiration").map(|d| maintenant < d).unwrap_or(false);
                    e.motif = if en_ligne {
                        format!("Droits lus à l'instant ; le jeton vaut jusqu'au {}.", expire)
                    } else if !dans_les_temps {
                        format!(
                            "Centre de contrôle injoignable : agents autorisés jusqu'au {}.{}",
                            grace.clone().unwrap_or_default(),
                            panne.map(|p| format!(" ({})", p)).unwrap_or_default()
                        )
                    } else {
                        format!(
                            "Dernier jeton reçu : il vaut jusqu'au {}{}.{}",
                            expire,
                            grace.map(|g| format!(", puis jusqu'au {} si le centre de contrôle reste injoignable", g)).unwrap_or_default(),
                            panne.map(|p| format!(" ({})", p)).unwrap_or_default()
                        )
                    };
                }
                Err(m) => e.motif = format!("Le jeton rangé ne vaut plus : {}.", m),
            }
        }
        Err(m) => {
            e.motif = format!("Le jeton rangé ne vaut plus : {}.", m);
        }
    }
    e
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

fn maintenant() -> DateTime<Utc> {
    Utc::now()
}

fn horodatage(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn adresse_et_box(reglages: &Reglages) -> Result<(String, String), String> {
    let adresse = non_vide(&reglages.adresse)
        .ok_or("Poste non relié : aucune adresse de plateforme n'est posée (réglage de l'écran Box, ou PLATEFORME_URL).")?
        .trim_end_matches('/')
        .to_string();
    adresse_recevable(&adresse)?;
    let device_id = non_vide(&reglages.device_id)
        .ok_or("Cette Box n'a pas d'identifiant de plateforme : il est donné au provisioning et se pose dans l'écran Box.")?
        .to_string();
    Ok((adresse, device_id))
}

/// A failed call: what to tell the user, and how it ended (for the licence).
#[derive(Debug, Clone, PartialEq)]
pub struct ErreurPlateforme {
    pub issue: Issue,
    pub motif: String,
}

impl ErreurPlateforme {
    fn locale(motif: impl Into<String>) -> Self {
        ErreurPlateforme { issue: Issue::Locale, motif: motif.into() }
    }
}

impl From<String> for ErreurPlateforme {
    fn from(motif: String) -> Self {
        ErreurPlateforme::locale(motif)
    }
}

impl From<&str> for ErreurPlateforme {
    fn from(motif: &str) -> Self {
        ErreurPlateforme::locale(motif)
    }
}

async fn lire_reponse(r: reqwest::Response, adresse: &str) -> Result<serde_json::Value, ErreurPlateforme> {
    let statut = r.status();
    let texte = r.text().await.unwrap_or_default();
    let corps: serde_json::Value = serde_json::from_str(&texte).unwrap_or(serde_json::Value::Null);
    if statut.is_success() {
        return Ok(corps);
    }
    let issue = Issue::Statut(statut.as_u16());
    if let Some(m) = corps.get("erreur").and_then(|v| v.as_str()) {
        return Err(ErreurPlateforme { issue, motif: format!("La plateforme refuse : {}", m) });
    }
    let motif = match statut.as_u16() {
        404 => format!("La plateforme ({}) ne sert pas encore cette adresse.", hote(adresse)),
        s => format!("La plateforme ({}) a répondu {} sans dire pourquoi.", hote(adresse), s),
    };
    Err(ErreurPlateforme { issue, motif })
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(DELAI_RESEAU)
        .build()
        .map_err(|e| format!("Client réseau indisponible : {}", e))
}

/// A signed call to a `box` route. `chemin` may carry a query string; only the
/// path is signed, as the server does (`url.pathname`).
pub async fn appel_box(methode: &str, chemin: &str, corps: Option<&serde_json::Value>) -> Result<serde_json::Value, String> {
    appel_box_detaille(methode, chemin, corps).await.map_err(|e| e.motif)
}

/// Same call, keeping how it ended: the licence needs to tell an unreachable
/// platform from a refusing one (`joignabilite`).
async fn appel_box_detaille(
    methode: &str,
    chemin: &str,
    corps: Option<&serde_json::Value>,
) -> Result<serde_json::Value, ErreurPlateforme> {
    let reglages = lire_reglages();
    let (adresse, device_id) = adresse_et_box(&reglages)?;
    let paire = identite()?;
    let texte = corps.map(|c| c.to_string()).unwrap_or_default();
    let h = horodatage(maintenant());
    let chemin_signe = chemin.split('?').next().unwrap_or(chemin);
    let signature = signer(&paire, &message_a_signer(methode, chemin_signe, &h, &texte));
    let url = format!("{}{}", adresse, chemin);
    let mut req = match methode {
        "GET" => client()?.get(&url),
        "POST" => client()?.post(&url),
        "PUT" => client()?.put(&url),
        autre => return Err(ErreurPlateforme::locale(format!("méthode {} non prévue", autre))),
    };
    req = req
        .header("x-box-id", &device_id)
        .header("x-horodatage", &h)
        .header("x-signature", signature);
    if corps.is_some() {
        req = req.header("content-type", "application/json").body(texte);
    }
    // The error message names the host only, never the full address.
    let r = req.send().await.map_err(|_| ErreurPlateforme {
        issue: Issue::Reseau,
        motif: format!("La plateforme ({}) ne répond pas : le poste est hors ligne, ou elle est arrêtée.", hote(&adresse)),
    })?;
    lire_reponse(r, &adresse).await
}

/// Fetches the rights, verifies the token, and stores it only if it holds.
/// A 401/403 throws the stored token away at once: the Box was suspended,
/// returned or replaced, and no grace applies.
async fn rafraichir(reglages: &Reglages) -> Result<LicenceRangee, ErreurPlateforme> {
    let reponse = match appel_box_detaille("GET", "/controle/box/droits", None).await {
        Ok(r) => r,
        Err(e) => {
            if revoquee(&e.issue) {
                oublier_licence();
            }
            return Err(e);
        }
    };
    // From here on the platform answered: any refusal is « joignable ».
    let refus = |m: String| ErreurPlateforme { issue: Issue::Statut(200), motif: m };
    let jeton = reponse
        .get("jeton")
        .and_then(|v| v.as_str())
        .ok_or_else(|| refus("La plateforme n'a pas rendu de jeton de licence.".into()))?;
    let device_id = non_vide(&reglages.device_id).unwrap_or_default();
    lire_jeton(jeton, non_vide(&reglages.cle_plateforme).unwrap_or_default(), device_id, non_vide(&reglages.cle_box), maintenant())
        .map_err(|m| refus(format!("Le jeton reçu est refusé : {}.", m)))?;
    let rangee = LicenceRangee { jeton: jeton.to_string(), recu_le: horodatage(maintenant()) };
    ecrire_json(fichier_licence(Sens::Ecrire), &rangee)?;
    Ok(rangee)
}

fn oublier_licence() {
    let _ = std::fs::remove_file(fichier_licence(Sens::Ecrire));
}

/// The fingerprint of the card this agent will be built from, read through
/// the same lookup as `lire_fiche`. None when it cannot be read.
fn empreinte_sur_disque(fiche_id: &str) -> Option<String> {
    let chemin = crate::fiches::chemin_fiche(fiche_id).ok()?;
    std::fs::read(chemin).ok().map(|o| empreinte_fiche(&o))
}

/// Called before an agent works (task or conversation turn).
///
/// Not provisioned: allowed, as before. Provisioned: the stored token is
/// refreshed when it is missing, older than an hour, or does not let this
/// agent run as it stands. Renewal thus happens well before `expire_le`.
/// Unreachable platform: the stored token serves until `grace_jusqu_au`.
/// Platform answering 401/403: token thrown away, agent stopped.
pub async fn autoriser(fiche_id: &str) -> Result<(), String> {
    let reglages = lire_reglages();
    if !reglages.provisionnee() {
        return Ok(());
    }
    let empreinte = empreinte_sur_disque(fiche_id);
    let mut ctx = Contexte { fiche_id, empreinte_disque: empreinte.as_deref(), joignable: Joignabilite::Joignable };
    let mut rangee = lire_licence();
    let t = maintenant();
    let a_rafraichir = match &rangee {
        None => true,
        Some(r) => {
            let vieux = date(&r.recu_le, "réception").map(|d| (t - d).num_seconds() > RAFRAICHIR_APRES_S).unwrap_or(true);
            vieux || decider(&reglages, Some(&r.jeton), &ctx, t).is_err()
        }
    };
    if a_rafraichir {
        match rafraichir(&reglages).await {
            Ok(neuve) => rangee = Some(neuve),
            Err(e) if revoquee(&e.issue) => {
                return Err(format!("Cet agent ne s'exécute pas : la plateforme ne reconnaît plus cette Box. {}", e.motif));
            }
            Err(e) => ctx.joignable = joignabilite(&e.issue),
        }
    }
    decider(&reglages, rangee.as_ref().map(|r| r.jeton.as_str()), &ctx, t)
}

// ---------------------------------------------------------------------------
// Machine health (what the Box can measure about itself)
// ---------------------------------------------------------------------------

/// Only what is measured; `None` where this system gives nothing to read.
#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct Sante {
    /// Load average over one minute divided by the number of cores.
    pub cpu: Option<f64>,
    /// Share of memory in use (0-1).
    pub memoire: Option<f64>,
    /// Share of the data disk in use (0-1). Not measured: no portable reading
    /// without a new library, so it stays empty rather than guessed.
    pub disque: Option<f64>,
    /// Degrees Celsius, first thermal zone.
    pub temperature: Option<f64>,
    pub version_desktop: String,
}

pub fn memoire_utilisee(meminfo: &str) -> Option<f64> {
    let champ = |nom: &str| {
        meminfo
            .lines()
            .find(|l| l.starts_with(nom))
            .and_then(|l| l.split_whitespace().nth(1))
            .and_then(|v| v.parse::<f64>().ok())
    };
    let total = champ("MemTotal:")?;
    let dispo = champ("MemAvailable:")?;
    (total > 0.0).then(|| ((total - dispo) / total).clamp(0.0, 1.0))
}

pub fn mesurer_sante() -> Sante {
    let coeurs = std::thread::available_parallelism().map(|n| n.get() as f64).unwrap_or(1.0);
    let cpu = std::fs::read_to_string("/proc/loadavg")
        .ok()
        .and_then(|t| t.split_whitespace().next().and_then(|v| v.parse::<f64>().ok()))
        .map(|c| c / coeurs);
    let memoire = std::fs::read_to_string("/proc/meminfo").ok().and_then(|t| memoire_utilisee(&t));
    let temperature = std::fs::read_to_string("/sys/class/thermal/thermal_zone0/temp")
        .ok()
        .and_then(|t| t.trim().parse::<f64>().ok())
        .map(|m| m / 1000.0);
    Sante { cpu, memoire, disque: None, temperature, version_desktop: env!("CARGO_PKG_VERSION").to_string() }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct EtatPlateforme {
    pub relie: bool,
    pub adresse: Option<String>,
    pub device_id: Option<String>,
    pub cle_plateforme_posee: bool,
    /// This Box's public key, if the identity exists. Never the private key.
    pub cle_publique_box: Option<String>,
    /// X25519 public key (raw, base64url), sent at provisioning as
    /// `cle_chiffrement_publique`. Never the private key.
    pub cle_chiffrement_publique: Option<String>,
    pub licence: EtatLicence,
    /// What is missing, in French, for the screens to say.
    pub manque: Vec<String>,
}

fn etat(reglages: &Reglages, licence: EtatLicence) -> EtatPlateforme {
    let mut manque = vec![];
    if non_vide(&reglages.adresse).is_none() {
        manque.push("l'adresse de la plateforme".to_string());
    }
    if non_vide(&reglages.cle_plateforme).is_none() {
        manque.push("la clé publique de la plateforme".to_string());
    }
    if non_vide(&reglages.device_id).is_none() {
        manque.push("l'identifiant de Box donné au provisioning".to_string());
    }
    if non_vide(&reglages.cle_box).is_none() {
        manque.push("l'identité de cette Box (à créer)".to_string());
    }
    if non_vide(&reglages.cle_chiffrement).is_none() {
        manque.push("la clé de chiffrement de cette Box (à créer)".to_string());
    }
    EtatPlateforme {
        relie: reglages.provisionnee(),
        adresse: non_vide(&reglages.adresse).map(String::from),
        device_id: non_vide(&reglages.device_id).map(String::from),
        cle_plateforme_posee: non_vide(&reglages.cle_plateforme).is_some(),
        cle_publique_box: non_vide(&reglages.cle_box).map(String::from),
        cle_chiffrement_publique: non_vide(&reglages.cle_chiffrement).map(String::from),
        licence,
        manque,
    }
}

/// Settings and the stored licence, without any network call.
#[tauri::command]
pub fn plateforme_etat() -> EtatPlateforme {
    let r = lire_reglages();
    let l = etat_licence(&r, lire_licence().as_ref(), None, maintenant(), None);
    etat(&r, l)
}

/// Creates the Box identity and its encryption key if needed and returns the
/// identity's PUBLIC key (PEM); both public keys are then in `plateforme_etat`
/// (`cle_publique_box`, `cle_chiffrement_publique`), to be entered at
/// provisioning. The private keys stay in the keyring.
#[tauri::command]
pub fn plateforme_identite() -> Result<String, String> {
    let pem = cle_publique_pem(&identite()?);
    let chiffrement = cle_chiffrement_publique(&cle_de_chiffrement()?);
    let r = lire_reglages();
    if r.cle_box.as_deref() != Some(pem.as_str()) || r.cle_chiffrement.as_deref() != Some(chiffrement.as_str()) {
        // PLATEFORME_URL must not end up written in the file.
        let mut fichier: Reglages = std::fs::read_to_string(fichier_reglages(Sens::Lire))
            .ok()
            .and_then(|t| serde_json::from_str(&t).ok())
            .unwrap_or_default();
        fichier.cle_box = Some(pem.clone());
        fichier.cle_chiffrement = Some(chiffrement);
        ecrire_json(fichier_reglages(Sens::Ecrire), &fichier)?;
    }
    Ok(pem)
}

/// Links the Box. Without a platform key given, it is read once from
/// `GET /controle/cle-publique` and pinned (trust on first use, stated on the
/// screen).
#[tauri::command]
pub async fn plateforme_regler(
    adresse: Option<String>,
    device_id: Option<String>,
    cle_plateforme: Option<String>,
) -> Result<EtatPlateforme, String> {
    let fichier: Reglages = std::fs::read_to_string(fichier_reglages(Sens::Lire))
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default();
    let mut neuf = reglages_modifies(&fichier, adresse, device_id, cle_plateforme)?;
    if non_vide(&neuf.cle_plateforme).is_none() {
        let mut vue = neuf.clone();
        if let Ok(v) = std::env::var("PLATEFORME_URL") {
            if !v.trim().is_empty() {
                vue.adresse = Some(v.trim().to_string());
            }
        }
        if let Some(adresse) = non_vide(&vue.adresse).map(|a| a.trim_end_matches('/').to_string()) {
            adresse_recevable(&adresse)?;
            let r = client()?
                .get(format!("{}/controle/cle-publique", adresse))
                .send()
                .await
                .map_err(|_| format!("La plateforme ({}) ne répond pas : la clé publique n'a pas pu être lue.", hote(&adresse)))?;
            let corps = lire_reponse(r, &adresse).await.map_err(|e| e.motif)?;
            let pem = corps
                .get("cle_publique")
                .and_then(|v| v.as_str())
                .ok_or("La plateforme n'a pas rendu sa clé publique.")?;
            neuf = reglages_modifies(&neuf, None, None, Some(pem.to_string()))?;
        }
    }
    ecrire_json(fichier_reglages(Sens::Ecrire), &neuf)?;
    Ok(plateforme_etat())
}

/// Rights from the platform now, or the last stored token when offline.
#[tauri::command]
pub async fn plateforme_droits() -> EtatPlateforme {
    let r = lire_reglages();
    if !r.provisionnee() {
        return plateforme_etat();
    }
    // A 401/403 has already thrown the stored token away in `rafraichir`.
    let (rangee, joignable, panne) = match rafraichir(&r).await {
        Ok(neuve) => (Some(neuve), Joignabilite::Joignable, None),
        Err(e) => (lire_licence(), joignabilite(&e.issue), Some(e.motif)),
    };
    let l = etat_licence(&r, rangee.as_ref(), Some(joignable), maintenant(), panne);
    etat(&r, l)
}

#[tauri::command]
pub fn plateforme_sante() -> Sante {
    mesurer_sante()
}

/// The body of `POST /controle/box/telemetrie`. The Control Plane takes cpu,
/// memory and disk in PERCENT (0-100) while `Sante` keeps shares (0-1) for the
/// screen: sent as is, 42 % would have been stored as 0.42 % without a word.
/// Absent measures are left out rather than sent as zero.
pub fn corps_telemetrie(s: &Sante) -> serde_json::Value {
    let pourcent = |v: Option<f64>| v.map(|x| (x * 100.0).clamp(0.0, 100.0));
    let mut c = serde_json::Map::new();
    for (cle, v) in [
        ("cpu", pourcent(s.cpu)),
        ("memoire", pourcent(s.memoire)),
        ("disque", pourcent(s.disque)),
        ("temperature", s.temperature),
    ] {
        if let Some(x) = v {
            c.insert(cle.into(), serde_json::json!(x));
        }
    }
    c.insert("version_desktop".into(), serde_json::json!(s.version_desktop));
    serde_json::Value::Object(c)
}

#[tauri::command]
pub async fn plateforme_telemetrie_envoyer() -> Result<serde_json::Value, String> {
    let corps = corps_telemetrie(&mesurer_sante());
    appel_box("POST", "/controle/box/telemetrie", Some(&corps)).await
}

#[tauri::command]
pub async fn plateforme_mises_a_jour() -> Result<serde_json::Value, String> {
    appel_box("GET", "/controle/box/mises-a-jour", None).await
}

#[tauri::command]
pub async fn plateforme_skills() -> Result<serde_json::Value, String> {
    appel_box("GET", "/controle/box/skills", None).await
}

// ---------------------------------------------------------------------------
// Skill Packs: signed AND encrypted for this Box (MASTER §6)
// ---------------------------------------------------------------------------

/// `GET /controle/box/skills/:id/contenu`, binary fields in base64url without
/// padding.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct PaquetChiffre {
    pub skill_pack_id: String,
    pub version: String,
    /// SHA-256 hex of the plaintext.
    pub empreinte: String,
    /// Ed25519 by the platform key over `message_skill`.
    pub signature: String,
    /// The platform's one-time X25519 public key (32 bytes).
    pub ephemere_publique: String,
    /// AES-GCM nonce (12 bytes).
    pub nonce: String,
    /// Ciphertext followed by the 16-byte tag.
    pub chiffre: String,
}

/// What the platform signs for a Skill Pack.
pub fn message_skill(id: &str, version: &str, empreinte: &str) -> String {
    format!("iagent-skill-v1\n{}\n{}\n{}", id, version, empreinte)
}

/// HKDF info, also the AES-GCM associated data: binds the key and the
/// ciphertext to this Box, this pack and this version.
pub fn info_skill(device_id: &str, id: &str, version: &str) -> String {
    format!("iagent-skill-v1|{}|{}|{}", device_id, id, version)
}

struct Longueur(usize);

impl ring::hkdf::KeyType for Longueur {
    fn len(&self) -> usize {
        self.0
    }
}

fn octets_b64(champ: &str, texte: &str) -> Result<Vec<u8>, String> {
    URL_SAFE_NO_PAD
        .decode(texte.trim_end_matches('='))
        .map_err(|_| format!("le Skill Pack porte un champ « {} » illisible", champ))
}

/// X25519 between the Box key and the one-time platform key, then HKDF-SHA256
/// (empty salt, `info`) to 32 bytes: the AES-256-GCM key.
pub fn cle_skill(secret_box: &x25519_dalek::StaticSecret, ephemere: &[u8; 32], info: &str) -> Result<[u8; 32], String> {
    use ring::hkdf::{Salt, HKDF_SHA256};
    let partage = secret_box.diffie_hellman(&x25519_dalek::PublicKey::from(*ephemere));
    if !partage.was_contributory() {
        return Err("la clé éphémère du Skill Pack est dégénérée : refusée".to_string());
    }
    let mut cle = [0u8; 32];
    Salt::new(HKDF_SHA256, &[])
        .extract(partage.as_bytes())
        .expand(&[info.as_bytes()], Longueur(32))
        .and_then(|okm| okm.fill(&mut cle))
        .map_err(|_| "la clé du Skill Pack n'a pas pu être dérivée".to_string())?;
    Ok(cle)
}

/// Verifies and decrypts a Skill Pack, in memory only. Every refusal says why;
/// nothing is returned unless the signature, the decryption and the
/// fingerprint all hold.
/// `attendu` is the pack's `id` as listed by `GET /controle/box/skills`:
/// `<skill_pack_id>@<version>`.
pub fn ouvrir_skill(
    paquet: &PaquetChiffre,
    attendu: &str,
    secret_box: &x25519_dalek::StaticSecret,
    device_id: &str,
    cle_plateforme_pem: &str,
) -> Result<Vec<u8>, String> {
    use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};

    let rendu = format!("{}@{}", paquet.skill_pack_id, paquet.version);
    if rendu != attendu {
        return Err(format!("la plateforme a rendu le Skill Pack {} au lieu de {}", rendu, attendu));
    }
    let signature = octets_b64("signature", &paquet.signature)?;
    let cle = brute_depuis_pem(cle_plateforme_pem)?;
    UnparsedPublicKey::new(&ED25519, cle)
        .verify(message_skill(&paquet.skill_pack_id, &paquet.version, &paquet.empreinte).as_bytes(), &signature)
        .map_err(|_| "le Skill Pack n'est pas signé par la plateforme".to_string())?;

    let ephemere: [u8; 32] = octets_b64("ephemere_publique", &paquet.ephemere_publique)?
        .try_into()
        .map_err(|_| "la clé éphémère du Skill Pack n'a pas 32 octets".to_string())?;
    let info = info_skill(device_id, &paquet.skill_pack_id, &paquet.version);
    let cle_aes = cle_skill(secret_box, &ephemere, &info)?;

    let nonce: [u8; 12] = octets_b64("nonce", &paquet.nonce)?
        .try_into()
        .map_err(|_| "le nonce du Skill Pack n'a pas 12 octets".to_string())?;
    let mut tampon = octets_b64("chiffre", &paquet.chiffre)?;
    let cle = LessSafeKey::new(UnboundKey::new(&AES_256_GCM, &cle_aes).map_err(|_| "clé AES refusée".to_string())?);
    let clair = cle
        .open_in_place(Nonce::assume_unique_for_key(nonce), Aad::from(info.as_bytes()), &mut tampon)
        .map_err(|_| "le Skill Pack ne se déchiffre pas avec la clé de cette Box : il a été modifié, ou chiffré pour une autre Box".to_string())?
        .to_vec();
    if !empreinte_hex(&clair).eq_ignore_ascii_case(&paquet.empreinte) {
        return Err("le contenu déchiffré du Skill Pack n'a pas l'empreinte signée".to_string());
    }
    Ok(clair)
}

/// Decrypted Skill Packs, in this process's memory only: never written to
/// disk, gone when the application stops.
static SKILLS_EN_MEMOIRE: std::sync::Mutex<Vec<(String, String, Vec<u8>)>> = std::sync::Mutex::new(Vec::new());

/// The plaintext of a pack opened during this session, if any.
#[allow(dead_code)] // read by the agents once Skill Packs feed their prompts
pub fn skill_en_memoire(id: &str) -> Option<Vec<u8>> {
    SKILLS_EN_MEMOIRE.lock().ok()?.iter().find(|(i, _, _)| i == id).map(|(_, _, c)| c.clone())
}

/// What the screen learns about an opened pack: never its content.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SkillOuvert {
    pub skill_pack_id: String,
    pub version: String,
    pub empreinte: String,
    pub taille: usize,
}

#[tauri::command]
pub async fn plateforme_skill_ouvrir(id: String) -> Result<SkillOuvert, String> {
    // `<skill_pack_id>@<version>`: letters, digits, - _ . and one @, nothing
    // that could walk out of the route.
    let (nom, version) = id.split_once('@').ok_or_else(|| format!("« {} » n'est pas un identifiant de Skill Pack (nom@version).", id))?;
    identifiant_recevable(nom)?;
    if version.is_empty() || !version.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
        return Err(format!("« {} » n'est pas une version de Skill Pack valable.", version));
    }
    let reglages = lire_reglages();
    let device_id = non_vide(&reglages.device_id)
        .ok_or("Cette Box n'a pas d'identifiant de plateforme : aucun Skill Pack ne peut lui être destiné.")?
        .to_string();
    let cle_plateforme = non_vide(&reglages.cle_plateforme)
        .ok_or("La clé publique de la plateforme n'est pas posée : la signature d'un Skill Pack ne peut pas être vérifiée.")?
        .to_string();
    let reponse = appel_box("GET", &format!("/controle/box/skills/{}/contenu", id), None).await?;
    let paquet: PaquetChiffre = serde_json::from_value(reponse)
        .map_err(|_| "La plateforme a rendu un Skill Pack qui n'a pas la forme attendue.".to_string())?;
    let clair = ouvrir_skill(&paquet, &id, &cle_de_chiffrement()?, &device_id, &cle_plateforme)
        .map_err(|m| format!("Skill Pack refusé : {}.", m))?;
    let ouvert = SkillOuvert {
        skill_pack_id: paquet.skill_pack_id.clone(),
        version: paquet.version.clone(),
        empreinte: paquet.empreinte.clone(),
        taille: clair.len(),
    };
    if let Ok(mut m) = SKILLS_EN_MEMOIRE.lock() {
        m.retain(|(i, _, _)| i != &paquet.skill_pack_id);
        m.push((paquet.skill_pack_id, paquet.version, clair));
    }
    Ok(ouvert)
}

#[tauri::command]
pub async fn plateforme_appels() -> Result<serde_json::Value, String> {
    appel_box("GET", "/voix/box/appels", None).await
}

#[tauri::command]
pub async fn plateforme_handoffs() -> Result<serde_json::Value, String> {
    appel_box("GET", "/voix/box/handoffs", None).await
}

/// An identifier that goes into a path: letters, digits, `-` and `_` only.
pub fn identifiant_recevable(id: &str) -> Result<(), String> {
    if id.is_empty() || id.len() > 128 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err(format!("« {} » n'est pas un identifiant d'appel valable.", id));
    }
    Ok(())
}

/// One of the four handoff decisions: take, refuse, call back, let the agent go on.
#[tauri::command]
pub async fn plateforme_handoff_decider(appel: String, decision: String) -> Result<serde_json::Value, String> {
    identifiant_recevable(&appel)?;
    if !DECISIONS_HANDOFF.contains(&decision.as_str()) {
        return Err(format!("« {} » n'est pas une décision : prendre, refuser, rappeler ou laisser.", decision));
    }
    let corps = serde_json::json!({ "decision": decision });
    appel_box("POST", &format!("/voix/box/handoffs/{}", appel), Some(&corps)).await
}

#[tauri::command]
pub async fn plateforme_consommation() -> Result<serde_json::Value, String> {
    appel_box("GET", "/voix/box/consommation", None).await
}

#[tauri::command]
pub async fn plateforme_projets() -> Result<serde_json::Value, String> {
    appel_box("GET", "/create/box/projets", None).await
}

#[tauri::command]
pub async fn plateforme_projet_creer(etude_id: String) -> Result<serde_json::Value, String> {
    identifiant_recevable(&etude_id).map_err(|_| format!("« {} » n'est pas un identifiant d'étude valable.", etude_id))?;
    appel_box("POST", "/create/box/projets", Some(&serde_json::json!({ "etude_id": etude_id }))).await
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEMOINS: &str = include_str!("../../temoins-plateforme.json");

    fn temoins() -> serde_json::Value {
        serde_json::from_str(TEMOINS).unwrap()
    }

    fn graine(t: &serde_json::Value, qui: &str) -> [u8; 32] {
        let hex = t[qui]["graine_hex"].as_str().unwrap();
        let mut g = [0u8; 32];
        for i in 0..32 {
            g[i] = u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).unwrap();
        }
        g
    }

    /// PKCS#8 v1, exactly what Node builds from the seed in check-plateforme.ts.
    fn pkcs8_v1(g: &[u8; 32]) -> Vec<u8> {
        let mut d = vec![0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];
        d.extend_from_slice(g);
        d
    }

    fn quand(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    fn reliee() -> Reglages {
        let t = temoins();
        Reglages {
            adresse: Some("https://plateforme.exemple".into()),
            device_id: Some("BOX-TEMOIN".into()),
            cle_plateforme: Some(t["plateforme"]["cle_publique_pem"].as_str().unwrap().into()),
            cle_box: Some(t["box"]["cle_publique_pem"].as_str().unwrap().into()),
            cle_chiffrement: None,
        }
    }

    /// Fingerprint of the témoin card, as `autoriser` computes it from disk.
    fn empreinte_temoin() -> &'static str {
        static E: std::sync::OnceLock<String> = std::sync::OnceLock::new();
        E.get_or_init(|| empreinte_fiche(temoins()["licence"]["fiche"].as_str().unwrap().as_bytes()))
    }

    fn ctx(fiche_id: &str) -> Contexte<'_> {
        Contexte { fiche_id, empreinte_disque: Some(empreinte_temoin()), joignable: Joignabilite::Joignable }
    }

    fn injoignable(fiche_id: &str) -> Contexte<'_> {
        Contexte { joignable: Joignabilite::Injoignable, ..ctx(fiche_id) }
    }

    fn jeton() -> String {
        temoins()["licence"]["jeton"].as_str().unwrap().to_string()
    }

    #[test]
    fn le_message_signe_est_celui_du_serveur() {
        let t = temoins();
        for r in t["requetes"].as_array().unwrap() {
            let m = message_a_signer(
                r["methode"].as_str().unwrap(),
                r["chemin"].as_str().unwrap(),
                r["horodatage"].as_str().unwrap(),
                r["corps"].as_str().unwrap(),
            );
            assert_eq!(m, r["message"].as_str().unwrap());
        }
    }

    #[test]
    fn la_signature_rust_est_celle_de_node() {
        let t = temoins();
        let paire = paire_depuis_pkcs8(&pkcs8_v1(&graine(&t, "box"))).unwrap();
        assert_eq!(cle_publique_pem(&paire), t["box"]["cle_publique_pem"].as_str().unwrap());
        for r in t["requetes"].as_array().unwrap() {
            assert_eq!(signer(&paire, r["message"].as_str().unwrap()), r["signature"].as_str().unwrap());
        }
    }

    #[test]
    fn une_cle_publique_fait_l_aller_retour_en_pem() {
        let pem = temoins()["plateforme"]["cle_publique_pem"].as_str().unwrap().to_string();
        assert_eq!(pem_depuis_brute(&brute_depuis_pem(&pem).unwrap()), pem);
        assert!(brute_depuis_pem("-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VuAyEA\n-----END PUBLIC KEY-----").is_err());
    }

    #[test]
    fn le_jeton_temoin_ouvre_ses_deux_agents() {
        let t = quand("2026-10-07T12:00:00Z");
        assert_eq!(decider(&reliee(), Some(&jeton()), &ctx("AG-0179"), t), Ok(()));
        assert_eq!(decider(&reliee(), Some(&jeton()), &ctx("AG-0196"), t), Ok(()));
    }

    #[test]
    fn un_agent_sans_droit_ne_s_execute_pas() {
        let e = decider(&reliee(), Some(&jeton()), &ctx("AG-0028"), quand("2026-10-07T12:00:00Z")).unwrap_err();
        assert!(e.contains("ne s'exécute pas") && e.contains("AG-0028"), "{}", e);
    }

    #[test]
    fn un_droit_termine_ferme_l_agent_mais_pas_les_autres() {
        let t = quand("2026-10-07T19:00:00Z");
        assert!(decider(&reliee(), Some(&jeton()), &ctx("AG-0196"), t).unwrap_err().contains("a pris fin"));
        assert_eq!(decider(&reliee(), Some(&jeton()), &ctx("AG-0179"), t), Ok(()));
    }

    // The three cases the coordinator fixed (token issued 07/10 10:00,
    // expires +24 h, grace until +72 h).
    #[test]
    fn injoignable_le_jeton_vaut_encore_a_30_h() {
        assert_eq!(decider(&reliee(), Some(&jeton()), &injoignable("AG-0179"), quand("2026-10-08T16:00:00Z")), Ok(()));
    }

    #[test]
    fn joignable_le_jeton_est_refuse_a_30_h() {
        let e = decider(&reliee(), Some(&jeton()), &ctx("AG-0179"), quand("2026-10-08T16:00:00Z")).unwrap_err();
        assert!(e.contains("a expiré") && e.contains("joignable"), "{}", e);
    }

    #[test]
    fn a_73_h_plus_rien_meme_injoignable() {
        let e = decider(&reliee(), Some(&jeton()), &injoignable("AG-0179"), quand("2026-10-10T11:00:00Z")).unwrap_err();
        assert!(e.contains("grâce a pris fin"), "{}", e);
    }

    #[test]
    fn avant_l_expiration_le_jeton_vaut_dans_les_deux_cas() {
        let t = quand("2026-10-08T09:59:00Z");
        assert_eq!(decider(&reliee(), Some(&jeton()), &ctx("AG-0179"), t), Ok(()));
        assert_eq!(decider(&reliee(), Some(&jeton()), &injoignable("AG-0179"), t), Ok(()));
    }

    #[test]
    fn seuls_le_reseau_et_les_5xx_ouvrent_la_grace() {
        assert_eq!(joignabilite(&Issue::Reseau), Joignabilite::Injoignable);
        assert_eq!(joignabilite(&Issue::Statut(500)), Joignabilite::Injoignable);
        assert_eq!(joignabilite(&Issue::Statut(503)), Joignabilite::Injoignable);
        for s in [200, 400, 401, 403, 404, 409] {
            assert_eq!(joignabilite(&Issue::Statut(s)), Joignabilite::Joignable, "{}", s);
        }
        assert_eq!(joignabilite(&Issue::Locale), Joignabilite::Joignable);
        assert!(revoquee(&Issue::Statut(401)) && revoquee(&Issue::Statut(403)));
        assert!(!revoquee(&Issue::Statut(503)) && !revoquee(&Issue::Reseau) && !revoquee(&Issue::Statut(404)));
    }

    #[test]
    fn une_fiche_modifiee_ou_illisible_ne_s_execute_pas() {
        let t = quand("2026-10-07T12:00:00Z");
        let autre = empreinte_fiche(b"{\"id\":\"AG-0179\",\"nom\":\"Fiche modifiee\"}\n");
        let modifiee = Contexte { empreinte_disque: Some(&autre), ..ctx("AG-0179") };
        let e = decider(&reliee(), Some(&jeton()), &modifiee, t).unwrap_err();
        assert!(e.contains("a été modifiée") && e.contains("n'est pas celle de la licence"), "{}", e);
        let illisible = Contexte { empreinte_disque: None, ..ctx("AG-0179") };
        assert!(decider(&reliee(), Some(&jeton()), &illisible, t).unwrap_err().contains("pas pu être lue"));
        // Unlinked workstation: nothing changes, card or not.
        assert_eq!(decider(&Reglages::default(), None, &modifiee, t), Ok(()));
    }

    #[test]
    fn un_jeton_v1_est_refuse_sur_une_box_reliee() {
        let t = temoins();
        let paire = paire_depuis_pkcs8(&pkcs8_v1(&graine(&t, "plateforme"))).unwrap();
        let mut charge = t["licence"]["charge"].clone();
        charge["v"] = 1.into();
        let texte = URL_SAFE_NO_PAD.encode(charge.to_string());
        let sig = URL_SAFE_NO_PAD.encode(paire.sign(texte.as_bytes()).as_ref());
        let e = decider(&reliee(), Some(&format!("{}.{}", texte, sig)), &ctx("AG-0179"), quand("2026-10-07T12:00:00Z")).unwrap_err();
        assert!(e.contains("v1") && e.contains("empreinte"), "{}", e);
    }

    // --- Shared vectors of the controle workstream (temoins-signature.json) ---

    const SIGNATURE: &str = include_str!("../../../plateforme/controle/temoins-signature.json");

    fn partages() -> serde_json::Value {
        serde_json::from_str(SIGNATURE).unwrap()
    }

    #[test]
    fn les_temoins_partages_de_grace_tranchent_pareil() {
        let s = partages();
        let octets = s["fiche"]["octets_utf8"].as_str().unwrap().as_bytes();
        let empreinte = empreinte_fiche(octets);
        assert_eq!(empreinte, s["fiche"]["empreinte_sha256"].as_str().unwrap());
        let reglages = Reglages {
            adresse: Some("https://plateforme.exemple".into()),
            device_id: Some(s["jeton"]["charge"]["device_id"].as_str().unwrap().into()),
            cle_plateforme: Some(s["plateforme"]["cle_publique_pem"].as_str().unwrap().into()),
            ..Default::default()
        };
        let jeton = s["jeton"]["jeton"].as_str().unwrap();
        let fiche_id = s["jeton"]["charge"]["droits"][0]["agent_template_id"].as_str().unwrap();
        let cas = s["jeton"]["verifications"].as_array().unwrap();
        assert_eq!(cas.len(), 4);
        for c in cas {
            let joignable = if c["injoignable"].as_bool().unwrap() { Joignabilite::Injoignable } else { Joignabilite::Joignable };
            let ctx = Contexte { fiche_id, empreinte_disque: Some(&empreinte), joignable };
            let r = decider(&reglages, Some(jeton), &ctx, quand(c["maintenant"].as_str().unwrap()));
            assert_eq!(r.is_ok(), c["valide"].as_bool().unwrap(), "{} : {:?}", c["cas"], r);
        }
    }

    fn cle32(texte: &str) -> [u8; 32] {
        URL_SAFE_NO_PAD.decode(texte).unwrap().try_into().unwrap()
    }

    fn paquet_partage(s: &serde_json::Value) -> PaquetChiffre {
        PaquetChiffre {
            skill_pack_id: s["skill"]["skill_pack_id"].as_str().unwrap().into(),
            version: s["skill"]["version"].as_str().unwrap().into(),
            empreinte: s["skill"]["empreinte"].as_str().unwrap().into(),
            signature: s["skill"]["signature"].as_str().unwrap().into(),
            ephemere_publique: s["chiffrement"]["ephemere_publique"].as_str().unwrap().into(),
            nonce: s["chiffrement"]["nonce"].as_str().unwrap().into(),
            chiffre: s["chiffrement"]["chiffre"].as_str().unwrap().into(),
        }
    }

    #[test]
    fn les_temoins_partages_de_skill_pack_s_ouvrent() {
        let s = partages();
        let p = paquet_partage(&s);
        let device = s["chiffrement"]["device_id"].as_str().unwrap();
        assert_eq!(message_skill(&p.skill_pack_id, &p.version, &p.empreinte), s["skill"]["message_signe"].as_str().unwrap());
        assert_eq!(info_skill(device, &p.skill_pack_id, &p.version), s["chiffrement"]["info"].as_str().unwrap());
        let secret = x25519_dalek::StaticSecret::from(cle32(s["chiffrement"]["box_x25519_privee"].as_str().unwrap()));
        assert_eq!(cle_chiffrement_publique(&secret), s["chiffrement"]["box_x25519_publique"].as_str().unwrap());
        let ephemere = cle32(&p.ephemere_publique);
        let cle = cle_skill(&secret, &ephemere, &info_skill(device, &p.skill_pack_id, &p.version)).unwrap();
        let hex: String = cle.iter().map(|b| format!("{:02x}", b)).collect();
        assert_eq!(hex, s["chiffrement"]["cle_derivee_hex"].as_str().unwrap());
        let id = format!("{}@{}", p.skill_pack_id, p.version);
        let pem = s["plateforme"]["cle_publique_pem"].as_str().unwrap();
        let clair = ouvrir_skill(&p, &id, &secret, device, pem).unwrap();
        assert_eq!(String::from_utf8(clair).unwrap(), s["skill"]["contenu"].as_str().unwrap());
    }

    #[test]
    fn un_skill_pack_altere_ou_d_une_autre_box_est_refuse() {
        let s = partages();
        let p = paquet_partage(&s);
        let device = s["chiffrement"]["device_id"].as_str().unwrap();
        let pem = s["plateforme"]["cle_publique_pem"].as_str().unwrap();
        let secret = x25519_dalek::StaticSecret::from(cle32(s["chiffrement"]["box_x25519_privee"].as_str().unwrap()));
        let id = format!("{}@{}", p.skill_pack_id, p.version);
        // One byte of the ciphertext, then of the tag.
        let mut octets = URL_SAFE_NO_PAD.decode(&p.chiffre).unwrap();
        octets[3] ^= 1;
        let e = ouvrir_skill(&PaquetChiffre { chiffre: URL_SAFE_NO_PAD.encode(&octets), ..p.clone() }, &id, &secret, device, pem).unwrap_err();
        assert!(e.contains("ne se déchiffre pas"), "{}", e);
        let mut octets = URL_SAFE_NO_PAD.decode(&p.chiffre).unwrap();
        let n = octets.len();
        octets[n - 1] ^= 0x80;
        assert!(ouvrir_skill(&PaquetChiffre { chiffre: URL_SAFE_NO_PAD.encode(&octets), ..p.clone() }, &id, &secret, device, pem).is_err());
        // Another Box: another private key, or the same ciphertext replayed for another device.
        let autre = x25519_dalek::StaticSecret::from([0x42u8; 32]);
        assert!(ouvrir_skill(&p, &id, &autre, device, pem).unwrap_err().contains("ne se déchiffre pas"));
        assert!(ouvrir_skill(&p, &id, &secret, "BOX-AUTRE", pem).is_err());
        // A signature by another key, or over another fingerprint.
        let autre_pem = temoins()["plateforme"]["cle_publique_pem"].as_str().unwrap().to_string();
        assert!(ouvrir_skill(&p, &id, &secret, device, &autre_pem).unwrap_err().contains("pas signé"));
        assert!(ouvrir_skill(&PaquetChiffre { empreinte: "f".repeat(64), ..p.clone() }, &id, &secret, device, pem).unwrap_err().contains("pas signé"));
        // Another pack than the one asked for.
        assert!(ouvrir_skill(&p, "autre@1.0.0", &secret, device, pem).unwrap_err().contains("au lieu de"));
    }

    /// The desktop's own vector: encrypted by node:crypto in check-plateforme.ts,
    /// opened here by ring and x25519-dalek.
    #[test]
    fn le_skill_pack_chiffre_par_node_s_ouvre_en_rust() {
        let t = temoins();
        let p: PaquetChiffre = serde_json::from_value(t["skill"]["paquet"].clone()).unwrap();
        let secret = x25519_dalek::StaticSecret::from(graine(&t, "chiffrement"));
        assert_eq!(cle_chiffrement_publique(&secret), t["chiffrement"]["cle_publique"].as_str().unwrap());
        let id = format!("{}@{}", p.skill_pack_id, p.version);
        let clair = ouvrir_skill(&p, &id, &secret, "BOX-TEMOIN", t["plateforme"]["cle_publique_pem"].as_str().unwrap()).unwrap();
        assert_eq!(String::from_utf8(clair).unwrap(), t["skill"]["clair"].as_str().unwrap());
    }

    #[test]
    fn un_jeton_modifie_ou_d_une_autre_box_est_refuse() {
        let t = quand("2026-10-07T12:00:00Z");
        let j = jeton();
        let (c, s) = j.split_once('.').unwrap();
        // Same payload, AG-0028 added: the signature no longer matches.
        let mut charge: serde_json::Value = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(c).unwrap()).unwrap();
        charge["droits"][0]["agent_template_id"] = "AG-0028".into();
        let truque = format!("{}.{}", URL_SAFE_NO_PAD.encode(charge.to_string()), s);
        assert!(decider(&reliee(), Some(&truque), &ctx("AG-0028"), t).unwrap_err().contains("pas signé"));

        let mut autre = reliee();
        autre.device_id = Some("BOX-AUTRE".into());
        assert!(decider(&autre, Some(&j), &ctx("AG-0179"), t).unwrap_err().contains("BOX-TEMOIN"));

        let mut autre_cle = reliee();
        autre_cle.cle_box = autre_cle.cle_plateforme.clone();
        assert!(decider(&autre_cle, Some(&j), &ctx("AG-0179"), t).unwrap_err().contains("autre clé"));
    }

    #[test]
    fn un_jeton_date_dans_le_futur_est_refuse() {
        let e = decider(&reliee(), Some(&jeton()), &ctx("AG-0179"), quand("2026-10-07T09:50:00Z")).unwrap_err();
        assert!(e.contains("futur"), "{}", e);
        assert_eq!(decider(&reliee(), Some(&jeton()), &ctx("AG-0179"), quand("2026-10-07T09:56:00Z")), Ok(()));
    }

    #[test]
    fn un_poste_non_relie_travaille_comme_avant() {
        let t = quand("2026-10-07T12:00:00Z");
        assert_eq!(decider(&Reglages::default(), None, &ctx("AG-0028"), t), Ok(()));
        // An address alone is not provisioning: the platform key is also needed.
        let adresse_seule = Reglages { adresse: Some("https://p.exemple".into()), ..Default::default() };
        assert_eq!(decider(&adresse_seule, None, &ctx("AG-0028"), t), Ok(()));
    }

    #[test]
    fn une_box_reliee_sans_jeton_refuse_et_dit_quoi_faire() {
        let e = decider(&reliee(), None, &ctx("AG-0179"), quand("2026-10-07T12:00:00Z")).unwrap_err();
        assert!(e.contains("aucun droit") && e.contains("écran Box"), "{}", e);
        let mut sans_id = reliee();
        sans_id.device_id = None;
        assert!(decider(&sans_id, Some(&jeton()), &ctx("AG-0179"), quand("2026-10-07T12:00:00Z")).unwrap_err().contains("identifiant"));
    }

    #[test]
    fn la_cle_de_la_plateforme_ne_se_remplace_pas_depuis_l_ecran() {
        let t = temoins();
        let avant = reliee();
        // Same key again: accepted (the screen may resend it).
        assert!(reglages_modifies(&avant, None, None, avant.cle_plateforme.clone()).is_ok());
        let autre = t["box"]["cle_publique_pem"].as_str().unwrap().to_string();
        assert!(reglages_modifies(&avant, None, None, Some(autre)).unwrap_err().contains("ne se remplace pas"));
        assert!(reglages_modifies(&avant, None, Some("BOX-2".into()), None).unwrap_err().contains("BOX-TEMOIN"));
        // An address can move: tokens stay checked against the pinned key.
        let r = reglages_modifies(&avant, Some("https://ailleurs.exemple/".into()), None, None).unwrap();
        assert_eq!(r.adresse.as_deref(), Some("https://ailleurs.exemple"));
    }

    #[test]
    fn l_adresse_se_joint_chiffree() {
        assert!(adresse_recevable("https://plateforme.iagent.agency").is_ok());
        assert!(adresse_recevable("http://127.0.0.1:8787").is_ok());
        assert!(adresse_recevable("http://plateforme.iagent.agency").is_err());
        assert!(adresse_recevable("https://jeton@plateforme.iagent.agency").is_err());
        assert!(adresse_recevable("https://plateforme.iagent.agency?cle=x").is_err());
    }

    #[test]
    fn les_quatre_decisions_et_rien_d_autre() {
        assert_eq!(DECISIONS_HANDOFF, ["prendre", "refuser", "rappeler", "laisser"]);
        assert!(identifiant_recevable("APPEL-1").is_ok());
        assert!(identifiant_recevable("../controle/boxes").is_err());
        assert!(identifiant_recevable("").is_err());
    }

    #[test]
    fn la_telemetrie_part_en_pourcentage_et_sans_mesure_inventee() {
        let s = Sante { cpu: Some(1.7), memoire: Some(0.5), disque: None, temperature: Some(51.0), version_desktop: "0.2.0".into() };
        let c = corps_telemetrie(&s);
        assert_eq!(c["memoire"], serde_json::json!(50.0));
        assert_eq!(c["cpu"], serde_json::json!(100.0));
        assert_eq!(c["temperature"], serde_json::json!(51.0));
        assert!(c.get("disque").is_none());
        assert_eq!(c["version_desktop"], "0.2.0");
    }

    #[test]
    fn la_memoire_utilisee_se_lit_dans_meminfo() {
        let m = memoire_utilisee("MemTotal:       16000000 kB\nMemFree: 1 kB\nMemAvailable:    4000000 kB\n").unwrap();
        assert!((m - 0.75).abs() < 1e-9);
        assert_eq!(memoire_utilisee("MemTotal: 0 kB\n"), None);
    }

    /// keyring 3 without a native feature silently uses its mock store, where a
    /// value lives only in the `Entry` that wrote it (EntryOnly). That was the
    /// 0.2.x build: the API key, the WhatsApp/Telegram tokens and the mail
    /// password were all lost between two commands. This test fails if the
    /// build ever falls back to it again, on any of the three systems.
    #[test]
    fn le_coffre_du_systeme_n_est_pas_le_coffre_factice() {
        use keyring::credential::CredentialPersistence;
        let p = keyring::default::default_credential_builder().persistence();
        let nom = match p {
            CredentialPersistence::EntryOnly => "le coffre factice (rien ne survit à l'objet qui écrit)",
            CredentialPersistence::ProcessOnly => "la mémoire du processus",
            CredentialPersistence::UntilReboot => "le noyau (perdu au redémarrage)",
            CredentialPersistence::UntilDelete => "un vrai coffre",
            _ => "un coffre inconnu",
        };
        assert!(
            matches!(p, CredentialPersistence::UntilDelete),
            "le coffre choisi à la compilation est {} : la clé de la Box et la clé d'API seraient perdues",
            nom
        );
    }

    /// Round trip through the real keyring: written by one `Entry`, read by a
    /// NEW one. Ignored by default because it needs a running keyring (Secret
    /// Service on Linux, a user session on Windows/macOS), which CI and this
    /// container do not have. Run with `cargo test -- --ignored` on a real
    /// workstation.
    #[test]
    #[ignore]
    fn une_valeur_rangee_survit_a_une_nouvelle_entree() {
        let service = "iagent-banc";
        let nom = format!("survie-{}", std::process::id());
        keyring::Entry::new(service, &nom).unwrap().set_password("valeur-de-banc").unwrap();
        let relue = keyring::Entry::new(service, &nom).unwrap().get_password();
        let _ = keyring::Entry::new(service, &nom).unwrap().delete_credential();
        assert_eq!(relue.unwrap(), "valeur-de-banc");
    }

    #[test]
    fn aucun_refus_ne_parle_anglais() {
        let t = quand("2026-10-07T12:00:00Z");
        let refus = [
            decider(&reliee(), None, &ctx("AG-0179"), t).unwrap_err(),
            decider(&reliee(), Some("x.y"), &ctx("AG-0179"), t).unwrap_err(),
            decider(&reliee(), Some(&jeton()), &ctx("AG-0028"), t).unwrap_err(),
        ];
        for r in refus {
            for mot in ["error", "null", "token", "invalid"] {
                assert!(!r.to_lowercase().contains(mot), "{}", r);
            }
        }
    }
}
