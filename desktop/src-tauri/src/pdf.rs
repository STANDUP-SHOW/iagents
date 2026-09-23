//! Écrire un vrai `.pdf` dans le dossier du client.
//!
//! 523 sorties des fiches demandent un PDF : le dernier gros format que
//! l'application refusait d'écrire. C'est aussi celui qui sort de la maison —
//! un devis, une facture, une mise en demeure, une note remise au comité — donc
//! celui qu'on ne peut pas rendre « à peu près ».
//!
//! **Le modèle ne rend pas de PDF**, même règle que le classeur, le courriel et
//! le document Word : il rend le même texte que le `.docx`, avec les mêmes
//! marques, et `document.rs` le lit une seule fois pour les deux écrivains.
//!
//! **Aucune bibliothèque n'entre pour ça.** Un PDF de texte est une suite
//! d'objets numérotés et une table de leurs positions ; les polices employées
//! sont les quatre Helvetica que tout lecteur porte déjà, donc rien n'est
//! embarqué et un rapport de deux pages pèse quelques kilo-octets. Ajouter un
//! moteur de rendu ferait grossir l'installeur pour des titres et des puces.
//!
//! Ce qui n'est pas converti : tableaux, images, liens. Comme pour le `.docx`,
//! ils viendront si une fiche les réclame.

use crate::document::{lignes_du_document, segments, Style};
use std::path::{Path, PathBuf};

/// A4 en points typographiques : 210 × 297 mm, soit 72 points par pouce.
const LARGEUR_PAGE: f64 = 595.28;
const HAUTEUR_PAGE: f64 = 841.89;
/// 20 mm de marge, la marge d'un courrier d'entreprise.
const MARGE: f64 = 56.69;
/// L'espacement des lignes d'un même paragraphe, en parts de la taille.
const INTERLIGNE: f64 = 1.35;

// ---------------------------------------------------------------------------
// Les tables ci-dessous sont engendrées depuis la table WinAnsiEncoding de la
// spécification PDF et les métriques AFM publiées par Adobe pour Helvetica.
// Elles ne se retouchent pas à la main : une largeur fausse ne casse pas le
// fichier, elle coupe les lignes au mauvais endroit, et personne ne le voit
// avant d'ouvrir le document.
// ---------------------------------------------------------------------------

// -- Engendre, ne pas retoucher a la main. Voir le commentaire ci-dessus. --
static WINANSI: [(u32, u8); 123] = [
    (160, 160), (161, 161), (162, 162), (163, 163), (164, 164), (165, 165),
    (166, 166), (167, 167), (168, 168), (169, 169), (170, 170), (171, 171),
    (172, 172), (173, 173), (174, 174), (175, 175), (176, 176), (177, 177),
    (178, 178), (179, 179), (180, 180), (181, 181), (182, 182), (183, 183),
    (184, 184), (185, 185), (186, 186), (187, 187), (188, 188), (189, 189),
    (190, 190), (191, 191), (192, 192), (193, 193), (194, 194), (195, 195),
    (196, 196), (197, 197), (198, 198), (199, 199), (200, 200), (201, 201),
    (202, 202), (203, 203), (204, 204), (205, 205), (206, 206), (207, 207),
    (208, 208), (209, 209), (210, 210), (211, 211), (212, 212), (213, 213),
    (214, 214), (215, 215), (216, 216), (217, 217), (218, 218), (219, 219),
    (220, 220), (221, 221), (222, 222), (223, 223), (224, 224), (225, 225),
    (226, 226), (227, 227), (228, 228), (229, 229), (230, 230), (231, 231),
    (232, 232), (233, 233), (234, 234), (235, 235), (236, 236), (237, 237),
    (238, 238), (239, 239), (240, 240), (241, 241), (242, 242), (243, 243),
    (244, 244), (245, 245), (246, 246), (247, 247), (248, 248), (249, 249),
    (250, 250), (251, 251), (252, 252), (253, 253), (254, 254), (255, 255),
    (338, 140), (339, 156), (352, 138), (353, 154), (376, 159), (381, 142),
    (382, 158), (402, 131), (710, 136), (732, 152), (8211, 150), (8212, 151),
    (8216, 145), (8217, 146), (8218, 130), (8220, 147), (8221, 148), (8222, 132),
    (8224, 134), (8225, 135), (8226, 149), (8230, 133), (8240, 137), (8249, 139),
    (8250, 155), (8364, 128), (8482, 153),
];

