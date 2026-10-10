/**
 * Refuse un connecteurs/referentiel.json qui ne serait plus ce que l'import en ferait
 * aujourd'hui : un serveur déclaré ou retiré, un moteur que le code ne joint plus, un
 * statut que la règle des quatre confiances ne sait pas ranger.
 *
 *   node --experimental-strip-types outils/verifier-referentiel.ts
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construire, confianceDuStatut } from './referentiel.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
let fautes = 0;
const faute = (m: string) => {
  fautes++;
  console.error(`✗ ${m}`);
};

// La règle des confiances, sur les cas qui l'ont fait écrire.
const attendus: [string, string][] = [
  ['Éditeur vérifié', 'officiel'],
  ['Référence MCP', 'reference'],
  ['Référence archivée / audit requis', 'a-auditer'],
  ['Référence archivée / à maintenir', 'a-auditer'],
  ['Audit requis / API prioritaire', 'a-ecrire'],
  ['Tiers enregistré / audit requis', 'a-auditer'],
  ['Éditeur annoncé / à valider', 'a-auditer'],
  ['Éditeur / package officiel', 'officiel'],
];
for (const [statut, confiance] of attendus) {
  const obtenu = confianceDuStatut(statut);
  if (obtenu !== confiance) faute(`« ${statut} » rangé ${obtenu}, attendu ${confiance}`);
}
let inconnu = false;
try {
  confianceDuStatut('Garanti par un ami');
} catch {
  inconnu = true;
}
if (!inconnu) faute("un statut inconnu doit lever, pas tomber par défaut parmi les officiels");

const attendu = construire(racine);
const ecrit = JSON.parse(readFileSync(join(racine, 'connecteurs/referentiel.json'), 'utf8'));
if (JSON.stringify(ecrit) !== JSON.stringify(attendu)) {
  faute('connecteurs/referentiel.json est périmé : relancer node --experimental-strip-types outils/importer-referentiel.ts');
}

const compte = (f: string) => attendu.entrees.filter((e) => e.famille === f).length;
const tailles: Record<string, number> = { mcp: 74, api: 131, 'ia-cloud': 36, 'ia-locale': 43, creation: 66 };
for (const [f, n] of Object.entries(tailles)) {
  if (compte(f) !== n) faute(`${f} : ${compte(f)} entrées, le relevé de max en porte ${n}`);
}
// Au moins une connexion MCP utilisable de bout en bout : sinon l'écran montrerait un
// catalogue où rien ne se branche, et c'est exactement ce que max ne veut plus.
const utilisables = attendu.entrees.filter(
  (e: any) => e.famille === 'mcp' && e.branche?.par === 'serveur' && e.branche.activable
);
if (utilisables.length === 0) faute('aucun serveur MCP branché et activable');

if (fautes) {
  console.error(`${fautes} faute(s) dans le référentiel des connecteurs`);
  process.exit(1);
}
console.log(
  `✓ référentiel des connecteurs : ${attendu.entrees.length} entrées, ` +
    `${utilisables.length} serveur(s) MCP branché(s) et activable(s)`
);
