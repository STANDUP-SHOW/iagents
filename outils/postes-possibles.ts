/**
 * Combien de postes le catalogue sait composer : un métier (une fiche de `agents/`)
 * posé dans une activité cliente (`catalogue/activites.json`). C'est ainsi que max
 * veut que l'on compte (06/10/2026) : « Julie assistante commerciale » n'est pas un
 * agent, c'est un métier ; Julie pour une imprimerie, Julie pour un transitaire en
 * douane, Julie pour un cabinet vétérinaire sont trois postes.
 *
 * Toutes les combinaisons n'ont pas de sens : un agent de réparation automobile ne
 * travaille pas dans une crèche. La table ci-dessous dit, par famille de métiers (le
 * champ `secteur` des fiches), dans quelles familles d'activités le métier s'exerce.
 * Les fonctions que toute entreprise possède (administration, comptabilité, RH,
 * ventes, achats…) vont partout, sauf les fiches écrites pour un seul métier
 * (« assistant médical administratif »), qui restent dans leur branche, comme dans
 * `frontend/seo/generer.mjs`. C'est un jugement écrit, à relire : changer une ligne
 * change le total, et le script l'imprime.
 *
 *   node --experimental-strip-types outils/postes-possibles.ts
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = join(import.meta.dirname, '..')
const fiches: { nom: string; secteur: string }[] = readdirSync(join(RACINE, 'agents'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(RACINE, 'agents', f), 'utf8')))
const activites: { famille: string }[] = JSON.parse(readFileSync(join(RACINE, 'catalogue/activites.json'), 'utf8')).activites

const parFamille = new Map<string, number>()
for (const a of activites) parFamille.set(a.famille, (parFamille.get(a.famille) ?? 0) + 1)

const PARTOUT = new Set([
  'administration', 'comptabilite', 'finance', 'ressources-humaines', 'commercial', 'achats', 'marketing',
  'communication', 'informatique', 'data', 'cybersecurite', 'productivite-entreprise', 'support-client-specialise',
  'juridique', 'audit', 'recrutement', 'conseil',
])
const METIER_PROPRE = /immobilier|médical|juridique|cabinet de recrutement/i
const PROPRE_VA = ['finance-immobilier', 'services-entreprises', 'sante-social']

const OU: Record<string, string[]> = {
  banque: ['finance-immobilier'],
  assurance: ['finance-immobilier'],
  immobilier: ['finance-immobilier', 'batiment'],
  'services-juridiques-immobiliers': ['finance-immobilier', 'services-entreprises'],
  'gestion-de-patrimoine-services': ['finance-immobilier'],
  logistique: ['industrie', 'negoce-gros', 'commerce-detail', 'transport-logistique', 'agriculture', 'environnement-energie', 'automobile-mobilite', 'artisanat'],
  transport: ['transport-logistique', 'negoce-gros', 'industrie', 'environnement-energie', 'automobile-mobilite'],
  'e-commerce': ['commerce-detail', 'negoce-gros', 'artisanat', 'industrie', 'agriculture', 'numerique-audiovisuel'],
  'industrie-back-office': ['industrie', 'environnement-energie', 'agriculture', 'automobile-mobilite'],
  'btp-gestion': ['batiment'],
  'energie-environnement': ['environnement-energie', 'batiment', 'industrie'],
  'reparation-automobile': ['automobile-mobilite'],
  'hotellerie-restauration': ['hotellerie-tourisme'],
  tourisme: ['hotellerie-tourisme'],
  evenementiel: ['hotellerie-tourisme', 'services-entreprises', 'public-associatif'],
  'sante-administratif': ['sante-social', 'public-associatif'],
  'immigration-voyage-administratif': ['hotellerie-tourisme', 'services-entreprises', 'public-associatif'],
  'associations-administration': ['public-associatif'],
  'jardinage-paysagisme': ['batiment', 'agriculture'],
  'nettoyage-services': ['services-entreprises', 'environnement-energie'],
  'artisans-services': ['artisanat', 'batiment'],
  'formation-education': ['services-entreprises', 'public-associatif', 'numerique-audiovisuel'],
  traduction: ['services-entreprises', 'numerique-audiovisuel', 'negoce-gros'],
  design: ['numerique-audiovisuel', 'services-entreprises', 'industrie', 'commerce-detail', 'artisanat'],
  'photo-video-audio': ['numerique-audiovisuel', 'services-entreprises', 'hotellerie-tourisme', 'artisanat'],
  publicite: ['services-entreprises', 'numerique-audiovisuel', 'commerce-detail'],
  'edition-recherche-contenu': ['numerique-audiovisuel', 'services-entreprises', 'public-associatif'],
}

const somme = (familles: string[]) => familles.reduce((n, f) => n + (parFamille.get(f) ?? 0), 0)
let total = 0
let partout = 0
const sansPlace: string[] = []
for (const f of fiches) {
  if (PARTOUT.has(f.secteur) && !METIER_PROPRE.test(f.nom)) { total += activites.length; partout++ }
  else if (PARTOUT.has(f.secteur)) total += somme(PROPRE_VA)
  else if (OU[f.secteur]) total += somme(OU[f.secteur])
  else sansPlace.push(`${f.secteur} : ${f.nom}`)
}
if (sansPlace.length) throw new Error(`Famille de métiers sans place dans la table :\n${sansPlace.join('\n')}`)

const familles = new Set(fiches.map((f) => f.secteur)).size
const fr = (n: number) => n.toLocaleString('fr-FR')
console.log(`${fr(fiches.length)} métiers en ${familles} familles, ${fr(activites.length)} activités en ${parFamille.size} familles`)
console.log(`${fr(partout)} métiers exercés dans toute entreprise, ${fr(fiches.length - partout)} propres à une branche`)
console.log(`postes possibles (métier × activité qui a du sens) : ${fr(total)}`)
console.log(`toutes combinaisons, sans tri : ${fr(fiches.length * activites.length)}`)
