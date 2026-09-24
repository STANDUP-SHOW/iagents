use std::path::PathBuf;

/// Les fiches et la configuration d'installation vivent à côté de l'exécutable.
/// Rust ne fait que les lire : l'assemblage (planning du client, prénom, sexe,
/// dossiers) reste en TypeScript, où il est testé. Dupliquer cette logique ici
/// la ferait diverger.
pub fn dossier_ressources() -> PathBuf {
    // En développement, l'exécutable est dans target/debug et l'installeur n'a
    // rien copié à côté : sans cette échappatoire, l'entretien d'embauche ne
    // trouverait aucun référentiel tant que l'application n'est pas installée.
    // Même convention que `voice.rs` pour Piper et les modèles.
    if let Some(v) = std::env::var_os("IAGENT_RESSOURCES") {
        return PathBuf::from(v);
    }
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(std::path::Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

#[tauri::command]
pub fn lire_installation() -> Result<String, String> {
    let chemin = dossier_ressources().join("config/installation.json");
    std::fs::read_to_string(&chemin)
        .map_err(|e| format!("lecture de {} : {}", chemin.display(), e))
}

/// L'identifiant vient de l'interface : sans ce contrôle, un « ../../ » ferait
/// lire n'importe quel fichier du poste.
fn identifiant_valide(id: &str) -> bool {
    let mut parties = id.splitn(2, '-');
    matches!(
        (parties.next(), parties.next()),
        (Some("AG"), Some(n))
            if n.len() == 4 && n.bytes().all(|b| b.is_ascii_digit())
    )
}

#[tauri::command]
pub fn lire_fiche(id: String) -> Result<String, String> {
    if !identifiant_valide(&id) {
        return Err(format!("identifiant de fiche invalide : {}", id));
    }

    let dossier = dossier_ressources().join("agents");
    let prefixe = format!("{}-", id);

    let entrees = std::fs::read_dir(&dossier)
        .map_err(|e| format!("lecture de {} : {}", dossier.display(), e))?;

    for entree in entrees.flatten() {
        let nom = entree.file_name();
        let nom = nom.to_string_lossy();
        if nom.starts_with(&prefixe) && nom.ends_with(".json") {
            let contenu = std::fs::read_to_string(entree.path())
                .map_err(|e| format!("lecture de {} : {}", nom, e))?;
            if let Some(raison) = version_insuffisante_pour(&contenu, version_app()) {
                return Err(raison);
            }
            return Ok(contenu);
        }
    }

    Err(format!("fiche {} absente du catalogue installé", id))
}


/// Contrôle ce que l'installation s'apprête à écrire, avant qu'elle l'écrive.
///
/// Rendue séparément de la commande pour être testée : c'est le seul endroit
/// qui empêche un prénom de sortir du dossier de configuration, et un banc qui
/// ne peut pas l'appeler ne prouve rien.
pub fn installation_recevable(contenu: &str) -> Result<(), String> {
    let json: serde_json::Value = serde_json::from_str(contenu)
        .map_err(|e| format!("installation illisible : {}", e))?;

    let agents = json
        .get("agents")
        .and_then(|a| a.as_array())
        .ok_or("installation sans liste d'agents")?;

    let mut prenoms_vus: Vec<String> = Vec::new();

    for agent in agents {
        let id = agent
            .get("ficheId")
            .and_then(|v| v.as_str())
            .ok_or("un agent installé sans identifiant de fiche")?;
        if !identifiant_valide(id) {
            return Err(format!("identifiant de fiche invalide : {}", id));
        }

        let prenom = agent
            .get("prenom")
            .and_then(|v| v.as_str())
            .ok_or("un agent installé sans prénom")?;
        // Le prénom sert à nommer le journal de l'agent (journal-<prenom>.json).
        // Un « ../ » qui passerait ici ferait écrire hors du dossier de config.
        if prenom.trim().is_empty() || prenom.chars().count() > 64 {
            return Err(format!("prénom d'agent invalide : {}", prenom));
        }
        if !prenom.chars().all(|c| c.is_alphanumeric() || c == '-' || c == ' ') {
            return Err(format!("prénom d'agent invalide : {}", prenom));
        }

        // Ce que le client règle tâche par tâche est un choix de sûreté :
        // `active` dit si elle part, `validationHumaine` si un humain relit.
        // Mal écrits, ils seraient ignorés en silence et le client croirait
        // avoir réglé quelque chose. « true » entre guillemets, 1 ou « oui »
        // sont refusés plutôt que devinés.
        let ajustements = agent
            .get("planning")
            .and_then(|p| p.get("ajustements"))
            .and_then(|a| a.as_array());
        for regle in ajustements.map(Vec::as_slice).unwrap_or(&[]) {
            let ou = regle
                .get("tacheId")
                .and_then(|v| v.as_str())
                .unwrap_or("une tâche sans identifiant");
            for champ in ["active", "validationHumaine"] {
                match regle.get(champ) {
                    None => {}
                    Some(v) if v.is_boolean() => {}
                    Some(v) => {
                        return Err(format!(
                            "« {} » de la tâche {} de {} doit être vrai ou faux, pas {} : le réglage serait ignoré sans que vous le sachiez",
                            champ, ou, prenom, v
                        ))
                    }
                }
            }
        }

        // Même raison qu'au-dessus, sur le réglage qui décide OÙ l'agent
        // calcule : mal écrit, `selon_le_client` ne le reconnaît pas et rend la
        // fiche telle quelle. Le client aurait demandé « tout sur ma machine »,
        // continuerait à payer des jetons, et rien ne le lui dirait. On refuse
        // plutôt que de deviner ce qu'il a voulu dire.
        if let Some(v) = agent.get("repartition") {
            // `selon_le_client` compare après un `trim` : on compare pareil,
            // sinon on refuserait ici ce que l'application sait lire.
            let dit = v.as_str().map(str::trim).unwrap_or("");
            let connus = [
                crate::modele::CLIENT_TOUT_LOCAL,
                crate::modele::CLIENT_MIXTE,
                crate::modele::CLIENT_TOUT_API,
            ];
            if !connus.contains(&dit) {
                let montre = match v.as_str() {
                    Some(s) => s.to_string(),
                    None => v.to_string(),
                };
                return Err(format!(
                    "« {} » n'est pas un choix de répartition pour {} : écrire « {} », « {} » ou « {} », sinon le réglage serait ignoré sans que vous le sachiez",
                    montre, prenom, connus[0], connus[1], connus[2]
                ));
            }
        }

        // Ce que le client a appris à l'agent pendant l'entretien. Le lecteur
        // (`savoirs`, dans `tache.rs`) rend la liste VIDE dès qu'une seule
        // entrée ne se lit pas : une compétence mal écrite ferait perdre tout
        // l'entretien d'un coup, sans un mot. Et une entrée sans titre ni
        // résumé, il l'écarte : le client aurait appris quelque chose à
        // personne. On refuse exactement ce que le lecteur perdrait.
        if let Some(v) = agent.get("competences") {
            let liste = v.as_array().ok_or_else(|| {
                format!(
                    "ce que vous avez appris à {} doit être une liste, sinon tout serait perdu d'un coup",
                    prenom
                )
            })?;
            for c in liste {
                if !c.is_object() {
                    return Err(format!(
                        "une compétence de {} n'est pas écrite avec un titre et un résumé : tout ce que vous lui avez appris serait perdu d'un coup",
                        prenom
                    ));
                }
                let mut texte = |cle: &str| -> Result<String, String> {
                    match c.get(cle) {
                        None => Ok(String::new()),
                        Some(x) => x.as_str().map(str::to_string).ok_or_else(|| {
                            format!(
                                "le {} d'une compétence de {} n'est pas du texte : tout ce que vous lui avez appris serait perdu d'un coup",
                                cle, prenom
                            )
                        }),
                    }
                };
                let titre = texte("titre")?;
                let resume = texte("resume")?;
                if titre.is_empty() && resume.is_empty() {
                    return Err(format!(
                        "une compétence de {} n'a ni titre ni résumé : elle serait écartée sans que vous le sachiez",
                        prenom
                    ));
                }
            }
        }

        let clef = prenom.trim().to_lowercase();
        if prenoms_vus.contains(&clef) {
            return Err(format!("deux agents portent le prénom {}", prenom));
        }
        prenoms_vus.push(clef);
    }

    Ok(())
}

/// Écrit la configuration d'installation.
///
/// L'écriture passe par un fichier temporaire puis un renommage : une coupure
/// au milieu d'un `write` laisserait un `installation.json` tronqué, et
/// l'application ne redémarrerait plus.
#[tauri::command]
pub fn installation_ecrire(contenu: String) -> Result<String, String> {
    installation_recevable(&contenu)?;

    let chemin = dossier_ressources().join("config").join("installation.json");
    if let Some(parent) = chemin.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("création de {} : {}", parent.display(), e))?;
    }

    let provisoire = chemin.with_extension("json.nouveau");
    std::fs::write(&provisoire, contenu.as_bytes())
        .map_err(|e| format!("écriture de {} : {}", provisoire.display(), e))?;
    std::fs::rename(&provisoire, &chemin)
        .map_err(|e| format!("remplacement de {} : {}", chemin.display(), e))?;

    Ok(chemin.display().to_string())
}


