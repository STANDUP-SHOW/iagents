// The charter lives twice: desktop/src/charte.css (CSS variables) and
// frontend/tailwind.config.js (Tailwind shades). The logo colours must match.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import config from '../tailwind.config.js';

const css = readFileSync(fileURLToPath(new URL('../../desktop/src/charte.css', import.meta.url)), 'utf8');
const variable = (nom) => css.match(new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
const couleurs = config.theme.extend.colors;

const paires = [
  ['cyan', couleurs.neon[400]],
  ['orange', couleurs.braise[500]],
  ['rose', couleurs.rose[500]],
];

let fautes = 0;
for (const [nom, boutique] of paires) {
  const application = variable(nom);
  if (application !== boutique.toLowerCase()) {
    console.error(`  ÉCHEC  --${nom} vaut ${application} dans l'application et ${boutique} dans la boutique`);
    fautes++;
  } else {
    console.log(`  ok  ${nom} ${boutique} des deux côtés`);
  }
}
if (fautes) process.exit(1);
console.log('charte : la boutique et l\'application portent les mêmes couleurs du logo');
