import type { AgentInstalle, Sexe } from '../agents/fiche'

/**
 * max's portraits (08/10/2026), the same files and the same rule as the site
 * (frontend/src/data/recherche.js `portraitDe`), so a profile shows the same
 * face on iagent.agency and in the application.
 *
 * - public/portraits/agents/a001..a428.webp: the library bank, one per fiche.
 * - public/portraits/equipe/v001..v025.webp: the 25 featured iAgent portraits,
 *   given to the agents a client has actually hired.
 */
export const NOMBRE_DE_PORTRAITS = 428

/** The fiche's number picks its face; 37 is prime to 428, so neighbours differ. */
export const portraitDeFiche = (ficheId: string) => {
  const n = parseInt(String(ficheId).slice(3), 10) || 0
  return `/portraits/agents/a${String(((n * 37) % NOMBRE_DE_PORTRAITS) + 1).padStart(3, '0')}.webp`
}

const vedette = (n: number) => `/portraits/equipe/v${String(n).padStart(3, '0')}.webp`

/** The site's named agents keep their face here too. */
const NOMMES: Record<string, number> = { julie: 20, thomas: 12, samir: 6, lea: 7, marco: 1, elise: 22, victor: 21 }

/** The featured portraits by the presentation of the face, read on max's sheet. */
const VEDETTES: Record<Sexe, number[]> = {
  femme: [2, 4, 5, 7, 11, 13, 15, 17, 20, 22, 25],
  homme: [1, 3, 6, 8, 9, 10, 12, 14, 16, 18, 19, 21, 23, 24],
}

const sansAccents = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const empreinte = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/**
 * The face of a hired agent. A photo the client gave wins when the window can
 * load it; then the site's named agents; then a featured portrait matching the
 * gender chosen at hiring; else the fiche's own portrait from the bank.
 */
export function portraitDe(a: Pick<AgentInstalle, 'prenom' | 'photo' | 'sexe'> & { fiche: { id: string } }): string {
  if (a.photo && /^(https?:|data:|\/portraits\/)/.test(a.photo)) return a.photo
  const nom = sansAccents(a.prenom)
  if (NOMMES[nom]) return vedette(NOMMES[nom])
  if (a.sexe) {
    const pool = VEDETTES[a.sexe]
    return vedette(pool[empreinte(nom) % pool.length])
  }
  return portraitDeFiche(a.fiche.id)
}

/** The featured faces offered at hiring: those of the chosen gender, or all 25. */
export const visagesProposes = (sexe: Sexe | '') =>
  (sexe ? [...VEDETTES[sexe]] : Array.from({ length: 25 }, (_, i) => i + 1)).map(vedette)
