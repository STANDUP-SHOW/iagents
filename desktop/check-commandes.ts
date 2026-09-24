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

// Ce que l'écran appelle. On accepte les deux écritures employées dans le
// dépôt : invoke('x') et invoke<Type>('x').
const appelees = new Map<string, string>();
for (const f of sources(join(racine, 'desktop/src'))) {
  const texte = readFileSync(f, 'utf8');
  for (const m of texte.matchAll(/invoke(?:<[^>]*>)?\(\s*'([a-z_0-9]+)'/g)) {
    if (!appelees.has(m[1])) appelees.set(m[1], f.slice(racine.length + 1));
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
if (enregistrees.size === 0) faute('aucune commande enregistrée trouvée dans main.rs');

for (const [nom, ou] of [...appelees].sort()) {
  if (!enregistrees.has(nom)) {
    faute(`l'écran appelle « ${nom} » (${ou}), que main.rs n'enregistre pas`);
  }
}

console.log(
  `  ⟳ ${appelees.size} commande(s) appelée(s) par l'écran, ${enregistrees.size} enregistrée(s) en Rust`
);
console.log(`commandes : ${fautes} faute(s)`);
if (fautes) process.exit(1);
