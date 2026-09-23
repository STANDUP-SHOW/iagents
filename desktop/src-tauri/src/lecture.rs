//! Relire les fichiers que l'application sait écrire.
//!
//! L'agent écrit un classeur (4 100 sorties), un document (833) et un courriel
//! (200), et ne savait relire aucun des trois : déposés dans son dossier
//! d'entrée, ils lui étaient seulement **nommés**. C'est un trou fermé, pas un
//! trou ouvert sur le monde : les fiches disent de quel poste chacune reçoit et
//! à quel poste elle transmet, donc ce qu'un agent écrit est la matière du
//! suivant. Écrire un tableau que personne ne peut relire casse la chaîne à
//! chaque relais.
//!
//! Rien de nouveau n'entre pour ça non plus. Un `.xlsx` et un `.docx` sont des
//! archives ZIP de pièces XML, et le ZIP est déjà compilé dans le binaire ; le
//! `.eml` se relit avec `mailparse`, que le relevé du courrier emploie déjà.
//!
//! Ce qui n'est pas relu : le PDF. Un PDF écrit ici se relirait, mais ceux qui
//! arrivent du monde portent des polices découpées, des flux comprimés ou du
//! texte scanné qui n'est pas du texte. Promettre de les lire donnerait à
//! l'agent une matière vide sans qu'il le sache, ce qui est pire que de la lui
//! refuser en clair.

use std::io::Read;

/// Rend les entités d'un texte XML.
fn desechapper(texte: &str) -> String {
    let mut sortie = String::with_capacity(texte.len());
    let mut reste = texte;
    while let Some(i) = reste.find('&') {
        sortie.push_str(&reste[..i]);
        let suite = &reste[i..];
        let Some(fin) = suite.find(';').filter(|f| *f <= 10) else {
            sortie.push('&');
            reste = &suite[1..];
            continue;
        };
        let entite = &suite[1..fin];
        match entite {
            "amp" => sortie.push('&'),
            "lt" => sortie.push('<'),
            "gt" => sortie.push('>'),
            "quot" => sortie.push('"'),
            "apos" => sortie.push('\''),
            _ => {
                let point = entite
                    .strip_prefix("#x")
                    .or_else(|| entite.strip_prefix("#X"))
                    .and_then(|h| u32::from_str_radix(h, 16).ok())
                    .or_else(|| entite.strip_prefix('#').and_then(|d| d.parse().ok()))
                    .and_then(char::from_u32);
                match point {
                    Some(c) => sortie.push(c),
                    // Une entité qu'on ne connaît pas se garde telle quelle :
                    // la faire disparaître serait mentir sur le contenu.
                    None => sortie.push_str(&suite[..=fin]),
                }
            }
        }
        reste = &suite[fin + 1..];
    }
    sortie.push_str(reste);
    sortie
}

/// Chaque élément portant ce nom : ses attributs bruts, puis son contenu.
///
/// Un balayage suffit ici : les pièces lues sont engendrées par un tableur ou
/// un traitement de texte, et les éléments cherchés (`w:p`, `w:r`, `c`, `row`)
/// ne s'emboîtent jamais dans eux-mêmes. Le nom est comparé jusqu'à son espace
/// ou son chevron, sinon `<w:p>` ramasserait aussi `<w:pPr>`.
fn balises<'a>(xml: &'a str, nom: &str) -> Vec<(&'a str, &'a str)> {
    let ouverture = format!("<{}", nom);
    let fermeture = format!("</{}>", nom);
    let mut trouves = Vec::new();
    let mut reste = xml;
    while let Some(i) = reste.find(&ouverture) {
        let apres = &reste[i + ouverture.len()..];
        let Some(premier) = apres.chars().next() else { break };
        if premier != '>' && premier != ' ' && premier != '/' {
            reste = apres;
            continue;
        }
        let Some(j) = apres.find('>') else { break };
        let attributs = apres[..j].trim();
        // `<c r="A1"/>` : une cellule déclarée et vide, qui compte quand même
        // comme colonne.
        if let Some(sans_barre) = attributs.strip_suffix('/') {
            trouves.push((sans_barre.trim_end(), ""));
            reste = &apres[j + 1..];
            continue;
        }
        let corps = &apres[j + 1..];
        match corps.find(&fermeture) {
            Some(k) => {
                trouves.push((attributs, &corps[..k]));
                reste = &corps[k + fermeture.len()..];
            }
            None => break,
        }
    }
    trouves
}

