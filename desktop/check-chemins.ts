/**
 * Ce que l'application écrit s'écrit-il là où elle a le droit d'écrire ?
 *
 * Constaté le 25/09/2026 sur la 0.2.0 installée par le MSI dans
 * `C:\Program Files\iAgent Desktop` : **non**. Tout passait par le dossier de
 * l'exécutable, où l'utilisateur n'a que la lecture, et l'application tourne
 * sans élévation. Une embauche ne pouvait pas être sauvegardée, les quatre
 * pièces de la voix ne se téléchargeaient pas, et la base de données — ouverte
 * sur `"iagent.db"`, un chemin relatif au dossier courant — atterrissait dans le
 * dossier depuis lequel l'application avait été lancée.
 *
 * Aucune construction ne peut voir ça : le code compile, les bancs passent, et
 * le poste de développement écrit là où il veut parce que son exécutable est
 * dans `target/debug`. Ça ne se découvre que sur une vraie installation — et
 * ça s'est découvert par un symptôme lointain, « l'empreinte vocale n'est pas
 * disponible ».
 *
 * Le banc lit donc les sources Rust et tient trois règles :
 *   1. le dossier livré se demande à UN endroit (`fiches::dossier_ressources`),
 *      pas à une copie privée de plus ;
 *   2. tout chemin de fichier écrit par l'application passe par `chemins::` ;
 *   3. `main` pose le dossier de données dans son `setup`, sans quoi tout le
 *      reste retombe dans un dossier de secours.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const racine = join(import.meta.dirname, 'src-tauri', 'src');
let fautes = 0;
const faute = (m: string) => {
  console.log(`  ✗ ${m}`);
  fautes += 1;
};

/**
 * Le texte d'un fichier, commentaires retirés.
 *
 * Indispensable ici : `database.rs` et `main.rs` CITENT `"iagent.db"` dans le
 * commentaire qui raconte le défaut. Un banc qui lirait les commentaires
 * échouerait sur la description de la faute qu'il vérifie.
 */
const sansCommentaires = (texte: string): string =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const fichiers = readdirSync(racine)
  .filter((n) => n.endsWith('.rs'))
  .map((n) => ({ nom: n, texte: sansCommentaires(readFileSync(join(racine, n), 'utf8')) }));

if (fichiers.length < 10) {
  faute(`${fichiers.length} sources Rust lues : le chemin du dépôt a bougé`);
}

// --- 1. Une seule définition du dossier livré --------------------------------
//
// Il en existait TROIS copies privées identiques (`voice.rs`, `journal.rs`,
// `navigateur.rs`) en plus de celle de `fiches.rs`, et celle de `journal.rs`
// n'honorait même pas `IAGENT_RESSOURCES` : le journal de reprise d'un agent ne
// se trouvait pas en développement.
const DEFINIT_LE_DOSSIER_LIVRE = 'fiches.rs';
for (const { nom, texte } of fichiers) {
  if (!texte.includes('current_exe()')) continue;
  if (nom !== DEFINIT_LE_DOSSIER_LIVRE) {
    faute(
      `${nom} cherche le dossier de l'exécutable lui-même : demandez-le à ` +
        `fiches::dossier_ressources (livré) ou à chemins::pour_ecrire (inscriptible)`
    );
  }
}
if (!fichiers.some((f) => f.nom === DEFINIT_LE_DOSSIER_LIVRE && f.texte.includes('current_exe()'))) {
  faute(`${DEFINIT_LE_DOSSIER_LIVRE} ne définit plus le dossier livré`);
}

// --- 2. Tout ce qui s'écrit passe par chemins:: ------------------------------
//
// La règle porte sur les littéraux, parce que c'est là que le chemin est décidé :
// `config/...` pour tout ce que le client produit, et la base du poste. On
// regarde les 80 caractères qui précèdent, ce qui laisse passer le
// `pour_ecrire(&format!("config/{}", …))` de `journal.rs` et de `mcp.rs`.
const LITTERAUX = /"(config\/[^"]*|iagent\.db)"/g;
for (const { nom, texte } of fichiers) {
  if (nom === 'chemins.rs') continue; // c'est lui qui tient la règle
  for (const m of texte.matchAll(LITTERAUX)) {
    const avant = texte.slice(Math.max(0, m.index - 80), m.index);
    if (!/chemins::pour_(ecrire|lire)\(/.test(avant)) {
      faute(
        `${nom} construit « ${m[1]} » sans passer par chemins:: : sur un poste ` +
          `installé, ce chemin n'est pas inscriptible`
      );
    }
  }
}

// Les pièces téléchargées : leur destination est décidée à un seul endroit.
const telechargement = fichiers.find((f) => f.nom === 'telechargement.rs');
if (!telechargement?.texte.includes('chemins::pour_ecrire(&s.chemin)')) {
  faute(
    'telechargement::ou_poser ne pose plus les pièces sous la racine inscriptible : ' +
      'les quatre fichiers de la voix ne se téléchargeront pas sur un poste installé'
  );
}

// Et leur lecture regarde les deux racines : une pièce livrée par un installeur
// futur doit rester trouvable.
const ressources = fichiers.find((f) => f.nom === 'ressources.rs');
if (!ressources?.texte.includes('chemins::pour_lire(r.chemin)')) {
  faute('ressources::chemin_de ne regarde plus la racine inscriptible');
}

// --- 3. `main` pose le dossier de données, et assez tôt ----------------------
const main = fichiers.find((f) => f.nom === 'main.rs');
if (!main) {
  faute('main.rs introuvable');
} else {
  if (!main.texte.includes('mod chemins;')) {
    faute('main.rs ne déclare pas le module chemins');
  }
  if (!main.texte.includes('poser_dossier_donnees')) {
    faute(
      'main.rs ne pose pas le dossier de données : tout ce que l\u2019application ' +
        'écrit partira dans un dossier de secours temporaire'
    );
  }
  const setup = main.texte.slice(main.texte.indexOf('.setup('));
  const handler = setup.indexOf('.invoke_handler(');
  if (handler < 0) {
    faute('main.rs : le setup ne se lit plus (pas de .invoke_handler après)');
  } else if (!setup.slice(0, handler).includes('ouvrir_la_base(')) {
    faute(
      'main.rs : la base ne s\u2019ouvre pas dans le setup. Ouverte avant, son ' +
        'chemin ne peut pas venir du dossier de données du poste'
    );
  }
  // La base ne doit plus être ouverte sur une chaîne nue.
  if (/Database::new\(\s*"/.test(main.texte)) {
    faute('main.rs ouvre encore la base sur un chemin écrit en dur');
  }
}

console.log(
  `chemins : ${fichiers.length} sources lues, ${fautes} faute(s)`
);
if (fautes) process.exit(1);
