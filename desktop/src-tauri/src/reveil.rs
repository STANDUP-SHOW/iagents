//! L'appel d'un agent : ce que l'écoute fait de ce qu'elle entend.
//!
//! **Décision de max, 12/10/2026** : « Je voulais que l'utilisateur dise
//! simplement Victor et que Victor réponde. […] Pas besoin de voice, voice est
//! notre système. On appelle l'agent par son prénom, on l'humanise. C'est notre
//! différence avec Google, Alexa, etc. » Le mot « Voice » qu'exigeait la règle
//! du 24/09 n'est donc plus demandé : le prénom d'un agent embauché, quand il
//! OUVRE une phrase, est l'appel. Un prénom cité au milieu d'une phrase
//! (« je trouve que Victor est lent ») n'appelle personne.
//!
//! Après un appel, la conversation reste ouverte : le client relance sans
//! renommer l'agent, comme il le ferait avec quelqu'un. Elle se ferme quand il
//! prend congé, quand il appelle un autre agent (qui prend la suite), ou au
//! bout d'un silence que `main.rs` mesure — la décision reste ici, pure et sans
//! micro, parce qu'elle se rejoue sur du texte.

/// Ce que l'écoute est en train de faire.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Etat {
    /// Elle entend tout et ne répond qu'au prénom d'un agent qui ouvre une
    /// phrase. C'est l'état normal, et celui où l'on revient.
    Dormante,
    /// Un agent vient d'être appelé : ce qui se dit ensuite lui est adressé,
    /// sans qu'il faille le renommer.
    EnConversation { prenom: String },
}

impl Etat {
    /// Le nom sous lequel l'écran lit l'état (`ou_en_est`).
    pub fn nom(&self) -> &'static str {
        match self {
            Etat::Dormante => "dormante",
            Etat::EnConversation { .. } => "en-conversation",
        }
    }
    /// L'agent avec qui la conversation est ouverte.
    pub fn avec(&self) -> Option<String> {
        match self {
            Etat::Dormante => None,
            Etat::EnConversation { prenom } => Some(prenom.clone()),
        }
    }
}

/// Ce que l'écoute vient de conclure, à rendre à l'écran.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(tag = "quoi", rename_all = "kebab-case")]
pub enum Reaction {
    /// Rien de tout ça ne nous était adressé.
    Rien,
    /// Un agent est appelé. `demande` est ce qui suivait son prénom, vide quand
    /// le client s'est arrêté après l'avoir nommé ; dans une conversation
    /// ouverte, c'est toute la phrase.
    Appel { prenom: String, demande: String },
    /// Le client a pris congé de l'agent : la conversation se ferme.
    Conge { prenom: String },
}

/// Ce qui peut précéder le prénom sans que l'appel cesse d'en être un :
/// « Dis Victor », « Bonjour Nora », « Hé Camille ». « voice » et « voix »
/// restent lus pour qui a pris l'habitude de les dire, sans être demandés.
const AVANT_LE_PRENOM: [&str; 16] = [
    "voice", "voix", "he", "eh", "hey", "dis", "bonjour", "salut", "coucou", "allo", "ok", "oui", "alors",
    "bon", "et", "ecoute",
];

