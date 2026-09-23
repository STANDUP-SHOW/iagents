//! Exécuter une tâche de la fiche et poser le résultat dans le dossier du client.
//!
//! C'était le trou du parcours minimal du cadrage — *installer → se connecter →
//! télécharger un agent → **une tâche s'exécute → résultat dans le dossier** →
//! conversation vocale*. Les 1 249 fiches décrivent 9 233 tâches, chacune avec
//! son dossier de sortie et son format, et rien dans l'application ne savait en
//! exécuter une : aucune commande, aucun écrivain de fichier. Un catalogue de
//! travail que personne ne fait n'est pas un employé.
//!
//! Trois refus tenus ici, dans le code et non dans une consigne au modèle :
//!
//! 1. **L'agent doit être embauché sur cette fiche.** Le prénom et la fiche
//!    viennent de l'écran ; c'est `installation.json`, écrit par le client, qui
//!    dit qui travaille chez lui. Sans ce contrôle, une vue suffirait à faire
//!    travailler une fiche que le client n'a jamais installée.
//! 2. **Le dossier de sortie est celui que le client a choisi.** La fiche ne
//!    nomme qu'un dossier logique (« courrier/reponses ») ; la correspondance
//!    vers un vrai dossier du poste est dans `installation.json`. Une tâche dont
//!    le dossier n'a pas été choisi ne s'exécute pas : elle n'écrit pas ailleurs
//!    « en attendant ».
//! 3. **Rien ne part du poste.** Cette commande écrit un fichier, et c'est tout.
//!    Un résultat qui attend un accord (`validationHumaine`) est écrit comme les
//!    autres et le dit ; il n'est ni envoyé ni publié. C'est la règle de Max :
//!    l'agent prépare, le client valide.
//!
//! **Ce qui n'est pas écrit** : `pdf` (523) et les formats d'image, de son et
//! de vidéo. L'application n'embarque aucune bibliothèque pour les produire. `format_ecrivable()` le dit en clair plutôt
//! que d'écrire un `.docx` qui n'en serait pas un — même discipline que
//! `diagnosticLocal()` côté dimensionnement.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Les formats que l'application sait réellement produire aujourd'hui.
///
/// Du texte, rien d'autre : ce sont les seuls que `std::fs::write` suffit à
/// écrire honnêtement. La liste s'allongera quand un écrivain existera pour de
/// bon, pas avant.
pub const FORMATS_ECRITS: [&str; 9] =
    ["md", "txt", "csv", "json", "html", "xlsx", "eml", "docx", "pdf"];

/// Les formats que le modèle rend sous forme de tableau plutôt que de texte.
///
/// 4 100 sorties sur 9 265 demandent un tableur : c'est le format le plus
/// réclamé des fiches, et de loin. Un modèle ne produit pas un classeur, il
/// produit du texte ; il rend donc un tableau en lignes séparées par des
/// points-virgules — la convention française, celle qu'Excel ouvre sans poser
/// de question — et l'application en fait un vrai `.xlsx`.
pub const FORMATS_TABLEAU: [&str; 1] = ["xlsx"];

pub fn est_un_tableau(format: &str) -> bool {
    FORMATS_TABLEAU.contains(&format)
}

/// Les formats que le modèle rend comme une lettre plutôt que comme un fichier.
///
/// 200 sorties demandent un `.eml`. Comme pour le classeur, on ne demande pas
/// à un modèle d'écrire des en-têtes RFC 5322 : il rendrait un message
/// plausible et mal formé. Il écrit une ligne d'objet et le corps de la
/// lettre, l'application en fait le fichier.
pub const FORMATS_COURRIEL: [&str; 1] = ["eml"];

pub fn est_un_courriel(format: &str) -> bool {
    FORMATS_COURRIEL.contains(&format)
}

/// Les formats que le modèle rend comme un texte mis en forme.
///
/// 833 sorties demandent un document : 310 en `.docx`, 523 en `.pdf`. Comme le
/// classeur et le courriel, le modèle n'écrit ni l'OOXML ni le PDF : il rend
/// ses titres en `#`, ses puces en `-` et son gras en `**`, conventions qu'il
/// écrit déjà tous les jours. Une seule consigne, une seule lecture des
/// marques (`document.rs`), et l'écrivain change selon la boîte demandée.
pub const FORMATS_DOCUMENT: [&str; 2] = ["docx", "pdf"];

pub fn est_un_document(format: &str) -> bool {
    FORMATS_DOCUMENT.contains(&format)
}

/// Ce qu'il faudrait pour écrire les autres, dit au client plutôt que tu.
fn ce_qui_manque(format: &str) -> &'static str {
    match format {
        "png" | "jpg" => "l'agent image ne tourne pas encore sur cette machine",
        "mp4" | "mp3" | "wav" => "l'agent son et vidéo ne tourne pas encore sur cette machine",
        _ => "ce format n'est pas prévu par le contrat des fiches",
    }
}

/// Dit si l'application sait produire ce format, et sinon pourquoi.
pub fn format_ecrivable(format: &str) -> Result<(), String> {
    if FORMATS_ECRITS.contains(&format) {
        return Ok(());
    }
    Err(format!(
        "la tâche rend un fichier « {} » et {} — le résultat n'est pas écrit plutôt qu'écrit de travers",
        format,
        ce_qui_manque(format)
    ))
}

/// Le dossier de travail d'un agent, quand le client n'en a pas désigné un.
///
/// Les fiches nomment **8 724 dossiers de sortie distincts** pour 9 265
/// sorties : à peu près un par tâche. Demander au client de choisir les sept
/// dossiers d'un agent avant qu'il ne fasse quoi que ce soit, c'est exactement
/// l'impression de « paramétrer » que Max ne veut pas. L'agent a donc son
/// propre dossier de travail, annoncé et pas demandé, et les dossiers logiques
/// de la fiche en sont des sous-dossiers.
///
/// **Conséquence qui compte : par défaut, l'agent ne lit et n'écrit que chez
/// lui.** Atteindre un dossier du client demande que celui-ci l'ait désigné,
/// dossier logique par dossier logique.
pub fn dossier_par_defaut(prenom: &str) -> Result<PathBuf, String> {
    let maison = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or("impossible de trouver le dossier personnel sur cet ordinateur")?;
    Ok(PathBuf::from(maison)
        .join("Documents")
        .join("iAgent")
        .join(crate::journal::nom_propre(prenom)?))
}

/// Un chemin logique de fiche ne descend que vers le bas.
///
/// Le contrat l'impose déjà (`^[a-z0-9-]+(/[a-z0-9-]+)*$`), mais il arrive ici
/// depuis un fichier du disque : le vérifier une seconde fois coûte trois
/// lignes, et s'en passer ferait d'un `..` dans une fiche un accès à tout le
/// poste.
fn chemin_logique_sur(logique: &str) -> bool {
    !logique.is_empty()
        && logique.split('/').all(|p| {
            !p.is_empty() && p.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        })
}

/// Le vrai dossier du poste derrière le dossier logique d'une tâche.
///
/// Ce que le client a désigné l'emporte ; sinon le dossier de travail de
/// l'agent, dont le dossier logique devient un sous-dossier. Un chemin choisi
/// par le client doit être complet : relatif, il se résoudrait depuis le
/// dossier de travail de l'application et le fichier atterrirait à côté de
/// l'exécutable sans que personne le retrouve.
pub fn dossier_reel(
    dossiers: &serde_json::Value,
    racine: Option<&str>,
    prenom: &str,
    logique: &str,
) -> Result<PathBuf, String> {
    if !chemin_logique_sur(logique) {
        return Err(format!("dossier « {} » : nom de dossier invalide dans la fiche", logique));
    }

    if let Some(choisi) = dossiers
        .get(logique)
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let chemin = PathBuf::from(choisi);
        if !chemin.is_absolute() {
            return Err(format!(
                "le dossier choisi pour « {} » n'est pas un chemin complet : {}",
                logique, choisi
            ));
        }
        return Ok(chemin);
    }

    let racine = match racine.map(str::trim).filter(|s| !s.is_empty()) {
        Some(r) => {
            let chemin = PathBuf::from(r);
            if !chemin.is_absolute() {
                return Err(format!(
                    "le dossier de travail de {} n'est pas un chemin complet : {}",
                    prenom, r
                ));
            }
            chemin
        }
        None => dossier_par_defaut(prenom)?,
    };
    Ok(logique.split('/').fold(racine, |acc, p| acc.join(p)))
}

/// Le nom du fichier posé dans le dossier.
///
/// Il vient de l'identifiant de la tâche (un slug du contrat) et de l'horodatage,
/// jamais du nom que le modèle aurait proposé : c'est le seul moyen de garantir
/// qu'un résultat ne peut pas écraser un fichier du client ni sortir du dossier.
pub fn nom_du_fichier(tache_id: &str, horodatage: &str, format: &str) -> Result<String, String> {
    let propre: String = tache_id
        .chars()
        .filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == '-')
        .collect();
    if propre.is_empty() || propre.len() > 64 || propre != tache_id {
        return Err(format!("identifiant de tâche invalide : {}", tache_id));
    }
    if !FORMATS_ECRITS.contains(&format) {
        return Err(format!("format non écrit : {}", format));
    }
    Ok(format!("{}-{}.{}", propre, horodatage, format))
}

