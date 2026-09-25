import { useMemo } from 'react';
import { PACKS_ENTREPRISE, machinePourAgents } from '../data/offres.js';

function MachineDuPack({ ids }) {
  const machine = useMemo(() => machinePourAgents(ids), [ids]);
  if (!machine) return null;
  return (
    <div className="text-xs text-nuit-300 space-y-1">
      {machine.boitiers.map((b, i) => (
        <p key={i}>
          <span className="text-neon-300 font-semibold">iAgent Box gamme {b.gamme}</span> · {b.description} · {b.agents} agents
        </p>
      ))}
      {machine.horsLocal.length > 0 && (
        <p className="text-braise-300">
          {machine.horsLocal.length} agent{machine.horsLocal.length > 1 ? 's' : ''} (image, vidéo ou son) en mode API
        </p>
      )}
    </div>
  );
}

/** The 43 business packs, one per sector. Opening one shows its agents. */
export default function PacksEntreprise({ packOuvert, onOuvrir }) {
  if (packOuvert) {
    const pack = PACKS_ENTREPRISE.find((p) => p.id === packOuvert);
    return (
      <div className="card border-2 border-neon-400/60 mb-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <p className="text-xs font-mono text-neon-300">{pack.id}</p>
            <h2 className="font-display text-xl text-white">{pack.nom}</h2>
            <p className="text-sm text-nuit-300 mt-1">{pack.capacites}</p>
          </div>
          <button onClick={() => onOuvrir(null)} className="px-3 py-1 rounded bg-nuit-700 hover:bg-nuit-600 text-sm text-nuit-200">
            ← Tous les packs
          </button>
        </div>
        <p className="text-xs text-nuit-400 mt-3">Déroulé : {pack.workflow}</p>
        <p className="text-xs text-nuit-400">Connexions : {pack.connecteurs}</p>
        <div className="mt-3 pt-3 border-t border-nuit-700">
          <MachineDuPack ids={pack.agents} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {PACKS_ENTREPRISE.map((pack) => (
        <button
          key={pack.id}
          onClick={() => onOuvrir(pack.id)}
          className="card text-left border-2 border-nuit-700 hover:border-neon-400 hover:shadow-neon transition-all"
        >
          <p className="text-xs font-mono text-neon-300">{pack.id}</p>
          <h3 className="font-bold text-white">{pack.nom}</h3>
          <p className="text-xs text-nuit-300 line-clamp-2 mt-1 mb-3">{pack.capacites}</p>
          <span className="badge bg-nuit-700 text-nuit-200">{pack.agents.length} agents métier</span>
        </button>
      ))}
    </div>
  );
}
