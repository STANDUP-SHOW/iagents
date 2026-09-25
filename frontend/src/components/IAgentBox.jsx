import { useMemo } from 'react';
import { gammesBox } from '../data/offres.js';

/**
 * The dedicated machines. The architecture and the ranges come from the sizing
 * tables; the offers and prices are max's to give, so the page says they are
 * coming rather than showing a figure nobody has set.
 */
export default function IAgentBox() {
  const gammes = useMemo(() => gammesBox(), []);
  return (
    <div className="space-y-6">
      <div className="card border-2 border-neon-400/60">
        <h2 className="font-display text-2xl text-white mb-1">iAgent Box</h2>
        <p className="text-nuit-300">
          Des machines dédiées, préparées pour vos agents. Vos agents travaillent chez vous, en local, sans facture au jeton.
        </p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg bg-nuit-900 border border-nuit-600 p-4">
            <p className="text-rose-300 font-semibold">Le poste</p>
            <p className="text-sm text-nuit-300">Un PC Windows, écran tactile possible : l'application iAgent, la voix, le navigateur et vos fichiers.</p>
          </div>
          <div className="rounded-lg bg-nuit-900 border border-nuit-600 p-4">
            <p className="text-rose-300 font-semibold">La Box</p>
            <p className="text-sm text-nuit-300">Un boîtier discret sur votre réseau, qui fait tout le calcul des agents pour tous les postes.</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {gammes.map((g) => (
          <div key={g.gamme} className="card border-2 border-nuit-700">
            <p className="text-xs font-mono text-neon-300">Gamme</p>
            <h3 className="font-display text-3xl text-white">{g.gamme}</h3>
            <p className="text-sm text-nuit-300 mt-1">{g.dediee ? 'Carte graphique dédiée' : 'Mini-PC à mémoire partagée'}</p>
            <p className="text-sm text-nuit-200 mt-2">
              Jusqu'à <span className="text-neon-300 font-semibold">{g.capacite}</span> agents de bureau (secrétariat) en continu
            </p>
            <p className="text-xs text-braise-300 mt-3">Offre et prix : bientôt</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-nuit-400">
        Capacités estimées depuis nos tables de dimensionnement, à confirmer sur les machines réelles. Les agents image, vidéo et musique demandent une gamme à carte dédiée ou le mode API.
      </p>
    </div>
  );
}
