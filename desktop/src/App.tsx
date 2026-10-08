import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './App.css'
import './centre.css'
import './commander.css'
import './shell/shell.css'
import { installerAgents, type AgentInstalle, type Fiche, type Installation } from './agents/fiche'
import type { Jauge } from './agents/jauge'
import { ConversationEngine } from './engines/ConversationEngine'
import reglages from './config/conversation-settings.json'
import { TITRES, type Onglet } from './components/Dashboard'
import Machine from './components/Machine'
import { BandeauChiffres, ETAT_DEMO, tiret, useLectures, useTravail, type Chiffre, type Etat } from './components/Chiffres'
import ConnectorSetup from './components/ConnectorSetup'
import Navigateur from './components/Navigateur'
import Courriel from './components/Courriel'
import CleApi from './components/CleApi'
import WhatsApp from './components/WhatsApp'
import Telegram from './components/Telegram'
import InstallerVoix from './components/InstallerVoix'
import Equipe from './components/Equipe'
import Workforce from './components/commander/Workforce'
import Standard from './components/commander/Standard'
import Create from './components/commander/Create'
import BoxPage from './components/commander/BoxPage'
import Validations from './components/commander/Validations'
import Consommation from './components/commander/Consommation'
import Securite from './components/commander/Securite'
import Administration from './components/commander/Administration'
import {
  comprendreDemande,
  contexteDuTeamHolder,
  estTeamHolder,
  rassemblerContexte,
  type Proposition,
} from './agents/team-holder'
import { useEtatPlateforme } from './agents/plateforme'
import {
  BarreHaute,
  DockVocal,
  EntetePage,
  Navigation,
  PanneauDroit,
  PiedSysteme,
  SousOnglets,
  type Alerte,
  type EtatVoix,
} from './shell/Shell'
import Palette from './shell/Palette'
import { moduleDe, MODULES } from './shell/modules'
import { publier, useExecutions } from './shell/evenements'
import type { Cible } from './shell/intentions'
import Centre, { type EtatCentre } from './pages/Centre'
import VosAgents from './pages/VosAgents'
import TravailDuJour from './pages/TravailDuJour'
import Embaucher from './pages/Embaucher'
import VotreVoix from './pages/VotreVoix'

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

function lirePreference(cle: string): boolean {
  try {
    return localStorage.getItem(cle) === '1'
  } catch {
    return false
  }
}