static LARGEURS: [u16; 256] = [
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 556,
    556, 556, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 556, 611, 556,
    556, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 556, 500, 500,
    278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
    400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
    667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
    722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
    556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];

static LARGEURS_GRAS: [u16; 256] = [
    611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611,
    611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611, 611,
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 611,
    556, 611, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 611, 611, 611,
    611, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 611, 500, 556,
    278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
    400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
    722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
    722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
    556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
    611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];

/// Ce qu'on écrit à la place d'un caractère qu'Helvetica ne porte pas.
///
/// La flèche et les signes de comparaison arrivent d'un modèle qui a pris
/// l'habitude du texte d'écran ; l'espace fine insécable arrive de la
/// typographie française. Les rendre en clair vaut mieux qu'un point
/// d'interrogation au milieu d'une phrase.
const REMPLACEMENTS: [(char, &str); 7] = [
    ('\u{202f}', "\u{a0}"),
    ('\u{2192}', "->"),
    ('\u{2190}', "<-"),
    ('\u{2264}', "<="),
    ('\u{2265}', ">="),
    ('\u{2260}', "!="),
    ('\u{2212}', "-"),
];

/// Le code WinAnsi d'un caractère, ou rien s'il n'y est pas.
fn code_winansi(c: char) -> Option<u8> {
    let n = c as u32;
    if (0x20..=0x7e).contains(&n) {
        return Some(n as u8);
    }
    WINANSI
        .binary_search_by_key(&n, |(u, _)| *u)
        .ok()
        .map(|i| WINANSI[i].1)
}

/// Le texte tel qu'il partira dans le fichier : des codes WinAnsi.
///
/// Un caractère absent de l'encodage n'est jamais laissé tomber en silence :
/// il devient sa traduction quand il en a une, un point d'interrogation
/// sinon. Un trou muet dans une facture, c'est un chiffre qui disparaît.
fn codes(texte: &str) -> Vec<u8> {
    let mut sortie = Vec::new();
    for c in texte.chars() {
        if let Some(b) = code_winansi(c) {
            sortie.push(b);
        } else if let Some((_, remplacement)) = REMPLACEMENTS.iter().find(|(d, _)| *d == c) {
            sortie.extend(remplacement.chars().filter_map(code_winansi));
        } else {
            sortie.push(b'?');
        }
    }
    sortie
}

/// La largeur d'un texte à cette taille, en points.
fn largeur(texte: &str, taille: f64, gras: bool) -> f64 {
    let table = if gras { &LARGEURS_GRAS } else { &LARGEURS };
    codes(texte)
        .iter()
        .map(|c| table[*c as usize] as f64)
        .sum::<f64>()
        * taille
        / 1000.0
}

/// Une chaîne littérale PDF, entre parenthèses.
///
/// Tout ce qui sort de l'ASCII imprimable part en octal : le fichier reste
/// lisible en ASCII d'un bout à l'autre, et aucun outil ne peut se tromper sur
/// son encodage en chemin.
fn litteral(texte: &str) -> String {
    let mut sortie = String::from("(");
    for c in codes(texte) {
        match c {
            b'(' | b')' | b'\\' => {
                sortie.push('\\');
                sortie.push(c as char);
            }
            0x20..=0x7e => sortie.push(c as char),
            _ => sortie.push_str(&format!("\\{:03o}", c)),
        }
    }
    sortie.push(')');
    sortie
}

/// Comment se pose un style : sa taille, son gras, ses blancs, son retrait.
struct Reglage {
    taille: f64,
    gras: bool,
    avant: f64,
    apres: f64,
    retrait: f64,
    puce: bool,
}

