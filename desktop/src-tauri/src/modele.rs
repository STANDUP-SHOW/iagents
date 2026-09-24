//! Où tourne le modèle d'un agent, et pourquoi.
//!
//! La promesse du produit est écrite partout : « local par défaut, API au choix
//! du client ». Les 1 249 fiches portent toutes `execution.defaut`, et l'argument
//! commercial (`docs/economie.md`) repose entièrement sur le local. Jusqu'ici
//! l'application ne savait parler qu'à l'API d'Anthropic : la fiche disait
//! `local` et rien dans le code ne le lisait. Ce module est la route locale, et
//! le seul endroit où la voie se choisit.
//!
//! Deux règles du dépôt s'appliquent ici :
//!   - **l'application prévient avant de basculer.** Un agent qui passe du local
//!     à l'API se met à coûter des jetons ; ça ne se découvre pas sur la facture.
//!     `Choix.motif` porte toujours la phrase, même quand rien ne bascule.
//!   - **sans de quoi travailler, l'agent s'arrête avec le motif écrit.** Jamais
//!     un silence, jamais une réponse dégradée sans le dire : le motif nomme le
//!     modèle à installer ou la clé qui manque.
//!
//! Le format du moteur local est celui d'Ollama, relevé le 23/09/2026 dans la
//! bibliothèque cliente publiée par Ollama (`ollama@0.6.3`, `ChatRequest`,
//! `ChatResponse`, `ListResponse`) et non recopié de mémoire : `POST /api/chat`
//! avec `stream: false`, `GET /api/tags`, hôte `http://127.0.0.1:11434`.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Là où le moteur local écoute quand personne n'a rien changé.
pub const ADRESSE_LOCALE: &str = "http://127.0.0.1:11434";

/// Un modèle local qui ne répond pas au bout de ça ne répondra pas : mieux vaut
/// basculer ou s'arrêter que laisser le client devant un écran muet.
pub const DELAI: Duration = Duration::from_secs(120);

// ---------------------------------------------------------------------------
// Ce que la fiche demande, ce que la machine offre
// ---------------------------------------------------------------------------

/// Le bloc `execution` d'une fiche, réduit à ce qui décide ici.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Execution {
    #[serde(default)]
    pub defaut: String,
    #[serde(default)]
    pub modes: Vec<String>,
}

/// Un modèle installé sur le moteur local, tel que `/api/tags` le nomme.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModeleInstalle {
    pub nom: String,
}

/// Ce que la machine offre, tel qu'on vient de le lui demander.
///
/// `locaux` à `None` veut dire que le moteur local n'a pas répondu — pas qu'il
/// n'a rien : les deux cas se disent différemment au client.
#[derive(Debug, Clone, Default)]
pub struct Offre {
    pub locaux: Option<Vec<ModeleInstalle>>,
    pub cle_api: bool,
    /// Ce que la jauge oppose au local pour CE poste, en clair. `None` = rien,
    /// ou rien de mesurable. Un modèle installé ne veut pas dire un modèle qui
    /// tient : sans ça, le trop-gros ne se voyait qu'au bout de 120 secondes.
    pub memoire_insuffisante: Option<String>,
}

/// Par où passe cet agent.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "voie", rename_all = "lowercase")]
pub enum Voie {
    Local { modele: String },
    Api { modele: String },
}

/// La voie retenue, et la phrase que le client doit lire.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choix {
    pub voie: Voie,
    /// Toujours renseigné, y compris quand rien ne bascule.
    pub motif: String,
    /// `true` quand ce n'est pas ce que la fiche demandait.
    pub bascule: bool,
}

// ---------------------------------------------------------------------------
// Reconnaître un modèle sous deux écritures
// ---------------------------------------------------------------------------

fn normaliser(mot: &str) -> String {
    mot.chars()
        .filter(char::is_ascii_alphanumeric)
        .map(|c| c.to_ascii_lowercase())
        .collect()
}

