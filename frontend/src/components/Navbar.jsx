import logo from '../assets/logo-iagent.png';

export default function Navbar({ search, onSearchChange }) {
  return (
    <nav className="bg-nuit-900/70 backdrop-blur-md border-b border-neon-400/20 sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="iAgent" className="h-9 w-auto drop-shadow-[0_0_6px_rgba(3,243,255,0.5)]" />
            <div>
              <h1 className="sr-only">iAgent</h1>
              <p className="text-xs text-nuit-400">1249 fiches d'agents métier</p>
            </div>
          </div>

          <div className="flex-1 max-w-md mx-8">
            <input
              type="text"
              placeholder="Chercher par ID, nom, accroche..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-nuit-700 border border-nuit-600 text-white placeholder-nuit-400 focus:outline-none focus:ring-2 focus:ring-neon-500 focus:border-transparent"
            />
          </div>

          <a
            href="https://github.com/STANDUP-SHOW/iagents/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 px-4 py-2 bg-gradient-to-r from-braise-500 to-rose-500 hover:shadow-rose text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <span>💻</span> Télécharger App
          </a>
        </div>
      </div>
    </nav>
  );
}