/// Les seuls catalogues que l'interface peut demander.
///
/// Sans cette liste, le nom viendrait de la vue et servirait à lire n'importe
/// quel fichier du poste. On ne « nettoie » pas un chemin reçu de l'extérieur :
/// on refuse tout ce qui n'est pas dans cette liste.
const CATALOGUES: [(&str, &str); 4] = [
    ("logiciels", "catalogue/logiciels.json"),
    ("activites", "catalogue/activites.json"),
    ("catalogue", "catalogue/catalogue.json"),
    ("connecteurs", "connecteurs/catalogue.json"),
];

/// Lit un des catalogues livrés avec l'application.
///
/// L'entretien d'embauche en a besoin pour reconnaître ce que le client nomme :
/// sans le référentiel des logiciels, l'agent ne sait pas que « Sage » demande
/// une précision, et sans celui des activités il ne parle pas avec les mots de
/// la branche. Ils sont embarqués par l'installeur (`bundle.resources`).
#[tauri::command]
pub fn lire_referentiel(nom: String) -> Result<String, String> {
    let relatif = CATALOGUES
        .iter()
        .find(|(cle, _)| *cle == nom)
        .map(|(_, chemin)| *chemin)
        .ok_or_else(|| format!("catalogue inconnu : {}", nom))?;

    let chemin = dossier_ressources().join(relatif);
    std::fs::read_to_string(&chemin).map_err(|e| {
        format!(
            "lecture de {} : {} — le catalogue n'a pas été installé avec l'application",
            chemin.display(),
            e
        )
    })
}

