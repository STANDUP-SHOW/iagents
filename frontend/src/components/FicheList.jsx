import { estimateMonthlyPrice, passes3xTest, ratio3x } from '../data/loader.js';

export default function FicheList({ agents, onSelectAgent, selectedAgent }) {
  const sortedAgents = [...agents].sort((a, b) => estimateMonthlyPrice(b) - estimateMonthlyPrice(a));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
      {sortedAgents.map((agent) => {
        const price = estimateMonthlyPrice(agent);
        const passes3x = passes3xTest(agent);
        const isSelected = selectedAgent?.id === agent.id;

        return (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`card cursor-pointer border-2 transition-all hover:border-indigo-500 hover:shadow-xl hover:scale-105 ${
              isSelected ? 'border-indigo-500 ring-2 ring-indigo-400' : 'border-slate-700'
            }`}
          >
            <div className="flex justify-between items-start gap-2 mb-2">
              <div>
                <p className="text-xs font-mono text-indigo-300">{agent.id}</p>
                <h3 className="font-bold text-sm text-white line-clamp-2">{agent.nom}</h3>
              </div>
              {passes3x && (
                <span
                  className="badge bg-green-600 text-white text-xs flex-shrink-0"
                  title="Matériel + API résiduelle au moins 3× moins cher que l'API seule, bundle partagé"
                >
                  {ratio3x(agent).toFixed(1)}× moins cher
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 line-clamp-2 mb-3">{agent.accroche}</p>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="badge bg-slate-700 text-slate-200">{agent.secteur}</span>
              <span className="badge bg-slate-700 text-slate-200">{agent.famille}</span>
            </div>

            <div className="pt-3 border-t border-slate-700">
              <div className="text-sm font-semibold text-indigo-300">
                {price}€/mois
              </div>
              <div className="text-xs text-slate-400">
                {agent.execution?.appelsParJourEstimes || 0} appels/jour
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
