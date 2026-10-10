// The recruitment list (max, 10/10: « la liste de recrutement est en fait un
// panier »): the agents a visitor recruits from their fiches, and the Box
// Commander. It lives in this browser only; validating it sends it to us.
// Prices are read from tarifs.json, never stored with the line, so a price
// changed on the site is the one the list shows.
import tarifs, { BOX_PUBLIQUES } from './tarifs.js';

const CLE = 'iagent-liste-recrutement';
const EVENEMENT = 'iagent-liste';
export const PAGE_LISTE = '/recrutement';

export const PALIERS = tarifs.agents.affichage === 'paliers' ? tarifs.agents.paliers : [];
export const PALIER_DEFAUT = PALIERS[0]?.id ?? null;
export const BOX_EN_VENTE = BOX_PUBLIQUES.filter((b) => typeof b.mensuel === 'number' && b.statut !== 'sur-devis' && b.statut !== 'bientot');

const vide = () => ({ agents: [], box: null });

export function lireListe() {
  try {
    const l = JSON.parse(globalThis.localStorage?.getItem(CLE) ?? 'null');
    if (!l || !Array.isArray(l.agents)) return vide();
    return { agents: l.agents.filter((a) => a && typeof a.fiche === 'string'), box: BOX_EN_VENTE.some((b) => b.id === l.box) ? l.box : null };
  } catch {
    return vide();
  }
}

function ecrire(l) {
  try { globalThis.localStorage?.setItem(CLE, JSON.stringify(l)); } catch { /* private window: the list lives for this page only */ }
  try { globalThis.dispatchEvent?.(new CustomEvent(EVENEMENT, { detail: l })); } catch { /* SSR */ }
  return l;
}

/** One line per job and activity: recruiting the same job twice raises its count. */
export function ajouterAgent({ fiche, slug, nom, secteur, activite = null, suggestions = [] }) {
  const l = lireListe();
  const deja = l.agents.find((a) => a.fiche === fiche && (a.activite ?? null) === (activite ?? null));
  if (deja) deja.quantite = Math.min(20, (deja.quantite ?? 1) + 1);
  else l.agents.push({ fiche, slug, nom, secteur, activite, suggestions: suggestions.slice(0, 8), palier: PALIER_DEFAUT, quantite: 1 });
  return ecrire(l);
}

export function changerAgent(index, champs) {
  const l = lireListe();
  if (!l.agents[index]) return l;
  Object.assign(l.agents[index], champs);
  if (l.agents[index].quantite < 1) l.agents.splice(index, 1);
  return ecrire(l);
}

export const retirerAgent = (index) => { const l = lireListe(); l.agents.splice(index, 1); return ecrire(l); };
export const choisirBox = (id) => ecrire({ ...lireListe(), box: id });
export const viderListe = () => ecrire(vide());

export const nombreDAgents = (l) => l.agents.reduce((n, a) => n + (a.quantite ?? 1), 0);

/** Listen to the list from any component; returns the unsubscribe. */
export function ecouterListe(rappel) {
  const sur = (e) => rappel(e.detail ?? lireListe());
  const stockage = (e) => { if (e.key === CLE) rappel(lireListe()); };
  globalThis.addEventListener?.(EVENEMENT, sur);
  globalThis.addEventListener?.('storage', stockage);
  return () => { globalThis.removeEventListener?.(EVENEMENT, sur); globalThis.removeEventListener?.('storage', stockage); };
}

/** Monthly prices, excluding tax, each on its own line (max: prices always separate). */
export function totaux(l) {
  const palier = (id) => PALIERS.find((p) => p.id === id);
  const agents = l.agents.reduce((n, a) => n + (palier(a.palier)?.mensuel ?? 0) * (a.quantite ?? 1), 0);
  const box = BOX_EN_VENTE.find((b) => b.id === l.box) ?? null;
  return { agents, box: box?.mensuel ?? 0, boxOffre: box, total: agents + (box?.mensuel ?? 0) };
}

/** The body /api/paiement/session expects (docs/paiement.md): ids only, never a price. */
export const lignesPourPaiement = (l) => ({
  lignes: [
    ...l.agents.map((a) => ({ type: 'agent', fiche: a.fiche, palier: a.palier, quantite: a.quantite ?? 1 })),
    ...(l.box ? [{ type: 'box', offre: l.box, quantite: 1 }] : []),
  ],
});

/** The list as plain text, for the quote request when online payment is not open. */
export function listeEnTexte(l) {
  const palier = (id) => PALIERS.find((p) => p.id === id);
  const t = totaux(l);
  return [
    ...l.agents.map((a) => `- ${a.quantite > 1 ? `${a.quantite} × ` : ''}${a.nom}${a.activite ? ` (${a.activite})` : ''}, ${a.secteur ?? ''}, ${palier(a.palier)?.nom ?? ''} ${palier(a.palier)?.mensuel ?? ''} € HT/mois [${a.fiche}]`),
    ...(t.boxOffre ? [`- ${t.boxOffre.nom}, ${t.boxOffre.engagementMois} mois, ${t.boxOffre.mensuel} € HT/mois`] : []),
    `Total : ${t.total} € HT/mois, hors consommation d'IA`,
  ].join('\n');
}