/// Rendu séparément pour être testé : la commande, elle, touche au disque.
pub fn catalogue_connu(nom: &str) -> bool {
    CATALOGUES.iter().any(|(cle, _)| *cle == nom)
}

#[cfg(test)]
mod tests {
    use super::{catalogue_connu, comparer_versions, identifiant_valide, installation_recevable, version_app, version_insuffisante_pour};

    #[test]
    fn un_reglage_mal_ecrit_est_refuse_a_l_ecriture() {
        // Accepté en silence, il ne ferait rien : le client croirait avoir
        // éteint une tâche, et elle partirait quand même.
        for champ in ["active", "validationHumaine"] {
            for mauvaise in [r#""true""#, "1", r#""oui""#, "null"] {
                let contenu = format!(
                    r#"{{"agents":[{{"prenom":"Marie","ficheId":"AG-0001","planning":{{"ajustements":[{{"tacheId":"avoirs","{}":{}}}]}}}}]}}"#,
                    champ, mauvaise
                );
                let r = installation_recevable(&contenu);
                assert!(r.is_err(), "« {} » = {} aurait dû être refusé", champ, mauvaise);
                let message = r.unwrap_err();
                assert!(
                    message.contains("Marie") && message.contains("avoirs") && message.contains(champ),
                    "le message doit nommer l'agent, la tâche et le champ : {}",
                    message
                );
            }
        }
    }

