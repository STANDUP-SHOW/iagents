import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './App.css'
import './centre.css'
import { installerAgents, type AgentInstalle, type Fiche, type Installation } from './agents/fiche'
import type { Jauge } from './agents/jauge'
import { ConversationEngine } from './engines/ConversationEngine'
import reglages from './config/conversation-settings.json'
import Dashboard, { Icone, TITRES, type Onglet } from './components/Dashboard'
import Machine from './components/Machine'
import { BandeauChiffres, ETAT_DEMO, tiret, useLectures, useTravail, type Chiffre, type Etat } from './components/Chiffres'
import logo from './assets/marque/logo-iagent.png'
import VoiceTraining from './components/VoiceTraining'
import AgentManager from './components/AgentManager'
import ConnectorSetup from './components/ConnectorSetup'
import Navigateur from './components/Navigateur'
import Courriel from './components/Courriel'
import Embauche from './components/Embauche'
import Travail from './components/Travail'
import CleApi from './components/CleApi'
import InstallerVoix from './components/InstallerVoix'
import Equipe from './components/Equipe'
import {
  comprendreDemande,
  contexteDuTeamHolder,
  estTeamHolder,
  rassemblerContexte,
  type Proposition,
} from './agents/team-holder'

/** `voix_ecoute_etat` et `voix_ecoute_basculer`, noms de champs figés par un banc Rust. */
interface EcouteEtat {
  active: boolean
  ou_en_est: 'dormante' | 'eveillee'
}


/** Un agent tel que la bibliothèque le montre : ni prénom brut ni fiche. */
interface AgentAffiche {
  id: string
  name: string
  description: string
  status: string
}

