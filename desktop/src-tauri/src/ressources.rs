//! Ce dont l'application a besoin en dehors de son propre binaire, en un seul
//! endroit.
//!
//! **Le constat du 23/09/2026.** `voice.rs` écrivait « le binaire et la voix sont
//! livrés avec l'application » ; `tauri.conf.json` ne livrait ni l'un ni l'autre,
//! et ils ne sont pas non plus dans le dépôt. Sur un poste installé par le MSI,
//! la conversation vocale — la dernière étape du parcours minimal — ne pouvait
//! donc pas démarrer, et l'écran n'en disait qu'une phrase en anglais :
//! « Failed to initialize voice ». Un client francophone n'avait rien à en faire.
//!
//! La cause n'est pas le fichier manquant, c'est qu'il n'existait aucun endroit
//! où lire ce que l'application attend du poste. Chaque module cherchait le sien
//! dans son coin, et rien ne comparait cette liste à ce que l'installeur pose.
//! C'est ce que fait cette table, et un banc refuse désormais l'écart dans les
//! deux sens : une ressource déclarée livrée que l'installeur ne pose pas, et une
//! ressource déclarée absente qu'il pose quand même.
//!
//! Ce que la table ne fait pas : télécharger. Tant que personne n'a tranché d'où
//! viennent ces fichiers ni ce qu'ils pèsent sur la facture du client, l'honnête
//! est de dire ce qui manque et où le prendre, pas d'aller le chercher tout seul.

/// Une pièce que l'application attend à côté de son exécutable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ressource {
    /// À quoi elle sert, dit au client et non au développeur.
    pub role: &'static str,
    /// Où le code la cherche, relativement au dossier de l'exécutable.
    pub chemin: &'static str,
    /// La variable d'environnement qui la déplace, pour le développement et les
    /// bancs. Vide quand il n'y en a pas.
    pub variable: &'static str,
    /// `true` quand l'installeur la pose. `false` quand elle reste à poser sur
    /// le poste, et c'est alors `remede` qui dit comment.
    pub livree: bool,
    /// Ce que le client (ou nous) doit faire quand elle manque.
    pub remede: &'static str,
}

/// Le remède des trois pièces de la voix, écrit une fois.
const REMEDE_VOIX: &str =
    "la voix n'est pas encore livrée avec l'application : voir « Ce que l'installeur ne livre pas » dans le README du dépôt";

/// Tout ce que l'application va chercher dehors.
///
/// L'ordre est celui du parcours : d'abord ce qui fait travailler un agent,
/// ensuite ce qui le fait parler.
pub const RESSOURCES: [Ressource; 9] = [
    Ressource {
        role: "les fiches des 1 249 postes",
        chemin: "agents",
        variable: "IAGENT_RESSOURCES",
        livree: true,
        remede: "",
    },
    Ressource {
        role: "le référentiel des logiciels",
        chemin: "catalogue/logiciels.json",
        variable: "",
        livree: true,
        remede: "",
    },
    Ressource {
        role: "les packs d'activité",
        chemin: "catalogue/activites.json",
        variable: "",
        livree: true,
        remede: "",
    },
    Ressource {
        role: "le catalogue des postes",
        chemin: "catalogue/catalogue.json",
        variable: "",
        livree: true,
        remede: "",
    },
    Ressource {
        role: "les connecteurs et ce qu'ils servent",
        chemin: "connecteurs/catalogue.json",
        variable: "",
        livree: true,
        remede: "",
    },
    Ressource {
        role: "les serveurs MCP déclarés",
        chemin: "connecteurs/serveurs-mcp.json",
        variable: "",
        livree: true,
        remede: "",
    },
    Ressource {
        role: "les paliers de modèles, qui disent quel modèle lancer",
        chemin: "dimensionnement/paliers-modeles.json",
        variable: "",
        livree: true,
        remede: "",
    },
    Ressource {
        role: "le catalogue des machines, que la jauge lit",
        chemin: "dimensionnement/machines.json",
        variable: "",
        livree: true,
        remede: "",
    },
    // La voix. Trois pièces, et il en manque une seule pour que rien ne parle.
    Ressource {
        role: "le modèle d'écoute, qui transcrit ce que le client dit",
        chemin: "modeles/ggml-medium-fr.bin",
        variable: "IAGENT_MODELE_ECOUTE",
        livree: false,
        remede: REMEDE_VOIX,
    },
];

