/**
 * Validates connecteurs/catalogue.json:
 *  - JSON Schema (connecteurs/catalogue.schema.json)
 *  - id unique and matching its category, famille declared, no duplicate appellation
 *  - the activation rule of docs/cadrage.md §4.3 recomputed from outils/activation.ts,
 *    and any divergence with the stored `activation` block refused
 *
 * The rule itself does not fail the bench: today it says 0 of 137 are activable, and a
 * bench that turned that into 137 errors would be switched off within the week. What fails
 * the bench is a catalogue that *lies* about it — a connector marked activable that the
 * rule refuses, a hand-written activation block, a famille nobody declared.
 *
 * Exit code 1 on any failure. `--corriger` rewrites the activation blocks from the rule.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { manques, CONDITIONS, EXIGENCES } from './activation.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p: string) => JSON.parse(readFileSync(join(racine, p), 'utf8'));
const corriger = process.argv.includes('--corriger');

const schema = lire('connecteurs/catalogue.schema.json');
const catalogue = lire('connecteurs/catalogue.json');

let fautes = 0;
const faute = (msg: string) => { fautes++; console.log(`  ✗ ${msg}`); };

const ajv = new Ajv2020({ allErrors: true, strict: false });
const valider = ajv.compile(schema);
if (!valider(catalogue)) {
  for (const e of (valider.errors ?? []).slice(0, 25)) {
    faute(`schéma ${e.instancePath || '/'} : ${e.message}`);
  }
}

const connecteurs: any[] = catalogue.connecteurs ?? [];
const familles = new Set<string>(catalogue.familles ?? []);
const categories = new Set<string>(catalogue.categories ?? []);

// Le préfixe de l'identifiant est ce que les fiches citent : ERP001 doit rester un métier.
// Une catégorie qui bougerait sous un identifiant déjà cité casserait les fiches en silence.
const ids = new Set<string>();
const appellations = new Map<string, string>();
for (const c of connecteurs) {
  if (ids.has(c.id)) faute(`identifiant ${c.id} en double`); else ids.add(c.id);
  if (!familles.has(c.famille)) faute(`${c.nom} : famille « ${c.famille} » non déclarée en tête de fichier`);
  if (!categories.has(c.categorie)) faute(`${c.nom} : catégorie « ${c.categorie} » non déclarée`);
  const k = String(c.nom).trim().toLowerCase();
  if (appellations.has(k)) faute(`appellation « ${c.nom} » portée par ${appellations.get(k)} et ${c.id}`);
  else appellations.set(k, c.id);
}

// Une famille déclarée que personne ne porte est une famille qu'on a cru écrire.
const portees = new Set(connecteurs.map((c) => c.famille));
for (const f of familles) if (!portees.has(f)) faute(`famille « ${f} » déclarée mais portée par aucun connecteur`);

// La règle d'activation : recalculée ici, comparée à ce que le fichier prétend. C'est la
// même fonction que lit l'application ; si les deux divergent, c'est le fichier qui a tort.
const reparations: string[] = [];
for (const c of connecteurs) {
  const attendu = manques(c);
  const ecrit = c.activation ?? {};
  const memeListe =
    Array.isArray(ecrit.manques) &&
    ecrit.manques.length === attendu.length &&
    ecrit.manques.every((m: string, i: number) => m === attendu[i]);
  if (!memeListe || ecrit.activable !== (attendu.length === 0)) {
    if (corriger) {
      c.activation = { activable: attendu.length === 0, manques: attendu };
      reparations.push(c.id);
    } else {
      faute(
        `${c.nom} : bloc activation divergent — la règle dit ${
          attendu.length === 0 ? 'activable' : `manque ${attendu.join(', ')}`
        }`
      );
    }
  }
}

if (corriger && reparations.length) {
  writeFileSync(
    join(racine, 'connecteurs/catalogue.json'),
    JSON.stringify(catalogue, null, 2) + '\n',
    'utf8'
  );
  console.log(`  ⟳ ${reparations.length} bloc(s) activation réécrit(s) depuis la règle`);
}

// Ce que la règle donne aujourd'hui. Ce n'est pas une faute, c'est l'état du chantier : le
// relevé V6 ne chiffre aucun coût et ne classe le risque que des 20 produits qui figurent
// aussi au relevé des serveurs MCP.
const activables = connecteurs.filter((c) => c.activation?.activable);
const compte = new Map<string, number>();
for (const c of connecteurs) for (const m of c.activation?.manques ?? []) compte.set(m, (compte.get(m) ?? 0) + 1);

console.log(`  ⟳ règle d'activation : ${activables.length} connecteur(s) sur ${connecteurs.length} activable(s)`);
for (const cond of CONDITIONS) {
  const n = compte.get(cond) ?? 0;
  if (n) console.log(`  ⟳   ${String(n).padStart(3)} sans ${EXIGENCES[cond]}`);
}

console.log(`${connecteurs.length} connecteurs, ${fautes} faute(s)`);
if (fautes) process.exit(1);
