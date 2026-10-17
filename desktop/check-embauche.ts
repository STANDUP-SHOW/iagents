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
import { activitesNommees, metiersPourRecherche, postesParFiche } from './src/agents/recherche.ts';

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

// 4. La recherche d'« Embaucher » (max, 17/10 : « métier de bouche » ne rendait
// que trois agents). Elle est rejouée ici sur les vrais fichiers livrés.
{
  const activites = lire('catalogue/activites.json').activites;
  const personnel = lire('catalogue/personnel.json');
  const postes = postesParFiche(personnel);
  const noms = new Map<string, string>(catalogue.secteurs.map((s: { id: string; nom: string }) => [s.id, s.nom]));
  const nomSecteur = (id: string) => noms.get(id) ?? id;
  const chercher = (q: string) =>
    metiersPourRecherche(catalogue.agents, q, nomSecteur, postes, activitesNommees(q, activites)[0] ?? null, personnel);
  const attendre = (q: string, ok: (l: { id: string; metier: string; secteur: string }[]) => boolean, quoi: string) => {
    const l = chercher(q);
    if (ok(l)) console.log(`  ok  « ${q} » : ${l.length} métiers`);
    else faute(`« ${q} » : ${quoi} (rendu : ${l.slice(0, 5).map((c) => c.metier).join(' ; ')})`);
  };
  const bouche = catalogue.agents.filter((a: { secteur: string }) => a.secteur === 'metiers-de-bouche').length;
  for (const q of ['métier de bouche', 'Métiers de bouche', 'metiers de bouches']) {
    attendre(q, (l) => l.length > bouche && l.slice(0, bouche).every((c) => c.secteur === 'metiers-de-bouche'),
      `les ${bouche} métiers du secteur d'abord, puis ceux de la branche`);
  }
  attendre('boulanger', (l) => l.slice(0, 20).some((c) => c.id === 'AG-1330'), 'le chef de fournil parmi les premiers');
  attendre('chef fournil', (l) => l[0]?.id === 'AG-1330', 'un poste nommé par la branche retrouve sa fiche');
  attendre('comptables', (l) => l.length > 5 && l.slice(0, 5).every((c) => /compta/i.test(c.metier + c.secteur)), 'le pluriel trouve les comptables');
  attendre('xqzt', (l) => l.length === 0, 'un mot que rien ne porte ne rend rien');
  if (!readFileSync(join(racine, 'desktop/src-tauri/tauri.conf.json'), 'utf8').includes('catalogue/personnel.json')) {
    faute("catalogue/personnel.json n'est pas posé par l'installeur : la recherche par poste serait vide");
  }
}

if (fautes > 0) {
  console.error(`\n${fautes} faute(s) : le parcours d'embauche ne tiendrait pas sur un poste client.`);
  process.exit(1);
}
console.log("\nparcours d'embauche : les données que l'application lit sont à leur place");
