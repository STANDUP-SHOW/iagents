fn main() {
  edition_box();
  tauri_build::build()
}

/// The Box build (`IAGENT_EDITION=box`) must carry its platform address and
/// key in the binary: without them it would still read them from the user's
/// folder, so a Box that could be pointed at another server would leave the
/// factory without a word. The build stops instead.
fn edition_box() {
  for v in ["IAGENT_EDITION", "IAGENT_PLATEFORME_URL", "IAGENT_CLE_PLATEFORME"] {
    println!("cargo:rerun-if-env-changed={}", v);
  }
  let lire = |v: &str| std::env::var(v).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
  match lire("IAGENT_EDITION").as_deref() {
    None | Some("libre") => return,
    Some("box") => {}
    Some(autre) => panic!("IAGENT_EDITION vaut « {} » : seules « box » et « libre » sont reconnues.", autre),
  }
  let mut fautes = vec![];
  match lire("IAGENT_PLATEFORME_URL") {
    None => fautes.push("IAGENT_PLATEFORME_URL manque".to_string()),
    Some(u) if !u.starts_with("https://") => fautes.push(format!("IAGENT_PLATEFORME_URL doit commencer par https:// (lu : {})", u)),
    _ => {}
  }
  match lire("IAGENT_CLE_PLATEFORME") {
    None => fautes.push("IAGENT_CLE_PLATEFORME manque".to_string()),
    Some(c) if !c.contains("BEGIN PUBLIC KEY") => fautes.push("IAGENT_CLE_PLATEFORME n'est pas une clé publique PEM".to_string()),
    _ => {}
  }
  if !fautes.is_empty() {
    panic!(
      "Construction « Box » refusée : {}. Une Box sans adresse ni clé de plateforme compilées pourrait être reliée à un autre serveur.",
      fautes.join(" ; ")
    );
  }
}