/// Sépare la base d'un nom de modèle de sa taille.
///
/// Nos paliers écrivent « Llama 3.1 8B », le moteur local « llama3.1:8b » ou
/// « llama3.1:latest ». Les deux écritures donnent ici la même base, `llama31`.
fn decouper(nom: &str) -> (String, String) {
    match nom.split_once(':') {
        Some((base, marque)) => (normaliser(base), normaliser(marque)),
        None => {
            let mots: Vec<&str> = nom.split_whitespace().collect();
            match mots.split_last() {
                // « 8B », « 70B » : une taille se reconnaît à son chiffre puis son b.
                Some((dernier, debut))
                    if dernier.to_lowercase().ends_with('b')
                        && dernier.starts_with(|c: char| c.is_ascii_digit()) =>
                {
                    (normaliser(&debut.join("")), normaliser(dernier))
                }
                _ => (normaliser(nom), String::new()),
            }
        }
    }
}

/// Deux noms désignent-ils le même modèle ?
///
/// La taille n'entre pas dans la comparaison, et c'est un choix : le palier dit
/// ce qu'il faut **au moins**, et un client qui a installé plus gros l'a fait
/// exprès. Ce qui peut mal tourner — un modèle trop gros pour la machine — se
/// voit à l'usage et se dit à la jauge (`crate::jauge`), pas au nom.
pub fn meme_modele(installe: &str, exemple: &str) -> bool {
    let (base, _) = decouper(installe);
    !base.is_empty() && base == decouper(exemple).0
}

/// Le modèle installé qui convient le mieux à ce palier.
///
/// À base égale, on préfère celui dont la taille est exactement celle du palier :
/// c'est sur cette taille que le dimensionnement a été calculé.
pub fn modele_pour(installes: &[ModeleInstalle], exemples: &[String]) -> Option<String> {
    let mut approchant: Option<String> = None;
    for exemple in exemples {
        for installe in installes {
            if !meme_modele(&installe.nom, exemple) {
                continue;
            }
            let (_, taille_installee) = decouper(&installe.nom);
            let (_, taille_voulue) = decouper(exemple);
            if !taille_installee.is_empty() && taille_installee == taille_voulue {
                return Some(installe.nom.clone());
            }
            approchant.get_or_insert_with(|| installe.nom.clone());
        }
    }
    approchant
}

// ---------------------------------------------------------------------------
// Le choix de la voie
// ---------------------------------------------------------------------------

/// Dit ce qu'il faudrait installer, en nommant les modèles du palier.
fn a_installer(exemples: &[String]) -> String {
    if exemples.is_empty() {
        return "un modèle de langage".to_string();
    }
    format!("l'un de ces modèles : {}", exemples.join(", "))
}

/// Ce qu'il y a à faire pour que le local redevienne possible. Installer un
/// modèle de plus ne sert à rien quand c'est la machine qui est trop petite.
fn remede(offre: &Offre, exemples: &[String]) -> String {
    if offre.memoire_insuffisante.is_some() {
        "une machine qui laisse plus de mémoire aux modèles de ce poste".to_string()
    } else {
        format!("installer {}", a_installer(exemples))
    }
}

