import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * L'empreinte vocale : enregistrer sa voix, puis vérifier qu'elle est reconnue.
 *
 * Cet écran existait avant, et refusait exprès : son bouton d'enregistrement ne
 * faisait qu'afficher « pas encore disponible ». Il avait raison deux fois. Rien
 * ici ne captait le microphone — la capture vivait sur l'état de la
 * transcription, donc derrière un modèle de 190 Mo qui ne s'était jamais
 * téléchargé — et l'extracteur de l'époque ne distinguait pas deux voix : mesuré
 * le 25/09/2026, deux personnes différentes obtenaient un meilleur score que la
 * même personne enregistrée deux fois.
 *
 * Les deux sont corrigés (`voice::capturer`, `voiceprint`), et le son ne traverse
 * pas cet écran : Rust garde les phrases le temps de l'entretien et n'en sort que
 * douze nombres. Ce qui reste vrai, et que la page dit au client : **ce n'est pas
 * un mot de passe et ça n'ouvre rien.**
 */

/** Ce que rend `empreinte_verifier`, avec les noms de champs de Rust. */
type Comparaison = {
  /** La ressemblance, de 0 à 1. */
  score: number
  /** Ce à quoi elle est comparée : la cohérence des phrases d'origine. */
  reference: number
  /** La phrase en français à afficher. */
  verdict: string
}

/** Combien de phrases l'entretien demande. */
const PHRASES = [
  'Bonjour, je suis le propriétaire de cette machine.',
  'Aujourd’hui le temps est couvert sur toute la région.',
  'Mon équipe commence son travail à huit heures.',
]

/** La durée d'un enregistrement, en secondes. */
const SECONDES = 3

const pourcent = (v: number) => `${Math.round(v * 100)} %`

