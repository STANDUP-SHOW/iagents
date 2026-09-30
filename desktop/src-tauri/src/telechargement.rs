//! Aller chercher les pièces que l'installeur ne livre pas, et refuser de les
//! poser si ce n'est pas ce qu'on attendait.
//!
//! **Pourquoi ce module existe.** Le 23/09/2026 on a constaté que la voix n'est
//! livrée par rien : ni le MSI ni un téléchargement. Sur un poste installé, la
//! conversation vocale — la dernière étape du parcours minimal — ne pouvait pas
//! démarrer, et `ressources.rs` ne savait que dire ce qui manquait et où le
//! prendre à la main. max a tranché le 24/09 : l'application va les chercher au
//! premier lancement.
//!
//! **La règle qui tient tout : on vérifie avant de poser, jamais après.** Un
//! fichier à demi reçu qui porte déjà son nom définitif est indiscernable d'un
//! fichier entier — le moteur le charge, échoue, et le client lit un message qui
//! ne parle pas de téléchargement. On écrit donc à côté, sous un nom provisoire,
//! on calcule l'empreinte au fil de l'eau, et on ne renomme qu'une fois l'octet
//! compté et l'empreinte reconnue.
//!
//! **Et on ne télécharge que ce qui est déclaré.** `sources-ressources.json`
//! porte, par pièce, l'adresse et l'empreinte relevées CHEZ L'ÉDITEUR avec la
//! date. Une pièce absente du fichier ne se télécharge pas : c'est la même règle
//! que `connecteurs/couts.json` pour les prix, et pour la même raison — une
//! adresse ou une empreinte écrite de mémoire ne se découvre fausse que chez le
//! client, au moment où il en a besoin.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Les hôtes auxquels l'application accepte de parler pour ses ressources.
///
/// Une liste blanche, et pas une simple vérification du « https » : une
/// déclaration modifiée sur le disque du client pourrait sinon faire télécharger
/// un exécutable depuis n'importe où, sous le nom d'un modèle de voix.
/// `github.com` est entré le 24/09/2026 pour le moteur Piper, que son éditeur
/// ne publie nulle part ailleurs. Ce qui protège n'est pas l'hôte — GitHub sert
/// n'importe quoi à qui le dépose — mais l'empreinte, obligatoire pour une
/// archive (voir `source_recevable`). L'adresse redirige vers le stockage de
/// GitHub, et c'est sans effet : ce qui est vérifié est le contenu reçu, pas le
/// chemin qu'il a pris.
const HOTES_PERMIS: [&str; 2] = ["huggingface.co", "github.com"];

/// Ce qu'une archive ne dépassera pas une fois ouverte. Une archive minuscule
/// peut se déplier en gigaoctets : on borne avant d'écrire, pas après.
const ENTREES_MAX: usize = 4096;
const OCTETS_OUVERTS_MAX: u64 = 512 * 1024 * 1024;

/// Ce qu'on vérifie quand l'éditeur ne publie pas d'empreinte.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerificationAutre {
    /// Le fichier doit se lire comme du JSON. Vaut pour un petit fichier de
    /// réglages, dont la panne réaliste est la troncature, pas la substitution.
    Json,
}

/// Ce qu'une pièce est, quand elle n'est pas un fichier à poser tel quel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Archive {
    /// Une archive ZIP, ouverte ici. Le lecteur est déjà dans le binaire : il
    /// sert à relire les `.xlsx` et les `.docx` qu'un agent produit.
    Zip,
}

/// Une pièce déclarée : d'où elle vient et comment savoir qu'on l'a bien reçue.
#[derive(Debug, Clone, Deserialize)]
pub struct Source {
    /// À quoi elle sert, dit au client et non au développeur.
    pub role: String,
    /// Où elle se pose, relativement au dossier des ressources.
    pub chemin: String,
    pub url: String,
    /// L'empreinte relevée chez l'éditeur. `None` quand il n'en publie pas.
    pub sha256: Option<String>,
    pub octets: u64,
    #[serde(default)]
    pub verification_autre: Option<VerificationAutre>,
    /// Présent quand la pièce est une archive : `chemin` est alors le DOSSIER
    /// où elle s'ouvre, et non un fichier.
    #[serde(default)]
    pub archive: Option<Archive>,
    /// Le système auquel cette pièce s'adresse (`windows`, `linux`, `macos`).
    /// Absent = tous. Le moteur de voix est un exécutable : le poser sur le
    /// mauvais système ferait télécharger 22 Mo pour rien, et l'écran
    /// annoncerait une pièce que le client ne pourra pas employer.
    #[serde(default)]
    pub pour: Option<String>,
    #[serde(default)]
    pub licence: String,
}