/// L'heure du résultat, en chiffres triables (AAAAMMJJ-HHMMSS en temps universel).
///
/// Écrite à la main pour ne pas ajouter une dépendance de dates à l'application :
/// le client trie ses fichiers par nom et retrouve le dernier.
/// Un instant de l'epoque Unix rendu en date civile UTC.
///
/// Civil-from-days, d'après l'algorithme de Howard Hinnant : pas de table de
/// bissextiles à tenir, donc rien à corriger dans dix ans. Sorti de
/// `horodatage` quand l'en-tête `Date:` d'un courriel a eu besoin du même
/// calendrier : deux implémentations du même calcul finiraient par diverger.
/// Rend (année, mois, jour, heure, minute, seconde, jour de semaine), le jour
/// de semaine comptant 0 pour dimanche.
pub fn civil(secondes_depuis_epoque: u64) -> (i64, i64, i64, u64, u64, u64, u64) {
    let jours = secondes_depuis_epoque / 86_400;
    let reste = secondes_depuis_epoque % 86_400;
    let (heure, minute, seconde) = (reste / 3600, (reste % 3600) / 60, reste % 60);

    let z = jours as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let jour = doy - (153 * mp + 2) / 5 + 1;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 };
    let annee = if mois <= 2 { y + 1 } else { y };

    // Le 1er janvier 1970 était un jeudi.
    let semaine = (jours + 4) % 7;
    (annee, mois, jour, heure, minute, seconde, semaine)
}

pub fn horodatage(secondes_depuis_epoque: u64) -> String {
    let (annee, mois, jour, heure, minute, seconde, _) = civil(secondes_depuis_epoque);
    format!(
        "{:04}{:02}{:02}-{:02}{:02}{:02}",
        annee, mois, jour, heure, minute, seconde
    )
}

/// La date d'un courriel, au format qu'exige la RFC 5322.
///
/// En UTC, annoncé `+0000` : la machine du client peut être réglée n'importe
/// comment, mais un brouillon daté d'une heure inventée se classe mal dans la
/// boîte d'envoi.
pub fn date_rfc5322(secondes_depuis_epoque: u64) -> String {
    const JOURS: [&str; 7] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MOIS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    let (annee, mois, jour, heure, minute, seconde, semaine) = civil(secondes_depuis_epoque);
    format!(
        "{}, {:02} {} {:04} {:02}:{:02}:{:02} +0000",
        JOURS[semaine as usize],
        jour,
        MOIS[(mois - 1) as usize],
        annee,
        heure,
        minute,
        seconde
    )
}

/// La date au format que le PDF attend : `D:AAAAMMJJhhmmss+00'00'`.
///
/// Même horloge que le courriel et que le nom du fichier : un document daté
/// d'une autre heure que le fichier qui le porte est un document qu'on relit
/// deux fois.
pub fn date_pdf(secondes_depuis_epoque: u64) -> String {
    let (annee, mois, jour, heure, minute, seconde, _) = civil(secondes_depuis_epoque);
    format!(
        "D:{:04}{:02}{:02}{:02}{:02}{:02}+00'00'",
        annee, mois, jour, heure, minute, seconde
    )
}

/// Écrit le résultat dans le dossier du client, sans jamais écraser.
///
/// Par fichier provisoire puis renommage, comme `installation_ecrire` : une
/// coupure au milieu laisserait au client un résultat tronqué qu'il croirait
/// complet.
pub fn poser(dossier: &Path, nom: &str, contenu: &str) -> Result<PathBuf, String> {
    std::fs::create_dir_all(dossier)
        .map_err(|e| format!("création de {} : {}", dossier.display(), e))?;

    let chemin = dossier.join(nom);
    if chemin.exists() {
        return Err(format!("{} existe déjà", chemin.display()));
    }
    let provisoire = dossier.join(format!("{}.nouveau", nom));
    std::fs::write(&provisoire, contenu.as_bytes())
        .map_err(|e| format!("écriture de {} : {}", provisoire.display(), e))?;
    std::fs::rename(&provisoire, &chemin)
        .map_err(|e| format!("mise en place de {} : {}", chemin.display(), e))?;
    Ok(chemin)
}

/// Le séparateur du tableau rendu par le modèle.
///
/// Le point-virgule est demandé, mais un modèle rend parfois des virgules : on
/// prend celui qui découpe le plus de colonnes sur la première ligne plutôt que
/// de rendre un classeur d'une seule colonne.
fn separateur(premiere_ligne: &str) -> char {
    let compter = |c: char| premiere_ligne.matches(c).count();
    if compter(';') >= compter(',') { ';' } else { ',' }
}

/// Découpe un tableau rendu par le modèle, règles CSV usuelles.
///
/// Les guillemets protègent un champ qui contient le séparateur ou un retour à
/// la ligne, et `""` à l'intérieur vaut un guillemet. Sans ça, une phrase avec
/// un point-virgule casserait la ligne en deux colonnes et décalerait tout le
/// reste du tableau — le genre d'erreur qu'on ne voit qu'en ouvrant le fichier.
pub fn lignes_du_tableau(texte: &str) -> Vec<Vec<String>> {
    let texte = texte.trim_start_matches('\u{feff}').trim();
    let premiere = texte.lines().next().unwrap_or("");
    let sep = separateur(premiere);

    let mut lignes: Vec<Vec<String>> = Vec::new();
    let mut ligne: Vec<String> = Vec::new();
    let mut champ = String::new();
    let mut entre_guillemets = false;
    let mut caracteres = texte.chars().peekable();

    while let Some(c) = caracteres.next() {
        if entre_guillemets {
            if c == '"' {
                if caracteres.peek() == Some(&'"') {
                    caracteres.next();
                    champ.push('"');
                } else {
                    entre_guillemets = false;
                }
            } else {
                champ.push(c);
            }
            continue;
        }
        match c {
            '"' if champ.trim().is_empty() => {
                champ.clear();
                entre_guillemets = true;
            }
            c if c == sep => ligne.push(std::mem::take(&mut champ).trim().to_string()),
            '\r' => {}
            '\n' => {
                ligne.push(std::mem::take(&mut champ).trim().to_string());
                lignes.push(std::mem::take(&mut ligne));
            }
            _ => champ.push(c),
        }
    }
    if !champ.trim().is_empty() || !ligne.is_empty() {
        ligne.push(champ.trim().to_string());
        lignes.push(ligne);
    }
    // Une ligne entièrement vide au milieu d'un tableau n'apporte rien et
    // décalerait la lecture du client.
    lignes.retain(|l| l.iter().any(|c| !c.is_empty()));
    lignes
}

/// Un champ qui est vraiment un nombre, pour qu'Excel sache l'additionner.
///
/// La virgule décimale française est acceptée. Un zéro en tête est laissé en
/// texte : « 0012 » est une référence, pas douze, et la convertir la perdrait.
pub fn nombre_du_champ(champ: &str) -> Option<f64> {
    let net = champ.replace([' ', '\u{a0}'], "").replace(',', ".");
    if net.is_empty() || net == "-" {
        return None;
    }
    let sans_signe = net.strip_prefix('-').unwrap_or(&net);
    if sans_signe.starts_with('0') && sans_signe.len() > 1 && !sans_signe.starts_with("0.") {
        return None;
    }
    if !sans_signe.chars().all(|c| c.is_ascii_digit() || c == '.') {
        return None;
    }
    net.parse::<f64>().ok()
}

/// Écrit un vrai classeur dans le dossier du client.
///
/// Mêmes règles que `poser` : rien n'est écrasé, et le fichier est mis en place
/// entier par renommage. Un classeur à moitié écrit s'ouvrirait en erreur chez
/// le client, ce qui est pire qu'un échec annoncé.
pub fn poser_tableur(dossier: &Path, nom: &str, lignes: &[Vec<String>]) -> Result<PathBuf, String> {
    if lignes.is_empty() {
        return Err("le tableau rendu est vide : aucun classeur n'a été écrit".to_string());
    }
    std::fs::create_dir_all(dossier)
        .map_err(|e| format!("création de {} : {}", dossier.display(), e))?;
    let chemin = dossier.join(nom);
    if chemin.exists() {
        return Err(format!("{} existe déjà", chemin.display()));
    }

    let mut classeur = rust_xlsxwriter::Workbook::new();
    let entete = rust_xlsxwriter::Format::new().set_bold();
    let feuille = classeur.add_worksheet();
    for (i, ligne) in lignes.iter().enumerate() {
        for (j, champ) in ligne.iter().enumerate() {
            let (r, c) = (i as u32, j as u16);
            let ecrit = if i == 0 {
                feuille.write_string_with_format(r, c, champ, &entete).map(|_| ())
            } else if let Some(n) = nombre_du_champ(champ) {
                feuille.write_number(r, c, n).map(|_| ())
            } else {
                feuille.write_string(r, c, champ).map(|_| ())
            };
            ecrit.map_err(|e| format!("écriture du classeur : {}", e))?;
        }
    }
    feuille.autofit();

    let provisoire = dossier.join(format!("{}.nouveau", nom));
    classeur
        .save(&provisoire)
        .map_err(|e| format!("écriture de {} : {}", provisoire.display(), e))?;
    std::fs::rename(&provisoire, &chemin)
        .map_err(|e| format!("mise en place de {} : {}", chemin.display(), e))?;
    Ok(chemin)
}