/// Choisit la voie. Fonction pure : elle ne joint rien, on lui donne l'offre.
pub fn choisir(
    execution: &Execution,
    exemples: &[String],
    offre: &Offre,
    modele_api: &str,
) -> Result<Choix, String> {
    let accepte = |mode: &str| execution.modes.iter().any(|m| m == mode);
    // La mémoire passe avant le nom : un modèle qui ne tient pas sur la machine
    // n'est pas un modèle disponible, même s'il est installé.
    let local = if offre.memoire_insuffisante.is_some() {
        None
    } else {
        offre
            .locaux
            .as_ref()
            .and_then(|installes| modele_pour(installes, exemples))
    };
    let api_possible = offre.cle_api && accepte("api");

    // Ce que la fiche demande d'abord, et ce qu'on essaie si ça ne se peut pas.
    let (premier_local, _) = (execution.defaut != "api", execution.defaut == "api");

    if premier_local && accepte("local") {
        if let Some(modele) = local {
            return Ok(Choix {
                motif: format!(
                    "{} travaille sur votre machine, sans jeton facturé.",
                    modele
                ),
                voie: Voie::Local { modele },
                bascule: false,
            });
        }
        if api_possible {
            return Ok(Choix {
                voie: Voie::Api { modele: modele_api.to_string() },
                motif: format!(
                    "Ce poste devait travailler sur votre machine. {} : il passe par l'API, qui est facturée à l'usage. Pour revenir au local, il faudrait {}.",
                    manque_local(offre),
                    remede(offre, exemples)
                ),
                bascule: true,
            });
        }
        return Err(format!(
            "Ce poste ne peut pas travailler : {}, et aucune clé d'API n'est enregistrée. Il faudrait {}, ou une clé d'API.",
            manque_local(offre),
            remede(offre, exemples)
        ));
    }

    if api_possible {
        return Ok(Choix {
            voie: Voie::Api { modele: modele_api.to_string() },
            motif: "Ce poste travaille par l'API, facturée à l'usage, comme sa fiche le demande."
                .to_string(),
            bascule: false,
        });
    }
    if accepte("local") {
        if let Some(modele) = local {
            return Ok(Choix {
                motif: format!(
                    "Ce poste devait passer par l'API, mais aucune clé n'est enregistrée : {} prend le relais sur votre machine, sans jeton facturé.",
                    modele
                ),
                voie: Voie::Local { modele },
                bascule: true,
            });
        }
    }
    Err(format!(
        "Ce poste ne peut pas travailler : aucune clé d'API n'est enregistrée, et {}. Il faudrait une clé d'API, ou {}.",
        manque_local(offre),
        remede(offre, exemples)
    ))
}

/// Ce qui manque du côté local, dit sans jargon. Les deux cas ne se soignent pas
/// pareil : un moteur absent s'installe, un modèle absent se télécharge.
fn manque_local(offre: &Offre) -> String {
    // Quand c'est la machine qui est trop petite, dire « aucun modèle installé ne
    // convient » enverrait le client en installer un de plus, pour rien.
    if let Some(raison) = &offre.memoire_insuffisante {
        return raison.clone();
    }
    match &offre.locaux {
        None => "aucun moteur de modèles locaux ne répond sur cet ordinateur".to_string(),
        Some(installes) if installes.is_empty() => {
            "le moteur local répond mais aucun modèle n'y est installé".to_string()
        }
        Some(_) => "aucun modèle installé ne convient à ce poste".to_string(),
    }
}

// ---------------------------------------------------------------------------
// Le moteur local
// ---------------------------------------------------------------------------

/// Les modèles installés. `Err` veut dire « le moteur n'a pas répondu ».
pub async fn modeles_installes(adresse: &str) -> Result<Vec<ModeleInstalle>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|_| "le réseau local n'est pas disponible".to_string())?;
    let reponse = client
        .get(format!("{}/api/tags", adresse))
        .send()
        .await
        .map_err(|_| "aucun moteur de modèles locaux ne répond".to_string())?;
    if !reponse.status().is_success() {
        return Err("le moteur de modèles locaux a refusé la demande".to_string());
    }
    let corps: serde_json::Value = reponse
        .json()
        .await
        .map_err(|_| "le moteur de modèles locaux a répondu quelque chose d'illisible".to_string())?;
    Ok(corps
        .get("models")
        .and_then(serde_json::Value::as_array)
        .map(|liste| {
            liste
                .iter()
                .filter_map(|m| m.get("name").and_then(serde_json::Value::as_str))
                .map(|nom| ModeleInstalle { nom: nom.to_string() })
                .collect()
        })
        .unwrap_or_default())
}

