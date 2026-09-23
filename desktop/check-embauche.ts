/**
 * Le parcours d'embauche lit trois fichiers livrés avec l'application et en
 * attend une forme précise. Ce banc vérifie cette forme, parce qu'un champ
 * renommé ne casse rien de visible : la liste des postes se vide, l'entretien
 * ne pose aucune question, et personne ne s'en aperçoit avant un client.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  questionsCadre,
  questionsEntretien,
  type FicheCompelete,
  type Referentiel,
} from './src/agents/entretien.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p: string) => JSON.parse(readFileSync(join(racine, p), 'utf8'));

const catalogue = lire('catalogue/catalogue.json');
const referentiel: Referentiel = lire('catalogue/logiciels.json');

let fautes = 0;
const faute = (quoi: string) => {
  console.log(`  ✗   ${quoi}`);
  fautes++;
};

// 1. Les champs que la liste des postes affiche réellement.
if (!Array.isArray(catalogue.agents) || catalogue.agents.length === 0) {
  faute('catalogue.json ne porte aucune liste « agents »');
} else {
  const manquants = catalogue.agents.filter(
    (a: Record<string, unknown>) =>
      typeof a.id !== 'string' ||
      typeof a.metier !== 'string' ||
      typeof a.secteur !== 'string' ||
      !a.metier ||
      !a.secteur
  );
  if (manquants.length) {
    faute(
      `${manquants.length} entrée(s) du catalogue sans id, metier ou secteur — la liste des postes s'afficherait vide`
    );
  } else {
    console.log(`  ok  ${catalogue.agents.length} postes nommés dans le catalogue`);
  }
}

// 2. Une fiche prise au hasard doit donner à l'agent de quoi parler.
const fichiers = readdirSync(join(racine, 'agents')).filter((f) => f.endsWith('.json'));
if (fichiers.length === 0) {
  faute('aucune fiche dans agents/');
} else {
  let muettes = 0;
  // Un échantillon régulier plutôt que tout le catalogue : le banc reste rapide
  // et une famille entière de fiches muettes se verrait quand même.
  for (let i = 0; i < fichiers.length; i += 37) {
    const fiche: FicheCompelete = lire(join('agents', fichiers[i]));
    const cadre = questionsCadre(fiche);
    const outils = questionsEntretien(fiche, referentiel);
    if (cadre.length === 0 && outils.length === 0) {
      faute(`${fichiers[i]} : l'agent n'a aucune question à poser`);
      muettes++;
    }
  }
  if (muettes === 0) {
    console.log(
      `  ok  ${Math.ceil(fichiers.length / 37)} fiches échantillonnées ont toutes de quoi mener l'entretien`
    );
  }
}

// 3. Les catalogues que l'application sait ouvrir, et eux seuls.
for (const nom of ['catalogue/logiciels.json', 'catalogue/activites.json', 'catalogue/catalogue.json']) {
  try {
    lire(nom);
    console.log(`  ok  ${nom} est là où l'installeur le pose`);
  } catch {
    faute(`${nom} introuvable : l'entretien d'embauche n'aurait pas ses données`);
  }
}

if (fautes > 0) {
  console.error(`\n${fautes} faute(s) : le parcours d'embauche ne tiendrait pas sur un poste client.`);
  process.exit(1);
}
console.log("\nparcours d'embauche : les données que l'application lit sont à leur place");
