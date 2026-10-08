/**
 * Refuses an activity whose staff is not a real company's (catalogue/personnel.json).
 *
 * max, 08/10/2026, testing his own trade: an imprimerie showed a « graphiste web » and
 * no deviseur, no prépresse, no CTP, no correcteur, no chef de fabrication. Every one of
 * the 282 activities must list the staff of a real company of its branch, service by
 * service, under the trade's own job titles, and each title must lead to a fiche that
 * exists. The organigram is the judgement itself, sourced, and it overrides the coarse
 * secteur → famille table of desktop/src/agents/activites.ts (a courtier runs on insurance
 * fiches, a social landlord on property management ones). A physical job (conducteur offset, maçon) is
 * not an agent: it is listed under `terrain` with the fiche that prepares its work.
 *
 * Usage: npm run verifier-personnel (also run by npm run controle).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p: string) => JSON.parse(readFileSync(join(racine, p), 'utf8'));
const personnel = lire('catalogue/personnel.json');
const catalogue = lire('catalogue/catalogue.json');
const activites: { id: string; nom: string; famille: string }[] = lire('catalogue/activites.json').activites;

type Ligne = [string, string];
const fiches = new Map<string, { metier: string; secteur: string }>(catalogue.agents.map((a: any) => [a.id, a]));
const SERVICES = ['direction', 'commercial', 'production', 'gestion'] as const;
// The fewest a real company runs with: a manager, two people on the books, three on what it makes.
const MINIMUM: Record<(typeof SERVICES)[number], number> = { direction: 1, commercial: 2, production: 3, gestion: 2 };
// The price a client asks for before he signs, under whatever name the branch gives it.
const DEVIS = /devis|deviseur|cotation|chiffrage|chiffreur|honoraires|lettre de mission|tarification|estimation|avis de valeur|offres? de prêt|propositions? commerciales?/i;

const fautes: string[] = [];
const faute = (ou: string, quoi: string) => fautes.push(`${ou} : ${quoi}`);

for (const s of SERVICES) if (!personnel.services?.[s]) faute('services', `libellé du service « ${s} » absent`);

for (const [id, o] of Object.entries<any>(personnel.organigrammes)) {
  const ou = `organigramme ${id}`;
  if (!o.nom) faute(ou, 'sans nom');
  if (!Array.isArray(o.sources) || !o.sources.length) faute(ou, 'aucune source (fiche ROME, fédération) ne justifie ces postes');
  const vus = new Map<string, string>();
  for (const s of SERVICES) {
    const lignes: Ligne[] = o[s] ?? [];
    if (lignes.length < MINIMUM[s]) faute(ou, `${s} : ${lignes.length} poste(s), il en faut au moins ${MINIMUM[s]}`);
    for (const [role, fiche] of lignes) {
      if (!role || role.length < 3) faute(ou, `${s} : un poste sans intitulé`);
      if (!fiches.has(fiche)) faute(ou, `${s} : « ${role} » renvoie à ${fiche}, absente du catalogue`);
      if (vus.has(fiche)) faute(ou, `${fiche} tient deux postes (« ${vus.get(fiche)} » et « ${role} ») : un poste par fiche`);
      vus.set(fiche, role);
    }
  }
  if (!(o.commercial ?? []).some(([role]: Ligne) => DEVIS.test(role))) {
    if (!o.sansDevis || o.sansDevis.length < 30) faute(ou, 'aucun poste de devis ni de cotation, et aucune raison écrite sous « sansDevis »');
  } else if (o.sansDevis) faute(ou, '« sansDevis » alors qu\'un poste de devis existe');
  for (const [metier, fiche] of (o.terrain ?? []) as Ligne[]) {
    if (!vus.has(fiche)) faute(ou, `terrain « ${metier} » : ${fiche} prépare son travail mais n'est pas dans l'organigramme`);
  }
}

const parId = new Map(activites.map((a) => [a.id, a]));
for (const a of activites) {
  const org = personnel.activites[a.id];
  if (!org) faute(a.id, `${a.nom} n'a pas d'organigramme`);
  else if (!personnel.organigrammes[org]) faute(a.id, `organigramme ${org} inconnu`);
}
for (const id of Object.keys(personnel.activites)) if (!parId.has(id)) faute(id, 'activité inconnue de catalogue/activites.json');

const nbOrg = Object.keys(personnel.organigrammes).length;
if (fautes.length) {
  for (const f of fautes.slice(0, 80)) console.error(`  ✗ ${f}`);
  if (fautes.length > 80) console.error(`  … et ${fautes.length - 80} autres`);
  console.error(`personnel : ${fautes.length} faute(s) sur ${activites.length} activités et ${nbOrg} organigrammes`);
  process.exit(1);
}
console.log(`personnel : ${activites.length} activités, ${nbOrg} organigrammes, chacun complet (direction, devis, production, gestion, terrain)`);
