//! L'empreinte vocale : reconnaître qui parle, sur le son et rien d'autre.
//!
//! ## Ce qui était là avant, et pourquoi il fallait le remplacer
//!
//! Le premier extracteur s'appelait « MFCC » et n'en était pas un : il calculait,
//! par trame de 10 ms, le taux de passage par zéro, l'énergie et une pseudo
//! centroïde spectrale, puis comparait deux enregistrements **trame numéro i
//! contre trame numéro i** avec une distance inverse `1/(1+écart)`.
//!
//! Deux défauts, et le second est mortel :
//!   - comparer la trame i à la trame i suppose que les deux enregistrements
//!     disent la même chose au même instant. Un dixième de seconde de décalage
//!     et la comparaison porte sur des sons différents ;
//!   - l'énergie et la centroïde sont de petits nombres, donc `1/(1+écart)` vaut
//!     presque 1 pour n'importe quelle paire de signaux. **Tous les scores
//!     tenaient dans la bande 0,977-0,992**, et aucun seuil ne pouvait les
//!     séparer.
//!
//! Mesuré le 25/09/2026 sur deux voix de synthèse (f0 et formants différents),
//! trois phrases chacune : l'ancien extracteur donnait une séparation
//! **négative** de -0,015 — la meilleure ressemblance de tout le jeu était une
//! paire de DEUX locuteurs différents, mieux notée que n'importe quelle paire du
//! même locuteur. Le score n'était pas fixe, comme le disait l'écran : il ne
//! voulait simplement rien dire. L'écran avait raison de refuser.
//!
//! ## Ce qui est là maintenant
//!
//! Une vraie chaîne cepstrale, sans aucune bibliothèque : pré-accentuation,
//! trames de 25 ms à la fenêtre de Hamming, FFT de 512 points, 26 filtres
//! triangulaires sur l'échelle mel, logarithme, DCT-II, et on garde les
//! coefficients 1 à 12. Le coefficient 0 est jeté : c'est le volume, et une
//! empreinte ne doit pas changer parce qu'on a parlé plus fort.
//!
//! La signature d'un enregistrement est la **moyenne** des trames sonores, ce qui
//! la rend indifférente à l'ordre et au rythme : le client n'a pas à redire la
//! même phrase. Les trames silencieuses sont écartées, sinon la moyenne décrit le
//! silence de la pièce.
//!
//! Sur le même jeu de mesure : même locuteur ≥ 0,985, locuteurs différents
//! ≤ 0,855, **séparation +0,130**. Les bancs de ce fichier rejouent cette mesure.
//!
//! ## Ce que ça ne fait pas, et ne fera pas ici
//!
//! **Ce n'est pas un mot de passe, et ça n'ouvre rien.** La séparation ci-dessus
//! est mesurée sur des voix de synthèse : deux vraies voix proches, dans une
//! pièce bruyante, avec un micro quelconque, se ressembleront davantage. Aucun
//! taux de fausse acceptation n'a été mesuré sur de vraies personnes, donc le
//! score reste une indication affichée, jamais une autorisation.

use serde::{Deserialize, Serialize};

/// Le taux de l'empreinte, celui que le microphone rend déjà (`voice::capturer`).
///
/// Il valait 44 100 dans `main.rs` pendant que le micro rendait du 16 kHz : les
/// trames étaient donc calculées sur une fenêtre 2,75 fois trop longue. Un seul
/// taux, dans le module qui s'en sert.
pub const TAUX_EMPREINTE: u32 = 16_000;

