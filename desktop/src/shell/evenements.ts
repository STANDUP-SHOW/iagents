import { useEffect, useState } from 'react'

/**
 * What happened on this workstation since the application opened, as the
 * activity feed shows it (brief §20: a readable projection of events).
 *
 * Only real events are published: a task launched or finished, an agent who
 * answered, a setting applied, an agent hired. Nothing is replayed from a
 * sample; an empty feed says that nothing has happened yet.
 */

export type Gravite = 'info' | 'succes' | 'alerte' | 'danger'

export interface Evenement {
  id: number
  type: 'tache' | 'voix' | 'equipe' | 'embauche' | 'courrier' | 'systeme'
  /** The agent's first name, when one is involved. */
  agent?: string
  texte: string
  /** Milliseconds since epoch. */
  date: number
  gravite: Gravite
}

type Ecouteur = (liste: readonly Evenement[]) => void

let suivant = 1
let liste: Evenement[] = []
const ecouteurs = new Set<Ecouteur>()

/** At most this many events are kept: the feed is a glance, the audit lives elsewhere. */
const GARDES = 60

export function publier(e: Omit<Evenement, 'id' | 'date'> & { date?: number }) {
  const ev: Evenement = { ...e, id: suivant++, date: e.date ?? Date.now() }
  liste = [ev, ...liste].sort((a, b) => b.date - a.date).slice(0, GARDES)
  ecouteurs.forEach((f) => f(liste))
}

/** Tasks running right now, so the Centre can light its links (brief §3.1, « Exécution »). */
let enCours = 0
const ecouteursExecution = new Set<(n: number) => void>()
export function debutExecution() {
  enCours += 1
  ecouteursExecution.forEach((f) => f(enCours))
}
export function finExecution() {
  enCours = Math.max(0, enCours - 1)
  ecouteursExecution.forEach((f) => f(enCours))
}

export function useEvenements(): readonly Evenement[] {
  const [l, setL] = useState<readonly Evenement[]>(liste)
  useEffect(() => {
    ecouteurs.add(setL)
    return () => {
      ecouteurs.delete(setL)
    }
  }, [])
  return l
}

export function useExecutions(): number {
  const [n, setN] = useState(enCours)
  useEffect(() => {
    ecouteursExecution.add(setN)
    return () => {
      ecouteursExecution.delete(setN)
    }
  }, [])
  return n
}

export function depuis(date: number, maintenant = Date.now()): string {
  const s = Math.max(0, Math.round((maintenant - date) / 1000))
  if (s < 60) return 'à l’instant'
  const m = Math.round(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
