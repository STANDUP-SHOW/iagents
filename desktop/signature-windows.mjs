// Signs the Windows installers with Azure Artifact Signing, so that Windows
// knows who published them (SmartScreen, "Windows protected your PC").
//
//   node signature-windows.mjs actif          -> exit 0 when signing is configured
//   node signature-windows.mjs config [base]  -> writes src-tauri/tauri.signature.json
//                                                (base merged in) and prints its path;
//                                                prints base unchanged when not configured
//
// Everything comes from the environment, set by build-windows-msi.yml on a tag
// only: GitHub secrets give the App Registration allowed to sign, GitHub
// variables give the signing account. With none of them the build stays
// unsigned, as today. With only some of them the script fails and names what
// is missing: a release believed signed and shipped unsigned is worse than a
// release known unsigned. See desktop/SIGNATURE-WINDOWS.md.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ici = fileURLToPath(new URL('.', import.meta.url))

const NOMS = {
  client: 'secret AZURE_CLIENT_ID',
  secret: 'secret AZURE_CLIENT_SECRET',
  tenant: 'secret AZURE_TENANT_ID',
  point: 'variable IAGENT_SIGNATURE_POINT',
  compte: 'variable IAGENT_SIGNATURE_COMPTE',
  profil: 'variable IAGENT_SIGNATURE_PROFIL',
}

export function lireSignature(e = process.env) {
  const r = {
    tag: (e.GITHUB_REF ?? '').startsWith('refs/tags/'),
    client: (e.AZURE_CLIENT_ID ?? '').trim(),
    secret: (e.AZURE_CLIENT_SECRET ?? '').trim(),
    tenant: (e.AZURE_TENANT_ID ?? '').trim(),
    point: (e.IAGENT_SIGNATURE_POINT ?? '').trim().replace(/\/$/, ''),
    compte: (e.IAGENT_SIGNATURE_COMPTE ?? '').trim(),
    profil: (e.IAGENT_SIGNATURE_PROFIL ?? '').trim(),
  }
  const presents = Object.keys(NOMS).filter((k) => r[k] !== '')
  // Every signature is billed against the monthly quota: pull requests stay unsigned.
  if (presents.length === 0 || !r.tag) return null
  const manquants = Object.keys(NOMS).filter((k) => r[k] === '')
  if (manquants.length > 0) {
    throw new Error(
      `signature Windows a moitie configuree : il manque ${manquants.map((k) => NOMS[k]).join(', ')}`,
    )
  }
  if (!/^https:\/\/[a-z0-9]+\.codesigning\.azure\.net$/.test(r.point)) {
    throw new Error(
      'IAGENT_SIGNATURE_POINT doit etre le point de terminaison du compte, par exemple https://weu.codesigning.azure.net',
    )
  }
  // Both names end up in a command line: letters, digits and hyphens only.
  for (const k of ['compte', 'profil']) {
    if (!/^[A-Za-z0-9-]{3,64}$/.test(r[k])) {
      throw new Error(`${NOMS[k]} ne doit contenir que des lettres, des chiffres et des tirets`)
    }
  }
  return r
}

export function commandeDeSignature(r) {
  return `artifact-signing-cli -e ${r.point} -a ${r.compte} -c ${r.profil} -d iAgent %1`
}

// Merged by hand rather than by passing two --config: one file, one source of
// what the release was built with.
export function fusionner(base, r) {
  const conf = structuredClone(base ?? {})
  conf.bundle ??= {}
  conf.bundle.windows ??= {}
  conf.bundle.windows.signCommand = commandeDeSignature(r)
  return conf
}

function principal(mode, base) {
  const r = lireSignature()
  if (mode === 'actif') {
    process.exit(r === null ? 1 : 0)
  }
  if (mode === 'config') {
    if (r === null) {
      process.stdout.write(base ?? '')
      return
    }
    const existante = base && existsSync(base) ? JSON.parse(readFileSync(base, 'utf8')) : {}
    const chemin = join(ici, 'src-tauri', 'tauri.signature.json')
    writeFileSync(chemin, JSON.stringify(fusionner(existante, r), null, 2))
    process.stdout.write(chemin)
    return
  }
  throw new Error('usage : node signature-windows.mjs actif|config [base]')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv[2], process.argv[3])
}
