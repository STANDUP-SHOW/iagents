import { useState } from 'react'

export default function ConnectorSetup() {
  const [connectors] = useState([
    { name: 'Telegram', icon: '✈️', status: 'disconnected' },
    { name: 'WhatsApp', icon: '💬', status: 'disconnected' },
    { name: 'Email', icon: '📧', status: 'disconnected' },
    { name: 'Calendar', icon: '📅', status: 'disconnected' },
    { name: 'Instagram', icon: '📸', status: 'disconnected' },
    { name: 'Facebook', icon: '👍', status: 'disconnected' },
  ])

  return (
    <div className="connector-setup">
      <h2>Connector Setup</h2>
      <p className="subtitle">Connect agents to messaging platforms and services</p>

      <div className="connectors-grid">
        {connectors.map((connector) => (
          <div key={connector.name} className="connector-card">
            <div className="connector-icon">{connector.icon}</div>
            <h3>{connector.name}</h3>
            <p className="status">{connector.status}</p>
            <button className="setup-btn">Connect</button>
          </div>
        ))}
      </div>

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
