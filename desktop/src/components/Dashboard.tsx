import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AgentInstalle } from '../agents/fiche'
import type { Jauge } from '../agents/jauge'
import { travailDuJour } from '../agents/travail'
import puce from '../assets/marque/puce-cerveau.png'

/**
 * Le tableau de bord en rond : le noyau animé au centre, les menus qui
 * gravitent autour, chacun menant à sa page.
 *
 * Chaque satellite porte un chiffre, et chaque chiffre est lu : dans les agents
 * installés, dans la jauge calculée en Rust, ou dans ce que les commandes de
 * l'application renvoient. Quand une lecture échoue, le satellite affiche un
 * tiret : un chiffre inventé sur un tableau de bord se croit, et c'est pire
 * qu'un trou.
 */

export type Onglet =
  | 'dashboard'
  | 'agents'
  | 'voice'
  | 'connectors'
  | 'navigateur'
  | 'courriel'
  | 'embauche'
  | 'travail'
  | 'machine'

interface Props {
  agents: { id: string; status: string }[]
  installes: readonly AgentInstalle[]
  isListening: boolean
  isProcessing: boolean
  motifEcoute: string | null
  jauge: Jauge | null
  onOuvrir: (onglet: Onglet) => void
}

interface Lectures {
  metiers: number | null
  sites: number | null
  envois: number | null
  serveurs: { total: number; prets: number } | null
  cle: boolean | null
}

const NIVEAUX: Record<string, string> = {
  confortable: 'Confortable',
  chargee: 'Chargée',
  saturee: 'Saturée',
  impossible: 'Trop juste',
  'memoire-seule': 'Charge non jugée',
}

export const ICONES: Record<Exclude<Onglet, 'dashboard'>, ReactNode> = {
  agents: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  travail: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16M8.5 15l2.2 2.2L15.5 13" />
    </>
  ),
  embauche: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3 20c0-3.9 3.1-7 7-7 1.4 0 2.7.4 3.8 1.1M18 14v6M15 17h6" />
    </>
  ),
  connectors: (
    <>
      <path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5" />
    </>
  ),
  navigateur: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.2 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.2-3.8-8.5S9.5 5.8 12 3.5z" />
    </>
  ),
  courriel: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  machine: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M9.5 9.5h5v5h-5z" />
    </>
  ),
}

export const TITRES: Record<Exclude<Onglet, 'dashboard'>, string> = {
  agents: 'Vos agents',
  travail: 'Le travail du jour',
  embauche: 'Embaucher',
  connectors: 'Vos connexions',
  navigateur: 'Vos comptes',
  courriel: 'Courrier',
  voice: 'Votre voix',
  machine: 'Votre machine',
}

export function Icone({ onglet }: { onglet: Exclude<Onglet, 'dashboard'> }) {
  return (
    <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
      {ICONES[onglet]}
    </svg>
  )
}

const tiret = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('fr-FR'))

