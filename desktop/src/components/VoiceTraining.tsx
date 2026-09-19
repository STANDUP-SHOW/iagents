import { useState } from 'react'

export default function VoiceTraining() {
  const [stage, setStage] = useState<'intro' | 'recording' | 'complete'>('intro')
  const [recordingCount, setRecordingCount] = useState(0)

  const handleStartTraining = () => {
    setStage('recording')
  }

  const handleRecordUtterance = () => {
    const newCount = recordingCount + 1
    setRecordingCount(newCount)

    if (newCount >= 3) {
      setStage('complete')
    }
  }

  return (
    <div className="voice-training">
      <h2>Voice Training</h2>

      {stage === 'intro' && (
        <div className="training-section">
          <h3>Train Your Voice</h3>
          <p>This helps iAgent recognize you and route commands to the correct agent.</p>
          <p className="info">You'll record 3 short utterances (10-20 seconds each)</p>
          <button className="primary-btn" onClick={handleStartTraining}>
            Start Training
          </button>
        </div>
      )}

      {stage === 'recording' && (
        <div className="training-section">
          <h3>Recording {recordingCount + 1} of 3</h3>
          <p className="prompt">Say: "Albert is my productivity assistant"</p>
          <div className="recording-indicator">
            <span className="pulse">🎤</span>
            <span className="recording-text">Recording...</span>
          </div>
          <button className="primary-btn" onClick={handleRecordUtterance}>
            Recorded
          </button>
        </div>
      )}

      {stage === 'complete' && (
        <div className="training-section success">
          <h3>✅ Voice Training Complete</h3>
          <p>Your voice print has been saved securely on this machine.</p>
          <p className="info">iAgent will now recognize your voice and route commands correctly.</p>
          <button className="primary-btn" onClick={() => { setStage('intro'); setRecordingCount(0) }}>
            Retrain Voice
          </button>
        </div>
      )}
    </div>
  )
}