/// Cette pièce vaut-elle pour le poste où l'on tourne ?
pub fn pour_ce_poste(s: &Source) -> bool {
    match &s.pour {
        None => true,
        Some(p) => p == std::env::consts::OS,
    }
}

#[derive(Debug, Deserialize)]
struct Declaration {
    pieces: Vec<Source>,
}

/// Ce que la déclaration doit respecter pour qu'on accepte d'aller chercher.
///
/// Trois refus, et chacun a sa raison :
///
/// - **`https` seul, et un hôte de la liste.** Sans ça, une déclaration modifiée
///   sur le disque du client ferait télécharger n'importe quoi depuis n'importe
///   où, sous le nom d'un modèle de voix.
/// - **Une empreinte OU une autre vérification, jamais rien.** Un fichier qu'on
///   ne sait pas reconnaître, on ne le pose pas.
/// - **Une taille annoncée.** Elle ne remplace pas l'empreinte, elle arrête la
///   lecture avant qu'un serveur qui répond n'importe quoi remplisse le disque.
pub fn source_recevable(s: &Source) -> Result<(), String> {
    let reste = s
        .url
        .strip_prefix("https://")
        .ok_or_else(|| format!("{} : seul https est accepté", s.role))?;
    let hote = reste.split('/').next().unwrap_or_default();
    if !HOTES_PERMIS.contains(&hote) {
        // On nomme l'hôte, pas l'adresse : l'adresse peut porter un jeton.
        return Err(format!(
            "{} : l'application ne télécharge pas depuis « {} »",
            s.role, hote
        ));
    }
    if s.octets == 0 {
        return Err(format!("{} : aucune taille annoncée", s.role));
    }
    // Une archive s'ouvre, donc son contenu s'exécute ou se charge. La lecture
    // en JSON, qui suffit pour un petit fichier de réglages, ne dit rien d'un
    // ZIP : seule l'empreinte le reconnaît, et on n'en ouvre pas sans.
    if s.archive.is_some() && s.sha256.is_none() {
        return Err(format!(
            "{} : une archive ne s'ouvre pas sans son empreinte",
            s.role
        ));
    }
    match (&s.sha256, s.verification_autre) {
        (Some(e), _) => {
            if e.len() != 64 || !e.chars().all(|c| c.is_ascii_hexdigit()) {
                return Err(format!("{} : l'empreinte annoncée n'en est pas une", s.role));
            }
        }
        (None, Some(_)) => {}
        (None, None) => {
            return Err(format!(
                "{} : rien ne permettrait de reconnaître ce fichier, on ne le télécharge pas",
                s.role
            ))
        }
    }
    Ok(())
}

/// Les pièces déclarées, une fois la déclaration relue.
///
/// Une ligne irrecevable ne fait pas tomber les autres : elle est écartée avec
/// son motif, parce qu'un modèle d'écoute mal déclaré ne doit pas empêcher la
/// voix de s'installer.
pub fn sources_de(texte: &str) -> (Vec<Source>, Vec<String>) {
    let d: Declaration = match serde_json::from_str(texte) {
        Ok(d) => d,
        Err(e) => return (vec![], vec![format!("déclaration illisible : {}", e)]),
    };
    let mut bonnes = Vec::new();
    let mut refus = Vec::new();
    for s in d.pieces {
        match source_recevable(&s) {
            Ok(()) => bonnes.push(s),
            Err(m) => refus.push(m),
        }
    }
    (bonnes, refus)
}

/// Ce que l'application peut aller chercher sur ce poste.
pub fn sources() -> (Vec<Source>, Vec<String>) {
    let chemin = crate::fiches::dossier_ressources().join("sources-ressources.json");
    match std::fs::read_to_string(&chemin) {
        Ok(t) => sources_de(&t),
        Err(_) => (
            vec![],
            vec![format!(
                "la liste des pièces à télécharger est introuvable ({}) : l'installation est incomplète",
                chemin.display()
            )],
        ),
    }
}

