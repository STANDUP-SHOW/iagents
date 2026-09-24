import { useEffect, useState, type ReactNode } from 'react'
import { tiret, type Etat } from './Chiffres'
import puce from '../assets/marque/puce-cerveau.png'

/**
 * Le tableau de bord en rond : le noyau animé au centre, les menus qui
 * gravitent autour, chacun menant à sa page.
 *
 * Chaque satellite porte un chiffre, et chaque chiffre est lu : dans les agents
 * installés, dans la jauge calculée en Rust, ou dans ce que les commandes de
 * l'application renvoient. Quand une lecture échoue, le satellite affiche un
 * tiret : un chiffre inventé sur un tableau de bord se croit, et c'est pire
 * qu'un trou. Seul le mode démo montre un exemple, et le ruban le dit.
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
  | 'equipe'

interface Props {
  etat: Etat
  isListening: boolean
  isProcessing: boolean
  motifEcoute: string | null
  /** L'écoute est-elle allumée ? Le bouton VOICE la bascule. */
  voixActive: boolean
  /** « Voice » a été entendu : l'écoute attend un prénom. */
  eveillee: boolean
  onBasculerVoix: () => void
  onOuvrir: (onglet: Onglet) => void
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
  equipe: (
    <>
      <circle cx="12" cy="7" r="3" />
      <circle cx="5" cy="10" r="2.2" />
      <circle cx="19" cy="10" r="2.2" />
      <path d="M7 20c0-2.8 2.2-5 5-5s5 2.2 5 5M1.5 18c0-2 1.6-3.6 3.5-3.6M22.5 18c0-2-1.6-3.6-3.5-3.6" />
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
  equipe: 'Votre équipe',
}

/** Ce qui tient dans un rond : un mot, deux au plus. */
const TITRES_COURTS: Record<Exclude<Onglet, 'dashboard'>, string> = {
  agents: 'Agents',
  travail: 'Travail',
  embauche: 'Embaucher',
  connectors: 'Connexions',
  navigateur: 'Comptes',
  courriel: 'Courrier',
  voice: 'Voix',
  machine: 'Machine',
  equipe: 'Équipe',
}

export function Icone({ onglet }: { onglet: Exclude<Onglet, 'dashboard'> }) {
  return (
    <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
      {ICONES[onglet]}
    </svg>
  )
}

export default function Dashboard({
  etat: donnees,
  isListening,
  isProcessing,
  motifEcoute,
  voixActive,
  eveillee,
  onBasculerVoix,
  onOuvrir,
}: Props) {
  const { lu, travail, jauge } = donnees
  const [maintenant, setMaintenant] = useState(() => new Date())

  useEffect(() => {
    const horloge = setInterval(() => setMaintenant(new Date()), 30_000)
    return () => clearInterval(horloge)
  }, [])

  const actifs = donnees.actifs

  const etat = isProcessing ? 'reflexion' : eveillee ? 'eveil' : isListening ? 'ecoute' : 'repos'
  const etatTexte = { reflexion: 'Réflexion', eveil: 'Quel agent ?', ecoute: "À l'écoute", repos: 'Prêt' }[etat]

  const satellites: { onglet: Exclude<Onglet, 'dashboard'>; valeur: string; detail: string; ton?: string }[] = [
    {
      onglet: 'agents',
      valeur: tiret(donnees.embauches),
      detail: actifs ? `${actifs} actif${actifs > 1 ? 's' : ''}` : donnees.embauches ? 'aucun actif' : 'aucun embauché',
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

      <div className="commande-voix">
        <button
          className={`bouton-voice ${voixActive ? 'voice-actif' : 'voice-inactif'}`}
          onClick={onBasculerVoix}
          aria-pressed={voixActive}
          disabled={!!motifEcoute}
          title={motifEcoute ?? (voixActive ? 'Couper l\u2019écoute' : 'Allumer l\u2019écoute')}
        >
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            {ICONES.voice}
          </svg>
          <span className="bouton-voice-nom">Voice</span>
          <span className="bouton-voice-etat">
            {motifEcoute ? 'indisponible' : voixActive ? 'à l\u2019écoute' : 'coupé'}
          </span>
        </button>
        <p className="commande-voix-aide">
          {motifEcoute
            ? 'L\u2019écoute ne peut pas démarrer : voir les réglages dessous.'
            : voixActive
              ? '« Voice », puis le prénom de l\u2019agent.'
              : 'Touchez pour que vos agents vous entendent.'}
        </p>
        <button className="bouton-reglage-voix" onClick={() => onOuvrir('voice')}>
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
          </svg>
          Réglages de la voix
          <span className="bouton-reglage-detail">voix, empreinte vocale</span>
        </button>
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
                <span className="satellite-titre">{TITRES_COURTS[s.onglet]}</span>
                <span className="satellite-detail">{s.detail}</span>
              </button>
            </div>
          ))}
        </div>

        <button
          className={`noyau${donnees.teamHolder ? ' noyau-chef' : ''}`}
          aria-live="polite"
          onClick={() => onOuvrir('equipe')}
          title={donnees.teamHolder ? `${donnees.teamHolder}, votre Team Holder` : 'Votre équipe'}
        >
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
          {donnees.teamHolder && <div className="noyau-chef-nom">{donnees.teamHolder}</div>}
          <div className="noyau-etat">{etatTexte}</div>
        </button>
      </div>
    </div>
  )
}
