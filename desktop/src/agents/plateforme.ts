import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * What the Box knows about the iAgent platform, as `plateforme.rs` sends it.
 *
 * Field names are the Rust ones (snake_case, no `rename_all`): written in
 * camelCase here they would come back `undefined`. `check-commandes.ts`
 * compares both files.
 */

export type Droit = {
  id: string
  agent_template_id: string
  specialisation_id: string | null
  licence: string
  fin: string | null
  /** Token v2: SHA-256 of the exact bytes of the agent's card. */
  empreinte_fiche: string | null
}

export type EtatLicence = {
  valide: boolean
  expire_le: string | null
  recu_le: string | null
  droits: Droit[]
  en_ligne: boolean
  motif: string
}

export type EtatPlateforme = {
  relie: boolean
  adresse: string | null
  device_id: string | null
  cle_plateforme_posee: boolean
  cle_publique_box: string | null
  /** X25519, raw 32 bytes in base64url: `cle_chiffrement_publique` at provisioning. */
  cle_chiffrement_publique: string | null
  licence: EtatLicence
  manque: string[]
}

/** What the screen learns about a Skill Pack opened in memory: never its content. */
export type SkillOuvert = {
  skill_pack_id: string
  version: string
  empreinte: string
  taille: number
}

export type Sante = {
  cpu: number | null
  memoire: number | null
  disque: number | null
  temperature: number | null
  version_desktop: string
}

/** The four handoff decisions, as the contract names them (`routes.md`). */
export const DECISIONS = [
  { decision: 'prendre', libelle: 'Prendre' },
  { decision: 'refuser', libelle: 'Refuser' },
  { decision: 'rappeler', libelle: 'Rappeler' },
  { decision: 'laisser', libelle: "Laisser l'agent continuer" },
] as const

/** A right that lets this agent run now, with the same rule as Rust's `droit_pour`. */
export function droitDe(etat: EtatPlateforme | null, ficheId: string, maintenant = new Date()): Droit | null {
  if (!etat?.licence.valide) return null
  return (
    etat.licence.droits.find(
      (d) => d.agent_template_id === ficheId && (d.fin == null || new Date(d.fin) > maintenant)
    ) ?? null
  )
}

export const dateFr = (iso: string | null | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export interface Lecture<T> {
  donnee: T | null
  erreur: string | null
  charge: boolean
  relire: () => void
}

/**
 * One command, read on mount and on demand. Nothing is ever shown in place of
 * a failed read: `donnee` stays null and `erreur` carries Rust's French reason.
 */
export function useCommande<T>(
  commande: string,
  actif = true,
  args?: Record<string, unknown>,
  toutesLesMs?: number
): Lecture<T> {
  const [donnee, setDonnee] = useState<T | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [charge, setCharge] = useState(false)
  const [tour, setTour] = useState(0)
  const relire = useCallback(() => setTour((t) => t + 1), [])
  const cle = JSON.stringify(args ?? {})

  useEffect(() => {
    if (!actif) return
    let vivant = true
    const lire = () => {
      setCharge(true)
      invoke<T>(commande, args)
        .then((d) => {
          if (!vivant) return
          setDonnee(d)
          setErreur(null)
        })
        .catch((e) => {
          if (!vivant) return
          setDonnee(null)
          setErreur(String(e))
        })
        .finally(() => vivant && setCharge(false))
    }
    lire()
    const minuterie = toutesLesMs ? setInterval(lire, toutesLesMs) : null
    return () => {
      vivant = false
      if (minuterie) clearInterval(minuterie)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commande, actif, cle, tour, toutesLesMs])

  return { donnee, erreur, charge, relire }
}

/** The link state, read without any network call. */
export function useEtatPlateforme(): Lecture<EtatPlateforme> {
  return useCommande<EtatPlateforme>('plateforme_etat')
}

/** The list the platform returns, whatever its wrapping (`[...]` or `{ appels: [...] }`). */
export function enListe(v: unknown, cles: string[] = []): unknown[] | null {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    for (const c of cles) {
      const x = (v as Record<string, unknown>)[c]
      if (Array.isArray(x)) return x
    }
    const tableaux = Object.values(v as Record<string, unknown>).filter(Array.isArray)
    if (tableaux.length === 1) return tableaux[0] as unknown[]
  }
  return null
}
