/**
 * Banc du moteur d'équipe : une demande dite librement devient une équipe d'agents.
 *
 * Le témoin principal est la demande de max du 04/10/2026, mot pour mot : une équipe pour
 * trouver des financements à sa start-up. Le moteur d'un seul agent y hésitait entre le
 * Business plan analyst et un agent de prise de rendez-vous médical. Ce qui est vérifié : la
 * présentation de l'entreprise (« soins à domicile », « ménage ») ne fait venir personne, chaque
 * rôle cite les mots du client qui l'ont fait venir, une demande d'un seul poste reste un seul
 * poste, deux postes qui se valent font une question, et les agents de l'équipe se passent le
 * travail par leurs dossiers sans rien deviner.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { posteDepuisFiche, type Poste, type Referentiels } from './src/agents/composition.ts';
import { normaliser } from './src/agents/entretien.ts';
import {
  PERSONNE_POUR_CA,
  besoinsDeLaDemande,
  choisirPour,
  citation,
  competencesDuMembre,
  estUneMission,
  lireDemandeEquipe,
  prenomsPourEquipe,
  relierEquipe,
  resumeEquipe,
  type FicheDeMembre,
  type MembreEmbauche,
  type ReferentielEquipes,
} from './src/agents/equipe.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lireJson = (chemin: string) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));

let echecs = 0;
function verifier(nom: string, condition: boolean, detail = '') {
  if (!condition) {
    echecs++;
    console.error(`ÉCHEC ${nom}${detail ? ` — ${detail}` : ''}`);
  }
}

const fichiers = readdirSync(join(racine, 'agents')).filter((f) => f.endsWith('.json')).sort();
const postes: Poste[] = fichiers.map((f) => posteDepuisFiche(lireJson(`agents/${f}`)));
const refs: Referentiels = {
  postes,
  logiciels: lireJson('catalogue/logiciels.json'),
  activites: lireJson('catalogue/activites.json'),
};
const equipes: ReferentielEquipes = lireJson('catalogue/equipes.json');
const fiche = (id: string): FicheDeMembre => {
  const f = fichiers.find((x) => x.startsWith(`${id}-`));
  return f ? lireJson(`agents/${f}`) : lireJson(`socle/${readdirSync(join(racine, 'socle')).find((x) => x.startsWith(`${id}-`))}`);
};

// --- Le référentiel des équipes ---------------------------------------------
const socle = new Set(readdirSync(join(racine, 'socle')).map((f) => f.slice(0, 7)));
for (const t of equipes.equipes) {
  for (const r of t.roles) {
    verifier(`${t.id} : ${r.agent} existe`, postes.some((p) => p.id === r.agent) || socle.has(r.agent));
    verifier(`${t.id} : ${r.agent} a un nom à l'écran`, postes.some((p) => p.id === r.agent) || Boolean(r.nomPoste));
    for (const m of r.missions) {
      verifier(`${t.id} : « ${m} » est écrit normalisé`, normaliser(m) === m, normaliser(m));
      const autres = t.roles.filter((x) => x !== r && x.missions.includes(m));
      verifier(`${t.id} : « ${m} » ne désigne qu'un rôle`, autres.length === 0, autres.map((x) => x.role).join(', '));
    }
  }
  for (const d of t.declencheurs) verifier(`${t.id} : déclencheur « ${d} » normalisé`, normaliser(d) === d);
  verifier(`${t.id} : un rôle par agent`, new Set(t.roles.map((r) => r.agent)).size === t.roles.length);
}

// --- La demande de max ------------------------------------------------------
const DEMANDE_MAX =
  "Étude de cas concrets. Pour ma start-up tech, qui développe actuellement plusieurs projets, tels que " +
  'Jobber Plus, un site de jobbing, plateforme multifactory, de nombreux sites reliés spécialisés dans les ' +
  'services mécaniques, soins à domicile, ménage, etc. Plus de 1000 10 000, plus de 10 000 plateformes ' +
  "corporate prévues, dropshipper.fr, application de dropshipping assistée par l'intelligence artificielle " +
  'en mode automatique. E-Agent, embauche de collaborateurs virtuels, experts, métiers. ' +
  "J'ai besoin maintenant pour le développement de trouver des financements. Je dois donc monter une " +
  "première équipe d'agents qui va consister à faire ces démarches Création de business plan, analyse des " +
  'chiffres, analyse de marché, recueil de liens et de contacts LinkedIn de tous les business angels qui ' +
  "investissent dans la tech et dans l'intelligence artificielle, prise de contact. via email, présentation " +
  "du projet, réponse vocale. Donc, l'application devrait être capable de me générer un pack d'agents pour " +
  "cette tâche. de trouver des financements et d'obtenir des rendez-vous pour présenter le projet auprès " +
  "d'agences locales, nationales et internationales. Deux réponses. Selon toi, qui connais notre base de " +
  "données, Quelle équipe d'agents sélectionnerais-tu Deuxième chose, l'application est-elle capable " +
  "aujourd'hui de me générer ce pack entreprise comme prévu À partir d'une demande telle que je viens de la " +
  "formuler oralement. Troisième chose, si ce n'est pas le cas, il faut l'intégrer. Quatrième chose, c'est " +
  "avec cette équipe d'agents que je vais tester l'application desktop de mon côté en tant qu'utilisateur, " +
  'en faisant travailler ces agents pour obtenir un financement pour mes entreprises, pour cette start-up ' +
  'tech. Le projet est donc lancé.';

const lue = lireDemandeEquipe(DEMANDE_MAX, refs, equipes);
verifier('la demande de max est lue comme une équipe', lue !== null);
if (lue) {
  verifier("l'équipe type est la levée de fonds", lue.type?.id === 'levee-de-fonds', lue.type?.id);
  const ids = lue.membres.map((m) => m.posteId);
  const attendus = ['AG-0000', 'AG-1258', 'AG-0669', 'AG-0662', 'AG-0654', 'AG-0280', 'AG-0070', 'AG-0012'];
  verifier("l'équipe est celle de la levée, dans l'ordre", JSON.stringify(ids) === JSON.stringify(attendus), ids.join(' '));
  // La présentation de la maison ne fait venir personne : ni soins, ni ménage, ni rendez-vous médical.
  for (const id of ids) {
    const p = postes.find((x) => x.id === id);
    verifier(`${id} n'est pas tiré par la présentation de l'entreprise`, !p || !/sante|nettoyage|jardinage|reparation/.test(p.secteur), p?.secteur);
  }
  verifier("aucune question : chaque mission a son rôle", lue.aChoisir.length === 0, lue.aChoisir.map((q) => q.besoin).join(' | '));
  verifier('aucune mission sans agent', lue.sansAgent.length === 0, lue.sansAgent.join(' | '));
  for (const m of lue.membres) {
    verifier(`${m.posteId} est venu par la demande`, m.origine === 'demande', m.origine);
    for (const dit of m.entendu) verifier(`${m.posteId} cite les mots du client`, DEMANDE_MAX.includes(dit), dit);
  }
  const bp = lue.membres.find((m) => m.posteId === 'AG-0669');
  verifier('le business plan cite « Création de business plan », pas toute la phrase', bp?.entendu[0] === 'Création de business plan', bp?.entendu[0]);
  const levee = lue.membres.find((m) => m.posteId === 'AG-1258');
  verifier('le chargé de levée vient pour les business angels et la prise de contact', (levee?.entendu.length ?? 0) >= 2, levee?.entendu.join(' | '));
  // Constaté sur le PC de max le 06/10 : les financements publics citaient la phrase des rendez-vous.
  const agenda = lue.membres.find((m) => m.posteId === 'AG-0012');
  const publics = lue.membres.find((m) => m.posteId === 'AG-0070');
  verifier(
    'les financements publics et l’agenda ne citent pas la même phrase',
    !publics?.entendu.some((d) => /rendez/i.test(d)),
    `${publics?.entendu.join(' | ')} / ${agenda?.entendu.join(' | ')}`
  );
  verifier("l'activité est l'intelligence artificielle", lue.activite?.nom === 'Données et intelligence artificielle', lue.activite?.nom);
  const resume = resumeEquipe(lue).join(' ');
  verifier("la limite LinkedIn est dite avant l'embauche", /LinkedIn interdit le recueil automatique/.test(resume));
  verifier("le résumé n'écrit jamais « connecté »", !/\bconnect[ée]/i.test(resume));
}

// --- Ce qui n'est pas une équipe -------------------------------------------
verifier(
  'un seul poste demandé reste un seul poste',
  lireDemandeEquipe("J'ai besoin d'un analyste financement pour monter mon dossier BPI", refs, equipes) === null
);
verifier(
  'le graphiste de max reste un seul poste',
  lireDemandeEquipe(
    "Voice, j'ai besoin d'un graphiste pour réception des fichiers clients, montage de bons à tirer, utilisation des logiciels Caldera, Adobe Photoshop, Adobe Illustrator",
    refs,
    equipes
  ) === null
);

// --- Une équipe sans équipe type : morceau par morceau ----------------------
const COMPTA =
  'Il me faut une équipe pour la comptabilité : saisie des factures fournisseurs, relance des impayés, préparation de la paie';
const compta = lireDemandeEquipe(COMPTA, refs, equipes);
verifier('une équipe sans équipe type est lue', compta !== null);
if (compta) {
  verifier("aucune équipe type n'est inventée", compta.type === null);
  verifier('les postes qui se valent font des questions', compta.aChoisir.length >= 3, String(compta.aChoisir.length));
  verifier(
    "« la comptabilité » ne fait pas venir l'agent comptable d'association d'office",
    !compta.membres.some((m) => m.posteId === 'AG-0936')
  );
  verifier("une branche devinée sur un premier mot n'est pas retenue", compta.activite === null, compta.activite?.nom);
  const q = compta.aChoisir[0];
  const apres = choisirPour(compta, q.besoin, q.candidats[0].poste.id, refs);
  verifier('choisir un poste le fait entrer', apres.membres.some((m) => m.posteId === q.candidats[0].poste.id && m.origine === 'choisi'));
  verifier('la question tranchée disparaît', apres.aChoisir.length === compta.aChoisir.length - 1);
  const personne = choisirPour(apres, apres.aChoisir[0].besoin, PERSONNE_POUR_CA, refs);
  verifier('« personne pour ça » se note sans agent', personne.sansAgent.includes(apres.aChoisir[0].besoin));
}

// --- Les morceaux ------------------------------------------------------------
verifier('« Création de business plan » est une mission', estUneMission('Création de business plan'));
verifier('« de trouver des financements » est une mission', estUneMission('de trouver des financements'));
verifier('« soins à domicile » ne l’est pas', !estUneMission('soins à domicile'));
verifier('« Étude de cas concrets » ne l’est pas', !estUneMission('Étude de cas concrets'));
verifier(
  '« pour la gestion des réservations » commence à l’action',
  besoinsDeLaDemande('il me faut des agents pour la gestion des réservations').includes('la gestion des réservations')
);
verifier(
  '« la comptabilité et le recrutement » font deux missions',
  besoinsDeLaDemande('la comptabilité et le recrutement des serveurs').length === 2
);
verifier(
  'la citation part de l’action',
  citation("Je dois donc monter une première équipe d'agents qui va consister à faire ces démarches Création de business plan", 'business plan') ===
    'Création de business plan'
);

// --- L'embauche : les agents se passent le travail --------------------------
const equipe: MembreEmbauche[] = [
  { prenom: 'Victor', posteId: 'AG-0000', fiche: fiche('AG-0000'), racine: 'C:\\Users\\max\\Documents\\iAgent\\Victor' },
  { prenom: 'Léa', posteId: 'AG-1258', fiche: fiche('AG-1258'), racine: 'C:\\Users\\max\\Documents\\iAgent\\Léa' },
  { prenom: 'Hugo', posteId: 'AG-0669', fiche: fiche('AG-0669'), racine: 'C:\\Users\\max\\Documents\\iAgent\\Hugo' },
  { prenom: 'Nora', posteId: 'AG-0654', fiche: fiche('AG-0654'), racine: 'C:\\Users\\max\\Documents\\iAgent\\Nora' },
  { prenom: 'Paul', posteId: 'AG-0280', fiche: fiche('AG-0280'), racine: 'C:\\Users\\max\\Documents\\iAgent\\Paul' },
];
const { dossiers, passages } = relierEquipe(equipe);
verifier(
  'le chargé de levée lit le besoin de financement chez le business plan',
  dossiers['Léa']?.['plans/besoins'] === 'C:\\Users\\max\\Documents\\iAgent\\Hugo\\plans\\besoins',
  JSON.stringify(dossiers['Léa'])
);
verifier(
  'il lit le support de présentation chez le designer',
  dossiers['Léa']?.['presentations/diapositives'] === 'C:\\Users\\max\\Documents\\iAgent\\Paul\\presentations\\diapositives'
);
verifier('il lit la taille de marché chez la consultante', dossiers['Léa']?.['marches/fourchettes']?.endsWith('Nora\\marches\\fourchettes') === true);
verifier("un dossier qu'il écrit lui-même ne se redirige pas", dossiers['Léa']?.['levee/suivi'] === undefined);
verifier('les chemins sont complets', Object.values(dossiers).flatMap(Object.values).every((c) => /^[A-Z]:\\|^\//.test(c)));
const unix = relierEquipe(equipe.map((m) => ({ ...m, racine: `/home/max/Documents/iAgent/${m.prenom}` })));
verifier('sous Linux, le séparateur est la barre', unix.dossiers['Léa']?.['plans/besoins'] === '/home/max/Documents/iAgent/Hugo/plans/besoins');
const deuxAuteurs = relierEquipe([...equipe, { prenom: 'Hugo2', posteId: 'AG-0669', fiche: fiche('AG-0669'), racine: '/x' }]);
verifier("deux membres qui écrivent le même dossier : on ne devine pas", deuxAuteurs.dossiers['Léa']?.['plans/besoins'] === undefined);

if (lue) {
  const c = competencesDuMembre(equipe[1], equipe, lue, passages);
  const texte = c.map((x) => `${x.titre} ${x.resume}`).join(' ');
  verifier('le membre connaît la mission de l’équipe', c[0].resume === DEMANDE_MAX);
  verifier('le membre connaît son rôle et les mots qui l’ont fait venir', /Investisseurs privés : « .*business angels/.test(texte), texte.slice(0, 300));
  verifier('le membre nomme ses collègues par leur prénom', /Hugo, Business plan analyst/.test(texte));
  verifier('le relais de la fiche devient un prénom', /Je reçois de Hugo, le besoin de financement/.test(texte), texte);
  verifier('le membre sait où il lit', /plans\/besoins chez Hugo/.test(texte));
}

const prenoms = prenomsPourEquipe(8, ['Victor', 'léa']);
verifier('les prénoms proposés évitent ceux déjà pris', !prenoms.some((p) => ['victor', 'lea'].includes(normaliser(p))) && new Set(prenoms).size === 8);
verifier('les prénoms proposés passent la règle de l’installation', prenoms.every((p) => /^[\p{L}\p{N} -]+$/u.test(p)));

if (echecs) {
  console.error(`${echecs} échec(s) au banc de l'équipe`);
  process.exit(1);
}
console.log("Banc de l'équipe : la demande de max donne l'équipe de la levée, sans question ni agent de hasard.");
