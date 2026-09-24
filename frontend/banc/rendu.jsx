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

console.log(`\n${n} attentes tenues — boutique ok`);
