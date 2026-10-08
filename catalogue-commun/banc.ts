// Banc du catalogue commun : ce que le poste envoie, ce que le service en fait.
//
// Le témoin est celui que l'écran assemble et que Rust relit
// (`desktop/temoin-fiche-composee.json`) : le service doit refaire EXACTEMENT
// cette fiche depuis sa seule recette, sinon les deux côtés ne parlent pas de la
// même fiche sous le même identifiant.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { creerCatalogue, lireSources, recevoir, reglagesDeLEnvironnement } from './serveur.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const temoin = JSON.parse(readFileSync(join(racine, 'desktop/temoin-fiche-composee.json'), 'utf8'));
const recette = temoin.compose;
const sources = lireSources(racine);

let echecs = 0;
const verifier = (nom: string, ok: boolean, detail?: unknown) => {
  if (!ok) {
    echecs += 1;
    console.error(`ÉCHEC ${nom}${detail === undefined ? '' : ` — ${String(detail)}`}`);
  }
};

// --- Sans réseau -------------------------------------------------------------
{
  const recu = recevoir(recette, sources);
  verifier('la recette du témoin refait le témoin', typeof recu !== 'string' && JSON.stringify(recu.fiche) === JSON.stringify(temoin), typeof recu === 'string' ? recu : '');
  // Les clés dans l'ordre alphabétique, comme serde_json les écrit côté poste.
  const triee = Object.fromEntries(Object.entries(recette).sort(([a], [b]) => a.localeCompare(b)));
  verifier('l’ordre des clés envoyé par Rust ne compte pas', typeof recevoir(triee, sources) !== 'string');

  const refusee = (nom: string, brute: unknown) =>
    verifier(`refusée : ${nom}`, typeof recevoir(brute, sources) === 'string');
  refusee('un prénom en plus', { ...recette, prenom: 'Léa' });
  refusee('la phrase du client en plus', { ...recette, demande: 'je veux un graphiste pour mon atelier' });
  refusee('un texte à la place d’une activité', { ...recette, activite: 'imprimerie de Léa' });
  refusee('un texte à la place d’un logiciel', { ...recette, logicielsAjoutes: ['Mon logiciel maison'] });
  refusee('un logiciel que la mère tient déjà', { ...recette, logicielsAjoutes: [...recette.logicielsAjoutes, 'LOG-1600'].sort() });
  refusee('un ordre non canonique', { ...recette, logicielsAjoutes: [...recette.logicielsAjoutes].reverse() });
  refusee('un remplacement que la mère ne tient pas', { ...recette, remplacements: { 'LOG-0565': 'LOG-0001' } });
  refusee('une fiche mère inconnue', { ...recette, mere: 'AG-9999' });
  refusee('un format inconnu', { ...recette, format: 2 });
  refusee('une recette qui n’ajoute rien', { ...recette, activite: null, logicielsAjoutes: [], remplacements: {} });
  refusee('autre chose qu’un objet', [recette]);

  let leve = '';
  try {
    reglagesDeLEnvironnement({});
  } catch (e) {
    leve = String(e);
  }
  verifier('sans dossier ni secret, le service ne démarre pas', leve.includes('FICHES_DOSSIER') && leve.includes('CATALOGUE_SECRET'));
}

// --- Par le réseau, sur la boucle locale ------------------------------------
const dossier = mkdtempSync(join(tmpdir(), 'catalogue-commun-'));
const serveur = creerCatalogue({ dossier, secretDeLecture: 'secret-de-banc' }, sources);
await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
const poster = (corps: string) =>
  fetch(`${base}/fiches`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: corps });

try {
  const premiere = await poster(JSON.stringify(recette));
  verifier('une recette nouvelle est rangée (201)', premiere.status === 201, premiere.status);
  verifier('le service rend l’identifiant du poste', (await premiere.json()).id === temoin.id);
  const seconde = await poster(JSON.stringify(recette));
  const corps = await seconde.json();
  verifier('la même recette n’est pas rangée deux fois', seconde.status === 200 && corps.nouvelle === false, seconde.status);
  verifier('un seul fichier dans le dossier', readdirSync(dossier).length === 1);
  const rangee = readFileSync(join(dossier, `${temoin.id}.json`), 'utf8');
  verifier('la fiche rangée est le témoin, octet pour octet', rangee === JSON.stringify(temoin, null, 2) + '\n');

  const avecPrenom = await poster(JSON.stringify({ ...recette, prenom: 'Léa' }));
  verifier('un prénom fait refuser la recette (422)', avecPrenom.status === 422, avecPrenom.status);
  const illisible = await poster('pas du json');
  verifier('une recette illisible est refusée (400)', illisible.status === 400, illisible.status);
  // Le service coupe la ligne au-delà de la borne : une erreur réseau vaut refus.
  const enorme = await poster(JSON.stringify({ ...recette, bourrage: 'x'.repeat(20_000) })).then(
    (r) => r.status,
    () => 0,
  );
  verifier('un corps trop grand est refusé', enorme === 0 || enorme >= 400, enorme);
  verifier('rien de plus n’est rangé', readdirSync(dossier).length === 1);

  const sansSecret = await fetch(`${base}/fiches`);
  verifier('la liste demande le secret de lecture', sansSecret.status === 401, sansSecret.status);
  const liste = await fetch(`${base}/fiches`, { headers: { authorization: 'Bearer secret-de-banc' } });
  const fiches = (await liste.json()).fiches;
  verifier('la liste rend la fiche rangée', liste.status === 200 && fiches.length === 1 && fiches[0].id === temoin.id);
} catch (e) {
  verifier("le banc réseau a tourné", false, (e as Error)?.cause ?? e);
} finally {
  serveur.close();
  rmSync(dossier, { recursive: true, force: true });
}

console.log(echecs === 0 ? 'catalogue commun ok' : `${echecs} attente(s) non tenue(s)`);
if (echecs) process.exit(1);
