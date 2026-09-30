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


/// Un message prêt à partir, tel que l'humain l'a sous les yeux.
///
/// Envoyer est irréversible : c'est exactement le cas où la règle du projet
/// s'applique — l'agent prépare, le client valide, et rien ne part sans ce
/// geste. L'`empreinte` sert à tenir cette promesse dans le code : l'interface
/// la calcule sur le texte qu'elle affiche, `courriel_envoyer` la recalcule sur
/// le texte reçu, et refuse dès qu'elles diffèrent. Un brouillon régénéré entre
/// l'affichage et le clic ne peut donc pas partir à la place de celui qui a été
/// relu.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Brouillon {
    pub destinataires: Vec<String>,
    pub objet: String,
    pub corps: String,
}

/// Ce qui est réellement parti, gardé à côté de la configuration. Un envoi dont
/// il ne reste aucune trace est un envoi que personne ne peut vérifier.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envoi {
    pub date: u64,
    pub de: String,
    pub destinataires: Vec<String>,
    pub objet: String,
    pub empreinte: String,
}

/// Empreinte stable du message validé (FNV-1a 64 bits).
///
/// Elle ne protège pas contre un adversaire — tout tourne dans le même
/// processus, qui pourrait recalculer n'importe quelle valeur. Elle attrape ce
/// qui arrive vraiment : un brouillon réécrit entre l'écran de relecture et le
/// clic d'envoi. C'est un contrôle de cohérence, pas une signature.
pub fn empreinte(brouillon: &Brouillon) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let mut avaler = |texte: &str| {
        for octet in texte.as_bytes() {
            h ^= *octet as u64;
            h = h.wrapping_mul(0x0000_0100_0000_01b3);
        }
        // Séparateur : sans lui, un objet allongé d'un mot pris au début du
        // corps donnerait la même empreinte que l'original.
        h ^= 0xff;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    };

    for d in &brouillon.destinataires {
        avaler(d.trim());
    }
    avaler(brouillon.objet.trim());
    avaler(brouillon.corps.trim());

    format!("{:016x}", h)
}

fn horodatage() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn fichier_envois() -> std::path::PathBuf {
    crate::chemins::pour_ecrire("config/courriels-envoyes.json")
}

#[tauri::command]
pub fn courriel_envois() -> Result<Vec<Envoi>, String> {
    let fichier = fichier_envois();
    if !fichier.exists() {
        return Ok(Vec::new());
    }
    let brut = std::fs::read_to_string(&fichier)
        .map_err(|e| format!("lecture de {} : {}", fichier.display(), e))?;
    serde_json::from_str(&brut).map_err(|e| format!("journal des envois illisible : {}", e))
}

fn consigner(envoi: Envoi) -> Result<(), String> {
    let fichier = fichier_envois();
    if let Some(parent) = fichier.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("création de {} : {}", parent.display(), e))?;
    }
    let mut envois = courriel_envois().unwrap_or_default();
    envois.push(envoi);
    let brut = serde_json::to_string_pretty(&envois)
        .map_err(|e| format!("écriture du journal des envois : {}", e))?;
    std::fs::write(&fichier, brut)
        .map_err(|e| format!("écriture de {} : {}", fichier.display(), e))
}

