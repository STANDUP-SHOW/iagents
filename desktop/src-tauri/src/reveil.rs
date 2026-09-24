//! Le mot de réveil : ce que l'écoute fait de ce qu'elle entend.
//!
//! Demande de max, 24/09/2026 : « l'application est toujours à l'écoute
//! d'instructions mais doit être dérangée par un seul mot. Si des gens
//! discutent dans la pièce, elle ne doit pas s'activer, mais si elle entend
//! "Voice" elle s'active immédiatement et attend le nom de l'agent, ensuite il
//! dit Robert et Robert répond. » Prononciation anglaise : « voyss ».
//!
//! Ce qu'il y avait avant : rien. L'écran prenait le PREMIER MOT de tout ce qui
//! était transcrit pour un prénom d'agent (`detectAgent`, ConversationEngine),
//! et répondait s'il ressemblait à celui d'un agent embauché — à une lettre
//! près. Deux personnes qui parlaient dans la pièce faisaient donc répondre un
//! agent dès que l'une commençait une phrase par un mot proche de « Carla » ou
//! de « Marie ». C'est exactement ce que max demande d'empêcher.
//!
//! La décision est ici, pure et sans micro : elle se rejoue sur du texte, ce
//! qui est le seul moyen d'en éprouver les cas limites. L'audio reste dans
//! `voice.rs`.

/// Ce que l'écoute est en train de faire.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Etat {
    /// Elle entend tout et ne répond à rien. C'est l'état normal, et celui où
    /// l'on revient : une pièce où l'on discute ne doit rien déclencher.
    Dormante,
    /// Le mot de réveil a été entendu. Elle attend le prénom d'un agent.
    Eveillee,
}

/// Ce que l'écoute vient de conclure, à rendre à l'écran.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "quoi", rename_all = "kebab-case")]
pub enum Reaction {
    /// Rien de tout ça ne nous était adressé.
    Rien,
    /// Le mot de réveil a été entendu, seul : on attend le prénom.
    Reveillee,
    /// Un agent est appelé. `demande` est ce qui suivait son prénom, vide quand
    /// le client s'est arrêté après l'avoir nommé.
    Appel { prenom: String, demande: String },
    /// Réveillée, mais ce qui suit ne nomme aucun agent embauché. On se
    /// rendort : mieux vaut ne rien faire que faire répondre le mauvais agent.
    AucunAgentDeCeNom { entendu: String },
}

/// Les formes sous lesquelles le mot de réveil peut ressortir de l'écoute.
///
/// **Relevé nulle part : ce sont des formes attendues, pas constatées.** Le
/// modèle d'écoute transcrit du français, et « Voice » se prononce à l'anglaise ;
/// ce qu'il en écrit vraiment ne se saura qu'au micro, sur une vraie machine.
/// Écrire une seule forme exacte reviendrait à parier que le modèle écrit
/// « voice » et jamais « voix », ce qui est le pari le moins probable des deux.
/// **À confirmer et à réduire dès le premier essai réel** — chaque forme en
/// trop est un réveil de plus pour rien.
const MOTS_DE_REVEIL: [&str; 6] = ["voice", "voix", "vois", "voyce", "voisse", "vosse"];

/// Sans accents, sans ponctuation, en minuscules : « Voice, » et « voïce » sont
/// le même mot pour qui l'a prononcé.
fn nu(mot: &str) -> String {
    mot.chars()
        .filter_map(|c| match c {
            'à' | 'â' | 'ä' => Some('a'),
            'é' | 'è' | 'ê' | 'ë' => Some('e'),
            'î' | 'ï' => Some('i'),
            'ô' | 'ö' => Some('o'),
            'ù' | 'û' | 'ü' => Some('u'),
            'ç' => Some('c'),
            c if c.is_alphanumeric() => Some(c.to_ascii_lowercase()),
            _ => None,
        })
        .collect()
}

