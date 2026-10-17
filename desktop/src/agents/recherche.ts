/**
 * The search of « Embaucher »: what a client types (« métier de bouche »,
 * « boulanger », « vendeur en boulangerie ») against the métiers, their
 * sectors, the activities and the postes a trade gives its staff.
 *
 * max, 17/10: « quand je tape métier de bouche, je n'ai que trois agents ».
 * The search compared the whole phrase as one block, so the singular
 * « métier » missed « Métiers de bouche », a two-word query missed any
 * title that did not hold it verbatim, and the postes of catalogue/personnel.json
 * (the names a trade gives its jobs, the ones the site searches) were never read.
 * Here every significant word must be found, by its beginning or its root,
 * plural or not, accents or not.
 */

import { placeDansActivite, type Activite } from './activites.ts'

export type EntreeRecherchee = { id: string; metier: string; secteur: string }

/** Lower case, no accent, ligatures spelt out (« œuvre » → « oeuvre »). */
export const normaliser = (t: string) =>
  String(t ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Words that say nothing about a job: « métier de bouche » is « bouche ».
const VIDES = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'et', 'en', 'a', 'au', 'aux', 'un', 'une', 'pour', 'par', 'sur',
  'dans', 'avec', 'ou', 'mon', 'ma', 'mes', 'je', 'j', 'cherche', 'besoin', 'agent', 'agents',
])
// « métier », « secteur » and « poste » name the kind of thing, not the thing.
const GENERIQUES = new Set(['metier', 'secteur', 'poste', 'activite'])

/** « Métiers » and « métier », « travaux » and « travail » read the same. */
const singulier = (m: string) => (m.length > 3 ? m.replace(/aux$/, 'al').replace(/[sx]$/, '') : m)

const mots = (t: string) => normaliser(t).split(/[^a-z0-9]+/).filter(Boolean)

/** The words of the query that carry its meaning, singular. */
export function motsDeLaRecherche(texte: string): string[] {
  const tous = mots(texte).filter((m) => !VIDES.has(m)).map(singulier)
  const utiles = tous.filter((m) => !GENERIQUES.has(m))
  // « métiers » alone names no job: everything is shown.
  return utiles
}

// A word is found when one begins the other (« bouche » and « boucherie »,
// « boulangerie » and « boulanger ») or when both share seven letters
// (« imprimeur » and « imprimerie », « comptable » and « comptabilité »).
// Six would join « fournil » and « fournitures ».
const RACINE = 7
const trouve = (dans: readonly string[], m: string) =>
  dans.some(
    (w) =>
      w.startsWith(m) ||
      (w.length >= 5 && m.startsWith(w)) ||
      (m.length >= RACINE && w.slice(0, RACINE) === m.slice(0, RACINE))
  )

/** Every word of a text, singular, for `trouve`. */
export const motsIndexes = (...textes: string[]) => textes.flatMap(mots).map(singulier)

/**
 * The postes of every trade, by fiche (catalogue/personnel.json): « Vendeur en
 * boulangerie » points at the fiche that does that job.
 */
export function postesParFiche(personnel: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const organigrammes = (personnel as { organigrammes?: Record<string, Record<string, unknown>> })?.organigrammes ?? {}
  for (const o of Object.values(organigrammes)) {
    for (const [cle, valeur] of Object.entries(o)) {
      if (!Array.isArray(valeur) || cle === 'sources') continue
      for (const paire of valeur) {
        if (!Array.isArray(paire) || typeof paire[0] !== 'string' || typeof paire[1] !== 'string') continue
        const [role, id] = paire as [string, string]
        const l = out.get(id) ?? []
        if (!l.includes(role)) l.push(role)
        out.set(id, l)
      }
    }
  }
  return out
}

/** The fiches that make an activity's trade, in the organigram's order (estimator, production, direction, office). */
export function coeurDeLActivite(activite: Activite, personnel: unknown): string[] {
  const p = personnel as { activites?: Record<string, string>; organigrammes?: Record<string, Record<string, unknown>> }
  const o = p?.organigrammes?.[p?.activites?.[activite.id] ?? '']
  if (!o) return []
  const ids: string[] = []
  for (const service of ['commercial', 'production', 'direction', 'gestion']) {
    for (const paire of (o[service] as [string, string][] | undefined) ?? []) if (!ids.includes(paire[1])) ids.push(paire[1])
  }
  return ids
}

/**
 * How well an entry answers the query: 0 when a word is missing, more when
 * the words are in the job title rather than in its sector or a poste.
 */
export function pertinence(
  entree: EntreeRecherchee,
  recherche: readonly string[],
  nomSecteur: (id: string) => string,
  postes: ReadonlyMap<string, readonly string[]>
): number {
  if (!recherche.length) return 1
  const titre = motsIndexes(entree.metier)
  const autour = motsIndexes(nomSecteur(entree.secteur), entree.secteur, ...(postes.get(entree.id) ?? []))
  let note = 0
  for (const m of recherche) {
    if (trouve(titre, m)) note += 3
    else if (trouve(autour, m)) note += 1
    else return 0
  }
  return note
}

/**
 * The activities a query names, best first: a whole name or alias, then a
 * word sharing its root with one (« imprimeur » → imprimerie). Generic job
 * words never name a trade.
 */
export function activitesNommees(texte: string, activites: readonly Activite[]): Activite[] {
  const q = motsDeLaRecherche(texte)
  if (!q.length || q.join('').length < 3) return []
  const phrase = ` ${q.join(' ')} `
  return activites
    .map((a) => {
      const noms = [a.nom, ...(a.alias ?? [])]
      let note = 0
      for (const n of noms) if (phrase.includes(` ${motsIndexes(n).filter((m) => !VIDES.has(m)).join(' ')} `)) note += 3
      const leurs = motsIndexes(...noms).filter((m) => m.length >= 3 && !VIDES.has(m))
      for (const m of q) if (trouve(leurs, m)) note += 1
      return { a, note }
    })
    .filter((x) => x.note > 0)
    .sort((x, y) => y.note - x.note || x.a.nom.localeCompare(y.a.nom, 'fr'))
    .map((x) => x.a)
}

/**
 * What « Embaucher » lists for a query: the métiers it names, best first;
 * then, when it names an activity, the staff of that trade, then every métier
 * that works there (its own branch before the functions every company has).
 */
export function metiersPourRecherche<E extends EntreeRecherchee>(
  catalogue: readonly E[],
  texte: string,
  nomSecteur: (id: string) => string,
  postes: ReadonlyMap<string, readonly string[]>,
  activite: Activite | null,
  personnel: unknown
): E[] {
  const q = motsDeLaRecherche(texte)
  if (!q.length) return [...catalogue]
  const notes = new Map<E, number>()
  for (const c of catalogue) {
    const n = pertinence(c, q, nomSecteur, postes)
    if (n > 0) notes.set(c, n)
  }
  const directs = [...notes.keys()].sort((a, b) => (notes.get(b) ?? 0) - (notes.get(a) ?? 0))
  if (!activite) return directs
  const pris = new Set<E>(directs)
  const parId = new Map(catalogue.map((c) => [c.id, c]))
  const coeur = coeurDeLActivite(activite, personnel)
    .map((id) => parId.get(id))
    .filter((c): c is E => !!c && !pris.has(c))
  coeur.forEach((c) => pris.add(c))
  const ailleurs = catalogue
    .filter((c) => !pris.has(c) && placeDansActivite(c, activite) != null)
    .sort((a, b) => (placeDansActivite(a, activite) ?? 2) - (placeDansActivite(b, activite) ?? 2))
  return [...directs, ...coeur, ...ailleurs]
}
