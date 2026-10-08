// Derives the two marks the Home site needs from the brand's colour logo
// (charte of max, /mnt/project-files/charte/logo-iagent.svg).
// The original draws the word "iAgent" in white: invisible on a white page.
// Only the seven letter shapes change colour (to the logo's own navy #150041);
// the brain icon keeps its gradients untouched.
//
//   node outils/logo.mjs <logo-iagent.svg>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source) throw new Error('usage : node outils/logo.mjs <chemin du logo-iagent.svg de la charte>');

let svg = readFileSync(source, 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/, '');
const VIEWBOX = 'viewBox="8550 896 4177 1153"';
if (!svg.includes(VIEWBOX)) throw new Error('logo : cadre inattendu, la charte a changé — relire le fichier avant de dériver');

// The letters are the first seven .st3 shapes (all at x >= 10021); the two
// later ones belong to the icon.
let vus = 0;
svg = svg.replace(/class="st3"/g, (m) => (++vus <= 7 ? 'class="lettre"' : m));
if (vus !== 9) throw new Error(`logo : ${vus} formes blanches trouvées, 9 attendues`);
svg = svg.replace('</style>', ' .lettre{fill:#150041;} </style>');
writeFileSync(join(ICI, 'public', 'logo-iagent.svg'), svg);

// Icon alone: same drawing, framed on the brain (letters start at x 10021).
const icone = svg.replace(VIEWBOX, 'viewBox="8540 880 1440 1180"');
writeFileSync(join(ICI, 'public', 'icone.svg'), icone);
console.log('logo-iagent.svg et icone.svg écrits dans public/');
