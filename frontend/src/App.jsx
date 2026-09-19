import { useState, useMemo } from 'react';
import Navbar from './components/Navbar.jsx';
import FicheList from './components/FicheList.jsx';
import FicheDetail from './components/FicheDetail.jsx';
import agents, {
  filterAgents,
  getSectors,
  getFamilles,
  groupBySetor
} from './data/loader.js';

export default function App() {
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedFamille, setSelectedFamille] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sectors = useMemo(() => getSectors(), []);
  const familles = useMemo(() => getFamilles(), []);
  const groupedAgents = useMemo(() => groupBySetor(agents), []);

  const filteredAgents = useMemo(() =>
    filterAgents(agents, search, selectedSector, selectedFamille),
    [search, selectedSector, selectedFamille]
  );

  return (
    <div className="min-h-screen bg-slate-900">
      <Navbar search={search} onSearchChange={setSearch} />

      <div className="flex">
        {/* Sidebar Filters */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-slate-800 border-r border-slate-700 overflow-y-auto transition-all duration-300 shadow-lg`}>
          <div className="p-4 space-y-6">
            {/* Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="absolute -right-10 top-20 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded transition"
              title="Toggle sidebar"
            >
              {sidebarOpen ? '→' : '←'}
            </button>

            {/* Sectors */}
            <div>
              <h3 className="font-bold text-slate-200 mb-3 flex items-center gap-2">
                <span>🏢</span> Secteurs
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedSector('');
                    setSelectedAgent(null);
                  }}
                  className={`w-full text-left px-3 py-2 rounded transition text-sm ${
                    selectedSector === ''
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  ✓ Tous ({agents.length})
                </button>
                {sectors.map((sector) => (
                  <button
                    key={sector}
                    onClick={() => {
                      setSelectedSector(sector);
                      setSelectedAgent(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded transition text-sm ${
                      selectedSector === sector
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {sector} ({groupedAgents[sector]?.length || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Familles */}
            <div>
              <h3 className="font-bold text-slate-200 mb-3 flex items-center gap-2">
                <span>🔖</span> Familles
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                <button
                  onClick={() => setSelectedFamille('')}
                  className={`w-full text-left px-3 py-2 rounded transition text-sm ${
                    selectedFamille === ''
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  ✓ Toutes
                </button>
                {familles.map((famille) => (
                  <button
                    key={famille}
                    onClick={() => setSelectedFamille(famille)}
                    className={`w-full text-left px-3 py-2 rounded transition text-sm ${
                      selectedFamille === famille
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {famille}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="border-t border-slate-700 pt-4">
              <div className="text-xs text-slate-400">
                <p>Agents affichés: <span className="font-bold text-indigo-300">{filteredAgents.length}</span></p>
                <p>Total: <span className="font-bold text-slate-300">{agents.length}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-7xl mx-auto">
            {/* Header Stats */}
            <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Fiches visibles</p>
                <p className="text-2xl font-bold text-indigo-300">{filteredAgents.length}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Total</p>
                <p className="text-2xl font-bold text-slate-300">{agents.length}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Secteurs</p>
                <p className="text-2xl font-bold text-purple-300">{sectors.length}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Familles</p>
                <p className="text-2xl font-bold text-green-300">{familles.length}</p>
              </div>
            </div>

            {/* Fiches Grid */}
            {filteredAgents.length > 0 ? (
              <FicheList
                agents={filteredAgents}
                onSelectAgent={setSelectedAgent}
                selectedAgent={selectedAgent}
              />
            ) : (
              <div className="text-center py-16">
                <p className="text-2xl text-slate-400 mb-2">😴 Aucun agent trouvé</p>
                <p className="text-slate-500">Essayez de modifier les filtres</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedAgent && (
        <FicheDetail
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </div>
  );
}