/// L'empreinte d'un contenu, en minuscules, comme l'éditeur la publie.
pub fn empreinte(octets: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(octets);
    h.finalize().iter().map(|o| format!("{:02x}", o)).collect()
}

/// Le contenu reçu est-il celui qu'on attendait ?
///
/// Séparé du téléchargement exprès : c'est la décision, et elle s'éprouve sans
/// réseau. Le message nomme ce qui cloche en français, parce qu'il remonte
/// jusqu'au client.
pub fn contenu_conforme(s: &Source, recu: &[u8]) -> Result<(), String> {
    if recu.len() as u64 != s.octets {
        return Err(format!(
            "{} : {} octets reçus au lieu de {}. Le téléchargement s'est interrompu, il est à refaire.",
            s.role,
            recu.len(),
            s.octets
        ));
    }
    if let Some(attendue) = &s.sha256 {
        let eue = empreinte(recu);
        if !eue.eq_ignore_ascii_case(attendue) {
            return Err(format!(
                "{} : le fichier reçu n'est pas celui attendu. Rien n'a été installé.",
                s.role
            ));
        }
        return Ok(());
    }
    match s.verification_autre {
        Some(VerificationAutre::Json) => serde_json::from_slice::<serde_json::Value>(recu)
            .map(|_| ())
            .map_err(|_| {
                format!(
                    "{} : le fichier reçu est incomplet ou abîmé. Rien n'a été installé.",
                    s.role
                )
            }),
        // `source_recevable` l'a déjà refusée ; on ne pose rien par défaut.
        None => Err(format!("{} : rien ne permet de reconnaître ce fichier.", s.role)),
    }
}

/// Où cette pièce se posera sur ce poste.
pub fn ou_poser(s: &Source) -> std::path::PathBuf {
    crate::chemins::pour_ecrire(&s.chemin)
}

/// Le dossier commun à TOUTES les entrées d'une archive, s'il y en a un.
///
/// Une archive d'éditeur tient d'ordinaire dans un seul dossier (`piper/…`) ;
/// une autre pose ses fichiers à la racine. Retirer ce dossier quand il existe
/// rend le résultat le même dans les deux cas — ce que la déclaration nomme
/// dans `chemin` est ce que le client aura, sans qu'on ait eu à relever la
/// forme de l'archive. On ne retire rien dès qu'une seule entrée sort du lot.
fn dossier_commun(entrees: &[std::path::PathBuf]) -> Option<String> {
    let premier = entrees.first()?.components().next()?;
    let nom = premier.as_os_str().to_str()?.to_string();
    // Un seul niveau qui contiendrait tout : il faut donc que chaque entrée ait
    // quelque chose SOUS lui, sinon on retirerait un fichier.
    for e in entrees {
        let mut c = e.components();
        if c.next().map(|x| x.as_os_str()) != Some(premier.as_os_str()) {
            return None;
        }
        if c.next().is_none() {
            return None;
        }
    }
    Some(nom)
}

/// Ouvrir une archive vérifiée et poser son contenu dans son dossier.
///
/// Les refus, et leur raison :
///
/// - **Une entrée qui sortirait du dossier** (`../`, un chemin absolu, un lien)
///   n'est pas posée du tout, et rien ne l'est : une archive qui essaie d'écrire
///   ailleurs n'est pas une archive qu'on ouvre à moitié. `enclosed_name` du
///   lecteur rend `None` dans ces cas, et on redit le motif en français.
/// - **Un nombre d'entrées et une taille ouverte bornés.** 22 Mo comprimés
///   peuvent rendre des gigaoctets : on compte AVANT d'écrire, pas pendant.
/// - **Rien n'est posé sous le nom définitif tant que tout n'est pas sorti.**
///   Même règle que pour un fichier : le dossier se remplit à côté, sous
///   `.partiel`, et le renommage est la dernière opération. Un moteur à demi
///   extrait est pire qu'un moteur absent — `ressources.rs` le verrait présent.
fn ouvrir_archive(s: &Source, recu: &[u8]) -> Result<std::path::PathBuf, String> {
    ouvrir_archive_dans(s, recu, ou_poser(s))
}