/// Le contenu de chaque élément portant ce nom, attributs mis de côté.
fn elements<'a>(xml: &'a str, nom: &str) -> Vec<&'a str> {
    balises(xml, nom).into_iter().map(|(_, corps)| corps).collect()
}

/// La valeur d'un attribut, lue dans les attributs bruts d'une balise.
///
/// Le nom doit commencer un attribut, pas finir celui d'à côté : chercher `r=`
/// dans `spr="x" r="A1"` trouverait le premier et rendrait la mauvaise valeur.
fn valeur(attributs: &str, cle: &str) -> Option<String> {
    let motif = format!("{}=\"", cle);
    let mut depuis = 0usize;
    while let Some(trouve) = attributs[depuis..].find(&motif) {
        let debut = depuis + trouve;
        let entier = debut == 0
            || attributs[..debut]
                .chars()
                .next_back()
                .is_some_and(char::is_whitespace);
        if entier {
            let i = debut + motif.len();
            let j = attributs[i..].find('"')? + i;
            return Some(desechapper(&attributs[i..j]));
        }
        depuis = debut + motif.len();
    }
    None
}

/// La valeur d'un attribut du premier élément `nom` rencontré.
fn attribut(xml: &str, nom: &str, cle: &str) -> Option<String> {
    balises(xml, nom).first().and_then(|(a, _)| valeur(a, cle))
}

/// Une pièce de l'archive, en clair.
fn piece(octets: &[u8], nom: &str) -> Result<String, String> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(octets))
        .map_err(|e| format!("ce fichier n'est pas une archive lisible : {}", e))?;
    let mut fichier = archive
        .by_name(nom)
        .map_err(|_| format!("{} manque dans l'archive", nom))?;
    let mut contenu = String::new();
    fichier
        .read_to_string(&mut contenu)
        .map_err(|e| format!("lecture de {} : {}", nom, e))?;
    Ok(contenu)
}

/// Les noms des pièces de l'archive.
fn pieces(octets: &[u8]) -> Result<Vec<String>, String> {
    let archive = zip::ZipArchive::new(std::io::Cursor::new(octets))
        .map_err(|e| format!("ce fichier n'est pas une archive lisible : {}", e))?;
    Ok(archive.file_names().map(str::to_string).collect())
}

// ---------------------------------------------------------------------------
// Le document
// ---------------------------------------------------------------------------

/// Le texte d'un `.docx`, rendu dans les mêmes marques que celles qu'on écrit.
///
/// Aller-retour : ce que `document.rs` a écrit se relit tel quel. Les marques
/// se posent autour du mot et pas autour de ses espaces de bord, sinon la
/// relecture les laisserait en clair — c'est la règle habituelle du Markdown,
/// et `segments` l'applique déjà à l'écriture.
pub fn lire_document_word(octets: &[u8]) -> Result<String, String> {
    let xml = piece(octets, "word/document.xml")?;
    let mut blocs: Vec<(&str, String)> = Vec::new();
    for paragraphe in elements(&xml, "w:p") {
        let prefixe = match attribut(paragraphe, "w:pStyle", "w:val").as_deref() {
            Some("Heading1") => "# ",
            Some("Heading2") => "## ",
            Some("Heading3") => "### ",
            Some("ListParagraph") => "- ",
            _ => "",
        };
        let mut ligne = String::new();
        for passage in elements(paragraphe, "w:r") {
            let proprietes = elements(passage, "w:rPr").concat();
            let gras = proprietes.contains("<w:b/>") || proprietes.contains("<w:b ");
            let italique = proprietes.contains("<w:i/>") || proprietes.contains("<w:i ");
            let brut = desechapper(&elements(passage, "w:t").concat());
            let coeur = brut.trim();
            if coeur.is_empty() {
                ligne.push_str(&brut);
                continue;
            }
            let marque = match (gras, italique) {
                (true, true) => "***",
                (true, false) => "**",
                (false, true) => "*",
                (false, false) => "",
            };
            let avant = &brut[..brut.len() - brut.trim_start().len()];
            let apres = &brut[brut.trim_end().len()..];
            ligne.push_str(&format!("{}{}{}{}{}", avant, marque, coeur, marque, apres));
        }
        if ligne.trim().is_empty() {
            continue;
        }
        blocs.push((prefixe, ligne.trim_end().to_string()));
    }
    if blocs.is_empty() {
        return Err("ce document ne contient aucun texte".to_string());
    }

    let mut sortie = String::new();
    for (i, (prefixe, ligne)) in blocs.iter().enumerate() {
        sortie.push_str(prefixe);
        sortie.push_str(ligne);
        let Some((suivant, _)) = blocs.get(i + 1) else { break };
        // Deux puces qui se suivent n'ont pas de ligne vide entre elles : c'est
        // ainsi qu'on les écrit, et un blanc de plus à chaque relais finirait
        // par aérer le document jusqu'à l'absurde.
        sortie.push_str(if *prefixe == "- " && *suivant == "- " { "\n" } else { "\n\n" });
    }
    Ok(sortie)
}

