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
      <h2>Vos agents</h2>
      <p className="subtitle">Activez les agents qui travaillent sur ce poste. Un agent actif écoute son prénom.</p>

      {agents.length === 0 && (
        <p className="vide">Aucun agent installé pour l'instant. Passez par « Embaucher ».</p>
      )}

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
                ? 'Un instant…'
                : agent.status === 'active' ? 'Désactiver' : 'Activer'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
