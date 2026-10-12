//! L'identité d'une Box et la signature de ses requêtes (MASTER §6, brief §12-§14).
//!
//! One implementation of what `plateforme/http.ts` verifies: the Ed25519 key
//! pair, `message_a_signer` byte for byte (`${methode}\n${chemin}\n${horodatage}\n${sha256hex(corps)}`),
//! the PEM/DER forms Node writes, `device_id` = `BOX-` + the first 16 hex of the
//! SHA-256 of the SPKI DER, and the verification of what the platform signs
//! (updates: `iagent-maj-v1\n<composant>\n<version>\n<empreinte>`). The desktop
//! (`desktop/src-tauri/src/plateforme.rs`) and the Box services share it, so
//! the rule cannot drift between them. Tests replay the shared witnesses of
//! `plateforme/controle/temoins-signature.json` and `desktop/temoins-plateforme.json`
//! when the files are present.

use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use base64::Engine;
use ring::rand::SystemRandom;
use ring::signature::{Ed25519KeyPair, KeyPair, UnparsedPublicKey, ED25519};
use sha2::{Digest, Sha256};

/// DER prefix of an Ed25519 SPKI public key (RFC 8410): the raw 32 bytes follow.
pub const SPKI_ED25519: [u8; 12] = [0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00];

pub fn empreinte_hex(octets: &[u8]) -> String {
    Sha256::digest(octets).iter().map(|b| format!("{:02x}", b)).collect()
}

/// `messageASigner` of `plateforme/http.ts`, byte for byte. `chemin` is the path alone, never the query string.
pub fn message_a_signer(methode: &str, chemin: &str, horodatage: &str, corps: &str) -> String {
    format!("{}\n{}\n{}\n{}", methode, chemin, horodatage, empreinte_hex(corps.as_bytes()))
}

/// What the platform signs when it publishes an update (`scellement.ts`, `messageMiseAJour`).
pub fn message_mise_a_jour(composant: &str, version: &str, empreinte: &str) -> String {
    format!("iagent-maj-v1\n{}\n{}\n{}", composant, version, empreinte)
}

pub fn der_depuis_brute(brute: &[u8; 32]) -> Vec<u8> {
    let mut der = SPKI_ED25519.to_vec();
    der.extend_from_slice(brute);
    der
}

/// The PEM Node writes for an Ed25519 public key (44 DER bytes fit one line).
pub fn pem_depuis_brute(brute: &[u8; 32]) -> String {
    format!("-----BEGIN PUBLIC KEY-----\n{}\n-----END PUBLIC KEY-----\n", STANDARD.encode(der_depuis_brute(brute)))
}

pub fn brute_depuis_pem(pem: &str) -> Result<[u8; 32], String> {
    let corps: String = pem.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with("-----")).collect();
    let der = STANDARD.decode(corps.as_bytes()).map_err(|_| "La clé publique n'est pas un PEM lisible.".to_string())?;
    if der.len() != 44 || der[..12] != SPKI_ED25519 {
        return Err("La clé publique n'est pas une clé Ed25519 (PEM SPKI).".to_string());
    }
    let mut brute = [0u8; 32];
    brute.copy_from_slice(&der[12..]);
    Ok(brute)
}

/// `device_id` as `POST /controle/boxes` and `/controle/usine/enroler` derive it: from the public key, so a copied disk with a fresh key is another Box.
pub fn device_id_depuis_pem(pem: &str) -> Result<String, String> {
    let brute = brute_depuis_pem(pem)?;
    Ok(format!("BOX-{}", &empreinte_hex(&der_depuis_brute(&brute))[..16]))
}

/// Loads a key pair from PKCS#8 (v1 as Node writes it, or v2 as ring does).
pub fn paire_depuis_pkcs8(pkcs8: &[u8]) -> Result<Ed25519KeyPair, String> {
    Ed25519KeyPair::from_pkcs8_maybe_unchecked(pkcs8).map_err(|_| "L'identité de la Box est illisible.".to_string())
}

/// A fresh Ed25519 key pair, as PKCS#8 bytes to keep (0600, root) and the pair itself.
pub fn nouvelle_paire() -> Result<(Vec<u8>, Ed25519KeyPair), String> {
    let doc = Ed25519KeyPair::generate_pkcs8(&SystemRandom::new()).map_err(|_| "Le générateur aléatoire du système est indisponible.".to_string())?;
    let paire = paire_depuis_pkcs8(doc.as_ref())?;
    Ok((doc.as_ref().to_vec(), paire))
}

/// Standard base64 of the Ed25519 signature, as `x-signature` carries it.
pub fn signer(paire: &Ed25519KeyPair, message: &str) -> String {
    STANDARD.encode(paire.sign(message.as_bytes()).as_ref())
}

pub fn cle_publique_pem(paire: &Ed25519KeyPair) -> String {
    let mut brute = [0u8; 32];
    brute.copy_from_slice(paire.public_key().as_ref());
    pem_depuis_brute(&brute)
}

pub fn device_id(paire: &Ed25519KeyPair) -> String {
    device_id_depuis_pem(&cle_publique_pem(paire)).expect("une clé que nous venons d'écrire se relit")
}

/// Verifies an Ed25519 signature made by the platform: base64url without padding (jeton, Skill Pack, mise à jour) or standard base64.
pub fn verifier_signature(pem_publique: &str, message: &str, signature: &str) -> bool {
    let brute = match brute_depuis_pem(pem_publique) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let octets = match URL_SAFE_NO_PAD.decode(signature.trim_end_matches('=')).or_else(|_| STANDARD.decode(signature)) {
        Ok(o) => o,
        Err(_) => return false,
    };
    UnparsedPublicKey::new(&ED25519, brute).verify(message.as_bytes(), &octets).is_ok()
}