/// 25 ms à 16 kHz.
const FENETRE: usize = 400;
/// 10 ms à 16 kHz : les trames se recouvrent, comme partout en analyse de parole.
const PAS: usize = 160;
/// La puissance de 2 au-dessus de la fenêtre.
const NFFT: usize = 512;
/// Le nombre de filtres mel.
const FILTRES: usize = 26;
/// Combien de coefficients cepstraux composent une signature.
pub const COEFFICIENTS: usize = 12;
/// La pré-accentuation, qui relève les hautes fréquences écrasées par la voix.
const PREACCENT: f32 = 0.97;
/// Une trame compte comme sonore au-delà de ce centième de l'énergie maximale.
/// Sans ce tri, la moyenne d'un enregistrement décrit surtout les blancs.
const PART_SONORE: f32 = 0.01;
/// Il faut au moins ça de trames sonores pour qu'une moyenne veuille dire
/// quelque chose : 20 trames sont 0,2 seconde de parole.
const TRAMES_MINIMUM: usize = 20;

/// La version du format rangé en base. Le premier format tenait des milliers de
/// traits par phrase et n'était pas comparable à celui-ci : relu tel quel, il
/// donnerait un score au hasard. Il vaut mieux demander au client de recommencer.
pub const VERSION: u32 = 2;

/// Ce qui est rangé pour un client, tel quel dans la colonne `mfcc_data`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Empreinte {
    pub version: u32,
    /// Une signature par phrase enregistrée.
    pub signatures: Vec<Vec<f32>>,
    /// Ce que les phrases du client se ressemblent entre elles. C'est la mesure
    /// qui sert de référence à la vérification : elle tient compte de sa voix et
    /// de son microphone, plutôt que d'un seuil universel inventé ici.
    pub coherence: f32,
}

/// Le verdict d'une comparaison. Une indication, jamais une autorisation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Comparaison {
    /// La ressemblance, de 0 à 1.
    pub score: f32,
    /// Ce à quoi le score est comparé : la cohérence des phrases d'origine.
    pub reference: f32,
    /// Une phrase en français pour l'écran.
    pub verdict: String,
}

/// Sous la cohérence moins cette marge, on ne reconnaît plus.
///
/// Les deux marges ne sont pas mesurées sur de vraies personnes : elles sont
/// posées large exprès, et c'est pour ça que le verdict ne donne aucun droit.
const MARGE_RECONNU: f32 = 0.02;
const MARGE_DOUTE: f32 = 0.06;

/// La signature d'un enregistrement : `COEFFICIENTS` nombres.
pub fn signature(echantillons: &[i16], taux: u32) -> Result<Vec<f32>, String> {
    let trames = trames_cepstrales(echantillons, taux);
    if trames.len() < TRAMES_MINIMUM {
        return Err(format!(
            "je n'ai pas entendu assez de voix : {} tranches sonores sur les {} qu'il faut. \
             Parlez un peu plus près du microphone.",
            trames.len(),
            TRAMES_MINIMUM
        ));
    }
    let mut moyenne = vec![0.0f32; COEFFICIENTS];
    for trame in &trames {
        for (k, v) in trame.iter().enumerate() {
            moyenne[k] += *v;
        }
    }
    for v in &mut moyenne {
        *v /= trames.len() as f32;
    }
    Ok(moyenne)
}

/// L'empreinte d'un client, à partir des phrases qu'il vient d'enregistrer.
pub fn empreinte(phrases: &[Vec<i16>], taux: u32) -> Result<Empreinte, String> {
    if phrases.len() < 2 {
        return Err(
            "il faut au moins deux phrases : avec une seule, rien ne dit ce que votre voix \
             a de constant."
                .to_string(),
        );
    }
    let mut signatures = Vec::new();
    for (i, phrase) in phrases.iter().enumerate() {
        let s = signature(phrase, taux)
            .map_err(|motif| format!("phrase {} : {}", i + 1, motif))?;
        signatures.push(s);
    }

    // La cohérence : ce que ses propres phrases se ressemblent. C'est la
    // référence de la vérification, et c'est aussi la seule mesure honnête dont
    // on dispose sur SA voix et SON microphone.
    let mut paires = Vec::new();
    for i in 0..signatures.len() {
        for j in (i + 1)..signatures.len() {
            paires.push(cosinus(&signatures[i], &signatures[j]));
        }
    }
    let coherence = paires.iter().sum::<f32>() / paires.len() as f32;

    Ok(Empreinte {
        version: VERSION,
        signatures,
        coherence,
    })
}

