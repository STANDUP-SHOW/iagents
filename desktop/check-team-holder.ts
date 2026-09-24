import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installerAgents, type Fiche, type Installation } from './src/agents/fiche.ts';
import {
  FICHE_TEAM_HOLDER,
  REGLAGES,
  comprendreDemande,
  contexteDuTeamHolder,
  etatEquipe,
  rassemblerContexte,
  changementEnMots,
  type Changement,
  type Production,
} from './src/agents/team-holder.ts';

/**
 * Le Team Holder : sa fiche se charge comme les autres, il comprend une demande
 * de réglage sans deviner, et l'écran parle la même langue que `equipe.rs`.
 */

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');

let echecs = 0;
function verifier(intitule: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok  ${intitule}`);
  else { echecs++; console.log(`  ✗   ${intitule}${detail ? ` — ${detail}` : ''}`); }
}

function fiche(dossier: string, id: string): Fiche {
  const nom = readdirSync(join(racine, dossier)).find((f) => f.startsWith(`${id}-`));
  if (!nom) throw new Error(`fiche ${id} absente de ${dossier}/`);
  return JSON.parse(readFileSync(join(racine, dossier, nom), 'utf8')) as Fiche;
}

// --- La fiche vit au socle, pas dans la boutique -----------------------------------
const th = fiche('socle', FICHE_TEAM_HOLDER);
verifier('la fiche du Team Holder se lit dans socle/', th.id === FICHE_TEAM_HOLDER && th.nom === 'Team Holder');
verifier(
  "elle n'est pas dans agents/, que la boutique met en vente",
  !readdirSync(join(racine, 'agents')).some((f) => f.startsWith(`${FICHE_TEAM_HOLDER}-`))
);
const conf = JSON.parse(readFileSync(join(ici, 'src-tauri/tauri.conf.json'), 'utf8'));
verifier(
  "l'installeur embarque socle/, sinon l'application ne trouverait pas sa fiche",
  conf.bundle?.resources?.['../../socle'] === 'socle'
);
const catalogue = JSON.parse(readFileSync(join(racine, 'catalogue/catalogue.json'), 'utf8'));
verifier(
  'le catalogue le range au socle, hors des métiers vendus',
  catalogue.socle?.agents?.some((a: { id: string }) => a.id === FICHE_TEAM_HOLDER) &&
    !catalogue.agents.some((a: { id: string }) => a.id === FICHE_TEAM_HOLDER)
);

// --- Les réglages et les champs sont les mêmes des deux côtés ------------------------
const rust = readFileSync(join(ici, 'src-tauri/src/equipe.rs'), 'utf8');
const declares = rust.match(/pub const REGLAGES: \[&str; \d+\]\s*=\s*\[([^\]]+)\]/);
const cotesRust = (declares?.[1] ?? '').match(/"([A-Za-z]+)"/g)?.map((s) => s.replace(/"/g, '')) ?? [];
verifier('la liste des réglages se lit encore dans equipe.rs', cotesRust.length > 0);
verifier(
  "l'écran et le code qui applique touchent les mêmes réglages",
  cotesRust.join(',') === [...REGLAGES].join(','),
  `rust ${cotesRust.join('/')} ≠ écran ${REGLAGES.join('/')}`
);
const ficheRust = rust.match(/pub const FICHE_TEAM_HOLDER: &str = "([^"]+)"/)?.[1];
verifier('la fiche du Team Holder est la même des deux côtés', ficheRust === FICHE_TEAM_HOLDER, String(ficheRust));

// Une structure Rust arrive en JavaScript avec SES noms (`annule_le`, pas `annuleLe`).
const ts = readFileSync(join(ici, 'src/agents/team-holder.ts'), 'utf8');
const champs = (motif: RegExp, source: string, nom: string, ligne: RegExp): string[] => {
  const bloc = source.match(new RegExp(`${motif.source} ${nom} \\{([\\s\\S]*?)\\n\\}`));
  return bloc ? [...bloc[1].matchAll(ligne)].map((m) => m[1]) : [];
};
for (const nom of ['Changement', 'Production']) {
  const cote = champs(/struct/, rust, nom, /^\s*pub ([a-z_0-9]+):/gm);
  const ecran = champs(/interface/, ts, nom, /^\s*([A-Za-z_0-9]+)[?]?:/gm);
  verifier(
    `${nom} : l'écran lit exactement les champs que Rust envoie`,
    cote.length > 0 && cote.join(',') === ecran.join(','),
    `rust ${cote.join('/')} ≠ écran ${ecran.join('/')}`
  );
}

// --- Il comprend une demande, ou pose une seule question ----------------------------
const installations: Installation[] = [
  { prenom: 'Alice', ficheId: FICHE_TEAM_HOLDER, voix: 'v' },
  { prenom: 'Carla', ficheId: 'AG-0179', voix: 'v' },
  { prenom: 'Robert', ficheId: 'AG-0196', voix: 'v' },
  {
    prenom: 'Marie', ficheId: 'AG-0028', voix: 'v',
    planning: { ajustements: [{ tacheId: 'preparer-avoirs', active: false }] },
  },
];
const agents = installerAgents(
  [th, fiche('agents', 'AG-0179'), fiche('agents', 'AG-0196'), fiche('agents', 'AG-0028')],
  installations
);

