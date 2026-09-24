import { useState } from 'react'

export default function VoiceTraining() {
  const [stage, setStage] = useState<'intro' | 'recording' | 'complete'>('intro')
  const [currentPhrase, setCurrentPhrase] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedCount, setRecordedCount] = useState(0)
  const [loading] = useState(false)
  const [error, setError] = useState('')

  const phrases = [
    'Ma voix est mon mot de passe',
    'Vérifie mon identité',
    'La sécurité par la voix',
  ]

  const handleStartTraining = () => {
    setStage('recording')
    setCurrentPhrase(0)
    setRecordedCount(0)
    setError('')
  }

  // L'empreinte vocale n'est pas implémentée : rien ne capte le micro ici, et
  // verify_voice renvoie une valeur fixe. Annoncer « voix enregistrée » ferait
  // croire à une reconnaissance qui, en l'état, accepte n'importe qui.
  const handleRecordUtterance = async () => {
    setIsRecording(false)
    setError(
      "L'empreinte vocale n'est pas encore disponible : l'agent ne reconnaît pas " +
        'qui parle. Il répond à son prénom, pas à une voix.'
    )
  }

  const handleReset = () => {
    setStage('intro')
    setCurrentPhrase(0)
    setRecordedCount(0)
    setError('')
  }

  return (
    <div className="voice-training">
      <h2>Votre voix</h2>

      {error && <div className="error-banner">{error}</div>}

      {stage === 'intro' && (
        <div className="training-section">
          <h3>Enregistrer votre voix</h3>
          <p>Créer une empreinte vocale pour que vos agents reconnaissent qui leur parle.</p>
          <div className="enrollment-info">
            <p>
              Vous enregistrerez <strong>3 phrases</strong> pour créer votre empreinte vocale.
            </p>
            <ul>
              <li>Parlez clairement et naturellement</li>
              <li>Chaque enregistrement dure environ 3 secondes</li>
              <li>L'empreinte reste sur cet ordinateur</li>
            </ul>
          </div>
          <button className="btn-primary" onClick={handleStartTraining}>
            Commencer l'enregistrement
          </button>
        </div>
      )}

      {stage === 'recording' && (
        <div className="training-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(recordedCount / 3) * 100}%` }} />
          </div>
          <p className="progress-label">
            Phrase {recordedCount + 1} sur 3
          </p>

          <h3>Dites cette phrase :</h3>
          <div className="phrase-display">
            <p className="phrase-text">« {phrases[currentPhrase]} »</p>
          </div>

          <div className="recording-indicator">
            {isRecording ? (
              <>
                <span className="pulse animate">🎤</span>
                <span className="recording-text">Enregistrement…</span>
              </>
            ) : (
              <>
                <span className="pulse">🎙️</span>
                <span className="ready-text">Prêt à enregistrer</span>
              </>
            )}
          </div>

          <button
            className="btn-primary"
            onClick={handleRecordUtterance}
            disabled={isRecording || loading}
          >
            {isRecording ? 'Enregistrement…' : `Enregistrer la phrase ${recordedCount + 1}`}
          </button>

          {recordedCount > 0 && (
            <button className="btn-secondary" onClick={handleReset} disabled={loading}>
              Recommencer
            </button>
          )}
        </div>
      )}

      {stage === 'complete' && (
        <div className="training-section success">
          <div className="success-icon">✓</div>
          <h3>Empreinte enregistrée</h3>
          <p>Votre empreinte vocale est créée et rangée sur cet ordinateur.</p>
          <div className="enrollment-benefits">
            <p>Elle sert désormais à :</p>
            <ul>
              <li>reconnaître qui parle</li>
              <li>confirmer vos commandes</li>
              <li>personnaliser les réponses de vos agents</li>
            </ul>
          </div>
          <button className="btn-primary" onClick={handleReset}>
            Recommencer
          </button>
        </div>
      )}
    </div>
  )
}
