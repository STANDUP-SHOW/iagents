// Prepares a signed release for the automatic updates of the stations.
//
//   node version-signee.mjs config     -> writes src-tauri/tauri.version-signee.json
//                                         and prints its path, or prints nothing
//   node version-signee.mjs manifeste  -> writes mise-a-jour/ (installer, .sig,
//                                         latest.json) from the NSIS bundle
//
// Everything comes from the environment, set by build-windows-msi.yml on a
// tag only: the tag gives the version, GitHub secrets give the private key,
// GitHub variables give the public key and the address of latest.json.
// With none of them the build stays an ordinary unsigned build. With only
// some of them the script fails: a half-configured release would ship
// stations that look for updates they can never verify.

import { existsSync, mkdirSync, readdirSync, readFileSync, copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ici = fileURLToPath(new URL('.', import.meta.url))
const env = process.env

export function lireReglages(e = env) {
  const reglages = {
    tag: (e.GITHUB_REF ?? '').startsWith('refs/tags/') ? e.GITHUB_REF.slice('refs/tags/'.length) : '',
    cle: (e.TAURI_SIGNING_PRIVATE_KEY ?? '').trim(),
    clePublique: (e.IAGENT_MAJ_CLE_PUBLIQUE ?? '').trim(),
    adresse: (e.IAGENT_MAJ_ADRESSE ?? '').trim(),
  }
  const presents = ['cle', 'clePublique', 'adresse'].filter((k) => reglages[k] !== '')
  if (presents.length === 0 || reglages.tag === '') return null
  const noms = {
    cle: 'secret TAURI_SIGNING_PRIVATE_KEY',
    clePublique: 'variable IAGENT_MAJ_CLE_PUBLIQUE',
    adresse: 'variable IAGENT_MAJ_ADRESSE',
  }
  const manquants = Object.keys(noms).filter((k) => reglages[k] === '')
  if (manquants.length > 0) {
    throw new Error(
      `version signee a moitie configuree : il manque ${manquants.map((k) => noms[k]).join(', ')}`,
    )
  }
  const version = reglages.tag.replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`l'etiquette ${reglages.tag} n'est pas une version (attendu : v1.2.3)`)
  }
  if (!/^https:\/\/[^/?#@]+\/.*\.json$/.test(reglages.adresse)) {
    throw new Error(
      'IAGENT_MAJ_ADRESSE doit etre une adresse https vers le fichier latest.json, sans identifiant ni parametre',
    )
  }
  return { ...reglages, version }
}

export function configuration(r) {
  return {
    version: r.version,
    bundle: { createUpdaterArtifacts: true },
    plugins: { updater: { pubkey: r.clePublique, endpoints: [r.adresse] } },
  }
}

export function nomInstalleur(version) {
  return `iagent-desktop-${version}-setup.exe`
}

export function manifeste(r, signature, date = new Date()) {
  const base = r.adresse.slice(0, r.adresse.lastIndexOf('/') + 1)
  return {
    version: r.version,
    notes: '',
    pub_date: date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    platforms: {
      // NSIS installs per user: the update needs no administrator prompt,
      // which is what lets it run without anybody at the station.
      'windows-x86_64': { signature, url: base + nomInstalleur(r.version) },
    },
  }
}

function principal(mode) {
  const r = lireReglages()
  if (r === null) return
  if (mode === 'config') {
    const chemin = join(ici, 'src-tauri', 'tauri.version-signee.json')
    writeFileSync(chemin, JSON.stringify(configuration(r), null, 2))
    process.stdout.write(chemin)
    return
  }
  if (mode === 'manifeste') {
    const dossier = join(ici, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
    const exe = readdirSync(dossier).find((f) => f.endsWith('-setup.exe'))
    if (!exe || !existsSync(join(dossier, exe + '.sig'))) {
      throw new Error(`installeur ou signature introuvable dans ${dossier}`)
    }
    const sortie = join(ici, 'mise-a-jour')
    mkdirSync(sortie, { recursive: true })
    copyFileSync(join(dossier, exe), join(sortie, nomInstalleur(r.version)))
    const signature = readFileSync(join(dossier, exe + '.sig'), 'utf8').trim()
    writeFileSync(join(sortie, 'latest.json'), JSON.stringify(manifeste(r, signature), null, 2))
    return
  }
  throw new Error('usage : node version-signee.mjs config|manifeste')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv[2])
}