const equipe = etatEquipe(agents);
verifier("l'équipe du Team Holder, c'est les autres", equipe.map((m) => m.prenom).join(',') === 'Carla,Robert,Marie');

const attendus: [string, (c: ReturnType<typeof comprendreDemande>) => boolean, string][] = [
  [
    "Marie, rends l'état de la facturation du jour à 19h",
    (c) => 'proposition' in c && c.proposition.agent === 'Marie' && c.proposition.tacheId === 'etat-facturation-du-jour'
      && c.proposition.reglage === 'planification'
      && JSON.stringify(c.proposition.valeur) === '{"type":"quotidienne","heure":"19:00"}'
      && c.proposition.phrase.includes('tous les jours à 17:30') && c.proposition.phrase.includes('tous les jours à 19:00'),
    "l'horaire change, et la phrase dit l'avant et l'après",
  ],
  [
    'Je veux relire les relances de devis de Carla avant de les envoyer',
    (c) => 'proposition' in c && c.proposition.tacheId === 'relancer-devis'
      && c.proposition.reglage === 'validationHumaine' && c.proposition.valeur === true,
    'passer une tâche en mode contrôle',
  ],
  [
    'Robert peut tenir la bibliothèque commerciale tout seul',
    (c) => 'deja' in c,
    'une tâche déjà autonome ne fait pas un changement de plus',
  ],
  [
    'Arrête les dossiers de rendez-vous de Robert',
    (c) => 'proposition' in c && c.proposition.tacheId === 'preparer-dossiers-rendez-vous'
      && c.proposition.reglage === 'active' && c.proposition.valeur === false,
    'éteindre une tâche',
  ],
  [
    'Réactive les avoirs de Marie',
    (c) => 'proposition' in c && c.proposition.tacheId === 'preparer-avoirs' && c.proposition.valeur === true,
    "rallumer une tâche que le client avait éteinte",
  ],
  [
    'Décale les factures à 14h',
    (c) => 'question' in c && c.question.includes('Carla') && c.question.includes('Marie'),
    "sans prénom, il demande de quel agent il s'agit",
  ],
  [
    'Marie, change quelque chose',
    (c) => 'question' in c && c.question.startsWith('Quelle tâche de Marie'),
    'sans tâche reconnue, il demande laquelle',
  ],
  [
    'Carla et Marie, arrêtez les factures',
    (c) => 'question' in c,
    'deux agents nommés : il ne choisit pas',
  ],
  [
    'Carla, les devis du jour',
    (c) => 'question' in c && c.question.includes('Que voulez-vous changer'),
    'sans ce qu’il faut changer, il le demande',
  ],
];
for (const [phrase, ok, intitule] of attendus) {
  const c = comprendreDemande(phrase, agents);
  verifier(`${intitule} (« ${phrase} »)`, ok(c), JSON.stringify(c));
}

// --- Ce qu'il sait pour la conversation --------------------------------------------
const production: Production = {
  fichier: '/tmp/Marie/facturation/etat/etat-facturation-du-jour-2026-09-24.md',
  nom: 'etat-facturation-du-jour-2026-09-24.md',
  dossier: 'facturation/etat',
  taches: ['etat-facturation-du-jour'],
  modifie_le: 1_790_000_000,
  octets: 120,
};
const changement: Changement = {
  id: 'CH-1', date: '2026-09-24 12:00', par: 'Alice', agent: 'Marie',
  tache_id: 'etat-facturation-du-jour', tache_nom: "Rendre l'état de la facturation du jour",
  reglage: 'planification', avant: null, apres: { type: 'quotidienne', heure: '19:00' }, annule_le: null,
};
const appels: string[] = [];
const faux = async <T,>(commande: string, args?: Record<string, unknown>): Promise<T> => {
  appels.push(`${commande}:${String(args?.prenom ?? '')}`);
  if (commande === 'equipe_productions') return (args?.prenom === 'Marie' ? [production] : []) as T;
  if (commande === 'equipe_lire_production') return 'Douze factures émises, deux en attente.' as T;
  if (commande === 'journal_lire') {
    if (args?.prenom === 'Robert') throw new Error('journal illisible');
    return [] as T;
  }
  if (commande === 'equipe_changements') return [changement] as T;
  throw new Error(commande);
};
const { lectures, changements } = await rassemblerContexte(faux, agents);
verifier("il ne s'interroge pas lui-même", !appels.some((a) => a.endsWith(':Alice')), appels.join(' '));
verifier('un agent dont rien ne se lit ne prive pas les autres', lectures.length === 3);
const contexte = contexteDuTeamHolder(agents, lectures, changements);
verifier('il cite le document lu et ce qu’il contient',
  contexte.includes('etat-facturation-du-jour-2026-09-24.md') && contexte.includes('Douze factures'));
verifier('il sait quelles tâches sont éteintes', contexte.includes('« Préparer les avoirs » : éteinte'));
verifier('il dit ce qu’il n’a pas trouvé', contexte.includes('Aucun document déposé trouvé'));
verifier('il connaît ses changements, avec l’avant', contexte.includes('CH-1') && contexte.includes('le réglage de la fiche'));
verifier(
  "l'historique se lit en mots",
  changementEnMots({ ...changement, annule_le: '2026-09-24 12:05' }).includes('Annulé le 2026-09-24 12:05')
);

console.log(`\nTeam Holder : ${echecs} faute(s)`);
if (echecs) process.exit(1);
