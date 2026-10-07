import type { AgentInstalle } from '../../agents/fiche'
import { estTeamHolder } from '../../agents/team-holder'
import { dateFr, droitDe, enListe, useCommande, useEtatPlateforme } from '../../agents/plateforme'
import { Donnees, Lu, NonRelie, Rubrique, type Ouvrir } from './Commun'

/**
 * Workforce (§14): the agents of this Box, their teams, the Task Commander and
 * the Skill Packs. Agents and teams are read on this workstation; rights and
 * Skills come from the platform.
 */
export default function Workforce({ installes, onOuvrir }: { installes: readonly AgentInstalle[]; onOuvrir: Ouvrir }) {
  const etat = useEtatPlateforme()
  const relie = etat.donnee?.relie ?? false
  const skills = useCommande<unknown>('plateforme_skills', relie)
  const chef = installes.find((a) => estTeamHolder(a))
  const agents = installes.filter((a) => !estTeamHolder(a))
  const commander = etat.donnee?.licence.droits.some((d) => d.licence === 'commander') ?? false

  return (
    <div className="page commander">
      <h2 className="titre-neon">Workforce</h2>
      <p className="subtitle">Vos agents, leurs équipes, le Task Commander et les Skills.</p>

      <Rubrique titre="Agents">
        {installes.length === 0 ? (
          <p className="vide">Aucun agent embauché sur ce poste.</p>
        ) : (
          <ul className="lignes-commander">
            {installes.map((a) => {
              const droit = droitDe(etat.donnee, a.fiche.id)
              return (
                <li key={a.prenom} className="ligne-commander">
                  <div>
                    <strong>{a.prenom}</strong> · {a.fiche.nom}
                    <span className="precision"> {a.fiche.id}</span>
                  </div>
                  {!relie ? (
                    <span className="pastille">poste non relié : aucune licence exigée</span>
                  ) : droit ? (
                    <span className="pastille ton-succes">
                      droit {droit.licence}
                      {droit.fin ? ` jusqu'au ${dateFr(droit.fin)}` : ''}
                    </span>
                  ) : (
                    <span className="pastille ton-danger">aucun droit valide : ne s'exécute pas</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Rubrique>

      <Rubrique
        titre="Équipes"
        action={
          <button className="commander-action" onClick={() => onOuvrir('equipe')}>
            Ouvrir l'équipe
          </button>
        }
      >
        <p>
          {chef ? `${chef.prenom} tient l'équipe` : 'Aucun Team Holder embauché'} ·{' '}
          {agents.length} agent{agents.length > 1 ? 's' : ''} sur ce poste.
        </p>
      </Rubrique>

      <Rubrique
        titre="Task Commander"
        action={
          <button className="commander-action" onClick={() => onOuvrir('travail')}>
            Le travail du jour
          </button>
        }
      >
        {!relie ? (
          <p>Poste non relié : la licence Task Commander ne peut pas être lue.</p>
        ) : commander ? (
          <p>La licence Task Commander figure dans les droits de cette Box.</p>
        ) : (
          <p>Aucune licence Task Commander dans les droits de cette Box.</p>
        )}
      </Rubrique>

      <Rubrique
        titre="Skills"
        action={
          relie ? (
            <button className="commander-action" onClick={skills.relire} disabled={skills.charge}>
              Relire
            </button>
          ) : undefined
        }
      >
        {!relie ? (
          <NonRelie etat={etat.donnee} onOuvrir={onOuvrir} quoi="La liste des Skill Packs validés" />
        ) : (
          <Lu lecture={skills}>
            {(d) => {
              const liste = enListe(d, ['skills', 'skill_packs'])
              return liste && liste.length === 0 ? (
                <p className="vide">Aucun Skill Pack validé pour les agents de cette Box.</p>
              ) : (
                <Donnees valeur={liste ?? d} />
              )
            }}
          </Lu>
        )}
      </Rubrique>
    </div>
  )
}
