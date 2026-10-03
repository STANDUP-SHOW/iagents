//! Les fiches composées chez le client remontent au catalogue commun.
//!
//! Choix de max du 03/10/2026 (« Automatique ») : chaque agent configuré devient
//! une fiche (`fiches::enregistrer_fiche_composee`), et cette fiche remonte
//! d'elle-même, sans rien demander au client.
//!
//! Ce qui part n'est PAS la fiche : c'est sa recette, le bloc `compose`, cinq
//! champs faits d'identifiants et revérifiés ici un par un (`recette_de`). Le
//! catalogue commun refait la fiche depuis ses propres sources
//! (`catalogue-commun/serveur.ts`). Le prénom, la voix, la phrase dite par le
//! client restent dans `installation.json`, et le format n'a aucune case où les
//! mettre : une clé de plus, un texte à la place d'un identifiant, et rien ne part.
//!
//! L'envoi ne bloque jamais l'embauche. La recette entre dans une file sur le
//! disque, la file part quand elle peut (à l'embauche, puis à chaque lancement),
//! et une recette n'en sort que quand le catalogue l'a rangée ou refusée pour de
//! bon. Sans adresse, rien ne part : la file attend.

use serde_json::{Map, Value};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

/// L'adresse du catalogue commun. Aucune tant que max ne l'a pas mis en ligne :
/// la mettre en ligne est sa décision, et une adresse devinée enverrait les
/// recettes à quelqu'un d'autre. `IAGENT_CATALOGUE_COMMUN` la remplace (bancs,
/// essais).
const ADRESSE_CATALOGUE_COMMUN: Option<&str> = None;

const FORMAT_COMPOSE: u64 = 1;
const CLES_DE_LA_RECETTE: [&str; 5] = ["activite", "format", "logicielsAjoutes", "mere", "remplacements"];

/// Une file à la fois : l'embauche et le lancement peuvent y toucher ensemble.
static FILE: Mutex<()> = Mutex::new(());

fn identifiant(v: &str, prefixe: &str, chiffres: usize) -> bool {
    v.strip_prefix(prefixe)
        .map(|r| r.len() == chiffres && r.bytes().all(|o| o.is_ascii_digit()))
        .unwrap_or(false)
}

/// La recette d'une fiche fille : son bloc `compose`, recopié champ par champ
/// après vérification. Le même contrôle que `recetteRecevable` côté écran et
/// côté catalogue commun.
pub fn recette_de(fille: &Value) -> Result<Value, String> {
    let compose = fille
        .get("compose")
        .and_then(|c| c.as_object())
        .ok_or("la fiche n'a pas de recette")?;
    let mut cles: Vec<&str> = compose.keys().map(|k| k.as_str()).collect();
    cles.sort_unstable();
    if cles != CLES_DE_LA_RECETTE {
        return Err(format!("la recette porte {} : rien ne part", cles.join(", ")));
    }
    if compose.get("format").and_then(|f| f.as_u64()) != Some(FORMAT_COMPOSE) {
        return Err("format de recette inconnu".into());
    }
    let mere = compose.get("mere").and_then(|m| m.as_str()).unwrap_or_default();
    if !identifiant(mere, "AG-", 4) {
        return Err("fiche mère mal nommée".into());
    }
    let activite = compose.get("activite").cloned().unwrap_or(Value::Null);
    match &activite {
        Value::Null => {}
        Value::String(a) if identifiant(a, "ACT-", 4) => {}
        _ => return Err("activité mal nommée".into()),
    }
    let logiciels: Vec<String> = compose
        .get("logicielsAjoutes")
        .and_then(|l| l.as_array())
        .ok_or("logiciels mal nommés")?
        .iter()
        .map(|l| l.as_str().filter(|s| identifiant(s, "LOG-", 4)).map(String::from))
        .collect::<Option<_>>()
        .ok_or("logiciels mal nommés")?;
    if logiciels.len() > 50 {
        return Err("logiciels mal nommés".into());
    }
    let mut remplacements = Map::new();
    for (ajoute, remplace) in compose
        .get("remplacements")
        .and_then(|r| r.as_object())
        .ok_or("remplacements mal formés")?
    {
        match remplace.as_str() {
            Some(r) if logiciels.contains(ajoute) && identifiant(r, "LOG-", 4) => {
                remplacements.insert(ajoute.clone(), Value::String(r.to_string()));
            }
            _ => return Err("remplacements mal formés".into()),
        }
    }

    let mut recette = Map::new();
    recette.insert("format".into(), Value::from(FORMAT_COMPOSE));
    recette.insert("mere".into(), Value::String(mere.to_string()));
    recette.insert("activite".into(), activite);
    recette.insert("logicielsAjoutes".into(), Value::from(logiciels));
    recette.insert("remplacements".into(), Value::Object(remplacements));
    Ok(Value::Object(recette))
}

