import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { enListe, useCommande, useEtatPlateforme } from '../../agents/plateforme'
import { Donnees, Estimation, Lu, NonRelie, Rubrique, estEstimation, type Ouvrir } from './Commun'

/**
 * Create (§9, §14): the composed companies of this customer — projects, their
 * five phases, milestones and recommended teams — as `GET /create/box/projets`
 * returns them (`ProjetCree`, shape given by the create module on 07/10). Every
 * figure there is an estimate: it is shown as a range with its assumptions,
 * never as a single number.
 */

type MembreEquipe = { agent_id?: string; metier?: string; role?: string; pourquoi?: string; licence?: string }
type Phase = {
  numero?: string
  nom?: string
  objectif?: string
  duree_mois?: unknown
  equipe?: MembreEquipe[]
  budget?: { mensuel_ht?: number; detail?: string[]; total_ht?: unknown; consommation_ia?: unknown }
  jalons?: string[]
  responsabilites_humaines?: string[]
}
type Projet = {
  id?: string
  titre?: string
  cree_le?: string
  phases?: Phase[]
  box_recommandee?: { plan_id?: string; nombre?: number; motif?: string }
  budget_total_ht?: unknown
  prix_provisoires?: boolean
  avertissement?: string
}

function Chiffre({ v }: { v: unknown }) {
  if (estEstimation(v)) return <Estimation e={v} />
  return <Donnees valeur={v} />
}

function PhaseVue({ p }: { p: Phase }) {
  return (
    <details className="phase">
      <summary>
        <span className="phase-numero">{p.numero ?? '—'}</span>
        <strong>{p.nom ?? 'Phase'}</strong>
        {p.equipe && <span className="precision"> · {p.equipe.length} agent(s)</span>}
        {p.jalons && <span className="precision"> · {p.jalons.length} jalon(s)</span>}
      </summary>
      {p.objectif && <p>{p.objectif}</p>}
      {p.duree_mois !== undefined && (
        <p>
          Durée : <Chiffre v={p.duree_mois} />
        </p>
      )}
      {p.equipe && (
        <div className="projet-bloc">
          <h4>Équipe recommandée</h4>
          <ul className="projet-etapes">
            {p.equipe.map((m, i) => (
              <li key={i}>
                <strong>{m.role ?? m.metier}</strong>
                {m.metier && m.role && <span className="precision"> · {m.metier}</span>}
                {m.agent_id && <span className="precision"> · {m.agent_id}</span>}
                {m.licence && <span className="precision"> · licence {m.licence}</span>}
                {m.pourquoi && <p className="precision">{m.pourquoi}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.jalons && (
        <div className="projet-bloc">
          <h4>Jalons</h4>
          <ol className="projet-etapes">
            {p.jalons.map((j, i) => (
              <li key={i}>{j}</li>
            ))}
          </ol>
        </div>
      )}
      {p.budget && (
        <div className="projet-bloc">
          <h4>Budget de la phase</h4>
          {p.budget.detail && (
            <ul className="projet-etapes">
              {p.budget.detail.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
          {p.budget.total_ht !== undefined && (
            <p>
              Total : <Chiffre v={p.budget.total_ht} />
            </p>
          )}
          {p.budget.consommation_ia !== undefined && (
            <p>
              Consommation d'IA : <Chiffre v={p.budget.consommation_ia} />
            </p>
          )}
        </div>
      )}
      {p.responsabilites_humaines && (
        <div className="projet-bloc">
          <h4>Ce qui reste à un humain</h4>
          <ul className="projet-etapes">
            {p.responsabilites_humaines.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </details>
  )
}

export default function Create({ onOuvrir }: { onOuvrir: Ouvrir }) {
  const etat = useEtatPlateforme()
  const relie = etat.donnee?.relie ?? false
  const projets = useCommande<unknown>('plateforme_projets', relie)
  const [etude, setEtude] = useState('')
  const [dit, setDit] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const creer = async () => {
    setEnvoi(true)
    setDit(null)
    try {
      await invoke('plateforme_projet_creer', { etudeId: etude.trim() })
      setDit('Projet composé par la plateforme.')
      setEtude('')
      projets.relire()
    } catch (e) {
      setDit(String(e))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="page commander">
      <h2 className="titre-neon">Create</h2>
      <p className="subtitle">Projets, phases, jalons et équipes recommandées.</p>

      {!relie ? (
        <NonRelie etat={etat.donnee} onOuvrir={onOuvrir} quoi="La liste de vos projets Create" />
      ) : (
        <>
          <Rubrique titre="Nouveau projet depuis une étude">
            <div className="formulaire-ligne">
              <input
                value={etude}
                onChange={(e) => setEtude(e.target.value)}
                placeholder="Identifiant de l'étude (et_…, reçu sur le site)"
                aria-label="Identifiant de l'étude"
              />
              <button className="commander-action principal" onClick={creer} disabled={!etude.trim() || envoi}>
                Composer l'entreprise
              </button>
            </div>
            {dit && <p className="precision">{dit}</p>}
          </Rubrique>

          <Rubrique
            titre="Vos projets"
            action={
              <button className="commander-action" onClick={projets.relire} disabled={projets.charge}>
                Relire
              </button>
            }
          >
            <Lu lecture={projets}>
              {(d) => {
                const liste = enListe(d, ['projets']) as Projet[] | null
                if (!liste) return <Donnees valeur={d} />
                if (liste.length === 0) return <p className="vide">Aucun projet pour l'instant.</p>
                return (
                  <div className="projets">
                    {liste.map((p, i) => (
                      <article key={p.id ?? i} className="projet">
                        <h3>{p.titre ?? p.id ?? `Projet ${i + 1}`}</h3>
                        {p.prix_provisoires && (
                          <p className="avertissement-banner">
                            Prix provisoires : tarifs de test du MASTER, pas encore ceux du moteur de tarifs.
                          </p>
                        )}
                        {p.avertissement && <p className="precision">{p.avertissement}</p>}
                        {p.budget_total_ht !== undefined && (
                          <p>
                            Budget total : <Chiffre v={p.budget_total_ht} />
                          </p>
                        )}
                        {p.box_recommandee && (
                          <p>
                            Box recommandée : {p.box_recommandee.nombre ?? '—'} × {p.box_recommandee.plan_id ?? '—'}
                            {p.box_recommandee.motif && <span className="precision"> — {p.box_recommandee.motif}</span>}
                          </p>
                        )}
                        {(p.phases ?? []).map((ph, j) => (
                          <PhaseVue key={ph.numero ?? j} p={ph} />
                        ))}
                      </article>
                    ))}
                  </div>
                )
              }}
            </Lu>
          </Rubrique>
        </>
      )}
    </div>
  )
}