/// La même chose, en disant où. Séparée pour être éprouvée sans dossier de
/// ressources ni variable d'environnement : ce sont les refus qui comptent ici,
/// et un banc qui ne peut pas l'appeler ne prouverait rien d'eux.
fn ouvrir_archive_dans(
    s: &Source,
    recu: &[u8],
    cible: std::path::PathBuf,
) -> Result<std::path::PathBuf, String> {
    if cible.exists() {
        return Err(format!("{} : {} existe déjà.", s.role, cible.display()));
    }
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(recu))
        .map_err(|_| format!("{} : l'archive reçue ne s'ouvre pas.", s.role))?;
    if zip.len() > ENTREES_MAX {
        return Err(format!(
            "{} : l'archive porte {} entrées, bien plus que ce qu'un moteur de voix contient. Rien n'a été installé.",
            s.role,
            zip.len()
        ));
    }

    // Premier passage : on lit la forme de l'archive sans rien écrire.
    let mut noms: Vec<std::path::PathBuf> = Vec::with_capacity(zip.len());
    let mut ouverts: u64 = 0;
    for i in 0..zip.len() {
        let e = zip
            .by_index(i)
            .map_err(|_| format!("{} : l'archive reçue est abîmée.", s.role))?;
        let nom = e.enclosed_name().ok_or_else(|| {
            format!(
                "{} : une entrée de l'archive écrirait hors de son dossier. Rien n'a été installé.",
                s.role
            )
        })?;
        ouverts = ouverts.saturating_add(e.size());
        if ouverts > OCTETS_OUVERTS_MAX {
            return Err(format!(
                "{} : l'archive se déplierait sur plus de {} Mo. Rien n'a été installé.",
                s.role,
                OCTETS_OUVERTS_MAX / (1024 * 1024)
            ));
        }
        if !e.is_dir() {
            noms.push(nom);
        }
    }
    if noms.is_empty() {
        return Err(format!("{} : l'archive reçue ne contient aucun fichier.", s.role));
    }
    let a_retirer = dossier_commun(&noms);

    let provisoire = cible.with_extension("partiel");
    let _ = std::fs::remove_dir_all(&provisoire);
    std::fs::create_dir_all(&provisoire)
        .map_err(|e| format!("{} : impossible de créer {} ({})", s.role, provisoire.display(), e))?;

    let sortir = || -> Result<(), String> {
        let mut zip = zip::ZipArchive::new(std::io::Cursor::new(recu))
            .map_err(|_| format!("{} : l'archive reçue ne s'ouvre pas.", s.role))?;
        for i in 0..zip.len() {
            let mut e = zip
                .by_index(i)
                .map_err(|_| format!("{} : l'archive reçue est abîmée.", s.role))?;
            if e.is_dir() {
                continue;
            }
            let nom = e.enclosed_name().ok_or_else(|| {
                format!("{} : une entrée de l'archive écrirait hors de son dossier.", s.role)
            })?;
            let relatif = match &a_retirer {
                Some(d) => nom.strip_prefix(d).unwrap_or(&nom).to_path_buf(),
                None => nom,
            };
            let ou = provisoire.join(&relatif);
            if let Some(parent) = ou.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|er| format!("{} : impossible de créer {} ({})", s.role, parent.display(), er))?;
            }
            let mut fichier = std::fs::File::create(&ou)
                .map_err(|er| format!("{} : impossible d'écrire {} ({})", s.role, relatif.display(), er))?;
            std::io::copy(&mut e, &mut fichier)
                .map_err(|er| format!("{} : impossible d'écrire {} ({})", s.role, relatif.display(), er))?;
        }
        Ok(())
    };
    if let Err(motif) = sortir() {
        let _ = std::fs::remove_dir_all(&provisoire);
        return Err(motif);
    }

    std::fs::rename(&provisoire, &cible).map_err(|e| {
        let _ = std::fs::remove_dir_all(&provisoire);
        format!("{} : impossible de poser le dossier ({})", s.role, e)
    })?;
    Ok(cible)
}

