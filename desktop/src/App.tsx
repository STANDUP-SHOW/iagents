import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './App.css'
import { installerAgents, type Fiche, type Installation } from './agents/fiche'
import { ConversationEngine } from './engines/ConversationEngine'
import reglages from './config/conversation-settings.json'
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
  const [moteur, setMoteur] = useState<ConversationEngine | null>(null)

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

      await chargerAgentsInstalles()

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
        // Sans cet appel, la boucle interroge un moteur qui n'écoute pas :
        // le micro n'est jamais ouvert et aucune phrase n'arrive.
        await invoke('start_voice_recognition')
        setActiveAgent(agentId)
        setIsListening(true)
        setLastResponse('')
      } else {
        await invoke('stop_voice_recognition').catch(() => {})
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

  // Les fiches font 16 Mo : Rust les sert, l'assemblage reste ici où il est testé.
  const chargerAgentsInstalles = async () => {
    try {
      const brut = await invoke<string>('lire_installation')
      const installation: { agents: Installation[] } = JSON.parse(brut)

      const fiches = await Promise.all(
        installation.agents.map(async (a) =>
          JSON.parse(await invoke<string>('lire_fiche', { id: a.ficheId })) as Fiche
        )
      )

      setMoteur(new ConversationEngine(installerAgents(fiches, installation.agents), reglages))
    } catch (err) {
      console.log('Agents installés non chargés :', err)
    }
  }

  const processVoiceCommand = async (command: string) => {
    if (!command.trim()) return

    try {
      setIsProcessing(true)
      setPartialResult('')

      // C'est le prénom prononcé qui choisit l'agent, pas la case cochée.
      const detecte = moteur?.detectAgent(command)
      if (!detecte) {
        // Aucun prénom reconnu : on ne fait pas répondre un agent au hasard.
        return
      }

      const { agent, utterance } = detecte
      setActiveAgent(agent.fiche.id)

      const response = await invoke<string>('repondre', {
        prenom: agent.prenom,
        promptSysteme: moteur!.formatSystemPrompt(agent.fiche.id),
        enonce: utterance || command,
      })

      setLastResponse(response)

      await invoke('text_to_speech', { text: response }).catch((err) => {
        console.error('TTS failed:', err)
        setError("La synthèse vocale a échoué. Vérifier que piper et sa voix sont présents à côté de l'application.")
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