/// Compare un enregistrement à l'empreinte rangée.
pub fn comparer(echantillons: &[i16], rangee: &Empreinte, taux: u32) -> Result<Comparaison, String> {
    if rangee.version != VERSION {
        return Err(format!(
            "l'empreinte rangée est d'une version antérieure ({}) : enregistrez votre voix \
             à nouveau, elle n'est pas comparable.",
            rangee.version
        ));
    }
    if rangee.signatures.is_empty() {
        return Err("l'empreinte rangée est vide : enregistrez votre voix à nouveau.".to_string());
    }
    for s in &rangee.signatures {
        if s.len() != COEFFICIENTS {
            return Err(format!(
                "l'empreinte rangée tient {} nombres au lieu de {} : enregistrez votre voix \
                 à nouveau.",
                s.len(),
                COEFFICIENTS
            ));
        }
    }

    let signature = signature(echantillons, taux)?;
    let score = rangee
        .signatures
        .iter()
        .map(|s| cosinus(&signature, s))
        .sum::<f32>()
        / rangee.signatures.len() as f32;
    let score = score.clamp(0.0, 1.0);

    Ok(Comparaison {
        score,
        reference: rangee.coherence,
        verdict: verdict(score, rangee.coherence).to_string(),
    })
}

/// La phrase à montrer. Elle dit ce que la mesure vaut, pas ce qu'elle autorise.
pub fn verdict(score: f32, reference: f32) -> &'static str {
    if score >= reference - MARGE_RECONNU {
        "Je reconnais votre voix."
    } else if score >= reference - MARGE_DOUTE {
        "C'est peut-être vous, je n'en suis pas sûr."
    } else {
        "Ce n'est pas la voix enregistrée."
    }
}

/// Les vecteurs cepstraux des trames sonores.
fn trames_cepstrales(echantillons: &[i16], taux: u32) -> Vec<Vec<f32>> {
    if echantillons.len() < FENETRE {
        return Vec::new();
    }

    // Pré-accentuation : la voix perd ses hautes fréquences, on les relève avant
    // de mesurer, sinon les filtres du haut ne voient presque rien.
    let mut y = Vec::with_capacity(echantillons.len());
    y.push(echantillons[0] as f32 / 32768.0);
    for i in 1..echantillons.len() {
        let a = echantillons[i] as f32 / 32768.0;
        let b = echantillons[i - 1] as f32 / 32768.0;
        y.push(a - PREACCENT * b);
    }

    let hamming = hamming();
    let banc = banc_mel(taux);

    let mut fenetrees = Vec::new();
    let mut energies = Vec::new();
    let mut debut = 0;
    while debut + FENETRE <= y.len() {
        let trame: Vec<f32> = (0..FENETRE).map(|j| y[debut + j] * hamming[j]).collect();
        energies.push(trame.iter().map(|v| v * v).sum::<f32>() / FENETRE as f32);
        fenetrees.push(trame);
        debut += PAS;
    }

    let plafond = energies.iter().copied().fold(0.0f32, f32::max);
    if plafond <= 0.0 {
        return Vec::new();
    }

    let mut sorties = Vec::new();
    for (trame, energie) in fenetrees.iter().zip(&energies) {
        if *energie <= plafond * PART_SONORE {
            continue;
        }
        sorties.push(cepstre(trame, &banc));
    }
    sorties
}

