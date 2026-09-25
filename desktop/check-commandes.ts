/**
 * Toute commande que l'écran appelle existe-t-elle vraiment ?
 *
 * `invoke('nom_de_commande')` est une chaîne de caractères : ni TypeScript ni
 * Rust ne la relient à quoi que ce soit. Une commande mal orthographiée, ou
 * retirée de `generate_handler!` au cours d'un remaniement, ne fait échouer
 * aucune construction — elle échoue chez le client, au clic, avec un message
 * de Tauri en anglais.
 *
 * C'est la même famille de fautes que celle qui a coûté deux corrections le
 * 24/09/2026 : un `find` sur un champ absent d'une liste typée `any[]`, et des
 * noms de champs Rust recopiés en camelCase côté écran. Aucune ne casse une
 * construction ; toutes rendent `undefined` ou lèvent à l'exécution.
 *
 * Le banc compare donc les deux listes, lues dans les fichiers.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const racine = join(import.meta.dirname, '..');
let fautes = 0;
const faute = (m: string) => {
  console.log(`  ✗ ${m}`);
  fautes += 1;
};

/** Tous les .ts et .tsx de l'écran, sans node_modules ni les bancs. */
const sources = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((n) => {
    const chemin = join(dossier, n);
    if (n === 'node_modules' || n.startsWith('.')) return [];
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.tsx?$/.test(n) ? [chemin] : [];
  });

/** Le texte d'un fichier, commentaires retirés, pour ne pas lire un nom cité en prose. */
const sansCommentaires = (texte: string): string =>
  texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Ce que l'écran appelle DIRECTEMENT. On accepte les écritures employées dans le
