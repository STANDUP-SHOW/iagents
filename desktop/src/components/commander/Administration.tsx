import { Suspense, lazy } from 'react'

/**
 * Administration iAgent — the back-office screens, mounted as they are.
 *
 * The back-office is its own desktop application (`back-office/`, another
 * workstream). Its `Administration.jsx` depends only on the `client` it is
 * handed; here that client is `creerClientTauri(invoke)`, whose six commands
 * (`plateforme_appeler`, `jeton_*`, `adresse_*`) are thin wrappers in
 * `src-tauri/src/administration.rs` over the shared `iagent-back-office-admin`
 * crate. Nothing of the back-office is copied into desktop/.
 *
 * Reached only when `admin_present` answers true (an admin token is in the
 * keyring); the token itself never reaches JavaScript. Loaded lazily: a
 * workstation without that token never even downloads the back-office code.
 */
const BackOffice = lazy(async () => {
  const [{ default: Ecrans }, { creerClientTauri }, { invoke }] = await Promise.all([
    import('../../../../back-office/src/Administration.jsx'),
    import('../../../../back-office/src/api.js'),
    import('@tauri-apps/api/core'),
    import('../../../../back-office/src/charte.css'),
  ])
  const client = creerClientTauri(invoke)
  return { default: () => <Ecrans client={client} /> }
})

export default function Administration() {
  return (
    <div className="administration">
      <Suspense fallback={<p className="vide">Chargement de l'administration…</p>}>
        <BackOffice />
      </Suspense>
    </div>
  )
}