/// Le mot de réveil doit OUVRIR ce qui a été entendu, pas y figurer.
///
/// C'est ce qui sépare « Voice Robert » d'une conversation où quelqu'un parle de
/// la voix d'un agent : « voix » est un mot français courant, et le produit
/// s'appelle presque comme lui. Exiger qu'il ouvre la phrase coûte au client une
/// contrainte qu'il a lui-même décrite (« Voice Robert ! »), et écarte tout le
/// reste.
///
/// Un faux réveil qui suit reste sans conséquence : réveillée, l'écoute attend un
/// prénom, et si le mot suivant n'en est pas un elle se rendort sans rien faire.
/// Ce qu'il faut empêcher n'est pas le réveil pour rien, c'est la RÉPONSE pour
/// rien, et celle-là demande deux coïncidences de suite.
fn commence_par_le_reveil(mots: &[String]) -> bool {
    mots.first().is_some_and(|m| MOTS_DE_REVEIL.contains(&m.as_str()))
}

/// Distance d'édition entre deux mots : combien de lettres il faut changer,
/// ajouter ou retirer pour passer de l'un à l'autre.
fn distance(a: &str, b: &str) -> usize {
    let a: Vec<char> = a.chars().collect();
    let b: Vec<char> = b.chars().collect();
    let mut ligne: Vec<usize> = (0..=a.len()).collect();
    for (j, cb) in b.iter().enumerate() {
        let mut precedent = ligne[0];
        ligne[0] = j + 1;
        for (i, ca) in a.iter().enumerate() {
            let cout = usize::from(ca != cb);
            let remplace = precedent + cout;
            precedent = ligne[i + 1];
            ligne[i + 1] = remplace.min(ligne[i] + 1).min(ligne[i + 1] + 1);
        }
    }
    ligne[a.len()]
}

/// Le prénom entendu, s'il nomme un agent embauché sur ce poste.
///
/// Une lettre de travers est tolérée sur un prénom un peu long, pas sur un
/// court où elle en désigne souvent un autre. C'est la règle que portait
/// `detectAgent` côté écran, reprise ici quand cette fonction a cessé d'être
/// appelée : le mot de réveil règle les faux déclenchements, il ne règle PAS le
/// prénom mal transcrit. « Robaire » pour Robert reste une transcription
/// plausible, et exiger l'exactitude aurait fait taire l'agent sans rien dire.
///
/// Deux prénoms aussi proches l'un que l'autre ne départagent rien : on préfère
/// le silence au mauvais agent. Un prénom exact l'emporte toujours sur son
/// voisin approximatif.
fn agent_nomme(mot: &str, prenoms: &[String]) -> Option<String> {
    if let Some(exact) = prenoms.iter().find(|p| nu(p) == mot) {
        return Some(exact.clone());
    }
    let proches: Vec<&String> = prenoms
        .iter()
        .filter(|p| {
            let nu_p = nu(p);
            let tolerance = usize::from(nu_p.chars().count() >= 5);
            tolerance > 0 && distance(mot, &nu_p) <= tolerance
        })
        .collect();
    match proches.as_slice() {
        [seul] => Some((*seul).clone()),
        _ => None,
    }
}

