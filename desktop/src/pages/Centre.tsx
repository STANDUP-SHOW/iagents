import { useEffect, useState } from 'react'
import puce from '../assets/marque/puce-cerveau.png'
import { tiret, type Etat } from '../components/Chiffres'
import { TITRES, type Onglet } from '../components/Dashboard'
import type { AgentInstalle } from '../agents/fiche'
import { estTeamHolder } from '../agents/team-holder'
import Avatar from '../shell/Avatar'
import { IconeModule } from '../shell/Shell'
import { SOUS_PAGES, type Module } from '../shell/modules'
import type { Cible } from '../shell/intentions'

/**
 * The Centre (brief §3): the Task Commander at the core, the modules slowly
 * orbiting around it, each bubble carrying one figure that was actually read.
 *
 * A first tap on a bubble brings it forward and unfolds its sub-functions; the
 * « Ouvrir » button (or a second tap, or Enter) opens the module. The agents
 * the Task Commander holds sit on an inner ring, linked to the core.
 *
 * States (§3.1): available (cyan breathing), listening (ring + wave),
 * thinking (cyan to magenta), executing (links lit, green), approval needed
 * (orange badge), blocked (measured red, cause and a way out).
 */

export type EtatCentre = 'repos' | 'ecoute' | 'reflexion' | 'execution' | 'validation' | 'blocage'

const LIBELLES: Record<EtatCentre, string> = {
  repos: 'Disponible',
  ecoute: 'Je vous écoute',
  reflexion: 'Réflexion',
  execution: 'Exécution',
  validation: 'Validation requise',
  blocage: 'Blocage',
}

const NIVEAUX: Record<string, string> = {
  confortable: 'confortable',
  chargee: 'chargée',
  saturee: 'saturée',
  impossible: 'trop juste',
  'memoire-seule': 'charge non jugée',
}

interface Bulle {
  module: Module
  valeur: string
  detail: string
  ton?: 'alerte' | 'danger'
}

