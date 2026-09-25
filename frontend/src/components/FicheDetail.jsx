import { useState } from 'react';
import AgentSimulator from './AgentSimulator.jsx';
import { devisAgent, euros } from '../data/offres.js';
import { FINANCEMENT } from '../../../dimensionnement/offre-box.ts';
import { estimateMonthlyPrice, getRiskProfile, economieDe, tachesAReliretConseillees } from '../data/loader.js';

/** Les onglets, nommes une seule fois : le banc les parcourt tous. */
export const ONGLETS = ['overview', 'taches', 'connecteurs', 'economie'];

// `ongletInitial` n'existe que pour le banc : l'onglet est un etat interne, donc
// un rendu sans lui ne montre que « overview » et ne prouve rien des trois
// autres. C'est comme ca que quatre variables inexistantes dans l'onglet
// « economie » ont passe une construction verte le 23/09.
export default function FicheDetail({ agent, onClose, ongletInitial = 'overview', installation = null }) {
  const [activeTab, setActiveTab] = useState(ongletInitial);
  const [showSimulator, setShowSimulator] = useState(false);

  if (!agent) return null;

  const price = estimateMonthlyPrice(agent);
  // Ce bloc calculait un « profit » et une « marge » depuis un coût de matériel
  // posé à 30 % du PRIX D'ABONNEMENT, et un coût d'API à 0,00015 € l'appel qui
  // ne vient d'aucune source. Le matériel ne dépend pas de ce qu'on facture :
  // la marge sortait donc à ~70 % pour les 1 249 fiches, quelles qu'elles
  // soient. Le vrai calcul est dans dimensionnement/economie.ts, et ses
  // hypothèses sont dans tarifs-api.json.
  const eco = economieDe(agent);
  // What this agent costs on each installation, read from dimensionnement/offre-box.ts.
  const devis = devisAgent(agent);
  const conseillees = tachesAReliretConseillees(agent);
  const apiCallsPerDay = agent.execution?.appelsParJourEstimes ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-y-auto">
      <div className="bg-nuit-800 rounded-lg shadow-2xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-braise-500 to-rose-500 p-6 sticky top-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/80 font-mono text-sm mb-1">{agent.id}</p>
              <h1 className="text-3xl font-bold text-white mb-2">{agent.nom}</h1>
              <p className="text-white/90 text-sm max-w-2xl">{agent.accroche}</p>
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
        <div className="border-b border-nuit-700 bg-nuit-900">
          <div className="flex gap-4 px-6 overflow-x-auto">
            {ONGLETS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 font-semibold border-b-2 transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-neon-500 text-neon-300'
                    : 'border-transparent text-nuit-400 hover:text-nuit-200'
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
                <h2 className="text-xl font-bold text-neon-300 mb-3">Persona</h2>
                <div className="bg-nuit-700/50 p-4 rounded-lg">
                  <p className="text-nuit-200 mb-3">{agent.expert?.persona}</p>
                  <div>
                    <h3 className="font-semibold text-nuit-300 mb-2">Consigne:</h3>
                    <p className="text-sm text-nuit-300 whitespace-pre-wrap line-clamp-8">
                      {agent.expert?.consigne}
                    </p>
                  </div>
                </div>
              </div>

              {agent.expert?.connaissances && (
                <div>
                  <h2 className="text-xl font-bold text-neon-300 mb-3">Connaissances</h2>
                  <div className="grid gap-3">
                    {agent.expert.connaissances.map((k, idx) => (
                      <div key={idx} className="bg-nuit-700/50 p-3 rounded">
                        <p className="font-semibold text-nuit-200">{k.titre}</p>
                        <p className="text-sm text-nuit-400">{k.resume}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold text-neon-300 mb-3">Modèles & Exécution</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-nuit-700/50 p-4 rounded-lg">
                    <p className="text-nuit-300 mb-1"><span className="font-semibold">Texte:</span> {agent.modeles?.texte}</p>
                    <p className="text-nuit-300 mb-1"><span className="font-semibold">Audio:</span> {agent.modeles?.audio}</p>
                    <p className="text-nuit-300"><span className="font-semibold">Activité:</span> {(agent.modeles?.activite * 100).toFixed(1)}%</p>
                  </div>
                  <div className="bg-nuit-700/50 p-4 rounded-lg">
                    <p className="text-nuit-300 mb-1"><span className="font-semibold">Mode par défaut:</span> {agent.execution?.defaut}</p>
                    <p className="text-nuit-300 mb-1"><span className="font-semibold">Appels/jour:</span> {apiCallsPerDay}</p>
                    <p className="text-nuit-300"><span className="font-semibold">Bascule:</span> {agent.execution?.bascule}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-neon-300 mb-3">Matériel requis</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-nuit-700/50 p-4 rounded-lg">
                    <p className="text-nuit-300 mb-1">💾 RAM: <span className="font-semibold">{agent.materiel?.ram} GB</span></p>
                    <p className="text-nuit-300 mb-1">🎮 VRAM: <span className="font-semibold">{agent.materiel?.vram} GB</span></p>
                    <p className="text-nuit-300">💿 Disque: <span className="font-semibold">{agent.materiel?.disque} GB</span></p>
                  </div>
                  <div className="bg-nuit-700/50 p-4 rounded-lg">
                    <p className="text-nuit-300 mb-1">🔧 CPU: <span className="font-semibold">{agent.materiel?.cpuCoeurs} cores</span></p>
                    <p className="text-nuit-300 mb-1">⚡ Charge: <span className="font-semibold">{(agent.materiel?.chargeContinue * 100).toFixed(1)}%</span></p>
                    <p className="text-nuit-300">{agent.materiel?.gpu?.libelle}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'taches' && (
            <div className="space-y-4">
              {agent.taches && agent.taches.map((tache, idx) => (
                <div key={idx} className="bg-nuit-700/50 p-4 rounded-lg border border-nuit-600">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-neon-300">{tache.nom}</p>
                      <p className="text-xs text-nuit-400 font-mono">{tache.id}</p>
                    </div>
                    <span className={`badge ${tache.validationHumaine ? 'bg-yellow-600' : 'bg-green-600'}`}>
                      {tache.validationHumaine ? 'Validation requise' : 'Autonome'}
                    </span>
                  </div>
                  <p className="text-nuit-300 mb-3 text-sm">{tache.description}</p>
                  <div className="grid md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-nuit-400">Planification:</p>
                      <p className="text-nuit-300">{tache.planification?.type}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-nuit-400">Entrées:</p>
                      <p className="text-nuit-300">{tache.entrees?.join(', ') || '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-nuit-400">Sorties:</p>
                      <p className="text-nuit-300">{tache.sorties?.length} format(s)</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'connecteurs' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-nuit-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-neon-300 mb-3">🔌 Connecteurs</h3>
                  <div className="flex flex-wrap gap-2">
                    {agent.connecteurs?.map((c, i) => (
                      <span key={i} className="badge bg-neon-400/10 text-neon-300 border border-neon-400/40">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-nuit-700/50 p-4 rounded-lg">
                  <h3 className="font-semibold text-neon-300 mb-3">📁 Accès Dossiers</h3>
                  <p className="text-nuit-300">{agent.acces?.dossiers}</p>
                  <p className="text-nuit-300 text-sm">Internet: {agent.acces?.internet ? '✓ Oui' : '✗ Non'}</p>
                </div>
              </div>
              <div className="bg-nuit-700/50 p-4 rounded-lg">
                <h3 className="font-semibold text-neon-300 mb-3">⚙️ Logiciels</h3>
                <div className="flex flex-wrap gap-2">
                  {agent.acces?.logiciels?.map((l, i) => (
                    <span key={i} className="badge bg-nuit-600">{l}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'economie' && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-600/20 border border-green-600 p-4 rounded-lg">
                  <p className="text-sm text-nuit-400 mb-1">💰 Prix mensuel</p>
                  <p className="text-3xl font-bold text-green-300">{price}€</p>
                  <p className="text-xs text-nuit-400 mt-2">
                    Gamme: {agent.commercial?.prixMensuel?.min}€ - {agent.commercial?.prixMensuel?.max}€
                  </p>
                </div>
                <div className="bg-neon-600/20 border border-neon-600 p-4 rounded-lg">
                  <p className="text-sm text-nuit-400 mb-1">📊 Profil commercial</p>
                  <p className="text-xl font-bold text-neon-300">{agent.commercial?.profil}</p>
                  <p className="text-xs text-nuit-400 mt-2">{agent.commercial?.pack}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-nuit-700/50 p-4 rounded-lg">
                  <p className="text-sm text-nuit-400 mb-1">API Calls/jour</p>
                  <p className="text-2xl font-bold text-nuit-200">{apiCallsPerDay}</p>
                </div>
                <div className="bg-nuit-700/50 p-4 rounded-lg">
                  <p className="text-sm text-nuit-400 mb-1">API résiduelle</p>
                  <p className="text-2xl font-bold text-nuit-200">{eco ? Math.round(eco.apiResiduelle) : '—'}€/mois</p>
                </div>
                <div className="bg-nuit-700/50 p-4 rounded-lg">
                  <p className="text-sm text-nuit-400 mb-1">Coût matériel</p>
                  <p className="text-2xl font-bold text-nuit-200">{eco ? Math.round(eco.materielPartage + eco.poste) : '—'}€/mois</p>
                </div>
              </div>

              <div className="bg-nuit-800 border border-nuit-600 p-4 rounded-lg">
                <p className="text-sm text-nuit-200 font-semibold mb-2">Ce que cet agent vous coûte selon votre installation</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-nuit-400">
                      <tr><th className="py-1 pr-3">Installation</th><th className="pr-3">Où il travaille</th><th className="pr-3">Coût de l'agent</th><th className="pr-3">Par API seule</th><th>Économie</th></tr>
                    </thead>
                    <tbody>
                      {devis.map((l) => (
                        <tr key={l.offre} className={`border-t border-nuit-700 ${l.offre === installation ? 'bg-neon-400/10' : ''}`}>
                          <td className="py-2 pr-3 text-white">{l.nom}{l.offre === installation && <span className="text-xs text-neon-300"> (la vôtre)</span>}</td>
                          <td className="pr-3 text-nuit-300" title={l.motif}>{l.enLocal ? 'chez vous' : 'par API'}</td>
                          <td className="pr-3 text-nuit-200">{euros(l.coutAgent)}/mois</td>
                          <td className="pr-3 text-nuit-400">{euros(l.apiSeule)}/mois</td>
                          <td className={l.economie > 0 ? 'text-green-300' : 'text-nuit-400'}>{l.economie > 0 ? `${euros(l.economie)}/mois` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const l = devis.find((d) => d.offre === installation);
                  return l ? <p className="text-xs text-nuit-300 mt-2">{l.motif}{l.mensualite > 0 && ` La machine elle-même : ${euros(l.mensualite)} HT par mois sur ${FINANCEMENT.mois} mois${l.rembourseSeul ? ', que cet agent rembourse à lui seul.' : '.'}`}</p> : null;
                })()}
                {devis.some((d) => d.aConfirmer) && <p className="text-xs text-braise-300 mt-1">Certains prix de machines restent à confirmer.</p>}
              </div>

              <div className="bg-rose-600/20 border border-rose-600 p-4 rounded-lg">
                <p className="text-sm text-nuit-400 mb-2">Analyse économique (ratio 3×)</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    {eco ? (
                      <>
                        <p className="text-nuit-300">API seule: <span className="font-bold text-rose-300">{Math.round(eco.apiSeulReference)}€/mois</span></p>
                        <p className="text-nuit-300">Local-Agent: <span className="font-bold text-rose-300">{Math.round(eco.localAgentPartage)}€/mois</span> <span className="text-nuit-400 text-sm">(bundle partagé)</span></p>
                        <p className="text-nuit-300">
                          Ratio:{' '}
                          <span className={eco.ratioPartage >= 3 ? 'font-bold text-green-300' : 'font-bold text-amber-300'}>
                            {eco.ratioPartage.toFixed(1)}× moins cher
                          </span>
                          {eco.ratioPartage < 3 && <span className="text-nuit-400 text-sm"> — à vendre en mode API</span>}
                        </p>
                      </>
                    ) : (
                      <p className="text-nuit-400">Coût non calculable pour cette fiche.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-nuit-300">Risque régulementaire: <span className="font-bold text-nuit-200">{getRiskProfile(agent)}</span></p>
                    <p className="text-nuit-300">Autonomie: <span className="font-bold text-nuit-200">{agent.commercial?.autonomie}</span></p>
                    <p className="text-nuit-300">
                      Validation:{' '}
                      <span className="font-bold text-nuit-200">
                        travaille seul
                      </span>
                      {conseillees > 0 && (
                        <span className="text-nuit-400 text-sm">
                          {' '}— {conseillees} tâche{conseillees > 1 ? 's' : ''} que l'expert conseille de relire, à votre choix
                        </span>
                      )}
                    </p>
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
