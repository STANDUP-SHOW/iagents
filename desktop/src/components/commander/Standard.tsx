import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { DECISIONS, dateFr, enListe, useCommande, useEtatPlateforme } from '../../agents/plateforme'
import { Donnees, Lu, NonRelie, Rubrique, SansSource, type Ouvrir } from './Commun'

/**
 * Voice (§11, §12, §14): the switchboard seen from the Box. History, costs and
 * the pending human handoffs come from the `box` routes of the Voice Hub; the
 * switchboard rules, numbers, extensions, queues and campaigns are `admin`
 * routes in the contract, so the Box cannot read them and says so.
 */

/** The fields of `Call` (plateforme/modele.ts) the history shows when present. */
type Appel = {
  id?: string
  direction?: string
  appelant?: string
  appele?: string
  debut?: string
  duree_s?: number
  resume?: string | null
  issue?: string
  cout?: { total?: number; devise?: string } | null
  /** Voice Hub: which rate is missing when `cout` is null. */
  cout_manquants?: string[]
  motif?: string
}

const ISSUES: Record<string, string> = {
  traite: 'traité par l’agent',
  'transfere-agent': 'transféré à un agent',
  'transfere-humain': 'transféré à un humain',
  messagerie: 'messagerie',
  rappel: 'rappel prévu',
  abandonne: 'abandonné',
}

const duree = (s?: number) => (s == null ? '—' : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`)

function Prises({ onDecide }: { onDecide: () => void }) {
  const handoffs = useCommande<unknown>('plateforme_handoffs', true, undefined, 5000)
  const [dit, setDit] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState<string | null>(null)

  const decider = async (appel: string, decision: string) => {
    setEnvoi(appel)
    try {
      await invoke('plateforme_handoff_decider', { appel, decision })
      setDit((d) => ({ ...d, [appel]: 'Décision transmise.' }))
      handoffs.relire()
      onDecide()
    } catch (e) {
      setDit((d) => ({ ...d, [appel]: String(e) }))
    } finally {
      setEnvoi(null)
    }
  }

  return (
    <Lu lecture={handoffs}>
      {(d) => {
        const liste = (enListe(d, ['handoffs', 'demandes']) ?? []) as (Appel & { appel?: string; appel_id?: string })[]
        if (liste.length === 0) return <p className="vide">Aucune demande de prise en main en attente.</p>
        return (
          <ul className="lignes-commander">
            {liste.map((h, i) => {
              const id = h.appel_id ?? h.appel ?? h.id ?? ''
              return (
                <li key={id || i} className="ligne-commander ligne-handoff">
                  <div className="handoff-texte">
                    <strong>{h.appelant ?? 'Appelant inconnu'}</strong>
                    {h.motif && <p>{h.motif}</p>}
                    {h.resume && <p className="precision">{h.resume}</p>}
                    {!id && <p className="lecture-refus">La demande ne porte pas d'identifiant d'appel : aucune décision ne peut lui être rendue.</p>}
                    {dit[id] && <p className="precision">{dit[id]}</p>}
                  </div>
                  <div className="decisions">
                    {DECISIONS.map((x) => (
                      <button
                        key={x.decision}
                        className={x.decision === 'prendre' ? 'commander-action principal' : 'commander-action'}
                        disabled={!id || envoi === id}
                        onClick={() => decider(id, x.decision)}
                      >
                        {x.libelle}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )
      }}
    </Lu>
  )
}

export default function Standard({ onOuvrir }: { onOuvrir: Ouvrir }) {
  const etat = useEtatPlateforme()
  const relie = etat.donnee?.relie ?? false
  const appels = useCommande<unknown>('plateforme_appels', relie)
  const conso = useCommande<unknown>('plateforme_consommation', relie)

  if (!relie) {
    return (
      <div className="page commander">
        <h2 className="titre-neon">Voice</h2>
        <p className="subtitle">Standard, appels, coûts et prise en main humaine.</p>
        <NonRelie etat={etat.donnee} onOuvrir={onOuvrir} quoi="Tout ce que le standard a reçu et coûté" />
        <ReglesAdmin />
      </div>
    )
  }

  return (
    <div className="page commander">
      <h2 className="titre-neon">Voice</h2>
      <p className="subtitle">Standard, appels, coûts et prise en main humaine.</p>

      <Rubrique titre="Prise en main humaine">
        <Prises onDecide={appels.relire} />
      </Rubrique>

      <Rubrique
        titre="Historique des appels"
        action={
          <button className="commander-action" onClick={appels.relire} disabled={appels.charge}>
            Relire
          </button>
        }
      >
        <Lu lecture={appels}>
          {(d) => {
            const liste = enListe(d, ['appels']) as Appel[] | null
            if (!liste) return <Donnees valeur={d} />
            if (liste.length === 0) return <p className="vide">Aucun appel enregistré.</p>
            return (
              <ul className="lignes-commander">
                {liste.map((a, i) => (
                  <li key={a.id ?? i} className="ligne-commander">
                    <div>
                      <strong>{a.direction === 'sortant' ? `vers ${a.appele ?? '—'}` : `de ${a.appelant ?? '—'}`}</strong>
                      <span className="precision"> · {dateFr(a.debut)} · {duree(a.duree_s)}</span>
                      {a.resume && <p>{a.resume}</p>}
                    </div>
                    <div className="ligne-droite">
                      <span className="pastille">{a.issue ? ISSUES[a.issue] ?? a.issue : '—'}</span>
                      {a.cout == null && a.cout_manquants && a.cout_manquants.length > 0 && (
                        <span className="precision">coût non chiffré : {a.cout_manquants.join(', ')}</span>
                      )}
                      {a.cout?.total != null && (
                        <span className="precision">
                          {a.cout.total.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} {a.cout.devise ?? ''}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )
          }}
        </Lu>
      </Rubrique>

      <Rubrique titre="Coûts du mois">
        <Lu lecture={conso}>{(d) => <Donnees valeur={d} />}</Lu>
      </Rubrique>

      <ReglesAdmin />
    </div>
  )
}

/** What the contract keeps on the back-office side, named rather than faked. */
function ReglesAdmin() {
  return (
    <Rubrique titre="Standard, numéros, extensions, files, campagnes">
      <SansSource>
        Ces réglages se posent au back-office iAgent (routes d'administration du Voice Hub). Le contrat de la
        plateforme ne donne à la Box aucune route pour les lire : cet écran ne les montre donc pas, plutôt que d'en
        montrer une copie qui pourrait être fausse.
      </SansSource>
    </Rubrique>
  )
}
