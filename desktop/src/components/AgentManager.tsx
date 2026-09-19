import { useState } from 'react'

export default function AgentManager({ agents, onToggleAgent }: any) {
  const [loading, setLoading] = useState<string | null>(null)

  const toggleAgent = async (id: string) => {
    const agent = agents.find((a: any) => a.id === id)
    if (!agent || !onToggleAgent) return

    setLoading(id)
    try {
      await onToggleAgent(id, agent.status)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="agent-manager">
      <h2>Agent Manager</h2>
      <p className="subtitle">Select agents to activate on this machine</p>

      <div className="agents-grid">
        {agents.map((agent: any) => (
          <div key={agent.id} className={`agent-card ${agent.status}`}>
            <div className="agent-header">
              <h3>{agent.name}</h3>
              <span className="agent-id">{agent.id}</span>
            </div>
            <p className="agent-desc">{agent.description}</p>
            <button
              className="toggle-btn"
              onClick={() => toggleAgent(agent.id)}
              disabled={loading === agent.id}
            >
              {loading === agent.id
                ? 'Loading...'
                : agent.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
