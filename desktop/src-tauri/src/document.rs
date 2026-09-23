//! Écrire un vrai `.docx` dans le dossier du client.
//!
//! 310 sorties des fiches demandent un document. `tache.rs` refusait de les
//! écrire faute d'écrivain : la tâche se préparait, et rien ne sortait.
//!
//! Un `.docx` est une archive ZIP de trois pièces XML — le ZIP est déjà
//! compilé dans le binaire, `rust_xlsxwriter` s'en sert pour le classeur, donc
//! rien de nouveau n'entre ici. Ce qui manquait n'était pas une bibliothèque,
//! c'était la conversion.
//!
//! **Le modèle ne rend pas de l'OOXML**, même règle que le classeur et le
//! courriel : il écrirait des balises plausibles et mal fermées. Il rend du
//! texte avec les conventions qu'il écrit déjà tous les jours — `#` pour un
//! titre, une ligne vide entre deux paragraphes, `-` pour une puce, `**` pour
//! le gras — et c'est l'application qui en fait un document.
//!
//! Ce qui n'est pas converti : tableaux, images, liens, notes de bas de page.
//! Un document d'entreprise est fait de titres, de paragraphes et de listes ;
//! le reste viendra si une fiche le réclame, pas avant.

use std::path::{Path, PathBuf};

/// Les caractères qu'un XML n'accepte pas, et l'échappement des trois autres.
///
/// Un modèle rend parfois un caractère de contrôle au milieu d'un texte. Laissé
/// tel quel, Word annonce « le fichier est corrompu » et n'ouvre rien : mieux
/// vaut perdre un caractère invisible que le document entier.
fn echapper_xml(texte: &str) -> String {
    let mut sortie = String::with_capacity(texte.len());
    for c in texte.chars() {
        match c {
            '&' => sortie.push_str("&amp;"),
            '<' => sortie.push_str("&lt;"),
            '>' => sortie.push_str("&gt;"),
            '\t' | '\n' | '\r' => sortie.push(' '),
            c if (c as u32) < 0x20 => {}
            c => sortie.push(c),
        }
    }
    sortie
}

/// Découpe une ligne en segments de texte, gras et italique.
///
/// `**gras**` puis `*italique*`, l'ordre compte : lire l'italique d'abord
/// couperait chaque gras en deux italiques vides. Une étoile qui ne ferme rien
/// reste du texte — un modèle qui écrit « 3 * 4 » ne doit pas mettre la moitié
/// du paragraphe en italique.
fn segments(ligne: &str) -> Vec<(String, bool, bool)> {
    let mut sortie: Vec<(String, bool, bool)> = Vec::new();
    let mut reste = ligne;
    let mut courant = String::new();
    while !reste.is_empty() {
        let pris = if let Some(t) = entre(reste, "**") {
            if !courant.is_empty() {
                sortie.push((std::mem::take(&mut courant), false, false));
            }
            sortie.push((t.0.to_string(), true, false));
            Some(t.1)
        } else if let Some(t) = entre(reste, "*") {
            if !courant.is_empty() {
                sortie.push((std::mem::take(&mut courant), false, false));
            }
            sortie.push((t.0.to_string(), false, true));
            Some(t.1)
        } else {
            None
        };
        match pris {
            Some(suite) => reste = suite,
            None => {
                let c = reste.chars().next().unwrap();
                courant.push(c);
                reste = &reste[c.len_utf8()..];
            }
        }
    }
    if !courant.is_empty() {
        sortie.push((courant, false, false));
    }
    sortie
}

/// Le texte entre deux marqueurs au début de `reste`, et ce qui suit.
///
/// Rend `None` quand la ligne ne commence pas par le marqueur, quand rien ne le
/// ferme, ou quand il ne contient rien : `****` est du texte, pas du gras vide.
///
/// Et rien non plus quand le marqueur est collé à un espace, règle habituelle
/// du Markdown : sans elle, « prix * quantité * taux » met « quantité » en
/// italique. Le banc l'a signalé avant qu'un document ne sorte comme ça.
fn entre<'a>(reste: &'a str, marqueur: &str) -> Option<(&'a str, &'a str)> {
    let apres = reste.strip_prefix(marqueur)?;
    let fin = apres.find(marqueur)?;
    if fin == 0 {
        return None;
    }
    let contenu = &apres[..fin];
    if contenu.starts_with(char::is_whitespace) || contenu.ends_with(char::is_whitespace) {
        return None;
    }
    Some((contenu, &apres[fin + marqueur.len()..]))
}