export default function Dashboard({
  agents,
  installes,
  isListening,
  isProcessing,
  motifEcoute,
  jauge,
  onOuvrir,
}: Props) {
  const [lu, setLu] = useState<Lectures>({
    metiers: null,
    sites: null,
    envois: null,
    serveurs: null,
    cle: null,
  })
  const [maintenant, setMaintenant] = useState(() => new Date())

  useEffect(() => {
    let vivant = true
    const poser = (p: Partial<Lectures>) => vivant && setLu((l) => ({ ...l, ...p }))

    invoke<string>('lire_referentiel', { nom: 'catalogue' })
      .then((brut) => poser({ metiers: (JSON.parse(brut).agents ?? []).length }))
      .catch(() => {})
    invoke<unknown[]>('navigateur_sites')
      .then((l) => poser({ sites: l.length }))
      .catch(() => {})
    invoke<unknown[]>('courriel_envois')
      .then((l) => poser({ envois: l.length }))
      .catch(() => {})
    invoke<{ pret: boolean }[]>('mcp_serveurs')
      .then((l) => poser({ serveurs: { total: l.length, prets: l.filter((s) => s.pret).length } }))
      .catch(() => {})
    invoke<boolean>('cle_api_presente')
      .then((cle) => poser({ cle }))
      .catch(() => {})

    const horloge = setInterval(() => setMaintenant(new Date()), 30_000)
    return () => {
      vivant = false
      clearInterval(horloge)
    }
  }, [])

  const actifs = agents.filter((a) => a.status === 'active').length

  const travail = useMemo(() => {
    const toutes = installes.flatMap((a) => travailDuJour(a))
    return { total: toutes.length, pretes: toutes.filter((t) => !t.empechement).length }
  }, [installes])

  const etat = isProcessing ? 'reflexion' : isListening ? 'ecoute' : 'repos'
  const etatTexte = { reflexion: 'Réflexion', ecoute: "À l'écoute", repos: 'Prêt' }[etat]

  const satellites: { onglet: Exclude<Onglet, 'dashboard'>; valeur: string; detail: string; ton?: string }[] = [
    {
      onglet: 'agents',
      valeur: tiret(agents.length),
      detail: actifs ? `${actifs} actif${actifs > 1 ? 's' : ''}` : agents.length ? 'aucun actif' : 'aucun installé',
    },
    {
      onglet: 'travail',
      valeur: tiret(travail.pretes),
      detail: travail.total ? `tâche${travail.pretes > 1 ? 's' : ''} prête${travail.pretes > 1 ? 's' : ''} sur ${travail.total}` : 'aucune tâche allumée',
    },
    {
      onglet: 'embauche',
      valeur: tiret(lu.metiers),
      detail: 'métiers au catalogue',
    },
    {
      onglet: 'connectors',
      valeur: lu.serveurs ? `${lu.serveurs.prets}/${lu.serveurs.total}` : '—',
      detail: lu.cle == null ? 'outils prêts' : lu.cle ? 'outils prêts · clé posée' : 'outils prêts · sans clé',
    },
    {
      onglet: 'navigateur',
      valeur: tiret(lu.sites),
      detail: lu.sites === 1 ? 'compte connecté' : 'comptes connectés',
    },
    {
      onglet: 'courriel',
      valeur: tiret(lu.envois),
      detail: lu.envois === 1 ? 'envoi' : 'envois',
    },
    {
      onglet: 'voice',
      valeur: motifEcoute ? 'Hors' : isListening ? 'On' : 'Prête',
      detail: motifEcoute ? 'écoute indisponible' : isListening ? 'écoute en cours' : 'écoute disponible',
      ton: motifEcoute ? 'danger' : undefined,
    },
    {
      onglet: 'machine',
      valeur: jauge?.charge != null ? `${Math.round(jauge.charge * 100)} %` : '—',
      detail: jauge ? NIVEAUX[jauge.niveau] ?? jauge.niveau : 'jauge non lue',
      ton:
        jauge?.niveau === 'impossible' || jauge?.niveau === 'saturee'
          ? 'danger'
          : jauge?.niveau === 'chargee' || jauge?.niveau === 'memoire-seule'
            ? 'alerte'
            : undefined,
    },
  ]

  return (
    <div className="centre">
      <div className="hud-coin hud-coin-haut-gauche">
        <span className="hud-etiquette">iAgent</span>
        <span className="hud-valeur">Humanity 2.0</span>
      </div>
      <div className="hud-coin hud-coin-haut-droite">
        <span className="hud-etiquette">
          {maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <span className="hud-valeur">
          {maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="hud-coin hud-coin-bas-gauche">
        <span className="hud-slogan">They do it for you.</span>
        <span className="hud-etiquette">Alone. With or without you.</span>
      </div>

      <div className={`systeme etat-${etat}`}>
        <div className="orbite">
          <svg className="rayons" viewBox="-100 -100 200 200" aria-hidden="true">
            <circle className="trajectoire" r="78" />
            {satellites.map((_, i) => {
              const a = (i * 2 * Math.PI) / satellites.length - Math.PI / 2
              return (
                <line
                  key={i}
                  className="rayon"
                  x1={Math.cos(a) * 30}
                  y1={Math.sin(a) * 30}
                  x2={Math.cos(a) * 66}
                  y2={Math.sin(a) * 66}
                />
              )
            })}
          </svg>

          {satellites.map((s, i) => (
            <div
              key={s.onglet}
              className="emplacement"
              style={{ ['--angle' as string]: `${(i * 360) / satellites.length}deg` }}
            >
              <button
                className={`satellite${s.ton ? ` ton-${s.ton}` : ''}`}
                onClick={() => onOuvrir(s.onglet)}
                title={TITRES[s.onglet]}
              >
                <Icone onglet={s.onglet} />
                <span className="satellite-valeur">{s.valeur}</span>
                <span className="satellite-titre">{TITRES[s.onglet]}</span>
                <span className="satellite-detail">{s.detail}</span>
              </button>
            </div>
          ))}
        </div>

        <div className="noyau" aria-live="polite">
          <svg className="anneaux" viewBox="-100 -100 200 200" aria-hidden="true">
            <circle className="anneau anneau-graduation" r="96" />
            <circle className="anneau anneau-tirets" r="88" />
            <circle className="anneau anneau-arc" r="80" />
            <circle className="anneau anneau-arc-marque" r="72" />
            <circle className="anneau anneau-fin" r="64" />
          </svg>
          <div className="noyau-coeur">
            <img src={puce} alt="" className="noyau-puce" />
          </div>
          <div className="noyau-etat">{etatTexte}</div>
        </div>
      </div>
    </div>
  )
}
