import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './App.css'
import './centre.css'
import { installerAgents, type AgentInstalle, type Fiche, type Installation } from './agents/fiche'
import type { Jauge } from './agents/jauge'
import { ConversationEngine } from './engines/ConversationEngine'
import reglages from './config/conversation-settings.json'
import Dashboard, { Icone, TITRES, type Onglet } from './components/Dashboard'
import Machine from './components/Machine'
import logo from './assets/marque/logo-iagent.png'
import VoiceTraining from './components/VoiceTraining'
import AgentManager from './components/AgentManager'
import ConnectorSetup from './components/ConnectorSetup'
import Navigateur from './components/Navigateur'
import Courriel from './components/Courriel'
import Embauche from './components/Embauche'
import Travail from './components/Travail'
import CleApi from './components/CleApi'

function App() {
  const [activeTab, setActiveTab] = useState<Onglet>('dashboard')
  const [agents, setAgents] = useState<any[]>([])
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [partialResult, setPartialResult] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [lastResponse, setLastResponse] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [moteur, setMoteur] = useState<ConversationEngine | null>(null)
  // Pourquoi l'écoute ou le modèle manquent : sans ça, l'utilisateur ne voit
  // qu'un « Voice not initialized » qui ne dit pas quel fichier déposer.
  const [motifEcoute, setMotifEcoute] = useState<string | null>(null)
  // Où travaille l'agent qu'on vient d'activer, et ce que ça coûte. Dit à
  // l'activation et pas après la première réponse : une bascule vers l'API se
  // paie, et ça ne se découvre pas sur la facture.
  const [voie, setVoie] = useState<string | null>(null)
  const [voieBascule, setVoieBascule] = useState(false)
  const [jauge, setJauge] = useState<Jauge | null>(null)
  const [installes, setInstalles] = useState<readonly AgentInstalle[]>([])

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
      // L'échec dit quel fichier manque et où : le taire obligerait à deviner.
      await invoke('init_voice')
        .then(() => setMotifEcoute(null))
        .catch((err) => setMotifEcoute(String(err)))

      // L'absence de clé d'API n'est plus une panne : l'agent travaille en
      // local si le poste a le modèle de son palier. C'est `modele_etat`, à
      // l'activation, qui dit ce qu'il en est pour CE poste.
      await invoke('init_llm').catch(() => {})

      await chargerAgentsInstalles()
    } catch (err) {
      console.error('Failed to initialize app:', err)
    }
  }

  // La liste montre les agents réellement installés, lus depuis installation.json
  // et les vraies fiches. Le routeur Rust ne connaît que cinq exemples codés en
  // dur qui ne correspondent à aucune fiche du catalogue.
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

      const m = new ConversationEngine(installerAgents(fiches, installation.agents), reglages)
      setMoteur(m)
      setInstalles(m.getAllAgents())
      setAgents(listerDepuisMoteur(m))
      setError(null)

      // Ce que ces agents demandent à CETTE machine. Le calcul est en Rust, sur
      // les mêmes chiffres que le dimensionnement ; découvrir à l'usage que la
      // machine ne suit pas, c'est le découvrir sur des tâches en retard.
      await invoke<Jauge>('jauge_etat')
        .then(setJauge)
        .catch(() => setJauge(null))
    } catch (err) {
      // Sans agents installés, la bibliothèque reste vide plutôt que de montrer
      // des exemples qui ne correspondent à aucune fiche du catalogue.
      setAgents([])
      setInstalles([])
      setError(
        "Aucun agent installé n'a pu être chargé. Vérifier config/installation.json " +
          'et le dossier agents/ à côté de l\'application. Détail : ' + String(err)
      )
    }
  }

  const listerDepuisMoteur = (m: ConversationEngine) =>
    m.getAllAgents().map((a) => ({
      id: a.fiche.id,
      name: a.prenom,
      description: a.fiche.nom,
      status: 'inactive',
    }))

  const toggleAgentStatus = async (agentId: string, currentStatus: string) => {
    const active = currentStatus === 'inactive'

    setActiveAgent(active ? agentId : null)
    setAgents((liste) =>
      liste.map((a) =>
        a.id === agentId ? { ...a, status: active ? 'active' : 'inactive' } : a
      )
    )
    setLastResponse('')
    setPartialResult('')

    // L'écoute peut manquer (modèle absent) sans empêcher d'activer un agent :
    // le lier à l'activation rendait le bouton muet sur un poste sans modèle.
    // Où ce poste travaille, avant qu'il ne dise un mot.
    if (active) {
      await invoke<{ motif: string; bascule: boolean }>('modele_etat', { ficheId: agentId })
        .then((etat) => {
          setVoie(etat.motif)
          setVoieBascule(etat.bascule)
        })
        .catch((e) => {
          setVoie(String(e))
          setVoieBascule(true)
        })
    } else {
      setVoie(null)
      setVoieBascule(false)
    }

    if (active) {
      try {
        await invoke('start_voice_recognition')
        setIsListening(true)
        setError(null)
      } catch (err) {
        setIsListening(false)
        setError("Agent activé, mais l'écoute est indisponible. " + (motifEcoute ?? String(err)))
      }
    } else {
      setIsListening(false)
      await invoke('stop_voice_recognition').catch(() => {})
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

      const reponse = await invoke<{ texte: string; motif: string; bascule: boolean }>(
        'repondre',
        {
          prenom: agent.prenom,
          ficheId: agent.fiche.id,
          promptSysteme: moteur!.formatSystemPrompt(agent.fiche.id),
          enonce: utterance || command,
        }
      )

      setLastResponse(reponse.texte)
      setVoie(reponse.motif)
      setVoieBascule(reponse.bascule)

      await invoke('text_to_speech', { text: reponse.texte }).catch((err) => {
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

  const onglets = Object.keys(TITRES) as Exclude<Onglet, 'dashboard'>[]

  return (
    <div className="app">
      <header className="app-header">
        <button className="marque" onClick={() => setActiveTab('dashboard')} title="Revenir au centre">
          <img src={logo} alt="iAgent" />
        </button>
        <div className="status-bar">
          {isProcessing ? (
            <span className="listening">Réflexion…</span>
          ) : isListening ? (
            <span className="listening">À l'écoute</span>
          ) : (
            <span className="idle">Prêt</span>
          )}
        </div>
      </header>

      {isListening && (partialResult || isProcessing || lastResponse) && (
        <div className="voice-display">
          {partialResult && (
            <div className="transcription-display">
              <span className="transcription-label">J'entends :</span>
              <span className="transcription-text">{partialResult}</span>
            </div>
          )}
          {isProcessing && (
            <div className="processing-display">
              <span className="processing-spinner" aria-hidden="true" />
              <span className="processing-label">Réflexion…</span>
            </div>
          )}
          {lastResponse && !isProcessing && (
            <div className="response-display">
              <span className="response-label">Réponse :</span>
              <span className="response-text">{lastResponse}</span>
            </div>
          )}
        </div>
      )}

      {activeTab !== 'dashboard' && (
        <nav className="app-nav">
          <button className="retour-centre" onClick={() => setActiveTab('dashboard')}>
            <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <circle cx="12" cy="12" r="8.5" />
            </svg>
            Centre
          </button>
          {onglets.map((o) => (
            <button key={o} className={activeTab === o ? 'active' : ''} onClick={() => setActiveTab(o)}>
              <Icone onglet={o} />
              {TITRES[o]}
            </button>
          ))}
        </nav>
      )}

      <main className={activeTab === 'dashboard' ? 'app-main app-main-centre' : 'app-main'}>
        {error && <div className="error-banner">{error}</div>}
        {motifEcoute && (
          <div className="error-banner">Écoute indisponible — {motifEcoute}</div>
        )}
        {voie && (
          <div className={voieBascule ? 'error-banner' : 'succes-banner'}>{voie}</div>
        )}
        {jauge && jauge.niveau !== 'confortable' && (
          <div className={jauge.niveau === 'impossible' ? 'error-banner' : 'avertissement-banner'}>
            {jauge.machine.nom} — {jauge.message}
          </div>
        )}
        {activeTab === 'dashboard' && (
          <Dashboard
            agents={agents}
            installes={installes}
            isListening={isListening}
            isProcessing={isProcessing}
            motifEcoute={motifEcoute}
            jauge={jauge}
            onOuvrir={setActiveTab}
          />
        )}
        {activeTab === 'machine' && <Machine jauge={jauge} />}
        {activeTab === 'agents' && (
          <AgentManager
            agents={agents}
            onToggleAgent={toggleAgentStatus}
          />
        )}
        {activeTab === 'voice' && <VoiceTraining />}
        {activeTab === 'connectors' && (
          <>
            <CleApi />
            <ConnectorSetup />
          </>
        )}
        {activeTab === 'navigateur' && <Navigateur />}
        {activeTab === 'courriel' && <Courriel />}
        {activeTab === 'travail' && <Travail />}
        {activeTab === 'embauche' && <Embauche />}
      </main>
    </div>
  )
}

export default App