/// Un paragraphe OOXML, avec son style et ses segments.
///
/// Une puce ne s'obtient pas avec le seul style « ListParagraph », qui n'est
/// qu'un retrait : il lui faut aussi son `numPr`, qui la rattache à la liste
/// définie dans `numbering.xml`. Sans lui, Word affiche un paragraphe décalé
/// sans puce.
fn paragraphe(style: Option<&str>, ligne: &str) -> String {
    let proprietes = match style {
        Some("ListParagraph") => "<w:pPr><w:pStyle w:val=\"ListParagraph\"/><w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr></w:pPr>".to_string(),
        Some(s) => format!("<w:pPr><w:pStyle w:val=\"{}\"/></w:pPr>", s),
        None => String::new(),
    };
    let runs: String = segments(ligne)
        .into_iter()
        .map(|(texte, gras, italique)| {
            let mut mise = String::new();
            if gras {
                mise.push_str("<w:b/>");
            }
            if italique {
                mise.push_str("<w:i/>");
            }
            let rpr = if mise.is_empty() {
                String::new()
            } else {
                format!("<w:rPr>{}</w:rPr>", mise)
            };
            // `xml:space="preserve"` : sans lui, Word mange les espaces de
            // bord et recolle « mot **gras** suite » en « motgrassuite ».
            format!(
                "<w:r>{}<w:t xml:space=\"preserve\">{}</w:t></w:r>",
                rpr,
                echapper_xml(&texte)
            )
        })
        .collect();
    format!("<w:p>{}{}</w:p>", proprietes, runs)
}

/// Le corps du document, converti depuis ce que le modèle a rendu.
pub fn corps_docx(texte: &str) -> String {
    let texte = texte.trim_start_matches('\u{feff}');
    let mut corps = String::new();
    for ligne in texte.lines() {
        let ligne = ligne.trim_end();
        let nu = ligne.trim_start();
        if nu.is_empty() {
            // Une ligne vide sépare deux paragraphes, elle n'en fait pas un
            // troisième : un document ne se remplit pas de blancs.
            continue;
        }
        let (style, contenu) = if let Some(t) = nu.strip_prefix("### ") {
            (Some("Heading3"), t)
        } else if let Some(t) = nu.strip_prefix("## ") {
            (Some("Heading2"), t)
        } else if let Some(t) = nu.strip_prefix("# ") {
            (Some("Heading1"), t)
        } else if let Some(t) = nu.strip_prefix("- ").or_else(|| nu.strip_prefix("* ")) {
            (Some("ListParagraph"), t)
        } else {
            (None, nu)
        };
        corps.push_str(&paragraphe(style, contenu));
    }
    corps
}

const TYPES: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>"#;

const RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>"#;

/// Ce que `word/document.xml` utilise : les styles et la numérotation.
const RELS_DOCUMENT: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>"#;

/// Les styles, sans lesquels un titre n'est qu'un paragraphe de plus.
///
/// Première version sans eux : `python-docx` relisait chaque paragraphe en
/// « Normal ». Un style nommé dans `document.xml` mais défini nulle part est
/// ignoré, et le document sortait sans un seul titre — juste du texte. Les
/// noms `heading 1` à `heading 3` sont ceux que Word reconnaît, ce qui met les
/// titres dans son volet de navigation et dans une table des matières.
/// Tailles en demi-points, comme l'exige OOXML : 32 = 16 points.
const STYLES: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="320" w:after="160"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="280" w:after="140"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style></w:styles>"#;

/// La liste à puces. Police Symbol et caractère F0B7 : c'est ce que Word écrit
/// lui-même, donc ce qui a le plus de chances d'être rendu tel quel ailleurs.
const NUMEROTATION: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#xF0B7;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>"#;

/// La mise en page : A4 et des marges de deux centimètres et demi.
///
/// En vingtièmes de point : 11906 × 16838 est l'A4. Sans cette section, le
/// document sort au format Letter, qui ne s'imprime pas droit en France.
const MISE_EN_PAGE: &str = r#"<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>"#;

