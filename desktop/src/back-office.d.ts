// The back-office is written in plain JSX (back-office/, its own workstream).
// These declarations give the Desktop Commander the one interface it relies on
// (see back-office/src/api.js and Administration.jsx), nothing more.

declare module '*/back-office/src/Administration.jsx' {
  import type { ComponentType } from 'react'
  const Administration: ComponentType<{ client: unknown }>
  export default Administration
}

declare module '*/back-office/src/api.js' {
  export function creerClientTauri(invoke: (commande: string, args?: Record<string, unknown>) => Promise<unknown>): unknown
}

declare module '*.css'
