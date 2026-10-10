/**
 * Banc de rendu de la boutique, sans rien installer de plus.
 *
 * `vite build` ne voit pas une variable qui n'existe pas : le 23/09, quatre
 * references restees en place apres une correction ont passe la construction
 * sans un mot, et la fiche detaillee aurait plante a l'ouverture chez le
 * client. Une construction verte ne prouve pas qu'une page s'affiche.
 *
 * Ici on rend vraiment les composants, en SSR, sur de vraies fiches. React et
 * react-dom sont deja la ; aucune dependance ajoutee.
 */
import { renderToString } from 'react-dom/server';
import agents, { passes3xTest, ratio3x, economieDe, getSectors, getFamilles } from '../src/data/loader.js';
import FicheList from '../src/components/FicheList.jsx';
import FicheDetail, { ONGLETS } from '../src/components/FicheDetail.jsx';
import App, { PAGES, VUES } from '../src/App.jsx';
import CreezEntreprise from '../src/components/CreezEntreprise.jsx';
import IAgentBox, { CarteInstallation } from '../src/components/IAgentBox.jsx';
import PacksEntreprise from '../src/components/PacksEntreprise.jsx';
import { AGENTS_RESEAUX, PACKS_ENTREPRISE, CYCLE_1, CYCLE_2, ficheDe, activitesPourIdee, INSTALLATIONS, conseilPour, euros } from '../src/data/offres.js';
import { FINANCEMENT, OFFRES } from '../../dimensionnement/offre-box.ts';
import { DEVIS } from '../../outils/poste-de-devis.ts';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { PORTRAITS, portraitDe, filtrer, activitesDeLaRecherche, ACTIVITES as ACTIVITES_RECHERCHE, logicielsDeLActivite, optionsActivites } from '../src/data/recherche.js';
import { IDS_DU_COEUR, coeurDeLActivite, personnelDeLActivite, SECTEURS_TRANSVERSAUX } from '../src/data/activites-recherche.js';
import tarifs, { INSTALLATIONS_MASQUEES, BOX_DES, BOX_PUBLIQUES, euros as eurosTarif } from '../src/data/tarifs.js';
import Page from '../src/pages/Page.jsx';
import { PAGES as PAGES_OFFRE } from '../src/pages/site.js';

import catalogueJson from '../../catalogue/catalogue.json';


let n = 0;
const ok = (m) => { n++; console.log('  ok  ' + m); };
const echoue = (m) => { console.error('  ✗   ' + m); process.exitCode = 1; };

// The counts come from the catalogue and the table, never written here: the
// catalogue grows (1 249 fiches until 08/10, the trades' missing jobs since).
const attendues = catalogueJson.agents.length;
if (agents.length !== attendues) echoue(`${agents.length} fiches chargees, ${attendues} attendues`);
else ok(`${agents.length} fiches chargees`);

// 1. La liste se rend : c'est la page d'accueil.
try {
  const html = renderToString(<FicheList agents={agents} onSelectAgent={() => {}} selectedAgent={null} />);
  if (!html.includes('AG-0001')) echoue('la liste ne montre pas AG-0001');
  else ok(`la liste des ${agents.length} fiches se rend`);
} catch (e) {
  echoue(`la liste ne se rend pas : ${e.message}`);
}

// 2. La fiche detaillee se rend — celle qui aurait plante. On en essaie une qui
//    tient la regle des 3x et une qui ne la tient pas : les deux branches.
const tient = agents.find((a) => passes3xTest(a));
const tientPas = agents.find((a) => !passes3xTest(a));
//    TOUS les onglets : l'onglet est un etat interne, donc un rendu par defaut
//    ne montre que « overview ». C'est exactement la ou les quatre variables
//    inexistantes se cachaient.
for (const [quoi, agent] of [['qui tient la regle', tient], ['qui ne la tient pas', tientPas]]) {
  if (!agent) { echoue(`aucune fiche ${quoi}`); continue; }
  for (const onglet of ONGLETS) {
    try {
      const html = renderToString(<FicheDetail agent={agent} onClose={() => {}} ongletInitial={onglet} />);
      if (!html.includes(agent.id)) echoue(`${agent.id}, onglet « ${onglet} » : rendu sans son identifiant`);
      else ok(`${agent.id} (${quoi}) : onglet « ${onglet} » se rend`);
    } catch (e) {
      echoue(`${agent.id} (${quoi}), onglet « ${onglet} » : ${e.message}`);
    }
  }
}

