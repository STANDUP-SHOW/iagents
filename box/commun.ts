// What the box/ benches share: the repository root, the `verifier` counter in the
// style of plateforme/controle/banc.ts, a JSON-schema validator (ajv, already a
// dependency) and the gammes read from plateforme/modele.ts itself, never retyped.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';

export const RACINE = fileURLToPath(new URL('../', import.meta.url));

export function compteur(titre: string) {
  let fautes = 0;
  let controles = 0;
  const verifier = (quoi: string, vrai: boolean, detail = ''): void => {
    controles++;
    if (vrai) console.log(`  ok  ${quoi}`);
    else { fautes++; console.log(`  FAUTE  ${quoi}${detail ? ` — ${detail}` : ''}`); }
  };
  const bilan = (): number => {
    console.log(`  ${titre} : ${controles} contrôles, ${fautes} faute(s)`);
    return fautes;
  };
  return { verifier, bilan };
}

export const lireJson = <T = unknown>(relatif: string): T => JSON.parse(readFileSync(join(RACINE, relatif), 'utf8')) as T;

export const fichiersJson = (dossier: string): string[] =>
  readdirSync(join(RACINE, dossier)).filter((f) => f.endsWith('.json') && f !== 'schema.json').sort();

/** Compiles a JSON schema file; returns the error list for a value (empty = valid). */
export function validateur(schemaRelatif: string): (valeur: unknown) => string[] {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const valider = ajv.compile(lireJson(schemaRelatif));
  return (valeur) => (valider(valeur) ? [] : (valider.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim()));
}

/**
 * The two gammes, read in the text of plateforme/modele.ts (`gamme: 'business' | 'home'`),
 * exactly as check-connecteurs.ts compares field names across files: retyped here,
 * a third gamme in the model would never be noticed by these benches.
 */
export function gammesDuModele(): string[] {
  const texte = readFileSync(join(RACINE, 'plateforme/modele.ts'), 'utf8');
  const m = texte.match(/^\s*gamme: ([^;]+);/m);
  if (!m) throw new Error('plateforme/modele.ts : le champ `gamme` de Box est introuvable.');
  return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
}

/** Factory test ids present in box/usine/tests (files `NN_<id>.py`). */
export function testsUsineConnus(): Set<string> {
  const dossier = join(RACINE, 'box/usine/tests');
  const ids = new Set<string>();
  for (const f of readdirSync(dossier)) {
    const m = f.match(/^\d{2}_([a-z][a-z0-9_]*)\.py$/);
    if (m) ids.add(m[1].replace(/_/g, '-'));
  }
  return ids;
}

export const estMain = (url: string): boolean => url === `file://${process.argv[1]}` || url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href;
