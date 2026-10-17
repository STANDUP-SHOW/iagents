// A fiche read in one activity (max, 10/10: « Assistant de réunion » becomes
// « Assistant de réunion commerce de gros » once the visitor picks his trade
// on the fiche). The composition is the one the job × activity pages of
// seo/generer.mjs publish: the fiche's own job, the trade's staff (the name
// the branch gives the post, its own expert of the same function), and the
// activity's pack (its software the job works in, vocabulary, documents,
// rules, units, people, calendar). Written once, here, so the page a search
// engine indexes and the fiche the visitor specialises say the same thing.
import logicielsJson from '../../../catalogue/logiciels.json' with { type: 'json' };
import { DEVIS } from '../../../outils/poste-de-devis.ts';
import { estTransversal, personnelDeLActivite } from './activites-recherche.js';

const LOGICIEL = new Map(logicielsJson.logiciels.map((l) => [l.id, l]));

/** « Assistant de réunion » + « Commerce de gros » → « Assistant de réunion commerce de gros ». */
export const nomSpecialise = (fiche, activite) => `${fiche.nom} ${activite.nom.charAt(0).toLowerCase()}${activite.nom.slice(1)}`;

// The staff of each activity, read once per (activity, catalogue).
const postesPar = new WeakMap();
function postesDe(activite, fiches) {
  if (!postesPar.has(activite)) postesPar.set(activite, new WeakMap());
  const par = postesPar.get(activite);
  if (!par.has(fiches)) {
    const per = personnelDeLActivite(activite, fiches);
    par.set(fiches, per ? per.services.flatMap((s) => s.postes.map((x) => ({ ...x, service: s.libelle }))) : []);
  }
  return par.get(fiches);
}

/**
 * What the fiche becomes in the activity: { nom, place, expert, outils,
 * outilsDe, autresLogiciels, pack }.
 * - `place`: { role, service } when the trade's staff names this job;
 * - `expert`: the branch's own quoting post, when this fiche is a quoting post
 *   and the branch has a better one (the optician's, not the generic one);
 * - `outils`: the activity's software the job actually works in (same
 *   family as one of its tasks); `outilsDe(t)` says which for one task;
 * - `autresLogiciels`: the rest of the activity's software, asked at the interview.
 */
export function specialiser(fiche, activite, fiches) {
  const p = activite.pack ?? {};
  const postes = postesDe(activite, fiches);
  const place = postes.find((x) => x.fiche.id === fiche.id) ?? null;
  const expertDevis = postes.find((x) => !estTransversal(x.fiche) && (DEVIS.test(x.role) || DEVIS.test(x.fiche.nom))) ?? null;
  const expert = DEVIS.test(fiche.nom) && expertDevis && expertDevis.fiche.id !== fiche.id ? expertDevis : null;
  const familles = new Set((fiche.taches ?? []).flatMap((t) => t.logiciels ?? []));
  const logiciels = (p.logiciels ?? []).map((id) => LOGICIEL.get(id)).filter(Boolean);
  const outils = logiciels.filter((l) => familles.has(l.categorie));
  return {
    nom: nomSpecialise(fiche, activite),
    place: place ? { role: place.role, service: place.service } : null,
    expert: expert ? { fiche: expert.fiche, role: expert.role } : null,
    outils,
    outilsDe: (t) => outils.filter((l) => (t.logiciels ?? []).includes(l.categorie)),
    autresLogiciels: logiciels.filter((l) => !outils.includes(l)),
    pack: p,
  };
}
