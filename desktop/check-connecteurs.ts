/**
 * Banc des connecteurs. Ce qui se joue ici : la règle d'activation du référentiel refuse
 * vraiment, dans l'application, et pas seulement dans un document ou dans un banc de build.
 *
 * Le test qui compte est `un_catalogue_qui_ment_est_refuse_quand_meme` : un fichier truqué
 * portant `activation.activable = true` sans coût ni risque doit être refusé, parce que le
 * module rejoue la règle au lieu de croire le fichier.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  demanderActivation,
  activables,
  matrice,
  phraseRefus,
  resteAFaire,
  type ReferentielConnecteurs,
  type Connecteur,
} from './src/agents/connecteurs.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const ref: ReferentielConnecteurs = JSON.parse(
  readFileSync(join(racine, 'connecteurs/catalogue.json'), 'utf8')
);

let fautes = 0;
const faute = (msg: string) => { fautes++; console.log(`  ✗ ${msg}`); };
const veut = (condition: boolean, msg: string) => { if (!condition) faute(msg); };

// --- Le catalogue est lisible tel que le module le déclare -------------------------------
veut(ref.connecteurs.length > 100, `catalogue trop court : ${ref.connecteurs.length} connecteurs`);
veut(ref.categories.length === 3, 'trois rubriques attendues');

// --- Tout refus est motivé --------------------------------------------------------------
for (const c of ref.connecteurs) {
  const r = demanderActivation(ref, c.id);
  if (!r.accorde) {
    if (!r.motif.includes(c.nom)) faute(`${c.id} : le refus ne nomme pas le connecteur`);
    if (r.manques.length === 0) faute(`${c.id} : refusé sans dire ce qui manque`);
    if (!/il manque /.test(r.motif)) faute(`${c.id} : le motif n'est pas en clair pour le client`);
    if (phraseRefus(r) !== r.motif) faute(`${c.id} : la phrase parlée diverge du motif écrit`);
  } else {
    // Un connecteur accordé doit savoir dire comment on s'y branche, sinon l'accord est vide.
    if (!r.authentification.trim()) faute(`${c.id} : accordé sans moyen d'authentification`);
    if (r.etapesClient.length === 0) faute(`${c.id} : accordé sans aucune étape pour le client`);
  }
}

// --- Un identifiant inconnu ne passe pas ------------------------------------------------
const inconnu = demanderActivation(ref, 'ZZZ999');
veut(!inconnu.accorde, 'un identifiant inconnu a été accordé');

// --- La règle est rejouée, pas lue ------------------------------------------------------
// Un catalogue fabriqué à la main pourrait se déclarer activable. Le module doit l'ignorer.
const truque: ReferentielConnecteurs = {
  categories: ['metier'],
  familles: ['crm'],
  connecteurs: [
    {
      ...(ref.connecteurs[0] as Connecteur),
      id: 'TRU001',
      nom: 'Connecteur truqué',
      cout: null,
      risque: null,
      activation: { activable: true, manques: [] },
    },
  ],
};
const menteur = demanderActivation(truque, 'TRU001');
veut(!menteur.accorde, 'un catalogue qui se déclare activable sans coût ni risque a été accordé');
if (!menteur.accorde) {
  veut(menteur.manques.includes('cout'), 'le coût manquant n’a pas été relevé');
  veut(menteur.manques.includes('risque'), 'le risque manquant n’a pas été relevé');
}

// --- La règle n'est pas un refus systématique -------------------------------------------
// Le jour où quelqu'un chiffre OFF001 et classe son risque, le connecteur doit s'ouvrir sans
// qu'on touche au code. Ce test le prouve sur une copie remplie du premier connecteur venu.
const rempli: ReferentielConnecteurs = {
  categories: ['metier'],
  familles: ['crm'],
  connecteurs: [
    {
      ...(ref.connecteurs[0] as Connecteur),
      id: 'CPL001',
      nom: 'Connecteur complet',
      urlProduit: 'https://exemple.test/',
      urlDocumentation: 'https://exemple.test/doc',
      authentification: 'OAuth 2.0',
      accesRequis: 'Compte administrateur',
      adminRequis: 'oui',
      lecture: true,
      ecriture: true,
      cout: 0,
      risque: 'moyen',
      etapesClient: ['Connexion', 'consentement'],
      activation: { activable: false, manques: ['cout'] },
    },
  ],
};
const ouvert = demanderActivation(rempli, 'CPL001');
veut(ouvert.accorde, 'un connecteur remplissant les cinq conditions a été refusé');

// --- La matrice montre tout, sans perte -------------------------------------------------
const rubriques = matrice(ref);
const montres = rubriques.flatMap((r) => r.familles.flatMap((f) => f.connecteurs.length));
const total = montres.reduce((a, b) => a + b, 0);
veut(total === ref.connecteurs.length, `la matrice montre ${total} connecteurs sur ${ref.connecteurs.length}`);
for (const r of rubriques) {
  const familles = r.familles.map((f) => f.famille);
  const triees = [...familles].sort();
  veut(familles.join('|') === triees.join('|'), `rubrique ${r.categorie} : familles non triées`);
}

// --- Ce qui reste à faire est chiffré, pas estimé ---------------------------------------
const reste = resteAFaire(ref);
const sansCout = reste.get('cout')?.length ?? 0;
veut(sansCout > 0, 'aucun connecteur sans coût : le relevé en compte pourtant');

const ouverts = activables(ref);
console.log(
  `  ⟳ ${ouverts.length} connecteur(s) activable(s) sur ${ref.connecteurs.length} ; ` +
    `${sansCout} attendent un coût, ${reste.get('risque')?.length ?? 0} un risque`
);
console.log(`connecteurs : ${fautes} faute(s)`);
if (fautes) process.exit(1);