// 3. Le badge des 3x dit le meme chiffre que docs/economie.md.
const allumes = agents.filter((a) => passes3xTest(a)).length;
const annonces = Number(readFileSync('../docs/economie.md', 'utf8').match(/\*\*(\d+) fiches sur \d+ tiennent la règle/)?.[1]);
if (allumes !== annonces) echoue(`le badge s'allume sur ${allumes} fiches, la table en annonce ${annonces}`);
else ok(`le badge « 3x » s'allume sur ${allumes} fiches, comme docs/economie.md`);

// 4. Et il n'est pas mort : la version d'avant etait incapable de rendre vrai.
if (allumes === 0) echoue('le badge ne s allume sur aucune fiche — c etait le bogue');

// 5. Le ratio affiche est bien un nombre, pour toutes les fiches allumees.
const sansRatio = agents.filter((a) => passes3xTest(a) && typeof ratio3x(a) !== 'number');
if (sansRatio.length) echoue(`${sansRatio.length} fiches allument le badge sans ratio affichable`);
else ok('chaque badge allume porte un ratio affichable');

// 6. Le detail economique se lit pour toutes les fiches, ou pour aucune : un
//    « — » silencieux sur une partie du catalogue serait passe inapercu.
const sansEco = agents.filter((a) => economieDe(a) === null);
if (sansEco.length) echoue(`${sansEco.length} fiches sans calcul economique (ex. ${sansEco[0].id})`);
else ok('les 1 249 fiches ont un detail economique calculable');

if (getSectors().length < 20) echoue(`${getSectors().length} secteurs seulement`);
else ok(`${getSectors().length} secteurs, ${getFamilles().length} familles`);

// 7. Ce que la fiche DIT de la validation doit etre ce que le produit fait.
//    L'agent va seul sauf si le client met une tache sous controle (regle de
//    max) : la boutique affichait « attend l'accord d'un humain » des qu'une
//    tache de la fiche le conseillait, donc elle promettait un controle que le
//    produit n'exerce pas. Le banc lit le HTML rendu, pas la fonction, parce que
//    c'est la phrase qui compte.
{
  const aRelire = agents.find((a) => (a.taches ?? []).some((t) => t.validationHumaine === true));
  const sansRien = agents.find((a) => (a.taches ?? []).every((t) => t.validationHumaine !== true));
  for (const [quoi, agent] of [['avec des taches conseillees', aRelire], ['sans aucune', sansRien]]) {
    if (!agent) { echoue(`aucune fiche ${quoi}`); continue; }
    const html = renderToString(<FicheDetail agent={agent} onClose={() => {}} ongletInitial="economie" />);
    if (html.includes("accord d&#x27;un humain") || html.includes("accord d'un humain")) {
      echoue(`${agent.id} (${quoi}) : la fiche promet encore l'accord d'un humain`);
    } else if (!html.includes('travaille seul')) {
      echoue(`${agent.id} (${quoi}) : la fiche ne dit pas que l'agent travaille seul`);
    } else {
      ok(`${agent.id} (${quoi}) : la fiche dit « travaille seul », comme le produit`);
    }
  }
}

// 8. Les offres ne citent que des fiches qui existent. Une fiche renumérotée
//    ferait disparaître un agent du parcours sans que rien ne casse à l'écran.
{
  const cites = [...AGENTS_RESEAUX, ...CYCLE_1.flatMap((e) => e.agents), ...CYCLE_2];
  const perdus = cites.filter((id) => !ficheDe(id));
  if (perdus.length) echoue(`offres : fiches introuvables ${perdus.join(', ')}`);
  else ok(`offres : les ${cites.length} fiches citées existent`);
  if (AGENTS_RESEAUX.length < 8) echoue(`${AGENTS_RESEAUX.length} agents réseaux seulement`);
  else ok(`${AGENTS_RESEAUX.length} agents réseaux`);
  const vides = PACKS_ENTREPRISE.filter((p) => !p.secteur || p.agents.length === 0);
  if (PACKS_ENTREPRISE.length !== 43 || vides.length) echoue(`packs entreprise : ${PACKS_ENTREPRISE.length} packs, ${vides.length} sans agent (${vides.map((p) => p.id).join(', ')})`);
  else ok('43 packs entreprise, chacun avec ses agents');
}

