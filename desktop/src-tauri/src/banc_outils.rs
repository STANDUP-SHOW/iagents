//! Les deux boucles de conversation outillées, éprouvées contre un modèle de
//! banc : un serveur HTTP écrit à la main sur la boucle locale, à qui l'on donne
//! d'avance ses réponses, et qui garde ce qu'on lui a envoyé.
//!
//! Ce qui est vérifié est ce qu'aucune construction ne voit : que la requête
//! porte bien les outils, que la demande du modèle atteint l'exécuteur avec ses
//! arguments, et que le résultat repart au tour suivant sous la forme que
//! chaque voie exige. Le portier lui-même (`mcp::Atelier`) a ses propres bancs.

use crate::llm::{AgentPersona, LLMService};
use crate::mcp::{Executeur, OutilOffert};
use std::sync::{Arc, Mutex};

/// Un exécuteur de banc : un seul outil, qui rend ce qu'on lui a dit de rendre
/// et note ce qu'on lui a demandé.
struct ExecuteurDeBanc {
    demandes: Vec<(String, serde_json::Value)>,
}

impl Executeur for ExecuteurDeBanc {
    fn offerts(&self) -> Vec<OutilOffert> {
        vec![OutilOffert {
            nom_pour_le_modele: "fichiers__read_text_file".into(),
            serveur: "fichiers".into(),
            outil: "read_text_file".into(),
            description: "Lit un fichier texte".into(),
            schema: serde_json::json!({
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"]
            }),
            lecture_seule: true,
        }]
    }
    fn executer(&mut self, nom: &str, arguments: serde_json::Value) -> (String, bool) {
        self.demandes.push((nom.to_string(), arguments));
        ("Devis 2026-118 : 4 250,00 € HT, client Imprimerie Martin".into(), false)
    }
    fn resume(&self) -> Vec<String> {
        self.demandes.iter().map(|(n, _)| format!("{} : fait", n)).collect()
    }
}

/// Un modèle de banc : rend ses réponses dans l'ordre, garde les corps reçus.
fn modele_de_banc(reponses: Vec<serde_json::Value>) -> (String, Arc<Mutex<Vec<serde_json::Value>>>) {
    let ecoute = std::net::TcpListener::bind("127.0.0.1:0").expect("écoute locale");
    let port = ecoute.local_addr().expect("adresse").port();
    let recus = Arc::new(Mutex::new(Vec::new()));
    let garde = recus.clone();
    std::thread::spawn(move || {
        use std::io::{BufRead, BufReader, Read, Write};
        let mut restantes = reponses.into_iter();
        for flux in ecoute.incoming() {
            let Ok(mut flux) = flux else { break };
            let mut lecteur = BufReader::new(flux.try_clone().expect("clone"));
            let mut longueur = 0usize;
            loop {
                let mut ligne = String::new();
                if lecteur.read_line(&mut ligne).unwrap_or(0) == 0 {
                    break;
                }
                let l = ligne.trim_end();
                if l.is_empty() {
                    break;
                }
                if let Some((nom, valeur)) = l.split_once(':') {
                    if nom.eq_ignore_ascii_case("content-length") {
                        longueur = valeur.trim().parse().unwrap_or(0);
                    }
                }
            }
            let mut corps = vec![0u8; longueur];
            let _ = lecteur.read_exact(&mut corps);
            if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&corps) {
                garde.lock().expect("garde").push(v);
            }
            let rendu = restantes.next().map(|v| v.to_string()).unwrap_or_default();
            let reponse = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                rendu.len(),
                rendu
            );
            let _ = flux.write_all(reponse.as_bytes());
            let _ = flux.flush();
        }
    });
    (format!("http://127.0.0.1:{}", port), recus)
}

fn persona() -> AgentPersona {
    AgentPersona {
        id: "Paul".into(),
        name: "Paul".into(),
        role: String::new(),
        system_prompt: "Vous êtes Paul, deviseur en imprimerie.".into(),
    }
}

