/**
 * Le référentiel MCP, API et moteurs d'IA de max (fichier du 21/09/2026, renvoyé le
 * 10/10/2026), mis en forme pour le Desktop Commander : c'est le catalogue que le client
 * parcourt pour brancher ses outils.
 *
 * Les cinq onglets sont déjà au dépôt, cellule pour cellule (`catalogue/reference/`,
 * comparés le 10/10 : zéro ligne différente). Ce module n'ajoute que deux choses, toutes
 * deux DÉRIVÉES, jamais saisies :
 *
 *   - **la confiance**, lue dans la colonne « Statut » du relevé MCP. max y distingue
 *     quatre cas et le dit lui-même : la présence au registre MCP n'est pas une
 *     certification. Officiel vérifié, serveur de référence, communautaire à auditer,
 *     ou API pour laquelle iAgent écrira son propre connecteur.
 *   - **ce qui est branché pour de vrai**, lu dans ce que l'application met en œuvre :
 *     `connecteurs/serveurs-mcp.json` pour les serveurs MCP, et quatre moteurs que le code
 *     joint lui-même, chacun prouvé par une marque cherchée dans son fichier source. Un
 *     moteur ne s'affiche pas « branché » parce qu'on l'a écrit ici.
 *
 * `outils/importer-referentiel.ts` écrit `connecteurs/referentiel.json` ;
 * `outils/verifier-referentiel.ts` le regénère en mémoire et refuse tout écart.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Ligne = Record<string, string>;

export type Confiance = 'officiel' | 'reference' | 'a-auditer' | 'a-ecrire';
export type Famille = 'mcp' | 'api' | 'ia-cloud' | 'ia-locale' | 'creation';
export type Acces = 'mcp' | 'api' | 'local' | 'api-ou-local';

export const CONFIANCES: Record<Confiance, { titre: string; pourLeClient: string }> = {
  officiel: {
    titre: 'Officiel',
    pourLeClient: "Publié par l'éditeur lui-même, qui le maintient.",
  },
  reference: {
    titre: 'Serveur de référence',
    pourLeClient:
      "Écrit par les auteurs du protocole MCP pour montrer comment faire. Sûr à lire, pas toujours prêt pour la production.",
  },
  'a-auditer': {
    titre: 'À auditer',
    pourLeClient:
      "Écrit par un tiers ou annoncé sans être vérifié. Il reste fermé tant qu'iAgent ne l'a pas relu : être inscrit au registre MCP n'est pas une garantie de sécurité.",
  },
  'a-ecrire': {
    titre: 'Connecteur iAgent à écrire',
    pourLeClient:
      "L'éditeur publie une API officielle mais pas de serveur MCP fiable : iAgent écrira et signera son propre connecteur.",
  },
};

export const FAMILLES: { id: Famille; titre: string; fichier: string; nom: string }[] = [
  { id: 'mcp', titre: 'Serveurs MCP', fichier: 'mcp-serveurs.json', nom: 'Application / serveur' },
  { id: 'api', titre: 'API métiers', fichier: 'api-metiers.json', nom: 'Application / API' },
  { id: 'ia-cloud', titre: 'IA en ligne', fichier: 'moteurs-cloud.json', nom: 'Fournisseur / plateforme' },
  { id: 'ia-locale', titre: 'IA sur votre machine', fichier: 'moteurs-locaux.json', nom: 'Moteur / modèle' },
  { id: 'creation', titre: 'Création : image, vidéo, voix, musique, 3D', fichier: 'moteurs-media.json', nom: 'Moteur' },
];

/**
 * La colonne « Statut » du relevé MCP, ramenée aux quatre cas de max.
 *
 * L'ordre des tests compte : « Audit requis / API prioritaire » est d'abord une API
 * prioritaire (iAgent écrit le connecteur), et « Référence archivée » est d'abord
 * archivée (plus maintenue, donc à auditer). Un statut que rien ne reconnaît lève : on ne
 * range pas par défaut un serveur parmi les officiels.
 */
export function confianceDuStatut(statut: string): Confiance {
  const s = statut.toLowerCase();
  if (s.includes('api prioritaire')) return 'a-ecrire';
  if (s.includes('archivée')) return 'a-auditer';
  if (/audit|communaut|tiers|à valider|à confirmer|annoncé/.test(s)) return 'a-auditer';
  if (s.startsWith('référence mcp')) return 'reference';
  if (s.startsWith('éditeur vérifié') || s.includes('officiel')) return 'officiel';
  throw new Error(`statut MCP non reconnu : « ${statut} »`);
}

/** Comment un moteur créatif s'atteint, d'après la colonne « Exécution ». */
function accesCreation(execution: string): Acces {
  const e = execution.toLowerCase();
  const cloud = /cloud/.test(e);
  const local = /local|desktop/.test(e);
  if (cloud && local) return 'api-ou-local';
  return local ? 'local' : 'api';
}

/**
 * Ce que l'application joint elle-même, sans serveur MCP. Chaque ligne nomme le fichier
 * qui le fait et une marque qu'on y cherche : si la marque disparaît, le banc tombe, et
 * l'écran cesse de dire « branché ».
 */
