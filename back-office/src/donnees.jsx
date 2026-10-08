// How a screen reads from and writes to the platform.
//
// `useLecture` starts from `initial` when the bench (or a server render)
// injected an answer for this exact path, and otherwise fetches it in the
// browser. The bench therefore renders every screen with real platform
// answers, passed through the real client, without a network.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { chemin } from './routes.js';
import { executer } from './api.js';

export const ContextePlateforme = createContext({ client: null, initial: {} });

function cleDe(nom, options) {
  try { return { cle: chemin(nom, options.params, options.query).chemin, erreur: null }; }
  catch (e) { return { cle: null, erreur: e.message }; }
}

export function useLecture(nom, options = {}, actif = true) {
  const { client, initial } = useContext(ContextePlateforme);
  const { cle, erreur: erreurChemin } = actif ? cleDe(nom, options) : { cle: null, erreur: null };
  const depart = cle && initial && Object.prototype.hasOwnProperty.call(initial, cle) ? initial[cle] : undefined;
  const [etat, setEtat] = useState(() => (depart !== undefined
    ? { chargement: false, donnees: depart.donnees ?? null, erreur: depart.erreur ?? null }
    : { chargement: Boolean(cle), donnees: null, erreur: erreurChemin }));
  const [tour, setTour] = useState(0);
  const dejaFourni = useRef(depart !== undefined);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!cle) return undefined;
    if (dejaFourni.current) { dejaFourni.current = false; return undefined; }
    let vivant = true;
    setEtat((e) => ({ ...e, chargement: true }));
    executer(client.appeler(nom, optionsRef.current)).then((r) => {
      if (!vivant) return;
      // On failure the previous data is dropped: stale rows must not pass for current ones.
      setEtat(r.ok ? { chargement: false, donnees: r.corps, erreur: null } : { chargement: false, donnees: null, erreur: r.erreur, plateforme: r.plateforme });
    });
    return () => { vivant = false; };
  }, [cle, tour]);

  return { ...etat, recharger: () => setTour((t) => t + 1) };
}

export function useAction() {
  const { client } = useContext(ContextePlateforme);
  const [etat, setEtat] = useState({ statut: 'repos' });
  const lancer = async (nom, options, apres) => {
    setEtat({ statut: 'en-cours' });
    // `options` may be a function, so that a form's own checks (JSON, required
    // fields) run here and are shown as refused before sending.
    const r = await executer(Promise.resolve().then(() => client.appeler(nom, typeof options === 'function' ? options() : options)));
    setEtat(r.ok ? { statut: 'fait', corps: r.corps } : { statut: 'erreur', erreur: r.erreur, plateforme: r.plateforme });
    if (r.ok && apres) apres(r.corps);
    return r;
  };
  return [etat, lancer, () => setEtat({ statut: 'repos' })];
}
