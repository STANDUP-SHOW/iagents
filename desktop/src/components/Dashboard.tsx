import type { ReactNode } from 'react'

/**
 * The pages of the application, their titles and their icons. The Centre
 * itself now lives in `pages/Centre.tsx` (Desktop Commander brief, 08/10/2026).
 *
 * The rule the old round dashboard carried still holds everywhere: every figure
 * is read, and a failed read shows a dash, never an invented number. Only demo
 * mode shows an example, and its ribbon says so.
 */

export type Onglet =
  | 'dashboard'
  | 'agents'
  | 'voice'
  | 'connectors'
  | 'navigateur'
  | 'courriel'
  | 'embauche'
  | 'travail'
  | 'machine'
  | 'equipe'
  // Desktop Commander modules (MASTER §14)
  | 'workforce'
  | 'standard'
  | 'create'
  | 'box'
  | 'validations'
  | 'consommation'
  | 'securite'
  // Hidden unless an admin key is in the keyring (admin_present).
  | 'admin'

export const ICONES: Record<Exclude<Onglet, 'dashboard'>, ReactNode> = {
  agents: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  travail: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16M8.5 15l2.2 2.2L15.5 13" />
    </>
  ),
  embauche: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3 20c0-3.9 3.1-7 7-7 1.4 0 2.7.4 3.8 1.1M18 14v6M15 17h6" />
    </>
  ),
  connectors: (
    <>
      <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5" />
    </>
  ),
  navigateur: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5S9.5 5.8 12 3.5z" />
    </>
  ),
  courriel: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  equipe: (
    <>
      <circle cx="12" cy="7" r="3" />
      <circle cx="5" cy="10" r="2.2" />
      <circle cx="19" cy="10" r="2.2" />
      <path d="M7 20c0-2.8 2.2-5 5-5s5 2.2 5 5M1.5 18c0-2 1.6-3.6 3.5-3.6M22.5 18c0-2-1.6-3.6-3.5-3.6" />
    </>
  ),
  machine: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M9.5 9.5h5v5h-5z" />
    </>
  ),
  workforce: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  standard: (
    <>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </>
  ),
  create: (
    <>
      <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" />
    </>
  ),
  box: (
    <>
      <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5l9 4.5 9-4.5M12 12v9" />
    </>
  ),
  validations: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </>
  ),
  consommation: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  securite: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2.5" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
}

export const TITRES: Record<Exclude<Onglet, 'dashboard'>, string> = {
  agents: 'Vos agents',
  travail: 'Le travail du jour',
  embauche: 'Embaucher',
  connectors: 'Vos connexions',
  navigateur: 'Vos comptes',
  courriel: 'Courrier',
  voice: 'Votre voix',
  machine: 'Votre machine',
  equipe: 'Votre équipe',
  workforce: 'Workforce',
  standard: 'Standard et appels',
  create: 'iAgent Create',
  box: 'Box',
  validations: 'Validations',
  consommation: 'Consommation',
  securite: 'Sécurité',
  admin: 'Administration iAgent',
}

/** The Desktop Commander modules (§14), listed beside the centre. */
export const MODULES_COMMANDER: Exclude<Onglet, 'dashboard'>[] = [
  'workforce',
  'standard',
  'create',
  'box',
  'validations',
  'consommation',
  'securite',
]

export function Icone({ onglet }: { onglet: Exclude<Onglet, 'dashboard'> }) {
  return (
    <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
      {ICONES[onglet]}
    </svg>
  )
}