// ---------------------------------------------------------------------------
// Le classeur
// ---------------------------------------------------------------------------

/// Les formats de nombre qui sont des dates, par leur identifiant.
///
/// Les identifiants 14 à 22 et 45 à 47 sont ceux que le format réserve aux
/// dates et aux heures. Au-delà, un classeur définit les siens : on les
/// reconnaît à un `y` ou un `d` dans leur écriture, qu'un format d'heure seule
/// (`h:mm:ss`) n'a pas — le `m` ne suffirait pas à trancher, il vaut le mois
/// autant que la minute.
fn formats_de_date(styles: &str) -> std::collections::HashSet<u32> {
    let mut dates: std::collections::HashSet<u32> = (14..=22).chain(45..=47).collect();
    for (attributs, _) in balises(styles, "numFmt") {
        let (Some(id), Some(code)) = (valeur(attributs, "numFmtId"), valeur(attributs, "formatCode"))
        else {
            continue;
        };
        let minuscule = code.to_lowercase();
        if let Ok(id) = id.parse::<u32>() {
            if minuscule.contains('y') || minuscule.contains('d') {
                dates.insert(id);
            }
        }
    }
    dates
}

/// Le format de nombre de chaque style de cellule, dans l'ordre où ils sont
/// définis : c'est l'indice `s` d'une cellule qui y renvoie.
fn formats_des_styles(styles: &str) -> Vec<u32> {
    let Some(bloc) = elements(styles, "cellXfs").into_iter().next() else {
        return Vec::new();
    };
    balises(bloc, "xf")
        .into_iter()
        .map(|(attributs, _)| {
            valeur(attributs, "numFmtId")
                .and_then(|n| n.parse().ok())
                .unwrap_or(0)
        })
        .collect()
}

/// Les textes du classeur, rangés une fois pour toutes et cités par indice.
fn chaines_partagees(xml: &str) -> Vec<String> {
    elements(xml, "si")
        .into_iter()
        .map(|si| desechapper(&elements(si, "t").concat()))
        .collect()
}

/// La colonne d'une cellule, depuis sa référence : `A1` donne 0, `AB3` donne 27.
fn colonne(reference: &str) -> usize {
    let mut n = 0usize;
    for c in reference.chars().take_while(|c| c.is_ascii_alphabetic()) {
        n = n * 26 + (c.to_ascii_uppercase() as usize - 'A' as usize + 1);
    }
    n.saturating_sub(1)
}

/// Le jour civil d'un nombre de jours depuis le 1er janvier 1970.
///
/// `tache::civil` part de l'époque Unix et ne compte qu'en avant ; un classeur
/// de client porte des dates de naissance et des dates d'achat d'avant 1970.
/// L'algorithme est celui de la proleptique grégorienne, valable des deux côtés
/// de l'époque : on se place dans une ère de 400 ans, qui compte toujours
/// 146 097 jours, et on redescend jusqu'au jour.
fn date_civile(jours_depuis_1970: i64) -> (i64, i64, i64) {
    let z = jours_depuis_1970 + 719_468;
    let ere = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let jour_de_l_ere = z - ere * 146_097;
    let an_de_l_ere = (jour_de_l_ere - jour_de_l_ere / 1460 + jour_de_l_ere / 36_524
        - jour_de_l_ere / 146_096)
        / 365;
    let annee = an_de_l_ere + ere * 400;
    let jour_de_l_an =
        jour_de_l_ere - (365 * an_de_l_ere + an_de_l_ere / 4 - an_de_l_ere / 100);
    // L'année commence en mars dans ce découpage : janvier et février
    // appartiennent à l'année civile suivante.
    let mois_decale = (5 * jour_de_l_an + 2) / 153;
    let jour = jour_de_l_an - (153 * mois_decale + 2) / 5 + 1;
    let mois = mois_decale + if mois_decale < 10 { 3 } else { -9 };
    (annee + i64::from(mois <= 2), mois, jour)
}

