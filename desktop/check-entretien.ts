/**
 * Banc de l'entretien d'embauche. Ce qui est vérifié ici n'est pas du confort : c'est la
 * limite entre un agent qui dit ce qu'il sait faire et un agent qui promet.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { economiePour } from '../dimensionnement/economie.ts';
import { INTENSITES, REPARTITIONS } from '../dimensionnement/intensite.ts';
import {
  questionsCadre,
  reconnaitreActivite,
  horairesDeLaFiche,
  dossiersDeLaFiche,
  questionsEntretien,
  reconnaitre,
  configurer,
  porteeReelle,
  phrasePortee,
  resumeParle,
  normaliser,
  type Referentiel,
  type FicheQualifiee,
  type FicheCompelete,
  type ReferentielActivites,
  INTITULES,
} from './src/agents/entretien.ts';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');
const ref: Referentiel = JSON.parse(readFileSync(join(racine, 'catalogue/logiciels.json'), 'utf8'));
const activites: ReferentielActivites = JSON.parse(readFileSync(join(racine, 'catalogue/activites.json'), 'utf8'));

function fiche(id: string): FicheQualifiee {
  const f = readdirSync(join(racine, 'agents')).find((n) => n.startsWith(`${id}-`));
  if (!f) throw new Error(`fiche ${id} absente`);
  return JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8'));
}

let echecs = 0;
function verifier(intitule: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok  ${intitule}`);
  else { echecs++; console.log(`  ✗   ${intitule}${detail ? ` — ${detail}` : ''}`); }
}

const paie = fiche('AG-0133');       // Assistant paie : Silae, PayFit, Sage Paie, ADP, Cegid, DSN
const courrier = fiche('AG-0009');   // Gestionnaire de courrier

// --- Les questions ---------------------------------------------------------
const questions = questionsEntretien(paie, ref);
verifier(
  "l'agent pose une question par famille d'outils, pas une par produit",
  questions.length < (paie.qualifications?.logiciels.length ?? 0),
  `${questions.length} questions pour ${paie.qualifications?.logiciels.length} logiciels`
);
verifier(
  "les familles sans lesquelles le poste n'existe pas viennent en premier",
  questions[0].principale === true,
  questions[0].categorie
);
verifier(
  "la question de paie cite les logiciels que l'agent sait tenir",
  questions.some((q) => q.categorie === 'paie' && q.propositions.includes('Silae')),
);
verifier(
  "chaque question est une phrase parlée, pas un nom de champ",
  questions.every((q) => q.intitule.endsWith('?') && q.intitule.length > 20),
);

// --- La reconnaissance de ce que le client dit -----------------------------
verifier("« silae » sans majuscule est reconnu", (() => {
  const v = reconnaitre('silae', ref, 'paie');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Silae';
})());
verifier("« on est sur Pennylane » est reconnu dans la phrase", (() => {
  const v = reconnaitre('on est sur Pennylane', ref, 'comptabilite');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Pennylane';
})());
verifier("un alias du relevé V6 est reconnu", (() => {
  const v = reconnaitre('Workday', ref, 'sirh');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Workday HCM';
})(), 'Workday → Workday HCM');
verifier("les accents ne changent rien", normaliser('Eurécia') === normaliser('eurecia'));
verifier("« Sage » sans famille désigne trop de produits pour être tranché", (() => {
  const v = reconnaitre('Sage', ref);
  return v.etat === 'ambigu' && v.candidats.length > 2;
})());
verifier("dans une famille donnée, « Sage » se résout au produit de cette famille", (() => {
  const v = reconnaitre('Sage', ref, 'paie');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Sage Paie & RH';
})());
verifier("« Microsoft » reste ambigu même dans sa famille, il y en a deux", (() => {
  const v = reconnaitre('Microsoft', ref, 'bureautique');
  return v.etat === 'ambigu' && v.candidats.length === 2;
})());
verifier("un outil inconnu reste inconnu, il n'est pas rapproché du plus proche", (() => {
  const v = reconnaitre('Gestipaye 3000', ref, 'paie');
  return v.etat === 'inconnu';
})());

// --- La configuration ------------------------------------------------------
const config = configurer(paie, ref, [{ categorie: 'paie', dit: 'Silae' }]);
verifier(
  "un outil reconnu et déclaré par la fiche est retenu",
  config.retenus.some((o) => o.logiciel.nom === 'Silae'),
);

// Le gestionnaire de courrier travaille dans quatre familles : on n'en renseigne qu'une.
const partielle = configurer(courrier, ref, [{ categorie: 'bureautique', dit: 'Microsoft 365' }]);
verifier(
  "une famille restée sans réponse est signalée comme telle",
  partielle.sansReponse.length === 3,
  partielle.sansReponse.map((s) => s.categorie).join(', ')
);
verifier(
  "l'agent distingue ce qui lui manque d'essentiel du reste",
  partielle.sansReponse.some((s) => s.principale) &&
    resumeParle(partielle).some((l) => l.includes('Il me manque l\'essentiel')),
);

const horsMetier = configurer(paie, ref, [{ categorie: 'paie', dit: 'Procore' }]);
verifier(
  "un outil que la fiche n'a jamais déclaré savoir tenir n'est pas retenu",
  horsMetier.retenus.length === 0 && horsMetier.horsMetier.some((l) => l.nom === 'Procore'),
);

const inconnu = configurer(paie, ref, [{ categorie: 'paie', dit: 'notre logiciel maison Paie2001' }]);
verifier(
  "ce que le référentiel ignore est conservé mot pour mot, jamais deviné",
  inconnu.inconnus.includes('notre logiciel maison Paie2001') && inconnu.retenus.length === 0,
);

const ambigu = configurer(courrier, ref, [{ categorie: 'bureautique', dit: 'Microsoft' }]);
verifier(
  "une réponse qui désigne plusieurs produits fait redemander, pas choisir",
  ambigu.aPreciser.length === 1 && ambigu.retenus.length === 0,
);
verifier(
  "et l'agent redemande à voix haute en citant les produits possibles",
  resumeParle(ambigu).some((l) => l.includes('Lequel est le vôtre ?') && l.includes('Microsoft 365')),
);

// --- Le client parle comme il parle ---------------------------------------
verifier("« on fait ça sur Excel » tombe sur la suite bureautique", (() => {
  const v = reconnaitre('on fait ça sur Excel', ref, 'bureautique');
  return v.etat === 'reconnu' && v.logiciel.nom === 'Microsoft 365';
})());
verifier("« LinkedIn » tout court désigne l'outil de recrutement", (() => {
  const v = reconnaitre('LinkedIn', ref, 'ats');
  return v.etat === 'reconnu' && v.logiciel.nom === 'LinkedIn Recruiter';
})());
verifier("« on n'a rien » est une réponse, pas une incompréhension", (() => {
  const v = reconnaitre("on n'a rien", ref, 'facturation');
  return v.etat === 'sans-outil';
})());
verifier("« tout est sur papier » aussi", (() => {
  const v = reconnaitre('tout est sur papier', ref, 'ged');
  return v.etat === 'sans-outil';
})());
const rien = configurer(courrier, ref, [{ categorie: 'facturation', dit: "on n'a rien pour ça" }]);
verifier(
  "une famille sans outil n'est ni retenue, ni notée comme inconnue",
  rien.sansOutil.length === 1 && rien.inconnus.length === 0 && rien.retenus.length === 0,
);
verifier(
  "l'agent le dit à voix haute et annonce comment il fera sans",
  resumeParle(rien).some((l) => l.includes("Vous n'avez pas d'outil") && l.includes('vos fichiers')),
);
verifier(
  "un nom de produit contenant un mot de négation reste reconnu comme produit",
  (() => {
    const v = reconnaitre('Pennylane', ref, 'comptabilite');
    return v.etat === 'reconnu';
  })(),
);
verifier(
  "un nom d'outil caché dans un mot plus long n'est pas reconnu comme cet outil",
  (() => {
    // « papier » contient « PAP », « sapin » contient « SAP » : sans mots entiers,
    // le client qui dit n'avoir aucun outil se voit proposer un portail d'annonces.
    const v = reconnaitre('tout est sur papier', ref);
    const w = reconnaitre('on range ça dans un sapin de dossiers', ref);
    return v.etat !== 'reconnu' && w.etat !== 'reconnu';
  })(),
);
verifier(
  "mais un nom d'outil dit au milieu d'une phrase reste reconnu",
  (() => {
    const v = reconnaitre('on est passé sur Odoo', ref, 'erp');
    const w = reconnaitre('on est sur Pennylane', ref, 'comptabilite');
    return v.etat === 'reconnu' && v.logiciel.nom === 'Odoo'
      && w.etat === 'reconnu' && w.logiciel.nom === 'Pennylane';
  })(),
);
verifier(
  "un produit dont le nom contient celui d'un autre ne rend pas la réponse ambiguë",
  (() => {
    // « Pipedrive » contient « Drive », « Lexoffice » contient « Office » : demander au
    // client de choisir entre l'outil qu'il vient de nommer et un autre le déroute.
    const a = reconnaitre('Pipedrive', ref, 'crm');
    const b = reconnaitre('Lexoffice', ref);
    return a.etat === 'reconnu' && a.logiciel.nom === 'Pipedrive'
      && b.etat === 'reconnu' && b.logiciel.nom === 'Lexoffice';
  })(),
);

// --- Ce que l'agent promet -------------------------------------------------
const sansApi = ref.logiciels.filter((l) => porteeReelle(l) === 'navigateur');
verifier(
  "un outil sans interface annonce le navigateur et la validation du client",
  sansApi.length > 0 && sansApi.every((l) => {
    const p = phrasePortee(l);
    return p.includes('navigateur') && p.includes('valid');
  }),
  `${sansApi.length} outils concernés`
);
const avecApi = ref.logiciels.filter((l) => porteeReelle(l) === 'api');
verifier(
  "même avec une interface officielle, l'agent ne se dit jamais déjà connecté",
  avecApi.every((l) => {
    const p = phrasePortee(l).toLowerCase();
    return !p.includes('je suis connecté') && !p.includes('je suis branché');
  }),
);
verifier(
  "un outil à interface officielle dit que l'accès reste à ouvrir sur le compte du client",
  avecApi.every((l) => phrasePortee(l).includes('votre compte')),
);

const resume = resumeParle(inconnu);
verifier(
  "devant un outil inconnu, l'agent dit qu'il ne prétendra pas savoir s'en servir",
  resume.some((l) => l.includes('Paie2001') && l.includes('ne prétendrai pas')),
);

// --- Toutes les fiches qualifiées passent l'entretien ----------------------
const fichiers = readdirSync(join(racine, 'agents'));
let qualifiees = 0;
let sansQuestion = 0;
for (const f of fichiers) {
  const p: FicheQualifiee = JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8'));
  if (!p.qualifications) continue;
  qualifiees++;
  if (questionsEntretien(p, ref).length === 0) sansQuestion++;
}
verifier(
  "toute fiche qualifiée sait mener son entretien",
  sansQuestion === 0,
  `${qualifiees} fiches qualifiées, ${sansQuestion} sans question`
);
verifier(
  "un agent sans qualification ne pose aucune question plutôt que d'en inventer",
  questionsEntretien({ nom: 'témoin' }, ref).length === 0,
);

// --- Le cadrage : activité, horaires, intensité, répartition, autonomie ----
const pleine = paie as FicheCompelete;
const couts = {
  light: economiePour(pleine as never, { intensite: 'light' }).apiResiduelle,
  medium: economiePour(pleine as never, { intensite: 'medium' }).apiResiduelle,
  high: economiePour(pleine as never, { intensite: 'high' }).apiResiduelle,
};
const cadre = questionsCadre(pleine, couts);
const sujets = cadre.map((q) => q.sujet);
verifier(
  "l'entretien couvre l'activité, les horaires, l'intensité, la répartition, l'autonomie et les dossiers",
  ['activite', 'horaires', 'intensite', 'repartition', 'autonomie', 'dossiers'].every((s) => sujets.includes(s as never)),
  sujets.join(', ')
);
verifier(
  "chaque question de cadrage porte déjà sa réponse, sauf celle que l'agent ne peut pas deviner",
  cadre.filter((q) => !q.defaut).length === 1 && cadre.find((q) => !q.defaut)?.sujet === 'activite',
);
verifier(
  "les horaires proposés viennent des heures écrites sur la fiche",
  (() => {
    const h = horairesDeLaFiche(pleine.taches ?? []);
    const q = cadre.find((x) => x.sujet === 'horaires');
    return !!h && !!q && q.intitule.includes(String(Number(h.debut.split(':')[0])));
  })(),
);
verifier(
  "le choix de l'intensité est présenté avec son coût en euros, pas avec un adjectif",
  (() => {
    const q = cadre.find((x) => x.sujet === 'intensite');
    return !!q && /\d+ € d'API par mois/.test(q.intitule);
  })(),
);
verifier(
  "un rythme soutenu coûte plus cher qu'un rythme normal, qui coûte plus qu'un rythme léger",
  couts.high > couts.medium && couts.medium > couts.light,
  `${couts.light} < ${couts.medium} < ${couts.high}`
);
verifier(
  "en tout local, rien ne se paie au jeton",
  economiePour(pleine as never, { repartition: 'local' }).apiResiduelle === 0,
);
verifier(
  "et l'agent dit alors que ce que la machine ne tient pas s'arrête au lieu d'être fait en moins bien",
  REPARTITIONS.local.phrase.includes("s'arrête"),
);
verifier(
  "changer d'intensité ne change aucune autonomie : c'est un réglage de charge, pas de droits",
  Object.values(INTENSITES).every((i) => !/autonom|valid|accord/i.test(i.phrase)),
);
verifier(
  "la question d'autonomie dit combien de tâches attendent l'accord du client",
  (() => {
    const q = cadre.find((x) => x.sujet === 'autonomie');
    const aValider = (pleine.taches ?? []).filter((t) => t.validationHumaine).length;
    return !!q && q.intitule.includes(String(aValider));
  })(),
);
verifier(
  "les dossiers annoncés sont ceux où la fiche écrit vraiment",
  dossiersDeLaFiche(pleine.taches ?? []).length > 0,
);

// --- L'activité du client --------------------------------------------------
verifier("« on est dans la quincaillerie de gros » est reconnu", (() => {
  const v = reconnaitreActivite('on est dans la quincaillerie de gros', activites);
  return v.etat === 'reconnu' && v.activite.nom === 'Quincaillerie de gros';
})());
verifier("« imprimeur » tombe sur l'imprimerie", (() => {
  const v = reconnaitreActivite('imprimeur', activites);
  return v.etat === 'reconnu' && v.activite.famille === 'industrie';
})());
verifier("une activité inconnue reste inconnue plutôt que rapprochée de force", (() => {
  const v = reconnaitreActivite('fabricant de soucoupes volantes', activites);
  return v.etat === 'inconnu';
})());
verifier(
  "chaque activité dit ce qui caractérise la branche, pas seulement son nom",
  activites.activites.every((a) => a.trait.length >= 40),
);

// Une catégorie sans question écrite retombe sur une phrase fabriquée à partir de son
// identifiant (« Quel outil utilisez-vous pour note de frais ? ») : lue à voix haute, elle
// trahit la fiche produit derrière l'agent.
verifier(
  "chaque famille de logiciels a sa question dite en français, aucune n'est fabriquée",
  ref.categories.every((c) => typeof INTITULES[c] === 'string' && INTITULES[c].length > 10),
);

console.log(`${echecs === 0 ? `${qualifiees} fiches qualifiées — entretien d'embauche ok` : `${echecs} attente(s) non tenue(s)`}`);
if (echecs) process.exit(1);
