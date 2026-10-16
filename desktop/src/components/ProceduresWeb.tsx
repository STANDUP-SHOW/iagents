import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/** Les champs portent les noms de `Procedure` dans procedure.rs. */
type Attente = { raison: string; demande: string; outil: string; depuis: number }
type Pas = { quand: number; geste: string; issue: string; reussi: boolean }
export type Procedure = {
  id: string
  titre: string
  consigne: string
  statut: string
  attente: Attente | null
  journal: Pas[]
  resultat: string | null
  erreur: string | null
  commencee: number
  modifiee: number
  gestes: number
}

const STATUTS: Record<string, string> = {
  'en-file': 'attend le navigateur',
  'en-cours': 'en cours',
  'en-attente': 'attend votre réponse',
  interrompue: 'interrompue',
  terminee: 'terminée',
  echec: 'non aboutie',
  abandonnee: 'abandonnée',
}

function heure(secondes: number): string {
  return new Date(secondes * 1000).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * Le travail des agents sur le web : ce qu'on leur confie, où ils en sont, et
 * la question qu'ils posent quand il leur faut un code ou une décision. Les
 * autres procédures et le reste du travail continuent pendant ce temps.
 */
export default function ProceduresWeb() {
  const [liste, setListe] = useState<Procedure[]>([])
  const [titre, setTitre] = useState('')
  const [consigne, setConsigne] = useState('')
  const [reponses, setReponses] = useState<Record<string, string>>({})
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [dossier, setDossier] = useState('')
  const [erreur, setErreur] = useState('')

  const recharger = () =>
    invoke<Procedure[]>('procedure_liste')
      .then(setListe)
      .catch((e) => setErreur(String(e)))

  useEffect(() => {
    recharger()
    invoke<string>('procedure_dossier_televersements').then(setDossier).catch(() => {})
    const fin = listen<Procedure>('procedure', (e) => {
      setListe((l) => [e.payload, ...l.filter((p) => p.id !== e.payload.id)].sort((a, b) => b.modifiee - a.modifiee))
    })
    return () => {
      fin.then((f) => f())
    }
  }, [])

  const agir = async (commande: string, args: Record<string, string>) => {
    setErreur('')
    try {
      await invoke(commande, args)
      await recharger()
      return true
    } catch (e) {
      setErreur(String(e))
      return false
    }
  }

  const lancer = async () => {
    if (await agir('procedure_lancer', { titre, consigne })) {
      setTitre('')
      setConsigne('')
    }
  }

  const reprendre = async (id: string, reponse: string) => {
    if (await agir('procedure_reprendre', { id, reponse })) setReponses((r) => ({ ...r, [id]: '' }))
  }

  const enAttente = liste.filter((p) => p.statut === 'en-attente')

  return (
    <section className="procedures-web">
      <h3>Le travail de vos agents sur le web</h3>
      <p>
        Confiez une procédure : une inscription, un formulaire, une fiche à remplir. L’agent lit les pages, remplit, envoie et vérifie
        seul dans ce navigateur. S’il lui faut un code reçu par SMS ou e-mail, un captcha ou une décision, il vous le demande ici et
        continue le reste de son travail. Votre réponse le fait repartir au geste exact où il s’était arrêté.
      </p>

      {erreur && <div className="error-banner">{erreur}</div>}

      {enAttente.length > 0 && (
        <div className="procedures-attente">
          {enAttente.map((p) => (
            <div key={p.id} className="procedure-question">
              <strong>{p.titre}</strong>
              <p>{p.attente?.demande}</p>
              <p className="precision">
                {p.attente?.raison} · depuis {p.attente ? heure(p.attente.depuis) : ''}. Vous pouvez aussi agir vous-même dans la fenêtre
                du navigateur, puis répondre « c’est fait ».
              </p>
              <div className="ligne">
                <input
                  type="text"
                  placeholder="Votre réponse"
                  value={reponses[p.id] ?? ''}
                  onChange={(e) => setReponses((r) => ({ ...r, [p.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && reprendre(p.id, reponses[p.id] ?? '')}
                />
                <button disabled={!(reponses[p.id] ?? '').trim()} onClick={() => reprendre(p.id, reponses[p.id] ?? '')}>
                  Répondre et reprendre
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="procedure-nouvelle">
        <input type="text" placeholder="Titre : Inscription sur Product Hunt" value={titre} onChange={(e) => setTitre(e.target.value)} />
        <textarea
          rows={6}
          placeholder={
            'Ce que l’agent doit faire, sur quel site, avec quelles informations.\n' +
            'Ex. : Crée le compte de l’entreprise sur https://… — nom : iAgent, e-mail : contact@iagent.agency, ' +
            'description : …, logo : logo.png, bannière : banniere.png. C’est fini quand la page du profil est publiée.'
          }
          value={consigne}
          onChange={(e) => setConsigne(e.target.value)}
        />
        <div className="ligne">
          <button disabled={!titre.trim() || !consigne.trim()} onClick={lancer}>
            Confier à un agent
          </button>
          {dossier && <span className="precision">Logos et bannières à joindre : {dossier}</span>}
        </div>
      </div>

      {liste.length > 0 && (
        <ul className="procedures-liste">
          {liste.map((p) => (
            <li key={p.id}>
              <div className="ligne">
                <span className="site-nom">{p.titre}</span>
                <span className={`procedure-statut statut-${p.statut}`}>{STATUTS[p.statut] ?? p.statut}</span>
                <span className="precision">{heure(p.modifiee)}</span>
                <button className="lien" onClick={() => setOuverte(ouverte === p.id ? null : p.id)}>
                  {ouverte === p.id ? 'Masquer' : 'Détail'}
                </button>
                {p.statut === 'interrompue' && (
                  <button className="lien" onClick={() => reprendre(p.id, '')}>
                    Reprendre
                  </button>
                )}
                {['en-attente', 'interrompue'].includes(p.statut) && (
                  <button className="lien" onClick={() => agir('procedure_abandonner', { id: p.id })}>
                    Abandonner
                  </button>
                )}
              </div>
              {p.erreur && <p className="lecture-refus">{p.erreur}</p>}
              {p.resultat && <p className="procedure-resultat">{p.resultat}</p>}
              {ouverte === p.id && (
                <ol className="procedure-journal">
                  {p.journal.map((g, i) => (
                    <li key={i} className={g.reussi ? '' : 'rate'}>
                      <span className="precision">{heure(g.quand)}</span> {g.geste}
                      {g.issue && <span className="precision"> — {g.issue}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
