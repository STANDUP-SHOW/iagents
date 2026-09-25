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
import IAgentBox from '../src/components/IAgentBox.jsx';
import PacksEntreprise from '../src/components/PacksEntreprise.jsx';
import { AGENTS_RESEAUX, PACKS_ENTREPRISE, CYCLE_1, CYCLE_2, ficheDe, activitesPourIdee, machinePourAgents, gammesBox } from '../src/data/offres.js';

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
      const attendu = { catalogue: vue.id === 'packs' ? 'PACK-01' : 'AG-0', entreprise: 'Cycle 1', box: 'Gamme' }[page.id];
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
  const machine = machinePourAgents([...CYCLE_1.flatMap((e) => e.agents), ...CYCLE_2]);
  if (!machine?.boitiers.length) echoue('le pack de création ne trouve aucune machine');
  else ok(`le pack de création tient sur ${machine.boitiers.map((b) => 'gamme ' + b.gamme).join(' + ')}`);
  const packHtml = renderToString(<PacksEntreprise packOuvert="PACK-01" onOuvrir={() => {}} />);
  if (!packHtml.includes('iAgent Box gamme')) echoue("un pack ouvert ne propose pas de machine");
  else ok('un pack ouvert propose sa machine');
}

// 11. Aucun prix ni nom de modèle sur les machines : max n'a pas encore donné ses offres.
{
  const html = renderToString(<IAgentBox />);
  const interdits = ['€', 'Firebat', 'RTX', 'Ryzen', 'Jetson', 'GMKtec', 'Chuwi'];
  const trouves = interdits.filter((m) => html.includes(m));
  if (trouves.length) echoue(`iAgent Box affiche ${trouves.join(', ')}`);
  else if (gammesBox().some((g) => g.capacite < 1)) echoue('une gamme ne porte aucun agent de bureau');
  else ok(`iAgent Box : ${gammesBox().length} gammes, sans prix ni modèle`);
}

console.log(`\n${n} attentes tenues — boutique ok`);
