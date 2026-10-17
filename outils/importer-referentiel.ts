/**
 * Écrit connecteurs/referentiel.json, le catalogue que le Desktop Commander montre au
 * client. Voir outils/referentiel.ts.
 *
 *   node --experimental-strip-types outils/importer-referentiel.ts
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construire } from './referentiel.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const sortie = construire(racine);
writeFileSync(join(racine, 'connecteurs/referentiel.json'), JSON.stringify(sortie, null, 2) + '\n');

const compte = (f: string) => sortie.entrees.filter((e) => e.famille === f).length;
console.log(`${sortie.entrees.length} entrées écrites dans connecteurs/referentiel.json`);
for (const f of sortie.familles) console.log(`  ${String(compte(f.id)).padStart(4)} ${f.titre}`);
const branches = sortie.entrees.filter((e) => e.branche);
console.log(`  ${branches.length} branchées : ${branches.map((e) => e.nom).join(', ')}`);