fn reglage(style: Style) -> Reglage {
    match style {
        Style::Titre1 => Reglage { taille: 18.0, gras: true, avant: 16.0, apres: 6.0, retrait: 0.0, puce: false },
        Style::Titre2 => Reglage { taille: 14.0, gras: true, avant: 13.0, apres: 5.0, retrait: 0.0, puce: false },
        Style::Titre3 => Reglage { taille: 12.0, gras: true, avant: 11.0, apres: 4.0, retrait: 0.0, puce: false },
        Style::Puce => Reglage { taille: 11.0, gras: false, avant: 0.0, apres: 4.0, retrait: 18.0, puce: true },
        Style::Paragraphe => Reglage { taille: 11.0, gras: false, avant: 0.0, apres: 8.0, retrait: 0.0, puce: false },
    }
}

/// Un mot, avec sa mise en forme et le blanc qui le précède.
#[derive(Debug, Clone)]
struct Mot {
    texte: String,
    gras: bool,
    italique: bool,
    espace_avant: bool,
}

/// Découpe une ligne en mots, en retenant où il y avait un blanc.
///
/// Le blanc se retient plutôt que se déduire : « fin **gras** » et
/// « fin**gras** » ne donnent pas le même texte, et recoller tous les segments
/// avec une espace inventerait un blanc au milieu d'un mot.
fn mots_de(ligne: &str) -> Vec<Mot> {
    let mut mots: Vec<Mot> = Vec::new();
    let mut espace = false;
    for (texte, gras, italique) in segments(ligne) {
        if texte.starts_with(char::is_whitespace) {
            espace = true;
        }
        for (i, m) in texte.split_whitespace().enumerate() {
            mots.push(Mot {
                texte: m.to_string(),
                gras,
                italique,
                espace_avant: if i == 0 { espace } else { true },
            });
            espace = false;
        }
        if texte.ends_with(char::is_whitespace) {
            espace = true;
        }
    }
    if let Some(premier) = mots.first_mut() {
        premier.espace_avant = false;
    }
    mots
}

/// Range les mots en lignes qui tiennent dans la largeur donnée.
///
/// Un mot plus large que la colonne part seul sur sa ligne et déborde : mieux
/// vaut une référence de pièce qui dépasse qu'une boucle qui ne finit pas.
fn couper(mots: &[Mot], disponible: f64, taille: f64) -> Vec<Vec<Mot>> {
    let mut lignes: Vec<Vec<Mot>> = Vec::new();
    let mut courante: Vec<Mot> = Vec::new();
    let mut prise = 0.0;
    for mot in mots {
        let blanc = if courante.is_empty() || !mot.espace_avant {
            0.0
        } else {
            largeur(" ", taille, mot.gras)
        };
        let large = largeur(&mot.texte, taille, mot.gras);
        if !courante.is_empty() && prise + blanc + large > disponible {
            lignes.push(std::mem::take(&mut courante));
            prise = large;
            let mut seul = mot.clone();
            seul.espace_avant = false;
            courante.push(seul);
        } else {
            prise += blanc + large;
            courante.push(mot.clone());
        }
    }
    if !courante.is_empty() {
        lignes.push(courante);
    }
    lignes
}

/// Une ligne posée sur une page : où elle commence, à quelle taille, et quoi.
struct Posee {
    x: f64,
    y: f64,
    taille: f64,
    mots: Vec<Mot>,
}

/// Le texte rendu, réparti en pages et en lignes placées.
fn mise_en_page(texte: &str) -> Vec<Vec<Posee>> {
    let mut pages: Vec<Vec<Posee>> = vec![Vec::new()];
    let mut y = HAUTEUR_PAGE - MARGE;

    for (style, contenu) in lignes_du_document(texte) {
        let r = reglage(style);
        let disponible = LARGEUR_PAGE - 2.0 * MARGE - r.retrait;
        let mots: Vec<Mot> = mots_de(contenu)
            .into_iter()
            .map(|mut m| {
                // Un titre est gras d'un bout à l'autre ; un `*mot*` dedans
                // reste penché, mais ne redevient pas maigre.
                m.gras = m.gras || r.gras;
                m
            })
            .collect();
        let lignes = couper(&mots, disponible, r.taille);

        y -= r.avant;
        for (rang, ligne) in lignes.into_iter().enumerate() {
            y -= r.taille * INTERLIGNE;
            // Le plancher tient compte de ce qui descend sous la ligne de base,
            // sinon une page finit par une queue de « p » dans la marge.
            if y < MARGE + r.taille * 0.25 {
                pages.push(Vec::new());
                y = HAUTEUR_PAGE - MARGE - r.taille * INTERLIGNE;
            }
            let page = pages.last_mut().expect("une page existe toujours");
            if r.puce && rang == 0 {
                page.push(Posee {
                    x: MARGE,
                    y,
                    taille: r.taille,
                    mots: vec![Mot {
                        texte: "\u{2022}".to_string(),
                        gras: false,
                        italique: false,
                        espace_avant: false,
                    }],
                });
            }
            page.push(Posee { x: MARGE + r.retrait, y, taille: r.taille, mots: ligne });
        }
        y -= r.apres;
    }

    pages
}

