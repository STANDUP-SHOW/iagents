/**
 * Le registre d'inscription d'iAgent et les consignes qui en partent.
 *
 * Ce qu'un agent colle sur un réseau est public dès qu'il clique : un texte
 * trop long coupé par la plateforme, une image citée qui n'existe pas, un
 * « [À CONFIRMER] » parti tel quel, ou LinkedIn confié à un agent ne se
 * rattrapent qu'en repassant derrière lui. Le banc relit donc le registre, la
 * liste des images compilées dans l'application et la consigne réellement
 * produite pour chaque plateforme.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { REGISTRE, consigneInscription, infosParDefaut, INFOS, identifiantsEssayes } from './src/inscriptions/consigne.ts'

const ici = import.meta.dirname
let fautes = 0
const faute = (m: string) => {
  console.log(`  ✗ ${m}`)
  fautes += 1
}

const P = REGISTRE.plateformes
if (P.length !== 35) faute(`le registre de max compte 35 plateformes, celui-ci ${P.length}`)
if (new Set(P.map((p) => p.id)).size !== P.length) faute('deux plateformes portent le même identifiant')
for (const p of P) {
  if (!REGISTRE.etapes.includes(p.etape)) faute(`${p.nom} : étape « ${p.etape} » absente du planning`)
  if (!/^https:\/\//.test(p.adresse)) faute(`${p.nom} : page de départ sans https (${p.adresse})`)
  if (p.textes.length === 0) faute(`${p.nom} : aucun texte`)
  if (p.mode !== 'agent' && !p.raison) faute(`${p.nom} : ni agent ni raison dite`)
  if (p.dependDe && !P.some((x) => x.id === p.dependDe)) faute(`${p.nom} dépend de ${p.dependDe}, absent du registre`)
}

// LinkedIn n'est jamais piloté : le même refus que celui du code, lu chez lui.
const mission = readFileSync(join(ici, 'src-tauri/src/mission.rs'), 'utf8')
const interdits = [...(mission.match(/DOMAINES_INTERDITS: \[&str; \d+\] = \[([^\]]*)\]/)?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1])
if (!interdits.length) faute('DOMAINES_INTERDITS introuvable dans mission.rs')
for (const p of P) {
  const hote = new URL(p.adresse).hostname
  if (p.mode === 'agent' && interdits.some((d) => hote === d || hote.endsWith(`.${d}`)))
    faute(`${p.nom} est confié à un agent alors que ${hote} lui est interdit`)
}
if (P.find((p) => p.id === 'linkedin')?.mode !== 'dirigeant') faute('LinkedIn doit rester au dirigeant')

// Chaque texte tient dans son plafond, compté comme un formulaire le compte
// (caractères) et comme Excel le compte (unités UTF-16 : un émoji vaut 2).
for (const p of P) {
  for (const t of [...p.textes.map((t) => t.texte), p.premierMessage?.texte ?? '']) {
    if (/\[[^\]]*(CONFIRMER|À AJOUTER|À RENSEIGNER)/i.test(t)) faute(`${p.nom} : un texte porte encore un champ à compléter`)
  }
  for (const t of p.textes) {
    if (t.plafond && (t.texte.length > t.plafond || [...t.texte].length > t.plafond))
      faute(`${p.nom} / ${t.champ} : ${t.texte.length} caractères pour un plafond de ${t.plafond}`)
  }
}

// Les images : celles que le registre cite, celles du dossier, celles que le
// binaire embarque. Les trois listes doivent coïncider.
const dossier = readdirSync(join(ici, 'src/inscriptions/visuels')).sort()
const rs = readFileSync(join(ici, 'src-tauri/src/inscriptions.rs'), 'utf8')
const embarques = [...rs.matchAll(/\("([^"]+)", include_bytes!\("\.\.\/\.\.\/src\/inscriptions\/visuels\/([^"]+)"\)\)/g)]
for (const [, nom, fichier] of embarques) if (nom !== fichier) faute(`inscriptions.rs pose ${nom} avec le contenu de ${fichier}`)
const noms = embarques.map((m) => m[1]).sort()
if (JSON.stringify(noms) !== JSON.stringify(dossier)) faute(`images embarquées ${noms.join(', ')} ≠ dossier ${dossier.join(', ')}`)
for (const p of P) {
  for (const f of [p.avatar, p.banniere].filter(Boolean) as string[]) if (!noms.includes(f)) faute(`${p.nom} cite ${f}, que l'application ne pose pas`)
}

// La consigne réellement envoyée.
const vides = Object.fromEntries(INFOS.map((i) => [i.cle, ''])) as ReturnType<typeof infosParDefaut>
for (const p of P) {
  if (p.mode !== 'agent') {
    let refuse = false
    try {
      consigneInscription(p, infosParDefaut(), false)
    } catch {
      refuse = true
    }
    if (!refuse) faute(`${p.nom} (${p.mode}) produit quand même une consigne d'agent`)
    continue
  }
  const c = consigneInscription(p, infosParDefaut(), false)
  if (!c.includes(p.adresse)) faute(`${p.nom} : la consigne ne donne pas la page de départ`)
  for (const t of p.textes) if (!c.includes(t.texte)) faute(`${p.nom} / ${t.champ} : le texte n'est pas recopié tel quel`)
  if (!c.includes(p.avatar)) faute(`${p.nom} : l'avatar n'est pas cité`)
  if (p.banniere && !c.includes(p.banniere)) faute(`${p.nom} : la bannière n'est pas citée`)
  if (!c.includes('saisir_mot_de_passe')) faute(`${p.nom} : la consigne ne dit pas comment poser le mot de passe`)
  if (!identifiantsEssayes(p).every((i) => c.includes(`« ${i} »`))) faute(`${p.nom} : identifiants de repli absents`)
  if (p.premierMessage) {
    if (!c.includes('Ne le publiez pas')) faute(`${p.nom} : sans accord, le premier message doit rester non publié`)
    if (!consigneInscription(p, infosParDefaut(), true).includes('demande de le publier'))
      faute(`${p.nom} : la publication demandée n'est pas transmise`)
  }
  const sansRien = consigneInscription(p, vides, false)
  if (/: \./.test(sansRien) || !sansRien.includes('demandez-le au dirigeant')) faute(`${p.nom} : une information vide n'est pas dite comme telle`)
}

if (fautes) {
  console.log(`check-inscriptions : ${fautes} faute(s)`)
  process.exit(1)
}
const parMode = (m: string) => P.filter((p) => p.mode === m).length
console.log(
  `check-inscriptions : ${P.length} plateformes (${parMode('agent')} par un agent, ${parMode('dirigeant')} au dirigeant, ${parMode('plus-tard')} plus tard), ${P.reduce((n, p) => n + p.textes.length, 0)} textes dans leurs plafonds, ${noms.length} images embarquées`,
)
