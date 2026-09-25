/**
 * Banc des deux listes demandées par max le 25/09/2026 : les API d'intelligence
 * artificielle à brancher (catalogue/api-ia.json) et les logiciels de création
 * installés sur le poste (outils/creation-locale.ts sur catalogue/logiciels.json).
 *
 * Ce qu'il refuse, et ce que chaque faute coûterait sans lui :
 *  - une famille d'API qu'aucune fiche ne connaît : l'API ne serait proposée à personne ;
 *  - une famille dont une fiche a besoin et qu'aucune API ne sert : en mode API, l'agent
 *    n'aurait rien à qui s'adresser ;
 *  - une API dite branchée que l'application n'appelle pas : l'écran promettrait une
 *    connexion qui n'existe pas (voir « du code qui rend Ok sans avoir agi ») ;
 *  - une famille de création absente du référentiel ou sans logiciel local : une fiche
 *    de graphiste n'aurait rien à employer, en silence.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { apisDeSpecialite, apisPourFiche, type ApiIa } from './api-ia.ts';
import { FAMILLES_CREATION, estCreationLocale, logicielsCreation } from './creation-locale.ts';

const racine = join(import.meta.dirname, '..');
const lire = (chemin: string) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));

const catalogue = lire('catalogue/api-ia.json') as {
  familles: Record<string, string>;
  specialites: Record<string, string>;
  horsListe: { noms: string[] };
  apis: (ApiIa & { usage: string; connexion: string; execution: string; documentation: string })[];
};
const schema = lire('contrat/paquet-agent.schema.json');
const referentiel = lire('catalogue/logiciels.json') as {
  categories: string[];
  logiciels: { id: string; nom: string; categorie: string; deploiement: string }[];
};
const llm = readFileSync(join(racine, 'desktop/src-tauri/src/llm.rs'), 'utf8');

let fautes = 0;
function verifier(quoi: string, vrai: boolean, detail = ''): void {
  if (!vrai) {
    fautes++;
    console.log(`  ✗ ${quoi}${detail ? ` : ${detail}` : ''}`);
  }
}

console.log('API d\'IA et logiciels de création');

// --- Les API -------------------------------------------------------------------

// Les familles qu'une fiche peut demander viennent du schéma, pas d'une liste recopiée.
const capacitesSchema = schema.properties.execution.properties.api.properties.capacites.properties;
const famillesFiches = new Set<string>(Object.values(capacitesSchema).flatMap((c: any) => c.enum));
verifier('les familles du catalogue sont celles du schéma des fiches',
  JSON.stringify([...famillesFiches].sort()) === JSON.stringify(Object.keys(catalogue.familles).sort()),
  `${[...famillesFiches].sort()} contre ${Object.keys(catalogue.familles).sort()}`);

const noms = new Set<string>();
catalogue.apis.forEach((a, i) => {
  const attendu = `IA-${String(i + 1).padStart(3, '0')}`;
  verifier(`${a.nom} : identifiant ${attendu}`, a.id === attendu, a.id);
  verifier(`${a.nom} : nom unique`, !noms.has(a.nom.toLowerCase()));
  noms.add(a.nom.toLowerCase());
  verifier(`${a.nom} : groupe connu`, ['modeles', 'creation'].includes(a.groupe), a.groupe);
  verifier(`${a.nom} : sert au moins une famille ou une spécialité`, a.familles.length + a.specialites.length > 0);
  for (const f of a.familles) verifier(`${a.nom} : famille « ${f} » connue`, f in catalogue.familles);
  for (const s of a.specialites) verifier(`${a.nom} : spécialité « ${s} » connue`, s in catalogue.specialites);
  verifier(`${a.nom} : priorité P0 à P2`, /^P[0-2]$/.test(a.priorite), a.priorite);
  verifier(`${a.nom} : documentation en https`, a.documentation.startsWith('https://'), a.documentation);
  verifier(`${a.nom} : éditeur, usage et connexion écrits`, !!a.editeur && !!a.usage && !!a.connexion);
});
for (const n of catalogue.horsListe.noms) {
  verifier(`${n} est hors liste et n'y figure pas`, !noms.has(n.toLowerCase()));
}
for (const s of Object.keys(catalogue.specialites)) {
  verifier(`la spécialité « ${s} » est servie`, apisDeSpecialite(s, catalogue.apis).length > 0);
}
for (const f of Object.keys(catalogue.familles)) {
  verifier(`la famille « ${f} » est servie par une API P0 ou P1`,
    catalogue.apis.some((a) => a.familles.includes(f) && a.priorite !== 'P2'));
}

// Une API ne se dit branchée que si l'application l'appelle vraiment. Au 25/09/2026,
// llm.rs ne parle qu'à Anthropic.
const HOTES: Record<string, string> = { 'Anthropic API': 'api.anthropic.com' };
for (const a of catalogue.apis.filter((x) => x.branche)) {
  verifier(`${a.nom} est dite branchée : l'application l'appelle`,
    !!HOTES[a.nom] && llm.includes(HOTES[a.nom]), HOTES[a.nom] ?? 'hôte inconnu du banc');
}
verifier('au moins une API est branchée', catalogue.apis.some((a) => a.branche));

// --- Les comptes : ce que l'écran « Vos moteurs d'IA » montre ------------------------

const comptes = (catalogue as any).comptes as Record<string, { nom: string; site: string; inscription: string; logo: string | null }>;
const logosDispo = new Set(readdirSync(join(racine, 'desktop/src/assets/logos-ia')));
for (const [id, c] of Object.entries(comptes)) {
  verifier(`compte ${id} : sert au moins une API`, catalogue.apis.some((a: any) => a.compte === id));
  verifier(`compte ${id} : inscription en https`, c.inscription.startsWith('https://'), c.inscription);
  verifier(`compte ${id} : nom et site écrits`, !!c.nom && !!c.site);
  if (c.logo) verifier(`compte ${id} : le logo ${c.logo} est livré`, logosDispo.has(c.logo));
}
for (const a of catalogue.apis as any[]) {
  verifier(`${a.nom} : son compte existe`, a.compte in comptes, a.compte);
  if (a.logo) verifier(`${a.nom} : le logo ${a.logo} est livré`, logosDispo.has(a.logo));
}
// Anthropic est le compte que llm.rs lit ; cles_ia.rs doit lui passer la main.
const clesIa = readFileSync(join(racine, 'desktop/src-tauri/src/cles_ia.rs'), 'utf8');
verifier('cles_ia.rs confie le compte Anthropic à llm.rs', clesIa.includes('const COMPTE_LLM: &str = "anthropic"') && 'anthropic' in comptes);
// Les champs de CleCompte traversent avec leurs noms Rust (pas de rename_all).
const ecran = readFileSync(join(racine, 'desktop/src/components/MoteursIa.tsx'), 'utf8');
for (const champ of ['compte', 'rangee', 'employee']) {
  verifier(`le champ ${champ} de CleCompte est lu par l'écran`, clesIa.includes(`pub ${champ}:`) && ecran.includes(`${champ}: `));
}

// --- Les fiches atteignent leurs API ------------------------------------------------

let fiches = 0;
let sansApi = 0;
for (const dossier of ['agents', 'socle']) {
  for (const f of readdirSync(join(racine, dossier)).filter((n) => n.endsWith('.json'))) {
    const fiche = lire(`${dossier}/${f}`);
    fiches++;
    const rendu = apisPourFiche(fiche.execution.api.capacites, catalogue.apis);
    const vides = Object.entries(rendu).filter(([, ids]) => ids.length === 0).map(([k]) => k);
    if (vides.length) { sansApi++; verifier(`${f} : chaque capacité a une API`, false, vides.join(', ')); }
  }
}

// --- Les logiciels de création ---------------------------------------------------------

const categories = new Set(referentiel.categories);
for (const f of FAMILLES_CREATION) {
  verifier(`« ${f} » est une famille du référentiel`, categories.has(f));
  verifier(`« ${f} » a au moins un logiciel local`,
    referentiel.logiciels.some((l) => l.categorie === f && estCreationLocale(l)));
}
// Les noms que max a cités doivent y être : c'est l'exemple de la demande.
for (const nom of ['Adobe Photoshop', 'Final Cut Pro', 'AutoCAD', 'Blender', 'GIMP']) {
  const l = referentiel.logiciels.find((x) => x.nom === nom);
  verifier(`${nom} est un logiciel de création local`, !!l && estCreationLocale(l));
}
verifier('Canva, en ligne seulement, n\'en est pas',
  !estCreationLocale(referentiel.logiciels.find((x) => x.nom === 'Canva')!));
verifier('un graphiste reçoit Photoshop',
  logicielsCreation(['design-creation'], referentiel.logiciels)
    .includes(referentiel.logiciels.find((x) => x.nom === 'Adobe Photoshop')!.id));
verifier('une secrétaire ne reçoit rien', logicielsCreation(['bureautique'], referentiel.logiciels).length === 0);

const locaux = referentiel.logiciels.filter(estCreationLocale).length;
console.log(`  ${catalogue.apis.length} API (${catalogue.apis.filter((a) => a.branche).length} branchée), `
  + `${fiches} fiches, ${sansApi} sans API pour une capacité ; ${locaux} logiciels de création locaux`);
if (fautes) {
  console.log(`\n${fautes} faute(s).`);
  process.exit(1);
}
console.log('API d\'IA et logiciels de création : tout tient.');