/// Verifies what `POST /controle/mises-a-jour` signed: a package whose hash or version was swapped fails here.
pub fn verifier_mise_a_jour(pem_plateforme: &str, composant: &str, version: &str, empreinte: &str, signature: &str) -> bool {
    verifier_signature(pem_plateforme, &message_mise_a_jour(composant, version, empreinte), signature)
}

/// The X25519 key the platform encrypts Skill Packs to (`cle_chiffrement_publique`): raw 32 bytes, base64url without padding.
pub fn nouvelle_cle_chiffrement() -> Result<[u8; 32], String> {
    let mut graine = [0u8; 32];
    ring::rand::SecureRandom::fill(&SystemRandom::new(), &mut graine).map_err(|_| "Le générateur aléatoire du système est indisponible.".to_string())?;
    Ok(graine)
}

pub fn cle_chiffrement_publique(secret: &[u8; 32]) -> String {
    let s = x25519_dalek::StaticSecret::from(*secret);
    URL_SAFE_NO_PAD.encode(x25519_dalek::PublicKey::from(&s).as_bytes())
}

/// The three headers of a signed Box request, ready to set.
pub struct EnTetes {
    pub box_id: String,
    pub horodatage: String,
    pub signature: String,
}

pub fn en_tetes(paire: &Ed25519KeyPair, device_id: &str, methode: &str, chemin: &str, horodatage: &str, corps: &str) -> EnTetes {
    EnTetes { box_id: device_id.to_string(), horodatage: horodatage.to_string(), signature: signer(paire, &message_a_signer(methode, chemin, horodatage, corps)) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn le_message_a_signer_est_celui_de_la_plateforme_octet_pour_octet() {
        let m = message_a_signer("POST", "/controle/box/telemetrie", "2026-10-07T09:00:00.000Z", "{\"cpu\":37}");
        let attendu = format!("POST\n/controle/box/telemetrie\n2026-10-07T09:00:00.000Z\n{}", empreinte_hex(b"{\"cpu\":37}"));
        assert_eq!(m, attendu);
        assert_eq!(empreinte_hex(b""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }

    #[test]
    fn une_paire_signe_et_sa_cle_publique_verifie() {
        let (pkcs8, paire) = nouvelle_paire().unwrap();
        let relue = paire_depuis_pkcs8(&pkcs8).unwrap();
        let pem = cle_publique_pem(&paire);
        assert_eq!(pem, cle_publique_pem(&relue));
        let sig = signer(&paire, "bonjour");
        assert!(verifier_signature(&pem, "bonjour", &sig));
        assert!(!verifier_signature(&pem, "bonsoir", &sig));
        let (_, autre) = nouvelle_paire().unwrap();
        assert!(!verifier_signature(&cle_publique_pem(&autre), "bonjour", &sig));
    }

    #[test]
    fn le_device_id_derive_de_la_cle_comme_sur_la_plateforme() {
        let (_, paire) = nouvelle_paire().unwrap();
        let id = device_id(&paire);
        assert!(id.starts_with("BOX-") && id.len() == 20 && id[4..].chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
        let pem = cle_publique_pem(&paire);
        let brute = brute_depuis_pem(&pem).unwrap();
        assert_eq!(id, format!("BOX-{}", &empreinte_hex(&der_depuis_brute(&brute))[..16]));
        assert!(brute_depuis_pem("-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----\n").is_err());
    }

    #[test]
    fn la_signature_d_une_mise_a_jour_tombe_si_version_ou_empreinte_changent() {
        let (_, plateforme) = nouvelle_paire().unwrap();
        let pem = cle_publique_pem(&plateforme);
        let emp = "a".repeat(64);
        let sig = STANDARD.encode(plateforme.sign(message_mise_a_jour("device", "0.1.0", &emp).as_bytes()).as_ref());
        assert!(verifier_mise_a_jour(&pem, "device", "0.1.0", &emp, &sig));
        assert!(!verifier_mise_a_jour(&pem, "device", "0.1.1", &emp, &sig));
        assert!(!verifier_mise_a_jour(&pem, "device", "0.1.0", &"b".repeat(64), &sig));
        assert!(!verifier_mise_a_jour(&pem, "desktop", "0.1.0", &emp, &sig));
    }

    #[test]
    fn la_cle_de_chiffrement_publique_fait_43_caracteres_base64url() {
        let s = nouvelle_cle_chiffrement().unwrap();
        let p = cle_chiffrement_publique(&s);
        assert_eq!(p.len(), 43);
        assert!(p.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    /// The shared witnesses of the platform bench, when the file is present: the token is
    /// signed over the ASCII bytes of its base64url payload with the seed key of the witness.
    #[test]
    fn les_temoins_de_la_plateforme_se_verifient() {
        let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../plateforme/controle/temoins-signature.json");
        let Ok(texte) = std::fs::read_to_string(chemin) else { return };
        let t: serde_json::Value = serde_json::from_str(&texte).unwrap();
        let pem = t["plateforme"]["cle_publique_pem"].as_str().unwrap();
        let jeton = t["jeton"]["jeton"].as_str().unwrap();
        let (charge, signature) = jeton.split_once('.').unwrap();
        assert!(verifier_signature(pem, charge, signature), "le jeton témoin ne se vérifie pas avec la clé de la plateforme");
        let skill = &t["skill"];
        assert!(verifier_signature(pem, skill["message_signe"].as_str().unwrap(), skill["signature"].as_str().unwrap()));
    }
}
