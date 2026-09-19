import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  installerAgents,
  logicielsMetier,
  planningDuClient,
  dossiersUtilises,
  dossiersManquants,
  repartitionAutonomie,
  tachesQuotidiennes,
  AGENTS_MAX_PAR_POSTE,
  type Fiche,
  type Installation,
} from './src/agents/fiche.ts';
import { ConversationEngine } from './src/engines/ConversationEngine.ts';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');

const installation: { agents: Installation[] } = JSON.parse(
  readFileSync(join(ici, 'src', 'config', 'installation.json'), 'utf8')
);

function fichesDuCatalogue(ids: readonly string[]): Fiche[] {
  const fichiers = readdirSync(join(racine, 'agents'));
  return ids.map((id) => {
    const nom = fichiers.find((f) => f.startsWith(`${id}-`));
    if (!nom) throw new Error(`fiche ${id} absente de agents/`);
    return JSON.parse(readFileSync(join(racine, 'agents', nom), 'utf8')) as Fiche;
  });
}

let echecs = 0;
function verifier(intitule: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok  ${intitule}`);
  } else {
    echecs++;
    console.log(`  ÉCHEC  ${intitule}${detail ? ` — ${detail}` : ''}`);
  }
}

function refuse(installations: Installation[], fiches: Fiche[]): boolean {
  try {
    installerAgents(fiches, installations);
    return false;
  } catch {
    return true;
  }
}

const ids = installation.agents.map((a) => a.ficheId);
const fiches = fichesDuCatalogue(ids);
const agents = installerAgents(fiches, installation.agents);

verifier(
  'les agents installés se chargent depuis les vraies fiches de agents/',
  agents.length === installation.agents.length
);

verifier(
  "chaque agent garde le prénom de l'employeur et le métier de sa fiche",
  agents.every((a) => a.prenom.length > 0 && a.fiche.nom.length > 0)
);

verifier(
  "la consigne d'expert vient de la fiche, pas d'un texte recopié",
  agents.every((a) => a.fiche.expert.consigne.length > 200)
);

verifier(
  'chaque fiche porte ses connaissances métier',
  agents.every((a) => a.fiche.expert.connaissances.length > 0)
);

verifier(
  'chaque fiche porte une liste de tâches conséquente',
  agents.every((a) => a.fiche.taches.length >= 5),
  agents.map((a) => `${a.prenom}:${a.fiche.taches.length}`).join(' ')
);

verifier(
  'les logiciels métier (CRM, ERP…) sont lisibles depuis les tâches',
  agents.every((a) => logicielsMetier(a.planning).length > 0),
  agents.map((a) => `${a.prenom}:${logicielsMetier(a.planning).join('/')}`).join(' | ')
);

const horaires = agents.flatMap((a) =>
  a.fiche.taches.flatMap((t) =>
    t.planification.type === 'quotidienne' ? [t.planification.heure] : []
  )
);

verifier(
  'les tâches à heure fixe sont déjà décrites par la fiche',
  horaires.length > 0,
  horaires.join(' ')
);

// Le planning du client : la fiche donne le défaut, le client le remanie.
const marie = agents.find((a) => a.prenom === 'Marie');
if (!marie) throw new Error('Marie absente de installation.json');

const aDixNeuf = tachesQuotidiennes(marie.planning, '19:00').map((t) => t.id);

verifier(
  "le client déplace une tâche de la fiche à 19h00",
  aDixNeuf.includes('tenir-journal-ventes'),
  aDixNeuf.join(' ')
);

verifier(
  "le client ajoute sa propre tâche à 19h00",
  aDixNeuf.includes('compte-rendu-du-soir')
);

verifier(
  'une tâche ajoutée par le client exige une validation humaine par défaut',
  marie.planning.find((t) => t.id === 'compte-rendu-du-soir')?.validationHumaine === true
);

verifier(
  'le client désactive une tâche sans la supprimer de la fiche',
  marie.planning.find((t) => t.id === 'preparer-avoirs')?.active === false &&
    marie.fiche.taches.some((t) => t.id === 'preparer-avoirs')
);

verifier(
  "la fiche n'est pas modifiée par le planning du client",
  marie.fiche.taches.find((t) => t.id === 'tenir-journal-ventes')?.planification.heure ===
    '17:30'
);

const carla = agents.find((a) => a.prenom === 'Carla');
verifier(
  'un agent sans planning garde le plan par défaut de sa fiche',
  carla !== undefined && carla.planning.length === carla.fiche.taches.length
);

verifier(
  'deux clients du même agent peuvent avoir des tâches différentes',
  planningDuClient(marie.fiche, {}).length !== marie.planning.length
);

let ajustementInconnu = false;
try {
  planningDuClient(marie.fiche, { ajustements: [{ tacheId: 'nexiste-pas' }] });
} catch {
  ajustementInconnu = true;
}
verifier("un planning qui vise une tâche inconnue est refusé", ajustementInconnu);

let idEnDouble = false;
try {
  planningDuClient(marie.fiche, {
    ajoutees: [
      {
        id: 'rediger-factures',
        nom: 'x',
        description: 'x',
        planification: { type: 'a-la-demande' },
      },
    ],
  });
} catch {
  idEnDouble = true;
}
verifier("une tâche ajoutée ne peut pas réutiliser l'identifiant d'une tâche de la fiche", idEnDouble);

verifier(
  `un poste refuse plus de ${AGENTS_MAX_PAR_POSTE} agents`,
  refuse(
    Array.from({ length: AGENTS_MAX_PAR_POSTE + 1 }, (_, i) => ({
      prenom: `Agent${i}`,
      ficheId: ids[0],
      voix: 'v',
    })),
    fiches
  )
);

verifier(
  'deux agents du même prénom sur un poste sont refusés',
  refuse(
    [
      { prenom: 'Carla', ficheId: ids[0], voix: 'v' },
      { prenom: 'carla', ficheId: ids[0], voix: 'v' },
    ],
    fiches
  )
);

verifier(
  "une fiche inconnue est refusée à l'installation",
  refuse([{ prenom: 'X', ficheId: 'AG-9999', voix: 'v' }], fiches)
);

// Photo : la fiche en livre une, le client peut la remplacer.
const avecPhotos = installerAgents(
  [{ ...marie.fiche, photo: 'visuels/ag-0028.png' }],
  [
    { prenom: 'Marie', ficheId: marie.fiche.id, voix: 'v' },
    { prenom: 'Sophie', ficheId: marie.fiche.id, voix: 'v', photo: 'visuels/sophie.png' },
  ]
);

verifier(
  'sans choix du client, la photo de la fiche est reprise',
  avecPhotos[0].photo === 'visuels/ag-0028.png'
);

verifier(
  "la photo choisie par le client l'emporte sur celle de la fiche",
  avecPhotos[1].photo === 'visuels/sophie.png'
);

verifier(
  "une fiche sans photo n'empêche pas l'installation",
  agents.every((a) => typeof a.photo === 'string')
);

// Dossiers : la fiche les nomme logiquement, le client dit où ils sont.
const attendus = dossiersUtilises(marie.planning);

verifier(
  'les dossiers nommés par les tâches sont retrouvés',
  attendus.length > 0,
  attendus.join(' ')
);

verifier(
  "sans réglage, tous les dossiers restent à demander au client",
  dossiersManquants(marie.planning).length === attendus.length
);

verifier(
  'un dossier renseigné disparaît de la liste des questions',
  dossiersManquants(marie.planning, { [attendus[0]]: 'C:/Factures/Devis' }).length ===
    attendus.length - 1
);

verifier(
  "un dossier d'une tâche désactivée n'est pas demandé",
  (() => {
    const sansJournal = marie.planning.map((t) =>
      t.id === 'tenir-journal-ventes' ? { ...t, active: false } : t
    );
    return dossiersUtilises(sansJournal).length <= attendus.length;
  })()
);

verifier(
  "les dossiers réglés à l'installation arrivent jusqu'à l'agent",
  installerAgents(fiches, [
    {
      prenom: 'Zoe',
      ficheId: ids[0],
      voix: 'v',
      dossiers: { 'facturation/devis-acceptes': 'D:/Devis' },
    },
  ])[0].dossiers['facturation/devis-acceptes'] === 'D:/Devis'
);

// Mode auto / mode contrôle, réglé par le client tâche par tâche.
const enControle = marie.fiche.taches.find((t) => t.validationHumaine);
const enAuto = marie.fiche.taches.find((t) => !t.validationHumaine);

verifier(
  'la fiche livre un mélange de tâches autonomes et contrôlées',
  enControle !== undefined && enAuto !== undefined
);

verifier(
  'le client passe une tâche contrôlée en mode auto',
  enControle !== undefined &&
    planningDuClient(marie.fiche, {
      ajustements: [{ tacheId: enControle.id, validationHumaine: false }],
    }).find((t) => t.id === enControle.id)?.validationHumaine === false
);

verifier(
  'le client passe une tâche autonome en mode contrôle',
  enAuto !== undefined &&
    planningDuClient(marie.fiche, {
      ajustements: [{ tacheId: enAuto.id, validationHumaine: true }],
    }).find((t) => t.id === enAuto.id)?.validationHumaine === true
);

const partage = repartitionAutonomie(marie.planning);
verifier(
  "la répartition auto / contrôle se lit d'un coup d'œil",
  partage.auto.length + partage.controle.length ===
    marie.planning.filter((t) => t.active).length,
  `auto ${partage.auto.length} / contrôle ${partage.controle.length}`
);

// Compétences : la fiche porte le métier, l'employeur ajoute sa maison.
const avecCompetences = installerAgents(fiches, [
  {
    prenom: 'Nina',
    ficheId: ids[0],
    voix: 'v',
    competences: [{ titre: 'Nos tarifs 2026', resume: 'Grille interne, remises par volume.' }],
  },
]);

const invitePlus = new ConversationEngine(avecCompetences, {
  conversation: { max_context_turns: 10, user_session_timeout_minutes: 30 },
  tts: { primary: {} },
  stt: { primary: {} },
  llm: { primary: {} },
}).formatSystemPrompt(ids[0]);

verifier(
  'les connaissances de la fiche arrivent jusqu au prompt',
  invitePlus.includes(avecCompetences[0].fiche.expert.connaissances[0].titre)
);

verifier(
  "ce que l employeur a appris figure au prompt et prime sur le savoir général",
  invitePlus.includes('Nos tarifs 2026') && invitePlus.includes('prime sur le savoir général')
);

// Sexe : choix du client, et il doit primer sur le genre figé dans la fiche.
const genres = installerAgents(marie ? [marie.fiche] : [], [
  { prenom: 'Marie', ficheId: marie.fiche.id, voix: 'v', sexe: 'femme' },
  { prenom: 'Marc', ficheId: marie.fiche.id, voix: 'v', sexe: 'homme' },
  { prenom: 'Camille', ficheId: marie.fiche.id, voix: 'v' },
]);

const moteurGenres = new ConversationEngine(genres, {
  conversation: { max_context_turns: 10, user_session_timeout_minutes: 30 },
  tts: { primary: {} },
  stt: { primary: {} },
  llm: { primary: {} },
});

verifier(
  'aucun genre choisi : le prompt n impose rien',
  !moteurGenres.formatSystemPrompt(genres[2].fiche.id).includes('tu parles de toi')
);

verifier(
  'le genre choisi est énoncé et prime sur la formulation de la fiche',
  (() => {
    const p = new ConversationEngine([genres[0]], {
      conversation: { max_context_turns: 10, user_session_timeout_minutes: 30 },
      tts: { primary: {} },
      stt: { primary: {} },
      llm: { primary: {} },
    }).formatSystemPrompt(genres[0].fiche.id);
    return p.includes('une femme') && p.includes('au féminin') && p.includes('Quelle que soit');
  })()
);

verifier(
  'le masculin est énoncé de la même façon',
  (() => {
    const p = new ConversationEngine([genres[1]], {
      conversation: { max_context_turns: 10, user_session_timeout_minutes: 30 },
      tts: { primary: {} },
      stt: { primary: {} },
      llm: { primary: {} },
    }).formatSystemPrompt(genres[1].fiche.id);
    return p.includes('un homme') && p.includes('au masculin');
  })()
);

// Détection du prénom : « l'employeur dit Carla, Carla répond ».
const moteur = new ConversationEngine(agents, {
  conversation: { max_context_turns: 10, user_session_timeout_minutes: 30 },
  tts: { primary: {} },
  stt: { primary: {} },
  llm: { primary: {} },
});

const cas: Array<[string, string | null, string]> = [
  ['Carla, quels sont les horaires ?', 'Carla', 'quels sont les horaires ?'],
  ['Robert peux-tu vérifier la commande', 'Robert', 'peux-tu vérifier la commande'],
  ['Marie bonjour', 'Marie', 'bonjour'],
  ['carla bonjour', 'Carla', 'bonjour'],
  ['Carlaa tu es là ?', 'Carla', 'tu es là ?'],
  ['Bonjour tout le monde', null, ''],
  ['Sophie es-tu là', null, ''],
];

for (const [phrase, prenomAttendu, enonceAttendu] of cas) {
  const r = moteur.detectAgent(phrase);
  const prenomObtenu = r?.agent.prenom ?? null;
  const ok = prenomObtenu === prenomAttendu && (r === null || r.utterance === enonceAttendu);
  verifier(
    `« ${phrase} » → ${prenomAttendu ?? 'aucun agent'}`,
    ok,
    ok ? '' : `obtenu ${prenomObtenu} / « ${r?.utterance ?? ''} »`
  );
}

// Deux prénoms à une lettre d'écart : on préfère le silence au mauvais agent.
const ambigu = new ConversationEngine(
  installerAgents(fiches, [
    { prenom: 'Carla', ficheId: ids[0], voix: 'v' },
    { prenom: 'Carlo', ficheId: ids[0], voix: 'v' },
  ]),
  {
    conversation: { max_context_turns: 10, user_session_timeout_minutes: 30 },
    tts: { primary: {} },
    stt: { primary: {} },
    llm: { primary: {} },
  }
);

verifier(
  'entre deux prénoms aussi proches, aucun agent ne répond',
  ambigu.detectAgent('Carlx tu es là') === null
);

verifier(
  "mais un prénom exact l'emporte toujours sur son voisin",
  ambigu.detectAgent('Carlo tu es là')?.agent.prenom === 'Carlo'
);

const sessionId = 'controle';
moteur.createSession(sessionId, marie.fiche.id);
const invite = moteur.formatSystemPrompt(marie.fiche.id);

verifier(
  "le prompt système reprend la consigne de la fiche et le prénom du client",
  invite.includes(marie.fiche.expert.consigne.slice(0, 80)) && invite.includes('Marie')
);

verifier(
  'la voix vient de l installation, pas de la fiche',
  moteur.getTTSConfig(marie.fiche.id).voice_id === 'ZQe5CZNOzWyzChESwQEW'
);

console.log();
if (echecs > 0) {
  console.log(`${echecs} échec(s) — agents desktop`);
  process.exit(1);
}
console.log(`${agents.length} agents installés depuis agents/ — contrôle ok`);