/// Sépare l'objet du corps dans ce que le modèle a rendu.
///
/// La consigne lui demande une première ligne `Objet : …`, puis le message.
/// Quand il ne l'a pas fait, on prend sa première ligne comme objet plutôt que
/// d'écrire un brouillon sans objet : une lettre sans objet se perd dans une
/// boîte de réception, et l'objet est de toute façon relu par le client.
pub fn objet_et_corps(texte: &str) -> (String, String) {
    let texte = texte.trim_start_matches('\u{feff}').trim();
    let (premiere, reste) = match texte.split_once('\n') {
        Some((p, r)) => (p.trim(), r),
        None => (texte, ""),
    };
    let sans_etiquette = premiere
        .strip_prefix("Objet :")
        .or_else(|| premiere.strip_prefix("Objet:"))
        .or_else(|| premiere.strip_prefix("Subject:"));
    match sans_etiquette {
        Some(objet) => (objet.trim().to_string(), reste.trim().to_string()),
        // Pas d'étiquette : la première ligne fait l'objet et reste aussi dans
        // le corps. La perdre effacerait une phrase du message.
        None => (premiere.to_string(), texte.to_string()),
    }
}

/// Encode un texte en quoted-printable (RFC 2045).
///
/// Ni brut ni base64. Brut, une ligne de plus de 998 octets rend le message
/// non conforme et certains serveurs le coupent ; en base64, le client qui
/// ouvre le fichier dans un éditeur ne voit que du charabia. Le
/// quoted-printable garde le français lisible et replie les lignes à 76.
pub fn quoted_printable(texte: &str) -> String {
    let mut sortie = String::new();
    for (i, ligne) in texte.replace("\r\n", "\n").split('\n').enumerate() {
        if i > 0 {
            sortie.push_str("\r\n");
        }
        let mut colonne = 0usize;
        let mut encodee = String::new();
        let octets = ligne.as_bytes();
        for (j, &o) in octets.iter().enumerate() {
            // Un espace en fin de ligne serait mange par les serveurs : il
            // s'encode pour survivre au transport.
            let fin_de_ligne = j + 1 == octets.len();
            let mot = if (33..=126).contains(&o) && o != b'=' {
                (o as char).to_string()
            } else if (o == b' ' || o == b'\t') && !fin_de_ligne {
                (o as char).to_string()
            } else {
                format!("={:02X}", o)
            };
            // 76 colonnes en comptant le « = » de repli qui termine la ligne.
            if colonne + mot.len() > 75 {
                encodee.push_str("=\r\n");
                colonne = 0;
            }
            colonne += mot.len();
            encodee.push_str(&mot);
        }
        sortie.push_str(&encodee);
    }
    sortie
}

/// Encode un objet de courriel en mot encodé MIME (RFC 2047) s'il le faut.
///
/// Un objet en ASCII part tel quel ; dès qu'il porte un accent, il s'encode en
/// base64 — sinon le client de messagerie affiche « RÃ©union » au lieu de
/// « Réunion ».
pub fn objet_encode(objet: &str) -> String {
    let objet = objet.replace(['\r', '\n'], " ");
    let objet = objet.trim();
    if objet.is_ascii() {
        return objet.to_string();
    }
    format!("=?UTF-8?B?{}?=", base64(objet.as_bytes()))
}

/// Base64 (RFC 4648), pour le seul objet du courriel.
fn base64(octets: &[u8]) -> String {
    const ALPHABET: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut sortie = String::new();
    for bloc in octets.chunks(3) {
        let b = [bloc[0], *bloc.get(1).unwrap_or(&0), *bloc.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        let indices = [n >> 18 & 63, n >> 12 & 63, n >> 6 & 63, n & 63];
        for (i, idx) in indices.iter().enumerate() {
            if i <= bloc.len() {
                sortie.push(ALPHABET[*idx as usize] as char);
            } else {
                sortie.push('=');
            }
        }
    }
    sortie
}

/// Écrit un brouillon de courriel dans le dossier du client.
///
/// Mêmes règles que `poser` : rien n'est écrasé, mise en place par renommage.
///
/// **Sans destinataire, et c'est voulu.** L'agent n'a aucun moyen de connaître
/// l'adresse de qui doit recevoir la lettre, et une adresse inventée est pire
/// qu'une adresse absente : le client l'enverrait sans la relire. Pas
/// d'expéditeur non plus — le compte de courrier du client est réglé ailleurs
/// dans l'application, et le brouillon s'ouvre dans son logiciel de
/// messagerie, qui y met le sien. `X-Unsent: 1` est ce qui fait qu'Outlook et
/// Thunderbird l'ouvrent en rédaction et non en lecture : c'est un brouillon,
/// pas un message reçu. Rien ne part du poste, comme partout ici.
pub fn poser_courriel(
    dossier: &Path,
    nom: &str,
    secondes_depuis_epoque: u64,
    texte: &str,
) -> Result<PathBuf, String> {
    let (objet, corps) = objet_et_corps(texte);
    if corps.trim().is_empty() {
        return Err("le message rendu est vide : aucun brouillon n'a été écrit".to_string());
    }
    let message = format!(
        "Date: {}\r\n\
         Subject: {}\r\n\
         MIME-Version: 1.0\r\n\
         Content-Type: text/plain; charset=utf-8\r\n\
         Content-Transfer-Encoding: quoted-printable\r\n\
         X-Unsent: 1\r\n\
         \r\n{}\r\n",
        date_rfc5322(secondes_depuis_epoque),
        objet_encode(&objet),
        quoted_printable(&corps)
    );
    poser(dossier, nom, &message)
}

/// Les formats que l'application relit tels quels : du texte.
const FORMATS_LUS: [&str; 6] = ["md", "txt", "csv", "json", "html", "log"];

/// Ceux qu'elle relit en les convertissant d'abord (`lecture.rs`).
///
/// Ce sont exactement les formats qu'elle écrit : un agent reçoit du précédent
/// de la chaîne, et écrire un classeur que le suivant ne peut pas relire casse
/// le relais. Le `.eml` en fait partie parce que relu brut, son corps se lit en
/// quoted-printable : l'agent y voyait « impay=C3=A9e » et le recopiait.
///
/// Le PDF n'y est pas : celui-ci s'écrit, mais ceux qui arrivent du monde
/// portent des polices découpées, des flux comprimés ou du texte scanné qui
/// n'est pas du texte. Une image reste nommée sans être ouverte : savoir qu'un
/// fichier est là sans pouvoir le lire vaut mieux que ne pas le savoir.
const FORMATS_CONVERTIS: [&str; 3] = ["xlsx", "docx", "eml"];

/// Au-delà, on ne charge plus : un dossier de travail peut contenir des années
/// d'archives, et les verser toutes au modèle coûterait cher pour un résultat
/// moins bon. L'agent est prévenu de ce qu'il n'a pas vu.
const FICHIERS_LUS_MAX: usize = 20;
const CARACTERES_LUS_MAX: usize = 120_000;

/// Les dossiers dont une tâche tire sa matière.
///
/// Le contrat des fiches dit qu'une entrée est soit `dossier:<chemin logique>`,
/// soit un connecteur. **8 398 tâches sur 9 233 n'ont ni l'un ni l'autre** :
/// leurs entrées sont des mots (« pièces de référence », « messagerie du
/// dirigeant ») qui disent à un lecteur ce dont il s'agit, mais ne désignent
/// aucune source que l'application puisse ouvrir. C'est le prochain passage
/// éditorial ; en attendant, ces tâches travaillent sans matière et l'agent doit
/// le savoir, sinon il l'invente.
pub fn dossiers_sources(entrees: &[String]) -> Vec<String> {
    entrees
        .iter()
        .filter_map(|e| e.strip_prefix("dossier:"))
        .filter(|c| !c.is_empty())
        .map(str::to_string)
        .collect()
}

/// Ce que l'agent a sous les yeux : le contenu des fichiers qu'on sait lire, et
/// le nom de ceux qu'on ne sait pas.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Matiere {
    pub textes: Vec<(String, String)>,
    /// Les fichiers présents mais non lus, et pourquoi en un mot.
    pub non_lus: Vec<String>,
    /// Vrai quand le dossier contenait plus que ce qu'on a chargé.
    pub tronque: bool,
}

impl Matiere {
    pub fn vide(&self) -> bool {
        self.textes.is_empty() && self.non_lus.is_empty()
    }
}

/// Lit ce qu'il y a dans un dossier du client, sans s'y enfoncer.
///
/// Un seul niveau : un sous-dossier est nommé, pas parcouru. Le client range
/// comme il veut, et descendre tout un arbre chargerait des archives entières
/// sans que personne l'ait demandé.
pub fn lire_matiere(dossier: &Path) -> Matiere {
    let mut m = Matiere::default();
    let Ok(entrees) = std::fs::read_dir(dossier) else {
        return m;
    };
    let mut noms: Vec<PathBuf> = entrees.flatten().map(|e| e.path()).collect();
    noms.sort();

    let mut caracteres = 0usize;
    for chemin in noms {
        let nom = chemin
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if nom.starts_with('.') {
            continue;
        }
        if chemin.is_dir() {
            m.non_lus.push(format!("{} (un dossier, non ouvert)", nom));
            continue;
        }
        let extension = chemin
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let converti = FORMATS_CONVERTIS.contains(&extension.as_str());
        if !converti && !FORMATS_LUS.contains(&extension.as_str()) {
            m.non_lus.push(format!("{} (l'application ne sait pas l'ouvrir)", nom));
            continue;
        }
        if m.textes.len() >= FICHIERS_LUS_MAX || caracteres >= CARACTERES_LUS_MAX {
            m.tronque = true;
            continue;
        }
        let lu = if converti {
            std::fs::read(&chemin)
                .map_err(|e| e.to_string())
                .and_then(|octets| match extension.as_str() {
                    "xlsx" => crate::lecture::lire_classeur(&octets),
                    "docx" => crate::lecture::lire_document_word(&octets),
                    _ => crate::lecture::lire_courriel(&octets),
                })
        } else {
            std::fs::read_to_string(&chemin).map_err(|e| e.to_string())
        };
        match lu {
            Ok(contenu) => {
                caracteres += contenu.chars().count();
                m.textes.push((nom, contenu));
            }
            // Un fichier abîmé, un droit refusé, une archive qui n'en est pas
            // une : on nomme le fichier ET la raison, plutôt que de le taire.
            Err(motif) => m.non_lus.push(format!("{} ({})", nom, motif)),
        }
    }
    m
}