/// Envoie le message que le client vient de relire.
///
/// `empreinte_validee` est celle que l'interface a calculée sur le texte
/// affiché. Sans elle, ou si elle ne correspond plus, rien ne part.
#[tauri::command]
pub fn courriel_envoyer(
    compte: CompteCourriel,
    brouillon: Brouillon,
    empreinte_validee: String,
) -> Result<Envoi, String> {
    if brouillon.destinataires.is_empty() {
        return Err("aucun destinataire".to_string());
    }
    if brouillon.objet.trim().is_empty() {
        return Err("objet vide : un message sans objet part en indésirable".to_string());
    }

    let calculee = empreinte(&brouillon);
    if calculee != empreinte_validee {
        return Err(
            "le message a changé depuis votre relecture : relisez-le avant de l'envoyer"
                .to_string(),
        );
    }

    let mot_de_passe = coffre(&compte.adresse)?
        .get_password()
        .map_err(|_| format!("aucun mot de passe enregistré pour {}", compte.adresse))?;

    let mut message = lettre::Message::builder()
        .from(
            compte
                .adresse
                .parse()
                .map_err(|e| format!("adresse d'expéditeur invalide : {}", e))?,
        )
        .subject(brouillon.objet.trim());

    for destinataire in &brouillon.destinataires {
        message = message.to(destinataire
            .trim()
            .parse()
            .map_err(|e| format!("destinataire invalide {} : {}", destinataire, e))?);
    }

    let message = message
        .body(brouillon.corps.clone())
        .map_err(|e| format!("composition du message : {}", e))?;

    // STARTTLS quand le port l'impose, TLS direct sinon. Aucune des deux voies
    // n'accepte de retomber en clair : un mot de passe ne part pas en clair
    // parce qu'un serveur refuse le chiffrement.
    let constructeur = if compte.smtp_port == 587 {
        lettre::SmtpTransport::starttls_relay(&compte.smtp_serveur)
    } else {
        lettre::SmtpTransport::relay(&compte.smtp_serveur)
    }
    .map_err(|e| format!("connexion à {} : {}", compte.smtp_serveur, e))?;

    let transport = constructeur
        .port(compte.smtp_port)
        .credentials(lettre::transport::smtp::authentication::Credentials::new(
            compte.identifiant.clone(),
            mot_de_passe,
        ))
        .build();

    lettre::Transport::send(&transport, &message)
        .map_err(|e| format!("envoi refusé par {} : {}", compte.smtp_serveur, e))?;

    let envoi = Envoi {
        date: horodatage(),
        de: compte.adresse.clone(),
        destinataires: brouillon.destinataires.clone(),
        objet: brouillon.objet.trim().to_string(),
        empreinte: calculee,
    };
    consigner(envoi.clone())?;

    Ok(envoi)
}

#[cfg(test)]
mod tests {
    use super::{empreinte, Brouillon};

    fn brouillon(destinataires: &[&str], objet: &str, corps: &str) -> Brouillon {
        Brouillon {
            destinataires: destinataires.iter().map(|d| d.to_string()).collect(),
            objet: objet.to_string(),
            corps: corps.to_string(),
        }
    }

    #[test]
    fn le_meme_message_donne_la_meme_empreinte() {
        let a = brouillon(&["client@exemple.fr"], "Votre devis", "Bonjour,\nCi-joint.");
        let b = brouillon(&["  client@exemple.fr "], " Votre devis ", "Bonjour,\nCi-joint.");
        assert_eq!(empreinte(&a), empreinte(&b));
    }

    #[test]
    fn un_mot_change_change_l_empreinte() {
        let relu = brouillon(&["client@exemple.fr"], "Votre devis", "Le montant est de 1 200 euros.");
        for reecrit in [
            brouillon(&["client@exemple.fr"], "Votre devis", "Le montant est de 2 100 euros."),
            brouillon(&["client@exemple.fr"], "Votre facture", "Le montant est de 1 200 euros."),
            brouillon(&["autre@exemple.fr"], "Votre devis", "Le montant est de 1 200 euros."),
            brouillon(
                &["client@exemple.fr", "copie@exemple.fr"],
                "Votre devis",
                "Le montant est de 1 200 euros.",
            ),
        ] {
            assert_ne!(
                empreinte(&relu),
                empreinte(&reecrit),
                "un message réécrit garde l'empreinte du message relu"
            );
        }
    }

    /// Le séparateur entre les champs : sans lui, déplacer un mot de l'objet
    /// vers le corps laisserait l'empreinte inchangée.
    #[test]
    fn deplacer_un_mot_d_un_champ_a_l_autre_change_l_empreinte() {
        let a = brouillon(&["client@exemple.fr"], "Devis urgent", "Bonjour.");
        let b = brouillon(&["client@exemple.fr"], "Devis", "urgent Bonjour.");
        assert_ne!(empreinte(&a), empreinte(&b));
    }

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

