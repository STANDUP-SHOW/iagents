// Builds back-office/src/emails/catalogue.json, the real agents the e-mail
// studio can propose: activities (catalogue/activites.json), the staff of each
// activity (catalogue/personnel.json) and, for each fiche those name, its slug,
// name and hook (agents/*.json). Nothing here is typed by hand.
//
//   node banc/catalogue-emails.mjs            writes the file
//   node banc/catalogue-emails.mjs --verifier fails if the file is stale
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// The bench bundles this file elsewhere: it passes the back-office root itself.
const RACINE_ICI = fileURLToPath(new URL('..', import.meta.url));

export function construire(racine = RACINE_ICI) {
  const DEPOT = join(racine, '..');
  const lire = (p) => JSON.parse(readFileSync(join(DEPOT, p), 'utf8'));
  const personnel = lire('catalogue/personnel.json');
  const { activites } = lire('catalogue/activites.json');
  const libelles = { ...personnel.services, terrain: 'Terrain' };
  const fiches = new Map();
  for (const f of readdirSync(join(DEPOT, 'agents')).filter((x) => /^AG-\d+.*\.json$/.test(x))) {
    const a = JSON.parse(readFileSync(join(DEPOT, 'agents', f), 'utf8'));
    fiches.set(a.id, [a.slug, a.nom, a.accroche ?? '']);
  }
  const organigrammes = {};
  const agents = {};
  for (const [cle, o] of Object.entries(personnel.organigrammes)) {
    const postes = [];
    for (const [service, libelle] of Object.entries(libelles)) {
      for (const [poste, id] of o[service] ?? []) {
        if (!fiches.has(id)) throw new Error(`${cle} : ${id} n'a pas de fiche dans agents/`);
        postes.push([libelle, poste, id]);
        agents[id] = fiches.get(id);
      }
    }
    organigrammes[cle] = { nom: o.nom, postes };
  }
  const liste = activites
    .filter((a) => organigrammes[personnel.activites[a.id]])
    .map((a) => [a.id, a.nom, personnel.activites[a.id]])
    .sort((x, y) => x[1].localeCompare(y[1], 'fr'));
  const tries = Object.fromEntries(Object.keys(agents).sort().map((id) => [id, agents[id]]));
  return JSON.stringify({ source: 'catalogue/personnel.json, catalogue/activites.json, agents/ (banc/catalogue-emails.mjs)', activites: liste, organigrammes, agents: tries }) + '\n';
}

// Bundled into the bench, this file shares the bench's URL: run only when called by name.
if (process.argv[1]?.endsWith('catalogue-emails.mjs') && fileURLToPath(import.meta.url) === process.argv[1]) {
  const SORTIE = join(RACINE_ICI, 'src/emails/catalogue.json');
  const attendu = construire();
  if (process.argv.includes('--verifier')) {
    let present = '';
    try { present = readFileSync(SORTIE, 'utf8'); } catch { /* absent */ }
    if (present !== attendu) { console.error('src/emails/catalogue.json est périmé : lancer node banc/catalogue-emails.mjs'); process.exit(1); }
    console.log('catalogue des e-mails à jour');
  } else {
    writeFileSync(SORTIE, attendu);
    const o = JSON.parse(attendu);
    console.log(`${o.activites.length} activités, ${Object.keys(o.organigrammes).length} organigrammes, ${Object.keys(o.agents).length} fiches → ${SORTIE}`);
  }
}