/// Une date d'Excel, rendue en clair.
///
/// Le numéro est un nombre de jours depuis le 1er janvier 1900, avec le 29
/// février 1900 que le format compte alors qu'il n'a jamais existé : au-delà du
/// numéro 60, il faut donc retrancher ce jour de trop.
fn date_du_numero(numero: f64) -> Option<String> {
    let jours = numero.trunc();
    if !(1.0..=2_958_465.0).contains(&jours) {
        return None;
    }
    let depuis_1970 = (jours - if jours >= 61.0 { 25_569.0 } else { 25_568.0 }) as i64;
    let (annee, mois, jour) = date_civile(depuis_1970);
    let secondes_du_jour = ((numero - jours) * 86_400.0).round() as u64;
    let (heure, minute) = (secondes_du_jour / 3600, (secondes_du_jour % 3600) / 60);
    Some(if heure == 0 && minute == 0 {
        format!("{:02}/{:02}/{:04}", jour, mois, annee)
    } else {
        format!("{:02}/{:02}/{:04} {:02}:{:02}", jour, mois, annee, heure, minute)
    })
}

/// Le champ d'un tableau, entre guillemets quand il en a besoin.
///
/// Même convention qu'à l'écriture : point-virgule entre les champs, guillemets
/// doublés dedans. Ce que l'agent relit a la forme de ce qu'il écrit.
fn champ(valeur: &str) -> String {
    if valeur.contains(';') || valeur.contains('"') || valeur.contains('\n') {
        format!("\"{}\"", valeur.replace('"', "\"\""))
    } else {
        valeur.to_string()
    }
}

/// Le tableau d'un `.xlsx`, première feuille, en lignes à points-virgules.
pub fn lire_classeur(octets: &[u8]) -> Result<String, String> {
    let noms = pieces(octets)?;
    let feuille = if noms.iter().any(|n| n == "xl/worksheets/sheet1.xml") {
        "xl/worksheets/sheet1.xml".to_string()
    } else {
        noms.iter()
            .filter(|n| n.starts_with("xl/worksheets/") && n.ends_with(".xml"))
            .min()
            .cloned()
            .ok_or_else(|| "ce classeur n'a aucune feuille lisible".to_string())?
    };
    let xml = piece(octets, &feuille)?;
    let chaines = piece(octets, "xl/sharedStrings.xml")
        .map(|x| chaines_partagees(&x))
        .unwrap_or_default();
    let styles = piece(octets, "xl/styles.xml").unwrap_or_default();
    let dates = formats_de_date(&styles);
    let formats = formats_des_styles(&styles);

    let mut lignes: Vec<String> = Vec::new();
    for rang in elements(&xml, "row") {
        let mut colonnes: Vec<(usize, String)> = Vec::new();
        for (attributs, corps) in balises(rang, "c") {
            let index = valeur(attributs, "r")
                .map(|r| colonne(&r))
                .unwrap_or(colonnes.len());
            let brut = desechapper(&elements(corps, "v").concat());
            let contenu = match valeur(attributs, "t").unwrap_or_default().as_str() {
                "s" => brut
                    .parse::<usize>()
                    .ok()
                    .and_then(|i| chaines.get(i).cloned())
                    .unwrap_or_default(),
                "inlineStr" => desechapper(&elements(corps, "t").concat()),
                "b" => if brut == "1" { "VRAI" } else { "FAUX" }.to_string(),
                _ => {
                    // Une date est un nombre de jours, et rien dans la cellule
                    // ne le dit : c'est son style qui renvoie au format.
                    let style: usize = valeur(attributs, "s")
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    let format = formats.get(style).copied().unwrap_or(0);
                    match brut.parse::<f64>() {
                        Ok(n) if dates.contains(&format) => date_du_numero(n).unwrap_or(brut),
                        _ => brut,
                    }
                }
            };
            if !contenu.is_empty() {
                colonnes.push((index, contenu));
            }
        }
        let Some(derniere) = colonnes.last().map(|(i, _)| *i) else {
            continue;
        };
        // Une cellule absente laisse son champ vide plutôt que de décaler les
        // suivantes : dans un tableau, une colonne qui glisse est une donnée
        // rattachée à la mauvaise en-tête.
        let mut ligne = vec![String::new(); derniere + 1];
        for (i, contenu) in colonnes {
            ligne[i] = contenu;
        }
        lignes.push(ligne.iter().map(|v| champ(v)).collect::<Vec<_>>().join(";"));
    }

    if lignes.is_empty() {
        return Err("ce classeur ne contient aucune ligne".to_string());
    }

    let autres: Vec<String> = noms_des_feuilles(octets)
        .into_iter()
        .skip(1)
        .collect();
    if !autres.is_empty() {
        lignes.push(String::new());
        lignes.push(format!(
            "(ce classeur a aussi {} : {}, non lue(s))",
            if autres.len() == 1 { "une autre feuille" } else { "d'autres feuilles" },
            autres.join(", ")
        ));
    }
    Ok(lignes.join("\n"))
}

