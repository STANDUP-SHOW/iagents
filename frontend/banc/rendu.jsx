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
import { AGENTS_RESEAUX, PACKS_ENTREPRISE, CYCLE_1, CYCLE_2, ficheDe, activitesPourIdee, INSTALLATIONS, conseilPour } from '../src/data/offres.js';
import { FINANCEMENT } from '../../dimensionnement/offre-box.ts';

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

// 11. L'offre machines se lit dans dimensionnement/offre-box.json : six
//     installations, un prix provisoire dit comme tel, la durée du financement
//     lue dans le fichier, aucune ligne interne du catalogue, et le choix passe
//     avant le catalogue.
{
  const html = renderToString(<IAgentBox />);
  const manquantes = INSTALLATIONS.filter((o) => !html.includes(o.nom.replace(/'/g, '&#x27;')));
  if (INSTALLATIONS.length !== 6 || manquantes.length) echoue(`iAgent Box : ${INSTALLATIONS.length} installations, absentes ${manquantes.map((o) => o.id).join(', ')}`);
  else ok('iAgent Box : les six installations');
  const provisoires = INSTALLATIONS.filter((o) => o.cout.aConfirmer).length;
  const dits = html.split('Prix provisoire').length - 1;
  if (dits < provisoires) echoue(`${provisoires} prix provisoires, ${dits} dits comme tels`);
  else ok(`${provisoires} prix provisoires, tous dits comme tels`);
  // The term is read from the file: a hardcoded one would outlive max's choice.
  const termes = [...html.matchAll(/sur (?:<!-- -->)?(\d+)(?:<!-- -->)? mois/g)].map((m) => Number(m[1]));
  const fausses = termes.filter((t) => t !== FINANCEMENT.mois);
  if (!termes.length || fausses.length) echoue(`durée de financement affichée ${[...new Set(termes)].join(', ')}, fichier ${FINANCEMENT.mois}`);
  else ok(`financement dit sur ${FINANCEMENT.mois} mois, comme le fichier`);
  const internes = INSTALLATIONS.flatMap((o) => o.autresLignesDuCatalogue ?? []).filter((l) => html.includes(l));
  if (internes.length) echoue(`iAgent Box affiche des lignes internes du catalogue : ${internes.slice(0, 3).join(' ; ')}`);
  else ok('aucune ligne interne du catalogue affichée');
  const sans = renderToString(<App installationInitiale={null} />);
  if (!sans.includes("D&#x27;abord, votre installation")) echoue("le catalogue ne demande pas l'installation d'abord");
  else ok("le catalogue demande l'installation d'abord");
  const avec = renderToString(<App installationInitiale="box-max" />);
  if (avec.includes("D&#x27;abord, votre installation") || !avec.includes('Votre installation')) echoue("l'installation choisie n'est pas gardée");
  else ok("l'installation choisie est gardée");
  const fiche = renderToString(<FicheDetail agent={ficheDe('AG-0001')} onClose={() => {}} ongletInitial="economie" installation="box-max" />);
  const lignes = INSTALLATIONS.filter((o) => fiche.includes(o.nom.replace(/'/g, '&#x27;'))).length;
  if (lignes !== 6 || !fiche.includes('(la vôtre)')) echoue(`fiche : ${lignes} installations au devis`);
  else ok('la fiche donne son coût sur les six installations');
}

console.log(`\n${n} attentes tenues — boutique ok`);