/// Les pièces de la voix, qui ne sont pas dans `RESSOURCES` parce que leur
/// chemin dépend du système. Même règle, même remède.
pub fn ressources_de_la_voix() -> Vec<Ressource> {
    vec![
        Ressource {
            role: "le moteur de voix",
            chemin: if cfg!(windows) { "piper/piper.exe" } else { "piper/piper" },
            variable: "IAGENT_PIPER",
            livree: false,
            remede: REMEDE_VOIX,
        },
        Ressource {
            role: "la voix française",
            chemin: "modeles/fr_FR-siwis-medium.onnx",
            variable: "IAGENT_VOIX",
            livree: false,
            remede: REMEDE_VOIX,
        },
        // Piper lit ce fichier de réglages à côté du modèle, sans qu'on le lui
        // donne : absent, le moteur démarre puis échoue sans rien dire d'utile.
        Ressource {
            role: "les réglages de la voix française",
            chemin: "modeles/fr_FR-siwis-medium.onnx.json",
            variable: "",
            livree: false,
            remede: REMEDE_VOIX,
        },
    ]
}

/// Toutes les pièces, celles de la table et celles de la voix.
pub fn toutes() -> Vec<Ressource> {
    let mut v: Vec<Ressource> = RESSOURCES.to_vec();
    v.extend(ressources_de_la_voix());
    v
}

/// Où cette pièce est cherchée sur ce poste, variable d'environnement comprise.
pub fn chemin_de(r: &Ressource) -> std::path::PathBuf {
    if !r.variable.is_empty() {
        if let Some(v) = std::env::var_os(r.variable) {
            let pose = std::path::PathBuf::from(v);
            // `IAGENT_RESSOURCES` déplace le dossier entier, pas un fichier.
            return if r.variable == "IAGENT_RESSOURCES" {
                pose.join(r.chemin)
            } else {
                pose
            };
        }
    }
    crate::fiches::dossier_ressources().join(r.chemin)
}

/// Ce qui manque vraiment sur ce poste, dans l'ordre de la table.
pub fn manquantes() -> Vec<Ressource> {
    toutes()
        .into_iter()
        .filter(|r| !chemin_de(r).exists())
        .collect()
}

/// La phrase à montrer au client quand une pièce manque. Jamais un chemin seul :
/// un chemin ne dit ni ce qu'on a perdu ni quoi en faire.
pub fn en_clair(r: &Ressource) -> String {
    let ou = chemin_de(r);
    if r.remede.is_empty() {
        format!(
            "{} est introuvable ({}). L'installation est incomplète : réinstallez l'application.",
            r.role,
            ou.display()
        )
    } else {
        format!("{} est introuvable ({}) — {}.", r.role, ou.display(), r.remede)
    }
}

/// Ce qui manque pour écouter, en une phrase. `None` quand tout est là.
///
/// Écouter et parler ne demandent pas les mêmes pièces, et les séparer compte :
/// un poste qui n'a que le modèle d'écoute peut comprendre le client, même s'il
/// ne sait pas encore lui répondre de vive voix.
pub fn manque_pour_ecouter() -> Option<String> {
    phrase_des_absentes(&[*MODELE_ECOUTE])
}

/// Ce qui manque pour parler. `None` quand tout est là.
pub fn manque_pour_parler() -> Option<String> {
    phrase_des_absentes(&ressources_de_la_voix())
}

/// Le modèle d'écoute, retrouvé dans la table par son chemin : un index en dur
/// se décalerait à la première ressource ajoutée au milieu.
static MODELE_ECOUTE: std::sync::LazyLock<Ressource> = std::sync::LazyLock::new(|| {
    *RESSOURCES
        .iter()
        .find(|r| r.variable == "IAGENT_MODELE_ECOUTE")
        .expect("le modèle d'écoute a disparu de la table des ressources")
});

