import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AgentInstalle } from '../agents/fiche'
import { travailDuJour } from '../agents/travail'

/**
 * Ce que l'application sait lire d'elle-même, pour le centre et pour le
 * bandeau de chiffres en tête de chaque page.
 *
 * Chaque valeur reste `null` tant que sa lecture n'a pas abouti : l'écran
 * affiche alors un tiret, jamais un chiffre supposé.
 */
export interface Lectures {
  metiers: number | null
  secteurs: number | null
  activites: number | null
  sites: number | null
  envois: number | null
  serveurs: { total: number; prets: number } | null
  cle: boolean | null
}

const VIDE: Lectures = {
  metiers: null,
  secteurs: null,
  activites: null,
  sites: null,
  envois: null,
  serveurs: null,
  cle: null,
}

/** Relit tout à chaque changement de `cle` (l'onglet ouvert) : un envoi ou un compte ajouté se voit au retour. */
export function useLectures(cle: string): Lectures {
  const [lu, setLu] = useState<Lectures>(VIDE)

  useEffect(() => {
    let vivant = true
    const poser = (p: Partial<Lectures>) => vivant && setLu((l) => ({ ...l, ...p }))

    invoke<string>('lire_referentiel', { nom: 'catalogue' })
      .then((brut) => {
        const agents: { secteur?: string }[] = JSON.parse(brut).agents ?? []
        poser({ metiers: agents.length, secteurs: new Set(agents.map((a) => a.secteur)).size })
      })
      .catch(() => {})
    invoke<string>('lire_referentiel', { nom: 'activites' })
      .then((brut) => poser({ activites: (JSON.parse(brut).activites ?? []).length }))
      .catch(() => {})
    invoke<unknown[]>('navigateur_sites')
      .then((l) => poser({ sites: l.length }))
      .catch(() => {})
    invoke<unknown[]>('courriel_envois')
      .then((l) => poser({ envois: l.length }))
      .catch(() => {})
    invoke<{ pret: boolean }[]>('mcp_serveurs')
      .then((l) => poser({ serveurs: { total: l.length, prets: l.filter((s) => s.pret).length } }))
      .catch(() => {})
    invoke<boolean>('cle_api_presente')
      .then((c) => poser({ cle: c }))
      .catch(() => {})

    return () => {
      vivant = false
    }
  }, [cle])

  return lu
}

/** Le travail du jour, compté sur les agents installés, avec la même règle que la page. */
export function useTravail(installes: readonly AgentInstalle[]) {
  return useMemo(() => {
    const toutes = installes.flatMap((a) => travailDuJour(a))
    return {
      total: toutes.length,
      pretes: toutes.filter((t) => !t.empechement).length,
      sansMatiere: toutes.filter((t) => !t.empechement && t.sansMatiere).length,
    }
  }, [installes])
}

export const tiret = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('fr-FR'))

export interface Chiffre {
  valeur: string
  libelle: string
  ton?: 'alerte' | 'danger' | 'succes'
}

/** Le bandeau de chiffres en tête de page. */
export function BandeauChiffres({ chiffres }: { chiffres: Chiffre[] }) {
  if (!chiffres.length) return null
  return (
    <div className="bandeau-chiffres">
      {chiffres.map((c) => (
        <div key={c.libelle} className={`chiffre${c.ton ? ` ton-${c.ton}` : ''}`}>
          <span className="chiffre-valeur">{c.valeur}</span>
          <span className="chiffre-libelle">{c.libelle}</span>
        </div>
      ))}
    </div>
  )
}