/// Une réponse du moteur local. `stream: false` : on veut la réponse entière.
pub async fn repondre_en_local(
    adresse: &str,
    modele: &str,
    prompt_systeme: &str,
    enonce: &str,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(DELAI)
        .build()
        .map_err(|_| "le réseau local n'est pas disponible".to_string())?;
    let demande = serde_json::json!({
        "model": modele,
        "stream": false,
        "messages": [
            { "role": "system", "content": prompt_systeme },
            { "role": "user", "content": enonce },
        ],
    });
    let reponse = client
        .post(format!("{}/api/chat", adresse))
        .json(&demande)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                format!(
                    "{} n'a pas répondu en {} secondes. Ce modèle est peut-être trop lourd pour cette machine.",
                    modele,
                    DELAI.as_secs()
                )
            } else {
                "le moteur de modèles locaux s'est interrompu".to_string()
            }
        })?;
    if !reponse.status().is_success() {
        return Err(format!(
            "le moteur de modèles locaux a refusé de faire travailler {}",
            modele
        ));
    }
    let corps: serde_json::Value = reponse
        .json()
        .await
        .map_err(|_| "le moteur de modèles locaux a répondu quelque chose d'illisible".to_string())?;
    corps
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(serde_json::Value::as_str)
        .filter(|texte| !texte.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("{} n'a rien répondu", modele))
}

// ---------------------------------------------------------------------------
// Ce que l'application lit dans le dépôt
// ---------------------------------------------------------------------------

/// Le bloc `execution` d'une fiche et les modèles de son palier de texte.
pub fn contexte_de_la_fiche(fiche_id: &str) -> Result<(Execution, Vec<String>), String> {
    let brut = crate::fiches::lire_fiche(fiche_id.to_string())?;
    let fiche: serde_json::Value =
        serde_json::from_str(&brut).map_err(|e| format!("fiche {} illisible : {}", fiche_id, e))?;

    let execution: Execution = fiche
        .get("execution")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .map_err(|e| format!("bloc execution de {} illisible : {}", fiche_id, e))?
        .unwrap_or_default();

    let palier = fiche
        .get("modeles")
        .and_then(|m| m.get("texte"))
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .to_string();

    Ok((execution, exemples_du_palier(&palier)?))
}

