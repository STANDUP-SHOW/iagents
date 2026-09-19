import { useState, useEffect } from 'react'
import './App.css'
import Dashboard from './components/Dashboard'
import VoiceTraining from './components/VoiceTraining'
import AgentManager from './components/AgentManager'
import ConnectorSetup from './components/ConnectorSetup'

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agents' | 'voice' | 'connectors'>('dashboard')
  const [agents, setAgents] = useState<any[]>([])
  const [isListening] = useState(false)

  useEffect(() => {
    // Load agents from catalogue on startup
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      // Load 5 sample agents for Phase 1
      const sampleAgents = [
        { id: 'AG-0001', name: 'Albert', description: 'Assistant productivité', status: 'inactive' },
        { id: 'AG-0002', name: 'Justine', description: 'Assistante communication', status: 'inactive' },
        { id: 'AG-0050', name: 'Audrey', description: 'Assistante créative', status: 'inactive' },
        { id: 'AG-0100', name: 'Marcus', description: 'Analyste données', status: 'inactive' },
        { id: 'AG-0150', name: 'Olivia', description: 'Gestionnaire projets', status: 'inactive' },
      ]
      setAgents(sampleAgents)
    } catch (err) {
      console.error('Failed to load agents:', err)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🤖 iAgent Desktop</h1>
        <div className="status-bar">
          {isListening ? (
            <span className="listening">🎤 Listening...</span>
          ) : (
            <span className="idle">Ready</span>
          )}
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={activeTab === 'agents' ? 'active' : ''}
          onClick={() => setActiveTab('agents')}
        >
          Agents
        </button>
        <button
          className={activeTab === 'voice' ? 'active' : ''}
          onClick={() => setActiveTab('voice')}
        >
          Voice Training
        </button>
        <button
          className={activeTab === 'connectors' ? 'active' : ''}
          onClick={() => setActiveTab('connectors')}
        >
          Connectors
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'dashboard' && <Dashboard agents={agents} isListening={isListening} />}
        {activeTab === 'agents' && <AgentManager agents={agents} setAgents={setAgents} />}
        {activeTab === 'voice' && <VoiceTraining />}
        {activeTab === 'connectors' && <ConnectorSetup />}
      </main>
    </div>
  )
}

export default App