/// Les noms des feuilles, dans l'ordre du classeur.
fn noms_des_feuilles(octets: &[u8]) -> Vec<String> {
    let Ok(xml) = piece(octets, "xl/workbook.xml") else {
        return Vec::new();
    };
    balises(&xml, "sheet")
        .into_iter()
        .filter_map(|(attributs, _)| valeur(attributs, "name"))
        .collect()
}

// ---------------------------------------------------------------------------
// Le courriel
// ---------------------------------------------------------------------------

/// Le texte d'un `.eml`, en-têtes utiles compris.
///
/// Relu brut, un courriel montrait son corps en quoted-printable : un agent y
/// lisait « impay=C3=A9e » et le recopiait. `mailparse` sert déjà au relevé du
/// courrier, il n'entre rien de nouveau ici.
pub fn lire_courriel(octets: &[u8]) -> Result<String, String> {
    let message = mailparse::parse_mail(octets)
        .map_err(|e| format!("ce courriel ne se relit pas : {}", e))?;
    let mut sortie = String::new();
    for entete in ["From", "To", "Date", "Subject"] {
        if let Some(valeur) = message
            .headers
            .iter()
            .find(|h| h.get_key().eq_ignore_ascii_case(entete))
            .map(|h| h.get_value())
        {
            if !valeur.trim().is_empty() {
                sortie.push_str(&format!("{} : {}\n", entete, valeur.trim()));
            }
        }
    }
    let corps = corps_en_texte(&message)?;
    if !sortie.is_empty() {
        sortie.push('\n');
    }
    sortie.push_str(corps.trim_end());
    Ok(sortie)
}