/// Le cepstre d'une trame : FFT, filtres mel, logarithme, DCT.
fn cepstre(trame: &[f32], banc: &[Vec<f32>]) -> Vec<f32> {
    let mut re = vec![0.0f32; NFFT];
    let mut im = vec![0.0f32; NFFT];
    re[..trame.len()].copy_from_slice(trame);
    fft(&mut re, &mut im);

    let moitie = NFFT / 2 + 1;
    let puissance: Vec<f32> = (0..moitie)
        .map(|k| (re[k] * re[k] + im[k] * im[k]) / NFFT as f32)
        .collect();

    let logs: Vec<f32> = banc
        .iter()
        .map(|filtre| {
            let e: f32 = puissance
                .iter()
                .zip(filtre)
                .map(|(p, g)| p * g)
                .sum();
            // Le plancher évite `ln(0)` sur un filtre que rien n'excite.
            e.max(1e-10).ln()
        })
        .collect();

    // DCT-II, en sautant le coefficient 0 : c'est le volume de la trame.
    (1..=COEFFICIENTS)
        .map(|k| {
            logs.iter()
                .enumerate()
                .map(|(m, l)| {
                    l * (std::f32::consts::PI * k as f32 * (m as f32 + 0.5) / FILTRES as f32).cos()
                })
                .sum()
        })
        .collect()
}

fn hamming() -> Vec<f32> {
    (0..FENETRE)
        .map(|i| {
            0.54 - 0.46
                * (2.0 * std::f32::consts::PI * i as f32 / (FENETRE as f32 - 1.0)).cos()
        })
        .collect()
}

fn hz_vers_mel(f: f32) -> f32 {
    2595.0 * (1.0 + f / 700.0).log10()
}

fn mel_vers_hz(m: f32) -> f32 {
    700.0 * (10.0f32.powf(m / 2595.0) - 1.0)
}

/// Les 26 filtres triangulaires, régulièrement espacés sur l'échelle mel : c'est
/// elle qui approche la façon dont l'oreille range les hauteurs.
fn banc_mel(taux: u32) -> Vec<Vec<f32>> {
    let bas = 20.0f32;
    let haut = taux as f32 / 2.0;
    let (mel_bas, mel_haut) = (hz_vers_mel(bas), hz_vers_mel(haut));
    let moitie = NFFT / 2 + 1;

    let bornes: Vec<usize> = (0..FILTRES + 2)
        .map(|i| {
            let mel = mel_bas + i as f32 * (mel_haut - mel_bas) / (FILTRES as f32 + 1.0);
            let bin = (mel_vers_hz(mel) * NFFT as f32 / taux as f32) as usize;
            bin.min(moitie - 1)
        })
        .collect();

    (1..=FILTRES)
        .map(|i| {
            let (g, c, d) = (bornes[i - 1], bornes[i], bornes[i + 1]);
            let mut filtre = vec![0.0f32; moitie];
            for k in g..c {
                filtre[k] = (k - g) as f32 / (c - g) as f32;
            }
            for k in c..d {
                filtre[k] = (d - k) as f32 / (d - c) as f32;
            }
            filtre
        })
        .collect()
}

/// FFT sur place, radix 2. `re` et `im` ont la même longueur, une puissance de 2.
///
/// Écrite ici parce qu'elle tient en trente lignes et qu'une dépendance de plus
/// dans le binaire du poste coûte plus que ça. Les facteurs de rotation sont
/// recalculés à chaque étage : les accumuler ferait dériver la précision sur 256
/// multiplications en f32.
fn fft(re: &mut [f32], im: &mut [f32]) {
    let n = re.len();
    debug_assert!(n.is_power_of_two());
    debug_assert_eq!(n, im.len());

    // Permutation par inversion de bits.
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j |= bit;
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
    }

    let mut longueur = 2usize;
    while longueur <= n {
        let demi = longueur / 2;
        let mut debut = 0;
        while debut < n {
            for k in 0..demi {
                let angle = -2.0 * std::f32::consts::PI * k as f32 / longueur as f32;
                let (cr, ci) = (angle.cos(), angle.sin());
                let (ar, ai) = (re[debut + k], im[debut + k]);
                let (br, bi) = (re[debut + k + demi], im[debut + k + demi]);
                let (tr, ti) = (br * cr - bi * ci, br * ci + bi * cr);
                re[debut + k] = ar + tr;
                im[debut + k] = ai + ti;
                re[debut + k + demi] = ar - tr;
                im[debut + k + demi] = ai - ti;
            }
            debut += longueur;
        }
        longueur <<= 1;
    }
}

