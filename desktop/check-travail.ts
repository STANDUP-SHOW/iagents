import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installerAgents, type Fiche, type Installation } from './src/agents/fiche.ts';
import { travailDuJour, resumeDuTravail, FORMATS_ECRITS } from './src/agents/travail.ts';
import { planningDuClient } from './src/agents/fiche.ts';

/**
 * Le travail du jour : ce que l'écran propose doit être ce que Rust accepte.
 */

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');

let echecs = 0;
function verifier(intitule: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok  ${intitule}`);
  else { echecs++; console.log(`  ✗   ${intitule}${detail ? ` — ${detail}` : ''}`); }
}

function fiche(id: string): Fiche {
  const nom = readdirSync(join(racine, 'agents')).find((f) => f.startsWith(`${id}-`));
  if (!nom) throw new Error(`fiche ${id} absente`);
  return JSON.parse(readFileSync(join(racine, 'agents', nom), 'utf8')) as Fiche;
}

// La liste des formats vit des deux côtés de la frontière. Une liste plus longue
// ici proposerait un bouton que Rust refuserait après le clic ; plus courte,
// elle cacherait une tâche qui marche. Les deux fichiers sont donc comparés.
const rust = readFileSync(join(ici, 'src-tauri/src/tache.rs'), 'utf8');
// `\s*` autour du `=` : la déclaration passe à la ligne dès que la liste
// s'allonge, et un motif collé au `=` rendait alors une liste vide.
const declares = rust.match(/pub const FORMATS_ECRITS: \[&str; \d+\]\s*=\s*\[([^\]]+)\]/);
const cotesRust = (declares?.[1] ?? '').match(/"([a-z0-9]+)"/g)?.map((s) => s.replace(/"/g, '')) ?? [];
// Une liste vide n'est pas une divergence, c'est un banc qui ne sait plus lire
// le fichier qu'il compare : le dire, sinon deux listes vides se vaudraient.
verifier(
  'la liste des formats se lit encore dans tache.rs',
  cotesRust.length > 0,
  'aucun format lu : la déclaration de FORMATS_ECRITS a changé de forme'
);
verifier(
  'les formats écrivables sont les mêmes dans l\'écran et dans le code qui écrit',
  cotesRust.length > 0 && cotesRust.join(',') === [...FORMATS_ECRITS].join(','),
  `rust ${cotesRust.join('/')} ≠ écran ${[...FORMATS_ECRITS].join('/')}`
);

// Ce que le client règle vaut-il la même chose ici que dans `tache.rs` ?
// Jusqu'au 24/09/2026, non : cet écran forçait toutes les tâches en autonomie
// et Rust n'ouvrait même pas le planning du client. Les mêmes témoins sont
// rejoués par le test Rust `les_temoins_de_planning_valent_la_meme_chose_...`.
interface CasTemoin {
  intitule: string;
  fiche: { active: boolean; validationHumaine: boolean };
  reglage: Record<string, unknown> | null;
  attendu: { active: boolean; validationHumaine: boolean };
}
const temoins = JSON.parse(
  readFileSync(join(ici, 'temoins-planning.json'), 'utf8')
) as { cas: CasTemoin[] };

verifier(
  `${temoins.cas.length} témoins de planning, autant que côté Rust`,
  temoins.cas.length >= 7,
  `${temoins.cas.length} témoins`
);

for (const cas of temoins.cas) {
  const fausseFiche = {
    id: 'AG-0001',
    nom: 'Témoin',
    taches: [
      {
        id: 't',
        nom: 'T',
        description: 'd',
        planification: { type: 'quotidienne' as const, heure: '09:00' },
        entrees: [],
        sorties: [{ dossier: 'x', format: 'md' }],
        logiciels: [],
        active: cas.fiche.active,
        validationHumaine: cas.fiche.validationHumaine,
      },
    ],
  } as unknown as Fiche;
  const planning = cas.reglage ? { ajustements: [{ tacheId: 't', ...cas.reglage }] } : {};
  const obtenu = planningDuClient(fausseFiche, planning as never)[0];
  verifier(
    `planning — ${cas.intitule}`,
    obtenu.active === cas.attendu.active &&
      obtenu.validationHumaine === cas.attendu.validationHumaine,
    `écran donne active=${obtenu.active} validationHumaine=${obtenu.validationHumaine}, ` +
      `attendu active=${cas.attendu.active} validationHumaine=${cas.attendu.validationHumaine}`
  );
}

const AG = 'AG-0001';
const f = fiche(AG);
const formats = new Set(f.taches.flatMap((t) => t.sorties.map((s) => s.format)));
verifier(`la fiche témoin ${AG} rend des fichiers`, formats.size > 0, [...formats].join('/'));

function agentAvec(dossiers: Record<string, string>) {
  const inst: Installation = { prenom: 'Camille', ficheId: AG, voix: 'fr', dossiers };
  return installerAgents([f], [inst])[0];
}

const tousLesDossiers = Object.fromEntries(
  f.taches.flatMap((t) => t.sorties.map((s) => [s.dossier, `/tmp/iagent/${s.dossier}`]))
);

const complet = travailDuJour(agentAvec(tousLesDossiers));
verifier('chaque tâche allumée est listée une fois', complet.length === f.taches.filter((t) => t.active).length,
  `${complet.length} listées`);
verifier(
  'une tâche dont le format est écrivable et le dossier choisi peut partir',
  complet.some((t) => !t.empechement),
  complet.map((t) => t.empechement ?? 'ok').join(' | ')
);
verifier(
  "une tâche d'un format non écrit dit pourquoi, sans jargon",
  complet.filter((t) => t.empechement).every((t) => !/xlsx|docx|pdf|format\b.*non/.test(t.empechement!) || /ne sait pas encore/.test(t.empechement!)),
  complet.map((t) => t.empechement).filter(Boolean).join(' | ')
);

// Aucun dossier désigné : l'agent travaille chez lui, rien n'est à choisir.
const sansDossier = travailDuJour(agentAvec({}));
verifier(
  "sans dossier désigné, l'agent travaille chez lui et rien n'est bloqué",
  sansDossier.filter((t) => !t.empechement).length === complet.filter((t) => !t.empechement).length &&
    sansDossier.every((t) => t.ou === null || t.ou!.startsWith('Camille › ')),
  sansDossier.map((t) => t.ou ?? t.empechement).join(' | ')
);

// Une tâche éteinte n'est pas proposée : le client l'a retirée.
const eteinte: Fiche = { ...f, taches: f.taches.map((t) => ({ ...t, active: false })) };
verifier(
  "les tâches éteintes ne sont pas proposées",
  travailDuJour(installerAgents([eteinte], [{ prenom: 'Camille', ficheId: AG, voix: 'fr', dossiers: tousLesDossiers }])[0]).length === 0
);

// Une entrée est un dossier ou rien. Le reste des mots dit de quoi il s'agit,
// pas où le prendre : l'agent part alors sans matière, et doit le dire.
const avecSource = complet.filter((t) => !t.sansMatiere).length;
verifier(
  "une tâche sans dossier d'entrée est signalée avant le clic",
  complet.every((t) => t.sansMatiere === (t.tache.entrees.filter((e) => e.startsWith('dossier:')).length === 0)),
  `${avecSource} avec matière sur ${complet.length}`
);

verifier('le résumé se lit en français', /tâche|tâches/.test(resumeDuTravail(complet)), resumeDuTravail(complet));
verifier("un agent sans tâche allumée le dit", resumeDuTravail([]) === "Aucune tâche n'est allumée pour cet agent.");

// Ce que les 1249 fiches demandent, et ce que l'application sait rendre : le
// chiffre doit rester visible, c'est lui qui dit ce qu'il reste à écrire.
const parFormat = new Map<string, number>();
for (const nom of readdirSync(join(racine, 'agents'))) {
  const p = JSON.parse(readFileSync(join(racine, 'agents', nom), 'utf8')) as Fiche;
  for (const t of p.taches) for (const s of t.sorties) parFormat.set(s.format, (parFormat.get(s.format) ?? 0) + 1);
}
const total = [...parFormat.values()].reduce((a, b) => a + b, 0);
const ecrits = [...parFormat.entries()].filter(([f]) => (FORMATS_ECRITS as readonly string[]).includes(f))
  .reduce((a, [, n]) => a + n, 0);
const manquants = [...parFormat.entries()].filter(([f]) => !(FORMATS_ECRITS as readonly string[]).includes(f))
  .sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} (${n})`).join(', ');
console.log(`  ⟳ ${ecrits} sorties sur ${total} sont d'un format que l'application écrit ; il manque ${manquants}`);

// Une entrée qui n'est ni un dossier ni un connecteur ne désigne aucune source
// que l'application puisse ouvrir : l'agent travaille alors sans matière.
const CONNECTEURS = new Set(['voix', 'conversation', 'email', 'whatsapp', 'calendrier', 'fichiers', 'navigateur', 'telephone']);
let tachesTotal = 0;
let tachesAvecSource = 0;
for (const nom of readdirSync(join(racine, 'agents'))) {
  const p = JSON.parse(readFileSync(join(racine, 'agents', nom), 'utf8')) as Fiche;
  for (const t of p.taches) {
    tachesTotal++;
    const sources = t.entrees.filter((e) => e.startsWith('dossier:') || e.startsWith('navigateur:') || CONNECTEURS.has(e));
    if (sources.length) tachesAvecSource++;
  }
}
console.log(`  ⟳ ${tachesTotal - tachesAvecSource} tâches sur ${tachesTotal} ne désignent aucune source ouvrable : leurs entrées sont des mots, pas un dossier`);

console.log(`\ntravail du jour : ce que l'écran propose est ce que le code accepte`);
if (echecs) process.exit(1);
