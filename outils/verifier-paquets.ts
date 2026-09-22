/**
 * Validates every package in agents/ against the contract:
 *  - JSON Schema (contrat/paquet-agent.schema.json)
 *  - id known in the catalogue, secteur matching, slug unique
 *  - commercial block equal to the catalogue profile (never invented)
 *  - materiel equal to what the sizing engine derives from `modeles`
 * Exit code 1 on any failure. `--corriger` rewrites materiel/commercial from the sources of truth.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { materielPour, appelsParJour } from '../dimensionnement/calculer.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(readFileSync(join(racine, 'contrat/paquet-agent.schema.json'), 'utf8'));
const catalogue = JSON.parse(readFileSync(join(racine, 'catalogue/catalogue.json'), 'utf8'));
const corriger = process.argv.includes('--corriger');

const LISTE = 'catalogue/identite-a-reecrire.json';
const aReecrire = new Set<string>(
  JSON.parse(readFileSync(join(racine, LISTE), 'utf8')).agents as string[]
);
const restants: string[] = [];

// Une accroche est la première chose que lit le client. Le générateur en avait produit huit
// gabarits pour mille vingt-six fiches : même phrase, nom du poste changé. Les fiches encore
// à réécrire sont listées dans accroches-gabarit.json, qui ne peut que rétrécir.
const LISTE_ACCROCHES = 'catalogue/accroches-gabarit.json';
const gabaritsSource = JSON.parse(readFileSync(join(racine, LISTE_ACCROCHES), 'utf8'));
const aReecrireAccroche = new Set<string>(gabaritsSource.agents as string[]);
const GABARITS: RegExp[] = (gabaritsSource.gabarits as string[]).map(
  (g) => new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
);
const restantsAccroche: string[] = [];
const accroches = new Map<string, string>();

const ajv = new Ajv2020({ allErrors: true, strict: false });
const valider = ajv.compile(schema);
const parId = new Map<string, any>(catalogue.agents.map((a: any) => [a.id, a]));
const profils = new Map<string, any>(catalogue.profils.map((p: any) => [p.id, p]));

export function commercialAttendu(profilId: string) {
  const p = profils.get(profilId);
  if (!p) throw new Error(`Profil inconnu : ${profilId}`);
  return { profil: p.id, priorite: p.priorite, pack: p.pack, prixMensuel: { min: p.prixCible.min, max: p.prixCible.max }, autonomie: p.autonomie, besoinHumain: p.besoinHumain, risqueReglementaire: p.risqueReglementaire };
}

const fichiers = readdirSync(join(racine, 'agents')).filter((f) => f.endsWith('.json')).sort();
const slugs = new Map<string, string>();
let fautes = 0;
const faute = (f: string, msg: string) => { fautes++; console.log(`  ✗ ${f} : ${msg}`); };

for (const f of fichiers) {
  const chemin = join(racine, 'agents', f);
  const paquet = JSON.parse(readFileSync(chemin, 'utf8'));
  let modifie = false;
  if (!valider(paquet)) for (const e of valider.errors ?? []) faute(f, `${e.instancePath || '/'} ${e.message}`);
  const entree = parId.get(paquet.id);
  if (!entree) { faute(f, `id ${paquet.id} absent du catalogue`); continue; }
  if (entree.secteur !== paquet.secteur) faute(f, `secteur ${paquet.secteur} ≠ catalogue ${entree.secteur}`);
  // Le métier et le slug appartiennent au catalogue. Sans ce contrôle, une fiche peut décrire
  // un autre métier que celui vendu sous son identifiant — et quatre-vingt-onze l'ont fait sans
  // que rien ne le signale. Les fiches encore à réécrire sont listées dans identite-a-reecrire.json.
  const derive = entree.metier !== paquet.nom || entree.slug !== paquet.slug;
  if (aReecrire.has(paquet.id)) {
    if (!derive) faute(f, `${paquet.id} est corrigé : le retirer de ${LISTE}`);
    else restants.push(`${paquet.id} « ${paquet.nom} » → « ${entree.metier} »`);
  } else {
    if (entree.metier !== paquet.nom) faute(f, `nom « ${paquet.nom} » ≠ catalogue « ${entree.metier} »`);
    if (entree.slug !== paquet.slug) faute(f, `slug ${paquet.slug} ≠ catalogue ${entree.slug}`);
  }
  if (f !== `${paquet.id}-${paquet.slug}.json`) faute(f, `nom de fichier attendu ${paquet.id}-${paquet.slug}.json`);
  if (slugs.has(paquet.slug)) faute(f, `slug en double avec ${slugs.get(paquet.slug)}`); else slugs.set(paquet.slug, f);
  const gabarit = GABARITS.find((r) => r.test(paquet.accroche));
  const cle = paquet.accroche.trim().toLowerCase();
  const jumelle = accroches.get(cle);
  if (aReecrireAccroche.has(paquet.id)) {
    if (!gabarit && !jumelle) faute(f, `accroche réécrite : retirer ${paquet.id} de ${LISTE_ACCROCHES}`);
    else restantsAccroche.push(paquet.id);
  } else {
    if (gabarit) faute(f, `accroche reprise du gabarit « ${gabarit.source} »`);
    if (jumelle) faute(f, `accroche identique à celle de ${jumelle}`);
  }
  if (!accroches.has(cle)) accroches.set(cle, f);
  const com = commercialAttendu(entree.profil);
  if (JSON.stringify(com) !== JSON.stringify(paquet.commercial)) {
    if (corriger) { paquet.commercial = com; modifie = true; } else faute(f, `commercial ≠ profil ${entree.profil} : attendu ${JSON.stringify(com)}`);
  }
  try {
    const mat = materielPour(paquet.modeles);
    if (JSON.stringify(mat) !== JSON.stringify(paquet.materiel)) {
      if (corriger) { paquet.materiel = mat; modifie = true; } else faute(f, `materiel ≠ calcul : attendu ${JSON.stringify(mat)}`);
    }
  } catch (e) { faute(f, (e as Error).message); }
  if (paquet.execution) {
    const attendu = appelsParJour(paquet.taches);
    if (paquet.execution.appelsParJourEstimes !== attendu) {
      if (corriger) { paquet.execution.appelsParJourEstimes = attendu; modifie = true; } else faute(f, `appelsParJourEstimes ${paquet.execution.appelsParJourEstimes} ≠ calcul ${attendu}`);
    }
    const capsModeles = Object.keys(paquet.modeles).filter((k) => k !== 'activite').sort().join(',');
    const capsApi = Object.keys(paquet.execution.api.capacites).sort().join(',');
    if (capsModeles !== capsApi) faute(f, `execution.api.capacites (${capsApi}) ne couvre pas modeles (${capsModeles})`);
  }
  if (modifie) { writeFileSync(chemin, JSON.stringify(paquet, null, 2) + '\n'); console.log(`  ✎ ${f} corrigé`); }
}
if (restants.length) {
  console.log(`  ⟳ ${restants.length} fiche(s) dont le métier reste à réécrire depuis le catalogue :`);
  for (const r of restants) console.log(`     ${r}`);
}
if (restantsAccroche.length) {
  console.log(`  ⟳ ${restantsAccroche.length} fiche(s) dont l'accroche reste à écrire (gabarit du générateur).`);
}
console.log(`${fichiers.length} paquets, ${fautes} faute(s)`);
if (fautes) process.exit(1);
