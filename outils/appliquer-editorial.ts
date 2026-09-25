/**
 * Rewrites the fiches of one secteur from an editorial file.
 *
 * The catalogue owns the identity (id, secteur, metier, slug); the editorial file owns
 * everything the client reads (accroche, description, expert, taches, connecteurs,
 * modeles); `acces.logiciels` is derived from the tasks, never copied. Ninety-one fiches drifted away from the catalogue because the generator lost
 * the real job titles, so their content describes a job nobody sells — rewriting them by
 * secteur is the only fix, and this tool applies one secteur at a time.
 *
 * Usage: npm run editorial -- evenementiel
 * Then:  npm run verifier -- --corriger   (materiel, commercial and appelsParJour are derived)
 */
import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { logicielsDesTaches } from './logiciels-metier.ts';
import { logicielsPoste } from '../usine/logiciels-poste.ts';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const secteur = process.argv[2];
if (!secteur) {
  console.error('Usage : npm run editorial -- <secteur>');
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(join(racine, 'catalogue/catalogue.json'), 'utf8'));
const categoriesLogiciels = new Set<string>(
  JSON.parse(readFileSync(join(racine, 'catalogue/logiciels.json'), 'utf8')).categories,
);
const usine = JSON.parse(readFileSync(join(racine, 'usine/logiciels.json'), 'utf8'));
const parId = new Map<string, any>(catalogue.agents.map((a: any) => [a.id, a]));
const editorial = JSON.parse(
  readFileSync(join(racine, 'outils/editorial', `${secteur}.json`), 'utf8')
);

/** api.capacites must carry one entry per capacity declared in modeles. */
const CAPACITE_API: Record<string, string> = {
  texte: 'llm',
  vision: 'llm-vision',
  image: 'image',
  video: 'video',
  audio: 'parole',
  musique: 'musique',
  embeddings: 'embeddings',
};

const fichiers = readdirSync(join(racine, 'agents'));
let ecrits = 0;

for (const e of editorial.agents) {
  const entree = parId.get(e.id);
  if (!entree) throw new Error(`${e.id} absent du catalogue`);
  if (entree.secteur !== secteur) throw new Error(`${e.id} appartient au secteur ${entree.secteur}`);

  const ancien = fichiers.find((f) => f.startsWith(`${e.id}-`));
  if (!ancien) throw new Error(`fiche ${e.id} absente de agents/`);
  const paquet = JSON.parse(readFileSync(join(racine, 'agents', ancien), 'utf8'));

  // L'identité vient du catalogue, jamais de l'éditorial : c'est ce que la dérive a coûté.
  paquet.id = entree.id;
  paquet.slug = entree.slug;
  paquet.secteur = entree.secteur;
  paquet.nom = entree.metier;

  paquet.famille = e.famille ?? 'metier';
  paquet.accroche = e.accroche;
  paquet.description = e.description;
  paquet.expert = {
    persona: e.persona,
    consigne: e.consigne,
    connaissances: e.connaissances,
    regles: e.regles,
  };
  paquet.taches = e.taches;
  paquet.connecteurs = e.connecteurs;
  // Ce que l'agent a le droit d'ouvrir se lit dans ses tâches : l'éditorial ne le redit pas.
  const familles = logicielsDesTaches(e.taches, categoriesLogiciels);
  paquet.acces = { ...e.acces, logiciels: familles, logicielsPoste: logicielsPoste(familles, usine.logiciels) };
  paquet.modeles = e.modeles;
  paquet.resume_metier = e.resume_metier;
  // Le relais dit de quel poste la fiche reçoit et à quel poste elle transmet : sans lui,
  // une équipe d'agents ne se passe le travail que par un humain.
  if (e.relais) paquet.relais = e.relais;
  else delete paquet.relais;
  // Les logiciels du métier : l'agent les annonce sur la boutique et les confirme à l'entretien.
  if (e.qualifications) paquet.qualifications = e.qualifications;
  else delete paquet.qualifications;

  const capacites: Record<string, string> = {};
  for (const cle of Object.keys(e.modeles)) {
    if (cle === 'activite') continue;
    capacites[cle] = CAPACITE_API[cle] ?? cle;
  }
  paquet.execution = {
    modes: ['local', 'api'],
    defaut: 'local',
    bascule: 'automatique',
    api: { capacites },
    appelsParJourEstimes: paquet.execution?.appelsParJourEstimes ?? 1,
  };

  const attendu = `${entree.id}-${entree.slug}.json`;
  writeFileSync(join(racine, 'agents', ancien), JSON.stringify(paquet, null, 2) + '\n');
  if (ancien !== attendu) renameSync(join(racine, 'agents', ancien), join(racine, 'agents', attendu));
  console.log(`  ✎ ${attendu}${ancien !== attendu ? `  (était ${ancien})` : ''}`);
  ecrits++;
}

// Une fiche réécrite sort de la liste : le vérificateur refuse qu'elle y reste, pour que
// la liste ne puisse que rétrécir et finisse vide.
const cheminListe = join(racine, 'catalogue/identite-a-reecrire.json');
const liste = JSON.parse(readFileSync(cheminListe, 'utf8'));
const avant = liste.agents.length;
const ecritsIds = new Set(editorial.agents.map((e: any) => e.id));
liste.agents = liste.agents.filter((id: string) => !ecritsIds.has(id));
if (liste.agents.length !== avant) {
  writeFileSync(cheminListe, JSON.stringify(liste, null, 2) + '\n');
  console.log(`  ↓ ${avant - liste.agents.length} identifiant(s) retiré(s) de identite-a-reecrire.json, ${liste.agents.length} restant(s)`);
}

// Même règle pour la liste des fiches restées au gabarit du générateur : une fiche réécrite
// en sort, et le vérificateur refuse qu'elle y reste.
const cheminGeneriques = join(racine, 'catalogue/fiches-generiques.json');
const generiques = JSON.parse(readFileSync(cheminGeneriques, 'utf8'));
const avantG = generiques.agents.length;
generiques.agents = generiques.agents.filter((id: string) => !ecritsIds.has(id));
if (generiques.agents.length !== avantG) {
  writeFileSync(cheminGeneriques, JSON.stringify(generiques, null, 2) + '\n');
  console.log(`  ↓ ${avantG - generiques.agents.length} identifiant(s) retiré(s) de fiches-generiques.json, ${generiques.agents.length} restant(s)`);
}

console.log(`${ecrits} fiche(s) réécrite(s) pour le secteur ${secteur}`);
