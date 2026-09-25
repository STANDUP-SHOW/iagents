import { COMMANDEUR } from '../../../dimensionnement/offre-box.ts';
import { INSTALLATIONS, euros } from '../data/offres.js';

const fondChoisi = 'border-neon-400 shadow-neon';

/** One installation: what it is, what it costs to buy, and per month over 24 months. */
export function CarteInstallation({ o, choisie, onChoisir, compact = false }) {
  const { cout } = o;
  return (
    <div className={`card border-2 ${choisie ? fondChoisi : 'border-nuit-700'} flex flex-col`}>
      <h3 className="font-display text-lg text-white">{o.nom}</h3>
      {o.avecCommandeur && <p className="text-xs text-rose-300">Livrée avec une {COMMANDEUR.nom}</p>}
      {!compact && <p className="text-sm text-nuit-300 mt-1">{o.phrase}</p>}
      {!compact && o.specifications && <p className="text-xs text-nuit-400 mt-1">Spécifications : {o.specifications}</p>}
      <div className="mt-3 flex-1">
        {cout.prixAchat === 0 ? (
          <p className="text-sm text-nuit-200">Aucun achat : vous payez vos agents à l'usage.</p>
        ) : (
          <>
            <p className="text-2xl font-bold text-neon-300">
              {euros(cout.mensualite)}<span className="text-sm text-nuit-300 font-normal"> / mois sur 24 mois</span>
            </p>
            <p className="text-sm text-nuit-300">
              ou {euros(cout.prixAchat)} à l'achat{o.avecCommandeur && ', Box Commandeur comprise'}
            </p>
          </>
        )}
        {cout.aConfirmer && <p className="text-xs text-braise-300 mt-1">Prix provisoire</p>}
      </div>
      {onChoisir && (
        <button onClick={() => onChoisir(o.id)} className={`mt-3 min-h-[44px] rounded-lg font-semibold ${choisie ? 'bg-neon-400/20 text-neon-300 border border-neon-400' : 'bg-nuit-700 text-white hover:bg-nuit-600'}`}>
          {choisie ? 'Votre installation' : 'Choisir'}
        </button>
      )}
    </div>
  );
}

/**
 * The machine offer: six installations read from dimensionnement/offre-box.json.
 * Prices there are provisional until max sets them, and the page says so on
 * every card that carries one.
 */
export default function IAgentBox({ installation = null, onChoisir }) {
  return (
    <div className="space-y-6">
      <div className="card border-2 border-neon-400/60">
        <h2 className="font-display text-2xl text-white mb-1">iAgent Box</h2>
        <p className="text-nuit-300">
          Choisissez d'abord votre installation : c'est elle qui dit, pour chaque agent, ce qu'il coûte chez vous contre ce qu'il coûte par API.
          Toutes les machines s'achètent ou se financent sur 24 mois.
        </p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="rounded-lg bg-nuit-900 border border-nuit-600 p-4">
            <p className="text-rose-300 font-semibold">La Box Commandeur</p>
            <p className="text-sm text-nuit-300">Un poste de commande dédié à vos agents, une rallonge de votre bureau. Elle ne fait pas tourner d'agent à elle seule.</p>
          </div>
          <div className="rounded-lg bg-nuit-900 border border-nuit-600 p-4">
            <p className="text-rose-300 font-semibold">La puissance</p>
            <p className="text-sm text-nuit-300">La Box Max porte la première puissance dans un seul boîtier ; au-delà, trois machines de calcul, chacune commandée par sa Box Commandeur.</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {INSTALLATIONS.map((o) => (
          <CarteInstallation key={o.id} o={o} choisie={installation === o.id} onChoisir={onChoisir} />
        ))}
      </div>
      <p className="text-xs text-nuit-400">
        Prix et spécifications provisoires, en attente de l'offre définitive. Capacités estimées depuis nos tables de dimensionnement, à confirmer sur les machines réelles.
      </p>
    </div>
  );
}
