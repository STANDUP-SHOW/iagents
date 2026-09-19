export default function Dashboard({ agents, isListening }: any) {
  return (
    <div className="dashboard">
      <h2>Dashboard</h2>

      <div className="dashboard-grid">
        <div className="card">
          <h3>Active Agents</h3>
          <p className="stat">{agents.filter((a: any) => a.status === 'active').length}</p>
        </div>

        <div className="card">
          <h3>Voice Status</h3>
          <p className="stat">{isListening ? '🎤 Listening' : '✓ Ready'}</p>
        </div>

        <div className="card">
          <h3>Connected Connectors</h3>
          <p className="stat">0/9</p>
        </div>

        <div className="card">
          <h3>Available Agents</h3>
          <p className="stat">{agents.length}/1249</p>
        </div>
      </div>

      <div className="quick-start">
        <h3>Quick Start</h3>
        <ol>
          <li>Train your voice (Voice Training tab)</li>
          <li>Select 3-5 agents from the Agents tab</li>
          <li>Configure connectors (Telegram, WhatsApp, etc.)</li>
          <li>Say "Albert" to activate an agent</li>
        </ol>
      </div>
    </div>
  )
}