/// Poser le contenu vérifié, et seulement lui.
///
/// Le provisoire porte un suffixe qui n'est pas celui du fichier final : même
/// interrompue au pire moment, l'application ne trouvera jamais un demi-modèle
/// sous le nom d'un modèle entier. Le renommage est la dernière opération.
pub fn poser(s: &Source, recu: &[u8]) -> Result<std::path::PathBuf, String> {
    contenu_conforme(s, recu)?;
    // L'empreinte a été reconnue : c'est seulement maintenant qu'on ouvre.
    if s.archive == Some(Archive::Zip) {
        return ouvrir_archive(s, recu);
    }
    let cible = ou_poser(s);
    if let Some(parent) = cible.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("{} : impossible de créer {} ({})", s.role, parent.display(), e))?;
    }
    let provisoire = cible.with_extension("partiel");
    std::fs::write(&provisoire, recu)
        .map_err(|e| format!("{} : impossible d'écrire ({})", s.role, e))?;
    std::fs::rename(&provisoire, &cible).map_err(|e| {
        let _ = std::fs::remove_file(&provisoire);
        format!("{} : impossible de poser le fichier ({})", s.role, e)
    })?;
    Ok(cible)
}

/// Ce qui reste à aller chercher sur ce poste, et ce qui ne s'y trouve pas.
///
/// Ce que l'écran montre avant de proposer le téléchargement : le client doit
/// savoir ce qui va descendre et ce que ça pèse avant que ça descende.
#[derive(Debug, Clone, Serialize)]
pub struct AManquer {
    pub role: String,
    pub octets: u64,
    pub licence: String,
}

pub fn a_telecharger() -> Vec<AManquer> {
    let (bonnes, _) = sources();
    bonnes
        .into_iter()
        .filter(|s| pour_ce_poste(s) && !ou_poser(s).exists())
        .map(|s| AManquer { role: s.role, octets: s.octets, licence: s.licence })
        .collect()
}

/// Aller chercher une pièce et la poser. Rien n'est écrit tant que le contenu
/// n'est pas reconnu.
///
/// La taille annoncée sert de borne : un serveur qui répondrait autre chose ne
/// remplira pas le disque du client avant qu'on s'en aperçoive.
pub async fn telecharger(s: &Source) -> Result<std::path::PathBuf, String> {
    source_recevable(s)?;
    let reponse = reqwest::get(&s.url)
        .await
        // Jamais l'adresse dans le message : elle peut porter un jeton, et le
        // client n'en ferait rien. Même règle que pour les serveurs MCP.
        .map_err(|_| format!("{} : le téléchargement n'a pas abouti.", s.role))?;
    if !reponse.status().is_success() {
        return Err(format!(
            "{} : le serveur a refusé ({}). Rien n'a été installé.",
            s.role,
            reponse.status().as_u16()
        ));
    }
    let recu = reponse
        .bytes()
        .await
        .map_err(|_| format!("{} : le téléchargement s'est interrompu, il est à refaire.", s.role))?;
    if recu.len() as u64 > s.octets {
        return Err(format!(
            "{} : le serveur a envoyé plus que les {} octets annoncés. Rien n'a été installé.",
            s.role, s.octets
        ));
    }
    poser(s, &recu)
}

/// Ce qui reste à installer sur ce poste, pour que l'écran le dise AVANT de
/// proposer le bouton : le client doit savoir ce qui va descendre et ce que ça
/// pèse. Les champs traversent avec leurs noms (`octets`, pas `bytes`) : le
/// dépôt n'emploie pas `rename_all`.
#[tauri::command]
pub fn voix_a_installer() -> Vec<AManquer> {
    a_telecharger()
}

