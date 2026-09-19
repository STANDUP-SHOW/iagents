import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import './App.css'
import Dashboard from './components/Dashboard'
import VoiceTraining from './components/VoiceTraining'
import AgentManager from './components/AgentManager'
import ConnectorSetup from './components/ConnectorSetup'

function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agents' | 'voice' | 'connectors'>('dashboard')
  const [agents, setAgents] = useState<any[]>([])
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      // Initialize voice module
      await invoke('init_voice').catch(() => {
        console.log('Voice module not available in this environment')
      })

      // Load agents from backend
      await loadAgents()
    } catch (err) {
      console.error('Failed to initialize app:', err)
    }
  }

  const loadAgents = async () => {
    try {
      const agentList = await invoke<any[]>('get_agents')
      setAgents(agentList)
    } catch (err) {
      console.error('Failed to load agents:', err)
      // Fallback to hardcoded agents
      const sampleAgents = [
        { id: 'AG-0001', name: 'Albert', description: 'Assistant productivité', status: 'inactive' },
        { id: 'AG-0002', name: 'Justine', description: 'Assistante communication', status: 'inactive' },
        { id: 'AG-0050', name: 'Audrey', description: 'Assistante créative', status: 'inactive' },
        { id: 'AG-0100', name: 'Marcus', description: 'Analyste données', status: 'inactive' },
        { id: 'AG-0150', name: 'Olivia', description: 'Gestionnaire projets', status: 'inactive' },
      ]
      setAgents(sampleAgents)
    }
  }

  const toggleAgentStatus = async (agentId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'inactive') {
        await invoke('activate_agent', { agentId })
        setIsListening(true)
      } else {
        await invoke('deactivate_agent', { agentId })
        setIsListening(false)
      }
      await loadAgents()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError(errMsg)
      console.error('Failed to toggle agent:', err)
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
        {error && <div className="error-banner">{error}</div>}
        {activeTab === 'dashboard' && <Dashboard agents={agents} isListening={isListening} />}
        {activeTab === 'agents' && (
          <AgentManager
            agents={agents}
            onToggleAgent={toggleAgentStatus}
          />
        )}
        {activeTab === 'voice' && <VoiceTraining />}
        {activeTab === 'connectors' && <ConnectorSetup />}
      </main>
    </div>
  )
}

export default App