export default function VoiceTraining() {
  const [etape, setEtape] = useState<'intro' | 'enregistrement' | 'faite'>('intro')
  const [faites, setFaites] = useState(0)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState('')
  const [presente, setPresente] = useState<boolean | null>(null)
  const [comparaison, setComparaison] = useState<Comparaison | null>(null)

  // Demandé à l'ouverture : sans ça, l'écran proposerait de vérifier une voix que
  // personne n'a enregistrée, et le refus tomberait après les trois secondes.
  useEffect(() => {
    invoke<boolean>('empreinte_presente')
      .then(setPresente)
      .catch(() => setPresente(false))
  }, [])

  const commencer = async () => {
    setErreur('')
    setComparaison(null)
    try {
      await invoke<number>('empreinte_oublier')
    } catch {
      // Oublier ce qui n'existe pas n'est pas une faute.
    }
    setFaites(0)
    setEtape('enregistrement')
  }

  const enregistrerUnePhrase = async () => {
    setErreur('')
    setEnCours(true)
    try {
      // `secondes` devient `secondes` en Rust : Tauri convertit les arguments
      // d'une commande, ce sont les champs des structures qui gardent leur nom.
      setFaites(await invoke<number>('empreinte_capturer', { secondes: SECONDES }))
    } catch (e) {
      setErreur(String(e))
    } finally {
      setEnCours(false)
    }
  }

  const ranger = async () => {
    setErreur('')
    setEnCours(true)
    try {
      await invoke<number>('empreinte_enregistrer')
      setPresente(true)
      setEtape('faite')
    } catch (e) {
      setErreur(String(e))
    } finally {
      setEnCours(false)
    }
  }

  const verifier = async () => {
    setErreur('')
    setComparaison(null)
    setEnCours(true)
    try {
      setComparaison(await invoke<Comparaison>('empreinte_verifier', { secondes: SECONDES }))
    } catch (e) {
      setErreur(String(e))
    } finally {
      setEnCours(false)
    }
  }

  const recommencer = async () => {
    setErreur('')
    try {
      await invoke<number>('empreinte_oublier')
    } catch {
      // Idem.
    }
    setFaites(0)
    setEtape('intro')
  }

  return (
    <div className="voice-training">
      <h2>Votre voix</h2>

      {erreur && <div className="error-banner">{erreur}</div>}

      {etape === 'intro' && (
        <div className="training-section">
          <h3>Enregistrer votre voix</h3>
          <p>
            Vos agents pourront reconnaître que c’est bien vous qui parlez.
            {presente === true && ' Une empreinte est déjà enregistrée sur cet ordinateur.'}
          </p>
          <div className="enrollment-info">
            <p>
              Vous direz <strong>{PHRASES.length} phrases</strong> de {SECONDES} secondes.
            </p>
            <ul>
              <li>Parlez normalement, à la distance habituelle du microphone</li>
              <li>Les mots exacts n’ont pas d’importance : c’est le timbre qui compte</li>
              <li>L’empreinte reste sur cet ordinateur, le son n’en sort pas</li>
            </ul>
          </div>
          <p className="empreinte-avertissement">
            Ce n’est pas un mot de passe. Le résultat est une indication affichée ;
            il n’autorise rien et ne déverrouille rien.
          </p>
          <button className="btn-primary" onClick={commencer} disabled={enCours}>
            {presente === true ? 'Recommencer l’enregistrement' : 'Commencer l’enregistrement'}
          </button>
          {presente === true && (
            <button className="btn-secondary" onClick={() => setEtape('faite')}>
              Vérifier ma voix
            </button>
          )}
        </div>
      )}

      {etape === 'enregistrement' && (
        <div className="training-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(faites / PHRASES.length) * 100}%` }}
            />
          </div>
          <p className="progress-label">
            {faites} phrase{faites > 1 ? 's' : ''} sur {PHRASES.length}
          </p>

          {faites < PHRASES.length ? (
            <>
              <h3>Dites cette phrase :</h3>
              <div className="phrase-display">
                <p className="phrase-text">« {PHRASES[faites]} »</p>
              </div>

              <div className="recording-indicator">
                {enCours ? (
                  <>
                    <span className="pulse animate">🎤</span>
                    <span className="recording-text">J’écoute, parlez…</span>
                  </>
                ) : (
                  <>
                    <span className="pulse">🎙️</span>
                    <span className="ready-text">Prêt à enregistrer</span>
                  </>
                )}
              </div>

              <button className="btn-primary" onClick={enregistrerUnePhrase} disabled={enCours}>
                {enCours ? 'Enregistrement…' : `Enregistrer la phrase ${faites + 1}`}
              </button>
            </>
          ) : (
            <>
              <h3>Les {PHRASES.length} phrases sont enregistrées</h3>
              <p>Il reste à ranger l’empreinte sur cet ordinateur.</p>
              <button className="btn-primary" onClick={ranger} disabled={enCours}>
                {enCours ? 'Enregistrement…' : 'Enregistrer mon empreinte'}
              </button>
            </>
          )}

          {faites > 0 && (
            <button className="btn-secondary" onClick={recommencer} disabled={enCours}>
              Recommencer
            </button>
          )}
        </div>
      )}

      {etape === 'faite' && (
        <div className="training-section success">
          <div className="success-icon">✓</div>
          <h3>Empreinte enregistrée</h3>
          <p>Elle est rangée sur cet ordinateur. Vous pouvez l’essayer tout de suite.</p>

          <div className="recording-indicator">
            {enCours ? (
              <>
                <span className="pulse animate">🎤</span>
                <span className="recording-text">J’écoute, dites quelque chose…</span>
              </>
            ) : (
              <>
                <span className="pulse">🎙️</span>
                <span className="ready-text">Dites n’importe quelle phrase</span>
              </>
            )}
          </div>

          <button className="btn-primary" onClick={verifier} disabled={enCours}>
            {enCours ? 'Enregistrement…' : 'Vérifier ma voix'}
          </button>

          {comparaison && (
            <div className="empreinte-verdict">
              <p className="empreinte-phrase">{comparaison.verdict}</p>
              <p className="empreinte-chiffres">
                Ressemblance {pourcent(comparaison.score)}, contre{' '}
                {pourcent(comparaison.reference)} entre vos phrases d’origine.
              </p>
            </div>
          )}

          <p className="empreinte-avertissement">
            Le résultat est une indication. Il n’a pas été éprouvé sur des voix
            proches et il n’autorise rien : vos agents répondent à leur prénom,
            pas à une voix.
          </p>

          <button className="btn-secondary" onClick={recommencer} disabled={enCours}>
            Recommencer l’enregistrement
          </button>
        </div>
      )}
    </div>
  )
}