function poserPreference(cle: string, v: boolean) {
  try {
    localStorage.setItem(cle, v ? '1' : '0')
  } catch {
    /* without storage the choice holds for this session */
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<Onglet>('dashboard')
  // What the page should select when it opens (an agent, a search, a card).
  const [cible, setCible] = useState<Cible | undefined>(undefined)
  const [palette, setPalette] = useState(false)
  const [dockReplie, setDockReplie] = useState(() => lirePreference('iagent-dock-replie'))
  const [panneauReplie, setPanneauReplie] = useState(() => lirePreference('iagent-panneau-replie'))
  const plateforme = useEtatPlateforme()
  const executions = useExecutions()
  const ouvrir = (o: Onglet) => {
    setActiveTab(o)
    setCible(undefined)
  }
  const aller = (c: Cible) => {
    setActiveTab(c.onglet)
    setCible({ ...c })
  }
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [])
  /**
   * Ce que la bibliothèque affiche. Le type est écrit, et pas `any[]` : c'est
   * `any[]` qui a laissé passer un `find` sur un champ que cette liste n'a pas,
   * sans un mot du compilateur.
   */
  const [agents, setAgents] = useState<AgentAffiche[]>([])
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
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
  // The admin space exists only when an admin key is in the keyring. Rust
  // answers a boolean; the key never reaches the screen.
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    invoke<boolean>('admin_present')
      .then(setAdmin)
      .catch(() => setAdmin(false))
  }, [])
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
  const { lu } = etat

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
    if (!ecoute.active) {
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
  }, [ecoute.active, activeAgent, agents])

  /**
   * Prépare l'écoute, et dit en clair ce qui manque quand elle ne peut pas.
   *
   * Appelé au démarrage, et à NOUVEAU quand le client vient d'installer les
   * pièces de la voix : sans ce second appel il aurait téléchargé 190 Mo pour
   * rien jusqu'à ce qu'il pense à relancer l'application.
   */
  const demarrerEcoute = () =>
    invoke('init_voice')
      .then(() => setMotifEcoute(null))
      .catch((err) => setMotifEcoute(String(err)))

  const initializeApp = async () => {
    try {
      // L'échec dit quel fichier manque et où : le taire obligerait à deviner.
      await demarrerEcoute()

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

    // Le micro ne dépend plus d'un agent : il écoute dès le lancement, et
    // seul le mot de réveil le fait parler (voix_entendu). Le bouton VOICE le
    // coupe ou le rallume.
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
      publier({ type: 'voix', agent: agent.prenom, texte: `${agent.prenom} vous a répondu`, gravite: 'info' })
      setVoie(reponse.motif)
      setVoieBascule(reponse.bascule)

      // Le message vient de Rust, qui SAIT laquelle des quatre pièces manque et
      // quoi en faire (`manque_pour_parler`, en français, avec son remède). Le
      // remplacer par une phrase générique jetait cette information : elle
      // disait encore « vérifier que piper et sa voix sont présents » alors que
      // la voix, elle, se télécharge depuis le 24/09 et qu'il ne manque plus
      // que le moteur. Le client lisait donc un conseil faux.
      await invoke('text_to_speech', { text: reponse.texte }).catch((err) => {
        setError(String(err))
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
      publier({ type: 'equipe', agent: chef.prenom, texte: `${chef.prenom} a appliqué un réglage de ${p.agent}`, gravite: 'succes' })
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

  // Le bouton VOICE. Rust allume et coupe le micro lui-même
  // (voix_ecoute_basculer) ; le vert et le rouge viennent de voix_ecoute_etat,
  // seul état de l'écoute, jamais d'un état tenu ici.
  const basculerVoix = async () => {
    try {
      setEcoute(await invoke<EcouteEtat>('voix_ecoute_basculer', { active: !ecoute.active }))
      setError(null)
    } catch (err) {
      setError("L'écoute n'a pas pu changer d'état. " + (motifEcoute ?? String(err)))
    }
  }

  // « Parler à » : the agent is switched on, and the microphone too when it
  // can be. The user then says « Voice » and the first name.
  const parlerA = async (a: { fiche: { id: string } }) => {
    if (agents.find((x) => x.id === a.fiche.id)?.status !== 'active') {
      await toggleAgentStatus(a.fiche.id, 'inactive')
    }
    if (!ecoute.active && !motifEcoute) await basculerVoix()
  }

  // Les chiffres en tête de chaque page : lus, jamais supposés (tiret si la lecture échoue).
  const bandeau = (onglet: Onglet): Chiffre[] => {
    switch (onglet) {
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
          { valeur: etat.teamHolder ?? '—', libelle: 'Task Commander' },
          { valeur: tiret(etat.embauches), libelle: 'agents qu’il tient' },
          {
            valeur: proposition && !demo ? '1' : '0',
            libelle: 'réglage à confirmer',
            ton: proposition && !demo ? 'alerte' : undefined,
          },
        ]
      case 'courriel':
        return [{ valeur: tiret(lu.envois), libelle: lu.envois === 1 ? 'envoi consigné' : 'envois consignés' }]
      default:
        return []
    }
  }

  const statuts: Record<string, boolean> = Object.fromEntries(agents.map((a) => [a.id, a.status === 'active']))
  const relie = plateforme.donnee?.relie ?? null
  const editionBox = plateforme.donnee?.edition_box ?? false
  const chef = installes.find((a) => estTeamHolder(a)) ?? null
  const actif = installes.find((a) => a.fiche.id === activeAgent) ?? null

  // What needs a look, gathered in the bell instead of stacked banners.
  const alertes: Alerte[] = []
  if (editionBox && relie === false) alertes.push({ texte: 'Box non reliée : aucun agent ne travaille.', gravite: 'danger', onglet: 'box' })
  if (jauge && jauge.niveau !== 'confortable')
    alertes.push({
      texte: `${jauge.machine.nom} : ${jauge.message}`,
      gravite: jauge.niveau === 'impossible' || jauge.niveau === 'saturee' ? 'danger' : 'alerte',
      onglet: 'machine',
    })
  if (proposition) alertes.push({ texte: `Réglage proposé : ${proposition.phrase}`, gravite: 'alerte', onglet: 'equipe' })
  if (motifEcoute) alertes.push({ texte: `Écoute indisponible : ${motifEcoute}`, gravite: 'alerte', onglet: 'connectors' })
  if (voie && voieBascule) alertes.push({ texte: voie, gravite: 'alerte', onglet: 'connectors' })
  if (error) alertes.push({ texte: error, gravite: 'danger' })
  if (lu.cle === false) alertes.push({ texte: "Aucune clé d'API posée : seuls les agents qui tournent en local peuvent travailler.", gravite: 'info', onglet: 'connectors' })

  const blocage =
    editionBox && relie === false
      ? { texte: 'Box non reliée à la plateforme : aucun agent ne travaille.', onglet: 'box' as Onglet }
      : jauge?.niveau === 'impossible'
        ? { texte: `${jauge.machine.nom} : ${jauge.message}`, onglet: 'machine' as Onglet }
        : null
  const etatCentre: EtatCentre = demo
    ? 'repos'
    : blocage
      ? 'blocage'
      : proposition
        ? 'validation'
        : isProcessing
          ? 'reflexion'
          : executions > 0
            ? 'execution'
            : ecoute.active
              ? 'ecoute'
              : 'repos'

  const voix: EtatVoix = {
    active: ecoute.active,
    eveillee: ecoute.ou_en_est === 'eveillee' || reveillee,
    reflexion: isProcessing,
    motif: motifEcoute,
    partiel: partialResult,
    reponse: lastResponse,
    onBasculer: basculerVoix,
  }

  const module = moduleDe(activeTab)
  const infos = MODULES.find((m) => m.id === module)
  const etatTexte = isProcessing ? 'Réflexion…' : ecoute.ou_en_est === 'eveillee' ? 'Quel agent ?' : ecoute.active ? 'À l’écoute' : 'Prêt'

  // Pages that keep their existing screen get the new header and sub-pages around it.
  const cadre = (contenu: JSX.Element, onglet: Onglet = activeTab) => (
    <div className="page-dc">
      <EntetePage
        onglet={moduleDe(onglet)}
        titre={onglet === 'admin' ? TITRES.admin : infos?.titre ?? ''}
        sousTitre={onglet === 'admin' ? 'Espace réservé à iAgent, visible avec une clé d’administration.' : infos?.sousTitre}
      />
      <SousOnglets onglet={activeTab} ouvrir={ouvrir} />
      <BandeauChiffres chiffres={bandeau(activeTab)} />
      <div className="carte-verre cadre-ancien app-main">{contenu}</div>
    </div>
  )

  return (
    <div className={`dc${dockReplie ? ' dock-ferme' : ''}${panneauReplie ? ' panneau-ferme' : ''}${activeTab === 'dashboard' ? ' sur-centre' : ''}${activeTab === 'embauche' ? ' sur-embauche' : ''}`}>
      <div className="decor" aria-hidden="true">
        <div className="decor-etoiles" />
        <div className="decor-grille" />
        <div className="decor-terre" />
      </div>

      <BarreHaute
        onOuvrirPalette={() => setPalette(true)}
        alertes={alertes}
        ouvrir={ouvrir}
        demo={demo}
        onDemo={basculerDemo}
        relie={relie}
        editionBox={editionBox}
        admin={admin}
        etatTexte={etatTexte}
      />
      <Navigation onglet={activeTab} ouvrir={ouvrir} />

      {demo && (
        <div className="ruban-demo" role="status">
          Mode démo : les chiffres du Centre sont un exemple, pas ceux de ce poste.
        </div>
      )}

      <DockVocal
        voix={voix}
        interlocuteur={actif ?? chef}
        prenoms={installes.map((a) => a.prenom)}
        ouvrir={ouvrir}
        replie={dockReplie}
        onDire={(phrase) => void processVoiceCommand(phrase)}
        onReplier={() =>
          setDockReplie((r) => {
            poserPreference('iagent-dock-replie', !r)
            return !r
          })
        }
      />

      <main className="zone-centrale">
        {!demo && (error || (voie && voieBascule)) && (
          <div className="bandeaux">
            {error && (
              <div className="error-banner">
                {error}
                <button className="lien-dc" onClick={() => setError(null)}>
                  Fermer
                </button>
              </div>
            )}
            {voie && voieBascule && <div className="avertissement-banner">{voie}</div>}
          </div>
        )}
        {activeTab === 'dashboard' && (
          <Centre etat={etat} installes={installes} statuts={statuts} etatCentre={etatCentre} blocage={blocage} aller={aller} />
        )}
        {activeTab === 'agents' && (
          <VosAgents
            installes={installes}
            statuts={statuts}
            onBasculer={(id) => toggleAgentStatus(id, statuts[id] ? 'active' : 'inactive')}
            onParler={parlerA}
            aller={aller}
            selection={cible?.agent}
          />
        )}
        {activeTab === 'travail' && <TravailDuJour installes={installes} aller={aller} cible={cible} />}
        {activeTab === 'embauche' && <Embaucher cible={cible} aller={aller} apresEmbauche={() => chargerAgentsInstalles()} />}
        {activeTab === 'voice' && <VotreVoix voix={voix} installes={installes} statuts={statuts} aller={aller} />}
        {activeTab === 'machine' && cadre(<Machine jauge={etat.jauge} />)}
        {activeTab === 'connectors' &&
          cadre(
            <>
              <CleApi />
              <WhatsApp />
              <Telegram />
              <InstallerVoix apresInstallation={demarrerEcoute} />
              <ConnectorSetup />
            </>
          )}
        {activeTab === 'navigateur' && cadre(<Navigateur />)}
        {activeTab === 'courriel' && cadre(<Courriel />)}
        {activeTab === 'equipe' &&
          cadre(
            <Equipe
              installes={installes}
              proposition={proposition}
              onAccepter={accepterProposition}
              onRefuser={refuserProposition}
              version={versionEquipe}
            />
          )}
        {/* Desktop Commander modules (MASTER §14), now sub-pages of their module.
            They read the platform and this workstation only. */}
        {activeTab === 'workforce' && cadre(<Workforce installes={installes} onOuvrir={ouvrir} />)}
        {activeTab === 'standard' && cadre(<Standard onOuvrir={ouvrir} />)}
        {activeTab === 'create' && cadre(<Create onOuvrir={ouvrir} />)}
        {activeTab === 'box' && cadre(<BoxPage />)}
        {activeTab === 'validations' && cadre(<Validations installes={installes} onOuvrir={ouvrir} />)}
        {activeTab === 'consommation' && cadre(<Consommation onOuvrir={ouvrir} />)}
        {activeTab === 'securite' && cadre(<Securite installes={installes} onOuvrir={ouvrir} />)}
        {activeTab === 'admin' && admin && cadre(<Administration />)}
      </main>

      <PanneauDroit
        ouvrir={ouvrir}
        replie={panneauReplie}
        onReplier={() =>
          setPanneauReplie((r) => {
            poserPreference('iagent-panneau-replie', !r)
            return !r
          })
        }
      />

      <PiedSysteme
        pied={{
          agentsActifs: etat.actifs,
          agentsTotal: installes.length,
          connexions: lu.serveurs,
          cle: lu.cle,
          jauge: jauge ? { niveau: jauge.niveau, libelle: { confortable: 'confortable', chargee: 'chargée', saturee: 'saturée', impossible: 'trop juste', 'memoire-seule': 'charge non jugée' }[jauge.niveau] ?? jauge.niveau } : null,
          relie,
          editionBox,
        }}
        voix={voix}
        ouvrir={ouvrir}
      />

      <Palette ouvert={palette} onFermer={() => setPalette(false)} installes={installes} aller={aller} admin={admin} />
    </div>
  )
}

export default App