/// Le premier morceau en texte simple d'un message, pièces jointes exclues.
fn corps_en_texte(message: &mailparse::ParsedMail) -> Result<String, String> {
    if message.subparts.is_empty() {
        return message
            .get_body()
            .map_err(|e| format!("corps illisible : {}", e));
    }
    for partie in &message.subparts {
        if partie.ctype.mimetype == "text/plain" {
            return partie
                .get_body()
                .map_err(|e| format!("corps illisible : {}", e));
        }
    }
    for partie in &message.subparts {
        if let Ok(texte) = corps_en_texte(partie) {
            return Ok(texte);
        }
    }
    Err("ce courriel n'a aucune partie en texte simple".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// Un dossier de travail à soi, vidé d'abord.
    fn dossier(nom: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("iagent-lecture-{}", nom));
        let _ = std::fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn un_document_ecrit_ici_se_relit_tel_quel() {
        // L'aller-retour est le banc qui compte : ce qu'un agent écrit est la
        // matière du suivant dans la chaîne des postes.
        let texte = "# Rapport du mois\n\nVoici le **relevé** arrêté au 23 septembre, « à vérifier » pour les montants sans justificatif.\n\n## Les postes\n\n- Loyer : 4 250,00 € — conforme\n- Énergie : *en hausse* de 12 %\n\n### Remarque\n\nRien d'autre à signaler.";
        let d = dossier("docx");
        crate::document::poser_document(&d, "rapport.docx", texte).unwrap();
        let relu = lire_document_word(&std::fs::read(d.join("rapport.docx")).unwrap()).unwrap();
        assert_eq!(relu, texte, "l'aller-retour ne rend pas le même texte");
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn les_etoiles_du_gras_se_posent_hors_des_espaces() {
        // « mot **gras ** » ne se relit pas comme du gras : la règle du
        // Markdown veut la marque collée au mot, et `segments` l'applique à
        // l'écriture. La relecture doit s'y tenir, sinon un aller-retour
        // laisse les étoiles en clair dans un document qui sort de la maison.
        let d = dossier("espaces");
        crate::document::poser_document(&d, "a.docx", "un mot **gras** et la suite").unwrap();
        let relu = lire_document_word(&std::fs::read(d.join("a.docx")).unwrap()).unwrap();
        assert_eq!(relu, "un mot **gras** et la suite");
        // Ce qui compte n'est pas la forme de la chaîne mais ce que le lecteur
        // de marques en refait : un gras qui enfermerait son espace se relirait
        // comme du texte avec des étoiles dedans.
        let lus = crate::document::segments(&relu);
        assert!(
            lus.iter().any(|(t, gras, _)| *gras && t == "gras"),
            "le gras relu n'est pas le mot seul : {:?}",
            lus
        );
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn un_classeur_ecrit_ici_se_relit_tel_quel() {
        let tableau = "Poste;Montant;Écart\nLoyer et charges;4 250,00;conforme\n\"Salaires; cotisations\";18 940,50;+3 %\nÉnergie;1 204,88;+12 %";
        let lignes = crate::tache::lignes_du_tableau(tableau);
        let d = dossier("xlsx");
        crate::tache::poser_tableur(&d, "depenses.xlsx", &lignes).unwrap();
        let relu = lire_classeur(&std::fs::read(d.join("depenses.xlsx")).unwrap()).unwrap();
        let relues = crate::tache::lignes_du_tableau(&relu);
        assert_eq!(relues.len(), lignes.len(), "{}", relu);
        for (avant, apres) in lignes.iter().zip(&relues) {
            assert_eq!(avant.len(), apres.len(), "une colonne a glissé : {:?}", apres);
            for (a, b) in avant.iter().zip(apres) {
                // Un montant part en nombre dans la cellule : c'est sa valeur
                // qui doit revenir, pas son écriture. « 4 250,00 » revient
                // « 4250 » parce que la cellule n'a pas de format.
                match crate::tache::nombre_du_champ(a) {
                    Some(n) => assert_eq!(
                        crate::tache::nombre_du_champ(b),
                        Some(n),
                        "« {} » est revenu « {} »",
                        a,
                        b
                    ),
                    None => assert_eq!(a, b),
                }
            }
        }
        // Le point-virgule dans un champ doit revenir entre guillemets, sinon
        // le tableau relu aurait une colonne de plus.
        assert!(relu.contains("\"Salaires; cotisations\""), "{}", relu);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn un_courriel_ecrit_ici_se_relit_sans_son_encodage() {
        // Relu brut, le corps se lisait « impay=C3=A9e » et l'agent recopiait.
        let d = dossier("eml");
        crate::tache::poser_courriel(
            &d,
            "relance.eml",
            1_790_173_800,
            "Objet : Relance de la facture 412\n\nMadame,\n\nSauf erreur de notre part, la facture 412 reste impayée.",
        )
        .unwrap();
        let relu = lire_courriel(&std::fs::read(d.join("relance.eml")).unwrap()).unwrap();
        assert!(relu.contains("Subject : Relance de la facture 412"), "{}", relu);
        assert!(relu.contains("la facture 412 reste impayée."), "{}", relu);
        assert!(!relu.contains("=C3="), "le quoted-printable n'a pas été rendu : {}", relu);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn un_montant_garde_ses_centimes_a_l_affichage() {
        // Une cellule sans format s'affiche brute : « 4 250,00 » devenait
        // « 4250 », et le client lisait une facture sans ses centimes. La
        // valeur était juste, la lecture non.
        use crate::tache::format_du_champ;
        assert_eq!(format_du_champ("4 250,00").as_deref(), Some("#,##0.00"));
        assert_eq!(format_du_champ("1204.88").as_deref(), Some("#,##0.00"));
        assert_eq!(format_du_champ("0,5").as_deref(), Some("#,##0.0"));
        assert_eq!(format_du_champ("18 940").as_deref(), Some("#,##0"));
        // Sans décimale ni séparation, on n'invente rien : un identifiant ou
        // une année ne prennent pas de séparateur de milliers.
        assert_eq!(format_du_champ("2026"), None);
        assert_eq!(format_du_champ("12345678"), None);
        // Et ce qui n'est pas un nombre n'a pas de format.
        assert_eq!(format_du_champ("+3 %"), None);
        assert_eq!(format_du_champ("Loyer"), None);

        // Le format est écrit dans le classeur, et la valeur reste la valeur.
        let d = dossier("centimes");
        crate::tache::poser_tableur(
            &d,
            "facture.xlsx",
            &crate::tache::lignes_du_tableau("Poste;Montant\nLoyer;4 250,00"),
        )
        .unwrap();
        let octets = std::fs::read(d.join("facture.xlsx")).unwrap();
        let styles = piece(&octets, "xl/styles.xml").unwrap();
        assert!(
            styles.contains("#,##0.00"),
            "le format des centimes n'est pas dans le classeur"
        );
        assert_eq!(lire_classeur(&octets).unwrap(), "Poste;Montant\nLoyer;4250");
        let _ = std::fs::remove_dir_all(&d);
    }

    /// Un classeur monté à la main, pour les cas qu'on n'écrit pas soi-même.
    fn classeur(pieces: &[(&str, &str)]) -> Vec<u8> {
        let mut archive = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        let reglages: zip::write::SimpleFileOptions = Default::default();
        for (nom, contenu) in pieces {
            use std::io::Write;
            archive.start_file(*nom, reglages).unwrap();
            archive.write_all(contenu.as_bytes()).unwrap();
        }
        archive.finish().unwrap().into_inner()
    }

    /// Un aller-retour ne prouve que la cohérence avec soi-même : il passerait
    /// même si l'écrivain et le lecteur se trompaient de la même façon. Ce
    /// témoin vient d'un autre outil (voir `temoins/README.md`).
    #[test]
    fn un_classeur_ecrit_par_un_autre_outil_se_relit_entier() {
        let chemin = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("temoins/classeur-d-un-autre-outil.xlsx");
        let relu = lire_classeur(&std::fs::read(chemin).unwrap()).unwrap();
        let lignes: Vec<&str> = relu.lines().collect();
        assert_eq!(lignes[0], "Poste;Montant;Échéance;Payé;Note");
        // L'esperluette arrive échappée en `&amp;` dans le XML.
        assert_eq!(
            lignes[1],
            "Loyer & charges;4250;30/09/2026;VRAI;\"Avec \"\"guillemets\"\"\""
        );
        // Une date-heure garde son heure ; un point-virgule dans un champ le
        // fait passer entre guillemets, sinon le tableau gagne une colonne.
        assert_eq!(
            lignes[2],
            "Énergie;1204.88;15/10/2026 09:30;FAUX;\"point-virgule ; dedans\""
        );
        // La cellule A4 est absente du fichier : son champ reste vide.
        assert_eq!(lignes[3], ";7;;;fin");
        assert!(relu.contains("Budget"), "la feuille non lue doit être nommée");
    }

    #[test]
    fn une_cellule_absente_ne_decale_pas_les_suivantes() {
        // Un tableur n'écrit pas les cellules vides. Les ignorer ferait glisser
        // la colonne d'après sous la mauvaise en-tête, et personne ne le verrait.
        let octets = classeur(&[(
            "xl/worksheets/sheet1.xml",
            r#"<worksheet><sheetData>
               <row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c><c r="C1" t="inlineStr"><is><t>c</t></is></c></row>
               <row r="2"><c r="B2"><v>7</v></c></row>
               </sheetData></worksheet>"#,
        )]);
        assert_eq!(lire_classeur(&octets).unwrap(), "a;;c\n;7");
    }

    #[test]
    fn une_date_se_lit_comme_une_date_et_pas_comme_un_nombre() {
        // Une date est un nombre de jours dans la cellule ; seule la feuille de
        // styles dit que c'en est une. Sans ça, l'agent lit « 45000 ».
        let styles = r#"<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
            <cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>"#;
        let octets = classeur(&[
            ("xl/styles.xml", styles),
            (
                "xl/worksheets/sheet1.xml",
                r#"<worksheet><sheetData><row r="1">
                   <c r="A1" s="0"><v>45000</v></c>
                   <c r="B1" s="1"><v>45000</v></c>
                   <c r="C1" s="2"><v>45000</v></c>
                   </row></sheetData></worksheet>"#,
            ),
        ]);
        assert_eq!(lire_classeur(&octets).unwrap(), "45000;15/03/2023;15/03/2023");
        // Le 29 février 1900 n'a jamais existé mais le format le compte : au
        // premier mars, il faut retrancher ce jour de trop.
        assert_eq!(date_du_numero(1.0).as_deref(), Some("01/01/1900"));
        assert_eq!(date_du_numero(61.0).as_deref(), Some("01/03/1900"));
        assert_eq!(date_du_numero(0.0), None, "le numéro zéro n'est pas une date");
        // Des deux côtés de l'époque Unix : un classeur porte des dates de
        // naissance, et `tache::civil` ne compte qu'en avant.
        assert_eq!(date_civile(0), (1970, 1, 1));
        assert_eq!(date_civile(-1), (1969, 12, 31));
        assert_eq!(date_civile(-7305), (1950, 1, 1));
        assert_eq!(date_civile(19_431), (2023, 3, 15));
        assert_eq!(date_du_numero(18_264.0).as_deref(), Some("01/01/1950"));
        // La part décimale est l'heure du jour.
        assert_eq!(date_du_numero(45_000.5).as_deref(), Some("15/03/2023 12:00"));
    }

    #[test]
    fn les_textes_ranges_a_part_reviennent_a_leur_place() {
        let octets = classeur(&[
            (
                "xl/sharedStrings.xml",
                r#"<sst><si><t>Loyer</t></si><si><r><t>Salaires </t></r><r><t>et charges</t></r></si></sst>"#,
            ),
            (
                "xl/worksheets/sheet1.xml",
                r#"<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>"#,
            ),
        ]);
        assert_eq!(lire_classeur(&octets).unwrap(), "Loyer;Salaires et charges");
    }

    #[test]
    fn seule_la_premiere_feuille_est_lue_et_l_agent_l_apprend() {
        let octets = classeur(&[
            (
                "xl/workbook.xml",
                r#"<workbook><sheets><sheet name="Dépenses" sheetId="1"/><sheet name="Budget" sheetId="2"/></sheets></workbook>"#,
            ),
            (
                "xl/worksheets/sheet1.xml",
                r#"<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>a</t></is></c></row></sheetData></worksheet>"#,
            ),
            (
                "xl/worksheets/sheet2.xml",
                r#"<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>b</t></is></c></row></sheetData></worksheet>"#,
            ),
        ]);
        let relu = lire_classeur(&octets).unwrap();
        assert!(relu.starts_with("a\n"), "{}", relu);
        assert!(relu.contains("Budget"), "l'agent doit savoir ce qu'il n'a pas vu : {}", relu);
        assert!(!relu.contains("\nb"), "la deuxième feuille n'est pas lue : {}", relu);
    }

    #[test]
    fn ce_qui_n_est_pas_lisible_dit_pourquoi() {
        // Un fichier abîmé se nomme avec sa raison plutôt que de passer pour
        // un dossier vide : l'agent dirait alors n'avoir rien reçu.
        assert!(lire_classeur(b"bonjour").unwrap_err().contains("archive"));
        assert!(lire_document_word(b"bonjour").unwrap_err().contains("archive"));
        let vide = classeur(&[("xl/worksheets/sheet1.xml", "<worksheet><sheetData/></worksheet>")]);
        assert!(lire_classeur(&vide).unwrap_err().contains("aucune ligne"));
    }

    #[test]
    fn les_entites_xml_reviennent_en_caracteres() {
        assert_eq!(desechapper("Dupont &amp; Fils &lt;contact&gt;"), "Dupont & Fils <contact>");
        assert_eq!(desechapper("l&apos;an&#233;e &#x20AC;"), "l'anée €");
        // Une esperluette seule n'est pas une entité : la perdre changerait le
        // texte sans le dire.
        assert_eq!(desechapper("R & D"), "R & D");
        assert_eq!(desechapper("&pasuneentite;"), "&pasuneentite;");
    }

    #[test]
    fn une_balise_ne_ramasse_pas_celle_dont_elle_est_le_debut() {
        // `<w:p>` et `<w:pPr>` commencent pareil : confondre les deux mettrait
        // le nom du style dans le texte du paragraphe.
        let xml = "<w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>Titre</w:t></w:r></w:p>";
        assert_eq!(elements(xml, "w:p").len(), 1);
        assert_eq!(attribut(xml, "w:pStyle", "w:val").as_deref(), Some("Heading1"));
        assert_eq!(elements(xml, "w:t"), vec!["Titre"]);
        // Une balise refermée sur elle-même compte, et n'a pas de contenu.
        assert_eq!(balises("<c r=\"A1\"/>", "c"), vec![("r=\"A1\"", "")]);
        // Un nom d'attribut doit en commencer un, pas finir celui d'à côté.
        assert_eq!(valeur("spr=\"x\" r=\"A1\"", "r").as_deref(), Some("A1"));
        assert_eq!(valeur("spr=\"x\"", "r"), None);
    }

    #[test]
    fn la_colonne_se_lit_dans_la_reference_de_la_cellule() {
        assert_eq!(colonne("A1"), 0);
        assert_eq!(colonne("B12"), 1);
        assert_eq!(colonne("Z3"), 25);
        assert_eq!(colonne("AA1"), 26);
        assert_eq!(colonne("AB3"), 27);
    }
}

