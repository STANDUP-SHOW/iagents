// Where « Recruter cet agent » leads, from any page of the site (max, 10/10:
// recruit THIS agent, not an agent). The address carries the job and what the
// visitor already chose, in words, so the recruitment page shows them and the
// request max receives names the job without a lookup.
export const PAGE_RECRUTER = '/recruter';

// `parmi`: the trades whose staff include this job, when the visitor has not
// named theirs. One is filled in; up to eight become a choice; more, and the
// visitor writes it.
export const PARMI_MAX = 8;

export function urlRecruter({ poste, ref, secteur, activite, logiciel, parmi = [] } = {}) {
  const q = new URLSearchParams();
  if (!activite && parmi.length === 1) [activite] = parmi;
  for (const [k, v] of Object.entries({ poste, ref, secteur, activite, logiciel })) if (v) q.set(k, v);
  if (!activite && parmi.length > 1 && parmi.length <= PARMI_MAX) q.set('parmi', parmi.join('|'));
  const s = q.toString();
  return s ? `${PAGE_RECRUTER}?${s}` : PAGE_RECRUTER;
}

/** What the address says, for the recruitment page. */
export function lireRecrutement(recherche) {
  const q = new URLSearchParams(recherche);
  const v = (k) => (q.get(k) ?? '').trim().slice(0, 160) || null;
  const parmi = (q.get('parmi') ?? '').split('|').map((x) => x.trim().slice(0, 160)).filter(Boolean).slice(0, PARMI_MAX);
  return { poste: v('poste'), ref: v('ref'), secteur: v('secteur'), activite: v('activite'), logiciel: v('logiciel'), parmi };
}
