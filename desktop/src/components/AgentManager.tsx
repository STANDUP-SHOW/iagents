export default function AgentManager({ agents, setAgents }: any) {
  const toggleAgent = (id: string) => {
    setAgents(agents.map((a: any) =>
      a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a
    ))
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
            >
              {agent.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