export default function Centre({
  etat,
  installes,
  statuts,
  etatCentre,
  blocage,
  aller,
}: {
  etat: Etat
  installes: readonly AgentInstalle[]
  /** Agents switched on in this session, by card id. */
  statuts: Record<string, boolean>
  etatCentre: EtatCentre
  /** The cause of a blocking state and where it is fixed. */
  blocage: { texte: string; onglet: Onglet } | null
  aller: (c: Cible) => void
}) {
  const { lu, travail, jauge } = etat
  const [choisi, setChoisi] = useState<Module | null>(null)
  const chef = installes.find((a) => estTeamHolder(a)) ?? null
  const equipe = installes.filter((a) => !estTeamHolder(a)).slice(0, 8)

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && setChoisi(null)
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [])

  const bulles: Bulle[] = [
    {
      module: 'agents',
      valeur: tiret(etat.embauches),
      detail: etat.actifs ? `${etat.actifs} actif${etat.actifs > 1 ? 's' : ''}` : etat.embauches ? 'aucun actif' : 'aucun embauché',
    },
    {
      module: 'travail',
      valeur: travail.total ? `${tiret(travail.pretes)}/${tiret(travail.total)}` : '—',
      detail: travail.total ? 'tâches prêtes' : 'aucune tâche allumée',
      ton: travail.total > travail.pretes ? 'alerte' : undefined,
    },
    { module: 'embauche', valeur: tiret(lu.metiers), detail: 'métiers au catalogue' },
    {
      module: 'connectors',
      valeur: lu.serveurs ? `${lu.serveurs.prets}/${lu.serveurs.total}` : '—',
      detail: lu.cle == null ? 'outils prêts' : lu.cle ? 'outils prêts · clé posée' : 'outils prêts · sans clé',
    },
    { module: 'navigateur', valeur: tiret(lu.sites), detail: lu.sites === 1 ? 'compte connecté' : 'comptes connectés' },
    { module: 'courriel', valeur: tiret(lu.envois), detail: lu.envois === 1 ? 'envoi consigné' : 'envois consignés' },
    { module: 'voice', valeur: etatCentre === 'ecoute' ? 'ON' : '—', detail: etatCentre === 'ecoute' ? 'à l’écoute' : 'Voice + prénom' },
    {
      module: 'machine',
      valeur: jauge?.charge != null ? `${Math.round(jauge.charge * 100)} %` : '—',
      detail: jauge ? NIVEAUX[jauge.niveau] ?? jauge.niveau : 'jauge non lue',
      ton: jauge?.niveau === 'impossible' || jauge?.niveau === 'saturee' ? 'danger' : jauge?.niveau === 'chargee' || jauge?.niveau === 'memoire-seule' ? 'alerte' : undefined,
    },
    { module: 'equipe', valeur: tiret(etat.embauches), detail: etat.teamHolder ? `tenus par ${etat.teamHolder}` : 'sans Task Commander' },
  ]

  const n = bulles.length
  const ouvrirModule = (m: Module) => aller({ onglet: m as Onglet })
  const toucher = (m: Module) => (choisi === m ? ouvrirModule(m) : setChoisi(m))
  const sousPages = choisi ? SOUS_PAGES[choisi] ?? [] : []

  return (
    <div className={`centre-dc etat-${etatCentre}${choisi ? ' un-choisi' : ''}`}>
      <div className="orbite-dc">
        <svg className="liaisons" viewBox="-100 -100 200 200" aria-hidden="true">
          <circle className="trajectoire-ext" r="84" />
          <circle className="trajectoire-int" r="47" />
          {bulles.map((b, i) => {
            const a = (i * 2 * Math.PI) / n - Math.PI / 2
            return (
              <line
                key={b.module}
                className={`liaison${choisi === b.module ? ' liaison-active' : ''}`}
                x1={Math.cos(a) * 24}
                y1={Math.sin(a) * 24}
                x2={Math.cos(a) * 72}
                y2={Math.sin(a) * 72}
              />
            )
          })}
          {equipe.map((_, i) => {
            const a = (i * 2 * Math.PI) / Math.max(equipe.length, 1) - Math.PI / 2 + Math.PI / n
            return <line key={`a${i}`} className="liaison liaison-agent" x1={Math.cos(a) * 22} y1={Math.sin(a) * 22} x2={Math.cos(a) * 42} y2={Math.sin(a) * 42} />
          })}
        </svg>

        <div className="anneau-bulles">
          {bulles.map((b, i) => (
            <div key={b.module} className="place-bulle" style={{ ['--angle' as string]: `${(i * 360) / n}deg` }}>
              <button
                className={`bulle${b.ton ? ` ton-${b.ton}` : ''}${choisi === b.module ? ' bulle-choisie' : ''}`}
                onClick={() => toucher(b.module)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), ouvrirModule(b.module))}
                aria-pressed={choisi === b.module}
                title={`${TITRES[b.module as Exclude<Onglet, 'dashboard'>]} : touchez pour voir, retouchez pour ouvrir`}
              >
                <IconeModule module={b.module} />
                <span className="bulle-valeur">{b.valeur}</span>
                <span className="bulle-titre">{TITRES[b.module as Exclude<Onglet, 'dashboard'>]}</span>
                <span className="bulle-detail">{b.detail}</span>
              </button>
            </div>
          ))}
        </div>

        <div className="anneau-agents">
          {equipe.map((a, i) => (
            <div key={a.prenom} className="place-agent" style={{ ['--angle' as string]: `${(i * 360) / Math.max(equipe.length, 1) + 180 / n}deg` }}>
              <button className="noeud-agent" onClick={() => aller({ onglet: 'agents', agent: a.prenom })} title={`${a.prenom}, ${a.fiche.nom}`}>
                <Avatar prenom={a.prenom} photo={a.photo} taille="s" statut={statuts[a.fiche.id] ? 'actif' : 'pause'} />
                <span>{a.prenom}</span>
              </button>
            </div>
          ))}
        </div>

        <button
          className="noyau-dc"
          onClick={() => aller({ onglet: chef ? 'agents' : 'embauche', agent: chef?.prenom })}
          title={chef ? `${chef.prenom}, votre Task Commander` : 'Aucun Task Commander : embauchez-en un'}
          aria-live="polite"
        >
          <svg className="noyau-anneaux" viewBox="-100 -100 200 200" aria-hidden="true">
            <circle className="na na-graduation" r="96" />
            <circle className="na na-tirets" r="88" />
            <circle className="na na-arc" r="80" />
            <circle className="na na-arc-marque" r="72" />
          </svg>
          <span className="noyau-portrait">
            {chef ? <Avatar prenom={chef.prenom} photo={chef.photo} taille="xl" /> : <img src={puce} alt="" className="noyau-puce-dc" />}
          </span>
          <span className="noyau-nom">{chef ? chef.prenom : 'iAgent'}</span>
          <span className="noyau-role">{chef ? 'Task Commander' : 'Aucun Task Commander'}</span>
          <span className={`noyau-statut statut-${etatCentre}`}>
            <span className="point" />
            {LIBELLES[etatCentre]}
          </span>
        </button>
      </div>

      {choisi && (
        <div className="volet-bulle" role="region" aria-label={TITRES[choisi as Exclude<Onglet, 'dashboard'>]}>
          <div className="volet-entete">
            <IconeModule module={choisi} />
            <strong>{TITRES[choisi as Exclude<Onglet, 'dashboard'>]}</strong>
            <button className="bouton-rond petit" onClick={() => setChoisi(null)} title="Fermer">
              ×
            </button>
          </div>
          <p>{bulles.find((b) => b.module === choisi)?.detail}</p>
          <div className="volet-actions">
            <button className="bouton-charte" onClick={() => ouvrirModule(choisi)}>
              Ouvrir
            </button>
            {sousPages.slice(1).map((p) => (
              <button key={p.id} className="bouton-contour" onClick={() => aller({ onglet: p.id })}>
                {p.titre}
              </button>
            ))}
          </div>
        </div>
      )}

      {etatCentre === 'blocage' && blocage && (
        <div className="cause-blocage" role="alert">
          <strong>Ce qui bloque</strong>
          <p>{blocage.texte}</p>
          <button className="bouton-contour" onClick={() => aller({ onglet: blocage.onglet })}>
            Résoudre
          </button>
        </div>
      )}
    </div>
  )
}