fn phrase_des_absentes(candidates: &[Ressource]) -> Option<String> {
    let absentes: Vec<&Ressource> = candidates
        .iter()
        .filter(|r| !chemin_de(r).exists())
        .collect();
    let (premiere, _) = (absentes.first()?, ());
    let quoi: Vec<&str> = absentes.iter().map(|r| r.role).collect();
    Some(format!(
        "Il manque sur ce poste : {}. {}.",
        quoi.join(", "),
        if premiere.remede.is_empty() {
            "L'installation est incomplète : réinstallez l'application"
        } else {
            premiere.remede
        }
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn conf() -> serde_json::Value {
        let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/tauri.conf.json");
        serde_json::from_str(&std::fs::read_to_string(chemin).expect("tauri.conf.json introuvable"))
            .expect("tauri.conf.json mal formé")
    }

    /// Les chemins que l'installeur pose, du côté du poste.
    fn poses() -> Vec<String> {
        conf()["bundle"]["resources"]
            .as_object()
            .expect("l'installeur ne pose plus rien")
            .values()
            .filter_map(serde_json::Value::as_str)
            .map(str::to_string)
            .collect()
    }

    /// Une ressource déclarée livrée que l'installeur ne pose pas, c'est un poste
    /// installé qui ne démarre pas — et ça ne se voit qu'une fois chez le client.
    #[test]
    fn tout_ce_qui_est_declare_livre_est_bien_pose_par_l_installeur() {
        let poses = poses();
        for r in toutes().iter().filter(|r| r.livree) {
            assert!(
                poses.iter().any(|p| p == r.chemin),
                "« {} » ({}) est déclarée livrée mais l'installeur ne la pose pas",
                r.role,
                r.chemin
            );
        }
    }

    /// Et l'inverse : le jour où l'installeur livrera la voix, cette table doit
    /// le dire, sinon l'application continuera d'annoncer qu'elle manque.
    #[test]
    fn rien_de_declare_absent_n_est_pose_par_l_installeur() {
        let poses = poses();
        for r in toutes().iter().filter(|r| !r.livree) {
            assert!(
                !poses.iter().any(|p| p == r.chemin),
                "« {} » ({}) est posée par l'installeur : elle n'est plus à poser à la main",
                r.role,
                r.chemin
            );
        }
    }

    /// Le constat du jour, écrit noir sur blanc : la voix n'est pas livrée.
    /// Le jour où elle le sera, ce banc tombera et il faudra le réécrire —
    /// c'est voulu, c'est comme ça qu'on saura que la situation a changé.
    #[test]
    fn la_voix_n_est_pas_encore_livree_avec_l_application() {
        let voix: Vec<Ressource> = toutes()
            .into_iter()
            .filter(|r| r.chemin.starts_with("modeles/") || r.chemin.starts_with("piper/"))
            .collect();
        assert_eq!(voix.len(), 4, "trois pièces de voix et le modèle d'écoute");
        assert!(voix.iter().all(|r| !r.livree));
        assert!(voix.iter().all(|r| !r.remede.is_empty()), "chacune dit quoi faire");
    }

    /// Chaque chemin que le code cherche est nommé une seule fois : deux entrées
    /// pour le même fichier finiraient par ne plus dire la même chose.
    #[test]
    fn aucun_chemin_n_est_declare_deux_fois() {
        let tout = toutes();
        for (i, r) in tout.iter().enumerate() {
            assert!(
                !tout[..i].iter().any(|autre| autre.chemin == r.chemin),
                "« {} » est déclaré deux fois",
                r.chemin
            );
            assert!(!r.role.is_empty(), "une ressource sans rôle ne se dit pas au client");
        }
    }

    /// La phrase montrée au client nomme ce qui manque et quoi faire, jamais un
    /// chemin tout seul.
    #[test]
    fn la_phrase_dit_ce_qui_manque_et_quoi_en_faire() {
        let voix = ressources_de_la_voix();
        let phrase = en_clair(&voix[1]);
        assert!(phrase.contains("la voix française"), "{}", phrase);
        assert!(phrase.contains("README"), "{}", phrase);

        let fiches = en_clair(&RESSOURCES[0]);
        assert!(fiches.contains("réinstallez"), "{}", fiches);
    }

    /// Sur la machine des bancs, aucune pièce de voix n'est posée : les deux
    /// phrases doivent donc exister, nommer ce qui manque et renvoyer au README.
    /// Et elles ne disent pas la même chose : écouter n'est pas parler.
    #[test]
    fn ce_qui_manque_pour_ecouter_et_pour_parler_se_dit_a_part() {
        let ecouter = manque_pour_ecouter();
        let parler = manque_pour_parler();
        // Si un jour ces fichiers sont là, il n'y a rien à dire, et c'est bien.
        if let Some(e) = &ecouter {
            assert!(e.contains("modèle d'écoute"), "{}", e);
            assert!(e.contains("README"), "{}", e);
            assert!(!e.contains("la voix française"), "écouter ne demande pas la voix : {}", e);
        }
        if let Some(p) = &parler {
            assert!(p.contains("moteur de voix"), "{}", p);
            assert!(p.contains("réglages"), "les trois pièces de Piper sont nommées : {}", p);
            assert!(!p.contains("modèle d'écoute"), "parler ne demande pas l'écoute : {}", p);
        }
        assert!(
            ecouter.is_some() || parler.is_some(),
            "aucune pièce de voix n'est posée ici : au moins une des deux phrases doit exister"
        );
    }

    /// La variable d'environnement l'emporte, sinon le développement et les bancs
    /// ne pourraient pas poser ces fichiers ailleurs que dans un dossier installé.
    #[test]
    fn une_variable_deplace_bien_la_ressource() {
        let r = Ressource {
            role: "témoin",
            chemin: "modeles/temoin.bin",
            variable: "IAGENT_BANC_RESSOURCE_TEMOIN",
            livree: false,
            remede: "rien",
        };
        assert!(chemin_de(&r).ends_with("modeles/temoin.bin"));
        std::env::set_var("IAGENT_BANC_RESSOURCE_TEMOIN", "/tmp/ailleurs.bin");
        assert_eq!(chemin_de(&r), std::path::PathBuf::from("/tmp/ailleurs.bin"));
        std::env::remove_var("IAGENT_BANC_RESSOURCE_TEMOIN");
    }
}
