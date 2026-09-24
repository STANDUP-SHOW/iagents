import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AgentInstalle } from '../agents/fiche'
import {
  changementEnMots,
  etatEquipe,
  estTeamHolder,
  type Changement,
  type Proposition,
} from '../agents/team-holder'

/**
 * Votre équipe : ce que tient le Team Holder. Ce qu'il propose de changer
 * attend ici le oui du client, et chaque changement fait se défait d'un geste.
 *
 * Rien ne se décide dans cet écran : le réglage passe par `equipe_regler`, qui
 * refuse ce qui sort des trois réglages permis et inscrit le changement.
 */

interface Props {
  installes: readonly AgentInstalle[]
  proposition: Proposition | null
  onAccepter: () => void
  onRefuser: () => void
  /** Change à chaque réglage appliqué, pour relire l'historique. */
  version: number
}

export default function Equipe({ installes, proposition, onAccepter, onRefuser, version }: Props) {
  const chef = installes.find((a) => estTeamHolder(a)) ?? null
  const equipe = etatEquipe(installes)
  const [changements, setChangements] = useState<Changement[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [relire, setRelire] = useState(0)

  useEffect(() => {
    invoke<Changement[]>('equipe_changements')
      .then((l) => {
        setChangements(l)
        setErreur(null)
      })
      .catch((e) => setErreur(String(e)))
  }, [version, relire])

  const annuler = async (id: string) => {
    try {
      await invoke<Changement>('equipe_annuler', { id })
      setRelire((n) => n + 1)
    } catch (e) {
      setErreur(String(e))
    }
  }

  return (
    <div className="page equipe">
      <h2 className="titre-neon">Votre équipe</h2>
      <p className="subtitle">
        {chef
          ? `${chef.prenom} tient vos agents pour vous : dites « Voice, ${chef.prenom} » et demandez-lui ce que fait l'équipe, ou ce qu'il faut changer.`
          : "Aucun Team Holder n'est embauché sur ce poste : chaque agent se règle à part, dans « Vos agents »."}
      </p>

      {proposition && (
        <section className="panneau proposition" aria-live="polite">
          <h3>{chef?.prenom ?? 'Le Team Holder'} vous demande</h3>
          <p className="proposition-phrase">{proposition.phrase}</p>
          <div className="proposition-choix">
            <button className="touche-oui" onClick={onAccepter}>
              Oui, faites-le
            </button>
            <button className="touche-non" onClick={onRefuser}>
              Non
            </button>
          </div>
        </section>
      )}

      {erreur && <div className="error-banner">{erreur}</div>}

      <section className="panneau">
        <h3>Qui fait quoi</h3>
        {equipe.length === 0 ? (
          <p className="vide">Aucun autre agent n'est embauché sur ce poste.</p>
        ) : (
          <div className="membres">
            {equipe.map((m) => (
              <article key={m.prenom} className="membre">
                <header>
                  <span className="membre-prenom">{m.prenom}</span>
                  <span className="membre-metier">{m.metier}</span>
                </header>
                <ul>
                  {m.taches.map((t) => (
                    <li key={t.id} className={t.active ? '' : 'eteinte'}>
                      <span className="tache-nom">{t.nom}</span>
                      <span className="tache-quand">
                        {t.active ? t.horaire : 'éteinte'}
                        {t.active && t.controle ? ' · en mode contrôle' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panneau">
        <h3>Ce qui a été changé</h3>
        {changements === null ? (
          <p className="vide">—</p>
        ) : changements.length === 0 ? (
          <p className="vide">Aucun réglage n'a encore été changé.</p>
        ) : (
          <ul className="changements">
            {[...changements].reverse().map((c) => (
              <li key={c.id} className={c.annule_le ? 'annule' : ''}>
                <span>{changementEnMots(c)}</span>
                {!c.annule_le && (
                  <button onClick={() => annuler(c.id)} title="Remettre le réglage d'avant">
                    Annuler
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
