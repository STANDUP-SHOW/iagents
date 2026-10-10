import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Le client dit au chef d'équipe ce qu'il veut obtenir ; l'équipe le fait.
 *
 * Rien ne se décide ici : `mission_lancer` fait le plan, envoie chaque
 * spécialiste chercher et écrire, et fait écrire la synthèse. L'écran ne fait
 * qu'afficher ce que Rust annonce (événement « mission ») et ouvrir les
 * documents que l'équipe a écrits — `mission_ouvrir` refuse tout autre chemin.
 *
 * Les champs gardent les noms de Rust (`fichier_synthese`) : le dépôt n'emploie
 * pas `rename_all`.
 */

export interface Avancee {
  prenom: string
  poste: string
  consigne: string
  vague: number
  statut: 'a-faire' | 'en-cours' | 'fait' | 'echec'
  fichier: string | null
  erreur: string | null
  sources: number
}

export interface Mission {
  id: string
  demande: string
  chef: string
  reponse: string
  questions: string[]
  etapes: Avancee[]
  synthese: string | null
  fichier_synthese: string | null
  statut: 'en-cours' | 'terminee' | 'echec'
  commencee: number
}

const STATUTS: Record<Avancee['statut'], string> = {
  'a-faire': 'attend son tour',
  'en-cours': 'travaille',
  fait: 'fait',
  echec: 'empêché',
}

function nomDuFichier(chemin: string): string {
  return chemin.split(/[\\/]/).pop() ?? chemin
}

interface Props {
  /** Prénom du chef d'équipe embauché, s'il y en a un. */
  chef: string | null
}

export default function MissionEquipe({ chef }: Props) {
  const [demande, setDemande] = useState('')
  const [courante, setCourante] = useState<Mission | null>(null)
  const [anciennes, setAnciennes] = useState<Mission[]>([])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    invoke<Mission[]>('mission_historique')
      .then((l) => {
        setAnciennes(l)
        if (l.length > 0) setCourante((c) => c ?? l[0])
      })
      .catch(() => setAnciennes([]))
    let arret: (() => void) | undefined
    listen<Mission>('mission', (e) => setCourante(e.payload)).then((f) => {
      arret = f
    })
    return () => arret?.()
  }, [])

  const confier = async () => {
    const texte = demande.trim()
    if (!texte || enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      const m = await invoke<Mission>('mission_lancer', { demande: texte })
      setCourante(m)
      setDemande('')
      setAnciennes(await invoke<Mission[]>('mission_historique'))
    } catch (e) {
      setErreur(String(e))
    } finally {
      setEnCours(false)
    }
  }

  const ouvrir = async (fichier: string) => {
    try {
      await invoke('mission_ouvrir', { fichier })
    } catch (e) {
      setErreur(String(e))
    }
  }

  const nomChef = chef ?? 'Votre chef d’équipe'

  return (
    <section className="panneau mission">
      <h3>Dites à {chef ?? 'votre équipe'} ce que vous voulez obtenir</h3>
      <p className="subtitle">
        {nomChef} répartit le travail, chacun cherche sur le web et écrit son document, puis {chef ?? 'il'}{' '}
        vous rend le résultat et ce qu'il vous reste à valider. Rien n'est envoyé à personne.
      </p>
      <textarea
        className="mission-demande"
        rows={3}
        value={demande}
        onChange={(e) => setDemande(e.target.value)}
        placeholder="Par exemple : monte le business plan de Jobber Plus et trouve-moi les business angels et les aides publiques qui financent l'IA en France."
        disabled={enCours}
      />
      <div className="proposition-choix">
        <button className="touche-oui" onClick={confier} disabled={enCours || !demande.trim()}>
          {enCours ? 'L’équipe travaille…' : 'Confier à l’équipe'}
        </button>
      </div>

      {erreur && <div className="error-banner">{erreur}</div>}

      {courante && (
        <div className="mission-courante" aria-live="polite">
          <p className="mission-titre">« {courante.demande} »</p>
          {courante.reponse && (
            <p>
              <strong>{courante.chef} :</strong> {courante.reponse}
            </p>
          )}

          {courante.etapes.length > 0 && (
            <ul className="mission-etapes">
              {courante.etapes.map((e, i) => (
                <li key={`${e.prenom}-${i}`} className={`etape-${e.statut}`}>
                  <span className="membre-prenom">{e.prenom}</span>{' '}
                  <span className="membre-metier">{e.poste}</span>
                  <span className="etape-statut"> · {STATUTS[e.statut]}</span>
                  <div className="etape-consigne">{e.consigne}</div>
                  {e.fichier && (
                    <button onClick={() => ouvrir(e.fichier!)} title={e.fichier}>
                      Ouvrir {nomDuFichier(e.fichier)}
                      {e.sources > 0 ? ` (${e.sources} source${e.sources > 1 ? 's' : ''})` : ''}
                    </button>
                  )}
                  {e.erreur && <div className="etape-erreur">{e.erreur}</div>}
                </li>
              ))}
            </ul>
          )}

          {courante.synthese && (
            <div className="mission-synthese">
              <h4>Ce que {courante.chef} vous rend</h4>
              <div className="mission-texte">{courante.synthese}</div>
              {courante.fichier_synthese && (
                <button onClick={() => ouvrir(courante.fichier_synthese!)}>Ouvrir la synthèse</button>
              )}
            </div>
          )}

          {courante.questions.length > 0 && (
            <div className="mission-questions">
              <h4>Ce que {courante.chef} vous demande</h4>
              <ul>
                {courante.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {anciennes.length > 1 && (
        <details className="mission-anciennes">
          <summary>Missions précédentes</summary>
          <ul>
            {anciennes.map((m) => (
              <li key={m.id}>
                <button onClick={() => setCourante(m)}>
                  {new Date(m.commencee * 1000).toLocaleString('fr-FR')} · {m.demande}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
