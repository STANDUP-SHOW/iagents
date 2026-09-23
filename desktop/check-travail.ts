import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { installerAgents, type Fiche, type Installation } from './src/agents/fiche.ts';
import { travailDuJour, resumeDuTravail, FORMATS_ECRITS } from './src/agents/travail.ts';

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
const declares = rust.match(/pub const FORMATS_ECRITS: \[&str; \d+\] = \[([^\]]+)\]/);
const cotesRust = (declares?.[1] ?? '').match(/"([a-z0-9]+)"/g)?.map((s) => s.replace(/"/g, '')) ?? [];
verifier(
  'les formats écrivables sont les mêmes dans l\'écran et dans le code qui écrit',
  cotesRust.length > 0 && cotesRust.join(',') === [...FORMATS_ECRITS].join(','),
  `rust ${cotesRust.join('/')} ≠ écran ${[...FORMATS_ECRITS].join('/')}`
);

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

// Le dossier non choisi : l'écran le dit avant le clic, Rust le redit après.
const sansDossier = travailDuJour(agentAvec({}));
verifier(
  "sans dossier choisi, l'écran le dit avant le clic",
  sansDossier.filter((t) => !t.empechement).length === 0 &&
    sansDossier.some((t) => /choisissez d'abord le dossier/.test(t.empechement ?? '')),
  sansDossier.map((t) => t.empechement).join(' | ')
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
  complet.every((t) => t.sansMatiere === t.tache.entrees.filter((e) => e.startsWith('dossier:')).every((e) => !tousLesDossiers[e.slice(8)])),
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