/// Écrit le document dans le dossier du client.
///
/// Mêmes règles que `poser` : rien n'est écrasé, et le fichier est mis en place
/// entier par renommage. Un `.docx` à moitié écrit ne s'ouvre pas du tout.
pub fn poser_document(dossier: &Path, nom: &str, texte: &str) -> Result<PathBuf, String> {
    let corps = corps_docx(texte);
    if corps.is_empty() {
        return Err("le document rendu est vide : aucun fichier n'a été écrit".to_string());
    }
    std::fs::create_dir_all(dossier)
        .map_err(|e| format!("création de {} : {}", dossier.display(), e))?;
    let chemin = dossier.join(nom);
    if chemin.exists() {
        return Err(format!("{} existe déjà", chemin.display()));
    }

    let document = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{}{}</w:body></w:document>"#,
        corps, MISE_EN_PAGE
    );

    let mut archive = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    let reglages: zip::write::SimpleFileOptions = Default::default();
    for (piece, contenu) in [
        ("[Content_Types].xml", TYPES),
        ("_rels/.rels", RELS),
        ("word/_rels/document.xml.rels", RELS_DOCUMENT),
        ("word/styles.xml", STYLES),
        ("word/numbering.xml", NUMEROTATION),
        ("word/document.xml", document.as_str()),
    ] {
        use std::io::Write;
        archive
            .start_file(piece, reglages)
            .map_err(|e| format!("écriture de {} : {}", piece, e))?;
        archive
            .write_all(contenu.as_bytes())
            .map_err(|e| format!("écriture de {} : {}", piece, e))?;
    }
    let octets = archive
        .finish()
        .map_err(|e| format!("fermeture du document : {}", e))?
        .into_inner();

    let provisoire = dossier.join(format!("{}.nouveau", nom));
    std::fs::write(&provisoire, &octets)
        .map_err(|e| format!("écriture de {} : {}", provisoire.display(), e))?;
    std::fs::rename(&provisoire, &chemin)
        .map_err(|e| format!("mise en place de {} : {}", chemin.display(), e))?;
    Ok(chemin)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn les_titres_les_puces_et_les_paragraphes_deviennent_des_styles() {
        let corps = corps_docx("# Rapport du mois\n\nLes ventes progressent.\n\n- Nord : en hausse\n- Sud : stable\n\n## Ce qui reste à trancher\n\nLe budget du quatrième trimestre.");
        assert_eq!(corps.matches("Heading1").count(), 1);
        assert_eq!(corps.matches("Heading2").count(), 1);
        assert_eq!(corps.matches("ListParagraph").count(), 2);
        // Quatre paragraphes de style, plus deux de corps : les lignes vides
        // séparent, elles ne font pas de paragraphes de plus.
        assert_eq!(corps.matches("<w:p>").count(), 6);
        assert!(corps.contains("Rapport du mois"), "{}", corps);
        assert!(!corps.contains("# Rapport"), "le dièse reste dans le texte : {}", corps);
    }

    #[test]
    fn le_gras_et_l_italique_deviennent_de_la_mise_en_forme() {
        let corps = corps_docx("Le délai est **impératif** et la remise *indicative*.");
        assert!(corps.contains("<w:b/>"), "{}", corps);
        assert!(corps.contains("<w:i/>"), "{}", corps);
        assert!(!corps.contains('*'), "les étoiles restent dans le texte : {}", corps);
        // Les espaces de bord survivent : sans xml:space, Word recolle les mots.
        assert!(corps.contains("xml:space=\"preserve\""), "{}", corps);
        assert!(corps.contains(">Le délai est <"), "{}", corps);
    }

    #[test]
    fn une_etoile_qui_ne_ferme_rien_reste_du_texte() {
        // Un modèle qui écrit « 3 * 4 » ne doit pas mettre la moitié du
        // paragraphe en italique, et « **** » n'est pas du gras vide.
        for texte in ["3 * 4 = 12", "un calcul **** douteux", "prix * quantité * taux"] {
            let corps = corps_docx(texte);
            assert!(!corps.contains("<w:i/>") && !corps.contains("<w:b/>"), "{} → {}", texte, corps);
        }
    }

    #[test]
    fn ce_qui_casserait_le_xml_est_echappe_ou_retire() {
        // Sans ça, Word annonce « le fichier est corrompu » et n'ouvre rien.
        let corps = corps_docx("Marge & remise < 10 % > seuil\u{7}");
        assert!(corps.contains("&amp;") && corps.contains("&lt;") && corps.contains("&gt;"), "{}", corps);
        assert!(!corps.contains('\u{7}'), "{}", corps);
        assert!(!corps.contains(" & "), "{}", corps);
    }

    #[test]
    fn un_document_est_une_archive_avec_ses_trois_pieces() {
        let dossier = std::env::temp_dir().join(format!("iagent-docx-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);

        let chemin = poser_document(&dossier, "note.docx", "# Note\n\nLe **fond** du dossier.")
            .expect("document écrit");
        let octets = std::fs::read(&chemin).unwrap();
        assert_eq!(&octets[..2], b"PK", "un .docx est une archive ZIP");

        let mut archive = zip::ZipArchive::new(std::io::Cursor::new(octets)).expect("archive lisible");
        let pieces: Vec<String> = archive.file_names().map(str::to_string).collect();
        for attendue in ["[Content_Types].xml", "_rels/.rels", "word/document.xml"] {
            assert!(pieces.iter().any(|p| p == attendue), "{} manque : {:?}", attendue, pieces);
        }
        let mut document = String::new();
        {
            use std::io::Read;
            archive.by_name("word/document.xml").unwrap().read_to_string(&mut document).unwrap();
        }
        assert!(document.starts_with("<?xml"), "{}", document);
        assert!(document.contains("Heading1") && document.contains(">Note<"), "{}", document);
        // « fond » est en gras, donc dans son propre passage : le texte du
        // paragraphe est réparti sur trois passages, pas recollé en un seul.
        assert!(document.contains(">Le <") && document.contains(">fond<") && document.contains("> du dossier.<"), "{}", document);

        let _ = std::fs::remove_dir_all(&dossier);
    }

    /// Le défaut que la première version avait, et qu'aucun banc ne voyait :
    /// `document.xml` nommait `Heading1`, `styles.xml` n'existait pas, et Word
    /// rendait chaque titre comme un paragraphe ordinaire. Le fichier
    /// s'ouvrait, le document était faux. Une bibliothèque OOXML indépendante
    /// relisait bien « Normal » partout.
    #[test]
    fn tout_style_nomme_est_defini_quelque_part() {
        let corps = corps_docx("# Un\n\n## Deux\n\n### Trois\n\n- Quatre\n\nCinq.");
        let mut reste = corps.as_str();
        let mut vus = 0;
        while let Some(i) = reste.find("w:pStyle w:val=\"") {
            reste = &reste[i + 16..];
            let fin = reste.find('"').expect("attribut fermé");
            let nom = &reste[..fin];
            assert!(
                STYLES.contains(&format!("w:styleId=\"{}\"", nom)),
                "le style {} est employé et n'est défini nulle part",
                nom
            );
            vus += 1;
        }
        assert_eq!(vus, 4, "quatre paragraphes stylés attendus");
        // Même règle pour la liste : la puce renvoie à une numérotation.
        assert!(corps.contains("w:numId w:val=\"1\""), "{}", corps);
        assert!(NUMEROTATION.contains("w:num w:numId=\"1\""), "la liste 1 n'est pas définie");
        // Et les pièces se réclament les unes les autres.
        for piece in ["styles.xml", "numbering.xml"] {
            assert!(RELS_DOCUMENT.contains(piece), "{} n'est pas relié au document", piece);
            assert!(TYPES.contains(piece), "{} n'a pas de type déclaré", piece);
        }
    }

    #[test]
    fn rien_n_est_ecrase_et_un_document_vide_n_est_pas_ecrit() {
        let dossier = std::env::temp_dir().join(format!("iagent-docx2-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dossier);

        poser_document(&dossier, "note.docx", "Le compte rendu.").expect("document écrit");
        assert!(poser_document(&dossier, "note.docx", "Autre chose.").is_err());
        // Un document vide serait pire qu'une erreur : le client croirait le
        // travail fait.
        assert!(poser_document(&dossier, "vide.docx", "   \n\n  ").is_err());
        let restes: Vec<_> = std::fs::read_dir(&dossier).unwrap().flatten()
            .map(|e| e.file_name().to_string_lossy().to_string()).collect();
        assert_eq!(restes, vec!["note.docx".to_string()]);

        let _ = std::fs::remove_dir_all(&dossier);
    }
}