/// La police d'un mot, parmi les quatre Helvetica déclarées.
fn police(gras: bool, italique: bool) -> &'static str {
    match (gras, italique) {
        (true, true) => "F4",
        (true, false) => "F2",
        (false, true) => "F3",
        (false, false) => "F1",
    }
}

/// Le flux de dessin d'une page.
fn flux(page: &[Posee]) -> String {
    let mut sortie = String::new();
    for ligne in page {
        sortie.push_str(&format!("BT\n1 0 0 1 {:.2} {:.2} Tm\n", ligne.x, ligne.y));
        let mut police_posee = "";
        let mut morceau = String::new();
        for mot in &ligne.mots {
            let p = police(mot.gras, mot.italique);
            if p != police_posee {
                if !morceau.is_empty() {
                    sortie.push_str(&format!("{} Tj\n", litteral(&morceau)));
                    morceau.clear();
                }
                sortie.push_str(&format!("/{} {:.2} Tf\n", p, ligne.taille));
                police_posee = p;
            }
            // Le blanc part toujours avec le mot qui suit : quand il tombe
            // entre deux polices, le poser avant le `Tf` le perdrait.
            if mot.espace_avant {
                morceau.push(' ');
            }
            morceau.push_str(&mot.texte);
        }
        if !morceau.is_empty() {
            sortie.push_str(&format!("{} Tj\n", litteral(&morceau)));
        }
        sortie.push_str("ET\n");
    }
    sortie
}

/// Le titre du document, s'il en porte un.
fn titre(texte: &str) -> Option<String> {
    lignes_du_document(texte)
        .into_iter()
        .find(|(style, _)| *style == Style::Titre1)
        .map(|(_, contenu)| {
            segments(contenu)
                .into_iter()
                .map(|(t, _, _)| t)
                .collect::<String>()
        })
}

/// Ajoute un objet numéroté au fichier et retient où il commence.
fn ajouter(fichier: &mut Vec<u8>, positions: &mut Vec<usize>, corps: &[u8]) {
    let numero = positions.len();
    positions.push(fichier.len());
    fichier.extend_from_slice(format!("{} 0 obj\n", numero).as_bytes());
    fichier.extend_from_slice(corps);
    fichier.extend_from_slice(b"\nendobj\n");
}