/// Le cosinus entre deux signatures. Il vaut 0 si l'une est nulle.
fn cosinus(a: &[f32], b: &[f32]) -> f32 {
    if a.is_empty() || b.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let na = a.iter().map(|v| v * v).sum::<f32>().sqrt();
    let nb = b.iter().map(|v| v * v).sum::<f32>().sqrt();
    if na == 0.0 || nb == 0.0 {
        return 0.0;
    }
    a.iter().zip(b).map(|(x, y)| x * y).sum::<f32>() / (na * nb)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Une voix de synthèse : un train d'impulsions glottales à `f0`, filtré par
    /// trois résonances. C'est grossier, mais ça porte les deux choses qui
    /// distinguent deux personnes — la hauteur et la forme du conduit vocal — et
    /// ça se reproduit à l'identique d'une exécution à l'autre, ce qu'un
    /// enregistrement ne fait pas.
    fn voyelle(f0: f32, formants: &[(f32, f32)], duree: f32, graine: u64) -> Vec<f32> {
        let n = (duree * TAUX_EMPREINTE as f32) as usize;
        let mut x = vec![0.0f32; n];
        let mut alea = graine.wrapping_mul(6364136223846793005).wrapping_add(1);
        let mut tirage = || {
            alea = alea
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((alea >> 33) as f32 / (1u64 << 31) as f32) - 0.5
        };

        let periode = TAUX_EMPREINTE as f32 / f0;
        let mut pos = 0.0f32;
        while (pos as usize) < n {
            x[pos as usize] += 1.0;
            pos += periode * (1.0 + tirage() * 0.04);
        }

        for (fc, bande) in formants {
            let r = (-std::f32::consts::PI * bande / TAUX_EMPREINTE as f32).exp();
            let theta = 2.0 * std::f32::consts::PI * fc / TAUX_EMPREINTE as f32;
            let (a1, a2) = (2.0 * r * theta.cos(), -r * r);
            let (mut y1, mut y2) = (0.0f32, 0.0f32);
            for v in x.iter_mut() {
                let y = *v + a1 * y1 + a2 * y2;
                y2 = y1;
                y1 = y;
                *v = y;
            }
        }

        let crete = x.iter().fold(0.0f32, |m, v| m.max(v.abs())).max(1e-9);
        x.iter().map(|v| v / crete * 0.5).collect()
    }

    /// Une « phrase » : plusieurs voyelles, séparées par des blancs. Le locuteur
    /// garde sa hauteur et le décalage de ses formants ; la phrase change les
    /// voyelles et les durées.
    fn phrase(f0: f32, base: &[(f32, f32)], segments: &[(f32, f32)], graine: u64) -> Vec<i16> {
        let mut sortie = Vec::new();
        for (k, (decalage, duree)) in segments.iter().enumerate() {
            let formants: Vec<(f32, f32)> =
                base.iter().map(|(fc, b)| (fc * decalage, *b)).collect();
            sortie.extend(voyelle(f0, &formants, *duree, graine + k as u64));
            sortie.extend(vec![0.0f32; (0.05 * TAUX_EMPREINTE as f32) as usize]);
        }
        sortie
            .iter()
            .map(|v| (v.clamp(-1.0, 1.0) * i16::MAX as f32) as i16)
            .collect()
    }

    const VOIX_A: (f32, [(f32, f32); 3]) = (110.0, [(700.0, 80.0), (1220.0, 90.0), (2600.0, 120.0)]);
    const VOIX_B: (f32, [(f32, f32); 3]) = (210.0, [(850.0, 90.0), (1900.0, 110.0), (2900.0, 130.0)]);

    const PHRASE_1: [(f32, f32); 4] = [(1.00, 0.30), (0.82, 0.25), (1.18, 0.35), (0.95, 0.28)];
    const PHRASE_2: [(f32, f32); 4] = [(1.12, 0.22), (0.90, 0.33), (1.05, 0.26), (0.78, 0.31)];
    const PHRASE_3: [(f32, f32); 4] = [(0.88, 0.29), (1.20, 0.24), (0.97, 0.32), (1.08, 0.27)];

    fn dit(voix: &(f32, [(f32, f32); 3]), segments: &[(f32, f32)], graine: u64) -> Vec<i16> {
        phrase(voix.0, &voix.1, segments, graine)
    }

    #[test]
    fn une_signature_tient_douze_nombres() {
        let s = signature(&dit(&VOIX_A, &PHRASE_1, 1), TAUX_EMPREINTE).unwrap();
        assert_eq!(s.len(), COEFFICIENTS);
        assert!(s.iter().all(|v| v.is_finite()), "un coefficient n'est pas fini");
    }

    /// La mesure qui décide : le même locuteur sur une autre phrase doit se
    /// ressembler PLUS que deux locuteurs sur la même phrase. C'est exactement ce
    /// que l'ancien extracteur ne faisait pas.
    #[test]
    fn separe_deux_locuteurs() {
        let a1 = signature(&dit(&VOIX_A, &PHRASE_1, 1), TAUX_EMPREINTE).unwrap();
        let a2 = signature(&dit(&VOIX_A, &PHRASE_2, 40), TAUX_EMPREINTE).unwrap();
        let a3 = signature(&dit(&VOIX_A, &PHRASE_3, 80), TAUX_EMPREINTE).unwrap();
        let b1 = signature(&dit(&VOIX_B, &PHRASE_1, 1), TAUX_EMPREINTE).unwrap();
        let b2 = signature(&dit(&VOIX_B, &PHRASE_2, 40), TAUX_EMPREINTE).unwrap();

        let memes = [
            cosinus(&a1, &a2),
            cosinus(&a1, &a3),
            cosinus(&a2, &a3),
            cosinus(&b1, &b2),
        ];
        let autres = [
            cosinus(&a1, &b1),
            cosinus(&a2, &b2),
            cosinus(&a1, &b2),
            cosinus(&a3, &b1),
        ];

        let pire_meme = memes.iter().copied().fold(1.0f32, f32::min);
        let meilleur_autre = autres.iter().copied().fold(0.0f32, f32::max);
        assert!(
            pire_meme > meilleur_autre + 0.05,
            "séparation insuffisante : même locuteur au pire {:.4}, locuteurs différents au \
             mieux {:.4}. Mesuré le 25/09/2026 : 0,9849 contre 0,8548.",
            pire_meme,
            meilleur_autre
        );
    }

    #[test]
    fn le_volume_ne_change_pas_la_signature() {
        let fort = dit(&VOIX_A, &PHRASE_1, 1);
        let faible: Vec<i16> = fort.iter().map(|v| v / 4).collect();
        let s1 = signature(&fort, TAUX_EMPREINTE).unwrap();
        let s2 = signature(&faible, TAUX_EMPREINTE).unwrap();
        assert!(
            cosinus(&s1, &s2) > 0.99,
            "parler moins fort change l'empreinte : {:.4}",
            cosinus(&s1, &s2)
        );
    }

    /// Un micro muet, ou coupé, ne doit pas rendre une signature : deux silences
    /// se ressembleraient parfaitement, et l'agent reconnaîtrait n'importe qui.
    #[test]
    fn le_silence_est_refuse() {
        let muet = vec![0i16; TAUX_EMPREINTE as usize * 2];
        let motif = signature(&muet, TAUX_EMPREINTE).unwrap_err();
        assert!(motif.contains("microphone"), "motif peu clair : {}", motif);
    }

    #[test]
    fn une_seule_phrase_ne_fait_pas_une_empreinte() {
        let une = vec![dit(&VOIX_A, &PHRASE_1, 1)];
        assert!(empreinte(&une, TAUX_EMPREINTE).is_err());
    }

    #[test]
    fn l_empreinte_du_proprietaire_le_reconnait_et_ecarte_l_autre() {
        let phrases = vec![
            dit(&VOIX_A, &PHRASE_1, 1),
            dit(&VOIX_A, &PHRASE_2, 40),
            dit(&VOIX_A, &PHRASE_3, 80),
        ];
        let e = empreinte(&phrases, TAUX_EMPREINTE).unwrap();
        assert_eq!(e.signatures.len(), 3);
        assert!(e.coherence > 0.9, "cohérence trop basse : {:.4}", e.coherence);

        // Lui, sur une phrase qu'il n'a pas enregistrée.
        let sienne = dit(&VOIX_A, &[(1.05, 0.30), (0.85, 0.30), (1.15, 0.30)], 200);
        let c = comparer(&sienne, &e, TAUX_EMPREINTE).unwrap();
        assert!(
            c.score > e.coherence - MARGE_DOUTE,
            "le propriétaire n'est pas reconnu : {:.4} contre une référence de {:.4}",
            c.score,
            c.reference
        );

        // L'autre.
        let autre = dit(&VOIX_B, &PHRASE_1, 1);
        let c = comparer(&autre, &e, TAUX_EMPREINTE).unwrap();
        assert!(
            c.score < e.coherence - MARGE_DOUTE,
            "une autre voix passe pour la sienne : {:.4} contre une référence de {:.4}",
            c.score,
            c.reference
        );
        assert_eq!(c.verdict, "Ce n'est pas la voix enregistrée.");
    }

    /// Une empreinte du premier format tenait des milliers de traits par phrase.
    /// Relue comme une signature, elle donnerait un score au hasard : il vaut
    /// mieux le dire.
    #[test]
    fn une_empreinte_d_avant_est_refusee_en_clair() {
        let ancienne = Empreinte {
            version: 1,
            signatures: vec![vec![0.1; 3000]],
            coherence: 0.99,
        };
        let motif = comparer(&dit(&VOIX_A, &PHRASE_1, 1), &ancienne, TAUX_EMPREINTE).unwrap_err();
        assert!(motif.contains("à nouveau"), "motif peu clair : {}", motif);
    }

    /// La FFT contre une transformée directe : si elle se trompe, tout ce qui est
    /// au-dessus se trompe sans rien dire.
    #[test]
    fn la_fft_dit_la_meme_chose_que_la_somme_directe() {
        let n = 32;
        let signal: Vec<f32> = (0..n)
            .map(|i| (2.0 * std::f32::consts::PI * 3.0 * i as f32 / n as f32).sin() + 0.5)
            .collect();

        let mut re = signal.clone();
        let mut im = vec![0.0f32; n];
        fft(&mut re, &mut im);

        for k in 0..n {
            let mut dr = 0.0f32;
            let mut di = 0.0f32;
            for (i, v) in signal.iter().enumerate() {
                let angle = -2.0 * std::f32::consts::PI * k as f32 * i as f32 / n as f32;
                dr += v * angle.cos();
                di += v * angle.sin();
            }
            assert!(
                (re[k] - dr).abs() < 1e-3 && (im[k] - di).abs() < 1e-3,
                "bin {} : FFT ({:.4}, {:.4}) contre somme directe ({:.4}, {:.4})",
                k,
                re[k],
                im[k],
                dr,
                di
            );
        }
    }
}
