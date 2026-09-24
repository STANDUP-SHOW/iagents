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
import { sertQuoi, CAPACITES, SERVI_PAR_L_APPLICATION, type Capacite } from './capacites.ts';
import { convertir as convertirPacks, type Pack } from './packs-secteurs.ts';
import { readdirSync } from 'node:fs';

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

// Les besoins de fiche : même recalcul, même refus de divergence.
for (const c of connecteurs) {
  const attendu = sertQuoi(c);
  const ecrit: string[] = Array.isArray(c.sert) ? c.sert : [];
  if (ecrit.length !== attendu.length || ecrit.some((v, i) => v !== attendu[i])) {
    if (corriger) {
      c.sert = attendu;
      if (!reparations.includes(c.id)) reparations.push(c.id);
    } else {
      faute(`${c.nom} : bloc sert divergent — la table dit ${attendu.join(', ') || '(rien)'}`);
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

// Chaque besoin qu'une fiche déclare doit trouver quelqu'un pour le servir : un connecteur
// du catalogue, ou l'application elle-même. Un besoin que personne ne couvre est une promesse
// de la boutique que rien ne tient — et un mot renommé dans une fiche le ferait apparaître ici.
const besoins = new Map<string, number>();
const dossierAgents = join(racine, 'agents');
const fichiers = readdirSync(dossierAgents).filter((f) => f.endsWith('.json'));
// Un banc qui ne lit rien passe toujours. Celui-ci dit combien de fiches il a ouvertes.
if (fichiers.length < 1000) faute(`seulement ${fichiers.length} fiche(s) lues dans agents/`);
const secteursDesFiches = new Map<string, number>();
for (const f of fichiers) {
  const fiche = JSON.parse(readFileSync(join(dossierAgents, f), 'utf8'));
  for (const b of fiche.connecteurs ?? []) besoins.set(b, (besoins.get(b) ?? 0) + 1);
  if (fiche.secteur) secteursDesFiches.set(fiche.secteur, (secteursDesFiches.get(fiche.secteur) ?? 0) + 1);
}

// --- Les packs sectoriels : recalculés, comparés, et confrontés aux fiches -------------
const { packs: packsAttendus, inconnus } = convertirPacks(
  lire('catalogue/reference/packs-erp-crm.json').entrees,
  new Set(connecteurs.map((c) => c.id as string))
);
const packsEcrits: Pack[] = catalogue.packs ?? [];

if (JSON.stringify(packsEcrits) !== JSON.stringify(packsAttendus)) {
  if (corriger) {
    catalogue.packs = packsAttendus;
    reparations.push(`${packsAttendus.length} pack(s) sectoriel(s)`);
  } else {
    faute('les packs sectoriels écrits divergent du relevé — relancer npm run importer-connecteurs');
  }
}

// Un pack qui cite un connecteur absent du catalogue promettrait au client un outil
// qui n'existe pas. C'est ainsi qu'on a vu que les six connecteurs RH étaient jetés.
for (const { secteur, id } of inconnus) {
  faute(`le pack « ${secteur} » cite ${id}, que le catalogue ne connaît pas`);
}

// Un secteur de fiches sans pack retombe sur la proposition par besoin, plus large et
// moins juste. Ce n'est pas une faute du code, c'est un trou du relevé : on le nomme.
const avecPack = new Set(packsAttendus.map((p) => p.secteur));
const secteursSansPack = [...secteursDesFiches].filter(([s]) => !avecPack.has(s));
const packsSansFiche = packsAttendus.filter((p) => !secteursDesFiches.has(p.secteur));
for (const p of packsSansFiche) {
  faute(`le pack « ${p.secteur} » ne correspond à aucun secteur de fiche`);
}
for (const [besoin, combien] of [...besoins].sort((a, b) => b[1] - a[1])) {
  if (!CAPACITES.includes(besoin as Capacite)) {
    faute(`${combien} fiche(s) déclarent « ${besoin} », que outils/capacites.ts ne connaît pas`);
    continue;
  }
  const porteurs = connecteurs.filter((c) => (c.sert ?? []).includes(besoin));
  if (porteurs.length === 0 && !(besoin in SERVI_PAR_L_APPLICATION)) {
    faute(`${combien} fiche(s) déclarent « ${besoin} », qu'aucun connecteur ne sert`);
  }
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

console.log(`  ⟳ besoins des fiches : ${[...besoins]
  .sort((a, b) => b[1] - a[1])
  .map(([b, n]) => {
    const porteurs = connecteurs.filter((c) => (c.sert ?? []).includes(b)).length;
    return `${b} ${n} fiche(s) → ${porteurs || SERVI_PAR_L_APPLICATION[b] ? (porteurs || "l'application") : 'personne'}`;
  })
  .join(' ; ')}`);

console.log(
  `  ⟳ packs sectoriels : ${packsEcrits.length} packs, ` +
    `${packsEcrits.reduce((n, p) => n + p.coeur.length + p.optionnels.length, 0)} liens ERP/CRM ; ` +
    `${secteursSansPack.length === 0 ? 'tous les secteurs de fiches en ont un' : secteursSansPack.map(([s, n]) => `« ${s} » (${n} fiche(s)) n'en a pas`).join(', ')}`
);

console.log(`${connecteurs.length} connecteurs, ${fautes} faute(s)`);
if (fautes) process.exit(1);
