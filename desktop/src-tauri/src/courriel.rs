use serde::{Deserialize, Serialize};

/// Le mot de passe ne transite ni par le disque de l'application ni par sa base :
/// il va dans le coffre du système (Credential Manager sous Windows, Trousseau
/// sous macOS, Secret Service sous Linux), qui est fait pour ça.
const SERVICE: &str = "iagent-desktop";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompteCourriel {
    pub adresse: String,
    pub identifiant: String,
    pub imap_serveur: String,
    pub imap_port: u16,
    pub smtp_serveur: String,
    pub smtp_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub expediteur: String,
    pub objet: String,
    pub date: String,
    pub apercu: String,
}

fn coffre(adresse: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, adresse)
        .map_err(|e| format!("coffre du système indisponible : {}", e))
}

#[tauri::command]
pub fn courriel_enregistrer_motdepasse(adresse: String, mot_de_passe: String) -> Result<String, String> {
    if mot_de_passe.is_empty() {
        return Err("mot de passe vide".to_string());
    }
    coffre(&adresse)?
        .set_password(&mot_de_passe)
        .map_err(|e| format!("enregistrement dans le coffre : {}", e))?;
    Ok(format!("mot de passe de {} rangé dans le coffre du système", adresse))
}

#[tauri::command]
pub fn courriel_motdepasse_present(adresse: String) -> bool {
    coffre(&adresse)
        .and_then(|e| e.get_password().map_err(|e| e.to_string()))
        .is_ok()
}

/// Relève les derniers messages. Lecture seule : rien n'est marqué comme lu,
/// supprimé ni déplacé — l'agent regarde la boîte, il ne la remanie pas.
#[tauri::command]
pub fn courriel_relever(compte: CompteCourriel, limite: u32) -> Result<Vec<Message>, String> {
    let mot_de_passe = coffre(&compte.adresse)?
        .get_password()
        .map_err(|_| format!("aucun mot de passe enregistré pour {}", compte.adresse))?;

    let tls = native_tls::TlsConnector::builder()
        .build()
        .map_err(|e| format!("initialisation TLS : {}", e))?;

    let client = imap::connect(
        (compte.imap_serveur.as_str(), compte.imap_port),
        compte.imap_serveur.as_str(),
        &tls,
    )
    .map_err(|e| format!("connexion à {} : {}", compte.imap_serveur, e))?;

    let mut session = client
        .login(&compte.identifiant, &mot_de_passe)
        .map_err(|(e, _)| format!("authentification refusée : {}", e))?;

    let boite = session
        .examine("INBOX")
        .map_err(|e| format!("ouverture de la boîte : {}", e))?;

    let total = boite.exists;
    if total == 0 {
        let _ = session.logout();
        return Ok(Vec::new());
    }

    let debut = total.saturating_sub(limite.saturating_sub(1)).max(1);
    let plage = format!("{}:{}", debut, total);

    let recuperes = session
        .fetch(&plage, "RFC822")
        .map_err(|e| format!("lecture des messages : {}", e))?;

    let mut messages: Vec<Message> = recuperes
        .iter()
        .filter_map(|m| m.body())
        .filter_map(|corps| mailparse::parse_mail(corps).ok())
        .map(|courriel| {
            let entete = |nom: &str| {
                courriel
                    .headers
                    .iter()
                    .find(|h| h.get_key().eq_ignore_ascii_case(nom))
                    .map(|h| h.get_value())
                    .unwrap_or_default()
            };

            let corps = courriel.get_body().unwrap_or_default();
            let apercu: String = corps.split_whitespace().collect::<Vec<_>>().join(" ");

            Message {
                expediteur: entete("From"),
                objet: entete("Subject"),
                date: entete("Date"),
                apercu: apercu.chars().take(200).collect(),
            }
        })
        .collect();

    messages.reverse();
    let _ = session.logout();

    Ok(messages)
}

#[cfg(test)]
mod tests {
    #[test]
    fn la_plage_couvre_les_derniers_messages() {
        // Douze messages, on en veut cinq : les numéros 8 à 12.
        let total: u32 = 12;
        let limite: u32 = 5;
        let debut = total.saturating_sub(limite.saturating_sub(1)).max(1);
        assert_eq!(debut, 8);
    }

    #[test]
    fn une_boite_plus_courte_que_la_limite_part_du_premier() {
        let total: u32 = 3;
        let limite: u32 = 20;
        let debut = total.saturating_sub(limite.saturating_sub(1)).max(1);
        assert_eq!(debut, 1);
    }
}
