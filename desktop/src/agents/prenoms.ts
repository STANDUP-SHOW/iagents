import table from '../config/prenoms.json' with { type: 'json' }
import type { Sexe } from './fiche.ts'

const sansAccents = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()

const HOMMES = new Set(table.homme)
const FEMMES = new Set(table.femme)

/**
 * The gender of a common first name, or nothing when the name is mixed or
 * unknown. Only the first word counts: « Jean-Marc » and « Marie Claire » are
 * read by their first part. The same table is read by `voix_api.rs`, so the
 * face and the voice cannot disagree.
 */
export function sexeDuPrenom(prenom: string): Sexe | undefined {
  const premier = sansAccents(prenom).split(/[\s-]+/)[0] ?? ''
  if (HOMMES.has(premier)) return 'homme'
  if (FEMMES.has(premier)) return 'femme'
  return undefined
}
