import { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'

export default function VoiceTraining() {
  const [stage, setStage] = useState<'intro' | 'recording' | 'complete'>('intro')
  const [currentPhrase, setCurrentPhrase] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedCount, setRecordedCount] = useState(0)
  const [loading, setLoading] = useState(false)
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

  const handleRecordUtterance = async () => {
    setError('')
    setIsRecording(true)

    try {
      // Simulate 3-second recording
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // In production: capture real audio from microphone
      // Placeholder: generate dummy audio samples (1 sec at 44100 Hz)
      const placeholderSamples = new Array(44100).fill(0).map(() =>
        Math.floor(Math.random() * 32767 - 16384)
      )

      const newCount = recordedCount + 1
      setRecordedCount(newCount)

      if (newCount >= 3) {
        // All 3 phrases recorded, submit enrollment
        setLoading(true)
        try {
          // Send all 3 utterances to backend
          const allSamples = [placeholderSamples, placeholderSamples, placeholderSamples]
          const result = await invoke<string>('enroll_voice', {
            user_id: 'current_user',
            audio_samples: allSamples,
          })
          setStage('complete')
          setError('')
        } catch (err) {
          setError('Enrollment failed: ' + String(err))
          setRecordedCount(newCount - 1) // Revert count
        } finally {
          setLoading(false)
        }
      } else {
        setCurrentPhrase(newCount)
      }

      setIsRecording(false)
    } catch (err) {
      setError('Recording failed: ' + String(err))
      setIsRecording(false)
    }
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