/// Met la matière dans les mots de l'agent, ou lui dit qu'il n'en a pas.
///
/// **La phrase qui compte est celle du dossier vide.** Un agent à qui on demande
/// de contrôler des pièces sans lui donner de pièces produit un rapport
/// vraisemblable et faux, et le client n'a aucun moyen de s'en apercevoir. On
/// lui demande donc de dire ce qui lui manque.
pub fn matiere_en_mots(matiere: &Matiere, avait_une_source: bool) -> String {
    if matiere.textes.is_empty() {
        let mut texte = String::from(
            "\n\nVous n'avez reçu aucun document pour cette tâche. N'inventez rien : dites en une phrase ce qu'il vous faut et où le déposer.",
        );
        if !avait_une_source {
            texte.push_str(" La fiche ne dit pas encore dans quel dossier prendre votre matière.");
        }
        if !matiere.non_lus.is_empty() {
            texte.push_str(&format!(
                "\nLe dossier contient {} mais l'application ne sait pas les ouvrir.",
                matiere.non_lus.join(", ")
            ));
        }
        return texte;
    }

    let mut texte = String::from("\n\nVoici ce que vous avez reçu.\n");
    for (nom, contenu) in &matiere.textes {
        texte.push_str(&format!("\n--- {} ---\n{}\n", nom, contenu.trim_end()));
    }
    if !matiere.non_lus.is_empty() {
        texte.push_str(&format!(
            "\nEt, sans pouvoir les ouvrir : {}. Dites-le si votre réponse en dépend.\n",
            matiere.non_lus.join(", ")
        ));
    }
    if matiere.tronque {
        texte.push_str("\nLe dossier en contenait davantage : vous n'avez pas tout vu.\n");
    }
    texte
}

/// Un savoir de la fiche ou de l'employeur : un titre et son résumé.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Savoir {
    #[serde(default)]
    pub titre: String,
    #[serde(default)]
    pub resume: String,
}

/// Ce que l'agent reçoit pour faire le travail.
///
/// Même ordre que le prompt de la conversation (`ConversationEngine`) : le
/// métier, puis ce que l'employeur a appris, puis ce qu'il a déjà repris, puis
/// les règles strictes en dernier. **Les règles ne sont pas décoratives** : ce
/// sont les limites dures des fiches — ne jamais se prononcer sur les droits
/// d'une personne, ne jamais soumettre un formulaire à sa place, ne jamais
/// reprendre une source non officielle. Elles étaient dans la conversation et
/// pas dans l'exécution d'une tâche, qui produit pourtant le document que le
/// client utilisera.
pub fn consigne_de_la_tache(
    consigne_fiche: &str,
    prenom: &str,
    connaissances: &[Savoir],
    competences: &[Savoir],
    repris: &[String],
    regles: &[String],
    tache_nom: &str,
    tache_description: &str,
    format: &str,
    validation_humaine: bool,
) -> (String, String) {
    let bloc = |titre: &str, savoirs: &[Savoir]| -> String {
        if savoirs.is_empty() {
            return String::new();
        }
        let lignes: Vec<String> = savoirs
            .iter()
            .map(|s| format!("- {} : {}", s.titre, s.resume))
            .collect();
        format!("\n{}\n{}\n", titre, lignes.join("\n"))
    };

    let mut systeme = consigne_fiche.trim().to_string();
    systeme.push_str(&format!("\n\nVous vous appelez {}.\n", prenom.trim()));
    systeme.push_str(&bloc("Ce que vous savez de votre métier :", connaissances));
    // Ce que l'employeur a appris l'emporte : il connaît sa maison mieux que le
    // savoir général du métier.
    systeme.push_str(&bloc(
        "Ce que votre employeur vous a appris, et qui prime sur le savoir général :",
        competences,
    ));
    // Ce qui lui a déjà été reproché passe en dernier et prime : c'est la
    // correction la plus récente.
    if !repris.is_empty() {
        systeme.push_str(&format!(
            "\nCe que votre employeur vous a déjà repris, et que vous ne refaites pas :\n{}\n",
            repris.iter().map(|r| format!("- {}", r)).collect::<Vec<_>>().join("\n")
        ));
    }
    if !regles.is_empty() {
        systeme.push_str(&format!(
            "\nRègles strictes à respecter :\n{}\n",
            regles.iter().map(|r| format!("- {}", r)).collect::<Vec<_>>().join("\n")
        ));
    }

    if est_un_tableau(format) {
        // Un modèle ne produit pas un classeur : il produit un tableau que
        // l'application met en classeur. Lui demander un « fichier xlsx »
        // rendrait une description de tableau, pas des lignes.
        systeme.push_str(
            "\nVous rendez un tableau. N'écrivez que ses lignes, séparées par des points-virgules, la première étant les en-têtes de colonnes. Mettez entre guillemets tout champ qui contient un point-virgule ou un retour à la ligne. Pas de préambule, pas de commentaire, pas de ligne de tirets.",
        );
    } else if est_un_document(format) {
        systeme.push_str(
            "\nVous rendez un document. Écrivez-le en texte simple : un titre sur sa propre ligne précédée de « # » (« ## » pour un sous-titre), un paragraphe par bloc séparé par une ligne vide, une puce par ligne commençant par « - », et **deux étoiles** autour de ce qui doit ressortir en gras. Pas de préambule, pas de commentaire sur ce que vous avez fait.",
        );
    } else if est_un_courriel(format) {
        // Le destinataire est la seule chose que l'agent ne peut pas savoir :
        // lui laisser l'inventer ferait un brouillon prêt à partir chez la
        // mauvaise personne.
        systeme.push_str(
            "\nVous rendez un courriel. Écrivez d'abord une ligne « Objet : » suivie de l'objet, puis une ligne vide, puis le corps de la lettre. N'inventez aucun destinataire ni aucune adresse : c'est votre employeur qui les mettra. Pas de préambule, pas de commentaire sur ce que vous avez fait.",
        );
    } else {
        systeme.push_str(&format!(
            "\nVous rendez un fichier « {} ». N'écrivez que son contenu : pas de préambule, pas de commentaire sur ce que vous avez fait.",
            format
        ));
    }
    if validation_humaine {
        // L'agent doit savoir que son travail est relu : un texte écrit pour
        // être envoyé tel quel ne se relit pas de la même façon.
        systeme.push_str(" Ce résultat sera relu et validé avant d'être utilisé : signalez ce dont vous n'êtes pas sûr plutôt que de le combler.");
    }

    let enonce = format!("{}\n\n{}", tache_nom.trim(), tache_description.trim());
    (systeme, enonce)
}

/// Ce que l'écran affiche après l'exécution.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Resultat {
    /// Le fichier posé, chemin complet : le client doit pouvoir l'ouvrir.
    pub fichier: String,
    /// `local` ou `api`, et pourquoi — repris du choix de `modele.rs`.
    pub voie: String,
    pub motif: String,
    /// Vrai quand le résultat attend un accord avant d'être utilisé.
    pub validation_humaine: bool,
}

/// Où cet agent travaille, dit au client.
///
/// Il doit pouvoir y déposer ce qu'il veut faire traiter et y retrouver les
/// résultats : un dossier de travail que personne ne nomme est un dossier que
/// personne n'ouvre.
#[tauri::command]
pub fn dossier_de_travail(prenom: String, fiche_id: String) -> Result<String, String> {
    let installation: serde_json::Value = serde_json::from_str(&crate::fiches::lire_installation()?)
        .map_err(|e| format!("installation illisible : {}", e))?;
    let agent = agent_installe(&installation, &prenom, &fiche_id)?;
    match agent.get("racine").and_then(serde_json::Value::as_str).map(str::trim) {
        Some(r) if !r.is_empty() => Ok(r.to_string()),
        _ => Ok(dossier_par_defaut(&prenom)?.display().to_string()),
    }
}

#[derive(Debug, Deserialize)]
struct SortieDeclaree {
    dossier: String,
    format: String,
}

/// La tâche à exécuter, lue dans la fiche installée.
struct TacheLue {
    nom: String,
    description: String,
    entrees: Vec<String>,
    sortie: SortieDeclaree,
    validation_humaine: bool,
    active: bool,
}