function App() {
  const [activeTab, setActiveTab] = useState<Onglet>('dashboard')
  /**
   * Ce que la bibliothèque affiche. Le type est écrit, et pas `any[]` : c'est
   * `any[]` qui a laissé passer un `find` sur un champ que cette liste n'a pas,
   * sans un mot du compilateur.
   */
  const [agents, setAgents] = useState<AgentAffiche[]>([])
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  // Le mot de réveil a été entendu, on attend le prénom d'un agent.
  const [reveillee, setReveillee] = useState(false)
  // Ce que Rust dit de l'écoute : micro allumé ou non, mot de réveil entendu ou non.
  const [ecoute, setEcoute] = useState<EcouteEtat>({ active: false, ou_en_est: 'dormante' })
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
  // Ce que le Team Holder a proposé de changer, en attente du oui du client.
  // Gardé aussi dans une ref : la boucle d'écoute lit processVoiceCommand tel
  // qu'il était à son démarrage, et verrait sinon une proposition périmée.
  const [proposition, setPropositionEtat] = useState<Proposition | null>(null)
  const propositionRef = useRef<Proposition | null>(null)
  const setProposition = (p: Proposition | null) => {
    propositionRef.current = p
    setPropositionEtat(p)
  }
  const [versionEquipe, setVersionEquipe] = useState(0)
  const luReel = useLectures(activeTab)
  const travailReel = useTravail(installes)
  // Le mode démo montre un cabinet d'exemple, pour une démonstration client ou
  // un contrôle sans rien installer. Retenu d'une ouverture à l'autre.
  const [demo, setDemo] = useState(() => {
    try {
      return localStorage.getItem('iagent-demo') === '1'
    } catch {
      return false
    }
  })
  const basculerDemo = () =>
    setDemo((d) => {
      try {
        localStorage.setItem('iagent-demo', d ? '0' : '1')
      } catch {
        /* sans stockage, le mode vaut pour cette ouverture */
      }
      return !d
    })
  const etat: Etat = demo
    ? ETAT_DEMO
    : {
        embauches: installes.filter((a) => !estTeamHolder(a)).length,
        teamHolder: installes.find((a) => estTeamHolder(a))?.prenom ?? null,
        actifs: agents.filter((a) => a.status === 'active').length,
        travail: travailReel,
        lu: luReel,
        jauge,
      }
  const { lu, travail } = etat

  useEffect(() => {
    initializeApp()
  }, [])

  // L'état de l'écoute se relit chaque seconde : le réveil retombe tout seul
  // quand personne ne dit de prénom, et l'écran doit le voir retomber.
  useEffect(() => {
    let vivant = true
    const lire = () =>
      invoke<EcouteEtat>('voix_ecoute_etat')
        .then((e) => vivant && setEcoute(e))
        .catch(() => {})
    lire()
    const minuterie = setInterval(lire, 1000)
    return () => {
      vivant = false
      clearInterval(minuterie)
    }
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
        setEcoute(await invoke<EcouteEtat>('voix_ecoute_basculer', { active: true }))
        setError(null)
      } catch (err) {
        setIsListening(false)
        setError("Agent activé, mais l'écoute est indisponible. " + (motifEcoute ?? String(err)))
      }
    } else {
      setIsListening(false)
      await invoke<EcouteEtat>('voix_ecoute_basculer', { active: false })
        .then(setEcoute)
        .catch(() => {})
      await invoke('stop_voice_recognition').catch(() => {})
    }
  }

  const processVoiceCommand = async (command: string) => {
    if (!command.trim()) return

    try {
      setIsProcessing(true)
      setPartialResult('')

      // Le mot de réveil d'abord, et c'est Rust qui tranche (`reveil.rs`).
      // Avant le 24/09/2026 ce bloc prenait le PREMIER MOT de tout ce qui
      // était transcrit pour un prénom d'agent : deux personnes qui parlaient
      // dans la pièce faisaient répondre un agent dès qu'une phrase commençait
      // par un mot proche de « Carla ». max l'a dit en clair : l'application
      // écoute en permanence mais ne doit être dérangée que par un seul mot.
      //
      // La décision n'est pas ici parce qu'un état gardé dans React se perd au
      // premier rechargement de la page, et parce qu'elle s'éprouve sans micro.
      const reaction = await invoke<
        | { quoi: 'rien' }
        | { quoi: 'reveillee' }
        | { quoi: 'appel'; prenom: string; demande: string }
        | { quoi: 'aucun-agent-de-ce-nom'; entendu: string }
      >('voix_entendu', { texte: command })

      if (reaction.quoi === 'rien') return
      if (reaction.quoi === 'reveillee') {
        // Elle attend le prénom : le dire à l'écran, sans faire parler personne.
        setReveillee(true)
        return
      }
      setReveillee(false)
      if (reaction.quoi === 'aucun-agent-de-ce-nom') {
        setLastResponse(`Personne ne s'appelle « ${reaction.entendu} » ici.`)
        return
      }

      // `agents` est la liste AFFICHÉE ({ id, name, ... }) : elle n'a ni
      // `prenom` ni `fiche`. Le premier jet la cherchait quand même, donc
      // `find` rendait toujours `undefined` et AUCUN agent appelé ne répondait.
      // Rien ne le signalait : la liste était typée `any[]`, ce qui rend le
      // compilateur aveugle sur exactement ce genre de faute. Elle est typée
      // maintenant, et c'est le moteur qu'on interroge — lui porte le prénom.
      const agent = moteur?.getAllAgents().find((a) => a.prenom === reaction.prenom)
      if (!agent) return
      const utterance = reaction.demande
      setActiveAgent(agent.fiche.id)
      const equipe = moteur!.getAllAgents()
      let promptSysteme = moteur!.formatSystemPrompt(agent.fiche.id)

      if (estTeamHolder(agent)) {
        // Une proposition attend : « oui » l'applique, « non » l'écarte.
        const attente = propositionRef.current
        if (attente && utterance) {
          const reponseCourte = utterance.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
          if (/^(oui|ok|d accord|d'accord|vas-y|allez-y|fais-le|faites-le)\b/.test(reponseCourte)) {
            await accepterProposition()
            return
          }
          if (/^non\b/.test(reponseCourte)) {
            setProposition(null)
            await dire("D'accord, je ne change rien.")
            return
          }
        }
        if (utterance) {
          const compris = comprendreDemande(utterance, equipe)
          if ('proposition' in compris) {
            setProposition(compris.proposition)
            await dire(compris.proposition.phrase)
            return
          }
          if ('deja' in compris) {
            await dire(compris.deja)
            return
          }
          // Une question sur le réglage, ou pas un réglage du tout : il répond
          // en conversation, avec ce qu'il a lu de son équipe.
        }
        const { lectures, changements } = await rassemblerContexte(invoke, equipe)
        promptSysteme += contexteDuTeamHolder(equipe, lectures, changements)
      }

      const reponse = await invoke<{ texte: string; motif: string; bascule: boolean }>(
        'repondre',
        {
          prenom: agent.prenom,
          ficheId: agent.fiche.id,
          promptSysteme,
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

  // Ce que l'application dit à voix haute, affiché aussi pour qui ne l'entend pas.
  const dire = async (texte: string) => {
    setLastResponse(texte)
    await invoke('text_to_speech', { text: texte }).catch(() => {})
  }

  // Le client a dit oui (à voix haute ou sur l'écran « Votre équipe ») : le
  // réglage passe par Rust, qui le refuse s'il sort des trois permis.
  const accepterProposition = async () => {
    const p = propositionRef.current
    const chef = installes.find((a) => estTeamHolder(a)) ?? moteur?.getAllAgents().find((a) => estTeamHolder(a))
    if (!p || !chef) return
    try {
      await invoke('equipe_regler', {
        par: chef.prenom,
        agent: p.agent,
        tacheId: p.tacheId,
        reglage: p.reglage,
        valeur: p.valeur,
      })
      setProposition(null)
      setVersionEquipe((v) => v + 1)
      // Le planning en mémoire est celui d'avant : on relit l'installation.
      await chargerAgentsInstalles()
      await dire("C'est fait.")
    } catch (err) {
      setProposition(null)
      await dire(`Je n'ai pas pu le faire : ${String(err)}`)
    }
  }

  const refuserProposition = () => {
    setProposition(null)
    setLastResponse("D'accord, je ne change rien.")
  }

  const onglets = Object.keys(TITRES) as Exclude<Onglet, 'dashboard'>[]


  // Le bouton VOICE. Deux choses à allumer ensemble : le micro
  // (start_voice_recognition) et l'écoute du mot de réveil
  // (voix_ecoute_basculer, `reveil.rs`). Le vert et le rouge viennent de
  // voix_ecoute_etat, jamais d'un état tenu ici : sinon le bouton et l'écoute
  // réelle finiraient par dire deux choses.
  const basculerVoix = async () => {
    if (ecoute.active) {
      const e = await invoke<EcouteEtat>('voix_ecoute_basculer', { active: false }).catch(() => null)
      if (e) setEcoute(e)
      setIsListening(false)
      await invoke('stop_voice_recognition').catch(() => {})
      return
    }
    try {
      await invoke('start_voice_recognition')
      setIsListening(true)
      setEcoute(await invoke<EcouteEtat>('voix_ecoute_basculer', { active: true }))
      setError(null)
    } catch (err) {
      setError("L'écoute n'a pas pu démarrer. " + (motifEcoute ?? String(err)))
    }
  }

  // Les chiffres en tête de chaque page : lus, jamais supposés (tiret si la lecture échoue).
  const bandeau = (onglet: Onglet): Chiffre[] => {
    const actifs = etat.actifs
    switch (onglet) {
      case 'agents':
        return [
          { valeur: tiret(etat.embauches), libelle: installes.length > 1 ? 'agents embauchés' : 'agent embauché' },
          { valeur: tiret(actifs), libelle: actifs > 1 ? 'actifs' : 'actif' },
        ]
      case 'travail':
        return [
          { valeur: `${tiret(travail.pretes)} / ${tiret(travail.total)}`, libelle: 'tâches prêtes' },
          {
            valeur: tiret(travail.total - travail.pretes),
            libelle: 'à compléter avant de lancer',
            ton: travail.total > travail.pretes ? 'alerte' : undefined,
          },
          { valeur: tiret(travail.sansMatiere), libelle: 'sans dossier désigné' },
        ]
      case 'embauche':
        return [
          { valeur: tiret(lu.metiers), libelle: 'métiers au catalogue' },
          { valeur: tiret(lu.secteurs), libelle: 'secteurs' },
          { valeur: tiret(lu.activites), libelle: 'activités' },
          { valeur: tiret(etat.embauches), libelle: 'déjà embauchés' },
        ]
      case 'connectors':
        return [
          {
            valeur: lu.serveurs ? `${lu.serveurs.prets} / ${lu.serveurs.total}` : '—',
            libelle: 'outils prêts',
          },
          {
            valeur: lu.cle == null ? '—' : lu.cle ? 'Posée' : 'Aucune',
            libelle: "clé d'API",
            ton: lu.cle ? 'succes' : undefined,
          },
        ]
      case 'navigateur':
        return [{ valeur: tiret(lu.sites), libelle: lu.sites === 1 ? 'compte connecté' : 'comptes connectés' }]
      case 'equipe':
        return [
          { valeur: etat.teamHolder ?? '—', libelle: 'Team Holder' },
          { valeur: tiret(etat.embauches), libelle: 'agents qu’il tient' },
          {
            valeur: proposition && !demo ? '1' : '0',
            libelle: 'réglage à confirmer',
            ton: proposition && !demo ? 'alerte' : undefined,
          },
        ]
      case 'courriel':
        return [{ valeur: tiret(lu.envois), libelle: lu.envois === 1 ? 'envoi consigné' : 'envois consignés' }]
      case 'voice':
        return [
          {
            valeur: motifEcoute ? 'Indisponible' : ecoute.active ? 'Active' : 'Coupée',
            libelle: 'écoute',
            ton: motifEcoute ? 'danger' : undefined,
          },
        ]
      default:
        return []
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="marque" onClick={() => setActiveTab('dashboard')} title="Revenir au centre">
          <img src={logo} alt="iAgent" />
        </button>
        <button
          className={`bouton-demo${demo ? ' demo-actif' : ''}`}
          onClick={basculerDemo}
          aria-pressed={demo}
          title="Chiffres d'exemple, pour une démonstration ou un contrôle"
        >
          Démo {demo ? 'activée' : 'coupée'}
        </button>
        <div className="status-bar">
          {isProcessing ? (
            <span className="listening">Réflexion…</span>
          ) : ecoute.ou_en_est === 'eveillee' ? (
            <span className="listening">Quel agent ?</span>
          ) : isListening ? (
            <span className="listening">À l'écoute</span>
          ) : (
            <span className="idle">Prêt</span>
          )}
        </div>
      </header>

      {demo && (
        <div className="ruban-demo" role="status">
          Mode démo : les chiffres affichés sont un exemple, pas ceux de ce poste.
        </div>
      )}

      {isListening && (partialResult || isProcessing || lastResponse || reveillee || ecoute.ou_en_est === 'eveillee') && (
        <div className="voice-display">
          {partialResult && (
            <div className="transcription-display">
              <span className="transcription-label">J'entends :</span>
              <span className="transcription-text">{partialResult}</span>
            </div>
          )}
          {/* Le mot de réveil a été entendu : sans ce signe, le client ne sait
              pas si l'application l'a pris et redit « Voice » par-dessus. */}
          {(reveillee || ecoute.ou_en_est === 'eveillee') && !isProcessing && (
            <div className="processing-display reveil-display">
              <span className="reveil-point" aria-hidden="true" />
              <span className="processing-label">J'écoute. Quel agent ?</span>
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
        {!demo && (
          <>
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
          </>
        )}
        {activeTab === 'dashboard' && (
          <Dashboard
            etat={etat}
            isListening={isListening}
            isProcessing={isProcessing}
            motifEcoute={motifEcoute}
            voixActive={ecoute.active}
            eveillee={ecoute.ou_en_est === 'eveillee' || reveillee}
            onBasculerVoix={basculerVoix}
            onOuvrir={setActiveTab}
          />
        )}
        {activeTab !== 'dashboard' && (
          <div className="page-cadre">
            <BandeauChiffres chiffres={bandeau(activeTab)} />
            {activeTab === 'machine' && <Machine jauge={etat.jauge} />}
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
                <InstallerVoix />
                <ConnectorSetup />
              </>
            )}
            {activeTab === 'navigateur' && <Navigateur />}
            {activeTab === 'courriel' && <Courriel />}
            {activeTab === 'travail' && <Travail />}
            {activeTab === 'embauche' && <Embauche />}
            {activeTab === 'equipe' && (
              <Equipe
                installes={demo ? [] : installes}
                proposition={demo ? null : proposition}
                onAccepter={accepterProposition}
                onRefuser={refuserProposition}
                version={versionEquipe}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
