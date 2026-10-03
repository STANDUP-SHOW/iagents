// Le catalogue commun : là où remontent les fiches que les clients composent.
//
// Choix de max du 03/10/2026 (« Automatique ») : chaque agent configuré chez un
// client devient une fiche, et cette fiche remonte d'elle-même, sans rien
// demander au client. « Nous aurons ainsi un jour des milliers de fiches. »
//
// Ce que ce fichier reçoit n'est PAS une fiche : c'est sa recette, cinq champs
// faits d'identifiants (fiche mère, activité, logiciels ajoutés, remplacements).
// La fiche, il la refait lui-même depuis les sources du dépôt avec
// `ficheDepuisRecette`, la fonction même dont l'écran s'est servi pour l'écrire.
// Conséquences voulues :
//  - rien de personnel ne peut arriver ici, ni prénom, ni voix, ni la phrase
//    dite par le client : le format n'a pas de case pour eux, et une clé de plus
//    fait refuser la recette entière ;
//  - un poste modifié ne peut pas glisser un texte dans le catalogue : il n'en
//    envoie aucun ;
//  - deux clients qui composent le même agent tombent sur la même fiche, rangée
//    une fois.
//
// Ce qu'il ne fait pas : il ne publie rien. Les fiches rangées attendent dans
// FICHES_DOSSIER ; les faire entrer dans `agents/`, la boutique ou les mises à
// jour reste une étape à part, que personne n'a encore écrite.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonique,
  ficheDepuisRecette,
  recetteRecevable,
  type FicheMere,
} from '../desktop/src/agents/fiche-composee.ts';
import type { Activite, Logiciel } from '../desktop/src/agents/entretien.ts';

/** Une recette fait quelques centaines d'octets ; au-delà ce n'en est pas une. */
const CORPS_MAX_OCTETS = 8 * 1024;
/** Fiches NOUVELLES par heure, tous postes confondus : borne le disque si quelqu'un insiste. */
const NOUVELLES_PAR_HEURE = 500;

export type Reglages = { dossier: string; secretDeLecture: string };

/** Aucune valeur par défaut, comme le relais : un service mal réglé ne démarre pas. */
export function reglagesDeLEnvironnement(env: Record<string, string | undefined>): Reglages {
  const dossier = (env.FICHES_DOSSIER ?? '').trim();
  const secretDeLecture = (env.CATALOGUE_SECRET ?? '').trim();
  const manquants = [!dossier && 'FICHES_DOSSIER', !secretDeLecture && 'CATALOGUE_SECRET'].filter(Boolean);
  if (manquants.length) {
    throw new Error(`Le catalogue commun ne démarre pas : ${manquants.join(', ')} manque dans l'environnement.`);
  }
  return { dossier, secretDeLecture };
}

export type Sources = {
  meres: Map<string, FicheMere>;
  activites: Activite[];
  logiciels: Logiciel[];
};

/** Les sources du dépôt, lues une fois au démarrage : celles avec lesquelles l'écran compose. */
export function lireSources(racine: string): Sources {
  const lire = (chemin: string) => JSON.parse(readFileSync(join(racine, chemin), 'utf8'));
  const meres = new Map<string, FicheMere>();
  for (const nom of readdirSync(join(racine, 'agents'))) {
    if (!nom.endsWith('.json')) continue;
    const fiche = lire(`agents/${nom}`) as FicheMere;
    meres.set(fiche.id, fiche);
  }
  return {
    meres,
    activites: lire('catalogue/activites.json').activites,
    logiciels: lire('catalogue/logiciels.json').logiciels,
  };
}

/** Ce que devient une recette reçue : la fiche refaite, ou la raison du refus. */
export function recevoir(brute: unknown, sources: Sources): { id: string; fiche: FicheMere } | string {
  const recette = recetteRecevable(brute);
  if (typeof recette === 'string') return recette;
  const mere = sources.meres.get(recette.mere);
  if (!mere) return `fiche ${recette.mere} inconnue du catalogue`;
  const fiche = ficheDepuisRecette(recette, { mere, activites: sources.activites, logiciels: sources.logiciels });
  if (typeof fiche === 'string') return fiche;
  return { id: fiche.id, fiche };
}

