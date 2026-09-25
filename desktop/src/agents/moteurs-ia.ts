/**
 * Ce que l'écran « Vos moteurs d'IA » montre, tiré de `catalogue/api-ia.json`.
 *
 * Le client ne voit pas 98 API mais les comptes à ouvrir : une clé OpenAI sert à
 * la fois GPT Image, Sora et la voix d'OpenAI. Chaque compte dit ce qu'il fait
 * (ses usages), où on le crée, et sous quel logo. Rien ici ne dit « branché » :
 * c'est `cles_ia_etat`, côté Rust, qui dit si une clé est rangée et si les agents
 * s'en servent.
 */
import catalogue from '../../../catalogue/api-ia.json'

export type Compte = {
  id: string
  nom: string
  site: string
  inscription: string
  logo: string | null
  apis: { id: string; nom: string; logo: string | null }[]
  usages: string[]
  priorite: string
}

/** Les filtres de l'écran, dans l'ordre où le client les lit. */
export const USAGES: { cle: string; libelle: string }[] = [
  { cle: 'llm', libelle: 'Texte' },
  { cle: 'llm-vision', libelle: 'Lecture d\'images' },
  { cle: 'image', libelle: 'Image' },
  { cle: 'video', libelle: 'Vidéo' },
  { cle: 'publicite', libelle: 'Publicité' },
  { cle: 'avatar', libelle: 'Avatar' },
  { cle: 'parole', libelle: 'Voix' },
  { cle: 'musique', libelle: 'Musique' },
  { cle: 'effets-sonores', libelle: 'Bruitages' },
  { cle: '3d', libelle: '3D' },
  { cle: 'traduction', libelle: 'Traduction' },
  { cle: 'document', libelle: 'Factures et formulaires' },
  { cle: 'recherche-web', libelle: 'Recherche web' },
  { cle: 'embeddings', libelle: 'Recherche dans vos documents' },
  { cle: 'retouche', libelle: 'Détourage' },
  { cle: 'synchro-labiale', libelle: 'Doublage' },
  { cle: 'agregateur', libelle: 'Plusieurs modèles, une clé' },
  { cle: 'plateforme-entreprise', libelle: 'Grands hébergeurs' },
]

export function comptes(): Compte[] {
  const rendu = Object.entries(catalogue.comptes).map(([id, c]) => {
    const apis = catalogue.apis.filter((a) => a.compte === id)
    return {
      id,
      nom: c.nom,
      site: c.site,
      inscription: c.inscription,
      logo: c.logo,
      apis: apis.map((a) => ({ id: a.id, nom: a.nom, logo: 'logo' in a ? (a.logo as string) : null })),
      usages: [...new Set(apis.flatMap((a) => [...a.familles, ...a.specialites]))],
      priorite: apis.map((a) => a.priorite).sort()[0] ?? 'P2',
    }
  })
  return rendu.sort((a, b) => a.priorite.localeCompare(b.priorite) || a.nom.localeCompare(b.nom, 'fr'))
}

/** Les comptes qui servent un usage et dont le nom (ou celui d'une API) contient la recherche. */
export function filtrer(liste: Compte[], usage: string | null, recherche: string): Compte[] {
  const r = recherche.trim().toLowerCase()
  return liste.filter(
    (c) =>
      (!usage || c.usages.includes(usage)) &&
      (!r || c.nom.toLowerCase().includes(r) || c.apis.some((a) => a.nom.toLowerCase().includes(r))),
  )
}

/** Deux lettres pour un éditeur sans logo libre de droits. */
export function initiales(nom: string): string {
  const mots = nom.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  return (mots.length > 1 ? mots[0][0] + mots[1][0] : nom.slice(0, 2)).toUpperCase()
}
