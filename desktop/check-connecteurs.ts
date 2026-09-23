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
  besoinsDeLaFiche,
  packDuMetier,
  CAPACITES,
  SERVI_PAR_L_APPLICATION,
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

// --- Ce que la fiche réclame trouve toujours quelqu'un ----------------------------------
// Une fiche qui déclare « email » doit se voir proposer des messageries, pas une liste vide.
const fiche = JSON.parse(
  readFileSync(join(racine, 'agents/AG-0001-secretaire-administratif.json'), 'utf8')
);
const besoins = besoinsDeLaFiche(ref, fiche.connecteurs);
veut(besoins.length === fiche.connecteurs.length, `${fiche.id} : besoin(s) perdu(s) en chemin`);
for (const b of besoins) {
  if (b.candidats.length === 0 && !b.parLApplication) {
    faute(`« ${b.capacite} » : ni connecteur ni réponse de l'application`);
  }
  for (const c of b.candidats) {
    if (!c.sert.includes(b.capacite)) faute(`${c.id} proposé pour « ${b.capacite} » sans le servir`);
  }
}
const courriels = besoins.find((b) => b.capacite === 'email');
veut((courriels?.candidats.length ?? 0) >= 3, 'moins de trois messageries proposées');
veut(
  (courriels?.candidats ?? []).some((c) => c.id === 'COM012'),
  'le SMTP/IMAP universel ne figure pas parmi les messageries'
);

// Un besoin inventé ne doit rien proposer plutôt que n'importe quoi.
veut(besoinsDeLaFiche(ref, ['telepathie']).length === 0, 'un besoin inconnu a reçu des candidats');

// Les deux besoins que l'application tient elle-même se nomment, pour qu'on cesse de chercher.
for (const capacite of CAPACITES) {
  const porteurs = ref.connecteurs.filter((c) => c.sert.includes(capacite));
  if (porteurs.length === 0 && !(capacite in SERVI_PAR_L_APPLICATION)) {
    faute(`« ${capacite} » n'est servi par personne et l'application ne le revendique pas`);
  }
}

// --- Le pack du métier propose ce qu'on rencontre dans ce métier ------------------------
// Deuxième point du jalon B : la fiche déclare son secteur, l'application propose. Ce qui
// se joue ici : le pack doit rendre des connecteurs RÉELS du catalogue, rangés par rôle, et
// ne rien promettre qui n'existe pas.
veut((ref.packs?.length ?? 0) === 43, `${ref.packs?.length ?? 0} packs sectoriels au lieu de 43`);

const comptable = packDuMetier(ref, 'comptabilite');
veut(comptable !== null, 'le secteur comptabilite n’a pas de pack');
if (comptable) {
  const coeur = comptable.rayons[0];
  veut(coeur.connecteurs.length > 0, 'le pack comptabilite ne propose aucun logiciel métier');
  // Le rayon du métier doit contenir des logiciels de comptabilité, pas des messageries.
  for (const c of coeur.connecteurs) {
    if (c.categorie !== 'metier') faute(`comptabilite : ${c.nom} est rangé en ${c.categorie}`);
  }
  const noms = coeur.connecteurs.map((c) => c.nom).join(', ');
  veut(/pennylane/i.test(noms), `le pack comptabilite ne cite pas Pennylane : ${noms}`);
}

