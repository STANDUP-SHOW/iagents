import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AgentInstalle } from '../agents/fiche'
import { travailDuJour, type TacheDuJour } from '../agents/travail'
import Avatar from '../shell/Avatar'
import { EntetePage } from '../shell/Shell'
import { debutExecution, finExecution, publier } from '../shell/evenements'
import type { Cible } from '../shell/intentions'
import { planificationEnMots } from './VosAgents'

/**
 * Le travail du jour, as mission control (brief §5): figures at the top,
 * filters, every task with its agent, schedule, status and one main action, and
 * a drawer that opens the task without losing the list.
 *
 * The rules of the previous screen hold: a task that cannot succeed has no
 * button, it says what it lacks; a result says where it was written and
 * whether it waits for the user's reading. Figures are counted on this
 * workstation since the application opened, and labelled so.
 */

interface Resultat {
  fichier: string
  voie: string
  motif: string
  validation_humaine: boolean
}

const VOIES: Record<string, string> = {
  local: 'sur votre ordinateur',
  api: 'par internet, au tarif de votre clé',
}

interface Ligne extends TacheDuJour {
  agent: AgentInstalle
  clef: string
}

type Statut = 'toutes' | 'pretes' | 'bloquees' | 'controle' | 'faites'

export default function TravailDuJour({
  installes,
  aller,
  cible,
}: {
  installes: readonly AgentInstalle[]
  aller: (c: Cible) => void
  cible?: Cible
}) {
  const [agentFiltre, setAgentFiltre] = useState<string>(cible?.agent ?? '')
  const [statut, setStatut] = useState<Statut>(cible?.filtre === 'bloquees' ? 'bloquees' : cible?.filtre === 'controle' ? 'controle' : 'toutes')
  const [type, setType] = useState('')
  const [recherche, setRecherche] = useState(cible?.recherche ?? '')
  const [enCours, setEnCours] = useState<string | null>(null)
  const [resultats, setResultats] = useState<Record<string, Resultat>>({})
  const [echecs, setEchecs] = useState<Record<string, string>>({})
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [vue, setVue] = useState<'liste' | 'cartes'>('liste')

  useEffect(() => {
    if (!cible) return
    if (cible.agent !== undefined) setAgentFiltre(cible.agent ?? '')
    if (cible.recherche !== undefined) setRecherche(cible.recherche ?? '')
    if (cible.filtre) setStatut(cible.filtre === 'bloquees' ? 'bloquees' : cible.filtre === 'controle' ? 'controle' : 'pretes')
  }, [cible])

  const toutes = useMemo<Ligne[]>(
    () => installes.flatMap((a) => travailDuJour(a).map((t) => ({ ...t, agent: a, clef: `${a.prenom}:${t.tache.id}` }))),
    [installes]
  )

  const lignes = toutes.filter((l) => {
    if (agentFiltre && l.agent.prenom !== agentFiltre) return false
    if (type && l.tache.planification.type !== type) return false
    if (recherche.trim() && !`${l.tache.nom} ${l.tache.description}`.toLowerCase().includes(recherche.trim().toLowerCase())) return false
    if (statut === 'pretes') return !l.empechement && !resultats[l.clef]
    if (statut === 'bloquees') return !!l.empechement
    if (statut === 'controle') return l.validation || !!resultats[l.clef]?.validation_humaine
    if (statut === 'faites') return !!resultats[l.clef]
    return true
  })

  const pretes = toutes.filter((l) => !l.empechement).length
  const faites = Object.keys(resultats).length
  const aRelire = Object.values(resultats).filter((r) => r.validation_humaine).length
  const compte = (s: Statut) =>
    s === 'toutes'
      ? toutes.length
      : s === 'pretes'
        ? toutes.filter((l) => !l.empechement && !resultats[l.clef]).length
        : s === 'bloquees'
          ? toutes.filter((l) => l.empechement).length
          : s === 'controle'
            ? toutes.filter((l) => l.validation || resultats[l.clef]?.validation_humaine).length
            : faites

  async function lancer(l: Ligne) {
    if (enCours) return
    setEnCours(l.clef)
    setEchecs((e) => ({ ...e, [l.clef]: '' }))
    debutExecution()
    publier({ type: 'tache', agent: l.agent.prenom, texte: `${l.agent.prenom} lance « ${l.tache.nom} »`, gravite: 'info' })
    try {
      const r = await invoke<Resultat>('executer_tache', {
        prenom: l.agent.prenom,
        ficheId: l.agent.fiche.id,
        tacheId: l.tache.id,
      })
      setResultats((x) => ({ ...x, [l.clef]: r }))
      publier({
        type: 'tache',
        agent: l.agent.prenom,
        texte: r.validation_humaine
          ? `${l.agent.prenom} a terminé « ${l.tache.nom} » : à relire`
          : `${l.agent.prenom} a terminé « ${l.tache.nom} »`,
        gravite: r.validation_humaine ? 'alerte' : 'succes',
      })
    } catch (e) {
      setEchecs((x) => ({ ...x, [l.clef]: String(e) }))
      publier({ type: 'tache', agent: l.agent.prenom, texte: `« ${l.tache.nom} » n’a pas abouti`, gravite: 'danger' })
    } finally {
      finExecution()
      setEnCours(null)
    }
  }

  const detail = toutes.find((l) => l.clef === ouverte) ?? null
  const types = [...new Set(toutes.map((l) => l.tache.planification.type))]
  const documents = Object.entries(resultats)

  return (
    <div className="page-dc">
      <EntetePage onglet="travail" titre="Le travail du jour" sousTitre="Vos agents préparent, exécutent et vous soumettent les résultats. Gardez le contrôle." />

      <div className="kpis-dc">
        <button className={`kpi-dc ton-cyan${statut === 'pretes' ? ' kpi-actif' : ''}`} onClick={() => setStatut('pretes')}>
          <span className="kpi-icone">
            <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
          </span>
          <span className="kpi-valeur">
            {pretes} / {toutes.length}
          </span>
          <span className="kpi-libelle">Tâches prêtes</span>
          <span className="kpi-contexte">{toutes.length - pretes > 0 ? `${toutes.length - pretes} attendent quelque chose` : 'toutes peuvent partir'}</span>
        </button>
        <button className={`kpi-dc ton-magenta${statut === 'controle' ? ' kpi-actif' : ''}`} onClick={() => setStatut('controle')}>
          <span className="kpi-icone">
            <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
            </svg>
          </span>
          <span className="kpi-valeur">{aRelire}</span>
          <span className="kpi-libelle">À valider</span>
          <span className="kpi-contexte">{aRelire ? 'résultat(s) qui vous attendent' : 'aucun résultat en attente'}</span>
        </button>
        <div className="kpi-dc ton-bleu">
          <span className="kpi-icone">
            <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M10 8.5l5 3.5-5 3.5z" />
            </svg>
          </span>
          <span className="kpi-valeur">{enCours ? 1 : 0}</span>
          <span className="kpi-libelle">En cours</span>
          <span className="kpi-contexte">{enCours ? 'une tâche s’exécute' : 'rien ne s’exécute'}</span>
        </div>
        <button className={`kpi-dc ton-vert${statut === 'faites' ? ' kpi-actif' : ''}`} onClick={() => setStatut('faites')}>
          <span className="kpi-icone">
            <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M8 12.5l2.7 2.7L16 10" />
            </svg>
          </span>
          <span className="kpi-valeur">{faites}</span>
          <span className="kpi-libelle">Terminées</span>
          <span className="kpi-contexte">depuis l’ouverture de l’application</span>
        </button>
      </div>

      <div className="filtres-dc">
        <span className="etiquette">Filtres</span>
        <select className="choix-dc" value={agentFiltre} onChange={(e) => setAgentFiltre(e.target.value)} aria-label="Agent">
          <option value="">Tous les agents</option>
          {installes.map((a) => (
            <option key={a.prenom} value={a.prenom}>
              {a.prenom}
            </option>
          ))}
        </select>
        <select className="choix-dc" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="">Tous les rythmes</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {{ quotidienne: 'Chaque jour', hebdomadaire: 'Chaque semaine', mensuelle: 'Chaque mois', intervalle: 'À intervalle', declencheur: 'Sur événement', 'a-la-demande': 'À la demande' }[t] ?? t}
            </option>
          ))}
        </select>
        <div className="mode-auto" title="Le planificateur qui lance les tâches à leur heure n’est pas encore installé sur ce poste">
          <span className="interrupteur interrupteur-off" aria-hidden="true" />
          <span>
            <strong>Mode automatique : arrêté</strong>
            <span>Le planificateur n’est pas encore installé. Rien ne part sans votre clic.</span>
          </span>
        </div>
        <label className="champ-recherche">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une tâche…" />
        </label>
      </div>

      <section className="carte-verre liste-mission">
        <div className="onglets-statut" role="tablist">
          {(
            [
              ['toutes', 'Toutes'],
              ['pretes', 'À faire'],
              ['bloquees', 'Attendent quelque chose'],
              ['controle', 'Sous contrôle'],
              ['faites', 'Terminées'],
            ] as [Statut, string][]
          ).map(([s, t]) => (
            <button key={s} role="tab" aria-selected={statut === s} className={statut === s ? 'actif' : ''} onClick={() => setStatut(s)}>
              {t} ({compte(s)})
            </button>
          ))}
          <span className="espace" />
          <button className={`bouton-rond petit${vue === 'liste' ? ' actif' : ''}`} onClick={() => setVue('liste')} title="Liste">
            ☰
          </button>
          <button className={`bouton-rond petit${vue === 'cartes' ? ' actif' : ''}`} onClick={() => setVue('cartes')} title="Cartes">
            ▦
          </button>
        </div>

        {installes.length === 0 && <p className="vide">Aucun agent n’est encore embauché sur ce poste.</p>}
        {installes.length > 0 && lignes.length === 0 && <p className="vide">Aucune tâche ne correspond à ces filtres.</p>}

        <ul className={vue === 'cartes' ? 'taches-cartes' : 'taches-lignes'}>
          {lignes.map((l) => {
            const r = resultats[l.clef]
            const echec = echecs[l.clef]
            const etat = enCours === l.clef ? 'en-cours' : r ? (r.validation_humaine ? 'a-relire' : 'faite') : l.empechement ? 'attend' : echec ? 'echec' : 'prete'
            return (
              <li key={l.clef} className={`tache-dc etat-${etat}`}>
                <button className="tache-corps" onClick={() => setOuverte(l.clef)}>
                  <span className={`priorite ${l.validation ? 'priorite-controle' : 'priorite-auto'}`}>{l.validation ? 'Contrôle' : 'Auto'}</span>
                  <span className="tache-textes">
                    <strong>{l.tache.nom}</strong>
                    <span className="precision">{l.tache.description}</span>
                    <span className="pieces">
                      {l.tache.sorties.slice(0, 2).map((s) => (
                        <span key={s.dossier + s.format} className="piece">
                          {s.format.toUpperCase()} · {s.dossier}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
                <span className="tache-agent">
                  <Avatar prenom={l.agent.prenom} photo={l.agent.photo} taille="s" />
                  <span>
                    <strong>{l.agent.prenom}</strong>
                    <span className="precision">{l.agent.fiche.nom}</span>
                  </span>
                </span>
                <span className="tache-quand">{planificationEnMots(l.tache.planification)}</span>
                <span className={`tache-etat etat-${etat}`}>
                  <span className="point" />
                  {
                    {
                      'en-cours': 'En cours d’exécution',
                      'a-relire': 'En attente de validation',
                      faite: 'Terminée',
                      attend: l.empechement,
                      echec: 'N’a pas abouti',
                      prete: 'Prête à lancer',
                    }[etat]
                  }
                </span>
                <span className="tache-cta">
                  {r ? (
                    <button className="bouton-contour" onClick={() => setOuverte(l.clef)}>
                      Ouvrir
                    </button>
                  ) : l.empechement ? (
                    <button className="bouton-contour" onClick={() => setOuverte(l.clef)}>
                      Voir
                    </button>
                  ) : (
                    <button className="bouton-cyan" disabled={enCours !== null} onClick={() => lancer(l)}>
                      {enCours === l.clef ? 'En cours…' : 'Lancer'}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="bas-mission">
        <section className="carte-verre">
          <h3 className="carte-titre">Rapports journaliers</h3>
          <p className="vide">Aucun rapport produit depuis l’ouverture. Les rapports de vos agents arrivent dans leur dossier, et ici dès qu’ils sont écrits.</p>
        </section>
        <section className="carte-verre">
          <h3 className="carte-titre">Documents générés</h3>
          {documents.length === 0 ? (
            <p className="vide">Aucun document depuis l’ouverture.</p>
          ) : (
            <ul className="liste-documents">
              {documents.map(([clef, r]) => (
                <li key={clef}>
                  <span className="doc-format">{r.fichier.split('.').pop()?.toUpperCase()}</span>
                  <span>
                    <strong>{r.fichier.split(/[\\/]/).pop()}</strong>
                    <span className="precision">{clef.split(':')[0]} · {VOIES[r.voie] ?? r.voie}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="carte-verre">
          <h3 className="carte-titre">Navigateur et boîte mail des agents</h3>
          <p className="precision">Les comptes ouverts par vos agents et les messages qu’ils ont préparés.</p>
          <div className="ligne-boutons">
            <button className="bouton-contour" onClick={() => aller({ onglet: 'navigateur' })}>
              Navigateur
            </button>
            <button className="bouton-contour" onClick={() => aller({ onglet: 'courriel' })}>
              Courrier
            </button>
          </div>
        </section>
      </div>

      {detail && (
        <div className="tiroir-voile" onClick={() => setOuverte(null)}>
          <aside className="tiroir" role="dialog" aria-label={detail.tache.nom} onClick={(e) => e.stopPropagation()}>
            <div className="tiroir-entete">
              <h2>{detail.tache.nom}</h2>
              <button className="bouton-rond" onClick={() => setOuverte(null)} title="Fermer">
                ×
              </button>
            </div>
            <h4>Pourquoi elle existe</h4>
            <p>{detail.tache.description}</p>
            <h4>Qui</h4>
            <p>
              Prévue par la fiche « {detail.agent.fiche.nom} », exécutée par {detail.agent.prenom}, {planificationEnMots(detail.tache.planification)}.
            </p>
            <h4>Ce qu’elle lit</h4>
            {detail.tache.entrees.length === 0 ? (
              <p className="vide">Rien n’est désigné : {detail.agent.prenom} vous dira ce qu’il lui faut plutôt que de l’inventer.</p>
            ) : (
              <ul className="liste-simple">
                {detail.tache.entrees.map((e) => (
                  <li key={e}>{e.replace(/^dossier:/, 'dossier ')}</li>
                ))}
              </ul>
            )}
            <h4>Ce qu’elle produit</h4>
            <ul className="liste-simple">
              {detail.tache.sorties.map((s) => (
                <li key={s.dossier + s.format}>
                  {s.format.toUpperCase()} dans {detail.agent.dossiers[s.dossier] ?? `${detail.agent.prenom} › ${s.dossier}`}
                </li>
              ))}
            </ul>
            {detail.tache.logiciels.length > 0 && (
              <>
                <h4>Outils employés</h4>
                <div className="etiquettes">
                  {detail.tache.logiciels.map((x) => (
                    <span key={x} className="etiquette-dc">
                      {x.replace(/-/g, ' ')}
                    </span>
                  ))}
                </div>
              </>
            )}
            <h4>Validation humaine</h4>
            <p>{detail.validation ? 'Vous relirez le résultat avant qu’il serve.' : 'L’agent va seul sur cette tâche. Rien ne part du poste sans votre accord.'}</p>
            {detail.empechement && <p className="lecture-refus">Ne peut pas partir : {detail.empechement}.</p>}
            {resultats[detail.clef] && (
              <>
                <h4>Résultat</h4>
                <p className="fait">
                  Écrit dans {resultats[detail.clef].fichier}, {VOIES[resultats[detail.clef].voie] ?? resultats[detail.clef].voie}.
                  {resultats[detail.clef].validation_humaine && ' Rien n’a été envoyé : le résultat vous attend.'}
                </p>
                <details className="avance">
                  <summary>Mode avancé</summary>
                  <p className="precision">{resultats[detail.clef].motif}</p>
                </details>
              </>
            )}
            {echecs[detail.clef] && <p className="lecture-refus">{echecs[detail.clef]}</p>}
            <div className="tiroir-actions">
              {!detail.empechement && (
                <button className="bouton-cyan" disabled={enCours !== null} onClick={() => lancer(detail)}>
                  {resultats[detail.clef] ? 'Relancer' : 'Lancer'}
                </button>
              )}
              <button className="bouton-contour" onClick={() => aller({ onglet: 'agents', agent: detail.agent.prenom })}>
                Voir {detail.agent.prenom}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
