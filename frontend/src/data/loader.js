import { economiePour, RATIO_MINIMUM } from '../../../dimensionnement/economie.ts';

// Charge les 1249 fiches JSON depuis le répertoire agents
const agentModules = import.meta.glob('../../../agents/*.json', {
  eager: true,
  import: 'default'
});

const agents = Object.values(agentModules).sort((a, b) => {
  const numA = parseInt(a.id.split('-')[0].substring(3));
  const numB = parseInt(b.id.split('-')[0].substring(3));
  return numA - numB;
});

// Grouper les agents par secteur
export const groupBySetor = (agentList) => {
  return agentList.reduce((acc, agent) => {
    if (!acc[agent.secteur]) {
      acc[agent.secteur] = [];
    }
    acc[agent.secteur].push(agent);
    return acc;
  }, {});
};

// Grouper par famille
export const groupByFamille = (agentList) => {
  return agentList.reduce((acc, agent) => {
    if (!acc[agent.famille]) {
      acc[agent.famille] = [];
    }
    acc[agent.famille].push(agent);
    return acc;
  }, {});
};

// Filtrer les agents
export const filterAgents = (agentList, search = '', sector = '', famille = '') => {
  return agentList.filter(agent => {
    const matchSearch =
      agent.id.toLowerCase().includes(search.toLowerCase()) ||
      agent.nom.toLowerCase().includes(search.toLowerCase()) ||
      agent.accroche.toLowerCase().includes(search.toLowerCase());

    const matchSector = !sector || agent.secteur === sector;
    const matchFamille = !famille || agent.famille === famille;

    return matchSearch && matchSector && matchFamille;
  });
};

// Récupérer un agent par ID
export const getAgentById = (id) => {
  return agents.find(a => a.id === id);
};

// Récupérer les secteurs uniques triés
export const getSectors = () => {
  const sectors = [...new Set(agents.map(a => a.secteur))];
  return sectors.sort();
};

// Récupérer les familles uniques triées
export const getFamilles = () => {
  const familles = [...new Set(agents.map(a => a.famille))];
  return familles.sort();
};

// Estimer le coût mensuel moyen
export const estimateMonthlyPrice = (agent) => {
  if (agent.commercial && agent.commercial.prixMensuel) {
    return Math.round((agent.commercial.prixMensuel.min + agent.commercial.prixMensuel.max) / 2);
  }
  return 0;
};

// Vérifier si l'agent tient la règle des 3x : matériel + API résiduelle au moins
// trois fois moins cher que l'API seule sur un an.
//
// Ce test comparait la moyenne de la fourchette de prix d'abonnement à 33 % du
// haut de cette MÊME fourchette — un fait sur la forme de la fourchette, sans
// rapport avec le coût du matériel ni celui de l'API. Il était donc
// mathématiquement incapable de rendre vrai ((min+max)/2 <= 0,33×max exige
// min <= -0,34×max), et le badge vert « 3x ✓ » ne s'est jamais allumé sur
// aucune des 1 249 cartes. Le vrai calcul est dans dimensionnement/economie.ts,
// qui ne lit aucun fichier et tourne donc aussi bien dans le navigateur.
//
// Calculé une fois pour toutes ici : FicheList l'appelle par carte, et refaire
// le calcul 1 249 fois à chaque rendu n'a pas de raison d'être.
const ratioParAgent = new Map(
  agents.map((agent) => {
    try {
      return [agent.id, economiePour(agent).ratioPartage];
    } catch {
      // Une fiche que le calcul ne sait pas lire n'affiche pas de badge : mieux
      // vaut ne rien promettre que promettre à tort.
      return [agent.id, null];
    }
  })
);

export const passes3xTest = (agent) => {
  const ratio = ratioParAgent.get(agent?.id);
  return ratio !== null && ratio !== undefined && ratio >= RATIO_MINIMUM;
};

/** Le ratio lui-même, pour l'afficher plutôt que de le résumer à un badge. */
export const ratio3x = (agent) => ratioParAgent.get(agent?.id) ?? null;

/**
 * Le détail économique d'une fiche, tel que docs/economie.md le publie : ce que
 * le client paierait en API seule, ce qu'il paie chez Local-Agent, et le ratio.
 * `null` si le calcul ne sait pas lire la fiche.
 */
export const economieDe = (agent) => {
  try {
    return economiePour(agent);
  } catch {
    return null;
  }
};

/** Est-ce que cet agent attend l'accord d'un humain ? Déduit de ses tâches. */
export const attendUnAccordHumain = (agent) => (agent?.taches ?? []).some((t) => t.validationHumaine === true);

// Récupérer le profil de risque
export const getRiskProfile = (agent) => {
  return agent.commercial?.risqueReglementaire || 'Inconnu';
};

// Récupérer le profil commercial
export const getCommercialProfile = (agent) => {
  return agent.commercial?.profil || 'N/A';
};

export default agents;