    #[test]
    fn un_reglage_bien_ecrit_passe_dans_les_deux_sens() {
        for valeur in ["true", "false"] {
            let contenu = format!(
                r#"{{"agents":[{{"prenom":"Marie","ficheId":"AG-0001","planning":{{"ajustements":[{{"tacheId":"avoirs","active":{},"validationHumaine":{}}}]}}}}]}}"#,
                valeur, valeur
            );
            assert!(installation_recevable(&contenu).is_ok(), "« {} » refusé à tort", valeur);
        }
        // Et sans planning du tout : c'est le cas de la plupart des agents.
        assert!(installation_recevable(r#"{"agents":[{"prenom":"Marie","ficheId":"AG-0001"}]}"#).is_ok());
    }

    /// Une installation d'un seul agent, avec le champ qu'on éprouve dedans.
    fn avec(champ: &str, valeur: &str) -> String {
        format!(
            r#"{{"agents":[{{"prenom":"Marie","ficheId":"AG-0001","{}":{}}}]}}"#,
            champ, valeur
        )
    }

    #[test]
    fn une_repartition_mal_ecrite_est_refusee() {
        // Le client a répondu à l'entretien où l'agent devait calculer. Écrit
        // autrement qu'avec le libellé de l'écran, `selon_le_client` ne le
        // reconnaît pas et rend la fiche telle quelle : le client croirait
        // tourner chez lui et paierait des jetons sans que rien ne le dise.
        for mauvaise in [
            r#""local""#,
            r#""Tout sur ma machine""#,
            r#""tout par api""#,
            r#""""#,
            "null",
            "3",
            r#"["Tout par API"]"#,
        ] {
            let r = installation_recevable(&avec("repartition", mauvaise));
            assert!(r.is_err(), "« {} » aurait dû être refusé", mauvaise);
            let message = r.unwrap_err();
            // Le message doit dire quoi écrire, pas seulement que c'est faux.
            assert!(
                message.contains("Marie")
                    && message.contains(crate::modele::CLIENT_TOUT_LOCAL)
                    && message.contains(crate::modele::CLIENT_MIXTE)
                    && message.contains(crate::modele::CLIENT_TOUT_API),
                "le message doit nommer l'agent et les trois réponses possibles : {}",
                message
            );
        }
    }

    #[test]
    fn les_trois_reponses_du_client_sur_la_repartition_passent() {
        for bonne in [
            crate::modele::CLIENT_TOUT_LOCAL,
            crate::modele::CLIENT_MIXTE,
            crate::modele::CLIENT_TOUT_API,
        ] {
            let contenu = avec("repartition", &format!(r#""{}""#, bonne));
            assert!(installation_recevable(&contenu).is_ok(), "« {} » refusé à tort", bonne);
            // Et ce qui passe ici doit être compris là-bas : le validateur ne
            // sert à rien s'il accepte un libellé que `selon_le_client` ignore.
            assert_eq!(
                crate::modele::repartition_du_client(&contenu, "Marie").as_deref(),
                Some(bonne)
            );
        }
        // `selon_le_client` compare après un `trim` : on accepte donc pareil.
        let espaces = avec("repartition", r#""  Tout par API  ""#);
        assert!(installation_recevable(&espaces).is_ok());
        // Et le cas ordinaire : le client n'a rien réglé, la fiche s'applique.
        assert!(installation_recevable(r#"{"agents":[{"prenom":"Marie","ficheId":"AG-0001"}]}"#).is_ok());
    }

    #[test]
    fn une_competence_mal_ecrite_est_refusee() {
        // Ce que le client a appris à l'agent pendant l'entretien. Le lecteur
        // rend la liste vide dès qu'une entrée ne se lit pas : une seule
        // compétence mal écrite ferait perdre tout l'entretien, sans un mot.
        for mauvaise in [
            r#""Nos devis""#,
            r#"[{"titre":3,"resume":"ils partent en PDF."}]"#,
            r#"[{"titre":"Nos devis","resume":null}]"#,
            r#"["Nos devis"]"#,
            r#"[{}]"#,
            r#"[{"titre":"","resume":""}]"#,
            r#"[{"titre":"Nos devis","resume":"ils partent en PDF."},{"titre":[]}]"#,
        ] {
            let r = installation_recevable(&avec("competences", mauvaise));
            assert!(r.is_err(), "{} aurait dû être refusé", mauvaise);
            assert!(
                r.unwrap_err().contains("Marie"),
                "le message doit nommer l'agent : {}",
                mauvaise
            );
        }
    }

    #[test]
    fn ce_que_le_client_a_appris_passe_et_se_relit() {
        // Le validateur doit accepter exactement ce que le lecteur garde.
        // Plus strict, il refuserait une installation qui marche ; plus large,
        // il laisserait passer ce qui serait perdu en silence.
        for bonne in [
            r#"[]"#,
            r#"[{"titre":"Nos devis","resume":"ils partent toujours en PDF."}]"#,
            // Le résumé absent : `Savoir` le remplace par du vide et le filtre
            // garde l'entrée, puisque le titre, lui, dit quelque chose.
            r#"[{"titre":"Nos devis"}]"#,
            r#"[{"resume":"ils partent toujours en PDF."}]"#,
        ] {
            let contenu = avec("competences", bonne);
            assert!(installation_recevable(&contenu).is_ok(), "{} refusé à tort", bonne);

            let config: serde_json::Value = serde_json::from_str(&contenu).unwrap();
            let brut = config["agents"][0]["competences"].clone();
            let attendu: usize = brut.as_array().map(Vec::len).unwrap_or(0);
            let lus: Vec<crate::tache::Savoir> = serde_json::from_value(brut)
                .unwrap_or_else(|e| panic!("{} accepté mais illisible : {}", bonne, e));
            let gardes = lus.iter().filter(|s| !s.titre.is_empty() || !s.resume.is_empty()).count();
            assert_eq!(gardes, attendu, "{} : le lecteur en écarterait", bonne);
        }
    }

    #[test]
    fn la_configuration_livree_avec_l_installeur_est_recevable() {
        // Elle porte un vrai planning : une tâche éteinte et une tâche ajoutée.
        let livree = include_str!("../../src/config/installation.json");
        assert!(
            installation_recevable(livree).is_ok(),
            "la configuration livrée doit passer : {:?}",
            installation_recevable(livree)
        );
    }

    #[test]
    fn accepte_un_identifiant_de_fiche() {
        assert!(identifiant_valide("AG-0001"));
        assert!(identifiant_valide("AG-1249"));
    }

    #[test]
    fn refuse_ce_qui_sortirait_du_catalogue() {
        for mauvais in [
            "../../etc/passwd",
            "AG-0001/../../secret",
            "AG-00001",
            "AG-001",
            "AG-abcd",
            "ag-0001",
            "AG-0001.json",
            "",
        ] {
            assert!(!identifiant_valide(mauvais), "aurait dû refuser : {}", mauvais);
        }
    }

    #[test]
    fn une_installation_ordinaire_passe() {
        let bon = r#"{"agents":[
            {"prenom":"Marie","ficheId":"AG-0028","voix":"v1"},
            {"prenom":"Jean-Luc","ficheId":"AG-0179","voix":"v2"}
        ]}"#;
        assert!(installation_recevable(bon).is_ok());
        assert!(installation_recevable(r#"{"agents":[]}"#).is_ok());
    }

    #[test]
    fn un_prenom_ne_peut_pas_sortir_du_dossier_de_config() {
        for mauvais in [
            r#"{"agents":[{"prenom":"../../etc/passwd","ficheId":"AG-0028","voix":"v"}]}"#,
            r#"{"agents":[{"prenom":"a/b","ficheId":"AG-0028","voix":"v"}]}"#,
            r#"{"agents":[{"prenom":"..","ficheId":"AG-0028","voix":"v"}]}"#,
            r#"{"agents":[{"prenom":"  ","ficheId":"AG-0028","voix":"v"}]}"#,
        ] {
            assert!(
                installation_recevable(mauvais).is_err(),
                "prénom accepté à tort : {}",
                mauvais
            );
        }
    }

    #[test]
    fn deux_agents_ne_partagent_pas_un_prenom() {
        let doublon = r#"{"agents":[
            {"prenom":"Marie","ficheId":"AG-0028","voix":"v1"},
            {"prenom":"marie","ficheId":"AG-0179","voix":"v2"}
        ]}"#;
        assert!(installation_recevable(doublon).is_err());
    }

    #[test]
    fn seuls_les_catalogues_livres_se_lisent() {
        assert!(catalogue_connu("logiciels"));
        assert!(catalogue_connu("activites"));
        for mauvais in [
            "../../.env",
            "catalogue/logiciels.json",
            "logiciels.json",
            "Logiciels",
            "",
            "/etc/passwd",
        ] {
            assert!(!catalogue_connu(mauvais), "catalogue accepté à tort : {}", mauvais);
        }
    }

    /// Vérifie que la convention de chemin tient réellement : ce que
    /// `bundle.resources` installe à côté de l'exécutable est exactement ce que
    /// `lire_referentiel` va chercher. Une faute de frappe dans l'une des deux
    /// listes ne se verrait qu'après une installation sur un poste Windows.
    #[test]
    fn les_referentiels_du_depot_se_lisent_a_leur_place_installee() {
        // Le dépôt sert de dossier d'installation : `bundle.resources` y pose
        // catalogue/logiciels.json et catalogue/activites.json sous ces noms.
        std::env::set_var("IAGENT_RESSOURCES", concat!(env!("CARGO_MANIFEST_DIR"), "/../.."));

        for nom in ["logiciels", "activites", "catalogue", "connecteurs"] {
            let brut = super::lire_referentiel(nom.to_string())
                .unwrap_or_else(|e| panic!("référentiel {} illisible : {}", nom, e));
            let json: serde_json::Value = serde_json::from_str(&brut)
                .unwrap_or_else(|e| panic!("référentiel {} mal formé : {}", nom, e));
            assert!(json.is_object(), "référentiel {} inattendu", nom);
        }

        assert!(super::lire_referentiel("../../.env".to_string()).is_err());
        std::env::remove_var("IAGENT_RESSOURCES");
    }

    #[test]

    #[test]
    fn la_comparaison_de_versions_compte_les_nombres_pas_les_lettres() {
        use std::cmp::Ordering::*;
        // Le piege : en texte, "0.10.0" < "0.9.0". Une application en 0.10.0
        // refuserait alors les fiches qu'elle sait tenir.
        assert!("0.10.0" < "0.9.0", "le piege du texte existe bien");
        assert_eq!(comparer_versions("0.10.0", "0.9.0"), Greater);
        assert_eq!(comparer_versions("1.0.0", "0.1.0"), Greater);
        assert_eq!(comparer_versions("0.1.0", "0.1.0"), Equal);
        assert_eq!(comparer_versions("1.2", "1.2.0"), Equal, "une version courte se complete par des zeros");
        assert_eq!(comparer_versions("0.1.0", "1.0.0"), Less);
    }

    #[test]
    fn une_fiche_qui_demande_une_application_plus_recente_est_refusee_avec_le_remede() {
        let fiche = r#"{"miseAJour":{"appMinimum":"2.0.0"}}"#;
        let raison = version_insuffisante_pour(fiche, "0.1.0").expect("la fiche doit etre refusee");
        assert!(raison.contains("2.0.0"), "le message nomme ce qu'elle demande : {}", raison);
        assert!(raison.contains("0.1.0"), "le message nomme ce qu'on a : {}", raison);
        assert!(raison.contains("mettez l'application à jour"), "le message dit quoi faire : {}", raison);
    }

    #[test]
    fn une_fiche_de_la_version_courante_ou_plus_ancienne_passe() {
        assert_eq!(version_insuffisante_pour(r#"{"miseAJour":{"appMinimum":"0.1.0"}}"#, "0.1.0"), None);
        assert_eq!(version_insuffisante_pour(r#"{"miseAJour":{"appMinimum":"0.0.9"}}"#, "0.1.0"), None);
    }

    #[test]
    fn ce_qui_ne_se_lit_pas_ne_bloque_personne() {
        // Un controle de protection qui invente un echec est pire que pas de controle.
        assert_eq!(version_insuffisante_pour("pas du json", "0.1.0"), None);
        assert_eq!(version_insuffisante_pour("{}", "0.1.0"), None, "bloc miseAJour absent");
        assert_eq!(version_insuffisante_pour(r#"{"miseAJour":{}}"#, "0.1.0"), None, "champ absent");
        assert_eq!(version_insuffisante_pour(r#"{"miseAJour":{"appMinimum":42}}"#, "0.1.0"), None, "champ d un autre type");
    }

    #[test]
    fn aucune_fiche_du_depot_ne_demande_une_application_que_nous_n_avons_pas() {
        // Le piege trouve le 23/09 : les 1 249 fiches exigeaient « 1.0.0 » quand
        // l'application etait en 0.1.0, et personne ne lisait le champ. Branche,
        // il aurait ferme le catalogue entier. Ce banc lit les vraies fiches.
        let dossier = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../agents");
        let mut lues = 0;
        let mut refusees = Vec::new();
        for entree in std::fs::read_dir(&dossier).expect("dossier agents/").flatten() {
            let chemin = entree.path();
            if chemin.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let contenu = std::fs::read_to_string(&chemin).expect("lecture de la fiche");
            lues += 1;
            if let Some(raison) = version_insuffisante_pour(&contenu, version_app()) {
                refusees.push(format!("{} : {}", chemin.display(), raison));
            }
        }
        assert!(lues > 1000, "seulement {} fiches lues", lues);
        assert!(refusees.is_empty(), "{} fiches sur {} seraient refusees a l ouverture :\n{}", refusees.len(), lues, refusees.join("\n"));
    }

    fn une_fiche_hors_catalogue_est_refusee() {
        let hors = r#"{"agents":[{"prenom":"Marie","ficheId":"../secret","voix":"v"}]}"#;
        assert!(installation_recevable(hors).is_err());
        assert!(installation_recevable("pas du json").is_err());
        assert!(installation_recevable(r#"{"commentaire":"rien"}"#).is_err());
    }
}

/// La version de l'application, prise du manifeste : la recopier ici la ferait
/// diverger du jour où quelqu'un publie sans y penser.
pub fn version_app() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Compare deux versions « x.y.z » par nombres, jamais par texte.
///
/// La comparaison de chaînes dit que « 0.10.0 » est plus ancien que « 0.9.0 »,
/// ce qui est faux et ne se verrait pas : l'application refuserait des fiches
/// qu'elle sait tenir, ou pire en accepterait qu'elle ne tient pas. Une partie
/// illisible compte pour 0, et une version plus courte est complétée par des 0
/// (« 1.2 » vaut « 1.2.0 »).
fn comparer_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let nombres = |v: &str| -> Vec<u64> {
        v.split('.')
            .map(|p| p.trim().parse::<u64>().unwrap_or(0))
            .collect()
    };
    let (ga, gb) = (nombres(a), nombres(b));
    for i in 0..ga.len().max(gb.len()) {
        let ordre = ga.get(i).copied().unwrap_or(0).cmp(&gb.get(i).copied().unwrap_or(0));
        if ordre != std::cmp::Ordering::Equal {
            return ordre;
        }
    }
    std::cmp::Ordering::Equal
}

/// Ce que cette fiche exige de l'application, en clair, ou `None` si elle tient.
///
/// `miseAJour.appMinimum` était obligatoire au schéma sur les 1 249 fiches,
/// valait « 1.0.0 » partout, et **personne ne le lisait** — alors que
/// l'application est en 0.1.0. Le jour où on l'aurait branché, le catalogue
/// entier aurait cessé de s'ouvrir. Un champ obligatoire que rien ne lit ne
/// protège de rien ; il attend.
///
/// Ce qui ne se lit pas ne bloque pas : fiche illisible, bloc absent, champ
/// absent — on laisse passer. Ce contrôle est là pour éviter à un client un
/// échec incompréhensible, pas pour en inventer un.
pub fn version_insuffisante_pour(contenu: &str, version_app: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(contenu).ok()?;
    let exigee = json.get("miseAJour")?.get("appMinimum")?.as_str()?;
    if comparer_versions(exigee, version_app) != std::cmp::Ordering::Greater {
        return None;
    }
    Some(format!(
        "cette fiche demande la version {} de l'application, qui est en {} : mettez l'application à jour pour l'employer",
        exigee, version_app
    ))
}
