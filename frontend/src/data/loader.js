// Charge les 129 fiches JSON depuis le répertoire agents
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

// Vérifier si l'agent passerait le test 3x
export const passes3xTest = (agent) => {
  if (!agent.commercial) return false;
  const avgPrice = estimateMonthlyPrice(agent);
  const maxPrice = agent.commercial.prixMensuel?.max || 0;
  return avgPrice <= maxPrice * 0.33;
};

// Récupérer le profil de risque
export const getRiskProfile = (agent) => {
  return agent.commercial?.risqueReglementaire || 'Inconnu';
};

// Récupérer le profil commercial
export const getCommercialProfile = (agent) => {
  return agent.commercial?.profil || 'N/A';
};

export default agents;
