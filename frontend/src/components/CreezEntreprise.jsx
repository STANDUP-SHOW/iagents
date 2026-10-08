import { useMemo, useState } from 'react';
import agents from '../data/loader.js';
import { CYCLE_1, CYCLE_2, ficheDe, activitesPourIdee } from '../data/offres.js';
import { agentsPourDemande, coeurPourDemande, logicielsPourDemande, terrainPourDemande } from '../data/recherche.js';
import ConseilMachine from './ConseilMachine.jsx';

function LigneAgent({ id, coche, onBasculer, role }) {
  const fiche = ficheDe(id);
  if (!fiche) return null;
  return (
    <label className="flex items-start gap-3 py-2 cursor-pointer">
      <input type="checkbox" checked={coche} onChange={() => onBasculer(id)} className="mt-1 accent-neon-400 w-5 h-5 flex-none" />
      <span>
        {role && <span className="block text-xs font-semibold text-rose-300">{role}</span>}
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
// « J'ai une imprimerie », « je suis plombier », « mon cabinet »: the business
// exists, so building the project (business plan, market study, funding) is
// offered but not ticked.
const DEJA_EN_ACTIVITE = /\b(j'ai|j’ai|je suis|mon|ma|mes|notre|nos)\b/i;

export default function CreezEntreprise({ ideeInitiale = '' }) {
  const [idee, setIdee] = useState(ideeInitiale);
  const [retires, setRetires] = useState(() => new Set(DEJA_EN_ACTIVITE.test(ideeInitiale) ? CYCLE_1.flatMap((e) => e.agents) : []));
  const [ajoutes, setAjoutes] = useState([]);
  const [recherche, setRecherche] = useState('');

  const basculer = (id) =>
    setRetires((avant) => {
      const apres = new Set(avant);
      apres.has(id) ? apres.delete(id) : apres.add(id);
      return apres;
    });

  const activites = useMemo(() => activitesPourIdee(idee), [idee]);
  const coeur = useMemo(() => coeurPourDemande(idee), [idee]);
  const terrain = useMemo(() => terrainPourDemande(idee), [idee]);
  const logiciels = useMemo(() => logicielsPourDemande(idee), [idee]);
  const pourLaDemande = useMemo(() => {
    const deja = new Set(coeur.map((c) => c.fiche.id));
    return agentsPourDemande(idee).filter((id) => !deja.has(id));
  }, [idee, coeur]);
  const cycle1 = CYCLE_1.flatMap((e) => e.agents);
  const pack = [...new Set([...coeur.map((c) => c.fiche.id), ...pourLaDemande, ...cycle1, ...CYCLE_2, ...ajoutes])].filter((id) => !retires.has(id));

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
        <h2 className="font-display text-2xl text-white mb-1">Que voulez-vous accomplir ?</h2>
        <p className="text-nuit-300 mb-4">Un besoin dans votre entreprise, ou une entreprise à créer de A à Z : iAgent propose l'équipe qui y répond.</p>
        <label htmlFor="idee" className="text-sm text-nuit-200">Votre demande</label>
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
              ? <>Votre activité : {activites.map((a) => <span key={a.id} className="badge bg-neon-400/15 text-neon-300 border border-neon-400/50 mr-2">{a.nom}</span>)} Ses usages, ses documents et ses logiciels s'ajoutent à chaque agent.</>
              : "Votre activité n'est pas encore dans nos 282 : les agents travaillent quand même, et elle se précise à l'entretien d'embauche."}
          </p>
        )}
      </div>

      {coeur.length > 0 && (
        <div className="card border-2 border-rose-500/50">
          <p className="text-xs font-mono text-rose-300">Le cœur de votre métier</p>
          <h3 className="font-display text-lg text-white mb-1">Tout le personnel d'une entreprise de votre branche</h3>
          <p className="text-xs text-nuit-400 mb-3">Sous les vrais noms des postes : le deviseur qui chiffre chaque demande, ceux qui préparent et suivent la production, la direction et l'administration. Décochez ceux que vous avez déjà.</p>
          {[...new Set(coeur.map((c) => c.service))].map((service) => (
            <div key={service} className="mb-3">
              <p className="text-sm font-semibold text-rose-200 mb-1">{service}</p>
              <div className="grid md:grid-cols-2 gap-x-6">
                {coeur.filter((c) => c.service === service).map(({ role, fiche }) => <LigneAgent key={fiche.id} id={fiche.id} role={role} coche={!retires.has(fiche.id)} onBasculer={basculer} />)}
              </div>
            </div>
          ))}
          {terrain.length > 0 && (
            <p className="text-xs text-nuit-300 mt-1">
              Sur le terrain, vos équipes restent les vôtres : {terrain.map((t) => t.metier.charAt(0).toLowerCase() + t.metier.slice(1)).join(', ')}. Vos agents préparent leur travail, ils ne prennent pas leur place.
            </p>
          )}
        </div>
      )}

      {logiciels.length > 0 && (
        <div className="card border-2 border-rose-500/50">
          <p className="text-xs font-mono text-rose-300">Les logiciels de votre métier</p>
          <h3 className="font-display text-lg text-white mb-1">Vos agents travaillent dans les outils de votre branche</h3>
          <p className="text-xs text-nuit-400 mb-3">À l'entretien d'embauche, chaque agent vous demande lesquels tourne votre entreprise, et s'y règle.</p>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {logiciels.map((l) => (
              <li key={l.id} className="text-sm">
                <span className="text-white font-semibold">{l.nom}</span>
                {l.editeur && <span className="text-nuit-400"> · {l.editeur}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pourLaDemande.length > 0 && (
        <div className="card border-2 border-neon-400/50">
          <p className="text-xs font-mono text-neon-300">Pour votre demande</p>
          <h3 className="font-display text-lg text-white mb-1">Les agents qui répondent à ce que vous avez écrit</h3>
          <p className="text-xs text-nuit-400 mb-3">Les plus proches de votre activité d'abord, puis ceux qui font ce que vous demandez. Décochez ceux qui ne vous servent pas.</p>
          <div className="grid md:grid-cols-2 gap-x-6">
            {pourLaDemande.map((id) => <LigneAgent key={id} id={id} coche={!retires.has(id)} onBasculer={basculer} />)}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <p className="text-xs font-mono text-neon-300">Cycle 1</p>
          <h3 className="font-display text-lg text-white mb-1">Construire le projet</h3>
          <p className="text-xs text-nuit-400 mb-3">{DEJA_EN_ACTIVITE.test(idee) ? "Votre entreprise existe déjà : ces agents sont décochés. Cochez-les pour un nouveau projet." : "Pour un projet à lancer : étude, plan, financement, formalités."}</p>
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
        <ConseilMachine ids={pack} />
      </div>
    </div>
  );
}
