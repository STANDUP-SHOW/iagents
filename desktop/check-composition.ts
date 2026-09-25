/**
 * Banc du moteur de composition : une demande dite librement devient un agent.
 *
 * Le témoin principal est la vraie demande de max du 25/09/2026, mot pour mot : un graphiste
 * pour une imprimerie numérique, sur Caldera, Photoshop et Illustrator. Ce qui est vérifié est
 * la limite entre un moteur qui lit et un moteur qui invente : aucun logiciel hors référentiel,
 * aucune mission maquillée en tâche, aucun poste choisi à la place du client quand deux se
 * valent, et aucun « branché » écrit pour un outil qui ne l'est pas.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  AUCUN_DE_CEUX_LA,
  competencesDepuisComposition,
  composer,
  lireDemande,
  logicielsNommes,
  posteDepuisFiche,
  questionSuivante,
  repondre,
  resumeComposition,
  type Poste,
  type Referentiels,
} from './src/agents/composition.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lireJson = (chemin: string) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));

let echecs = 0;
function verifier(nom: string, condition: boolean, detail = '') {
  if (!condition) {
    echecs++;
    console.error(`ÉCHEC ${nom}${detail ? ` — ${detail}` : ''}`);
  }
}

const postes: Poste[] = readdirSync(join(racine, 'agents'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => posteDepuisFiche(lireJson(`agents/${f}`)));
const refs: Referentiels = {
  postes,
  logiciels: lireJson('catalogue/logiciels.json'),
  activites: lireJson('catalogue/activites.json'),
};
const idLogiciel = (nom: string) => refs.logiciels.logiciels.find((l) => l.nom === nom)?.id;

// --- La demande de max ------------------------------------------------------
const DEMANDE_GRAPHISTE =
  "Voice, j'ai besoin d'un graphiste pour réception des fichiers clients, montage de bons à tirer, " +
  'utilisation des logiciels Caldera, Adobe Photoshop, Adobe Illustrator, création des tracés de découpe, ' +
  "true cut, kiss cut, pour les machines d'impression et de découpe. J'ai besoin que tu connaisses " +
  "l'intégralité de mes supports et des formats que je propose en impression numérique. Notre IA doit " +
  'donc générer un graphiste parfait, qui sait manier ces logiciels et qui demandera un tableau Excel ' +
  'avec les fournitures utilisées, qui aura accès via le réseau et sa propre machine au logiciel Adobe, ' +
  'qui aura accès au RIP Caldera sur le réseau, qui pourra accéder aux configurations machines, elle ' +
  "aussi branchée sur les réseaux, et qui sera donc capable d'assurer ce poste intégral de graphiste. " +
  "Ce sera mon premier essai, car je connais quelqu'un qui cherche un graphiste.";
{
  const l = lireDemande(DEMANDE_GRAPHISTE, refs);
  const noms = l.logiciels.reconnus.map((x) => x.nom);
  for (const attendu of ['Caldera', 'Adobe Photoshop', 'Adobe Illustrator', 'Microsoft 365']) {
    verifier(`graphiste : ${attendu} est reconnu`, noms.includes(attendu), `reconnus : ${noms.join(', ')}`);
  }
  verifier(
    "graphiste : « un tableau Excel » n'est pas le logiciel Tableau",
    !noms.includes('Tableau'),
    `reconnus : ${noms.join(', ')}`,
  );
  verifier(
    "graphiste : l'activité est l'impression numérique",
    l.activite?.id === 'ACT-0243',
    `activité : ${l.activite?.nom ?? 'aucune'}`,
  );

  // Graphiste de production, Designer print, Designer packaging se valent sur cette demande :
  // le moteur demande, il ne choisit pas.
  const q = questionSuivante(l);
  verifier('graphiste : le poste se demande', q?.sujet === 'poste', `question : ${q?.sujet}`);
  const proposes = q?.sujet === 'poste' ? q.options.map((o) => o.id) : [];
  for (const id of ['AG-0276', 'AG-0296']) {
    verifier(`graphiste : ${id} est proposé`, proposes.includes(id), `proposés : ${proposes.join(', ')}`);
  }
  verifier('graphiste : « aucun de ceux-là » est proposé', proposes.includes(AUCUN_DE_CEUX_LA));

  // Le client choisit le Designer print : l'activité est connue, plus rien à demander.
  const { lecture } = repondre(l, q!, 'AG-0296', refs);
  verifier('graphiste : plus de question une fois le poste choisi', questionSuivante(lecture) === null);
  const c = composer(lecture);
  verifier('graphiste : la composition existe', c !== null);
  if (c) {
    const caldera = c.branchements.find((b) => b.logiciel.id === idLogiciel('Caldera'));
    verifier('graphiste : Caldera est ajouté par la demande', caldera !== undefined && !caldera.deLaFiche);
    verifier(
      "graphiste : Caldera s'atteint par fichiers, et on le dit",
      caldera?.portee === 'fichier' && /dossier partagé/.test(caldera.aPreparer),
      caldera?.aPreparer,
    );
    const photoshop = c.branchements.find((b) => b.logiciel.id === idLogiciel('Adobe Photoshop'));
    verifier(
      'graphiste : Photoshop garde l’usage écrit par la fiche',
      photoshop?.deLaFiche === true && /profil/.test(photoshop.usage),
      photoshop?.usage,
    );
    verifier(
      'graphiste : les tracés de découpe sont dits non couverts',
      c.missionsNonCouvertes.some((m) => /tracés de découpe/.test(m)),
      `non couvertes : ${c.missionsNonCouvertes.join(' ; ')}`,
    );
    verifier(
      'graphiste : aucune mission n’est un nom de logiciel',
      !c.missionsNonCouvertes.some((m) => /photoshop|illustrator|caldera/i.test(m)),
      c.missionsNonCouvertes.join(' ; '),
    );
    verifier(
      'graphiste : le tableau Excel des fournitures sera demandé',
      c.pieces.some((p) => /tableau Excel avec les fournitures/.test(p)),
      c.pieces.join(' ; '),
    );
    verifier(
      "graphiste : les supports et formats seront demandés, « l'intégralité » comprise",
      c.pieces.some((p) => /^l'intégralité de mes supports/.test(p)),
      c.pieces.join(' ; '),
    );
    verifier(
      'graphiste : l’accès au RIP est un accès à ouvrir',
      c.acces.some((a) => /RIP Caldera/.test(a)),
      c.acces.join(' ; '),
    );
    const dit = resumeComposition(c).join(' ');
    verifier('graphiste : le résumé ne dit jamais « connecté »', !/connect[ée]/i.test(dit.replace(/Vos connexions/g, '')), dit);
    const savoirs = competencesDepuisComposition(c, DEMANDE_GRAPHISTE);
    verifier(
      'graphiste : chaque savoir écrit a un titre et un résumé',
      savoirs.length >= 4 && savoirs.every((s) => s.titre.trim() && s.resume.trim()),
    );
  }

  // « Aucun de ceux-là » : les candidats sont écartés et le moteur demande de décrire.
  const r = repondre(l, q!, AUCUN_DE_CEUX_LA, refs).lecture;
  verifier('aucun de ceux-là : le moteur demande une description', questionSuivante(r)?.sujet === 'decrire');
  const decrit = repondre(r, questionSuivante(r)!, 'il prépare les fichiers pour le RIP et les tracés de découpe', refs).lecture;
  const qd = questionSuivante(decrit);
  const reproposes = qd?.sujet === 'poste' ? qd.options.map((o) => o.id) : decrit.poste.etat === 'reconnu' ? [decrit.poste.poste.id] : [];
  verifier(
    'aucun de ceux-là : un poste écarté ne revient pas',
    !reproposes.some((id) => proposes.includes(id) && id !== AUCUN_DE_CEUX_LA),
    `reproposés : ${reproposes.join(', ')}`,
  );
}

// --- Un logiciel ne s'invente pas -------------------------------------------
{
  const n = logicielsNommes('On travaille sur MonRipMaison et sur Caldera', refs.logiciels);
  verifier(
    "un nom inconnu du référentiel n'est pas reconnu",
    n.reconnus.length === 1 && n.reconnus[0].nom === 'Caldera',
    n.reconnus.map((x) => x.nom).join(', '),
  );
  const avec = logicielsNommes('Nos rapports sont sur Tableau depuis deux ans', refs.logiciels);
  verifier('Tableau écrit comme un nom est reconnu', avec.reconnus.some((x) => x.nom === 'Tableau'));
}

// --- D'autres métiers -------------------------------------------------------
{
  const q = questionSuivante(lireDemande('Il me faut un comptable', refs));
  const libelles = q?.sujet === 'poste' ? q.options.map((o) => o.libelle) : [];
  verifier(
    '« un comptable » : les postes comptables sont proposés',
    libelles.filter((x) => /comptable/i.test(x)).length >= 3,
    libelles.join(', '),
  );
  const g = lireDemande('Quelqu’un pour prendre les rendez-vous de mon garage et répondre aux clients', refs);
  verifier('garage : l’activité est reconnue', /garage/i.test(g.activite?.nom ?? ''), g.activite?.nom);
  const top = g.poste.etat === 'a-choisir' ? g.poste.candidats[0].poste.nom : g.poste.etat === 'reconnu' ? g.poste.poste.nom : '';
  verifier('garage : le poste de prise de rendez-vous arrive en tête', /rendez-vous/i.test(top), top);
  const m = questionSuivante({ ...lireDemande('un assistant pour ma menuiserie', refs), poste: { etat: 'reconnu', poste: postes[0], raisons: [] } });
  verifier(
    'menuiserie : les trois menuiseries sont proposées',
    m?.sujet === 'activite' && m.options.filter((o) => /Menuiserie/.test(o.libelle)).length === 3,
    JSON.stringify(m),
  );
  verifier('une demande vide ne reconnaît rien', lireDemande('', refs).poste.etat === 'inconnu');
}

// --- Les deux côtés de la frontière -----------------------------------------
// Rust réduit les fiches (`fiches::poste_depuis_fiche`) ; l'écran lit `Poste`. Un champ
// renommé d'un seul côté rendrait `undefined` sans rien casser de visible.
{
  const rust = readFileSync(join(racine, 'desktop/src-tauri/src/fiches.rs'), 'utf8');
  for (const champ of ['"id"', '"nom"', '"secteur"', '"accroche"', '"resumeMetier"', '"taches"', '"logiciels"', '"description"']) {
    verifier(`Rust écrit le champ ${champ} de Poste`, rust.includes(champ));
  }
  const main = readFileSync(join(racine, 'desktop/src-tauri/src/main.rs'), 'utf8');
  verifier('lire_postes est enregistrée', main.includes('fiches::lire_postes'));
  const ecran = readFileSync(join(racine, 'desktop/src/components/Embauche.tsx'), 'utf8');
  verifier("l'écran d'embauche appelle lire_postes", ecran.includes("invoke<string>('lire_postes')"));
  verifier("l'écran d'embauche écrit la composition", ecran.includes('competencesDepuisComposition('));
  verifier('toutes les fiches se réduisent', postes.length === 1249 && postes.every((p) => p.id && p.nom), `${postes.length}`);
}

console.log(echecs === 0 ? `${postes.length} postes — moteur de composition ok` : `${echecs} attente(s) non tenue(s)`);
if (echecs) process.exit(1);
