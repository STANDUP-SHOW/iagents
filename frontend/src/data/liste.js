// The recruitment list (max, 10/10: « la liste de recrutement est en fait un
// panier »): the agents a visitor recruits from their fiches, and the Box
// Commander. It lives in this browser only; validating it sends it to us.
// Prices are read from tarifs.json, never stored with the line, so a price
// changed on the site is the one the list shows.
import tarifs, { BOX_PUBLIQUES, DUREES, DUREE_MOIS, euros } from './tarifs.js';
import { prixPourDuree } from './durees.js';

const CLE = 'iagent-liste-recrutement';
const EVENEMENT = 'iagent-liste';
export const PAGE_LISTE = '/recrutement';

export const PALIERS = tarifs.agents.affichage === 'paliers' ? tarifs.agents.paliers : [];
export const PALIER_DEFAUT = PALIERS[0]?.id ?? null;
export const DUREE_DEFAUT = DUREE_MOIS?.id ?? null;
/** The rental length of a line: what it chose, the month otherwise (lists saved before 15/10 have none). */
export const dureeDeLigne = (a) => DUREES.find((d) => d.id === a.duree) ?? DUREE_MOIS;
export const BOX_EN_VENTE = BOX_PUBLIQUES.filter((b) => typeof b.mensuel === 'number' && b.statut !== 'sur-devis');

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
export function ajouterAgent({ fiche, slug, nom, secteur, activite = null, suggestions = [], duree = DUREE_DEFAUT }) {
  const l = lireListe();
  const d = DUREES.some((x) => x.id === duree) ? duree : DUREE_DEFAUT;
  const deja = l.agents.find((a) => a.fiche === fiche && (a.activite ?? null) === (activite ?? null) && dureeDeLigne(a)?.id === d);
  if (deja) deja.quantite = Math.min(20, (deja.quantite ?? 1) + 1);
  else l.agents.push({ fiche, slug, nom, secteur, activite, suggestions: suggestions.slice(0, 8), palier: PALIER_DEFAUT, duree: d, quantite: 1 });
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

/** The price of one agent of the line for its rental length, excluding tax. */
export function prixDeLigne(a) {
  const p = PALIERS.find((x) => x.id === a.palier);
  const d = dureeDeLigne(a);
  return p && d ? prixPourDuree(p.mensuel, d) : 0;
}

const centimes = (x) => Math.round(x * 100);

/**
 * Prices excluding tax, each on its own line (max: prices always separate).
 * Monthly agents and the Box renew every month; a rental of 24 hours, 7 or
 * 14 days is paid once (max, 15/10).
 */
export function totaux(l) {
  let agents = 0;
  let ponctuel = 0;
  for (const a of l.agents) {
    const c = centimes(prixDeLigne(a)) * (a.quantite ?? 1);
    if (dureeDeLigne(a)?.recurrent === false) ponctuel += c;
    else agents += c;
  }
  const box = BOX_EN_VENTE.find((b) => b.id === l.box) ?? null;
  const boxC = centimes(box?.mensuel ?? 0);
  return { agents: agents / 100, ponctuel: ponctuel / 100, box: boxC / 100, boxOffre: box, total: (agents + boxC) / 100 };
}

/** The body /api/paiement/session expects (docs/paiement.md): ids only, never a price. */
export const lignesPourPaiement = (l) => ({
  lignes: [
    ...l.agents.map((a) => ({ type: 'agent', fiche: a.fiche, palier: a.palier, duree: dureeDeLigne(a)?.id, quantite: a.quantite ?? 1 })),
    ...(l.box ? [{ type: 'box', offre: l.box, quantite: 1 }] : []),
  ],
});

/** The list as plain text, for the quote request when online payment is not open. */
export function listeEnTexte(l) {
  const palier = (id) => PALIERS.find((p) => p.id === id);
  const t = totaux(l);
  return [
    ...l.agents.map((a) => {
      const d = dureeDeLigne(a);
      const prix = d?.recurrent === false ? `${euros(prixDeLigne(a))} HT pour ${d.nom}` : `${euros(prixDeLigne(a))} HT/mois`;
      return `- ${a.quantite > 1 ? `${a.quantite} × ` : ''}${a.nom}${a.activite ? ` (${a.activite})` : ''}, ${a.secteur ?? ''}, ${palier(a.palier)?.nom ?? ''} ${prix} [${a.fiche}]`;
    }),
    ...(t.boxOffre ? [`- ${t.boxOffre.nom}, ${t.boxOffre.engagementMois} mois, ${euros(t.boxOffre.mensuel)} HT/mois`] : []),
    ...(t.total ? [`Total : ${euros(t.total)} HT/mois, hors consommation d'IA`] : []),
    ...(t.ponctuel ? [`Locations à la durée : ${euros(t.ponctuel)} HT, payées une fois`] : []),
  ].join('\n');
}