/// Ce que l'écoute conclut de ce qu'elle vient d'entendre.
///
/// Rend le nouvel état et ce qu'il faut en faire. Deux chemins mènent à un
/// appel, parce que le client fait les deux : « Voice Robert ! » d'un trait, ou
/// « Voice » puis, l'application ayant répondu qu'elle écoute, « Robert ».
pub fn entendu(etat: &Etat, texte: &str, prenoms: &[String]) -> (Etat, Reaction) {
    let mots: Vec<String> = texte.split_whitespace().map(nu).filter(|m| !m.is_empty()).collect();
    if mots.is_empty() {
        return (etat.clone(), Reaction::Rien);
    }

    match etat {
        Etat::Dormante => {
            if !commence_par_le_reveil(&mots) {
                // Le cas de loin le plus fréquent : on entend la pièce, et on
                // n'en fait rien.
                return (Etat::Dormante, Reaction::Rien);
            }
            match mots.get(1) {
                // « Voice Robert, prépare le point du matin » : tout d'un trait.
                Some(suivant) => match agent_nomme(suivant, prenoms) {
                    Some(prenom) => (
                        Etat::Dormante,
                        Reaction::Appel { prenom, demande: mots[2..].join(" ") },
                    ),
                    None => (
                        Etat::Dormante,
                        Reaction::AucunAgentDeCeNom { entendu: suivant.clone() },
                    ),
                },
                // « Voice » seul : on attend le prénom.
                None => (Etat::Eveillee, Reaction::Reveillee),
            }
        }
        Etat::Eveillee => match agent_nomme(&mots[0], prenoms) {
            Some(prenom) => (
                // On se rendort aussitôt : le réveil ne couvre qu'un échange.
                // C'est la lecture stricte de ce que max a décrit, et la seule
                // qui tienne sa règle — réveillée en permanence, l'écoute
                // reprendrait tout ce qui se dit dans la pièce.
                Etat::Dormante,
                Reaction::Appel { prenom, demande: mots[1..].join(" ") },
            ),
            None => (Etat::Dormante, Reaction::AucunAgentDeCeNom { entendu: mots[0].clone() }),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn maison() -> Vec<String> {
        ["Robert", "Carla", "Marie"].iter().map(|p| p.to_string()).collect()
    }

    #[test]
    fn une_conversation_dans_la_piece_ne_reveille_rien() {
        // La règle de max, et celle que le code ne tenait pas du tout : l'écran
        // prenait le premier mot venu pour un prénom.
        for dit in [
            "tu as vu le devis de mardi",
            "Robert tu viens manger",
            "Marie a dit qu'elle passait",
            "il faudrait relancer le client",
        ] {
            let (etat, reaction) = entendu(&Etat::Dormante, dit, &maison());
            assert_eq!(reaction, Reaction::Rien, "« {} » a réveillé l'écoute", dit);
            assert_eq!(etat, Etat::Dormante);
        }
    }

    #[test]
    fn le_mot_de_reveil_suivi_du_prenom_appelle_l_agent() {
        let (etat, reaction) = entendu(&Etat::Dormante, "Voice Robert !", &maison());
        assert_eq!(
            reaction,
            Reaction::Appel { prenom: "Robert".into(), demande: String::new() }
        );
        // L'échange est ouvert : on n'est pas resté éveillé pour la pièce.
        assert_eq!(etat, Etat::Dormante);
    }

    #[test]
    fn la_demande_qui_suit_le_prenom_est_gardee() {
        let (_, reaction) = entendu(&Etat::Dormante, "Voice Carla prepare le point du matin", &maison());
        assert_eq!(
            reaction,
            Reaction::Appel { prenom: "Carla".into(), demande: "prepare le point du matin".into() }
        );
    }

    #[test]
    fn le_mot_de_reveil_seul_fait_attendre_le_prenom() {
        let (etat, reaction) = entendu(&Etat::Dormante, "Voice", &maison());
        assert_eq!(reaction, Reaction::Reveillee);
        assert_eq!(etat, Etat::Eveillee);

        let (apres, suite) = entendu(&etat, "Robert", &maison());
        assert_eq!(suite, Reaction::Appel { prenom: "Robert".into(), demande: String::new() });
        assert_eq!(apres, Etat::Dormante);
    }

    #[test]
    fn reveillee_sans_prenom_connu_on_se_rendort() {
        // Mieux vaut ne rien faire que faire répondre le mauvais agent.
        let (etat, reaction) = entendu(&Etat::Eveillee, "passe-moi le sel", &maison());
        assert_eq!(etat, Etat::Dormante);
        assert!(matches!(reaction, Reaction::AucunAgentDeCeNom { .. }));
    }

    #[test]
    fn le_mot_de_reveil_doit_ouvrir_la_phrase() {
        // « voix » est un mot français courant et le produit s'appelle presque
        // comme lui : le laisser réveiller depuis le milieu d'une phrase
        // rendrait la règle de max inapplicable.
        let (etat, reaction) = entendu(&Etat::Dormante, "je trouve que la voix de Carla est trop lente", &maison());
        assert_eq!(reaction, Reaction::Rien);
        assert_eq!(etat, Etat::Dormante);
    }

    #[test]
    fn la_ponctuation_les_accents_et_la_casse_ne_changent_rien() {
        for dit in ["VOICE, Robert.", "voice   robert", "Voïce Robert !"] {
            let (_, reaction) = entendu(&Etat::Dormante, dit, &maison());
            assert_eq!(
                reaction,
                Reaction::Appel { prenom: "Robert".into(), demande: String::new() },
                "« {} »",
                dit
            );
        }
    }

    #[test]
    fn un_prenom_a_une_lettre_pres_repond_quand_meme() {
        // Le mot de réveil règle les faux déclenchements, pas le prénom mal
        // transcrit : « Robaire » pour Robert reste plausible au micro, et
        // exiger l'exactitude aurait fait taire l'agent sans rien dire.
        let (_, reaction) = entendu(&Etat::Dormante, "Voice Robart", &maison());
        assert_eq!(
            reaction,
            Reaction::Appel { prenom: "Robert".into(), demande: String::new() }
        );
    }

    #[test]
    fn entre_deux_prenoms_aussi_proches_personne_ne_repond() {
        // Mieux vaut le silence que le mauvais agent.
        let deux: Vec<String> = ["Carla", "Carlo"].iter().map(|p| p.to_string()).collect();
        let (_, reaction) = entendu(&Etat::Dormante, "Voice Carlx", &deux);
        assert!(matches!(reaction, Reaction::AucunAgentDeCeNom { .. }));
        // Mais un prénom exact l'emporte toujours sur son voisin.
        let (_, exact) = entendu(&Etat::Dormante, "Voice Carlo", &deux);
        assert_eq!(
            exact,
            Reaction::Appel { prenom: "Carlo".into(), demande: String::new() }
        );
    }

    #[test]
    fn sur_un_prenom_court_une_lettre_de_travers_en_designe_un_autre() {
        // « Luc » et « Lea » ne sont qu'a deux lettres l'un de l'autre : tolerer
        // sur trois lettres ferait repondre n'importe qui.
        let courts: Vec<String> = ["Luc", "Lea"].iter().map(|p| p.to_string()).collect();
        let (_, reaction) = entendu(&Etat::Dormante, "Voice Lud", &courts);
        assert!(matches!(reaction, Reaction::AucunAgentDeCeNom { .. }));
    }

    #[test]
    fn un_prenom_qui_n_est_pas_embauche_ne_repond_pas() {
        let (etat, reaction) = entendu(&Etat::Dormante, "Voice Jacques", &maison());
        assert_eq!(etat, Etat::Dormante);
        assert_eq!(
            reaction,
            Reaction::AucunAgentDeCeNom { entendu: "jacques".into() }
        );
    }

    #[test]
    fn un_silence_ne_change_pas_l_etat() {
        // L'écoute rend des transcriptions vides : elles ne doivent ni réveiller
        // ni rendormir, sinon un blanc dans la phrase perdrait le réveil.
        for etat in [Etat::Dormante, Etat::Eveillee] {
            let (apres, reaction) = entendu(&etat, "   ", &maison());
            assert_eq!(apres, etat);
            assert_eq!(reaction, Reaction::Rien);
        }
    }

    #[test]
    fn la_reaction_arrive_a_l_ecran_sous_les_noms_qu_il_lit() {
        // Le piège du dépôt : une structure Rust traverse avec SES noms, et
        // l'écran qui lit autre chose ne fait échouer ni le compilateur ni
        // l'exécution — il rend `undefined`, et le mot de réveil ne ferait
        // simplement jamais rien. Ce test fige la forme exacte du JSON.
        let json = |r: &Reaction| serde_json::to_string(r).unwrap();
        assert_eq!(json(&Reaction::Rien), r#"{"quoi":"rien"}"#);
        assert_eq!(json(&Reaction::Reveillee), r#"{"quoi":"reveillee"}"#);
        assert_eq!(
            json(&Reaction::Appel { prenom: "Robert".into(), demande: "bonjour".into() }),
            r#"{"quoi":"appel","prenom":"Robert","demande":"bonjour"}"#
        );
        assert_eq!(
            json(&Reaction::AucunAgentDeCeNom { entendu: "jacques".into() }),
            r#"{"quoi":"aucun-agent-de-ce-nom","entendu":"jacques"}"#
        );
        assert_eq!(serde_json::to_string(&Etat::Dormante).unwrap(), r#""dormante""#);
        assert_eq!(serde_json::to_string(&Etat::Eveillee).unwrap(), r#""eveillee""#);
    }

    #[test]
    fn sans_agent_embauche_rien_ne_repond() {
        let (etat, reaction) = entendu(&Etat::Dormante, "Voice Robert", &[]);
        assert_eq!(etat, Etat::Dormante);
        assert!(matches!(reaction, Reaction::AucunAgentDeCeNom { .. }));
    }
}