// dépôt : invoke('x'), invoke<Type>('x'), et `invoquer('x')` — l'invoke que
// `team-holder.ts` reçoit en paramètre pour être éprouvé sans Tauri. C'est cette
// liste, et pas la suivante, qui sert à repérer un nom mal orthographié : elle ne
// contient que des noms dont on est sûr qu'ils partent vers Tauri.
const appelees = new Map<string, string>();
// Et ce que l'écran NOMME, où que ce soit — y compris un nom passé à un crochet
// partagé, comme `useReleve('whatsapp_relever', …)`. Sans cette seconde lecture,
// sortir une boucle dans un crochet suffisait à faire croire au banc que la
// commande n'était plus branchée. Les commentaires sont retirés d'abord : un nom
// cité en prose n'est pas un appel.
const nommees = new Set<string>();
for (const f of sources(join(racine, 'desktop/src'))) {
  const texte = readFileSync(f, 'utf8');
  for (const m of texte.matchAll(/invoke[a-z]*(?:<[^>]*>)?\(\s*'([a-z_0-9]+)'/g)) {
    if (!appelees.has(m[1])) appelees.set(m[1], f.slice(racine.length + 1));
  }
  for (const m of sansCommentaires(texte).matchAll(/['"`]([a-z][a-z_0-9]{3,})['"`]/g)) {
    nommees.add(m[1]);
  }
}

// Ce que Rust enregistre. Le chemin de module ne compte pas : Tauri expose le
// dernier segment (telechargement::voix_a_installer -> voix_a_installer).
const main = readFileSync(join(racine, 'desktop/src-tauri/src/main.rs'), 'utf8');
const bloc = main.match(/generate_handler!\s*\[([\s\S]*?)\]/);
if (!bloc) {
  faute("le bloc generate_handler! est introuvable dans main.rs : le banc ne compare rien");
}
const enregistrees = new Set(
  (bloc?.[1] ?? '')
    .split(',')
    .map((l) => l.replace(/\/\/[^\n]*/g, '').trim())
    .filter(Boolean)
    .map((l) => l.split('::').pop() ?? l)
);

// Le banc ne sert à rien s'il ne lit rien : une expression régulière qui cesse
// de trouver passerait pour un dépôt sans faute.
if (appelees.size === 0) faute("aucun invoke() trouvé dans desktop/src : le banc ne lit plus rien");
if (nommees.size === 0) faute('aucun nom de commande lu dans desktop/src : le banc ne lit plus rien');
if (enregistrees.size === 0) faute('aucune commande enregistrée trouvée dans main.rs');

for (const [nom, ou] of [...appelees].sort()) {
  if (!enregistrees.has(nom)) {
    faute(`l'écran appelle « ${nom} » (${ou}), que main.rs n'enregistre pas`);
  }
}

// --- L'autre sens : enregistrée, mais que personne n'appelle -----------------
//
// C'est le cas que le mémo du dépôt appelle dangereux, et le seul des deux que
// ce banc ne regardait pas. Une commande enregistrée sans appelant a l'air
// vivante : elle passe la construction, elle passe le sens ci-dessus, et
// personne ne voit qu'elle ne sert à rien. Les cinq commandes WhatsApp ont
// vécu comme ça — `whatsapp.rs` savait envoyer et relever, `main.rs` les
// exposait, et sur un poste installé le client n'avait aucun moyen de poser son
// jeton.
//
// La liste ci-dessous n'est pas une liste de dispenses : c'est l'inventaire de
// ce qui est dans cet état AUJOURD'HUI, mesuré et non supposé. Elle ne peut que
// rétrécir — brancher une commande oblige à la retirer d'ici, et enregistrer
// une commande sans appelant fait échouer le banc en la nommant.
const SANS_APPELANT = [
  // Les commandes anglaises du premier jet, d'avant les écrans français.
  // Aucune n'est atteignable ; aucune n'a encore été relue pour être retirée.
  'greet',
  'start_voice_recognition',
  'stop_voice_recognition',
  'process_voice_audio',
  'call_agent_llm',
  'route_voice_command',
  'get_agents',
  'activate_agent',
  'deactivate_agent',
  'train_voice',
  // MCP : le portier est complet, le passage n'est pas écrit. C'est documenté
  // dans le mémo et attendu, pas oublié.
  'mcp_outils_permis',
  'mcp_appeler',
  'mcp_journal',
  // Le courrier : l'écran sait rédiger et envoyer, pas relever.
  'courriel_enregistrer_motdepasse',
  'courriel_motdepasse_present',
  'courriel_relever',
  // Le journal de reprise : le Team Holder lit les reproches du client,
  // personne n'en ajoute depuis l'écran.
  'journal_ajouter',
  // Le navigateur se ferme par sa fenêtre, pas par un bouton de l'écran.
  'navigateur_fermer',
];

const attendues = new Set(SANS_APPELANT);
for (const nom of [...enregistrees].sort()) {
  if (nommees.has(nom) || attendues.has(nom)) continue;
  faute(
    `main.rs enregistre « ${nom} », que l'écran n'appelle jamais : branchez-la, ` +
      'ou inscrivez-la dans SANS_APPELANT en disant pourquoi'
  );
}

// La liste ne doit pas pourrir : ni garder une commande devenue atteignable, ni
// nommer une commande que Rust n'enregistre plus.
for (const nom of SANS_APPELANT) {
  if (nommees.has(nom)) {
    faute(`« ${nom} » est appelée par l'écran : retirez-la de SANS_APPELANT`);
  } else if (!enregistrees.has(nom)) {
    faute(`SANS_APPELANT nomme « ${nom} », que main.rs n'enregistre pas`);
  }
}

// --- Les noms de champs, des deux côtés de la frontière ----------------------
//
// Le dépôt n'emploie pas `rename_all` : un champ d'une structure Rust traverse
// vers l'écran avec SON nom, `recu_le` et non `recuLe`. Écrit en camelCase côté
// React, il ne fait échouer ni le compilateur ni l'exécution — il rend
// `undefined`, et l'heure d'un message disparaît de l'écran sans un mot.
//
// Le banc lit donc les deux fichiers. Les ARGUMENTS d'une commande, eux, sont
// bien convertis par Tauri (`numeroId` en JavaScript arrive en `numero_id`) :
// ce n'est que les champs des structures qui ne le sont pas.
const STRUCTURES: { rust: string; ecran: string; nom: string }[] = [
  { rust: 'desktop/src-tauri/src/whatsapp.rs', ecran: 'desktop/src/components/WhatsApp.tsx', nom: 'MessageRecu' },
  { rust: 'desktop/src-tauri/src/telegram.rs', ecran: 'desktop/src/components/Telegram.tsx', nom: 'MessageRecu' },
  // Les deux `Releve` de Rust ont la même forme exprès, et l'écran n'en tient
  // qu'une, générique, dans le crochet partagé : le banc la compare aux deux.
  { rust: 'desktop/src-tauri/src/whatsapp.rs', ecran: 'desktop/src/components/useReleve.ts', nom: 'Releve' },
  { rust: 'desktop/src-tauri/src/telegram.rs', ecran: 'desktop/src/components/useReleve.ts', nom: 'Releve' },
  // L'empreinte vocale : trois nombres et une phrase, et c'est tout ce que le
  // son laisse sortir de Rust.
  {
    rust: 'desktop/src-tauri/src/voiceprint.rs',
    ecran: 'desktop/src/components/VoiceTraining.tsx',
    nom: 'Comparaison',
  },
];

/** Le corps d'un bloc nommé, de son `{` à l'accolade qui lui répond. */
const corps = (texte: string, ouverture: RegExp): string | null => {
  const debut = texte.match(ouverture);
  if (!debut || debut.index === undefined) return null;
  let profondeur = 0;
  for (let i = texte.indexOf('{', debut.index); i < texte.length; i += 1) {
    if (texte[i] === '{') profondeur += 1;
    else if (texte[i] === '}') {
      profondeur -= 1;
      if (profondeur === 0) return texte.slice(texte.indexOf('{', debut.index) + 1, i);
    }
  }
  return null;
};

/** Un fichier lu sans lever : un banc doit rendre une faute, pas une pile d'appels. */
const lire = (chemin: string): string | null => {
  try {
    return readFileSync(join(racine, chemin), 'utf8');
  } catch {
    return null;
  }
};

for (const s of STRUCTURES) {
  const texteRust = lire(s.rust);
  const texteEcran = lire(s.ecran);
  if (texteRust === null) {
    faute(`${s.nom} : ${s.rust} est introuvable`);
    continue;
  }
  if (texteEcran === null) {
    faute(`${s.nom} : ${s.ecran} est introuvable`);
    continue;
  }
  const rust = corps(texteRust, new RegExp(`pub struct ${s.nom}\\b[^{]*`));
  const ecran = corps(texteEcran, new RegExp(`type ${s.nom}\\b[^{]*=[^{]*`));
  if (rust === null) {
    faute(`${s.nom} : la structure est introuvable dans ${s.rust}`);
    continue;
  }
  if (ecran === null) {
    faute(`${s.nom} : le type est introuvable dans ${s.ecran}`);
    continue;
  }
  const champsRust = [...rust.matchAll(/^\s*pub ([a-z_0-9]+)\s*:/gm)].map((m) => m[1]);
  const champsEcran = [...ecran.matchAll(/^\s*([A-Za-z_0-9]+)\s*:/gm)].map((m) => m[1]);
  if (champsRust.length === 0) faute(`${s.nom} : aucun champ lu côté Rust, le banc ne compare rien`);
  if (champsEcran.length === 0) faute(`${s.nom} : aucun champ lu côté écran, le banc ne compare rien`);
  for (const c of champsRust) {
    if (!champsEcran.includes(c)) {
      faute(`${s.nom} : Rust envoie « ${c} », que ${s.ecran} ne déclare pas`);
    }
  }
  for (const c of champsEcran) {
    if (!champsRust.includes(c)) {
      faute(`${s.nom} : ${s.ecran} attend « ${c} », que Rust n'envoie pas (il rendrait undefined)`);
    }
  }
}

console.log(
  `  ⟳ ${appelees.size} commande(s) appelée(s) par l'écran, ${enregistrees.size} enregistrée(s) en Rust, ` +
    `${SANS_APPELANT.length} sans appelant`
);
console.log(`commandes : ${fautes} faute(s)`);
if (fautes) process.exit(1);
