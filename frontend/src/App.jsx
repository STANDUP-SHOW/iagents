import { useState, useMemo } from 'react';
import Navbar from './components/Navbar.jsx';
import FicheList from './components/FicheList.jsx';
import FicheDetail from './components/FicheDetail.jsx';
import PacksEntreprise from './components/PacksEntreprise.jsx';
import CreezEntreprise from './components/CreezEntreprise.jsx';
import IAgentBox from './components/IAgentBox.jsx';
import { AGENTS_RESEAUX, PACKS_ENTREPRISE, ficheDe } from './data/offres.js';
import agents, {
  filterAgents,
  getSectors,
  getFamilles,
  groupBySetor
} from './data/loader.js';

// The shop's three pages, and the three ways to browse the catalogue.
export const PAGES = [
  { id: 'catalogue', libelle: 'Catalogue' },
  { id: 'entreprise', libelle: 'Créez votre entreprise' },
  { id: 'box', libelle: 'iAgent Box' },
];
export const VUES = [
  { id: 'metier', libelle: 'Agents métier' },
  { id: 'reseaux', libelle: 'Agents réseaux' },
  { id: 'packs', libelle: 'Packs entreprise' },
];

const onglet = (actif) =>
  `px-4 py-3 rounded-lg text-sm md:text-base font-semibold transition min-h-[44px] ${
    actif ? 'bg-neon-400/15 text-neon-300 border border-neon-400 shadow-neon' : 'bg-nuit-800 text-nuit-300 border border-nuit-700 hover:bg-nuit-700'
  }`;

export default function App({ pageInitiale = 'catalogue', vueInitiale = 'metier' }) {
  const [page, setPage] = useState(pageInitiale);
  const [vue, setVue] = useState(vueInitiale);
  const [packOuvert, setPackOuvert] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedFamille, setSelectedFamille] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sectors = useMemo(() => getSectors(), []);
  const familles = useMemo(() => getFamilles(), []);
  const groupedAgents = useMemo(() => groupBySetor(agents), []);

  // The list the filters apply to: the whole catalogue, the network agents, or
  // the agents of the business pack that is open.
  const base = useMemo(() => {
    if (vue === 'reseaux') return AGENTS_RESEAUX.map(ficheDe).filter(Boolean);
    if (vue === 'packs' && packOuvert) return PACKS_ENTREPRISE.find((p) => p.id === packOuvert).agents.map(ficheDe);
    return agents;
  }, [vue, packOuvert]);

  const filteredAgents = useMemo(() =>
    filterAgents(base, search, selectedSector, selectedFamille),
    [base, search, selectedSector, selectedFamille]
  );

  const montrerListe = vue !== 'packs' || packOuvert;

  return (
    <div className="min-h-screen bg-nuit-900">
      <Navbar search={search} onSearchChange={(q) => { setSearch(q); setPage('catalogue'); }} />

      <nav className="bg-nuit-900 border-b border-nuit-700 px-4 py-3 flex flex-wrap gap-2" aria-label="Sections de la boutique">
        {PAGES.map((p) => (
          <button key={p.id} onClick={() => setPage(p.id)} className={onglet(page === p.id)} aria-current={page === p.id ? 'page' : undefined}>
            {p.libelle}
          </button>
        ))}
      </nav>

      {page === 'entreprise' && <div className="p-4 md:p-8 max-w-7xl mx-auto"><CreezEntreprise /></div>}
      {page === 'box' && <div className="p-4 md:p-8 max-w-7xl mx-auto"><IAgentBox /></div>}

      {page === 'catalogue' && <div className="flex">
        {/* Sidebar Filters */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-nuit-800 border-r border-nuit-700 overflow-y-auto transition-all duration-300 shadow-lg`}>
          <div className="p-4 space-y-6">
            {/* Toggle Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="absolute -right-10 top-20 bg-nuit-700 hover:bg-nuit-600 text-white p-2 rounded transition"
              title="Toggle sidebar"
            >
              {sidebarOpen ? '→' : '←'}
            </button>

            {/* Sectors */}
            <div>
              <h3 className="font-bold text-nuit-200 mb-3 flex items-center gap-2">
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
                      ? 'bg-neon-400/15 text-neon-300 border border-neon-400 shadow-neon'
                      : 'bg-nuit-700 text-nuit-300 hover:bg-nuit-600'
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
                        ? 'bg-neon-400/15 text-neon-300 border border-neon-400 shadow-neon'
                        : 'bg-nuit-700 text-nuit-300 hover:bg-nuit-600'
                    }`}
                  >
                    {sector} ({groupedAgents[sector]?.length || 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Familles */}
            <div>
              <h3 className="font-bold text-nuit-200 mb-3 flex items-center gap-2">
                <span>🔖</span> Familles
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                <button
                  onClick={() => setSelectedFamille('')}
                  className={`w-full text-left px-3 py-2 rounded transition text-sm ${
                    selectedFamille === ''
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500 shadow-rose'
                      : 'bg-nuit-700 text-nuit-300 hover:bg-nuit-600'
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
                        ? 'bg-rose-500/15 text-rose-300 border border-rose-500 shadow-rose'
                        : 'bg-nuit-700 text-nuit-300 hover:bg-nuit-600'
                    }`}
                  >
                    {famille}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="border-t border-nuit-700 pt-4">
              <div className="text-xs text-nuit-400">
                <p>Agents affichés: <span className="font-bold text-neon-300">{filteredAgents.length}</span></p>
                <p>Total: <span className="font-bold text-nuit-300">{agents.length}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Parcourir le catalogue">
              {VUES.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={vue === v.id}
                  onClick={() => { setVue(v.id); setPackOuvert(null); setSelectedSector(''); setSelectedFamille(''); }}
                  className={onglet(vue === v.id)}
                >
                  {v.libelle}
                </button>
              ))}
            </div>

            {vue === 'packs' && <div className="mb-6"><PacksEntreprise packOuvert={packOuvert} onOuvrir={setPackOuvert} /></div>}

            {montrerListe && <>
            {/* Header Stats */}
            <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-nuit-800 rounded-lg p-4 border border-nuit-700">
                <p className="text-xs text-nuit-400 mb-1">Fiches visibles</p>
                <p className="text-2xl font-bold text-neon-300">{filteredAgents.length}</p>
              </div>
              <div className="bg-nuit-800 rounded-lg p-4 border border-nuit-700">
                <p className="text-xs text-nuit-400 mb-1">Total</p>
                <p className="text-2xl font-bold text-nuit-300">{agents.length}</p>
              </div>
              <div className="bg-nuit-800 rounded-lg p-4 border border-nuit-700">
                <p className="text-xs text-nuit-400 mb-1">Secteurs</p>
                <p className="text-2xl font-bold text-rose-300">{sectors.length}</p>
              </div>
              <div className="bg-nuit-800 rounded-lg p-4 border border-nuit-700">
                <p className="text-xs text-nuit-400 mb-1">Familles</p>
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
                <p className="text-2xl text-nuit-400 mb-2">😴 Aucun agent trouvé</p>
                <p className="text-nuit-500">Essayez de modifier les filtres</p>
              </div>
            )}
            </>}
          </div>
        </div>
      </div>}

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