/// Ce qui ferme une conversation, quand c'est toute la phrase.
const CONGES: [&str; 9] = [
    "au revoir",
    "merci cest tout",
    "cest tout",
    "cest tout merci",
    "merci ca ira",
    "ca ira merci",
    "laisse tomber",
    "stop",
    "a plus tard",
];

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
/// appelée : l'appel par le prénom ne doit pas taire l'agent dont le prénom est
/// mal transcrit. « Robaire » pour Robert reste une transcription
/// plausible, et exiger l'exactitude aurait fait taire l'agent sans rien dire.
///
/// Deux prénoms aussi proches l'un que l'autre ne départagent rien : on préfère
/// le silence au mauvais agent. Un prénom exact l'emporte toujours sur son
/// voisin approximatif.
fn agent_nomme(mot: &str, prenoms: &[String]) -> Option<String> {
    if let Some(exact) = prenoms.iter().find(|p| nu(p) == mot) {
        return Some(exact.clone());
    }
    let entendu = a_l_oreille(mot);
    if let [seul] = prenoms.iter().filter(|p| a_l_oreille(p) == entendu).collect::<Vec<_>>().as_slice() {
        return Some((*seul).clone());
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

/// What was heard minus Whisper's annotations of non-speech: anything between
/// parentheses, brackets, asterisks or music notes.
fn sans_annotations(texte: &str) -> String {
    let mut sortie = String::with_capacity(texte.len());
    let mut fermeture: Option<char> = None;
    for c in texte.chars() {
        match fermeture {
            Some(f) if c == f => {
                fermeture = None;
                sortie.push(' ');
            }
            Some(_) => {}
            None => match c {
                '(' => fermeture = Some(')'),
                '[' => fermeture = Some(']'),
                '*' => fermeture = Some('*'),
                // Sung words come back between notes: a song, not a call.
                '♪' => fermeture = Some('♪'),
                '♫' => fermeture = Some('♫'),
                _ => sortie.push(c),
            },
        }
    }
    sortie
}


/// A spoken first name, folded the way the listening engine mangles it:
/// « Victoire » for Victor, « Ugo » for Hugo, « Norah » for Nora. Silent
/// letters go (a leading h, a trailing e, s, x, t or d, an h after a vowel),
/// « oi » sounds like « o » before an r, « ph » is « f », « y » is « i », and
/// doubled letters count once.
fn a_l_oreille(mot: &str) -> String {
    let mut m = nu(mot).replace("ph", "f").replace("oir", "or").replace('y', "i");
    if m.len() > 2 && m.starts_with('h') {
        m.remove(0);
    }
    let mut sans_double = String::with_capacity(m.len());
    for c in m.chars() {
        if sans_double.ends_with(c) {
            continue;
        }
        if c == 'h' && sans_double.ends_with(['a', 'e', 'i', 'o', 'u']) {
            continue;
        }
        sans_double.push(c);
    }
    let mut m = sans_double;
    while m.chars().count() > 3 && m.ends_with(['e', 's', 'x', 't', 'd']) {
        m.pop();
    }
    m
}

/// Where each sentence of what was heard starts, as indexes into `mots`.
/// A whole utterance can hold the tail of something else before the call
/// (« Merci. Victor, où en es-tu ? »), and the call opens its own sentence.
fn debuts_de_phrase(dits: &[&str]) -> Vec<usize> {
    let mut debuts = vec![0];
    for (i, m) in dits.iter().enumerate() {
        if i + 1 < dits.len() && m.trim_end_matches(['»', '"', ')']).ends_with(['.', '!', '?', '…']) {
            debuts.push(i + 1);
        }
    }
    debuts
}

/// Ce que l'écoute conclut de ce qu'elle vient d'entendre.
///
/// Rend le nouvel état et ce qu'il faut en faire. Le prénom d'un agent
/// embauché qui ouvre une phrase l'appelle, et ouvre la conversation avec lui.
pub fn entendu(etat: &Etat, texte: &str, prenoms: &[String]) -> (Etat, Reaction) {
    // Whisper writes what it hears that is not speech as annotations:
    // « (Voix de la porte) », « [Musique] », « *sifflement* », « ♪ … ♪ ».
    // Seen on max's PC on 12/10/2026 with music on. None of it was said to an
    // agent, so none of it is read.
    let propre = sans_annotations(texte);
    let texte = propre.as_str();
    // Two views of the same words: the bare form to recognise a first name,
    // the words as said to pass on to the agent. Handing the bare form on
    // turned « Présente-toi en deux phrases. » into « presentetoi en deux
    // phrases » in the model's prompt.
    let dits: Vec<&str> = texte.split_whitespace().filter(|m| !nu(m).is_empty()).collect();
    let mots: Vec<String> = dits.iter().map(|m| nu(m)).collect();
    let demande = |depuis: usize| match dits.get(depuis) {
        Some(m) => texte[m.as_ptr() as usize - texte.as_ptr() as usize..].trim_end().to_string(),
        None => String::new(),
    };
    if mots.is_empty() {
        return (etat.clone(), Reaction::Rien);
    }

    // A call: a sentence that opens on a hired agent's first name, after at
    // most two of the words people say before one (« Dis, Victor »).
    let appel = debuts_de_phrase(&dits).into_iter().find_map(|debut| {
        (debut..mots.len()).take(3).find_map(|i| {
            if let Some(prenom) = agent_nomme(&mots[i], prenoms) {
                return Some((prenom, i));
            }
            if AVANT_LE_PRENOM.contains(&mots[i].as_str()) {
                None
            } else {
                // Any other word first: this sentence is not a call.
                Some((String::new(), usize::MAX))
            }
        })
        .filter(|(p, _)| !p.is_empty())
    });
    if let Some((prenom, i)) = appel {
        return (
            Etat::EnConversation { prenom: prenom.clone() },
            Reaction::Appel { prenom, demande: demande(i + 1) },
        );
    }

    match etat {
        // Le cas de loin le plus fréquent : on entend la pièce, et on n'en
        // fait rien.
        Etat::Dormante => (Etat::Dormante, Reaction::Rien),
        Etat::EnConversation { prenom } => {
            if CONGES.contains(&mots.join(" ").as_str()) {
                return (Etat::Dormante, Reaction::Conge { prenom: prenom.clone() });
            }
            (
                etat.clone(),
                Reaction::Appel { prenom: prenom.clone(), demande: demande(0) },
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn maison() -> Vec<String> {
        ["Robert", "Carla", "Marie", "Victor", "Hugo", "Nora"].iter().map(|p| p.to_string()).collect()
    }

    fn appel(prenom: &str, demande: &str) -> Reaction {
        Reaction::Appel { prenom: prenom.into(), demande: demande.into() }
    }

    fn avec(prenom: &str) -> Etat {
        Etat::EnConversation { prenom: prenom.into() }
    }

    #[test]
    fn le_prenom_seul_appelle_l_agent() {
        // La décision de max du 12/10/2026 : « Victor », et Victor répond.
        let (etat, reaction) = entendu(&Etat::Dormante, "Victor, bonjour !", &maison());
        assert_eq!(reaction, appel("Victor", "bonjour !"));
        assert_eq!(etat, avec("Victor"));
        let (_, seul) = entendu(&Etat::Dormante, "Victor ?", &maison());
        assert_eq!(seul, appel("Victor", ""));
    }

    #[test]
    fn une_conversation_dans_la_piece_ne_reveille_rien() {
        for dit in [
            "tu as vu le devis de mardi",
            "je trouve que Victor est un peu lent",
            "il faudrait demander à Carla",
            "la voix de Marie est trop douce",
        ] {
            let (etat, reaction) = entendu(&Etat::Dormante, dit, &maison());
            assert_eq!((etat, reaction), (Etat::Dormante, Reaction::Rien), "« {} »", dit);
        }
    }

    #[test]
    fn la_demande_garde_ses_accents_et_sa_ponctuation() {
        // Seen on max's PC on 11/10/2026: the agent received the bare form.
        let (_, reaction) = entendu(&Etat::Dormante, "Robert, Présente-toi en deux phrases.", &maison());
        assert_eq!(reaction, appel("Robert", "Présente-toi en deux phrases."));
        let (_, suite) = entendu(&Etat::Dormante, "Carla : où en es-tu ?", &maison());
        assert_eq!(suite, appel("Carla", "où en es-tu ?"));
    }

    #[test]
    fn ce_qu_on_dit_avant_un_prenom_ne_l_empeche_pas_d_appeler() {
        for (dit, demande) in [
            ("Dis Victor, où en est le dossier ?", "où en est le dossier ?"),
            ("Bonjour Nora", ""),
            ("Hé, Hugo, tu es là ?", "tu es là ?"),
            // L'ancienne habitude reste comprise, sans être demandée.
            ("Voice, Victor, bonjour", "bonjour"),
        ] {
            let (_, reaction) = entendu(&Etat::Dormante, dit, &maison());
            assert!(
                matches!(&reaction, Reaction::Appel { demande: d, .. } if d == demande),
                "« {dit} » : {reaction:?}"
            );
        }
    }

    #[test]
    fn l_appel_peut_ouvrir_une_seconde_phrase() {
        // What the listening hands back can start with the tail of something
        // else, or a word invented on silence (« Merci. »).
        let (etat, reaction) = entendu(&Etat::Dormante, "Merci. Robert, où en es-tu ?", &maison());
        assert_eq!(reaction, appel("Robert", "où en es-tu ?"));
        assert_eq!(etat, avec("Robert"));
    }

    #[test]
    fn un_prenom_mal_transcrit_appelle_quand_meme() {
        // What the listening engine makes of the names, heard on max's PC
        // (« Victoire ») or plausible (« Ugo », « Norah », « Robart »).
        for (dit, prenom) in [
            ("Victoire, bonjour", "Victor"),
            ("Ugo, tu m'entends ?", "Hugo"),
            ("Norah, c'est moi", "Nora"),
            ("Robart, la note", "Robert"),
        ] {
            let (_, reaction) = entendu(&Etat::Dormante, dit, &maison());
            assert!(matches!(&reaction, Reaction::Appel { prenom: p, .. } if p == prenom), "« {dit} » : {reaction:?}");
        }
    }

    #[test]
    fn entre_deux_prenoms_aussi_proches_personne_ne_repond() {
        // Mieux vaut le silence que le mauvais agent.
        let deux: Vec<String> = ["Carla", "Carlo"].iter().map(|p| p.to_string()).collect();
        let (_, reaction) = entendu(&Etat::Dormante, "Carlx, bonjour", &deux);
        assert_eq!(reaction, Reaction::Rien);
        // Mais un prénom exact l'emporte toujours sur son voisin.
        let (_, exact) = entendu(&Etat::Dormante, "Carlo, bonjour", &deux);
        assert_eq!(exact, appel("Carlo", "bonjour"));
    }

    #[test]
    fn sur_un_prenom_court_une_lettre_de_travers_en_designe_un_autre() {
        let courts: Vec<String> = ["Luc", "Lea"].iter().map(|p| p.to_string()).collect();
        let (_, reaction) = entendu(&Etat::Dormante, "Lud, viens", &courts);
        assert_eq!(reaction, Reaction::Rien);
    }

    #[test]
    fn la_conversation_reste_ouverte_sans_renommer_l_agent() {
        // Seen on max's PC, 12/10/2026: his follow-up without the name was
        // ignored. Talking to someone, you do not repeat their name.
        let (etat, _) = entendu(&Etat::Dormante, "Victor, qu'as-tu fait aujourd'hui ?", &maison());
        let (etat, reaction) = entendu(&etat, "Est-ce que tu me comprends bien quand je parle ?", &maison());
        assert_eq!(reaction, appel("Victor", "Est-ce que tu me comprends bien quand je parle ?"));
        assert_eq!(etat, avec("Victor"));
    }

    #[test]
    fn appeler_un_autre_agent_lui_passe_la_conversation() {
        let (etat, reaction) = entendu(&avec("Victor"), "Hugo, tu as la note ?", &maison());
        assert_eq!(reaction, appel("Hugo", "tu as la note ?"));
        assert_eq!(etat, avec("Hugo"));
    }

    #[test]
    fn prendre_conge_ferme_la_conversation() {
        for dit in ["Merci, c'est tout.", "Au revoir !", "Laisse tomber"] {
            let (etat, reaction) = entendu(&avec("Victor"), dit, &maison());
            assert_eq!(etat, Etat::Dormante, "« {dit} »");
            assert_eq!(reaction, Reaction::Conge { prenom: "Victor".into() });
        }
        // « Merci » seul est une réponse, pas un congé : l'agent l'entend.
        let (etat, _) = entendu(&avec("Victor"), "Merci", &maison());
        assert_eq!(etat, avec("Victor"));
    }

    #[test]
    fn un_silence_ne_change_pas_l_etat() {
        for etat in [Etat::Dormante, avec("Victor")] {
            let (apres, reaction) = entendu(&etat, "   ", &maison());
            assert_eq!(apres, etat);
            assert_eq!(reaction, Reaction::Rien);
        }
    }

    #[test]
    fn la_reaction_arrive_a_l_ecran_sous_les_noms_qu_il_lit() {
        // Le piège du dépôt : une structure Rust traverse avec SES noms, et
        // l'écran qui lit autre chose rend `undefined` sans une erreur.
        let json = |r: &Reaction| serde_json::to_string(r).unwrap();
        assert_eq!(json(&Reaction::Rien), r#"{"quoi":"rien"}"#);
        assert_eq!(
            json(&appel("Robert", "bonjour")),
            r#"{"quoi":"appel","prenom":"Robert","demande":"bonjour"}"#
        );
        assert_eq!(json(&Reaction::Conge { prenom: "Robert".into() }), r#"{"quoi":"conge","prenom":"Robert"}"#);
        assert_eq!(Etat::Dormante.nom(), "dormante");
        assert_eq!(avec("Robert").nom(), "en-conversation");
    }

    #[test]
    fn sans_agent_embauche_rien_ne_repond() {
        let (etat, reaction) = entendu(&Etat::Dormante, "Robert, bonjour", &[]);
        assert_eq!((etat, reaction), (Etat::Dormante, Reaction::Rien));
    }

    #[test]
    fn les_bruits_notes_par_l_ecoute_ne_reveillent_rien() {
        // Heard on max's PC, 12/10/2026, music playing or silence.
        for dit in ["(Voix de la porte)", "[Musique]", "*musique*", "♪ Victor of the night ♪", "..."] {
            let (etat, reaction) = entendu(&Etat::Dormante, dit, &maison());
            assert_eq!((etat, reaction), (Etat::Dormante, Reaction::Rien), "{dit}");
            // Nor do they reach an agent in an open conversation.
            let (_, reaction) = entendu(&avec("Victor"), dit, &maison());
            assert_eq!(reaction, Reaction::Rien, "{dit}");
        }
        // An annotation around a real call does not hide it.
        let (_, reaction) = entendu(&Etat::Dormante, "[Musique] Robert, bonjour", &maison());
        assert_eq!(reaction, appel("Robert", "bonjour"));
    }
}
