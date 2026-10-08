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
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { PORTRAITS, portraitDe } from '../src/data/recherche.js';
import tarifs, { INSTALLATIONS_MASQUEES, BOX_DES, BOX_PUBLIQUES, euros as eurosTarif } from '../src/data/tarifs.js';
import Page from '../src/pages/Page.jsx';
import { PAGES as PAGES_OFFRE } from '../src/pages/site.js';

let n = 0;
const ok = (m) => { n++; console.log('  ok  ' + m); };
const echoue = (m) => { console.error('  ✗   ' + m); process.exitCode = 1; };

if (agents.length !== 1249) echoue(`${agents.length} fiches chargees, 1249 attendues`);
else ok(`${agents.length} fiches chargees`);

// 1. La liste se rend : c'est la page d'accueil.
try {
  const html = renderToString(<FicheList agents={agents} onSelectAgent={() => {}} selectedAgent={null} />);
  if (!html.includes('AG-0001')) echoue('la liste ne montre pas AG-0001');
  else ok('la liste des 1 249 fiches se rend');
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
if (allumes !== 136) echoue(`le badge s'allume sur ${allumes} fiches, la table en annonce 136`);
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
      const attendu = { catalogue: vue.id === 'packs' ? 'PACK-01' : 'AG-0', entreprise: 'Cycle 1', box: 'Box Commandeur' }[page.id];
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
  if (!html.includes('Activité reconnue')) echoue("la page ne montre pas l'activité reconnue");
  else ok("la page montre l'activité reconnue");
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
  // Le site n'offre jamais l'installeur : Desktop Commander est livré sur la Box
  // (max, 08/10). Un bouton « Télécharger » ramènerait le visiteur hors de l'offre.
  const telechargeurs = execSync("grep -rlE 'releases/(latest/)?download|\\.msi|T[eé]l[eé]charger' src seo || true", { encoding: 'utf8' }).trim();
  if (telechargeurs) echoue(`un bouton fait encore télécharger l'application : ${telechargeurs.split('\n').join(', ')}`);
  else ok('aucun bouton du site ne fait télécharger l’application');
}

console.log(`\n${n} attentes tenues — boutique ok`);