/// L'adresse où envoyer, ou `None` : rien n'est réglé, ou ce qui l'est n'est pas
/// recevable (en clair hors de la machine, ou porteur d'un identifiant).
fn adresse() -> Option<String> {
    let brute = std::env::var("IAGENT_CATALOGUE_COMMUN")
        .ok()
        .or_else(|| ADRESSE_CATALOGUE_COMMUN.map(String::from))?;
    adresse_recevable(brute.trim()).then(|| brute.trim().trim_end_matches('/').to_string())
}

fn adresse_recevable(url: &str) -> bool {
    let reste = if let Some(r) = url.strip_prefix("https://") {
        r
    } else if let Some(r) = url.strip_prefix("http://") {
        let hote = r.split(['/', ':']).next().unwrap_or("");
        if !matches!(hote, "127.0.0.1" | "localhost") {
            return false;
        }
        r
    } else {
        return false;
    };
    let hote = reste.split('/').next().unwrap_or("");
    !hote.is_empty() && !hote.contains('@') && !reste.contains('?')
}

fn lire_file(chemin: &Path) -> Vec<Value> {
    std::fs::read_to_string(chemin)
        .ok()
        .and_then(|t| serde_json::from_str::<Vec<Value>>(&t).ok())
        .unwrap_or_default()
}

fn ecrire_file(chemin: &Path, file: &[Value]) -> Result<(), String> {
    crate::chemins::preparer(chemin)?;
    let texte = serde_json::to_string_pretty(file).map_err(|e| e.to_string())?;
    std::fs::write(chemin, texte).map_err(|e| format!("écriture de {} : {}", chemin.display(), e))
}

/// Ajoute une recette à la file, une seule fois.
fn mettre_en_file_dans(chemin: &Path, recette: Value) -> Result<(), String> {
    let _garde = FILE.lock().unwrap_or_else(|e| e.into_inner());
    let mut file = lire_file(chemin);
    if !file.contains(&recette) {
        file.push(recette);
        ecrire_file(chemin, &file)?;
    }
    Ok(())
}

/// Retire de la file ce qui est parti, en relisant la file : une embauche a pu
/// y ajouter une recette pendant l'envoi, et elle doit y rester.
fn retirer_de(chemin: &Path, parties: &[Value]) -> Result<(), String> {
    let _garde = FILE.lock().unwrap_or_else(|e| e.into_inner());
    let file: Vec<Value> = lire_file(chemin).into_iter().filter(|r| !parties.contains(r)).collect();
    ecrire_file(chemin, &file)
}

/// Ce qu'une réponse du catalogue dit de la recette.
#[derive(Debug, PartialEq)]
enum Issue {
    /// Rangée, ou déjà là : elle sort de la file.
    Rangee,
    /// Refusée pour de bon (recette que le catalogue ne refait pas) : elle sort
    /// aussi, sinon elle repartirait à chaque lancement sans jamais passer.
    Refusee,
    /// Pas joint, ou pas maintenant : elle reste.
    PlusTard,
}