/// Les modèles que le dimensionnement retient pour un palier.
pub fn exemples_du_palier(palier: &str) -> Result<Vec<String>, String> {
    if palier.is_empty() {
        return Ok(Vec::new());
    }
    let chemin = crate::fiches::dossier_ressources().join("dimensionnement/paliers-modeles.json");
    let brut = std::fs::read_to_string(&chemin).map_err(|e| {
        format!(
            "lecture de {} : {} — les paliers de modèles n'ont pas été installés avec l'application",
            chemin.display(),
            e
        )
    })?;
    let fichier: serde_json::Value =
        serde_json::from_str(&brut).map_err(|e| format!("paliers de modèles illisibles : {}", e))?;
    Ok(fichier
        .get("paliers")
        .and_then(|p| p.get(palier))
        .and_then(|p| p.get("exemples"))
        .and_then(serde_json::Value::as_array)
        .map(|v| {
            v.iter()
                .filter_map(serde_json::Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default())
}

/// Ce qui se passera si cet agent parle, et pourquoi. Rien n'est lancé.
///
/// L'écran s'en sert pour prévenir AVANT que le client n'ait parlé : découvrir
/// après coup qu'on est passé à l'API, c'est le découvrir sur la facture.
#[tauri::command]
pub async fn modele_etat(fiche_id: String) -> Result<Choix, String> {
    let (execution, exemples) = contexte_de_la_fiche(&fiche_id)?;
    let offre = Offre {
        locaux: modeles_installes(ADRESSE_LOCALE).await.ok(),
        cle_api: crate::llm::cle_api().is_some(),
        memoire_insuffisante: crate::jauge::memoire_insuffisante_pour(&fiche_id),
    };
    choisir(&execution, &exemples, &offre, crate::llm::MODELE_API)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Un modèle installé n'est pas un modèle qui tient. Quand la jauge dit que
    /// la mémoire manque, le local est fermé même si le bon modèle est là, et
    /// le motif nomme la machine, pas un modèle de plus à installer.
    #[test]
    fn un_modele_installe_ne_sert_a_rien_si_la_machine_ne_le_porte_pas() {
        let fiche = Execution {
            defaut: "local".into(),
            modes: vec!["local".into(), "api".into()],
        };
        let exemples = vec!["Llama 3.1 8B".to_string()];
        let trop_gros = Some(
            "ce poste demande 23 Go de mémoire pour ses modèles et cet ordinateur n'en laisse que 10"
                .to_string(),
        );

        let bascule = choisir(
            &fiche,
            &exemples,
            &Offre {
                locaux: Some(installes(&["llama3.1:8b"])),
                cle_api: true,
                memoire_insuffisante: trop_gros.clone(),
            },
            "claude-sonnet-5",
        )
        .expect("l'API reste possible");
        assert!(matches!(bascule.voie, Voie::Api { .. }), "{:?}", bascule.voie);
        assert!(bascule.bascule);
        assert!(bascule.motif.contains("23 Go"), "{}", bascule.motif);
        assert!(
            bascule.motif.contains("plus de mémoire"),
            "le remède doit parler de la machine : {}",
            bascule.motif
        );
        assert!(
            !bascule.motif.contains("installer l'un de ces modèles"),
            "installer un modèle de plus ne réglerait rien : {}",
            bascule.motif
        );

        // Sans clé, l'agent s'arrête, et pour la même raison.
        let arret = choisir(
            &fiche,
            &exemples,
            &Offre {
                locaux: Some(installes(&["llama3.1:8b"])),
                cle_api: false,
                memoire_insuffisante: trop_gros,
            },
            "claude-sonnet-5",
        )
        .unwrap_err();
        assert!(arret.contains("23 Go"), "{}", arret);
        assert!(arret.contains("plus de mémoire"), "{}", arret);
    }

    /// Et l'inverse : sans rien à opposer, le même poste part en local.
    #[test]
    fn sans_rien_a_opposer_le_meme_poste_part_en_local() {
        let choix = choisir(
            &Execution { defaut: "local".into(), modes: vec!["local".into(), "api".into()] },
            &["Llama 3.1 8B".to_string()],
            &Offre {
                locaux: Some(installes(&["llama3.1:8b"])),
                cle_api: true,
                memoire_insuffisante: None,
            },
            "claude-sonnet-5",
        )
        .expect("le local est possible");
        assert_eq!(choix.voie, Voie::Local { modele: "llama3.1:8b".into() });
        assert!(!choix.bascule);
    }

    fn installes(noms: &[&str]) -> Vec<ModeleInstalle> {
        noms.iter().map(|n| ModeleInstalle { nom: n.to_string() }).collect()
    }

    /// Les deux écritures d'un même modèle doivent se reconnaître : nos paliers
    /// disent « Llama 3.1 8B », le moteur local dit « llama3.1:8b ».
    #[test]
    fn un_modele_se_reconnait_sous_ses_deux_ecritures() {
        assert!(meme_modele("llama3.1:8b", "Llama 3.1 8B"));
        assert!(meme_modele("llama3.1:latest", "Llama 3.1 8B"));
        assert!(meme_modele("qwen2.5:7b", "Qwen2.5 7B"));
        assert!(meme_modele("mistral:7b", "Mistral 7B"));
        assert!(meme_modele("gemma3:4b", "Gemma 3 4B"));

        // Et deux modèles différents ne se confondent pas.
        assert!(!meme_modele("mistral:7b", "Llama 3.1 8B"));
        assert!(!meme_modele("qwen2.5:7b", "Qwen3 8B"));
        assert!(!meme_modele("", "Llama 3.1 8B"));
    }

    /// À base égale, la taille du palier l'emporte : c'est sur elle que le
    /// dimensionnement a été calculé.
    #[test]
    fn la_taille_du_palier_est_preferee() {
        let choix = modele_pour(
            &installes(&["llama3.1:70b", "llama3.1:8b"]),
            &["Llama 3.1 8B".into()],
        );
        assert_eq!(choix, Some("llama3.1:8b".to_string()));

        // Mais un client qui n'a que plus gros travaille quand même.
        let gros = modele_pour(&installes(&["llama3.1:70b"]), &["Llama 3.1 8B".into()]);
        assert_eq!(gros, Some("llama3.1:70b".to_string()));

        assert_eq!(modele_pour(&installes(&["mistral:7b"]), &["Llama 3.1 8B".into()]), None);
    }

    fn poste_local() -> Execution {
        Execution { defaut: "local".into(), modes: vec!["local".into(), "api".into()] }
    }

    /// Le cas ordinaire : la fiche dit local, le modèle est là, rien ne bascule
    /// et rien n'est facturé.
    #[test]
    fn un_poste_local_avec_son_modele_reste_local() {
        let choix = choisir(
            &poste_local(),
            &["Llama 3.1 8B".into()],
            &Offre { locaux: Some(installes(&["llama3.1:8b"])), cle_api: true, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .expect("le local est possible");
        assert_eq!(choix.voie, Voie::Local { modele: "llama3.1:8b".into() });
        assert!(!choix.bascule);
        assert!(choix.motif.contains("sans jeton facturé"), "motif : {}", choix.motif);
    }

    /// La bascule vers l'API se dit, parce qu'elle se paie.
    #[test]
    fn la_bascule_vers_l_api_previent_et_dit_quoi_installer() {
        let choix = choisir(
            &poste_local(),
            &["Llama 3.1 8B".into(), "Qwen2.5 7B".into()],
            &Offre { locaux: None, cle_api: true, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .expect("l'API reste possible");
        assert!(matches!(choix.voie, Voie::Api { .. }));
        assert!(choix.bascule, "une bascule qui ne se dit pas se découvre sur la facture");
        assert!(choix.motif.contains("facturée"), "motif : {}", choix.motif);
        assert!(choix.motif.contains("Llama 3.1 8B"), "motif : {}", choix.motif);
        assert!(choix.motif.contains("Qwen2.5 7B"), "motif : {}", choix.motif);
    }

    /// Sans rien pour travailler, l'agent s'arrête, et le motif dit quoi faire.
    #[test]
    fn sans_modele_ni_cle_l_agent_s_arrete_avec_le_motif_ecrit() {
        let motif = choisir(
            &poste_local(),
            &["Llama 3.1 8B".into()],
            &Offre { locaux: None, cle_api: false, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .unwrap_err();
        assert!(motif.contains("Llama 3.1 8B"), "motif : {}", motif);
        assert!(motif.contains("clé"), "motif : {}", motif);
        for jargon in ["null", "Err", "None", "API_KEY", "JSON"] {
            assert!(!motif.contains(jargon), "jargon « {} » dans : {}", jargon, motif);
        }
    }

    /// Les deux manques du côté local ne se soignent pas pareil, donc ne se
    /// disent pas pareil : un moteur absent s'installe, un modèle se télécharge.
    #[test]
    fn le_motif_distingue_le_moteur_absent_du_modele_absent() {
        let sans_moteur = choisir(
            &poste_local(),
            &["Llama 3.1 8B".into()],
            &Offre { locaux: None, cle_api: true, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .expect("bascule")
        .motif;
        let sans_modele = choisir(
            &poste_local(),
            &["Llama 3.1 8B".into()],
            &Offre { locaux: Some(vec![]), cle_api: true, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .expect("bascule")
        .motif;
        let mauvais_modele = choisir(
            &poste_local(),
            &["Llama 3.1 8B".into()],
            &Offre { locaux: Some(installes(&["mistral:7b"])), cle_api: true, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .expect("bascule")
        .motif;
        assert_ne!(sans_moteur, sans_modele);
        assert_ne!(sans_modele, mauvais_modele);
        assert!(sans_moteur.contains("moteur"), "motif : {}", sans_moteur);
    }

    /// Une fiche qui demande l'API sans clé retombe sur le local plutôt que de
    /// laisser le client sans agent, et le dit.
    #[test]
    fn un_poste_api_sans_cle_retombe_sur_le_local() {
        let choix = choisir(
            &Execution { defaut: "api".into(), modes: vec!["local".into(), "api".into()] },
            &["Llama 3.1 8B".into()],
            &Offre { locaux: Some(installes(&["llama3.1:8b"])), cle_api: false, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .expect("le local reste possible");
        assert_eq!(choix.voie, Voie::Local { modele: "llama3.1:8b".into() });
        assert!(choix.bascule);
    }

    /// Une fiche qui n'accepte pas l'API n'y passe pas, même avec une clé.
    #[test]
    fn un_poste_qui_refuse_l_api_n_y_passe_jamais() {
        let motif = choisir(
            &Execution { defaut: "local".into(), modes: vec!["local".into()] },
            &["Llama 3.1 8B".into()],
            &Offre { locaux: None, cle_api: true, memoire_insuffisante: None },
            "claude-sonnet-5",
        )
        .unwrap_err();
        assert!(motif.contains("Llama 3.1 8B"), "motif : {}", motif);
    }

    /// Les paliers doivent arriver sur le poste du client, sinon aucun agent ne
    /// sait quel modèle il lui faut. Deux fichiers que rien d'autre ne lie.
    #[test]
    fn l_installeur_pose_les_paliers_la_ou_le_code_les_cherche() {
        let conf = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tauri.conf.json"))
            .expect("tauri.conf.json introuvable");
        let conf: serde_json::Value = serde_json::from_str(&conf).expect("tauri.conf.json mal formé");
        let pose = conf["bundle"]["resources"]["../../dimensionnement/paliers-modeles.json"]
            .as_str()
            .expect("les paliers de modèles ne sont pas embarqués par l'installeur");
        // `exemples_du_palier()` joint exactement ce chemin au dossier d'installation.
        assert_eq!(pose, "dimensionnement/paliers-modeles.json");
    }

    /// Les paliers du dépôt nomment bien des modèles, et le palier que la
    /// première fiche demande existe. Sans ça, `a_installer` dirait « installez
    /// un modèle de langage » sans savoir lequel.
    #[test]
    fn les_paliers_du_depot_nomment_des_modeles_reconnaissables() {
        let chemin = concat!(env!("CARGO_MANIFEST_DIR"), "/../../dimensionnement/paliers-modeles.json");
        let brut = std::fs::read_to_string(chemin).expect("paliers-modeles.json introuvable");
        let fichier: serde_json::Value = serde_json::from_str(&brut).expect("paliers mal formés");
        let paliers = fichier["paliers"].as_object().expect("aucun palier");

        let texte = paliers.get("texte-standard").expect("le palier texte-standard a disparu");
        let exemples: Vec<String> = texte["exemples"]
            .as_array()
            .expect("aucun exemple")
            .iter()
            .filter_map(serde_json::Value::as_str)
            .map(str::to_string)
            .collect();
        assert!(!exemples.is_empty(), "un palier sans exemple ne dit rien à installer");

        // Chaque exemple doit se reconnaître sous l'écriture du moteur local,
        // sinon un client qui a exactement le bon modèle s'entendra dire qu'il
        // ne l'a pas.
        for exemple in &exemples {
            let (base, taille) = decouper(exemple);
            assert!(!base.is_empty(), "« {} » n'a pas de nom reconnaissable", exemple);
            assert!(!taille.is_empty(), "« {} » ne dit pas sa taille", exemple);
        }
    }

    // -----------------------------------------------------------------------
    // Un vrai moteur local, pour de vrai
    // -----------------------------------------------------------------------

    /// Un moteur local de banc qui parle comme Ollama.
    ///
    /// Le format vient de la bibliothèque publiée par Ollama, pas de mémoire.
    /// Écrit à la main sur un `TcpListener` pour que le banc ne dépende ni du
    /// réseau ni de ce qui est installé sur la machine qui le fait tourner.
    fn moteur_de_banc(reponses: Vec<(String, String)>) -> String {
        let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute locale");
        let port = ecoute.local_addr().expect("adresse").port();
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader, Write};
            let mut restantes = reponses.into_iter();
            for flux in ecoute.incoming() {
                let Ok(mut flux) = flux else { break };
                let mut lecteur = BufReader::new(flux.try_clone().expect("clone"));
                let mut premiere = String::new();
                if lecteur.read_line(&mut premiere).is_err() {
                    continue;
                }
                let Some((_, attendu)) = restantes.next().map(|(c, r)| (c, r)) else {
                    break;
                };
                let reponse = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    attendu.len(),
                    attendu
                );
                let _ = flux.write_all(reponse.as_bytes());
                let _ = flux.flush();
            }
        });
        format!("http://127.0.0.1:{}", port)
    }

    #[tokio::test]
    async fn un_vrai_moteur_local_rend_ses_modeles_et_sa_reponse() {
        let adresse = moteur_de_banc(vec![
            (
                "tags".into(),
                r#"{"models":[{"name":"llama3.1:8b","model":"llama3.1:8b","size":4},{"name":"mistral:7b","model":"mistral:7b","size":4}]}"#.into(),
            ),
            (
                "chat".into(),
                r#"{"model":"llama3.1:8b","message":{"role":"assistant","content":"Bonjour, je vous écoute."},"done":true,"done_reason":"stop"}"#.into(),
            ),
        ]);

        let modeles = modeles_installes(&adresse).await.expect("le moteur répond");
        assert_eq!(modeles.len(), 2);
        assert_eq!(modele_pour(&modeles, &["Llama 3.1 8B".into()]), Some("llama3.1:8b".into()));

        let dit = repondre_en_local(&adresse, "llama3.1:8b", "Tu es secrétaire.", "Bonjour")
            .await
            .expect("le modèle répond");
        assert_eq!(dit, "Bonjour, je vous écoute.");
    }

    /// Un moteur qui n'écoute pas n'est pas une panne de l'application : c'est
    /// un moteur qui n'est pas installé, et ça se dit comme ça.
    #[tokio::test]
    async fn un_moteur_absent_se_dit_sans_jargon() {
        // Un port fermé : on prend un port éphémère et on le referme aussitôt.
        let port = {
            let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute");
            ecoute.local_addr().expect("adresse").port()
        };
        let erreur = modeles_installes(&format!("http://127.0.0.1:{}", port))
            .await
            .unwrap_err();
        assert!(erreur.contains("moteur"), "message : {}", erreur);
        for jargon in ["error", "None", "connection", "tcp"] {
            assert!(!erreur.contains(jargon), "jargon « {} » dans : {}", jargon, erreur);
        }
    }

    /// Un moteur qui répond sans contenu ne doit pas passer pour une réponse
    /// vide de l'agent : le client croirait que son employé n'a rien à dire.
    #[tokio::test]
    async fn une_reponse_vide_du_moteur_est_une_erreur_pas_un_silence() {
        let adresse = moteur_de_banc(vec![(
            "chat".into(),
            r#"{"model":"llama3.1:8b","message":{"role":"assistant","content":"   "},"done":true}"#.into(),
        )]);
        let erreur = repondre_en_local(&adresse, "llama3.1:8b", "s", "e")
            .await
            .unwrap_err();
        assert!(erreur.contains("llama3.1:8b"), "message : {}", erreur);
    }
}