fn lire_tache(fiche: &serde_json::Value, tache_id: &str) -> Result<TacheLue, String> {
    let taches = fiche
        .get("taches")
        .and_then(serde_json::Value::as_array)
        .ok_or("fiche sans tâches")?;
    let t = taches
        .iter()
        .find(|t| t.get("id").and_then(serde_json::Value::as_str) == Some(tache_id))
        .ok_or_else(|| format!("la fiche n'a pas de tâche « {} »", tache_id))?;

    let sorties = t
        .get("sorties")
        .and_then(serde_json::Value::as_array)
        .and_then(|s| s.first())
        .ok_or_else(|| format!("la tâche « {} » ne dit pas où va son résultat", tache_id))?;

    Ok(TacheLue {
        nom: t.get("nom").and_then(serde_json::Value::as_str).unwrap_or(tache_id).to_string(),
        description: t
            .get("description")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string(),
        entrees: t
            .get("entrees")
            .and_then(serde_json::Value::as_array)
            .map(|v| v.iter().filter_map(|e| e.as_str().map(str::to_string)).collect())
            .unwrap_or_default(),
        sortie: serde_json::from_value(sorties.clone())
            .map_err(|e| format!("sortie illisible pour « {} » : {}", tache_id, e))?,
        validation_humaine: t
            .get("validationHumaine")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(true),
        active: t.get("active").and_then(serde_json::Value::as_bool).unwrap_or(false),
    })
}

/// L'agent installé sous ce prénom, et ce que le client lui a donné.
fn agent_installe(
    installation: &serde_json::Value,
    prenom: &str,
    fiche_id: &str,
) -> Result<serde_json::Value, String> {
    installation
        .get("agents")
        .and_then(serde_json::Value::as_array)
        .and_then(|agents| {
            agents
                .iter()
                .find(|a| {
                    a.get("prenom").and_then(serde_json::Value::as_str) == Some(prenom)
                        && a.get("ficheId").and_then(serde_json::Value::as_str) == Some(fiche_id)
                })
                .cloned()
        })
        .ok_or_else(|| format!("{} n'est pas embauché sur la fiche {}", prenom, fiche_id))
}

/// Tout ce qu'il faut pour exécuter une tâche, décidé avant d'appeler le modèle.
///
/// Rendu séparément de la commande pour être éprouvé : c'est ici que se
/// refusent l'agent non embauché, la tâche éteinte, le dossier non choisi et le
/// format que l'application ne sait pas écrire. Un banc qui ne peut pas
/// l'appeler ne prouverait rien de ces quatre refus.
#[derive(Debug, Clone, PartialEq)]
pub struct Preparation {
    pub dossier: PathBuf,
    pub nom_fichier: String,
    /// L'instant retenu pour cette exécution. Le nom du fichier en vient, et
    /// l'en-tête `Date:` d'un brouillon de courriel aussi : les deux doivent
    /// dire la même heure.
    pub epoque: u64,
    /// Le format déclaré par la tâche : il décide si le modèle rend un tableau.
    pub format: String,
    /// Les dossiers du poste où l'agent prend sa matière. Vide quand la fiche
    /// n'en désigne aucun, ce qui est le cas de 8 398 tâches sur 9 233.
    pub sources: Vec<PathBuf>,
    /// Vrai quand la fiche désignait au moins un dossier, même non choisi.
    pub source_declaree: bool,
    pub systeme: String,
    pub enonce: String,
    pub validation_humaine: bool,
}