async fn envoyer_une(client: &reqwest::Client, adresse: &str, recette: &Value) -> Issue {
    match client.post(format!("{}/fiches", adresse)).json(recette).send().await {
        Ok(r) if r.status().is_success() => Issue::Rangee,
        Ok(r) if r.status().as_u16() == 400 || r.status().as_u16() == 422 => Issue::Refusee,
        _ => Issue::PlusTard,
    }
}

async fn envoyer_la_file_de(chemin: &Path, adresse: &str) -> Result<usize, String> {
    let file = {
        let _garde = FILE.lock().unwrap_or_else(|e| e.into_inner());
        lire_file(chemin)
    };
    if file.is_empty() {
        return Ok(0);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let mut parties = Vec::new();
    for recette in file {
        if envoyer_une(&client, adresse, &recette).await != Issue::PlusTard {
            parties.push(recette);
        }
    }
    retirer_de(chemin, &parties)?;
    Ok(parties.len())
}

/// Range la recette d'une fiche fille dans la file d'envoi.
pub fn mettre_en_file(fille: &Value) -> Result<(), String> {
    let recette = recette_de(fille)?;
    mettre_en_file_dans(&crate::chemins::pour_ecrire("config/fiches-a-partager.json"), recette)
}

/// Envoie ce qui attend, sans rien lever : l'embauche et le lancement n'ont pas
/// à échouer parce que le catalogue commun n'est pas joignable.
pub async fn envoyer_la_file() {
    let Some(adresse) = adresse() else { return };
    let chemin = crate::chemins::pour_ecrire("config/fiches-a-partager.json");
    if let Err(motif) = envoyer_la_file_de(&chemin, &adresse).await {
        eprintln!("catalogue commun : {}", motif);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Read, Write};
    use std::sync::mpsc;

    fn temoin() -> Value {
        serde_json::from_str(include_str!("../../temoin-fiche-composee.json")).expect("témoin lisible")
    }

    /// Ce qui part de la machine n'est fait que d'identifiants : aucun texte de
    /// la fiche, donc rien de ce que le client a pu y dire.
    #[test]
    fn la_recette_n_est_faite_que_d_identifiants() {
        let fille = temoin();
        let recette = recette_de(&fille).expect("recette recevable");
        assert_eq!(&recette, fille.get("compose").unwrap());
        let texte = recette.to_string();
        for interdit in ["nom", "description", "expert", "Préparé", "prenom", "voix"] {
            assert!(!texte.contains(interdit), "« {} » partirait : {}", interdit, texte);
        }
        assert!(texte.len() < 200, "une recette de {} octets n'est plus une recette", texte.len());
    }

    #[test]
    fn une_recette_qui_porte_autre_chose_ne_part_pas() {
        let mutations: [(&str, Value); 6] = [
            ("prenom", Value::from("Léa")),
            ("activite", Value::from("l'imprimerie de Léa")),
            ("logicielsAjoutes", serde_json::json!(["Mon logiciel maison"])),
            ("remplacements", serde_json::json!({"LOG-0565": "un tableur"})),
            ("format", Value::from(2)),
            ("mere", Value::from("AG-1257-33CAF807")),
        ];
        for (cle, valeur) in mutations {
            let mut fille = temoin();
            fille["compose"][cle] = valeur;
            assert!(recette_de(&fille).is_err(), "« {} » modifié passerait", cle);
        }
        let mut sans = temoin();
        sans.as_object_mut().unwrap().remove("compose");
        assert!(recette_de(&sans).is_err());
    }

    #[test]
    fn une_adresse_en_clair_ou_porteuse_d_un_secret_est_refusee() {
        assert!(adresse_recevable("https://catalogue.iagent.agency"));
        assert!(adresse_recevable("http://127.0.0.1:3000"));
        for mauvaise in [
            "http://catalogue.iagent.agency",
            "https://cle@catalogue.iagent.agency",
            "https://catalogue.iagent.agency/?cle=1",
            "ftp://catalogue.iagent.agency",
            "https://",
        ] {
            assert!(!adresse_recevable(mauvaise), "{} passerait", mauvaise);
        }
        assert!(ADRESSE_CATALOGUE_COMMUN.is_none(), "l'adresse se pose quand max met le catalogue en ligne");
    }

    /// Un catalogue de banc : rend les codes demandés, un par requête, et
    /// remonte chaque corps reçu.
    fn catalogue_de_banc(codes: Vec<u16>) -> (String, mpsc::Receiver<String>) {
        let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute locale");
        let port = ecoute.local_addr().expect("adresse").port();
        let (envoi, reception) = mpsc::channel();
        std::thread::spawn(move || {
            for (flux, code) in ecoute.incoming().zip(codes) {
                let Ok(mut flux) = flux else { break };
                let mut lecteur = BufReader::new(flux.try_clone().expect("clone"));
                let mut longueur = 0usize;
                loop {
                    let mut ligne = String::new();
                    if lecteur.read_line(&mut ligne).unwrap_or(0) == 0 || ligne == "\r\n" {
                        break;
                    }
                    if let Some(v) = ligne.to_ascii_lowercase().strip_prefix("content-length:") {
                        longueur = v.trim().parse().unwrap_or(0);
                    }
                }
                let mut corps = vec![0; longueur];
                let _ = lecteur.read_exact(&mut corps);
                let _ = envoi.send(String::from_utf8_lossy(&corps).into_owned());
                let reponse = format!("HTTP/1.1 {} X\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{{}}", code);
                let _ = flux.write_all(reponse.as_bytes());
            }
        });
        (format!("http://127.0.0.1:{}", port), reception)
    }

    fn dossier_de_banc(nom: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("iagent-partage-{}-{}", nom, std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        d.join("fiches-a-partager.json")
    }

    #[tokio::test]
    async fn la_file_part_et_ne_garde_que_ce_qui_n_est_pas_passe() {
        let chemin = dossier_de_banc("file");
        let rangee = recette_de(&temoin()).unwrap();
        let mut autre = rangee.clone();
        autre["activite"] = Value::Null;
        let mut refusee = rangee.clone();
        refusee["mere"] = Value::from("AG-9999");
        for r in [&rangee, &rangee, &autre, &refusee] {
            mettre_en_file_dans(&chemin, r.clone()).unwrap();
        }
        assert_eq!(lire_file(&chemin).len(), 3, "une recette n'entre qu'une fois");

        // Rangée, pas joignable maintenant, refusée pour de bon.
        let (adresse, corps) = catalogue_de_banc(vec![201, 503, 422]);
        let parties = envoyer_la_file_de(&chemin, &adresse).await.unwrap();
        assert_eq!(parties, 2);
        assert_eq!(lire_file(&chemin), vec![autre], "seule la recette pas encore jointe attend");

        let premier: Value = serde_json::from_str(&corps.recv().unwrap()).unwrap();
        assert_eq!(premier, rangee, "ce qui part est la recette, et rien d'autre");
        let _ = std::fs::remove_dir_all(chemin.parent().unwrap());
    }

    #[tokio::test]
    async fn un_catalogue_injoignable_ne_perd_rien() {
        let chemin = dossier_de_banc("injoignable");
        mettre_en_file_dans(&chemin, recette_de(&temoin()).unwrap()).unwrap();
        let port = {
            let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute");
            ecoute.local_addr().expect("adresse").port()
        };
        let parties = envoyer_la_file_de(&chemin, &format!("http://127.0.0.1:{}", port)).await.unwrap();
        assert_eq!(parties, 0);
        assert_eq!(lire_file(&chemin).len(), 1);
        let _ = std::fs::remove_dir_all(chemin.parent().unwrap());
    }
}
