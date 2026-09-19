import { useState } from 'react'

export default function VoiceTraining() {
  const [stage, setStage] = useState<'intro' | 'recording' | 'complete'>('intro')
  const [currentPhrase, setCurrentPhrase] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedCount, setRecordedCount] = useState(0)
  const [loading] = useState(false)
  const [error, setError] = useState('')

  const phrases = [
    'My voice is my password',
    'Verify my identity',
    'Security through biometrics',
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
      <h2>Voice Biometric Enrollment</h2>

      {error && <div className="error-banner">{error}</div>}

      {stage === 'intro' && (
        <div className="training-section">
          <h3>Enroll Your Voice</h3>
          <p>Create a voice print for speaker verification and secure access.</p>
          <div className="enrollment-info">
            <p>
              You'll record <strong>3 phrases</strong> to create your voice biometric profile.
            </p>
            <ul>
              <li>Speak clearly and naturally</li>
              <li>Each recording is about 3 seconds</li>
              <li>Your voice print is stored securely on this device</li>
            </ul>
          </div>
          <button className="btn-primary" onClick={handleStartTraining}>
            Start Voice Enrollment
          </button>
        </div>
      )}

      {stage === 'recording' && (
        <div className="training-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(recordedCount / 3) * 100}%` }} />
          </div>
          <p className="progress-label">
            Phrase {recordedCount + 1} of 3
          </p>

          <h3>Say this phrase:</h3>
          <div className="phrase-display">
            <p className="phrase-text">"{phrases[currentPhrase]}"</p>
          </div>

          <div className="recording-indicator">
            {isRecording ? (
              <>
                <span className="pulse animate">🎤</span>
                <span className="recording-text">Recording...</span>
              </>
            ) : (
              <>
                <span className="pulse">🎙️</span>
                <span className="ready-text">Ready to record</span>
              </>
            )}
          </div>

          <button
            className="btn-primary"
            onClick={handleRecordUtterance}
            disabled={isRecording || loading}
          >
            {isRecording ? 'Recording...' : `Record Phrase ${recordedCount + 1}`}
          </button>

          {recordedCount > 0 && (
            <button className="btn-secondary" onClick={handleReset} disabled={loading}>
              Start Over
            </button>
          )}
        </div>
      )}

      {stage === 'complete' && (
        <div className="training-section success">
          <div className="success-icon">✓</div>
          <h3>Voice Enrollment Complete</h3>
          <p>Your voice print has been created and secured.</p>
          <div className="enrollment-benefits">
            <p>Your voice biometric is now active for:</p>
            <ul>
              <li>Speaker verification</li>
              <li>Secure command authentication</li>
              <li>Personalized agent responses</li>
            </ul>
          </div>
          <button className="btn-primary" onClick={handleReset}>
            Enroll Again
          </button>
        </div>
      )}
    </div>
  )
}
