// What the home page knows about the catalogue, read from the repository at
// build time and served to the page as `virtual:accueil`. The page never holds
// a number or a job title of its own: counts, names, software and links come
// from agents/, catalogue/ and dimensionnement/, so a fiche added there shows
// up here at the next build. Only what the page needs travels to the browser,
// not the 1 249 fiches.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugifier } from '../seo/slug.mjs';
import { PRIX_AGENT_MOIS } from '../src/data/prix.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lire = (chemin) => JSON.parse(readFileSync(join(RACINE, chemin), 'utf8'));


// The people of the page, each standing for a real fiche of the catalogue.
// The first name and the portrait are the page's; the job, the sector, the
// software and the link are the fiche's.
const PERSONNES = [
  { prenom: 'Julie', titre: 'Assistante commerciale', portrait: 'julie', fiche: 'AG-0020', domaine: 'Commercial' },
  { prenom: 'Thomas', titre: 'Analyste marché', portrait: 'thomas', fiche: 'AG-0057', domaine: 'Marché' },
  { prenom: 'Samir', titre: 'Expert financement', portrait: 'samir', fiche: 'AG-0070', domaine: 'Finance' },
  { prenom: 'Léa', titre: 'Juriste', portrait: 'lea', fiche: 'AG-0427', domaine: 'Juridique' },
  { prenom: 'Marco', titre: 'Marketing produit', portrait: 'marco', fiche: 'AG-0220', domaine: 'Marketing' },
  { prenom: 'Élise', titre: 'Responsable opérations', portrait: 'elise', fiche: 'AG-0014', domaine: 'Opérations' },
  // The Team Holder lives in socle/, not in the shop: it has no page of its own.
  { prenom: 'Victor', titre: 'Task Commander', portrait: 'victor', fiche: 'AG-0000', domaine: 'Coordination' },
];

// One job, three trades: the same accountant in three activities, each with
// the activity pack's own words and software.
const METIER_DANS_TROIS_MONDES = { fiche: 'AG-0026', activites: ['ACT-0021', 'Agence immobilière — transaction', 'Machines et équipements industriels'] };

// Software families shown around the collaborator: the families are catalogue
// categories, counted; the three names shown are picked here among the
// best-known in Europe, and must exist in catalogue/logiciels.json.
const FAMILLES_LOGICIELS = [
  ['CRM', ['crm', 'prospection'], ['HubSpot CRM', 'Salesforce Sales Cloud', 'Sellsy']],
  ['ERP', ['erp', 'gpao'], ['Odoo', 'Sage 100', 'SAP S/4HANA']],
  ['Finance', ['comptabilite', 'cabinet-comptable', 'tresorerie', 'facturation', 'paie', 'fiscalite'], ['Pennylane', 'Cegid Loop', 'Agicap']],
  ['Immobilier', ['immobilier', 'promotion-immobiliere', 'diagnostic-immobilier'], ['Hektor', 'Apimo', 'Yardi Voyager']],
  ['BTP', ['btp', 'bim-maquette', 'suivi-chantier-reserves', 'metre-estimation'], ['Batappli', 'Obat', 'Autodesk Revit']],
  ['Industrie', ['gmao', 'cao-fao-usinage', 'plm-donnees-produit', 'ordonnancement-aps'], ['SolidWorks', 'TopSolid', 'Carl Source']],
  ['Création', ['design-creation', 'prepresse-impression', 'montage-video'], ['Adobe Photoshop', 'Adobe InDesign', 'Figma']],
  ['Communication', ['marketing', 'publicite', 'cms', 'veille-medias'], ['Brevo', 'Semrush', 'Hootsuite']],
  ['E-commerce', ['ecommerce', 'pim', 'wms', 'expedition'], ['Shopify', 'PrestaShop', 'WooCommerce']],
];

// « Créez votre entreprise », phase by phase, staffed with existing fiches
// (the shop's cycles 1 and 2 in src/data/offres.js, spread over five phases).
const PHASES = [
  { numero: '01', nom: 'Étudier', sujets: ['marché', 'faisabilité', 'concurrence', 'business plan'], fiches: ['AG-1238', 'AG-1249', 'AG-0669'] },
  { numero: '02', nom: 'Financer', sujets: ['banques', 'investisseurs', 'aides', 'levée de fonds'], fiches: ['AG-0070', 'AG-0109'] },
  { numero: '03', nom: 'Construire', sujets: ['juridique', 'achats', 'infrastructure', 'produit'], fiches: ['AG-0021', 'AG-0426'] },
  { numero: '04', nom: 'Lancer', sujets: ['marketing', 'commercial', 'communication'], fiches: ['AG-0201', 'AG-0179', 'AG-0253'] },
  { numero: '05', nom: 'Exploiter', sujets: ['finance', 'CRM', 'administration', 'support'], fiches: ['AG-0026', 'AG-0189', 'AG-0003'] },
];