/// La voie de l'API : le modèle demande un outil, l'outil travaille, le
/// résultat repart, le modèle conclut.
#[tokio::test(flavor = "multi_thread")]
async fn l_api_recoit_les_outils_et_le_resultat_repart_au_tour_suivant() {
    let (adresse, recus) = modele_de_banc(vec![
        serde_json::json!({
            "stop_reason": "tool_use",
            "content": [
                { "type": "text", "text": "Je regarde le devis." },
                { "type": "tool_use", "id": "toolu_1", "name": "fichiers__read_text_file",
                  "input": { "path": "devis.txt" } }
            ]
        }),
        serde_json::json!({
            "stop_reason": "end_turn",
            "content": [{ "type": "text", "text": "Le devis 2026-118 fait 4 250,00 € HT." }]
        }),
    ]);
    let service = LLMService::vers("sk-ant-banc", &format!("{}/v1/messages", adresse));
    let mut executeur = ExecuteurDeBanc { demandes: Vec::new() };

    let reponse = service
        .call_agent_llm_outille(&persona(), "Combien fait le devis ?", &mut executeur)
        .await
        .expect("conversation outillée");

    assert_eq!(reponse.texte, "Le devis 2026-118 fait 4 250,00 € HT.");
    assert_eq!(executeur.demandes.len(), 1);
    assert_eq!(executeur.demandes[0].1["path"], "devis.txt");
    assert_eq!(reponse.outils, vec!["fichiers__read_text_file : fait"]);

    let recus = recus.lock().expect("reçus");
    assert_eq!(recus.len(), 2, "deux tours, deux requêtes");
    // Le premier tour porte les outils : c'est ce qui manquait au dépôt.
    assert_eq!(recus[0]["tools"][0]["name"], "fichiers__read_text_file");
    assert_eq!(recus[0]["tools"][0]["input_schema"]["required"][0], "path");
    // Le second rend au modèle son propre tour, puis le résultat qui lui répond.
    let messages = recus[1]["messages"].as_array().expect("messages");
    assert_eq!(messages.len(), 3);
    assert_eq!(messages[1]["role"], "assistant");
    assert_eq!(messages[1]["content"][1]["type"], "tool_use");
    let resultat = &messages[2]["content"][0];
    assert_eq!(resultat["type"], "tool_result");
    assert_eq!(resultat["tool_use_id"], "toolu_1");
    assert!(resultat["content"].as_str().unwrap().contains("4 250,00"));
    assert_eq!(resultat["is_error"], false);
}

/// Sans outil, la requête est celle d'avant : aucune clé `tools` vide, que
/// l'API refuserait.
#[tokio::test(flavor = "multi_thread")]
async fn sans_outil_la_conversation_reste_celle_d_avant() {
    let (adresse, recus) = modele_de_banc(vec![serde_json::json!({
        "stop_reason": "end_turn",
        "content": [{ "type": "text", "text": "Bonjour." }]
    })]);
    let service = LLMService::vers("sk-ant-banc", &format!("{}/v1/messages", adresse));
    let reponse = service
        .call_agent_llm_outille(&persona(), "Bonjour", &mut crate::mcp::SansOutil)
        .await
        .expect("conversation");
    assert_eq!(reponse.texte, "Bonjour.");
    assert!(recus.lock().expect("reçus")[0].get("tools").is_none());
}

/// Un modèle qui ne conclut jamais est arrêté, et le client lit pourquoi.
#[tokio::test(flavor = "multi_thread")]
async fn un_modele_qui_tourne_en_rond_est_arrete() {
    let tour = serde_json::json!({
        "stop_reason": "tool_use",
        "content": [{ "type": "tool_use", "id": "t", "name": "fichiers__read_text_file", "input": { "path": "a" } }]
    });
    let (adresse, _) = modele_de_banc(vec![tour; crate::llm::TOURS_MAX + 2]);
    let service = LLMService::vers("sk-ant-banc", &format!("{}/v1/messages", adresse));
    let mut executeur = ExecuteurDeBanc { demandes: Vec::new() };
    let refus = service
        .call_agent_llm_outille(&persona(), "?", &mut executeur)
        .await
        .expect_err("une boucle sans fin doit s'arrêter");
    assert!(refus.contains("arrêtée"), "{}", refus);
    assert_eq!(executeur.demandes.len(), crate::llm::TOURS_MAX);
}

/// La voie locale, au format relevé chez Ollama : `arguments` est un objet, et
/// le résultat repart en message `tool`.
#[tokio::test(flavor = "multi_thread")]
async fn le_moteur_local_recoit_les_outils_au_format_d_ollama() {
    let (adresse, recus) = modele_de_banc(vec![
        serde_json::json!({
            "message": { "role": "assistant", "content": "",
                "tool_calls": [{ "function": { "name": "fichiers__read_text_file",
                                               "arguments": { "path": "devis.txt" } } }] },
            "done": true
        }),
        serde_json::json!({
            "message": { "role": "assistant", "content": "Le devis fait 4 250,00 € HT." },
            "done": true
        }),
    ]);
    let mut executeur = ExecuteurDeBanc { demandes: Vec::new() };
    let reponse = crate::modele::repondre_en_local_outille(
        &adresse,
        "llama3.1:8b",
        "Vous êtes Paul.",
        "Combien fait le devis ?",
        &mut executeur,
    )
    .await
    .expect("conversation locale outillée");

    assert_eq!(reponse.texte, "Le devis fait 4 250,00 € HT.");
    assert_eq!(executeur.demandes[0].1["path"], "devis.txt");
    let recus = recus.lock().expect("reçus");
    assert_eq!(recus[0]["tools"][0]["type"], "function");
    assert_eq!(recus[0]["tools"][0]["function"]["name"], "fichiers__read_text_file");
    let messages = recus[1]["messages"].as_array().expect("messages");
    let dernier = messages.last().expect("dernier");
    assert_eq!(dernier["role"], "tool");
    assert_eq!(dernier["tool_name"], "fichiers__read_text_file");
    assert!(dernier["content"].as_str().unwrap().contains("4 250,00"));
}

