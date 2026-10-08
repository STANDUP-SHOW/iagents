import type { Onglet } from '../components/Dashboard'

/**
 * The Desktop Commander navigation (brief of 08/10/2026, §2.2): ten modules in
 * the top bar, the Centre first. The modules that the platform plan added on
 * 07/10 (MASTER §14) are not dropped: each one lives as a sub-page of the
 * module it belongs to, so the top bar stays at ten and nothing is lost.
 */

export type Module = Exclude<Onglet, 'dashboard'> | 'dashboard'

export const MODULES: { id: Module; titre: string; sousTitre: string }[] = [
  { id: 'dashboard', titre: 'Centre', sousTitre: 'Vue orbitale de toute votre entreprise.' },
  { id: 'agents', titre: 'Vos agents', sousTitre: 'Vos collaborateurs, et tout ce qu’ils font, à inspecter.' },
  { id: 'travail', titre: 'Le travail du jour', sousTitre: 'Vos agents préparent, exécutent et vous soumettent les résultats. Gardez le contrôle.' },
  { id: 'embauche', titre: 'Embaucher', sousTitre: 'Trouvez le bon métier, rencontrez l’agent, il rejoint votre équipe.' },
  { id: 'connectors', titre: 'Vos connexions', sousTitre: 'Les outils, API et services que vos agents emploient.' },
  { id: 'navigateur', titre: 'Vos comptes', sousTitre: 'Les comptes ouverts dans le navigateur de vos agents.' },
  { id: 'courriel', titre: 'Courrier', sousTitre: 'Brouillons préparés, relus par vous, envoyés seulement avec votre accord.' },
  { id: 'voice', titre: 'Votre voix', sousTitre: 'Parlez naturellement à vos agents, dans la pièce comme au téléphone.' },
  { id: 'machine', titre: 'Votre machine', sousTitre: 'Votre Box, ce qu’elle porte, sa sécurité et sa consommation.' },
  { id: 'equipe', titre: 'Votre équipe', sousTitre: 'Le Task Commander et les agents qu’il tient.' },
]

/** Sub-pages of a module, the first one being the module itself. */
export const SOUS_PAGES: Partial<Record<Module, { id: Onglet; titre: string }[]>> = {
  travail: [
    { id: 'travail', titre: 'Mission control' },
    { id: 'validations', titre: 'Validations' },
  ],
  embauche: [
    { id: 'embauche', titre: 'Catalogue et entretien' },
    { id: 'create', titre: 'Créer sur mesure' },
  ],
  voice: [
    { id: 'voice', titre: 'Voice Hub' },
    { id: 'standard', titre: 'Standard et appels' },
  ],
  machine: [
    { id: 'machine', titre: 'Votre machine' },
    { id: 'box', titre: 'Box' },
    { id: 'consommation', titre: 'Consommation' },
    { id: 'securite', titre: 'Sécurité' },
  ],
  equipe: [
    { id: 'equipe', titre: 'Organigramme' },
    { id: 'workforce', titre: 'Workforce' },
  ],
}

/** The top-bar module an Onglet belongs to. */
export function moduleDe(onglet: Onglet): Module {
  for (const [m, pages] of Object.entries(SOUS_PAGES)) {
    if (pages?.some((p) => p.id === onglet)) return m as Module
  }
  return onglet === 'admin' ? 'machine' : (onglet as Module)
}

export const titreModule = (m: Module) => MODULES.find((x) => x.id === m)?.titre ?? ''
