// Prépare `.fichiers/`, ce que le Worker sert à la plateforme : les fiches
// (`agents/`, `socle/`) copiées octet pour octet — le jeton de licence signe
// leur empreinte, un octet changé ferait refuser l'agent par la Box — et
// `index.json`, la liste par dossier que `depot.ts` indexe avec la même règle
// que sous Node. Rien de ce dossier n'est écrit à la main ni versionné.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { DOSSIERS_FICHES } from '../depot.ts';

const racine = new URL('../../', import.meta.url);
const sortie = new URL('.fichiers/', import.meta.url);
rmSync(sortie, { recursive: true, force: true });
mkdirSync(sortie, { recursive: true });
const index: Record<string, string[]> = {};
for (const d of DOSSIERS_FICHES) {
  const source = new URL(`${d}/`, racine);
  const fichiers = existsSync(source) ? readdirSync(source).filter((f) => f.endsWith('.json')) : [];
  mkdirSync(new URL(`${d}/`, sortie), { recursive: true });
  for (const f of fichiers) cpSync(new URL(f, source), new URL(`${d}/${f}`, sortie));
  index[d] = fichiers;
}
writeFileSync(new URL('index.json', sortie), JSON.stringify(index));
console.log(`.fichiers/ : ${Object.entries(index).map(([d, f]) => `${f.length} dans ${d}/`).join(', ')}`);
