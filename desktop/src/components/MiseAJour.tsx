import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

// Mirrors mise_a_jour::Etat (Rust field names, see CLAUDE.md).
type Etat = { version: string; prete: string | null; message: string }

/**
 * Says so when a new version is waiting for the agents to finish, or is being
 * installed. Nothing to click: the update never asks the client anything.
 * Silent the rest of the time.
 */
export default function MiseAJour() {
  const [etat, setEtat] = useState<Etat | null>(null)

  useEffect(() => {
    const lire = () => invoke<Etat>('mise_a_jour_etat').then(setEtat).catch(() => {})
    lire()
    const intervalle = setInterval(lire, 30_000)
    return () => clearInterval(intervalle)
  }, [])

  if (!etat?.prete) return null
  return (
    <span className="mise-a-jour" title={`Version installée : ${etat.version}`}>
      {etat.message.startsWith('installation')
        ? `Installation de la version ${etat.prete}…`
        : `Version ${etat.prete} prête : elle s'installera quand les agents auront fini`}
    </span>
  )
}
