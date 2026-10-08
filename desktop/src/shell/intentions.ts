import type { Onglet } from '../components/Dashboard'
import type { AgentInstalle } from '../agents/fiche'

/**
 * Where a command leads: a page, and what to select on it. The palette, the
 * Centre and (later) a spoken command all end up here, so the three paths
 * cannot drift apart (brief §16: the intent engine is shared with the voice).
 */
export interface Cible {
  onglet: Onglet
  /** An installed agent's first name, to select on the page. */
  agent?: string
  /** Text to put in the page's search field. */
  recherche?: string
  /** A card of the catalogue, to open in the hiring page. */
  ficheId?: string
  /** A ready-made filter of the task list. */
  filtre?: 'bloquees' | 'pretes' | 'controle'
}

const norme = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Plain-French intents. Returns null when the text is not one: the palette then just searches. */
export function comprendre(texte: string, installes: readonly AgentInstalle[]): { libelle: string; cible: Cible } | null {
  const t = norme(texte)
  if (t.length < 3) return null

  const agent = installes.find((a) => new RegExp(`\\b${norme(a.prenom)}\\b`).test(t))

  if (/\b(bloque|bloquees|bloquee|en attente|a completer)\b/.test(t) && /tache/.test(t)) {
    return { libelle: 'Voir les tâches qui attendent quelque chose de vous', cible: { onglet: 'travail', filtre: 'bloquees' } }
  }
  if (/\b(a valider|validation|a relire|sous controle)\b/.test(t)) {
    return { libelle: 'Voir les tâches sous contrôle et les validations', cible: { onglet: 'travail', filtre: 'controle' } }
  }
  if (/\b(courrier|mail|email|courriel)s?\b/.test(t)) {
    return agent
      ? { libelle: `Ouvrir le courrier de ${agent.prenom}`, cible: { onglet: 'agents', agent: agent.prenom } }
      : { libelle: 'Ouvrir le courrier', cible: { onglet: 'courriel' } }
  }
  if (/\b(standard|appel|telephone|appelle)\b/.test(t)) {
    return { libelle: 'Ouvrir le standard et les appels', cible: { onglet: 'standard' } }
  }
  const embauche = t.match(/\b(?:embauche[rz]?|recrute[rz]?|trouve[rz]?)\b(?: (?:un|une|des|le|la))? ?(.*)$/)
  if (embauche) {
    const quoi = embauche[1]?.replace(/^(agent|agents)\b ?/, '').trim()
    return {
      libelle: quoi ? `Chercher « ${quoi} » parmi les métiers à embaucher` : 'Embaucher un agent',
      cible: { onglet: 'embauche', recherche: quoi || undefined },
    }
  }
  if (agent && /\b(tache|travail|planning)s?\b/.test(t)) {
    return { libelle: `Voir le travail de ${agent.prenom}`, cible: { onglet: 'travail', agent: agent.prenom } }
  }
  if (agent && /\b(rapport|navigateur|connexion|profil|montre|ouvre)s?\b/.test(t)) {
    return { libelle: `Ouvrir la fiche de ${agent.prenom}`, cible: { onglet: 'agents', agent: agent.prenom } }
  }
  if (/\b(mes agents|vos agents|montre.* agents)\b/.test(t)) {
    return { libelle: 'Montrer vos agents', cible: { onglet: 'agents' } }
  }
  if (/\b(machine|box|memoire|securite)\b/.test(t)) {
    return { libelle: 'Ouvrir votre machine', cible: { onglet: 'machine' } }
  }
  return null
}
