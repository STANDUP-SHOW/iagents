import type { AgentInstalle } from '../../agents/fiche'
import { Rubrique, SansSource, type Ouvrir } from './Commun'

/**
 * Validations (Approvals, §14): signatures, expenses, contracts, sensitive
 * actions.
 *
 * What feeds it today, verified: the tasks the customer put under control in
 * his planning (`validationHumaine` on an active task — the agent waits for his
 * agreement, `accord_attendu` in tache.rs) and the e-mail drafts, which never
 * leave without the exact text being read (Courrier). Nothing in the platform
 * contract carries signatures, expenses or contracts to approve, and nothing on
 * this workstation produces them: the screen says it instead of listing
 * placeholders.
 */
export default function Validations({ installes, onOuvrir }: { installes: readonly AgentInstalle[]; onOuvrir: Ouvrir }) {
  const sousControle = installes.flatMap((a) =>
    a.planning.filter((t) => t.active && t.validationHumaine).map((t) => ({ agent: a.prenom, tache: t }))
  )

  return (
    <div className="page commander">
      <h2 className="titre-neon">Validations</h2>
      <p className="subtitle">Ce qui attend votre accord avant de partir.</p>

      <Rubrique
        titre="Actions sensibles : tâches sous contrôle"
        action={
          <button className="commander-action" onClick={() => onOuvrir('travail')}>
            Le travail du jour
          </button>
        }
      >
        {sousControle.length === 0 ? (
          <p className="vide">
            Aucune tâche sous contrôle : vos agents travaillent seuls. Une tâche se met sous contrôle depuis l'équipe ou
            l'entretien d'embauche.
          </p>
        ) : (
          <ul className="lignes-commander">
            {sousControle.map(({ agent, tache }) => (
              <li key={`${agent}-${tache.id}`} className="ligne-commander">
                <div>
                  <strong>{agent}</strong> · {tache.nom}
                </div>
                <span className="pastille ton-alerte">attend votre accord</span>
              </li>
            ))}
          </ul>
        )}
      </Rubrique>

      <Rubrique
        titre="Courriels à relire"
        action={
          <button className="commander-action" onClick={() => onOuvrir('courriel')}>
            Ouvrir le courrier
          </button>
        }
      >
        <p>Aucun courriel ne part sans que vous ayez relu le texte exact : la relecture se fait dans Courrier.</p>
      </Rubrique>

      <Rubrique titre="Signatures, dépenses, contrats">
        <SansSource>
          Rien ne les produit encore : aucune route de la plateforme ne transmet de signature, de dépense ou de contrat
          à valider, et aucun agent de ce poste n'en prépare. Cette liste restera vide tant que ce maillon n'existe pas,
          plutôt que d'afficher des exemples.
        </SansSource>
      </Rubrique>
    </div>
  )
}
