import type { ReactNode } from 'react'

/**
 * Administration iAgent — MOUNTING POINT, deliberately empty.
 *
 * The back-office is a separate desktop application (`back-office/`, another
 * workstream). Max wants it to couple to the Desktop Commander: its screens
 * will be plugged in HERE when the two are assembled. Nothing of the
 * back-office is copied into this repository folder.
 *
 * How it is reached: the navigation shows this space only when `admin_present`
 * (plateforme.rs) answers true, i.e. when an administration key is stored in
 * the system keyring (`iagent-admin` / `back-office`). The key itself never
 * crosses to JavaScript: only the boolean does.
 *
 * To mount: pass the back-office root component as `ecrans`. Nothing else in
 * the Commander depends on what is mounted here.
 */
export default function Administration({ ecrans }: { ecrans?: ReactNode }) {
  return (
    <div className="page commander">
      <h2 className="titre-neon">Administration iAgent</h2>
      {ecrans ?? (
        <p className="sans-source">
          Une clé d'administration est présente sur ce poste, mais aucun écran du back-office n'est encore branché ici.
          Ils le seront à l'assemblage avec l'application back-office.
        </p>
      )}
    </div>
  )
}
