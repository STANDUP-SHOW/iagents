import { useState } from 'react';
import AgentSimulator from './AgentSimulator.jsx';
import { estimateMonthlyPrice, getRiskProfile } from '../data/loader.js';

export default function FicheDetail({ agent, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showSimulator, setShowSimulator] = useState(false);

  if (!agent) return null;

  const price = estimateMonthlyPrice(agent);
  const apiCallsPerDay = agent.execution?.appelsParJourEstimes || 0;
  const estimatedApiCost = (apiCallsPerDay * 30 * 0.00015).toFixed(2);
  const hardwareCost = Math.round(price * 0.3);
  const estimatedProfit = Math.round(price - hardwareCost - estimatedApiCost);
  const marginRatio = estimatedProfit / price;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-200 font-mono text-sm mb-1">{agent.id}</p>
              <h1 className="text-3xl font-bold text-white mb-2">{agent.nom}</h1>
              <p className="text-indigo-100 text-sm max-w-2xl">{agent.accroche}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-black/20 px-4 py-2 rounded transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700 bg-slate-900">
          <div className="flex gap-4 px-6 overflow-x-auto">
            {['overview', 'taches', 'connecteurs', 'economie'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 font-semibold border-b-2 transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'overview' && '📋 Aperçu'}
                {tab === 'taches' && '✓ Tâches'}
                {tab === 'connecteurs' && '🔌 Connecteurs'}
                {tab === 'economie' && '💰 Économie'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-indigo-300 mb-3">Persona</h2>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-slate-200 mb-3">{agent.expert?.persona}</p>
                  <div>
                    <h3 className="font-semibold text-slate-300 mb-2">Consigne:</h3>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-8">
                      {agent.expert?.consigne}
                    </p>
                  </div>
                </div>
              </div>

              {agent.expert?.connaissances && (
                <div>
                  <h2 className="text-xl font-bold text-indigo-300 mb-3">Connaissances</h2>
                  <div className="grid gap-3">
                    {agent.expert.connaissances.map((k, idx) => (
                      <div key={idx} className="bg-slate-700/50 p-3 rounded">
                        <p className="font-semibold text-slate-200">{k.titre}</p>
                        <p className="text-sm text-slate-400">{k.resume}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold text-indigo-300 mb-3">Modèles & Exécution</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Texte:</span> {agent.modeles?.texte}</p>
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Audio:</span> {agent.modeles?.audio}</p>
                    <p className="text-slate-300"><span className="font-semibold">Activité:</span> {(agent.modeles?.activite * 100).toFixed(1)}%</p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Mode par défaut:</span> {agent.execution?.defaut}</p>
                    <p className="text-slate-300 mb-1"><span className="font-semibold">Appels/jour:</span> {apiCallsPerDay}</p>
                    <p className="text-slate-300"><span className="font-semibold">Bascule:</span> {agent.execution?.bascule}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-indigo-300 mb-3">Matériel requis</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-slate-300 mb-1">💾 RAM: <span className="font-semibold">{agent.materiel?.ram} GB</span></p>
                    <p className="text-slate-300 mb-1">🎮 VRAM: <span className="font-semibold">{agent.materiel?.vram} GB</span></p>
                    <p className="text-slate-300">💿 Disque: <span className="font-semibold">{agent.materiel?.disque} GB</span></p>
                  </div>
                  <div className="bg-slate-700/50 p-4 rounded-lg">
                    <p className="text-slate-300 mb-1">🔧 CPU: <span className="font-semibold">{agent.materiel?.cpuCoeurs} cores</span></p>
                    <p className="text-slate-300 mb-1">⚡ Charge: <span className="font-semibold">{(agent.materiel?.chargeContinue * 100).toFixed(1)}%</span></p>
                    <p className="text-slate-300">{agent.materiel?.gpu?.libelle}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'taches' && (
            <div className="space-y-4">
              {agent.taches && agent.taches.map((tache, idx) => (
                <div key={idx} className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-indigo-300">{tache.nom}</p>
                      <p className="text-xs text-slate-400 font-mono">{tache.id}</p>
                    </div>
                    <span className={`badge ${tache.validationHumaine ? 'bg-yellow-600' : 'bg-green-600'}`}>
                      {tache.validationHumaine ? 'Validation requise' : 'Autonome'}
                    </span>
                  </div>
                  <p className="text-slate-300 mb-3 text-sm">{tache.description}</p>
                  <div className="grid md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-400">Planification:</p>
                      <p className="text-slate-300">{tache.planification?.type}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-400">Entrées:</p>
                      <p className="text-slate-300">{tache.entrees?.join(', ') || '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-400">Sorties:</p>
                      <p className="text-slate-300">{tache.sorties?.length} format(s)</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'connecteurs' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-indigo-300 mb-3">🔌 Connecteurs</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.connecteurs?.map((c, i) => (
                      <span key={i} className="badge bg-indigo-600">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-indigo-300 mb-3">📁 Accès Dossiers</h3>
                  <p className="text-slate-300">{agent.acces?.dossiers}</p>
                  <p className="text-slate-300 text-sm">Internet: {agent.acces?.internet ? '✓ Oui' : '✗ Non'}</p>
                </div>
              </div>
              <div className="bg-slate-700/50 p-4 rounded-lg">
                <h3 className="font-semibold text-indigo-300 mb-3">⚙️ Logiciels</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.acces?.logiciels?.map((l, i) => (
                    <span key={i} className="badge bg-slate-600">{l}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'economie' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-600/20 border border-green-600 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">💰 Prix mensuel</p>
                  <p className="text-3xl font-bold text-green-300">{price}€</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Gamme: {agent.commercial?.prixMensuel?.min}€ - {agent.commercial?.prixMensuel?.max}€
                  </p>
                </div>
                <div className="bg-blue-600/20 border border-blue-600 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">📊 Profil commercial</p>
                  <p className="text-xl font-bold text-blue-300">{agent.commercial?.profil}</p>
                  <p className="text-xs text-slate-400 mt-2">{agent.commercial?.pack}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">API Calls/jour</p>
                  <p className="text-2xl font-bold text-slate-200">{apiCallsPerDay}</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Coût API estimé</p>
                  <p className="text-2xl font-bold text-slate-200">{estimatedApiCost}€/mois</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <p className="text-sm text-slate-400 mb-1">Coût matériel</p>
                  <p className="text-2xl font-bold text-slate-200">{hardwareCost}€/mois</p>
                </div>
              </div>

              <div className="bg-purple-600/20 border border-purple-600 p-4 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Analyse économique (ratio 3×)</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-300">Profit estimé: <span className="font-bold text-purple-300">{estimatedProfit}€/mois</span></p>
                    <p className="text-slate-300">Marge: <span className="font-bold text-purple-300">{(marginRatio * 100).toFixed(1)}%</span></p>
                  </div>
                  <div>
                    <p className="text-slate-300">Risque régulementaire: <span className="font-bold text-slate-200">{getRiskProfile(agent)}</span></p>
                    <p className="text-slate-300">Autonomie: <span className="font-bold text-slate-200">{agent.commercial?.autonomie}</span></p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowSimulator(true)}
                className="btn-primary w-full"
              >
                🚀 Simuler l'exécution
              </button>
            </div>
          )}
        </div>
      </div>

      {showSimulator && (
        <AgentSimulator agent={agent} onClose={() => setShowSimulator(false)} />
      )}
    </div>
  );
}
