import { useEffect, useState, type ReactNode } from 'react'
import logo from '../assets/marque/logo-iagent-blanc.svg'
import { ICONES, Icone, type Onglet } from '../components/Dashboard'
import MiseAJour from '../components/MiseAJour'
import Avatar from './Avatar'
import { MODULES, SOUS_PAGES, moduleDe, type Module } from './modules'
import { depuis, useEvenements, type Gravite } from './evenements'

/**
 * The Desktop Commander shell (brief §2): a fixed top bar, a voice dock on the
 * left, the current module in the middle, a contextual panel on the right and
 * a discreet system footer. Every zone is reachable by touch, mouse and
 * keyboard; the dock and the panel fold away and never block the page.
 */

export interface Alerte {
  texte: string
  gravite: Gravite
  /** Where the user fixes it, when there is such a place. */
  onglet?: Onglet
}

export interface EtatVoix {
  active: boolean
  eveillee: boolean
  reflexion: boolean
  /** Why listening cannot start, in French; null when it can. */
  motif: string | null
  partiel: string
  reponse: string
  onBasculer: () => void
}

export interface Pied {
  agentsActifs: number
  agentsTotal: number
  connexions: { prets: number; total: number } | null
  cle: boolean | null
  jauge: { niveau: string; libelle: string } | null
  relie: boolean | null
  editionBox: boolean
}

export const MODULE_ICONE: Record<Module, Exclude<Onglet, 'dashboard'> | 'centre'> = {
  dashboard: 'centre',
  agents: 'agents',
  travail: 'travail',
  embauche: 'embauche',
  connectors: 'connectors',
  navigateur: 'navigateur',
  courriel: 'courriel',
  voice: 'voice',
  machine: 'machine',
  equipe: 'equipe',
  workforce: 'workforce',
  standard: 'standard',
  create: 'create',
  box: 'box',
  validations: 'validations',
  consommation: 'consommation',
  securite: 'securite',
  admin: 'admin',
}

export function IconeModule({ module }: { module: Module }) {
  const i = MODULE_ICONE[module]
  if (i === 'centre') {
    return (
      <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8.5" />
      </svg>
    )
  }
  return <Icone onglet={i} />
}

/** The listening waveform: bars that move only while listening (brief §15). */
export function Onde({ vivante, barres = 13 }: { vivante: boolean; barres?: number }) {
  return (
    <span className={`onde${vivante ? ' onde-vivante' : ''}`} aria-hidden="true">
      {Array.from({ length: barres }, (_, i) => (
        <span key={i} style={{ ['--i' as string]: i }} />
      ))}
    </span>
  )
}