// 9. Chaque page et chaque façon de parcourir se rend, depuis l'application entière.
for (const page of PAGES) {
  for (const vue of page.id === 'catalogue' ? VUES : [{ id: 'metier' }]) {
    try {
      const html = renderToString(<App pageInitiale={page.id} vueInitiale={vue.id} />);
      const attendu = { catalogue: { packs: 'PACK-01', activites: 'Imprimerie offset et numérique', secteurs: 'Comptabilité' }[vue.id] ?? 'AG-0', entreprise: 'Cycle 1', box: 'Box Commandeur' }[page.id];
      if (!html.includes(attendu)) echoue(`page « ${page.libelle} »${vue.libelle ? `, vue « ${vue.libelle} »` : ''} : « ${attendu} » absent`);
      else ok(`page « ${page.libelle} »${vue.libelle ? `, vue « ${vue.libelle} »` : ''} se rend`);
    } catch (e) {
      echoue(`page « ${page.libelle} » : ${e.message}`);
    }
  }
}

// 10. L'idée tapée est reconnue parmi les activités, et le pack a sa machine.
{
  const reconnues = activitesPourIdee('ouvrir une boulangerie bio');
  if (!reconnues.length) echoue('« boulangerie » ne reconnaît aucune activité');
  else ok(`« boulangerie » → ${reconnues[0].nom}`);
  const html = renderToString(<CreezEntreprise ideeInitiale="ouvrir une boulangerie bio" />);
  if (!html.includes('Votre activité') || !html.includes(reconnues[0].nom)) echoue("la page ne montre pas l'activité reconnue");
  else ok("la page montre l'activité reconnue");
  // « J'ai une imprimerie et je veux trouver plus de clients » (max, 08/10) : la
  // page propose d'abord des agents de l'imprimerie et de la prospection, pas
  // un business plan à une entreprise qui existe.
  const demande = renderToString(<CreezEntreprise ideeInitiale="J'ai une imprimerie et je veux trouver plus de clients" />);
  if (!demande.includes('Pour votre demande') || !demande.includes('Opérateur prépresse') || !/prospection|Commercial/.test(demande)) echoue("une demande d'imprimeur n'appelle ni l'imprimerie ni la prospection");
  // max, 08/10: « créer une imprimerie en ligne » offered no estimator, no
  // workshop manager, no production manager. The heart of each trade comes
  // with the request, under the names the trade uses.
  const ids = new Set(agents.map((a) => a.id));
  const perdus = IDS_DU_COEUR.filter((id) => !ids.has(id));
  if (perdus.length) echoue(`le cœur des métiers nomme des fiches absentes du catalogue : ${perdus.join(', ')}`);
  // max, 08/10 again: Google lists a print shop's whole staff, down to the
  // prépresse operator, the CTP technician and the proofreader; « je ne veux
  // pas qu'un électricien, un garagiste, un boulanger ne trouve personne ».
  for (const [idee, attendus] of [
    ['créer une imprimerie en ligne', ['Deviseur', 'Chef de fabrication', 'Opérateur prépresse', 'Technicien CTP', 'Correcteur-lecteur', "Chef d'atelier", 'Secrétaire comptable', "Direction de l'imprimerie"]],
    ['ouvrir une menuiserie', ['Deviseur', 'Secrétaire comptable']],
    ['entreprise de maçonnerie', ['Deviseur', 'Métreur', 'Conducteur de travaux', 'Économiste']],
    ['ouvrir un restaurant', ['Devis groupes', 'Chef de cuisine', 'Hygiène HACCP']],
    ['reprendre un garage', ['Deviseur', "Chef d'atelier", 'Réceptionnaire après-vente', 'Magasinier']],
    ['je suis plombier', ['Deviseur', 'Planning des chantiers', "Bureau d'études fluides"]],
    ['je suis électricien', ['Deviseur', "Bureau d'études électricité", 'Conducteur de travaux', 'Secrétaire comptable']],
    ['je suis boulanger', ['Chef de fournil', 'Responsable de boutique', 'Qualité, hygiène et allergènes', 'Secrétaire comptable']],
    // Asked in everyday words, these found no activity at all.
    ['créer une entreprise de transport', ['Deviseur — cotation transport', 'Planification des tournées']],
    ['ouvrir une ferme bio', ['offres et devis aux restaurateurs', 'Chef de culture']],
    ['créer une agence de voyage', ['Devis et cotation des voyages', 'Conception des circuits']],
  ]) {
    const rendu = renderToString(<CreezEntreprise ideeInitiale={idee} />).replace(/&#x27;/g, "'");
    const manque = ['Le cœur de votre métier', ...attendus].filter((m) => !rendu.includes(m));
    if (manque.length) echoue(`« ${idee} » ne propose pas : ${manque.join(', ')}`);
  }
  // A print shop prints on paper: no web designer in its staff nor in its search.
  const imprimeur = renderToString(<CreezEntreprise ideeInitiale="J'ai une imprimerie" />);
  if (/Graphiste web|Web designer/i.test(imprimeur)) echoue("une imprimerie se voit proposer un graphiste web");
  const bibliotheque = filtrer(agents, { requete: 'imprimerie' }).slice(0, 30).map((a) => a.nom);
  if (bibliotheque.some((n) => /web/i.test(n))) echoue(`la recherche « imprimerie » montre un métier du web : ${bibliotheque.filter((n) => /web/i.test(n)).join(', ')}`);
  else ok("ni la page de création ni la recherche « imprimerie » ne montrent de graphiste web");
  // Every trade that sells a job to a customer has its estimator.
  const sansDevis = ACTIVITES_RECHERCHE
    .filter((a) => !['sante-social', 'finance-immobilier', 'public-associatif'].includes(a.famille))
    .filter((a) => !personnelDeLActivite(a, agents)?.sansDevis)
    .filter((a) => !coeurDeLActivite(a, agents).some((c) => DEVIS.test(c.role)));
  // Every trade shows its own software, not only office tools; and the print
  // shop, which its owner checks first, shows the ones printers actually run.
  const BUREAU = new Set(['bureautique']);
  const sansLogiciels = ACTIVITES_RECHERCHE.filter((a) => logicielsDeLActivite(a).filter((l) => !BUREAU.has(l.categorie)).length < 2);
  if (sansLogiciels.length) echoue(`activités sans leurs logiciels métier : ${sansLogiciels.map((a) => a.nom).join(', ')}`);
  const imprimerie = renderToString(<CreezEntreprise ideeInitiale="créer une imprimerie en ligne" />);
  const manquants = ['Les logiciels de votre métier', 'Cadratin', 'Masterprint', 'VitaSoft', 'Reprolys', 'Caldera', 'PrintFlux'].filter((m) => !imprimerie.includes(m));
  if (manquants.length) echoue(`« créer une imprimerie en ligne » n'affiche pas : ${manquants.join(', ')}`);
  else ok("chaque activité affiche au moins deux logiciels de son métier, et l'imprimerie ceux des imprimeurs");
  const sansCoeur = ACTIVITES_RECHERCHE.filter((a) => !coeurDeLActivite(a, agents).length);
  if (sansCoeur.length) echoue(`activités sans cœur de métier : ${sansCoeur.map((a) => a.nom).join(', ')}`);
  if (sansDevis.length) echoue(`activités sans deviseur : ${sansDevis.map((a) => a.nom).join(', ')}`);
  else ok('chaque activité qui vend un travail a son deviseur, et chaque demande de client voit le cœur de son métier');

  const avis = conseilPour([...CYCLE_1.flatMap((e) => e.agents), ...CYCLE_2]);
  if (!avis) echoue('le pack de création ne reçoit aucun conseil de machine');
  else ok(`le pack de création : ${avis.conseil.nom} conseillée`);
  if (!html.includes('Installation conseillée')) echoue("la page de création ne conseille pas d'installation");
  else ok("la page de création conseille une installation");
  const packHtml = renderToString(<PacksEntreprise packOuvert="PACK-01" onOuvrir={() => {}} />);
  if (!packHtml.includes('Installation conseillée')) echoue("un pack ouvert ne conseille pas d'installation");
  else ok('un pack ouvert conseille son installation');
}

// 11. L'offre machines (plan du site de max, 07/10) : le public ne voit que
//     « Sans machine » et la Box, louée ; les offres serveur et multibox restent
//     dans dimensionnement/offre-box.json sans être publiées ; aucun prix n'est
//     écrit dans un composant, tous viennent de src/data/tarifs.json.
{
  const html = renderToString(<IAgentBox />);
  const manquantes = INSTALLATIONS.filter((o) => !html.includes(o.nom.replace(/'/g, '&#x27;')));
  if (manquantes.length) echoue(`iAgent Box : absentes ${manquantes.map((o) => o.id).join(', ')}`);
  else ok(`iAgent Box : les ${INSTALLATIONS.length} installations publiques`);
  const archivees = OFFRES.filter((o) => INSTALLATIONS_MASQUEES.has(o.id));
  if (archivees.length !== INSTALLATIONS_MASQUEES.size) echoue('une installation masquée n’existe plus dans offre-box.json : ne rien supprimer');
  const vues = archivees.filter((o) => html.includes(o.nom) || INSTALLATIONS.some((i) => i.id === o.id));
  if (vues.length) echoue(`offres archivées encore publiées : ${vues.map((o) => o.nom).join(', ')}`);
  else ok(`${archivees.length} offres serveur et multibox gardées, non publiées`);
  const internes = INSTALLATIONS.flatMap((o) => o.autresLignesDuCatalogue ?? []).filter((l) => html.includes(l));
  if (internes.length) echoue(`iAgent Box affiche des lignes internes du catalogue : ${internes.slice(0, 3).join(' ; ')}`);
  else ok('aucune ligne interne du catalogue affichée');
  const box = INSTALLATIONS.find((o) => o.id === 'box-commandeur');
  const carte = renderToString(<CarteInstallation o={box} />);
  if (!carte.includes(eurosTarif(BOX_DES.mensuel).replace(/\u00a0/g, '&nbsp;')) && !carte.includes(eurosTarif(BOX_DES.mensuel))) echoue('la Box ne montre pas son loyer de tarifs.json');
  else if (carte.includes(euros(box.cout.lignes[0].prixAchat))) echoue('la Box, louée, affiche encore un prix d’achat');
  else ok('la Box se loue, au prix de tarifs.json');
  const sans = renderToString(<App installationInitiale={null} />);
  if (!sans.includes("D&#x27;abord, votre installation")) echoue("le catalogue ne demande pas l'installation d'abord");
  else ok("le catalogue demande l'installation d'abord");
  const avec = renderToString(<App installationInitiale="box-commandeur" />);
  if (avec.includes("D&#x27;abord, votre installation") || !avec.includes('Votre installation')) echoue("l'installation choisie n'est pas gardée");
  else ok("l'installation choisie est gardée");
  const fiche = renderToString(<FicheDetail agent={ficheDe('AG-0001')} onClose={() => {}} ongletInitial="economie" installation="box-commandeur" />);
  const lignes = INSTALLATIONS.filter((o) => fiche.includes(o.nom.replace(/'/g, '&#x27;'))).length;
  if (lignes !== INSTALLATIONS.length || !fiche.includes('(la vôtre)') || archivees.some((o) => fiche.includes(o.nom))) echoue(`fiche : ${lignes} installations au devis`);
  else ok('la fiche donne son coût sur les installations publiques, et seulement elles');
}

// 12. Les pages de l'offre (plan du site de max, 07/10) se rendent toutes, avec
//     un titre, et aucun montant n'y est écrit en dur : tout vient de tarifs.json.
{
  for (const { nom } of PAGES_OFFRE) {
    const html = renderToString(<Page nom={nom} />);
    if (!html.includes('<h1')) echoue(`page ${nom} : pas de titre principal`);
  }
  ok(`les ${PAGES_OFFRE.length} pages de l'offre se rendent`);
  const sources = ['src/pages/Pages.jsx', 'src/pages/PagesBusiness.jsx', 'src/pages/blocs.jsx', 'src/accueil/Accueil.jsx'];
  const enDur = sources.flatMap((f) => [...readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').matchAll(/\d[\d\s,.]*\s?€/g)].map((m) => `${f} : ${m[0]}`));
  if (enDur.length) echoue(`montants écrits en dur : ${enDur.join(' ; ')}`);
  else ok('aucun montant écrit en dur dans les pages');
  const tarifsHtml = renderToString(<Page nom="pricing" />);
  const absents = [...BOX_PUBLIQUES.map((b) => b.mensuel), ...tarifs.agents.paliers.map((p) => p.mensuel)].filter((x) => tarifs.agents.affichage === 'paliers' || x < 100).filter((x) => !tarifsHtml.includes(String(x)));
  if (absents.length) echoue(`la page Tarifs ne montre pas ${absents.join(', ')}`);
  else ok('la page Tarifs montre la grille de tarifs.json');
  // Le téléphone n'est pas construit : aucune offre Voice ne se vend comme disponible.
  const voixHtml = renderToString(<Page nom="voice" />);
  const vendues = tarifs.voice.offres.filter((o) => !['bientot', 'sur-devis'].includes(o.statut));
  const manquants = tarifs.voice.offres.filter((o) => o.mensuel ?? o.aPartirDe).filter((o) => !voixHtml.includes(String(o.mensuel ?? o.aPartirDe)));
  if (vendues.length || manquants.length || !voixHtml.includes('Bientôt')) echoue(`page Voice : ${vendues.map((o) => o.id).join(', ')} vendues, ${manquants.map((o) => o.id).join(', ')} absentes`);
  else ok('la page Voice montre ses prix, tous marqués « bientôt »');
  // Starter = Box 36 mois + 1 Essential (max, 07/10) : le prix est la somme, jamais recopié.
  const starter = tarifs.packs.find((p) => p.id === 'starter');
  const attendu = tarifs.box.find((b) => b.id === 'box-commander-36').mensuel + tarifs.agents.paliers.find((p) => p.id === 'essential').mensuel;
  if (starter.mensuel !== attendu || !tarifsHtml.includes(String(attendu))) echoue(`Starter à ${starter.mensuel} au lieu de ${attendu}`);
  else ok(`le Starter vaut la Box et un Essential : ${attendu} €`);
  // Les portraits découpés des planches de max : chaque visage annoncé existe, et
  // le catalogue en montre assez pour que deux fiches voisines ne se ressemblent pas.
  const public_ = 'public'; // the bench runs from frontend/
  const perdus = PORTRAITS.filter((f) => !existsSync(public_ + f));
  const vus = new Set(agents.map(portraitDe));
  if (perdus.length || vus.size < PORTRAITS.length * 0.9) echoue(`portraits : ${perdus.length} absents, ${vus.size} visages employés sur ${PORTRAITS.length}`);
  else ok(`${vus.size} portraits différents dans la bibliothèque, tous présents`);
  // Un imprimeur tape « imprimerie » (max, 08/10) : aucune fiche ne porte ce mot,
  // l'activité ACT-0021 si. Chaque nom et chaque alias des activités doit rendre
  // des métiers, jamais une liste vide.
  {
    const imprimerie = activitesDeLaRecherche('imprimerie');
    const trouves = filtrer(agents, { requete: 'imprimerie' });
    if (imprimerie[0]?.id !== 'ACT-0021' || !trouves.length) echoue(`« imprimerie » : activité ${imprimerie[0]?.id ?? 'aucune'}, ${trouves.length} métiers`);
    else ok(`« imprimerie » reconnaît ${imprimerie[0].nom} et propose ${trouves.length} métiers, d'abord ${trouves[0].nom}`);
    const muets = ACTIVITES_RECHERCHE.flatMap((a) => [a.nom, ...(a.alias ?? [])].map((mot) => [a, mot]))
      .filter(([a, mot]) => !activitesDeLaRecherche(mot).includes(a) || !filtrer(agents, { requete: mot }).length);
    if (muets.length) echoue(`${muets.length} mots d'activité sans réponse, dont ${muets.slice(0, 5).map(([a, m]) => `« ${m} » (${a.id})`).join(', ')}`);
    else ok(`les ${ACTIVITES_RECHERCHE.length} activités se trouvent par leur nom et chacun de leurs alias`);
  }  // Le filtre « Activité » (max, 10/10) : les 422 activités sans secteur
  // choisi, seulement celles du secteur quand il l'est, et le personnel de
  // l'imprimerie d'abord quand on la choisit.
  {
    const toutes = optionsActivites(agents);
    const fiche = (id) => agents.find((a) => a.id === id);
    const coeur = coeurDeLActivite(ACTIVITES_RECHERCHE.find((a) => a.id === 'ACT-0021'), agents).map((c) => c.fiche.id);
    const secteurImprimeur = coeur.map((id) => fiche(id)?.secteur).find((s) => s && !SECTEURS_TRANSVERSAUX.has(s));
    const duSecteur = optionsActivites(agents, [secteurImprimeur]);
    const choisis = filtrer(agents, { activites: ['ACT-0021'] });
    if (toutes.length !== ACTIVITES_RECHERCHE.length) echoue(`filtre Activité : ${toutes.length} activités proposées sur ${ACTIVITES_RECHERCHE.length}`);
    else if (!duSecteur.some(([id]) => id === 'ACT-0021') || duSecteur.length >= toutes.length) echoue(`filtre Activité : le secteur ${secteurImprimeur} propose ${duSecteur.length} activités`);
    else if (!coeur.includes(choisis[0]?.id)) echoue(`filtre Activité : l'imprimerie commence par ${choisis[0]?.nom}`);
    else ok(`filtre Activité : ${toutes.length} activités, ${duSecteur.length} dans le secteur ${secteurImprimeur}, l'imprimerie montre ${choisis.length} métiers, d'abord ${choisis[0].nom}`);
  }
  // The sector filter and the counter are the same number (max, 10/10: the
  // catalogue said 63 sectors and the filter « Voir les 64 »).
  {
    const dansLeFiltre = new Set(agents.map((a) => a.secteur));
    const declares = new Set(catalogueJson.secteurs.map((s) => s.id));
    const enTrop = [...dansLeFiltre].filter((s) => !declares.has(s));
    const sansFiche = [...declares].filter((s) => !dansLeFiltre.has(s));
    if (enTrop.length || sansFiche.length) echoue(`secteurs : le filtre en montre ${dansLeFiltre.size}, le catalogue en déclare ${declares.size} (hors catalogue : ${enTrop.join(', ') || 'aucun'} ; sans fiche : ${sansFiche.join(', ') || 'aucun'})`);
    else ok(`secteurs : ${declares.size} au catalogue, ${dansLeFiltre.size} dans le filtre, les mêmes`);
  }

  // Le site n'offre jamais l'installeur : Desktop Commander est livré sur la Box
  // (max, 08/10). Un bouton « Télécharger » ramènerait le visiteur hors de l'offre.
  const telechargeurs = execSync("grep -rlE 'releases/(latest/)?download|\\.msi|T[eé]l[eé]charger' src seo || true", { encoding: 'utf8' }).trim();
  if (telechargeurs) echoue(`un bouton fait encore télécharger l'application : ${telechargeurs.split('\n').join(', ')}`);
  else ok('aucun bouton du site ne fait télécharger l’application');
}

console.log(process.exitCode ? `\n${n} attentes tenues, au moins une faute ci-dessus — boutique REFUSÉE` : `\n${n} attentes tenues — boutique ok`);