/// Aller chercher tout ce qui manque et qui est déclaré.
///
/// Rend ce qui a été posé, et s'arrête au premier refus en le disant : une
/// pièce qui n'est pas celle attendue n'a rien à faire sur le poste du client,
/// et continuer poserait les suivantes autour d'un trou.
#[tauri::command]
pub async fn voix_installer() -> Result<String, String> {
    let (declarees, refus) = sources();
    if declarees.is_empty() {
        return Err(refus
            .first()
            .cloned()
            .unwrap_or_else(|| "rien n'est déclaré à installer".to_string()));
    }
    let mut posees = 0usize;
    for s in declarees.iter().filter(|s| pour_ce_poste(s) && !ou_poser(s).exists()) {
        telecharger(s).await?;
        posees += 1;
    }
    Ok(match posees {
        0 => "Tout est déjà installé.".to_string(),
        1 => "Une pièce installée.".to_string(),
        n => format!("{} pièces installées.", n),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Une archive écrite ici, pour éprouver l'ouverture sans réseau.
    fn zip_de(entrees: &[(&str, &[u8])]) -> Vec<u8> {
        let mut w = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        let opt: zip::write::FileOptions<'_, ()> =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (nom, contenu) in entrees {
            w.start_file(*nom, opt).unwrap();
            std::io::Write::write_all(&mut w, contenu).unwrap();
        }
        w.finish().unwrap().into_inner()
    }

    fn source_archive(octets: usize, recu: &[u8]) -> Source {
        Source {
            role: "le moteur de voix".to_string(),
            chemin: "piper".to_string(),
            url: "https://github.com/rhasspy/piper/releases/download/x/piper.zip".to_string(),
            sha256: Some(empreinte(recu)),
            octets: octets as u64,
            verification_autre: None,
            archive: Some(Archive::Zip),
            pour: None,
            licence: "MIT".to_string(),
        }
    }

    fn dossier_neuf(nom: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir()
            .join(format!("iagent-archive-{}-{}", std::process::id(), nom));
        let _ = std::fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn une_archive_sans_empreinte_ne_s_ouvre_pas() {
        // Ouvrir, c'est poser un exécutable. La lecture en JSON, qui suffit pour
        // un fichier de réglages, ne dit rien d'un ZIP.
        let mut s = source_archive(10, b"x");
        s.sha256 = None;
        s.verification_autre = Some(VerificationAutre::Json);
        let r = source_recevable(&s);
        assert!(r.is_err(), "une archive sans empreinte devrait être refusée");
        assert!(r.unwrap_err().contains("empreinte"));
    }

    #[test]
    fn une_archive_s_ouvre_dans_son_dossier_sans_son_dossier_a_elle() {
        // L'archive de l'éditeur tient dans un dossier « piper/ ». Le garder
        // donnerait <ressources>/piper/piper/piper.exe, que rien ne cherche.
        let zip = zip_de(&[
            ("piper/piper.exe", b"MZ"),
            ("piper/espeak-ng-data/fr_dict", b"dict"),
        ]);
        let s = source_archive(zip.len(), &zip);
        let cible = dossier_neuf("commun");
        let pose = ouvrir_archive_dans(&s, &zip, cible.clone()).unwrap();
        assert_eq!(pose, cible);
        assert_eq!(std::fs::read(cible.join("piper.exe")).unwrap(), b"MZ");
        assert_eq!(
            std::fs::read(cible.join("espeak-ng-data/fr_dict")).unwrap(),
            b"dict"
        );
        assert!(!cible.join("piper").exists(), "le dossier de l'archive est retiré");
        let _ = std::fs::remove_dir_all(&cible);
    }

    #[test]
    fn une_archive_a_plat_garde_ses_noms() {
        // La même déclaration doit rendre le même résultat si l'éditeur change
        // la forme de son archive : c'est pour ça qu'on ne relève pas sa forme.
        let zip = zip_de(&[("piper.exe", b"MZ"), ("espeak-ng-data/fr_dict", b"dict")]);
        let s = source_archive(zip.len(), &zip);
        let cible = dossier_neuf("plat");
        ouvrir_archive_dans(&s, &zip, cible.clone()).unwrap();
        assert_eq!(std::fs::read(cible.join("piper.exe")).unwrap(), b"MZ");
        assert_eq!(
            std::fs::read(cible.join("espeak-ng-data/fr_dict")).unwrap(),
            b"dict"
        );
        let _ = std::fs::remove_dir_all(&cible);
    }

    #[test]
    fn un_seul_fichier_dans_un_dossier_n_est_pas_retire() {
        // `dossier_commun` ne doit pas prendre un FICHIER unique pour le
        // dossier de tout le monde : on écrirait alors un dossier vide.
        let zip = zip_de(&[("piper.exe", b"MZ")]);
        let s = source_archive(zip.len(), &zip);
        let cible = dossier_neuf("unique");
        ouvrir_archive_dans(&s, &zip, cible.clone()).unwrap();
        assert_eq!(std::fs::read(cible.join("piper.exe")).unwrap(), b"MZ");
        let _ = std::fs::remove_dir_all(&cible);
    }

    #[test]
    fn une_entree_qui_sortirait_du_dossier_fait_tout_refuser() {
        // Et rien n'est posé : une archive qui essaie d'écrire ailleurs n'est
        // pas une archive qu'on ouvre a moitié.
        let zip = zip_de(&[("piper/piper.exe", b"MZ"), ("../dehors", b"non")]);
        let s = source_archive(zip.len(), &zip);
        let cible = dossier_neuf("evasion");
        let r = ouvrir_archive_dans(&s, &zip, cible.clone());
        assert!(r.is_err(), "l'entrée « ../dehors » aurait dû faire refuser");
        assert!(
            r.unwrap_err().contains("hors de son dossier"),
            "le motif doit dire pourquoi"
        );
        assert!(!cible.exists(), "rien ne doit être posé");
        assert!(
            !cible.with_extension("partiel").exists(),
            "le provisoire doit être effacé"
        );
        assert!(!cible.parent().unwrap().join("dehors").exists(), "rien hors du dossier");
    }

    #[test]
    fn une_archive_vide_est_refusee() {
        let zip = zip_de(&[]);
        let s = source_archive(zip.len(), &zip);
        let cible = dossier_neuf("vide");
        assert!(ouvrir_archive_dans(&s, &zip, cible.clone()).is_err());
        assert!(!cible.exists());
    }

    #[test]
    fn ce_qui_ne_sert_pas_a_ce_systeme_n_est_pas_propose() {
        // 22 Mo de moteur Windows téléchargés sur un poste Linux, c'est une
        // attente et une pièce que le client ne pourra pas employer.
        let mut s = source_archive(1, b"x");
        s.pour = Some("windows".to_string());
        assert_eq!(pour_ce_poste(&s), std::env::consts::OS == "windows");
        s.pour = None;
        assert!(pour_ce_poste(&s), "sans « pour », la pièce vaut partout");
    }

    /// La déclaration livrée avec l'application doit se lire ici, sans rien
    /// écarter : une ligne refusée en silence, c'est une pièce que le client
    /// n'aura jamais et dont personne ne saura pourquoi.
    #[test]
    fn la_declaration_livree_se_lit_en_entier() {
        let (bonnes, refus) =
            sources_de(include_str!("../sources-ressources.json"));
        assert!(refus.is_empty(), "lignes écartées : {:?}", refus);
        assert_eq!(bonnes.len(), 4, "quatre pièces sont déclarées");
        assert!(
            bonnes.iter().any(|s| s.chemin.ends_with(".onnx")),
            "la voix doit être déclarée"
        );
        // Le modèle d'écoute a changé de nom : « ggml-medium-fr.bin » n'existe
        // chez personne. Le banc le tient pour qu'il ne revienne pas.
        assert!(
            bonnes.iter().all(|s| !s.chemin.contains("-fr.bin")),
            "aucun modèle Whisper ne porte « -fr » : le dépôt officiel n'en publie pas"
        );
    }

    fn source_essai(sha: Option<&str>, octets: u64) -> Source {
        Source {
            role: "le modèle d'essai".into(),
            chemin: "modeles/essai.bin".into(),
            url: "https://huggingface.co/x/y".into(),
            sha256: sha.map(str::to_string),
            octets,
            verification_autre: None,
            archive: None,
            pour: None,
            licence: "MIT".into(),
        }
    }

    #[test]
    fn une_adresse_en_clair_est_refusee() {
        let mut s = source_essai(Some(&"a".repeat(64)), 10);
        s.url = "http://huggingface.co/x".into();
        assert!(source_recevable(&s).unwrap_err().contains("https"));
    }

    #[test]
    fn un_hote_hors_de_la_liste_est_refuse() {
        let mut s = source_essai(Some(&"a".repeat(64)), 10);
        s.url = "https://exemple.invalide/modele.bin".into();
        let m = source_recevable(&s).unwrap_err();
        assert!(m.contains("exemple.invalide"), "{}", m);
        // L'hôte, jamais le chemin : une adresse peut porter un jeton.
        assert!(!m.contains("modele.bin"), "{}", m);
    }

    #[test]
    fn sans_rien_pour_reconnaitre_le_fichier_on_ne_telecharge_pas() {
        let s = source_essai(None, 10);
        assert!(source_recevable(&s).unwrap_err().contains("reconnaître"));
    }

    #[test]
    fn une_empreinte_qui_n_en_est_pas_une_est_refusee() {
        for mauvaise in ["", "abc", &"z".repeat(64), &"a".repeat(63)] {
            let s = source_essai(Some(mauvaise), 10);
            assert!(
                source_recevable(&s).is_err(),
                "« {} » ne doit pas passer pour une empreinte",
                mauvaise
            );
        }
    }

    #[test]
    fn l_empreinte_est_celle_que_publient_les_editeurs() {
        // Vecteur de la spécification : sha256 de la chaîne vide, puis de
        // « abc ». Si notre écriture hexadécimale était fausse, aucune pièce
        // ne passerait jamais et on chercherait ailleurs.
        assert_eq!(
            empreinte(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            empreinte(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn un_contenu_different_ne_passe_pas_meme_a_la_bonne_taille() {
        let bon = b"le bon contenu";
        let s = source_essai(Some(&empreinte(bon)), bon.len() as u64);
        assert!(contenu_conforme(&s, bon).is_ok());
        let faux = b"le mauvais cont"; // même longueur ? non : on vérifie les deux
        let s2 = source_essai(Some(&empreinte(bon)), faux.len() as u64);
        let m = contenu_conforme(&s2, faux).unwrap_err();
        assert!(m.contains("pas celui attendu"), "{}", m);
        assert!(m.contains("Rien n'a été installé"), "{}", m);
    }

    #[test]
    fn un_telechargement_interrompu_se_dit_comme_tel() {
        let bon = b"le bon contenu";
        let s = source_essai(Some(&empreinte(bon)), bon.len() as u64);
        let m = contenu_conforme(&s, b"le bon").unwrap_err();
        assert!(m.contains("interrompu"), "{}", m);
        assert!(m.contains("refaire"), "le client doit savoir quoi faire : {}", m);
    }

    #[test]
    fn un_fichier_de_reglages_se_verifie_par_sa_lecture_faute_d_empreinte() {
        let bon = br#"{"audio":{"sample_rate":22050}}"#;
        let mut s = source_essai(None, bon.len() as u64);
        s.verification_autre = Some(VerificationAutre::Json);
        assert!(source_recevable(&s).is_ok(), "une autre vérification suffit");
        assert!(contenu_conforme(&s, bon).is_ok());
        // Tronqué à la bonne taille annoncée : c'est la panne réaliste.
        let coupe = br#"{"audio":{"sample_rate":220"#;
        let mut s2 = source_essai(None, coupe.len() as u64);
        s2.verification_autre = Some(VerificationAutre::Json);
        assert!(contenu_conforme(&s2, coupe).unwrap_err().contains("abîmé"));
    }

    /// Le cœur de la règle : rien ne se pose tant que ce n'est pas reconnu, et
    /// un provisoire ne survit pas à un refus. Sans ça le client se retrouve
    /// avec un demi-modèle sous le nom d'un modèle entier, et le moteur échoue
    /// plus tard sur un message qui ne parle pas de téléchargement.
    #[test]
    fn un_contenu_refuse_ne_laisse_aucun_fichier_derriere() {
        let dossier = std::env::temp_dir().join(format!(
            "iagent-telechargement-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&dossier).unwrap();
        let bon = b"le bon contenu";
        let mut s = source_essai(Some(&empreinte(bon)), bon.len() as u64);
        s.chemin = dossier.join("essai.bin").to_string_lossy().into_owned();

        assert!(poser(&s, b"autre chose!!!").is_err());
        let cible = std::path::Path::new(&s.chemin);
        assert!(!cible.exists(), "rien ne doit avoir été posé");
        assert!(
            !cible.with_extension("partiel").exists(),
            "le provisoire ne doit pas survivre à un refus"
        );

        assert!(poser(&s, bon).is_ok());
        assert_eq!(std::fs::read(cible).unwrap(), bon);
        assert!(
            !cible.with_extension("partiel").exists(),
            "le provisoire doit avoir disparu après la pose"
        );
        let _ = std::fs::remove_dir_all(&dossier);
    }
}