function Horloge() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => {
    const h = setInterval(() => setT(new Date()), 15_000)
    return () => clearInterval(h)
  }, [])
  return (
    <div className="carte-horloge">
      <span className="horloge-date">
        {t.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </span>
      <span className="horloge-heure">{t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      <span className="horloge-slogan">« They do it for you. Alone. With or without you. »</span>
    </div>
  )
}

/** Top bar: logo, product name, universal command, notifications, the workstation. */
export function BarreHaute({
  onOuvrirPalette,
  alertes,
  ouvrir,
  demo,
  onDemo,
  relie,
  editionBox,
  admin,
  etatTexte,
}: {
  onOuvrirPalette: () => void
  alertes: Alerte[]
  ouvrir: (o: Onglet) => void
  demo: boolean
  onDemo: () => void
  relie: boolean | null
  editionBox: boolean
  admin: boolean
  etatTexte: string
}) {
  const [cloche, setCloche] = useState(false)
  const graves = alertes.filter((a) => a.gravite === 'danger' || a.gravite === 'alerte').length
  return (
    <header className="barre-haute">
      <button className="marque-dc" onClick={() => ouvrir('dashboard')} title="Revenir au Centre">
        <img src={logo} alt="iAgent" />
        <span className="marque-dc-texte">
          <strong>Desktop Commander</strong>
          <span>Votre entreprise. Augmentée par l’IA.</span>
        </span>
      </button>

      <button className="commande-universelle" onClick={onOuvrirPalette}>
        <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <span>Dites ce que vous voulez faire ou tapez une commande…</span>
        <kbd>Ctrl + K</kbd>
      </button>

      <div className="barre-droite">
        <span className={`pastille-etat ${graves ? 'pastille-alerte' : 'pastille-ok'}`}>
          <span className="point" />
          {etatTexte}
        </span>
        <button
          className={`bouton-demo-dc${demo ? ' demo-actif' : ''}`}
          onClick={onDemo}
          aria-pressed={demo}
          title="Chiffres d'exemple, pour une démonstration ou un contrôle"
        >
          Démo {demo ? 'activée' : 'coupée'}
        </button>
        <MiseAJour />
        <div className="cloche-zone">
          <button
            className="bouton-rond"
            onClick={() => setCloche((c) => !c)}
            aria-expanded={cloche}
            title={alertes.length ? `${alertes.length} point(s) à regarder` : 'Rien à signaler'}
          >
            <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" />
            </svg>
            {alertes.length > 0 && <span className="badge-compte">{alertes.length}</span>}
          </button>
          {cloche && (
            <div className="menu-flottant" role="dialog" aria-label="Notifications">
              <h4>À regarder</h4>
              {alertes.length === 0 && <p className="vide">Rien à signaler sur ce poste.</p>}
              {alertes.map((a, i) => (
                <button
                  key={i}
                  className={`alerte-ligne gravite-${a.gravite}`}
                  onClick={() => {
                    setCloche(false)
                    if (a.onglet) ouvrir(a.onglet)
                  }}
                >
                  {a.texte}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="profil-poste" onClick={() => ouvrir(admin ? 'admin' : 'box')}>
          <span className="profil-icone">
            <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
              {ICONES.box}
            </svg>
          </span>
          <span className="profil-texte">
            <strong>{editionBox ? 'Box iAgent' : 'Poste iAgent'}</strong>
            <span>
              {relie == null ? 'liaison non lue' : relie ? 'reliée à la plateforme' : 'non relié à la plateforme'}
              {admin ? ' · administration' : ''}
            </span>
          </span>
        </button>
      </div>
    </header>
  )
}

/** The ten modules, one row of finger-sized buttons. */
export function Navigation({ onglet, ouvrir }: { onglet: Onglet; ouvrir: (o: Onglet) => void }) {
  const courant = moduleDe(onglet)
  return (
    <nav className="nav-modules" aria-label="Modules">
      {MODULES.map((m) => (
        <button
          key={m.id}
          className={courant === m.id ? 'module-actif' : ''}
          aria-current={courant === m.id ? 'page' : undefined}
          onClick={() => ouvrir(m.id)}
        >
          <IconeModule module={m.id} />
          <span>{m.titre}</span>
        </button>
      ))}
    </nav>
  )
}

/** The page title block: icon, uppercase title, one sentence, actions on the right. */
export function EntetePage({ onglet, titre, sousTitre, actions }: { onglet: Module; titre: string; sousTitre?: string; actions?: ReactNode }) {
  return (
    <div className="entete-page">
      <span className="entete-icone">
        <IconeModule module={onglet} />
      </span>
      <div className="entete-textes">
        <h1>{titre}</h1>
        {sousTitre && <p>{sousTitre}</p>}
      </div>
      {actions && <div className="entete-actions">{actions}</div>}
    </div>
  )
}

/** The sub-pages of a module, when it has some. */
export function SousOnglets({ onglet, ouvrir }: { onglet: Onglet; ouvrir: (o: Onglet) => void }) {
  const pages = SOUS_PAGES[moduleDe(onglet)]
  if (!pages || pages.length < 2) return null
  return (
    <div className="sous-onglets" role="tablist">
      {pages.map((p) => (
        <button key={p.id} role="tab" aria-selected={p.id === onglet} className={p.id === onglet ? 'actif' : ''} onClick={() => ouvrir(p.id)}>
          {p.titre}
        </button>
      ))}
    </div>
  )
}

/** Left dock: the voice is the fastest way in, never the only one (brief §2.1). */
export function DockVocal({
  voix,
  interlocuteur,
  prenoms,
  ouvrir,
  replie,
  onReplier,
}: {
  voix: EtatVoix
  interlocuteur: { prenom: string; photo?: string } | null
  prenoms: string[]
  ouvrir: (o: Onglet) => void
  replie: boolean
  onReplier: () => void
}) {
  const etat = voix.motif ? 'indisponible' : voix.reflexion ? 'reflexion' : voix.eveillee ? 'eveil' : voix.active ? 'ecoute' : 'repos'
  const libelle = {
    indisponible: 'Écoute indisponible',
    reflexion: 'Réflexion…',
    eveil: 'J’écoute. Quel agent ?',
    ecoute: 'En écoute…',
    repos: 'Écoute coupée',
  }[etat]
  const exemples = prenoms.length
    ? [
        `« Voice, ${prenoms[0]}, qu’as-tu fait aujourd’hui ? »`,
        ...(prenoms[1] ? [`« Voice, ${prenoms[1]}, où en est ton travail ? »`] : []),
        `« Voice, ${prenoms[0]}, prépare le compte rendu. »`,
      ]
    : ['Embauchez un agent : vous l’appellerez par « Voice » puis son prénom.']

  if (replie) {
    return (
      <aside className="dock-vocal dock-replie" aria-label="Commande vocale">
        <button className={`micro-mini etat-${etat}`} onClick={voix.onBasculer} disabled={!!voix.motif} aria-pressed={voix.active} title={voix.motif ?? libelle}>
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            {ICONES.voice}
          </svg>
        </button>
        <button className="bouton-rond" onClick={onReplier} title="Déplier la commande vocale">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </aside>
    )
  }

  return (
    <aside className="dock-vocal" aria-label="Commande vocale">
      <div className="dock-entete">
        <Onde vivante={voix.active} barres={7} />
        <span className="etiquette">Commande vocale</span>
        <button className="bouton-rond petit" onClick={onReplier} title="Replier la commande vocale">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      <button
        className={`micro-geant etat-${etat}`}
        onClick={voix.onBasculer}
        disabled={!!voix.motif}
        aria-pressed={voix.active}
        title={voix.motif ?? (voix.active ? 'Couper l’écoute' : 'Allumer l’écoute')}
      >
        <span className="micro-anneau anneau-1" />
        <span className="micro-anneau anneau-2" />
        <span className="micro-coeur">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            {ICONES.voice}
          </svg>
        </span>
      </button>

      <div className="dock-qui">
        {interlocuteur ? <span className="dock-parlez">Parlez à {interlocuteur.prenom}</span> : <span className="dock-parlez">Parlez à vos agents</span>}
        <span className={`dock-etat etat-${etat}`}>{libelle}</span>
        <Onde vivante={voix.active && !voix.motif} />
      </div>

      {voix.motif ? (
        <p className="dock-motif">{voix.motif}</p>
      ) : voix.partiel || voix.reponse ? (
        <div className="dock-transcription" aria-live="polite">
          {voix.partiel && (
            <p>
              <span className="etiquette">J’entends</span>
              {voix.partiel}
            </p>
          )}
          {voix.reponse && (
            <p>
              <span className="etiquette">Réponse</span>
              {voix.reponse}
            </p>
          )}
        </div>
      ) : (
        <p className="dock-aide">Dites « Voice », puis le prénom de l’agent. Tout reste aussi faisable au doigt et au clavier.</p>
      )}

      <ul className="dock-exemples">
        {exemples.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>

      <button className="dock-reglages" onClick={() => ouvrir('voice')}>
        <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5" />
        </svg>
        <span>
          <strong>Réglages de la voix</strong>
          <span>Voix, empreinte vocale, langue</span>
        </span>
      </button>

      <div className="dock-slogan">
        <span className="texte-marque">They do it for you.</span>
        <span>Alone. With or without you.</span>
      </div>
    </aside>
  )
}

const ICONE_EVENEMENT: Record<string, Exclude<Onglet, 'dashboard'>> = {
  tache: 'travail',
  voix: 'voice',
  equipe: 'equipe',
  embauche: 'embauche',
  courrier: 'courriel',
  systeme: 'machine',
}

/** The live feed: what really happened, newest first (brief §14 ActivityFeed). */
export function FilActivite({ max = 6, ouvrir }: { max?: number; ouvrir: (o: Onglet) => void }) {
  const evenements = useEvenements()
  const [, setTic] = useState(0)
  useEffect(() => {
    const h = setInterval(() => setTic((t) => t + 1), 30_000)
    return () => clearInterval(h)
  }, [])
  if (evenements.length === 0) {
    return <p className="vide">Rien ne s’est encore passé depuis l’ouverture. Chaque tâche lancée, chaque réponse d’un agent apparaîtra ici.</p>
  }
  return (
    <ul className="fil-activite">
      {evenements.slice(0, max).map((e) => (
        <li key={e.id} className={`gravite-${e.gravite}`}>
          {e.agent ? <Avatar prenom={e.agent} taille="s" /> : <span className="fil-pastille" />}
          <button className="fil-texte" onClick={() => ouvrir(ICONE_EVENEMENT[e.type])}>
            <span>{e.texte}</span>
            <span className="fil-date">{depuis(e.date)}</span>
          </button>
          <span className="fil-type">
            <Icone onglet={ICONE_EVENEMENT[e.type]} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Right panel: time, live activity, shortcuts. Contextual, and it folds away. */
export function PanneauDroit({
  ouvrir,
  replie,
  onReplier,
  contexte,
}: {
  ouvrir: (o: Onglet) => void
  replie: boolean
  onReplier: () => void
  contexte?: ReactNode
}) {
  if (replie) {
    return (
      <aside className="panneau-droit panneau-replie" aria-label="Activité">
        <button className="bouton-rond" onClick={onReplier} title="Afficher l’activité">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </aside>
    )
  }
  const raccourcis: { o: Onglet; titre: string; icone: Exclude<Onglet, 'dashboard'> }[] = [
    { o: 'travail', titre: 'Lancer une tâche', icone: 'travail' },
    { o: 'courriel', titre: 'Nouveau message', icone: 'courriel' },
    { o: 'embauche', titre: 'Embaucher un agent', icone: 'embauche' },
    { o: 'connectors', titre: 'Connecter un outil', icone: 'connectors' },
  ]
  return (
    <aside className="panneau-droit" aria-label="Activité">
      <div className="panneau-haut">
        <Horloge />
        <button className="bouton-rond petit replier-droit" onClick={onReplier} title="Réduire le panneau">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      {contexte}
      <section className="carte-verre">
        <h3 className="carte-titre">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12h4l2-6 4 12 2-6h6" />
          </svg>
          Activité en cours
        </h3>
        <FilActivite ouvrir={ouvrir} />
      </section>
      <section className="carte-verre">
        <h3 className="carte-titre">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
          </svg>
          Accès rapide
        </h3>
        <div className="raccourcis">
          {raccourcis.map((r) => (
            <button key={r.titre} onClick={() => ouvrir(r.o)}>
              <Icone onglet={r.icone} />
              <span>{r.titre}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}

/** Footer: agents, connections, AI, machine, platform, voice. Discreet, for diagnosis. */
export function PiedSysteme({ pied, voix, ouvrir }: { pied: Pied; voix: EtatVoix; ouvrir: (o: Onglet) => void }) {
  const items: { titre: string; valeur: string; ton: 'ok' | 'alerte' | 'danger' | 'neutre'; o: Onglet }[] = [
    {
      titre: 'Agents actifs',
      valeur: `${pied.agentsActifs} / ${pied.agentsTotal}`,
      ton: pied.agentsTotal === 0 ? 'neutre' : pied.agentsActifs > 0 ? 'ok' : 'neutre',
      o: 'agents',
    },
    {
      titre: 'Connexions',
      valeur: pied.connexions ? `${pied.connexions.prets} / ${pied.connexions.total} prêtes` : '—',
      ton: pied.connexions ? (pied.connexions.prets > 0 ? 'ok' : 'alerte') : 'neutre',
      o: 'connectors',
    },
    {
      titre: 'IA',
      valeur: pied.cle == null ? '—' : pied.cle ? 'Anthropic branchée' : 'aucune clé posée',
      ton: pied.cle == null ? 'neutre' : pied.cle ? 'ok' : 'alerte',
      o: 'connectors',
    },
    {
      titre: 'Machine',
      valeur: pied.jauge?.libelle ?? 'jauge non lue',
      ton: !pied.jauge ? 'neutre' : pied.jauge.niveau === 'confortable' ? 'ok' : pied.jauge.niveau === 'impossible' || pied.jauge.niveau === 'saturee' ? 'danger' : 'alerte',
      o: 'machine',
    },
    {
      titre: 'Plateforme',
      valeur: pied.relie == null ? '—' : pied.relie ? 'reliée' : pied.editionBox ? 'Box non reliée' : 'non reliée',
      ton: pied.relie == null ? 'neutre' : pied.relie ? 'ok' : pied.editionBox ? 'danger' : 'neutre',
      o: 'box',
    },
    {
      titre: 'Voice',
      valeur: voix.motif ? 'indisponible' : voix.active ? 'à l’écoute' : 'coupée',
      ton: voix.motif ? 'alerte' : voix.active ? 'ok' : 'neutre',
      o: 'voice',
    },
  ]
  const probleme = items.some((i) => i.ton === 'danger')
  return (
    <footer className="pied-systeme">
      <span className="etiquette">Statut système</span>
      {items.map((i) => (
        <button key={i.titre} className={`pied-item ton-${i.ton}`} onClick={() => ouvrir(i.o)}>
          <span className="point" />
          <span className="pied-titre">{i.titre}</span>
          <span className="pied-valeur">{i.valeur}</span>
        </button>
      ))}
      <span className={`pied-global ${probleme ? 'ton-danger' : 'ton-ok'}`}>
        <Onde vivante={false} barres={9} />
        {probleme ? 'Un point bloque : voir ci-contre' : 'Rien ne bloque'}
      </span>
    </footer>
  )
}