function memeSecret(attendu: string, recu: string): boolean {
  const a = Buffer.from(attendu, 'utf8');
  const b = Buffer.from(recu, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function repondre(reponse: ServerResponse, code: number, corps: unknown): void {
  if (reponse.writableEnded || reponse.destroyed) return;
  try {
    reponse.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    reponse.end(JSON.stringify(corps));
  } catch {
    // La ligne est partie entre-temps.
  }
}

function lireLeCorps(requete: IncomingMessage): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    const morceaux: Buffer[] = [];
    let taille = 0;
    requete.on('data', (morceau: Buffer) => {
      taille += morceau.length;
      if (taille > CORPS_MAX_OCTETS) {
        rejeter(new Error('corps trop grand'));
        requete.destroy();
        return;
      }
      morceaux.push(morceau);
    });
    requete.on('end', () => resoudre(Buffer.concat(morceaux)));
    requete.on('error', rejeter);
  });
}

export function creerCatalogue(reglages: Reglages, sources: Sources, horloge = () => Date.now()) {
  mkdirSync(reglages.dossier, { recursive: true });
  let fenetre = { debut: horloge(), nouvelles: 0 };

  return createServer(async (requete, reponse) => {
    const chemin = new URL(requete.url ?? '/', 'http://catalogue.invalide').pathname;
    try {
      if (requete.method === 'POST' && chemin === '/fiches') {
        let brute: unknown;
        try {
          brute = JSON.parse((await lireLeCorps(requete)).toString('utf8'));
        } catch {
          repondre(reponse, 400, { refus: 'recette illisible' });
          return;
        }
        const recu = recevoir(brute, sources);
        if (typeof recu === 'string') {
          repondre(reponse, 422, { refus: recu });
          return;
        }
        const fichier = join(reglages.dossier, `${recu.id}.json`);
        if (existsSync(fichier)) {
          repondre(reponse, 200, { id: recu.id, nouvelle: false });
          return;
        }
        if (horloge() - fenetre.debut > 3600_000) fenetre = { debut: horloge(), nouvelles: 0 };
        if (fenetre.nouvelles >= NOUVELLES_PAR_HEURE) {
          // Le poste garde la recette et la renverra : rien n'est perdu.
          repondre(reponse, 503, { refus: 'trop de fiches nouvelles cette heure-ci' });
          return;
        }
        fenetre.nouvelles += 1;
        writeFileSync(fichier, JSON.stringify(recu.fiche, null, 2) + '\n', { flag: 'wx' });
        repondre(reponse, 201, { id: recu.id, nouvelle: true });
        return;
      }

      // La liste des fiches reçues : pour max, pas pour le public. Rien n'en sort
      // avant le produit fini, et ce qui y est rangé n'a pas encore été relu.
      if (requete.method === 'GET' && chemin === '/fiches') {
        const porteur = requete.headers.authorization ?? '';
        const jeton = porteur.startsWith('Bearer ') ? porteur.slice('Bearer '.length) : '';
        if (!memeSecret(reglages.secretDeLecture, jeton)) {
          repondre(reponse, 401, { refus: 'secret refusé' });
          return;
        }
        const fiches = readdirSync(reglages.dossier)
          .filter((n) => n.endsWith('.json'))
          .map((n) => {
            const f = JSON.parse(readFileSync(join(reglages.dossier, n), 'utf8'));
            return { id: f.id, nom: f.nom, recette: JSON.parse(canonique(f.compose)) };
          });
        repondre(reponse, 200, { fiches });
        return;
      }

      if (requete.method === 'GET' && (chemin === '/' || chemin === '/sante')) {
        repondre(reponse, 200, { service: 'catalogue commun', meres: sources.meres.size });
        return;
      }

      repondre(reponse, 404, { refus: 'inconnu' });
    } catch {
      if (!reponse.headersSent) repondre(reponse, 400, { refus: 'demande refusée' });
    }
  });
}

const lanceDirectement =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (lanceDirectement) {
  const reglages = reglagesDeLEnvironnement(process.env);
  const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sources = lireSources(racine);
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  creerCatalogue(reglages, sources).listen(port, () => {
    console.log(`catalogue commun en ecoute sur le port ${port}, ${sources.meres.size} fiches meres`);
  });
}