/// Le fichier PDF complet, prêt à poser.
pub fn corps_pdf(texte: &str, secondes_depuis_epoque: u64) -> Vec<u8> {
    let pages = mise_en_page(texte);
    let flux_des_pages: Vec<String> = pages.iter().map(|p| flux(p)).collect();

    // Numérotation : 1 le catalogue, 2 l'arbre des pages, 3 à 6 les polices,
    // 7 les propriétés du document, puis deux objets par page.
    let premier_de_page = 8;
    let numeros: Vec<usize> = (0..pages.len())
        .map(|i| premier_de_page + 2 * i)
        .collect();

    let mut fichier: Vec<u8> = Vec::new();
    let mut positions: Vec<usize> = vec![0];
    // La ligne de commentaire à octets hauts dit aux outils que le fichier est
    // binaire, et leur interdit de le réécrire en changeant les fins de ligne.
    fichier.extend_from_slice(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");

    ajouter(&mut fichier, &mut positions, b"<< /Type /Catalog /Pages 2 0 R >>");

    let enfants: Vec<String> = numeros.iter().map(|n| format!("{} 0 R", n)).collect();
    ajouter(
        &mut fichier,
        &mut positions,
        format!(
            "<< /Type /Pages /Kids [{}] /Count {} >>",
            enfants.join(" "),
            pages.len()
        )
        .as_bytes(),
    );

    for nom in ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"] {
        ajouter(
            &mut fichier,
            &mut positions,
            format!(
                "<< /Type /Font /Subtype /Type1 /BaseFont /{} /Encoding /WinAnsiEncoding >>",
                nom
            )
            .as_bytes(),
        );
    }

    let mut proprietes = format!(
        "<< /Producer (iAgent) /CreationDate {}",
        litteral(&crate::tache::date_pdf(secondes_depuis_epoque))
    );
    if let Some(t) = titre(texte) {
        proprietes.push_str(&format!(" /Title {}", litteral(&t)));
    }
    proprietes.push_str(" >>");
    ajouter(&mut fichier, &mut positions, proprietes.as_bytes());

    for (i, flux_page) in flux_des_pages.iter().enumerate() {
        ajouter(
            &mut fichier,
            &mut positions,
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.2} {:.2}] \
                 /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> \
                 /Contents {} 0 R >>",
                LARGEUR_PAGE,
                HAUTEUR_PAGE,
                numeros[i] + 1
            )
            .as_bytes(),
        );
        let mut flux_objet = format!("<< /Length {} >>\nstream\n", flux_page.len()).into_bytes();
        flux_objet.extend_from_slice(flux_page.as_bytes());
        flux_objet.extend_from_slice(b"endstream");
        ajouter(&mut fichier, &mut positions, &flux_objet);
    }

    let debut_table = fichier.len();
    fichier.extend_from_slice(format!("xref\n0 {}\n", positions.len()).as_bytes());
    fichier.extend_from_slice(b"0000000000 65535 f \n");
    for position in &positions[1..] {
        fichier.extend_from_slice(format!("{:010} 00000 n \n", position).as_bytes());
    }
    fichier.extend_from_slice(
        format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info 7 0 R >>\nstartxref\n{}\n%%EOF\n",
            positions.len(),
            debut_table
        )
        .as_bytes(),
    );

    fichier
}