export const JOINTS_PAR_L_APPLICATION: {
  famille: Famille;
  nom: string;
  fichier: string;
  marque: string;
  comment: string;
}[] = [
  {
    famille: 'ia-cloud',
    nom: 'Anthropic API',
    fichier: 'desktop/src-tauri/src/llm.rs',
    marque: 'api.anthropic.com',
    comment: "Vos agents y passent quand leur modèle n'est pas sur votre machine, avec votre clé rangée dans le coffre.",
  },
  {
    famille: 'ia-locale',
    nom: 'Ollama',
    fichier: 'desktop/src-tauri/src/modele.rs',
    marque: '/api/chat',
    comment: 'Le moteur local de vos agents : ils réfléchissent sur votre machine, sans jeton facturé.',
  },
  {
    famille: 'ia-locale',
    nom: 'whisper.cpp',
    fichier: 'desktop/src-tauri/src/voice.rs',
    marque: 'WhisperContext',
    comment: 'Vos agents vous entendent : la transcription tourne sur votre machine.',
  },
  {
    famille: 'ia-locale',
    nom: 'Piper',
    fichier: 'desktop/src-tauri/src/voice.rs',
    marque: 'piper',
    comment: 'Vos agents vous répondent à voix haute, sans rien envoyer en ligne.',
  },
];

function slug(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Les colonnes affichées telles quelles, dans l'ordre du relevé, hors nom et priorité. */
const CHAMPS_EXCLUS = new Set(['Priorité', 'Statut']);

export function construire(racine: string) {
  const lire = (chemin: string) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
  const serveurs = lire('connecteurs/serveurs-mcp.json').serveurs as any[];
  const catalogue = lire('connecteurs/catalogue.json').connecteurs as any[];
  const parReferentiel = new Map<string, any>();
  for (const s of serveurs) if (s.referentiel) parReferentiel.set(slug(s.referentiel), s);

  for (const j of JOINTS_PAR_L_APPLICATION) {
    const source = readFileSync(join(racine, j.fichier), 'utf8');
    if (!source.includes(j.marque)) {
      throw new Error(`${j.nom} se dit joint par ${j.fichier}, qui ne contient plus « ${j.marque} »`);
    }
  }

  let source = '';
  let verifie = '';
  const entrees: Record<string, unknown>[] = [];
  for (const f of FAMILLES) {
    const d = lire(`catalogue/reference/${f.fichier}`);
    source = d.source;
    verifie = d.verifie;
    (d.entrees as Ligne[]).forEach((e, i) => {
      const nom = e[f.nom];
      const champs = Object.entries(e)
        .filter(([k, v]) => k !== f.nom && !CHAMPS_EXCLUS.has(k) && v && !/^https?:\/\//.test(v))
        .map(([k, v]) => [k, v]);
      const adresse = Object.values(e).find((v) => /^https?:\/\//.test(v ?? '')) ?? null;

      let confiance: Confiance | null = null;
      let acces: Acces;
      let branche: Record<string, unknown> | null = null;

      if (f.id === 'mcp') {
        confiance = confianceDuStatut(e['Statut']);
        acces = confiance === 'a-ecrire' ? 'api' : 'mcp';
        const declare = parReferentiel.get(slug(nom));
        if (declare) {
          const connecteur = catalogue.find((c) => c.id === declare.connecteur);
          branche = {
            par: 'serveur',
            serveur: declare.nom,
            connecteur: declare.connecteur ?? null,
            // La règle d'activation, telle que le catalogue l'a calculée : un serveur
            // déclaré mais dont le connecteur reste fermé n'est à la portée de personne.
            activable: connecteur?.activation?.activable === true,
            outils: (declare.outils ?? []).length,
          };
        }
      } else if (f.id === 'api') {
        // Toute l'onglet « API métiers » est, par définition du fichier, ce qu'iAgent
        // encapsulera dans un serveur MCP écrit et signé par lui.
        confiance = 'a-ecrire';
        acces = 'api';
      } else if (f.id === 'ia-cloud') {
        acces = 'api';
      } else if (f.id === 'ia-locale') {
        acces = 'local';
      } else {
        acces = accesCreation(e['Exécution'] ?? '');
      }

      const joint = JOINTS_PAR_L_APPLICATION.find((j) => j.famille === f.id && j.nom === nom);
      if (joint) branche = { par: 'application', fichier: joint.fichier, comment: joint.comment, activable: true };

      entrees.push({
        id: `${f.id}-${String(i + 1).padStart(3, '0')}`,
        famille: f.id,
        nom,
        priorite: e['Priorité'] ?? null,
        statutReleve: e['Statut'] ?? null,
        confiance,
        acces,
        champs,
        source: adresse,
        branche,
      });
    });
  }

  for (const s of serveurs) {
    if (s.referentiel && !entrees.some((e) => e.famille === 'mcp' && slug(e.nom as string) === slug(s.referentiel))) {
      throw new Error(`serveurs-mcp.json : « ${s.referentiel} » absent du relevé MCP`);
    }
  }
  for (const j of JOINTS_PAR_L_APPLICATION) {
    if (!entrees.some((e) => e.famille === j.famille && e.nom === j.nom)) {
      throw new Error(`${j.nom} absent de la famille ${j.famille} du relevé`);
    }
  }

  return {
    note:
      "Dérivé de catalogue/reference/ (relevé de max vérifié au 21/09/2026) par outils/importer-referentiel.ts. " +
      "Ne pas modifier à la main. Les tarifs, licences et disponibilités évoluent vite : ils se resynchronisent " +
      "par la tâche planifiée décrite dans docs/referentiel-connecteurs.md, jamais de mémoire.",
    source,
    verifie,
    regle:
      "Un connecteur n'est activé qu'après identification de son éditeur, de sa méthode d'authentification, " +
      'de ses permissions, de ses coûts et de son niveau de risque. La présence dans le registre MCP ne ' +
      'constitue pas une certification.',
    confiances: CONFIANCES,
    familles: FAMILLES.map(({ id, titre }) => ({ id, titre })),
    entrees,
  };
}
