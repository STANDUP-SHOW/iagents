import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

export default function ConnectorSetup() {
  const [activeConnector, setActiveConnector] = useState<string | null>(null)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [instructions, setInstructions] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [telegramConnected, setTelegramConnected] = useState(false)

  const connectors = [
    { name: 'Telegram', icon: '✈️' },
    { name: 'WhatsApp', icon: '💬' },
    { name: 'Email', icon: '📧' },
    { name: 'Calendar', icon: '📅' },
    { name: 'Instagram', icon: '📸' },
    { name: 'Facebook', icon: '👍' },
  ]

  const handleShowTelegramForm = async () => {
    setError('')
    setActiveConnector('Telegram')
    try {
      const instr = await invoke<string>('get_telegram_instructions')
      setInstructions(instr)
    } catch (err) {
      setError('Failed to load instructions: ' + String(err))
    }
  }

  const handleConnectTelegram = async () => {
    setError('')
    if (!botToken.trim() || !chatId.trim()) {
      setError('Bot token and chat ID are required')
      return
    }

    setLoading(true)
    try {
      await invoke<string>('connect_telegram', {
        botToken: botToken,
        chatId: chatId,
      })
      setTelegramConnected(true)
      setBotToken('')
      setChatId('')
      setActiveConnector(null)
    } catch (err) {
      setError('Connection failed: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = () => {
    setTelegramConnected(false)
    setBotToken('')
    setChatId('')
    setActiveConnector(null)
    setError('')
  }

  return (
    <div className="connector-setup">
      <h2>Connector Setup</h2>
      <p className="subtitle">Connect agents to messaging platforms and services</p>

      {error && <div className="error-banner">{error}</div>}

      <div className="connectors-grid">
        {connectors.map((connector) => (
          <div key={connector.name} className="connector-card">
            <div className="connector-icon">{connector.icon}</div>
            <h3>{connector.name}</h3>
            <p className="status">
              {connector.name === 'Telegram' && telegramConnected
                ? 'connected'
                : 'disconnected'}
            </p>
            {connector.name === 'Telegram' ? (
              telegramConnected ? (
                <button className="setup-btn disconnect" onClick={handleDisconnect}>
                  Disconnect
                </button>
              ) : (
                <button className="setup-btn" onClick={handleShowTelegramForm}>
                  Connect
                </button>
              )
            ) : (
              <button className="setup-btn" disabled>
                Coming Soon
              </button>
            )}
          </div>
        ))}
      </div>

      {activeConnector === 'Telegram' && (
        <div className="connector-modal-overlay" onClick={() => setActiveConnector(null)}>
          <div className="connector-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Connect Telegram</h3>
            <div className="telegram-instructions">
              <pre>{instructions}</pre>
            </div>

            <div className="form-group">
              <label>Bot Token</label>
              <input
                type="password"
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Chat ID</label>
              <input
                type="text"
                placeholder="987654321 or -1001234567890"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="modal-buttons">
              <button
                className="btn-primary"
                onClick={handleConnectTelegram}
                disabled={loading}
              >
                {loading ? 'Connecting...' : 'Connect Telegram'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setActiveConnector(null)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="connector-flow">
        <h3>Typical Setup Flow</h3>
        <ol>
          <li>Click "Connect" on a platform (Telegram, WhatsApp, etc.)</li>
          <li>Paste your API token or authenticate with OAuth</li>
          <li>Select which agents have access to this connector</li>
          <li>Test the connection</li>
        </ol>
      </div>
    </div>
  )
}