/// Pose le PDF dans le dossier du client.
pub fn poser_pdf(
    dossier: &Path,
    nom: &str,
    secondes_depuis_epoque: u64,
    texte: &str,
) -> Result<PathBuf, String> {
    if lignes_du_document(texte).is_empty() {
        return Err("le document rendu est vide : aucun fichier n'a été écrit".to_string());
    }
    std::fs::create_dir_all(dossier)
        .map_err(|e| format!("création de {} : {}", dossier.display(), e))?;
    let chemin = dossier.join(nom);
    if chemin.exists() {
        return Err(format!("{} existe déjà", chemin.display()));
    }
    std::fs::write(&chemin, corps_pdf(texte, secondes_depuis_epoque))
        .map_err(|e| format!("écriture de {} : {}", chemin.display(), e))?;
    Ok(chemin)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Un rapport qui ressemble à ce que rendent les fiches : titres, puces,
    /// gras, accents, euro, guillemets.
    const RAPPORT: &str = "# Rapport du mois\n\nMadame, Monsieur,\n\nVoici le **relevé** arrêté au 23 septembre, « à vérifier » pour les montants sans justificatif.\n\n## Les postes\n\n- Loyer : 4 250,00 € — conforme\n- Énergie : 1 204,88 € — *en hausse*\n\nJe reste à votre disposition.";

    fn pdf(texte: &str) -> String {
        String::from_utf8_lossy(&corps_pdf(texte, 1_790_173_800)).into_owned()
    }

    #[test]
    fn les_largeurs_viennent_bien_des_metriques_d_adobe() {
        // Les tables sont engendrées ; si quelqu'un les retouche à la main, le
        // texte ne se coupera plus au bon endroit et rien ne le dira. Quatre
        // valeurs connues suffisent à repérer une table décalée ou tronquée.
        assert_eq!(LARGEURS[b' ' as usize], 278, "l'espace d'Helvetica");
        assert_eq!(LARGEURS[b'e' as usize], 556, "le « e » d'Helvetica");
        assert_eq!(LARGEURS[233], 556, "le « é », au code WinAnsi 233");
        assert_eq!(LARGEURS_GRAS[b'W' as usize], 944, "le « W » d'Helvetica-Bold");
        // Une largeur nulle décalerait la ligne sans prévenir.
        assert!(LARGEURS.iter().all(|l| *l > 0), "aucune largeur ne peut être nulle");
        assert!(LARGEURS_GRAS.iter().all(|l| *l > 0));
    }

    #[test]
    fn les_accents_francais_partent_dans_l_encodage_declare() {
        assert_eq!(code_winansi('é'), Some(233));
        assert_eq!(code_winansi('€'), Some(128));
        assert_eq!(code_winansi('«'), Some(171));
        assert_eq!(code_winansi('œ'), Some(156));
        assert_eq!(code_winansi('—'), Some(151));
        assert_eq!(code_winansi('A'), Some(65));
        // Le fichier déclare WinAnsiEncoding : s'il partait en UTF-8, le lecteur
        // afficherait « rÃ©fÃ©rence » et personne ne l'aurait écrit.
        assert!(pdf(RAPPORT).contains("WinAnsiEncoding"));
        assert!(litteral("relevé").contains("\\351"), "« é » s'écrit en octal 351");
    }

    #[test]
    fn un_caractere_hors_encodage_se_traduit_ou_se_dit() {
        // Helvetica ne porte pas la flèche : la perdre en silence serait le
        // pire des trois choix.
        assert_eq!(litteral("a → b"), "(a -> b)");
        assert_eq!(litteral("x ≥ 3"), "(x >= 3)");
        assert_eq!(litteral("un ☃ perdu"), "(un ? perdu)");
    }

    #[test]
    fn les_parentheses_ne_ferment_pas_la_chaine() {
        // Une parenthèse non échappée coupe la chaîne en plein milieu et le
        // reste de la page part en syntaxe : c'est la faute classique.
        assert_eq!(litteral("l'hébergement (149/mois)"), "(l'h\\351bergement \\(149/mois\\))");
        assert_eq!(litteral("un \\ perdu"), "(un \\\\ perdu)");
    }

    #[test]
    fn le_fichier_commence_et_finit_comme_un_pdf() {
        let f = corps_pdf(RAPPORT, 1_790_173_800);
        assert!(f.starts_with(b"%PDF-1.4\n"), "l'en-tête manque");
        assert!(f.ends_with(b"%%EOF\n"), "la fin de fichier manque");
    }

    /// Où se trouve cette suite d'octets, la première ou la dernière fois.
    fn position_de(foin: &[u8], aiguille: &[u8]) -> Option<usize> {
        foin.windows(aiguille.len()).position(|f| f == aiguille)
    }

    fn derniere_position_de(foin: &[u8], aiguille: &[u8]) -> Option<usize> {
        foin.windows(aiguille.len()).rposition(|f| f == aiguille)
    }

    /// Le nombre écrit en clair à partir de cette position.
    fn nombre_a(octets: &[u8], depart: usize) -> usize {
        let chiffres: Vec<u8> = octets[depart..]
            .iter()
            .copied()
            .take_while(|c| c.is_ascii_digit())
            .collect();
        String::from_utf8(chiffres).unwrap().parse().unwrap()
    }

    #[test]
    fn la_table_des_positions_pointe_sur_les_objets() {
        // La table des positions est ce qu'un PDF écrit à la main rate : un
        // seul octet de décalage et le lecteur refuse le fichier en bloc. On
        // rejoue ici ce que fait le lecteur — aller à chaque position annoncée
        // et vérifier que l'objet attendu s'y trouve. En octets, jamais en
        // texte : la ligne de commentaire de l'en-tête n'est pas de l'UTF-8 et
        // la lire comme du texte décale tout ce qui suit.
        let f = corps_pdf(RAPPORT, 1_790_173_800);
        let annonce = derniere_position_de(&f, b"startxref\n").expect("le fichier dit où est sa table")
            + b"startxref\n".len();
        let debut = nombre_a(&f, annonce);
        assert!(
            f[debut..].starts_with(b"xref\n"),
            "la table n'est pas là où le fichier le dit"
        );

        let table = String::from_utf8(f[debut..].to_vec()).expect("la table est en clair");
        let lignes: Vec<&str> = table.lines().collect();
        let nombre: usize = lignes[1].split_whitespace().nth(1).unwrap().parse().unwrap();
        assert!(nombre > 8, "un rapport donne au moins neuf objets, pas {}", nombre);
        for numero in 1..nombre {
            let ligne = lignes[2 + numero];
            assert_eq!(
                ligne.len(),
                19,
                "une entrée de table fait vingt octets, fin de ligne comprise : « {} »",
                ligne
            );
            let position: usize = ligne[..10].parse().unwrap();
            let attendu = format!("{} 0 obj", numero);
            assert!(
                f[position..].starts_with(attendu.as_bytes()),
                "la table annonce l'objet {} en {} et on y trouve « {} »",
                numero,
                position,
                String::from_utf8_lossy(&f[position..(position + 20).min(f.len())])
            );
        }
    }

    #[test]
    fn la_longueur_annoncee_est_la_longueur_du_flux() {
        // `/Length` faux, et le lecteur lit la page suivante comme du dessin.
        let f = corps_pdf(RAPPORT, 1_790_173_800);
        let marque = b"<< /Length ";
        let annoncee = nombre_a(&f, position_de(&f, marque).expect("un flux annonce sa longueur") + marque.len());
        let flux = position_de(&f, b"stream\n").unwrap() + b"stream\n".len();
        let fin = position_de(&f[flux..], b"endstream").expect("le flux se ferme");
        assert_eq!(annoncee, fin, "la longueur annoncée n'est pas celle du flux");
    }

    #[test]
    fn le_texte_ne_deborde_jamais_de_la_marge() {
        let long = "Une phrase volontairement longue, qui ne tient pas sur une ligne d'une page A4 avec vingt millimètres de marge de chaque côté, et qu'il faut donc couper sans jamais mordre sur la marge de droite.";
        for ligne in couper(&mots_de(long), LARGEUR_PAGE - 2.0 * MARGE, 11.0) {
            let posee: f64 = ligne
                .iter()
                .map(|m| {
                    largeur(&m.texte, 11.0, m.gras)
                        + if m.espace_avant { largeur(" ", 11.0, m.gras) } else { 0.0 }
                })
                .sum();
            assert!(
                posee <= LARGEUR_PAGE - 2.0 * MARGE,
                "une ligne fait {:.1} points pour {:.1} disponibles",
                posee,
                LARGEUR_PAGE - 2.0 * MARGE
            );
        }
    }

    #[test]
    fn un_mot_plus_large_que_la_colonne_part_seul_plutot_que_de_boucler() {
        let interminable = "Referencedepiecetropluesansespaceaucunquidepasselacolonneentiere";
        let lignes = couper(&mots_de(interminable), 50.0, 11.0);
        assert_eq!(lignes.len(), 1);
        assert_eq!(lignes[0].len(), 1);
    }

    #[test]
    fn un_long_document_prend_plusieurs_pages() {
        let mut long = String::new();
        for i in 1..=60 {
            long.push_str(&format!("Paragraphe numéro {} du rapport, assez fourni pour que soixante d'entre eux ne tiennent pas sur une seule feuille.\n\n", i));
        }
        let pages = mise_en_page(&long);
        assert!(pages.len() >= 2, "soixante paragraphes tiennent sur {} page(s)", pages.len());
        let texte = pdf(&long);
        assert!(texte.contains(&format!("/Count {}", pages.len())), "le compte des pages ment");
        // Rien ne descend sous la marge du bas.
        for page in &pages {
            for ligne in page {
                assert!(ligne.y >= MARGE, "une ligne est posée à {:.1}, sous la marge", ligne.y);
            }
        }
    }

    #[test]
    fn la_puce_reste_sur_la_ligne_de_son_texte() {
        // Une puce rejetée en bas de page et son texte en haut de la suivante :
        // c'est ce que donne un saut de page décidé après coup.
        let pages = mise_en_page("- une puce\n- une autre");
        let page = &pages[0];
        assert_eq!(page.len(), 4, "deux puces et leurs deux textes");
        assert_eq!(page[0].y, page[1].y, "la puce et son texte partagent la ligne");
        assert_eq!(page[0].x, MARGE);
        assert!(page[1].x > MARGE, "le texte de la puce est en retrait");
    }

    #[test]
    fn le_gras_et_le_penche_changent_de_police() {
        let texte = pdf("Du **gras**, du *penché* et du ***les deux***.");
        for police in ["/F1", "/F2", "/F3", "/F4"] {
            assert!(texte.contains(police), "la police {} ne sert pas", police);
        }
        // Les trois étoiles ne doivent pas laisser d'étoile en clair sur un
        // document qui sort de la maison.
        assert!(!texte.contains("\\052"), "une étoile est restée dans le texte");
    }

    #[test]
    fn un_mot_colle_a_son_gras_ne_gagne_pas_d_espace() {
        let mots = mots_de("fin**gras** et mot **gras**");
        assert_eq!(mots[0].texte, "fin");
        assert!(!mots[1].espace_avant, "« fin » et « gras » sont collés");
        assert!(mots[2].espace_avant, "« et » suit une espace");
        assert!(mots[4].espace_avant, "« gras » suit une espace");
    }

    #[test]
    fn le_titre_du_document_devient_le_titre_du_fichier() {
        assert_eq!(titre(RAPPORT).as_deref(), Some("Rapport du mois"));
        assert!(pdf(RAPPORT).contains("/Title (Rapport du mois)"));
        // Sans titre dans le texte, on n'en invente pas.
        assert_eq!(titre("Juste un paragraphe."), None);
        assert!(!pdf("Juste un paragraphe.").contains("/Title"));
    }

    #[test]
    fn la_date_du_pdf_dit_la_meme_heure_que_le_nom_du_fichier() {
        // Même horloge que le courriel : 1 790 173 800 vaut le 23 septembre
        // 2026 à 14 h 30 UTC.
        assert_eq!(crate::tache::date_pdf(1_790_173_800), "D:20260923143000+00'00'");
        assert!(pdf(RAPPORT).contains("/CreationDate (D:20260923143000+00'00')"));
    }

    #[test]
    fn un_document_vide_ne_donne_pas_de_fichier() {
        let dossier = std::env::temp_dir().join("iagent-pdf-vide");
        let _ = std::fs::remove_dir_all(&dossier);
        let refus = poser_pdf(&dossier, "rien.pdf", 1_790_173_800, "   \n\n  ").unwrap_err();
        assert!(refus.contains("vide"), "{}", refus);
        assert!(!dossier.join("rien.pdf").exists(), "aucun fichier ne doit être posé");
    }

    #[test]
    fn un_pdf_ne_s_ecrase_jamais() {
        let dossier = std::env::temp_dir().join("iagent-pdf-deux-fois");
        let _ = std::fs::remove_dir_all(&dossier);
        poser_pdf(&dossier, "rapport.pdf", 1_790_173_800, RAPPORT).unwrap();
        let refus = poser_pdf(&dossier, "rapport.pdf", 1_790_173_800, RAPPORT).unwrap_err();
        assert!(refus.contains("existe déjà"), "{}", refus);
        let _ = std::fs::remove_dir_all(&dossier);
    }

    #[test]
    fn le_pdf_et_le_document_word_lisent_le_meme_texte() {
        // Une seule lecture des marques pour les deux écrivains : si l'un
        // comptait ses titres autrement, un même rapport n'aurait pas la même
        // structure selon la boîte demandée.
        let lues = crate::document::lignes_du_document(RAPPORT);
        assert_eq!(lues[0].0, Style::Titre1);
        assert_eq!(lues[0].1, "Rapport du mois");
        assert_eq!(
            lues.iter().filter(|(s, _)| *s == Style::Puce).count(),
            2,
            "deux puces dans le rapport"
        );
        assert_eq!(mise_en_page(RAPPORT).len(), 1);
    }
}