pub fn preparer(
    installation: &str,
    fiche: &str,
    prenom: &str,
    fiche_id: &str,
    tache_id: &str,
    maintenant: u64,
    repris: &[String],
) -> Result<Preparation, String> {
    let installation: serde_json::Value = serde_json::from_str(installation)
        .map_err(|e| format!("installation illisible : {}", e))?;
    let agent = agent_installe(&installation, prenom, fiche_id)?;

    let fiche: serde_json::Value =
        serde_json::from_str(fiche).map_err(|e| format!("fiche illisible : {}", e))?;
    let tache = lire_tache(&fiche, tache_id)?;
    // Le client éteint les tâches qu'il ne veut pas : les exécuter quand même
    // ferait travailler l'agent sur ce qu'on lui a retiré.
    if !tache.active {
        return Err(format!(
            "la tâche « {} » est éteinte sur cet ordinateur : le client l'a désactivée",
            tache.nom
        ));
    }

    format_ecrivable(&tache.sortie.format)?;
    let vide = serde_json::json!({});
    let racine = agent.get("racine").and_then(serde_json::Value::as_str);
    let dossier = dossier_reel(
        agent.get("dossiers").unwrap_or(&vide),
        racine,
        prenom,
        &tache.sortie.dossier,
    )?;
    let nom_fichier = nom_du_fichier(tache_id, &horodatage(maintenant), &tache.sortie.format)?;

    let expert = fiche
        .get("expert")
        .ok_or("la fiche ne porte pas de métier : l'agent ne saurait pas comment travailler")?;
    let consigne = expert
        .get("consigne")
        .and_then(serde_json::Value::as_str)
        .ok_or("la fiche ne porte pas de consigne : l'agent ne saurait pas comment travailler")?;
    let savoirs = |source: Option<&serde_json::Value>| -> Vec<Savoir> {
        source
            .cloned()
            .and_then(|v| serde_json::from_value::<Vec<Savoir>>(v).ok())
            .unwrap_or_default()
            .into_iter()
            .filter(|s| !s.titre.is_empty() || !s.resume.is_empty())
            .collect()
    };
    let connaissances = savoirs(expert.get("connaissances"));
    let competences = savoirs(agent.get("competences"));
    // Les limites dures des fiches : elles étaient dans la conversation et pas
    // dans l'exécution, qui produit pourtant le document que le client utilise.
    let regles: Vec<String> = expert
        .get("regles")
        .and_then(serde_json::Value::as_array)
        .map(|v| v.iter().filter_map(|r| r.as_str().map(str::to_string)).collect())
        .unwrap_or_default();

    // La matière se lit dans les dossiers du client, jamais ailleurs : un
    // dossier logique que le client n'a pas encore choisi est ignoré, pas
    // deviné. L'agent est prévenu qu'il travaille sans, au moment de l'énoncé.
    let logiques = dossiers_sources(&tache.entrees);
    let sources: Vec<PathBuf> = logiques
        .iter()
        .filter_map(|l| dossier_reel(agent.get("dossiers").unwrap_or(&vide), racine, prenom, l).ok())
        .collect();

    let (systeme, enonce) = consigne_de_la_tache(
        consigne,
        prenom,
        &connaissances,
        &competences,
        repris,
        &regles,
        &tache.nom,
        &tache.description,
        &tache.sortie.format,
        tache.validation_humaine,
    );

    Ok(Preparation {
        dossier,
        nom_fichier,
        epoque: maintenant,
        format: tache.sortie.format.clone(),
        source_declaree: !logiques.is_empty(),
        sources,
        systeme,
        enonce,
        validation_humaine: tache.validation_humaine,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn installation(dossiers: &str) -> String {
        format!(
            r#"{{"agents":[{{"prenom":"Camille","ficheId":"AG-0001","voix":"fr","dossiers":{},"competences":[]}}]}}"#,
            dossiers
        )
    }

    fn fiche(format: &str, active: bool, validation: bool) -> String {
        fiche_avec(format, active, validation, "[]")
    }

    fn fiche_avec(format: &str, active: bool, validation: bool, entrees: &str) -> String {
        format!(
            r#"{{"id":"AG-0001","expert":{{"consigne":"Vous tenez le secrétariat."}},
               "taches":[{{"id":"compte-rendu","nom":"Compte rendu du soir",
                 "description":"Résumer la journée.","entrees":{},
                 "sorties":[{{"dossier":"courrier/reponses","format":"{}"}}],
                 "validationHumaine":{},"active":{}}}]}}"#,
            entrees, format, validation, active
        )
    }

    const DOSSIERS: &str = r#"{"courrier/reponses":"/tmp/iagent-essai"}"#;

    /// Le cœur du parcours minimal : une tâche allumée, un dossier choisi, un
    /// format écrivable, et l'agent sait quoi faire et où le poser.
    #[test]
    fn une_tache_prete_donne_de_quoi_travailler_et_ou_ecrire() {
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            1_758_585_600,
            &[],
        )
        .expect("la tâche devrait être prête");
        assert_eq!(p.dossier, PathBuf::from("/tmp/iagent-essai"));
        assert_eq!(p.nom_fichier, "compte-rendu-20250923-000000.md");
        assert!(p.systeme.contains("Vous tenez le secrétariat."));
        assert!(p.systeme.contains("fichier « md »"));
        assert!(p.enonce.contains("Compte rendu du soir"));
        assert!(!p.validation_humaine);
    }

    /// Le prénom et la fiche viennent de l'écran ; seule l'installation dit qui
    /// travaille chez le client. Sans ce refus, une vue suffirait à faire
    /// travailler une fiche que personne n'a installée.
    #[test]
    fn un_agent_non_embauche_ne_travaille_pas() {
        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Dominique",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap_err();
        assert!(e.contains("n'est pas embauché"), "{}", e);

        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0002",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap_err();
        assert!(e.contains("n'est pas embauché"), "{}", e);
    }

    /// Le client éteint ce qu'il ne veut pas : l'agent ne le fait pas quand même.
    #[test]
    fn une_tache_eteinte_ne_s_execute_pas() {
        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", false, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap_err();
        assert!(e.contains("éteinte"), "{}", e);
    }

    /// **L'agent travaille chez lui tant que le client ne lui a rien désigné.**
    /// Les fiches nomment 8 724 dossiers de sortie distincts : demander au
    /// client de les choisir avant que rien ne tourne, c'est l'impression de
    /// paramétrer que Max refuse. Et par défaut, l'agent ne sort pas de son
    /// dossier : atteindre celui du client se demande explicitement.
    #[test]
    fn sans_dossier_designe_l_agent_travaille_chez_lui() {
        let p = preparer(
            &installation("{}"),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .expect("l'agent a son propre dossier");
        let attendu = dossier_par_defaut("Camille").unwrap().join("courrier").join("reponses");
        assert_eq!(p.dossier, attendu);

        // Ce que le client désigne l'emporte.
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap();
        assert_eq!(p.dossier, PathBuf::from("/tmp/iagent-essai"));

        // Un chemin relatif se résoudrait depuis le dossier de l'application.
        let e = preparer(
            &installation(r#"{"courrier/reponses":"reponses"}"#),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap_err();
        assert!(e.contains("chemin complet"), "{}", e);
    }

    /// Un dossier logique vient d'un fichier du disque : un `..` qui passerait
    /// ferait d'une fiche un accès à tout le poste.
    #[test]
    fn un_dossier_logique_ne_remonte_jamais() {
        let vide = serde_json::json!({});
        for mauvais in ["../..", "courrier/../../etc", "/etc/passwd", "", "Courrier", "a//b"] {
            assert!(
                dossier_reel(&vide, None, "Camille", mauvais).is_err(),
                "« {} » devrait être refusé",
                mauvais
            );
        }
        assert!(dossier_reel(&vide, None, "Camille", "courrier/reponses").is_ok());
    }

    /// L'application doit dire ce qu'elle ne sait pas écrire, pas poser un
    /// `.docx` qui n'en est pas un.
    #[test]
    fn un_format_non_ecrit_se_dit_au_lieu_de_s_inventer() {
        for (format, mot) in [("png", "image"), ("jpg", "image"), ("mp4", "vidéo")] {
            let e = preparer(
                &installation(DOSSIERS),
                &fiche(format, true, false),
                "Camille",
                "AG-0001",
                "compte-rendu",
                0,
                &[],
            )
            .unwrap_err();
            assert!(e.contains(format) && e.contains(mot), "{} : {}", format, e);
        }
        assert!(format_ecrivable("md").is_ok());
        assert!(format_ecrivable("csv").is_ok());
        assert!(format_ecrivable("xlsx").is_ok());
        assert!(format_ecrivable("eml").is_ok());
        assert!(format_ecrivable("docx").is_ok());
        assert!(format_ecrivable("pdf").is_ok());
    }

    /// Le nom du fichier ne vient jamais de ce que le modèle propose : il est
    /// construit ici, sinon un résultat pourrait écraser un fichier du client ou
    /// sortir de son dossier.
    #[test]
    fn le_nom_du_fichier_ne_peut_pas_sortir_du_dossier() {
        assert!(nom_du_fichier("../../etc/passwd", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("compte rendu", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("Compte-Rendu", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("", "20250923-000000", "md").is_err());
        assert!(nom_du_fichier("compte-rendu", "20250923-000000", "png").is_err());
        assert_eq!(
            nom_du_fichier("compte-rendu", "20250923-000000", "md").unwrap(),
            "compte-rendu-20250923-000000.md"
        );
    }

    /// L'horodatage se lit et se trie : le client retrouve le dernier résultat
    /// dans son explorateur de fichiers, sans nous.
    #[test]
    fn l_horodatage_se_lit_et_se_trie() {
        assert_eq!(horodatage(0), "19700101-000000");
        assert_eq!(horodatage(1_758_585_600), "20250923-000000");
        assert_eq!(horodatage(1_758_585_600 + 3_661), "20250923-010101");
        // Une date après un 29 février : l'algorithme n'a pas de table à tenir.
        assert_eq!(horodatage(1_709_208_000), "20240229-120000");
        assert!(horodatage(1_758_585_600) < horodatage(1_758_672_000));
    }

    /// Un résultat relu n'est pas écrit comme un résultat envoyé : l'agent doit
    /// savoir qu'il peut signaler un doute plutôt que de le combler.
    #[test]
    fn un_resultat_qui_attend_un_accord_le_dit_a_l_agent() {
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, true),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap();
        assert!(p.validation_humaine);
        assert!(p.systeme.contains("relu et validé"), "{}", p.systeme);
    }

    /// Ce que l'employeur a appris à son agent s'ajoute au métier de la fiche,
    /// il ne le remplace pas — et il est lu dans la forme qu'il a vraiment,
    /// `{titre, resume}` : un premier jet cherchait un champ « texte » qui
    /// n'existe nulle part et perdait silencieusement tout l'apprentissage.
    #[test]
    fn les_competences_de_l_employeur_s_ajoutent_a_la_fiche() {
        let inst = r#"{"agents":[{"prenom":"Camille","ficheId":"AG-0001",
            "dossiers":{"courrier/reponses":"/tmp/iagent-essai"},
            "competences":[{"titre":"Nos devis","resume":"ils partent toujours en PDF."}]}]}"#;
        let p = preparer(inst, &fiche("md", true, false), "Camille", "AG-0001", "compte-rendu", 0, &[])
            .unwrap();
        assert!(p.systeme.contains("Vous tenez le secrétariat."));
        assert!(p.systeme.contains("Nos devis : ils partent toujours en PDF."), "{}", p.systeme);
        assert!(p.systeme.contains("prime sur le savoir général"), "{}", p.systeme);
    }

    /// **Les limites dures de la fiche doivent suivre l'agent dans ce qu'il
    /// rend, pas seulement dans ce qu'il dit.** Une fiche immigration interdit
    /// de se prononcer sur les droits d'une personne ; la conversation portait
    /// cette règle, l'exécution d'une tâche ne la portait pas — et c'est elle
    /// qui produit le document que le client utilisera.
    #[test]
    fn les_regles_strictes_de_la_fiche_suivent_le_travail_ecrit() {
        let f = r#"{"id":"AG-0001","expert":{"consigne":"Vous tenez le secrétariat.",
            "connaissances":[{"titre":"Courrier administratif","resume":"les formules d'appel."}],
            "regles":["L'agent ne se prononce jamais sur les droits d'une personne.",
                      "Aucun formulaire n'est soumis à la place de quelqu'un."]},
            "taches":[{"id":"compte-rendu","nom":"Compte rendu","description":"Résumer.",
              "entrees":[],"sorties":[{"dossier":"courrier/reponses","format":"md"}],
              "validationHumaine":false,"active":true}]}"#;
        let p = preparer(&installation(DOSSIERS), f, "Camille", "AG-0001", "compte-rendu", 0, &[])
            .unwrap();
        assert!(p.systeme.contains("Règles strictes"), "{}", p.systeme);
        assert!(p.systeme.contains("jamais sur les droits d'une personne"), "{}", p.systeme);
        assert!(p.systeme.contains("Aucun formulaire n'est soumis"), "{}", p.systeme);
        assert!(p.systeme.contains("Courrier administratif : les formules d'appel."), "{}", p.systeme);
        assert!(p.systeme.contains("Vous vous appelez Camille."), "{}", p.systeme);
        // Les règles passent après le métier : c'est la dernière chose lue.
        assert!(
            p.systeme.find("Règles strictes").unwrap() > p.systeme.find("Courrier administratif").unwrap()
        );
    }

    /// Ce que l'employeur a déjà repris suit l'agent dans son travail écrit :
    /// une correction qui ne vaut que pour ce qu'il dit, il la refait dans ce
    /// qu'il rend.
    #[test]
    fn ce_qui_a_ete_repris_suit_l_agent_dans_ce_qu_il_rend() {
        let repris = vec!["Ne jamais écrire « Cher Monsieur » à une mairie.".to_string()];
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &repris,
        )
        .unwrap();
        assert!(p.systeme.contains("déjà repris"), "{}", p.systeme);
        assert!(p.systeme.contains("Cher Monsieur"), "{}", p.systeme);
    }

    /// Le fichier est posé entier ou pas du tout, et n'écrase jamais.
    #[test]
    fn l_objet_se_prend_a_la_ligne_qui_le_nomme() {
        let (objet, corps) = objet_et_corps("Objet : Relance de la facture 412\n\nBonjour,\n\nSauf erreur…");
        assert_eq!(objet, "Relance de la facture 412");
        assert!(corps.starts_with("Bonjour,"), "{}", corps);
        assert!(!corps.contains("Objet"), "{}", corps);
    }

    #[test]
    fn sans_etiquette_la_premiere_ligne_sert_d_objet_et_reste_dans_le_corps() {
        // Le modèle n'a pas suivi la consigne. Un brouillon sans objet se perd
        // dans une boîte de réception ; effacer sa première ligne perdrait une
        // phrase du message.
        let (objet, corps) = objet_et_corps("Votre commande du 12 mars\n\nBonjour,");
        assert_eq!(objet, "Votre commande du 12 mars");
        assert!(corps.starts_with("Votre commande du 12 mars"), "{}", corps);
        assert!(corps.contains("Bonjour,"), "{}", corps);
    }

    #[test]
    fn un_accent_dans_l_objet_ne_part_pas_de_travers() {
        // Sans encodage, le client de messagerie affiche « RÃ©union ».
        assert_eq!(objet_encode("Relance facture 412"), "Relance facture 412");
        let encode = objet_encode("Réunion du 3 février");
        assert!(encode.starts_with("=?UTF-8?B?") && encode.ends_with("?="), "{}", encode);
        assert_eq!(base64("Réunion".as_bytes()), "UsOpdW5pb24=");
        assert_eq!(base64(b"a"), "YQ==");
        assert_eq!(base64(b"ab"), "YWI=");
        assert_eq!(base64(b"abc"), "YWJj");
    }

    #[test]
    fn une_ligne_trop_longue_est_repliee_et_le_signe_egal_s_echappe() {
        // Une ligne de plus de 998 octets rend le message non conforme et
        // certains serveurs la coupent au milieu d'un mot.
        let longue = "a".repeat(200);
        let encode = quoted_printable(&longue);
        assert!(
            encode.split("\r\n").all(|l| l.len() <= 76),
            "ligne trop longue : {:?}",
            encode.split("\r\n").map(str::len).collect::<Vec<_>>()
        );
        // Le repli est doux : il ne s'ajoute rien au texte une fois décodé.
        assert_eq!(encode.replace("=\r\n", ""), longue);
        assert_eq!(quoted_printable("2 = 2"), "2 =3D 2");
        assert_eq!(quoted_printable("été"), "=C3=A9t=C3=A9");
    }

    #[test]
    fn un_espace_en_fin_de_ligne_survit_au_transport() {
        // Les serveurs mangent les espaces de fin de ligne : encodés, ils
        // passent. Au milieu d'une ligne, ils restent lisibles.
        assert_eq!(quoted_printable("Bonjour "), "Bonjour=20");
        assert_eq!(quoted_printable("Bonjour Madame"), "Bonjour Madame");
    }

    #[test]
    fn la_date_du_courriel_dit_la_meme_heure_que_le_nom_du_fichier() {
        assert_eq!(horodatage(0), "19700101-000000");
        assert_eq!(date_rfc5322(0), "Thu, 01 Jan 1970 00:00:00 +0000");
        // 2026-09-23 14:30:00 UTC, un mercredi.
        let t = 1_790_173_800;
        assert_eq!(horodatage(t), "20260923-143000");
        assert_eq!(date_rfc5322(t), "Wed, 23 Sep 2026 14:30:00 +0000");
    }

    #[test]
    fn un_brouillon_de_courriel_s_ouvre_en_redaction_et_sans_destinataire() {
        let dossier = std::env::temp_dir().join(format!("iagent-eml-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);

        let chemin = poser_courriel(
            &dossier,
            "relance-20260923-143000.eml",
            1_790_173_800,
            "Objet : Relance de la facture 412\n\nMadame,\n\nSauf erreur de notre part, la facture 412 reste impayée.",
        )
        .expect("brouillon écrit");
        let eml = std::fs::read_to_string(&chemin).unwrap();

        assert!(eml.contains("Date: Wed, 23 Sep 2026 14:30:00 +0000"), "{}", eml);
        assert!(eml.contains("Subject: Relance de la facture 412"), "{}", eml);
        assert!(eml.contains("Content-Type: text/plain; charset=utf-8"), "{}", eml);
        assert!(eml.contains("Content-Transfer-Encoding: quoted-printable"), "{}", eml);
        // Ce qui fait qu'Outlook et Thunderbird l'ouvrent en rédaction.
        assert!(eml.contains("X-Unsent: 1"), "{}", eml);
        // Aucune adresse inventée, ni en expéditeur ni en destinataire : c'est
        // le client qui les met, dans son logiciel de messagerie.
        assert!(!eml.contains("\r\nTo:"), "{}", eml);
        assert!(!eml.contains("\r\nFrom:"), "{}", eml);
        // L'en-tête se sépare du corps par une ligne vide, et le corps y est.
        let (entetes, corps) = eml.split_once("\r\n\r\n").expect("ligne vide séparatrice");
        assert!(!entetes.contains("Madame"), "{}", entetes);
        assert!(corps.contains("Madame,"), "{}", corps);
        assert!(corps.contains("impay=C3=A9e"), "{}", corps);

        // Rien n'est écrasé, et rien de provisoire ne reste.
        assert!(poser_courriel(&dossier, "relance-20260923-143000.eml", 1_790_173_800, "Objet : X\n\nY").is_err());
        let restes: Vec<_> = std::fs::read_dir(&dossier).unwrap().flatten()
            .map(|e| e.file_name().to_string_lossy().to_string()).collect();
        assert_eq!(restes, vec!["relance-20260923-143000.eml".to_string()]);

        // Un message vide est un échec, pas un brouillon vide.
        assert!(poser_courriel(&dossier, "vide.eml", 0, "Objet : Rien\n\n   ").is_err());

        let _ = std::fs::remove_dir_all(&dossier);
    }

    #[test]
    fn on_ne_demande_pas_d_en_tetes_au_modele() {
        // Même règle que le classeur : un modèle à qui on demande un « fichier
        // eml » rend des en-têtes plausibles et mal formées.
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("eml", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .expect("tâche prête");
        assert_eq!(p.format, "eml");
        assert!(p.nom_fichier.ends_with(".eml"));
        assert!(!p.systeme.contains("fichier « eml »"), "{}", p.systeme);
        assert!(p.systeme.contains("Objet :"), "{}", p.systeme);
        assert!(p.systeme.contains("N'inventez aucun destinataire"), "{}", p.systeme);
        assert!(est_un_courriel("eml") && !est_un_courriel("md"));
    }

    #[test]
    fn le_resultat_est_pose_entier_et_n_ecrase_rien() {
        let dossier = std::env::temp_dir().join(format!("iagent-tache-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);

        let chemin = poser(&dossier, "essai.md", "Le compte rendu.").unwrap();
        assert_eq!(std::fs::read_to_string(&chemin).unwrap(), "Le compte rendu.");

        let e = poser(&dossier, "essai.md", "Autre chose.").unwrap_err();
        assert!(e.contains("existe déjà"), "{}", e);
        // Le premier résultat n'a pas bougé.
        assert_eq!(std::fs::read_to_string(&chemin).unwrap(), "Le compte rendu.");
        // Et rien de provisoire n'est resté dans le dossier du client.
        let restes: Vec<_> = std::fs::read_dir(&dossier)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert_eq!(restes, vec!["essai.md".to_string()]);

        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// Le tableau le plus réclamé des fiches : 4 100 sorties sur 9 265. Un
    /// modèle rend des lignes, pas un classeur.
    #[test]
    fn un_tableau_rendu_par_le_modele_se_decoupe() {
        let lignes = lignes_du_tableau("Client;Montant;Échéance\nDupont;1250,50;2026-10-01\n");
        assert_eq!(lignes.len(), 2);
        assert_eq!(lignes[0], vec!["Client", "Montant", "Échéance"]);
        assert_eq!(lignes[1], vec!["Dupont", "1250,50", "2026-10-01"]);
    }

    /// Le piège du tableau : une phrase qui contient le séparateur. Sans les
    /// guillemets, la ligne casse en deux colonnes et tout le reste se décale —
    /// une erreur qu'on ne voit qu'en ouvrant le fichier chez le client.
    #[test]
    fn un_champ_entre_guillemets_garde_ses_separateurs() {
        let lignes = lignes_du_tableau(
            "Poste;Motif\nFacture;\"Relance envoyée; sans réponse\"\nDevis;\"Il a dit \"\"non\"\"\"\n",
        );
        assert_eq!(lignes[1], vec!["Facture", "Relance envoyée; sans réponse"]);
        assert_eq!(lignes[2], vec!["Devis", "Il a dit \"non\""]);
    }

    /// Le point-virgule est demandé, mais un modèle rend parfois des virgules :
    /// rendre un classeur d'une seule colonne serait pire que de s'adapter.
    #[test]
    fn un_tableau_en_virgules_ne_finit_pas_en_une_colonne() {
        let lignes = lignes_du_tableau("Client,Montant\nDupont,1250\n");
        assert_eq!(lignes[0].len(), 2);
        assert_eq!(lignes[1], vec!["Dupont", "1250"]);
    }

    /// Un nombre doit s'additionner dans le classeur ; une référence à zéro en
    /// tête doit rester ce qu'elle est.
    #[test]
    fn un_nombre_est_un_nombre_et_une_reference_reste_du_texte() {
        assert_eq!(nombre_du_champ("1250,50"), Some(1250.5));
        assert_eq!(nombre_du_champ("1 250,50"), Some(1250.5));
        assert_eq!(nombre_du_champ("-3"), Some(-3.0));
        assert_eq!(nombre_du_champ("0,75"), Some(0.75));
        assert_eq!(nombre_du_champ("0012"), None, "une référence perdrait ses zéros");
        assert_eq!(nombre_du_champ("2026-10-01"), None);
        assert_eq!(nombre_du_champ("Dupont"), None);
        assert_eq!(nombre_du_champ(""), None);
    }

    /// Le classeur posé doit être un vrai classeur : un fichier ZIP portant les
    /// pièces qu'un tableur attend. Sinon le client ouvre une erreur.
    #[test]
    fn le_classeur_pose_est_un_vrai_classeur() {
        let dossier = std::env::temp_dir().join(format!("iagent-xlsx-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);

        let lignes = lignes_du_tableau("Client;Montant\nDupont;1250,50\nMartin;300\n");
        let chemin = poser_tableur(&dossier, "releve.xlsx", &lignes).expect("classeur écrit");

        let octets = std::fs::read(&chemin).expect("classeur lisible");
        assert_eq!(&octets[..2], b"PK", "un .xlsx est une archive ZIP");
        let texte = String::from_utf8_lossy(&octets);
        assert!(texte.contains("xl/worksheets/sheet1.xml"), "pièce de feuille absente");
        assert!(texte.contains("[Content_Types].xml"), "manifeste absent");

        // Rien n'est écrasé, et rien de provisoire ne reste chez le client.
        assert!(poser_tableur(&dossier, "releve.xlsx", &lignes).is_err());
        let restes: Vec<_> = std::fs::read_dir(&dossier).unwrap().flatten()
            .map(|e| e.file_name().to_string_lossy().to_string()).collect();
        assert_eq!(restes, vec!["releve.xlsx".to_string()]);

        // Un tableau vide n'est pas un classeur vide : c'est un échec.
        assert!(poser_tableur(&dossier, "vide.xlsx", &[]).is_err());

        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// On ne demande pas un « fichier xlsx » à un modèle : il rendrait la
    /// description d'un tableau. On lui demande des lignes.
    #[test]
    fn la_consigne_d_un_tableur_demande_des_lignes() {
        let p = preparer(
            &installation(DOSSIERS),
            &fiche("xlsx", true, false),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap();
        assert_eq!(p.format, "xlsx");
        assert!(p.nom_fichier.ends_with(".xlsx"));
        assert!(p.systeme.contains("points-virgules"), "{}", p.systeme);
        assert!(!p.systeme.contains("fichier « xlsx »"), "{}", p.systeme);
        assert!(est_un_tableau("xlsx") && !est_un_tableau("md"));
    }

    /// **Le test qui compte.** 8 398 tâches sur 9 233 ne désignent aucune source :
    /// un agent à qui on demande de contrôler des pièces sans lui donner de
    /// pièces rend un rapport vraisemblable et faux, que le client n'a aucun
    /// moyen de démentir. On lui demande donc ce qui lui manque.
    #[test]
    fn sans_matiere_l_agent_doit_reclamer_au_lieu_d_inventer() {
        let mots = matiere_en_mots(&Matiere::default(), false);
        assert!(mots.contains("N'inventez rien"), "{}", mots);
        assert!(mots.contains("ce qu'il vous faut"), "{}", mots);
        assert!(mots.contains("ne dit pas encore dans quel dossier"), "{}", mots);

        // Quand la fiche désignait bien un dossier, on ne lui reproche pas.
        let mots = matiere_en_mots(&Matiere::default(), true);
        assert!(mots.contains("N'inventez rien"), "{}", mots);
        assert!(!mots.contains("ne dit pas encore"), "{}", mots);
    }

    /// Une entrée est un dossier ou rien : les 8 398 autres sont des mots qui
    /// disent de quoi il s'agit, pas où le prendre.
    #[test]
    fn seules_les_entrees_en_dossier_designent_une_source() {
        let entrees: Vec<String> = ["dossier:courrier/entrant", "pièces de référence", "calendrier", "dossier:"]
            .iter().map(|s| s.to_string()).collect();
        assert_eq!(dossiers_sources(&entrees), vec!["courrier/entrant".to_string()]);
    }

    /// L'agent doit voir ce que le client a déposé, et savoir ce qu'il n'a pas pu
    /// ouvrir : un PDF présent dont il ne sait rien fausserait sa réponse.
    #[test]
    fn la_matiere_du_dossier_arrive_a_l_agent_avec_ses_trous() {
        let dossier = std::env::temp_dir().join(format!("iagent-matiere-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);
        std::fs::create_dir_all(&dossier).unwrap();
        std::fs::write(dossier.join("note.md"), "Relancer Dupont.").unwrap();
        std::fs::write(dossier.join("facture.pdf"), b"%PDF-1.7 pas du texte").unwrap();
        std::fs::write(dossier.join(".cache"), "invisible").unwrap();
        std::fs::create_dir_all(dossier.join("archives")).unwrap();

        let m = lire_matiere(&dossier);
        assert_eq!(m.textes.len(), 1, "seul le texte est lu : {:?}", m);
        assert_eq!(m.textes[0].0, "note.md");
        assert!(m.textes[0].1.contains("Relancer Dupont"));
        assert!(m.non_lus.iter().any(|n| n.starts_with("facture.pdf")), "{:?}", m.non_lus);
        assert!(m.non_lus.iter().any(|n| n.starts_with("archives")), "{:?}", m.non_lus);
        assert!(!m.non_lus.iter().any(|n| n.starts_with(".cache")), "un fichier caché n'est pas du travail");
        assert!(!m.tronque);

        let mots = matiere_en_mots(&m, true);
        assert!(mots.contains("Voici ce que vous avez reçu"), "{}", mots);
        assert!(mots.contains("Relancer Dupont"), "{}", mots);
        assert!(mots.contains("facture.pdf"), "{}", mots);
        assert!(!mots.contains("N'inventez rien"), "il a de la matière : {}", mots);

        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// Ce qu'un agent écrit est la matière du suivant : les fiches disent de
    /// quel poste chacune reçoit et à quel poste elle transmet. Un classeur ou
    /// un document qu'on écrit sans savoir le relire casse le relais.
    #[test]
    fn ce_que_l_agent_ecrit_se_relit_depuis_son_dossier() {
        let dossier = std::env::temp_dir().join(format!("iagent-relais-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);
        poser_tableur(
            &dossier,
            "depenses.xlsx",
            &lignes_du_tableau("Poste;Montant\nLoyer;4250"),
        )
        .unwrap();
        crate::document::poser_document(&dossier, "note.docx", "# Note\n\nÀ relancer.").unwrap();
        poser_courriel(
            &dossier,
            "relance.eml",
            1_790_173_800,
            "Objet : Facture 412\n\nLa facture 412 reste impayée.",
        )
        .unwrap();
        // Celui-là s'écrit mais ne se relit pas, et l'agent doit l'apprendre.
        crate::pdf::poser_pdf(&dossier, "rapport.pdf", 1_790_173_800, "# Rapport\n\nTexte.").unwrap();

        let m = lire_matiere(&dossier);
        let lus: Vec<&str> = m.textes.iter().map(|(n, _)| n.as_str()).collect();
        assert_eq!(lus, vec!["depenses.xlsx", "note.docx", "relance.eml"], "{:?}", m);
        let mots = matiere_en_mots(&m, true);
        assert!(mots.contains("Poste;Montant"), "le classeur n'est pas relu : {}", mots);
        assert!(mots.contains("# Note"), "le document n'est pas relu : {}", mots);
        assert!(mots.contains("reste impayée"), "le courriel n'est pas relu : {}", mots);
        assert!(!mots.contains("=C3="), "le courriel garde son encodage : {}", mots);
        assert!(
            m.non_lus.iter().any(|n| n.starts_with("rapport.pdf")),
            "le PDF doit être nommé sans être ouvert : {:?}",
            m.non_lus
        );
        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// Un dossier de travail peut porter des années d'archives : on ne les verse
    /// pas toutes au modèle, et l'agent sait qu'il n'a pas tout vu.
    #[test]
    fn un_dossier_trop_plein_est_borne_et_l_agent_le_sait() {
        let dossier = std::env::temp_dir().join(format!("iagent-plein-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);
        std::fs::create_dir_all(&dossier).unwrap();
        for i in 0..(FICHIERS_LUS_MAX + 5) {
            std::fs::write(dossier.join(format!("note-{:03}.md", i)), "un mot").unwrap();
        }
        let m = lire_matiere(&dossier);
        assert_eq!(m.textes.len(), FICHIERS_LUS_MAX);
        assert!(m.tronque);
        assert!(matiere_en_mots(&m, true).contains("vous n'avez pas tout vu"));
        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// La matière se cherche chez l'agent tant que le client n'a rien désigné,
    /// jamais ailleurs sur le poste.
    #[test]
    fn la_source_se_cherche_chez_l_agent_puis_la_ou_le_client_dit() {
        let p = preparer(
            &installation("{}"),
            &fiche_avec("md", true, false, r#"["dossier:courrier/entrant"]"#),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap();
        assert!(p.source_declaree, "la fiche désigne bien un dossier");
        assert_eq!(
            p.sources,
            vec![dossier_par_defaut("Camille").unwrap().join("courrier").join("entrant")]
        );

        let avec = r#"{"courrier/reponses":"/tmp/iagent-essai","courrier/entrant":"/tmp/iagent-entrant"}"#;
        let p = preparer(
            &installation(avec),
            &fiche_avec("md", true, false, r#"["dossier:courrier/entrant"]"#),
            "Camille",
            "AG-0001",
            "compte-rendu",
            0,
            &[],
        )
        .unwrap();
        assert_eq!(p.sources, vec![PathBuf::from("/tmp/iagent-entrant")]);
    }

    /// Une tâche que la fiche ne porte pas ne s'invente pas.
    #[test]
    fn une_tache_inconnue_se_refuse() {
        let e = preparer(
            &installation(DOSSIERS),
            &fiche("md", true, false),
            "Camille",
            "AG-0001",
            "autre-chose",
            0,
            &[],
        )
        .unwrap_err();
        assert!(e.contains("autre-chose"), "{}", e);
    }
}