const VITRINE = ['AG-0020', 'AG-0070', 'AG-0427', 'AG-0201', 'AG-0026', 'AG-0003'];

export function donneesAccueil() {
  const fiches = readdirSync(join(RACINE, 'agents')).filter((n) => n.endsWith('.json')).map((n) => lire(join('agents', n)));
  const socle = readdirSync(join(RACINE, 'socle')).filter((n) => n.endsWith('.json')).map((n) => lire(join('socle', n)));
  const catalogue = lire('catalogue/catalogue.json');
  const activites = lire('catalogue/activites.json').activites;
  const logiciels = lire('catalogue/logiciels.json').logiciels;
  const offre = lire('dimensionnement/offre-box.json');

  const parId = new Map([...fiches, ...socle].map((f) => [f.id, f]));
  const enBoutique = new Set(fiches.map((f) => f.id));
  const logParId = new Map(logiciels.map((l) => [l.id, l]));
  const nomSecteur = new Map(catalogue.secteurs.map((s) => [s.id, s.nom]));
  const fiche = (id) => {
    const f = parId.get(id);
    if (!f) throw new Error(`page d'accueil : la fiche ${id} n'existe plus`);
    return f;
  };
  const resume = (f, combien = 4) => ({
    id: f.id,
    metier: f.nom,
    secteur: nomSecteur.get(f.secteur) ?? f.secteur,
    accroche: f.accroche,
    logiciels: f.qualifications.logiciels.slice(0, combien).map((q) => logParId.get(q.logiciel)?.nom).filter(Boolean),
    taches: f.taches.length,
    missions: f.taches.filter((t) => t.active !== false).slice(0, 3).map((t) => t.nom),
    url: enBoutique.has(f.id) ? `/agents/${f.slug}` : null,
  });
  const activite = (cle) => {
    const a = activites.find((x) => x.id === cle || x.nom === cle);
    if (!a) throw new Error(`page d'accueil : l'activité ${cle} n'existe plus`);
    return a;
  };

  const comptable = fiche(METIER_DANS_TROIS_MONDES.fiche);
  // The software page's address as seo/generer.mjs builds it; the build's link
  // check (accueil/verifier-liens.mjs) fails if that page is not generated.
  const urlLogiciel = (l) => `/logiciels/${slugifier(l.nom)}`;

  return {
    compteurs: {
      fiches: fiches.length,
      secteurs: catalogue.secteurs.length,
      activites: activites.length,
      logiciels: logiciels.length,
      categoriesLogiciels: new Set(logiciels.map((l) => l.categorie)).size,
      taches: fiches.reduce((n, f) => n + f.taches.length, 0),
    },
    prixAgent: PRIX_AGENT_MOIS,
    financement: { mois: offre.financement.mois },
    personnes: PERSONNES.map((p) => ({ ...p, ...resume(fiche(p.fiche)) })),
    vitrine: VITRINE.map((id) => resume(fiche(id), 3)),
    metierDansTroisMondes: {
      metier: resume(comptable),
      activites: METIER_DANS_TROIS_MONDES.activites.map(activite).map((a) => ({
        nom: a.nom,
        url: `/activites/${slugifier(a.nom)}/${comptable.slug}`,
        trait: a.trait,
        vocabulaire: (a.pack?.vocabulaire ?? []).slice(0, 3).map((v) => v.terme),
        logiciels: (a.pack?.logiciels ?? []).slice(0, 3).map((id) => logParId.get(id)?.nom).filter(Boolean),
      })),
    },
    famillesLogiciels: FAMILLES_LOGICIELS.map(([nom, categories, choisis]) => ({
      nom,
      nombre: logiciels.filter((l) => categories.includes(l.categorie)).length,
      exemples: choisis.map((n) => {
        const l = logiciels.find((x) => x.nom === n);
        if (!l) throw new Error(`page d'accueil : le logiciel ${n} n'est plus au référentiel`);
        return { nom: l.nom, url: urlLogiciel(l) };
      }),
    })),
    phases: PHASES.map((p) => ({ ...p, fiches: p.fiches.map((id) => resume(fiche(id), 2)) })),
    gamme: offre.offres.filter((o) => o.role !== 'aucune').map((o) => ({ id: o.id, nom: o.nom, phrase: o.phrase })),
    activitesPopulaires: ['Imprimerie offset et numérique', 'Agence immobilière — transaction', 'Agence de communication', 'Boulangerie-pâtisserie artisanale', 'Agence web et digitale', 'Machines et équipements industriels']
      .map(activite).map((a) => ({ nom: a.nom, url: `/activites/${slugifier(a.nom)}` })),
  };
}

/** Vite plugin: `import donnees from 'virtual:accueil'`. */
export default function accueil() {
  const ID = 'virtual:accueil';
  return {
    name: 'iagent-accueil',
    resolveId: (id) => (id === ID ? '\0' + ID : null),
    load: (id) => (id === '\0' + ID ? `export default ${JSON.stringify(donneesAccueil())};` : null),
  };
}