// Tous les packs : chaque rayon rend des connecteurs du catalogue, de la bonne rubrique,
// et triés. Un pack qui nommerait un connecteur absent promettrait un outil qui n'existe pas.
const RUBRIQUE_ATTENDUE = ['metier', 'metier', 'communication', 'bureautique'];
let raysVides = 0;
for (const p of ref.packs ?? []) {
  const pack = packDuMetier(ref, p.secteur);
  if (!pack) {
    faute(`le pack ${p.id} (${p.secteur}) n'est pas retrouvé par packDuMetier`);
    continue;
  }
  const declares = p.coeur.length + p.optionnels.length + p.communication.length + p.bureautique.length;
  const rendus = pack.rayons.reduce((n, r) => n + r.connecteurs.length, 0);
  if (rendus !== declares) faute(`${p.secteur} : ${rendus} connecteurs rendus pour ${declares} déclarés`);
  if (p.coeur.length === 0) raysVides++;
  pack.rayons.forEach((r, i) => {
    const attendue = RUBRIQUE_ATTENDUE[pack.rayons.length === 4 ? i : RUBRIQUE_ATTENDUE.length - 1];
    if (pack.rayons.length === 4) {
      for (const c of r.connecteurs) {
        if (c.categorie !== attendue) faute(`${p.secteur} / ${r.titre} : ${c.nom} est en ${c.categorie}`);
      }
    }
    const noms = r.connecteurs.map((c) => c.nom);
    const tries = [...noms].sort((a, b) => a.localeCompare(b, 'fr'));
    if (noms.join('|') !== tries.join('|')) faute(`${p.secteur} / ${r.titre} : connecteurs non triés`);
  });
}
veut(raysVides === 0, `${raysVides} pack(s) sans aucun logiciel métier`);

// Un secteur sans pack rend null plutôt qu'une coquille vide : l'écran doit pouvoir
// retomber sur la proposition par besoin au lieu d'afficher des rayons vides.
veut(packDuMetier(ref, 'secteur-qui-n-existe-pas') === null, 'un secteur inconnu a reçu un pack');

// --- Les noms de champs traversent Rust puis TypeScript sans se perdre ----------------
// Une structure Rust arrive en JavaScript avec SES noms : `declare_le`, pas `declareLe`.
// Écrire le champ en camelCase côté écran ne fait échouer ni le compilateur ni l'exécution,
// ça rend juste `undefined` — un panneau vide que personne ne comprend. Ce banc relit les
// deux fichiers et compare. (Les ARGUMENTS d'une commande, eux, sont bien convertis par
// Tauri : `nomDeVariable` en JavaScript arrive en `nom_de_variable` en Rust.)
const rust = readFileSync(join(racine, 'desktop/src-tauri/src/mcp.rs'), 'utf8');
const tsx = readFileSync(join(racine, 'desktop/src/components/ConnectorSetup.tsx'), 'utf8');

const champsRust = (nom: string, source: string): string[] => {
  const bloc = source.match(new RegExp(`struct ${nom} \\{([\\s\\S]*?)\\n\\}`));
  if (!bloc) return [];
  return [...bloc[1].matchAll(/^\s*pub ([a-z_0-9]+):/gm)].map((m) => m[1]);
};
const champsTs = (nom: string, source: string): string[] => {
  const bloc = source.match(new RegExp(`interface ${nom} \\{([\\s\\S]*?)\\n\\}`));
  if (!bloc) return [];
  return [...bloc[1].matchAll(/^\s*([A-Za-z_0-9]+)[?]?:/gm)].map((m) => m[1]);
};

const cote = champsRust('ServeurVisible', rust);
const ecran = champsTs('ServeurVisible', tsx);
veut(cote.length > 0, "la structure ServeurVisible est introuvable côté Rust");
veut(ecran.length > 0, "l'interface ServeurVisible est introuvable côté écran");
for (const champ of ecran) {
  if (!cote.includes(champ)) {
    faute(`l'écran lit « ${champ} » que Rust n'envoie pas (il envoie : ${cote.join(', ')})`);
  }
}

const sansPack = packDuMetier(ref, 'audit');
console.log(
  `  ⟳ packs du métier : ${ref.packs?.length ?? 0} secteurs outillés ; ` +
    `« audit » ${sansPack === null ? "n'a pas de pack au relevé, l'écran retombe sur les besoins" : 'en a un'}`
);

const ouverts = activables(ref);
console.log(
  `  ⟳ ${ouverts.length} connecteur(s) activable(s) sur ${ref.connecteurs.length} ; ` +
    `${sansCout} attendent un coût, ${reste.get('risque')?.length ?? 0} un risque`
);
console.log(`connecteurs : ${fautes} faute(s)`);
if (fautes) process.exit(1);
