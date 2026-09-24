import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { installerAgents, type AgentInstalle, type Fiche, type Installation } from '../agents/fiche'
import { travailDuJour, resumeDuTravail, type TacheDuJour } from '../agents/travail'

/**
 * Le travail du jour.
 *
 * C'est l'écran qui manquait au parcours minimal : les fiches décrivent le
 * travail de 1 249 métiers et rien, dans l'application, ne permettait d'en faire
 * exécuter un. Le client voit ce que son agent peut faire maintenant, le lance,
 * et retrouve le fichier dans son dossier.
 *
 * Une tâche qui ne peut pas aboutir n'a pas de bouton : elle dit ce qui lui
 * manque. Un bouton qui échoue après le clic apprend au client à ne plus
 * cliquer.
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

export default function Travail() {
  const [agents, setAgents] = useState<AgentInstalle[]>([])
  const [choisi, setChoisi] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)
  const [resultats, setResultats] = useState<Record<string, Resultat>>({})
  const [echecs, setEchecs] = useState<Record<string, string>>({})
  const [motif, setMotif] = useState<string | null>(null)
  const [chezLui, setChezLui] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    invoke<string>('lire_installation')
      .then(async (brut) => {
        const installation = JSON.parse(brut) as { agents?: Installation[] }
        const poses = installation.agents ?? []
        const fiches = await Promise.all(
          [...new Set(poses.map((a) => a.ficheId))].map(async (id) =>
            JSON.parse(await invoke<string>('lire_fiche', { id })) as Fiche
          )
        )
        if (!vivant) return
        const installes = installerAgents(fiches, poses)
        setAgents(installes)
        setChoisi((c) => c ?? installes[0]?.prenom ?? null)
      })
      .catch((e) => vivant && setMotif(String(e)))
    return () => {
      vivant = false
    }
  }, [])

  const agent = useMemo(() => agents.find((a) => a.prenom === choisi) ?? null, [agents, choisi])

  // Où l'agent travaille : le client doit pouvoir y déposer ce qu'il veut faire
  // traiter et y retrouver les résultats.
  useEffect(() => {
    if (!agent) return
    let vivant = true
    invoke<string>('dossier_de_travail', { prenom: agent.prenom, ficheId: agent.fiche.id })
      .then((d) => vivant && setChezLui(d))
      .catch(() => vivant && setChezLui(null))
    return () => {
      vivant = false
    }
  }, [agent])
  const travail = useMemo<TacheDuJour[]>(() => (agent ? travailDuJour(agent) : []), [agent])

  async function lancer(t: TacheDuJour) {
    if (!agent || enCours) return
    const clef = `${agent.prenom}:${t.tache.id}`
    setEnCours(clef)
    setEchecs((e) => ({ ...e, [clef]: '' }))
    try {
      const r = await invoke<Resultat>('executer_tache', {
        prenom: agent.prenom,
        ficheId: agent.fiche.id,
        tacheId: t.tache.id,
      })
      setResultats((x) => ({ ...x, [clef]: r }))
    } catch (e) {
      setEchecs((x) => ({ ...x, [clef]: String(e) }))
    } finally {
      setEnCours(null)
    }
  }

  if (motif) {
    return (
      <div className="travail">
        <h2>Le travail du jour</h2>
        <p className="vide">{motif}</p>
      </div>
    )
  }

  return (
    <div className="travail">
      <h2>Le travail du jour</h2>

      {agents.length === 0 && (
        <p className="vide">Aucun agent n'est encore embauché sur cet ordinateur.</p>
      )}

      {agents.length > 1 && (
        <div className="equipe">
          {agents.map((a) => (
            <button
              key={a.prenom}
              className={a.prenom === choisi ? 'actif' : ''}
              onClick={() => setChoisi(a.prenom)}
            >
              {a.prenom}
            </button>
          ))}
        </div>
      )}

      {agent && (
        <>
          <p className="resume">
            {agent.prenom}, {agent.fiche.nom.toLowerCase()}. {resumeDuTravail(travail)}
          </p>
          {chezLui && (
            <p className="chez-lui">
              {agent.prenom} travaille dans {chezLui}. Déposez-y ce que vous voulez lui faire
              traiter, c'est aussi là que ses résultats arrivent.
            </p>
          )}

          <ul className="taches">
            {travail.map((t) => {
              const clef = `${agent.prenom}:${t.tache.id}`
              const resultat = resultats[clef]
              const echec = echecs[clef]
              return (
                <li key={t.tache.id} className={t.empechement ? 'attente' : ''}>
                  <div className="entete">
                    <span className="nom">{t.tache.nom}</span>
                    {t.empechement ? (
                      <span className="empechement">{t.empechement}</span>
                    ) : (
                      <button disabled={enCours !== null} onClick={() => lancer(t)}>
                        {enCours === clef ? 'en cours…' : 'Lancer'}
                      </button>
                    )}
                  </div>
                  <p className="quoi">{t.tache.description}</p>
                  {t.sansMatiere && !resultat && (
                    <p className="controle">
                      Rien ne dit où {agent.prenom} prend sa matière : il vous dira ce qu'il lui
                      faut plutôt que de l'inventer.
                    </p>
                  )}
                  {t.validation && !resultat && (
                    <p className="controle">Vous relirez le résultat avant qu'il serve.</p>
                  )}
                  {resultat && (
                    <p className="fait">
                      Écrit dans {resultat.fichier}, {VOIES[resultat.voie] ?? resultat.voie}.
                      {resultat.validation_humaine && ' Rien n\'a été envoyé : le résultat vous attend.'}
                    </p>
                  )}
                  {echec && <p className="rate">{echec}</p>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
