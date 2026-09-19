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
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [partialResult, setPartialResult] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initializeApp()
  }, [])

  useEffect(() => {
    if (!isListening) {
      setPartialResult('')
      return
    }

    let silenceTimeout: NodeJS.Timeout | null = null
    let lastResult = ''

    const interval = setInterval(async () => {
      try {
        const result = await invoke<string | null>('get_partial_result')
        if (result) {
          setPartialResult(result)
          lastResult = result

          // Reset silence timer when we get new speech
          if (silenceTimeout) clearTimeout(silenceTimeout)

          // If we've been silent for 1 second, treat it as end of speech
          silenceTimeout = setTimeout(() => {
            if (lastResult && lastResult.trim()) {
              processVoiceCommand(lastResult)
              lastResult = ''
            }
          }, 1000)
        }
      } catch (err) {
        console.log('Failed to get partial result:', err)
      }
    }, 200)

    return () => {
      clearInterval(interval)
      if (silenceTimeout) clearTimeout(silenceTimeout)
    }
  }, [isListening, activeAgent, agents])

  const initializeApp = async () => {
    try {
      // Initialize voice module
      await invoke('init_voice').catch(() => {
        console.log('Voice module not available in this environment')
      })

      // Initialize LLM service
      await invoke('init_llm').catch(() => {
        console.log('LLM service not available - check ANTHROPIC_API_KEY')
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
        setActiveAgent(agentId)
        setIsListening(true)
        setLastResponse('')
      } else {
        await invoke('deactivate_agent', { agentId })
        setActiveAgent(null)
        setIsListening(false)
        setPartialResult('')
      }
      await loadAgents()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError(errMsg)
      console.error('Failed to toggle agent:', err)
    }
  }

  const processVoiceCommand = async (command: string) => {
    if (!activeAgent || !command.trim()) return

    try {
      setIsProcessing(true)
      setPartialResult('')

      const agent = agents.find((a) => a.id === activeAgent)
      if (!agent) {
        setError('Active agent not found')
        return
      }

      const response = await invoke<string>('call_agent_llm', {
        agent_id: activeAgent,
        command: command,
      })

      setLastResponse(response)

      await invoke('text_to_speech', { text: response }).catch((err) => {
        console.error('TTS failed:', err)
        setError('Text-to-speech failed. Ensure pyttsx3 is installed: pip install pyttsx3')
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError(errMsg)
      console.error('Failed to process voice command:', err)
    } finally {
      setIsProcessing(false)
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

      {isListening && (partialResult || isProcessing || lastResponse) && (
        <div className="voice-display">
          {partialResult && (
            <div className="transcription-display">
              <span className="transcription-label">Hearing:</span>
              <span className="transcription-text">{partialResult}</span>
            </div>
          )}
          {isProcessing && (
            <div className="processing-display">
              <span className="processing-spinner">⏳</span>
              <span className="processing-label">Thinking...</span>
            </div>
          )}
          {lastResponse && !isProcessing && (
            <div className="response-display">
              <span className="response-label">Response:</span>
              <span className="response-text">{lastResponse}</span>
            </div>
          )}
        </div>
      )}

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
