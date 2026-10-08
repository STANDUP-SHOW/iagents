/**
 * A client looks for agents by what his company does (« imprimerie ») as much
 * as by job (« comptable »). An activity (catalogue/activites.json) is the
 * client's branch; it becomes a pack added to the métier he hires, so a métier
 * is shown for an activity when it makes sense there.
 *
 * Where each family of métiers works is the judgement written in
 * outils/postes-possibles.ts (PR #35, the 182 490 postes): the functions every
 * company has go everywhere, except fiches written for one trade; the others
 * go to the activity families of their branch. Same table, same exceptions.
 */

export type Activite = { id: string; nom: string; famille: string; alias?: string[] }

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

export const sansAccents = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').trim()

/** 0 when the métier is of the activity's own branch, 1 when it is a function every company has, null when it does not work there. */
export function placeDansActivite(metier: { metier: string; secteur: string }, activite: Activite): 0 | 1 | null {
  if (PARTOUT.has(metier.secteur)) {
    if (!METIER_PROPRE.test(metier.metier)) return 1
    return PROPRE_VA.includes(activite.famille) ? 0 : null
  }
  return OU[metier.secteur]?.includes(activite.famille) ? 0 : null
}

/**
 * The activities a search names, best first: a whole word of the name or an
 * alias, then a beginning (« imprim » finds the printing house). Three letters
 * at least, so « co » does not light up half the list.
 */
export function activitesNommees(texte: string, activites: readonly Activite[]): Activite[] {
  const t = sansAccents(texte)
  if (t.length < 3) return []
  const notes = activites
    .map((a) => {
      const mots = [a.nom, ...(a.alias ?? [])].map(sansAccents)
      const note = mots.some((m) => m === t) ? 0 : mots.some((m) => m.split(/[\s-]+/).some((w) => w.startsWith(t))) ? 1 : mots.some((m) => m.includes(t)) ? 2 : 3
      return { a, note }
    })
    .filter((x) => x.note < 3)
    .sort((x, y) => x.note - y.note || x.a.nom.localeCompare(y.a.nom, 'fr'))
  return notes.map((x) => x.a)
}
