// Fixed asset name published by build-windows-msi.yml: /latest/download/ serves
// the file itself, so the visitor never lands on a GitHub page.
const TELECHARGEMENT_MSI =
  'https://github.com/STANDUP-SHOW/iagents/releases/latest/download/iAgent-Windows.msi';

export default function Navbar({ search, onSearchChange }) {
  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h1 className="text-xl font-bold text-indigo-400">LocalAgent</h1>
              <p className="text-xs text-slate-400">1249 fiches d'agents métier</p>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8">
            <input
              type="text"
              placeholder="Chercher par ID, nom, accroche..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <a
            href={TELECHARGEMENT_MSI}
            rel="noopener noreferrer"
            title="Installeur Windows (.msi)"
            className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <span>💻</span> Télécharger App
          </a>
        </div>
      </div>
    </nav>
  );
}