/// De bout en bout, pour de vrai : la fiche de démonstration AG-0179 (Carla),
/// le catalogue, la déclaration du dépôt, et le vrai serveur de fichiers de
/// référence lancé par `npx` — rien de simulé sauf le modèle, qui demande de
/// lire un devis posé dans le dossier de Carla.
///
/// Ignoré par défaut : il télécharge le serveur au registre npm la première
/// fois, et le banc ne doit pas dépendre du réseau. À lancer avec
/// `cargo test --bin iagent-desktop de_bout_en_bout -- --ignored`.
#[tokio::test(flavor = "multi_thread")]
#[ignore]
async fn de_bout_en_bout_avec_le_vrai_serveur_de_fichiers() {
    let depot = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..").canonicalize().expect("dépôt");
    let bac = std::env::temp_dir().join(format!("iagent-bout-en-bout-{}", std::process::id()));
    let maison = bac.join("maison");
    let donnees = bac.join("donnees");
    std::env::set_var("IAGENT_RESSOURCES", &depot);
    std::env::set_var("IAGENT_DONNEES", &donnees);
    let installation = crate::chemins::pour_ecrire("config/installation.json");
    std::fs::create_dir_all(installation.parent().expect("dossier")).expect("données");
    std::fs::copy(depot.join("desktop/src/config/installation.json"), &installation)
        .expect("installation de démonstration");
    std::env::set_var("HOME", &maison);
    std::env::set_var("USERPROFILE", &maison);

    let dossier_de_carla = crate::tache::dossier_par_defaut("Carla").expect("dossier de Carla");
    std::fs::create_dir_all(&dossier_de_carla).expect("dossier");
    let devis = dossier_de_carla.join("devis-2026-118.txt");
    std::fs::write(&devis, "Devis 2026-118\nClient : Imprimerie Martin\nTotal : 4 250,00 € HT\n").expect("devis");

    let (atelier, indisponibles) = crate::mcp::atelier_pour("AG-0179", "Carla").await;
    let mut atelier = atelier.unwrap_or_else(|| panic!("atelier fermé : {:?}", indisponibles));
    assert!(indisponibles.is_empty(), "outils indisponibles : {:?}", indisponibles);
    let noms: Vec<String> = atelier.offerts().into_iter().map(|o| o.nom_pour_le_modele).collect();
    eprintln!("outils offerts à Carla : {:?}", noms);
    assert!(noms.contains(&"fichiers__read_text_file".to_string()));
    assert!(noms.contains(&"fichiers__write_file".to_string()));

    let (adresse, recus) = modele_de_banc(vec![
        serde_json::json!({
            "stop_reason": "tool_use",
            "content": [
                { "type": "tool_use", "id": "t1", "name": "fichiers__read_text_file",
                  "input": { "path": devis.display().to_string() } },
                { "type": "tool_use", "id": "t2", "name": "fichiers__write_file",
                  "input": { "path": dossier_de_carla.join("note.txt").display().to_string(), "content": "x" } },
                { "type": "tool_use", "id": "t3", "name": "fichiers__read_text_file",
                  "input": { "path": "/etc/hostname" } }
            ]
        }),
        serde_json::json!({
            "stop_reason": "end_turn",
            "content": [{ "type": "text", "text": "Le devis 2026-118 fait 4 250,00 € HT." }]
        }),
    ]);
    let service = LLMService::vers("sk-ant-banc", &format!("{}/v1/messages", adresse));
    let reponse = service
        .call_agent_llm_outille(&persona(), "Combien fait le devis ?", &mut atelier)
        .await
        .expect("conversation");
    let appels = atelier.appels();
    atelier.fermer().expect("journal");

    let recus = recus.lock().expect("reçus");
    let resultats = &recus[1]["messages"][2]["content"];
    eprintln!("ce que le serveur a rendu au modèle : {}", serde_json::to_string_pretty(resultats).unwrap());
    // Lu : le vrai fichier, par le vrai serveur.
    assert_eq!(resultats[0]["is_error"], false);
    assert!(resultats[0]["content"].as_str().unwrap().contains("4 250,00 € HT"));
    // Écrire sans le client : refusé par le portier, avant le serveur.
    assert_eq!(resultats[1]["is_error"], true);
    assert!(!dossier_de_carla.join("note.txt").exists(), "rien ne doit avoir été écrit");
    // Hors du dossier de Carla : refusé par le serveur lui-même.
    assert_eq!(resultats[2]["is_error"], true);
    assert_eq!(reponse.texte, "Le devis 2026-118 fait 4 250,00 € HT.");
    eprintln!("journal : {:?}", appels);
    assert_eq!(
        appels.iter().map(|a| a.abouti).collect::<Vec<_>>(),
        vec![true, false, false],
        "le refus du serveur doit se lire au journal comme un refus"
    );
    let journal = std::fs::read_to_string(crate::chemins::pour_ecrire(&format!(
        "config/outils-{}.json",
        crate::journal::nom_propre("Carla").expect("prénom")
    )))
    .expect("journal écrit");
    assert!(journal.contains("read_text_file"));
    let _ = std::fs::remove_dir_all(&bac);
}
