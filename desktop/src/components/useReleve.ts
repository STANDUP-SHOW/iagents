import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * La boucle de relève, écrite une seule fois pour WhatsApp et pour Telegram.
 *
 * Les deux côtés Rust rendent **exprès la même forme** (`{ messages, suite }`,
 * voir le commentaire de `Releve` dans `whatsapp.rs`), et les deux tiennent la
 * ligne 25 secondes. Écrite deux fois, la boucle aurait fini par dire deux
 * choses : un panneau corrigé et l'autre pas, un point de reprise remis à zéro
 * d'un côté seulement.
 *
 * Ce qui se joue ici tient en trois pièges, et chacun coûte quelque chose de
 * visible chez le client :
 *
 * - **Chaînée, jamais périodique.** Chaque appel garde la ligne ouverte jusqu'à
 *   25 secondes, donc un `setInterval` empilerait des appels en vol.
 * - **Le point de reprise et le drapeau d'arrêt vivent dans des `ref`.** Relus
 *   depuis la fermeture de la boucle, des états resteraient à leur valeur de
 *   départ : la boucle survivrait au panneau fermé, et le serveur resservirait
 *   indéfiniment les messages déjà lus — l'agent y répondrait deux fois.
 * - **Une pause avant de réessayer, et un arrêt au bout de trois échecs.** Sans
 *   elle, un secret refusé ferait tourner la boucle à pleine vitesse.
 */

/** Ce que rendent `whatsapp_relever` et `telegram_relever`. */
type Releve<T> = {
  messages: T[]
  suite: number
}

/** Combien de temps attendre avant de rappeler après un échec. */
const PAUSE_APRES_ECHEC_MS = 30_000

/** Au-delà, on arrête et on le dit, plutôt que de frapper une porte fermée. */
const ECHECS_AVANT_ARRET = 3

const dors = (ms: number) => new Promise((f) => setTimeout(f, ms))

export type Relevee<T> = {
  /** Les messages reçus, le plus récent en tête. */
  messages: T[]
  /** Vrai pendant que la ligne est tenue. */
  ecoute: boolean
  /** Le motif du dernier arrêt, en clair, ou une chaîne vide. */
  arret: string
  /** Reprend après un arrêt, sans revenir en arrière dans les messages. */
  relancer: () => void
  /** Oublie tout et remet le point de reprise à zéro (au débranchement). */
  vider: () => void
}

export function useReleve<T>(commande: string, actif: boolean): Relevee<T> {
  const [messages, setMessages] = useState<T[]>([])
  const [ecoute, setEcoute] = useState(false)
  const [arret, setArret] = useState('')

  /**
   * Le drapeau d'arrêt, qui tient aussi lieu de verrou : `boucler` le pose
   * avant son premier `await`, donc un second appel repart aussitôt. Deux
   * boucles ne peuvent coexister que si la première l'a vu retomber — et dans
   * ce cas elle sort sans rien écrire.
   */
  const tourne = useRef(false)
  const depuis = useRef(0)

  const boucler = useCallback(async () => {
    if (tourne.current) return
    tourne.current = true
    setEcoute(true)
    setArret('')
    let echecs = 0
    while (tourne.current) {
      try {
        const releve = await invoke<Releve<T>>(commande, { depuis: depuis.current })
        if (!tourne.current) break
        echecs = 0
        depuis.current = releve.suite
        if (releve.messages.length > 0) {
          setMessages((avant) => [...releve.messages].reverse().concat(avant))
        }
      } catch (e) {
        if (!tourne.current) break
        echecs += 1
        if (echecs >= ECHECS_AVANT_ARRET) {
          setArret(String(e))
          break
        }
        await dors(PAUSE_APRES_ECHEC_MS)
      }
    }
    tourne.current = false
    setEcoute(false)
  }, [commande])

  // La relève suit le panneau : elle démarre dès qu'il est ouvert sur un compte
  // branché, et s'arrête quand le client s'en va. Sans cet arrêt, la boucle
  // survivrait au panneau et continuerait de tenir une ligne vers le serveur.
  useEffect(() => {
    if (!actif) return
    void boucler()
    return () => {
      tourne.current = false
    }
  }, [actif, boucler])

  const vider = useCallback(() => {
    tourne.current = false
    // Le prochain branchement peut viser un autre compte : son point de reprise
    // n'a rien à voir avec celui-ci.
    depuis.current = 0
    setMessages([])
    setArret('')
  }, [])

  return { messages, ecoute, arret, relancer: () => void boucler(), vider }
}

/**
 * Les messages rangés par conversation, la plus récente en tête.
 *
 * Un brouillon de réponse appartient à une conversation et non à un message :
 * affiché sous chaque message, celui d'une personne qui en a écrit deux se
 * serait montré deux fois, et le client aurait vu sa frappe apparaître dans une
 * case qu'il ne touchait pas.
 */
export function parConversation<T, C extends string | number>(
  messages: T[],
  cle: (m: T) => C,
  nom: (m: T) => string
): { cle: C; nom: string; messages: T[] }[] {
  const rangees: { cle: C; nom: string; messages: T[] }[] = []
  for (const m of messages) {
    const deja = rangees.find((c) => c.cle === cle(m))
    if (deja) {
      deja.messages.push(m)
      if (!deja.nom) deja.nom = nom(m)
    } else {
      rangees.push({ cle: cle(m), nom: nom(m), messages: [m] })
    }
  }
  return rangees
}
