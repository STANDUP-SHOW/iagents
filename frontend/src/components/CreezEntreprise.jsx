import { useMemo, useState } from 'react';
import agents from '../data/loader.js';
import { CYCLE_1, CYCLE_2, ficheDe, activitesPourIdee, machinePourAgents } from '../data/offres.js';

function LigneAgent({ id, coche, onBasculer }) {
  const fiche = ficheDe(id);
  if (!fiche) return null;
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" checked={coche} onChange={() => onBasculer(id)} className="mt-1 accent-neon-400 w-5 h-5" />
      <span>
        <span className="text-white text-sm font-semibold">{fiche.nom}</span>
        <span className="block text-xs text-nuit-300 line-clamp-2">{fiche.accroche}</span>
      </span>
    </label>
  );
}

/**
 * « Créez votre entreprise, gérée par des agents de A à Z ». The visitor types
 * an idea; the page lays out cycle 1 (build the project) and cycle 2 (run it),
 * lets every agent be switched on or off, and sizes the machine for what is
 * left. Everything runs in the browser: the idea is sent nowhere.
 */
export default function CreezEntreprise({ ideeInitiale = '' }) {
  const [idee, setIdee] = useState(ideeInitiale);
  const [retires, setRetires] = useState(() => new Set());
  const [ajoutes, setAjoutes] = useState([]);
  const [recherche, setRecherche] = useState('');

  const basculer = (id) =>
    setRetires((avant) => {
      const apres = new Set(avant);
      apres.has(id) ? apres.delete(id) : apres.add(id);
      return apres;
    });

  const activites = useMemo(() => activitesPourIdee(idee), [idee]);
  const cycle1 = CYCLE_1.flatMap((e) => e.agents);
  const pack = [...new Set([...cycle1, ...CYCLE_2, ...ajoutes])].filter((id) => !retires.has(id));
  const machine = useMemo(() => machinePourAgents(pack), [pack.join(',')]);

  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 3) return [];
    return agents
      .filter((a) => !cycle1.includes(a.id) && !CYCLE_2.includes(a.id) && !ajoutes.includes(a.id))
      .filter((a) => a.nom.toLowerCase().includes(q) || a.secteur.includes(q))
      .slice(0, 6);
  }, [recherche, ajoutes]);

  return (
    <div className="space-y-6">
      <div className="card border-2 border-rose-500/50">
        <h2 className="font-display text-2xl text-white mb-1">Créez votre entreprise</h2>
        <p className="text-nuit-300 mb-4">Gérée par des agents de A à Z : du projet à l'équipe qui la fait tourner.</p>
        <label htmlFor="idee" className="text-sm text-nuit-200">Votre idée d'entreprise</label>
        <textarea
          id="idee"
          value={idee}
          onChange={(e) => setIdee(e.target.value)}
          rows={3}
          placeholder="Par exemple : ouvrir une boulangerie bio avec livraison en ville"
          className="mt-1 w-full rounded-lg bg-nuit-900 border border-nuit-600 focus:border-neon-400 p-3 text-white text-base"
        />
        <p className="text-xs text-nuit-400 mt-1">Rien n'est envoyé : l'offre se compose ici, dans votre navigateur.</p>
        {idee.trim() && (
          <p className="text-sm text-nuit-200 mt-3">
            {activites.length
              ? <>Activité reconnue : {activites.map((a) => <span key={a.id} className="badge bg-neon-400/15 text-neon-300 border border-neon-400/50 mr-2">{a.nom}</span>)} Ses usages, ses documents et ses logiciels s'ajoutent à chaque agent.</>
              : "Aucune de nos 282 activités ne correspond encore aux mots de l'idée : les agents travaillent quand même, avec un pack activité à préciser à l'entretien d'embauche."}
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <p className="text-xs font-mono text-neon-300">Cycle 1</p>
          <h3 className="font-display text-lg text-white mb-3">Construire le projet</h3>
          {CYCLE_1.map((etape) => (
            <div key={etape.etape} className="mb-3">
              <p className="text-sm text-rose-300 font-semibold">{etape.etape}</p>
              {etape.agents.map((id) => <LigneAgent key={id} id={id} coche={!retires.has(id)} onBasculer={basculer} />)}
            </div>
          ))}
        </div>

        <div className="card">
          <p className="text-xs font-mono text-neon-300">Cycle 2</p>
          <h3 className="font-display text-lg text-white mb-1">L'équipe opérationnelle</h3>
          <p className="text-xs text-nuit-400 mb-3">Une fois l'activité lancée. Une proposition de départ, que vous modifiez.</p>
          {[...CYCLE_2, ...ajoutes].map((id) => <LigneAgent key={id} id={id} coche={!retires.has(id)} onBasculer={basculer} />)}
          <label htmlFor="ajout" className="text-sm text-nuit-200 mt-3 block">Ajouter un agent du catalogue</label>
          <input
            id="ajout"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Métier ou secteur, par exemple : logistique"
            className="mt-1 w-full rounded-lg bg-nuit-900 border border-nuit-600 focus:border-neon-400 p-2 text-white"
          />
          {trouves.map((a) => (
            <button
              key={a.id}
              onClick={() => { setAjoutes((l) => [...l, a.id]); setRecherche(''); }}
              className="block w-full text-left py-2 px-2 mt-1 rounded bg-nuit-700 hover:bg-nuit-600 text-sm text-white"
            >
              + {a.nom} <span className="text-nuit-400">· {a.secteur}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card border-2 border-neon-400/60">
        <h3 className="font-display text-lg text-white mb-1">Votre pack : {pack.length} agents</h3>
        {machine ? (
          <div className="text-sm text-nuit-200 space-y-1">
            <p>La machine qui le fait tourner, calculée sur les modèles de chaque agent :</p>
            {machine.boitiers.map((b, i) => (
              <p key={i}>
                <span className="text-neon-300 font-semibold">iAgent Box gamme {b.gamme}</span> · {b.description} · {b.agents} agents
              </p>
            ))}
            {machine.horsLocal.length > 0 && (
              <p className="text-braise-300">{machine.horsLocal.map((f) => f.nom).join(', ')} : en mode API, aucune de nos machines ne les porte en local.</p>
            )}
            <p className="text-xs text-nuit-400">Estimation du dimensionnement, à confirmer sur la machine réelle. Offres et prix des iAgent Box : bientôt.</p>
          </div>
        ) : (
          <p className="text-sm text-nuit-300">Cochez au moins un agent pour voir la machine qui le porte.</p>
        )}
      </div>
    </div>
  );
}
