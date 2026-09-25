import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * WhatsApp : où le client branche son compte, et où arrivent les messages.
 *
 * Les cinq commandes de `whatsapp.rs` étaient enregistrées dans `main.rs` et
 * l'écran n'en appelait aucune : le client n'avait, sur un poste installé, aucun
 * moyen de poser son jeton ni de voir un message arriver. C'est le cas que le
 * mémo du dépôt appelle dangereux — une commande enregistrée sans appelant a
 * l'air vivante et ne sert personne.
 *
 * **Deux chemins, un seul panneau.** Envoyer part d'ici vers `graph.facebook.com`
 * avec le jeton du client, qui ne quitte pas sa machine. Recevoir passe par le
 * relais, parce que Meta ne livre un entrant qu'en le POSTant vers une adresse
 * publique et qu'un poste n'en a pas. Le panneau le dit au client : ce n'est pas
 * un détail d'architecture, c'est ce qui explique pourquoi il y a une adresse à
 * saisir.
 *
 * **Ce que ce panneau ne fait pas, et le dit.** L'agent ne répond pas seul : le
 * client lit et écrit la réponse lui-même. Et la relève ne tourne que pendant
 * que ce panneau est ouvert, donc un message arrivé la nuit n'est pas ramassé.
 * Les deux sont le maillon suivant, pas un défaut caché.
 */

/** Un message reçu, tel que `whatsapp.rs` le sérialise. */
type MessageRecu = {
  de: string
  nom: string
  texte: string
  /** L'horodatage de Meta, en secondes, **et en texte** : c'est un `String` en Rust. */
  recu_le: string
}

type Releve = {
  messages: MessageRecu[]
  suite: number
}

/**
 * Combien de temps attendre avant de rappeler le relais après un échec.
 *
 * Sans cette pause, un secret refusé ferait tourner la boucle à pleine vitesse
 * contre le relais. La relève elle-même tient la ligne 25 secondes, donc une
 * boucle qui réussit n'a besoin d'aucune pause.
 */
const PAUSE_APRES_ECHEC_MS = 30_000

/** Au-delà, on arrête et on le dit, plutôt que de frapper une porte fermée. */
const ECHECS_AVANT_ARRET = 3

/** Ce que le relais garde, d'après son propre contrat, avant d'oublier. */
const GARDE_DU_RELAIS = '10 minutes'

const dors = (ms: number) => new Promise((f) => setTimeout(f, ms))

/** L'horodatage de Meta en heure lisible. Vide ou illisible : on n'invente rien. */
function heure(recuLe: string): string {
  const secondes = Number(recuLe)
  if (!Number.isFinite(secondes) || secondes <= 0) return ''
  return new Date(secondes * 1000).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WhatsApp() {
  const [branche, setBranche] = useState<boolean | null>(null)
  const [jeton, setJeton] = useState('')
  const [numeroId, setNumeroId] = useState('')
  const [relais, setRelais] = useState('')
  const [secretRelais, setSecretRelais] = useState('')
  const [dit, setDit] = useState('')
  const [refus, setRefus] = useState('')
  const [occupe, setOccupe] = useState(false)

  const [messages, setMessages] = useState<MessageRecu[]>([])
  const [ecoute, setEcoute] = useState(false)
  const [arret, setArret] = useState('')
  /** Le brouillon de réponse, par numéro : deux conversations ne le partagent pas. */
  const [brouillons, setBrouillons] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState('')

  /**
   * Le drapeau d'arrêt de la boucle de relève.
   *
   * Il est dans une `ref` et non dans un état : la boucle le relit à chaque
   * tour, et un état capturé dans sa fermeture resterait à sa valeur de départ.
   * Une boucle qui ne s'arrête jamais continuerait d'appeler le relais après
   * que le client a quitté le panneau.
   *
   * Il tient aussi lieu de verrou, et c'est ce qui interdit deux boucles à la
   * fois : `boucler` le pose avant son premier `await`, donc un second appel
   * repart aussitôt. Deux boucles ne peuvent coexister que si la première l'a
   * vu retomber — et dans ce cas elle sort sans rien écrire.
   */
  const tourne = useRef(false)

  /**
   * Le point de reprise, gardé d'une boucle à l'autre.
   *
   * Dans la boucle seule, un « Réessayer » repartirait de zéro et le relais
   * resservirait les messages déjà affichés : le client lirait deux fois la même
   * demande et pourrait y répondre deux fois.
   */
  const depuis = useRef(0)

  const relire = useCallback(
    () =>
      invoke<boolean>('whatsapp_branche')
        .then(setBranche)
        .catch((e) => {
          setBranche(false)
          setRefus(String(e))
        }),
    []
  )

  useEffect(() => {
    relire()
  }, [relire])

  /**
   * La boucle de relève. Chaînée, jamais périodique : chaque appel tient la
   * ligne jusqu'à 25 secondes, donc un `setInterval` empilerait des appels.
   *
   * Le point de reprise est une `ref` et non un état, pour la même raison que
   * `tourne` : relu depuis une fermeture, il resterait à sa valeur de départ et
   * le relais resservirait indéfiniment les mêmes messages.
   */
  const boucler = useCallback(async () => {
    if (tourne.current) return
    tourne.current = true
    setEcoute(true)
    setArret('')
    let echecs = 0
    while (tourne.current) {
      try {
        const releve = await invoke<Releve>('whatsapp_relever', { depuis: depuis.current })
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
  }, [])

  // La relève suit le panneau : elle démarre dès qu'il est ouvert sur un compte
  // branché, et s'arrête quand le client s'en va. Sans cet arrêt, la boucle
  // survivrait au panneau et continuerait de tenir une ligne vers le relais.
  useEffect(() => {
    if (branche !== true) return
    void boucler()
    return () => {
      tourne.current = false
    }
  }, [branche, boucler])

  const brancher = async () => {
    setDit('')
    setRefus('')
    setOccupe(true)
    try {
      setDit(
        await invoke<string>('whatsapp_brancher', { jeton, numeroId, relais, secretRelais })
      )
      // Ni le jeton ni le secret ne restent dans un champ : un écran qui les
      // garde finit dans une capture. Aucune commande ne sait les relire.
      setJeton('')
      setSecretRelais('')
      await relire()
    } catch (e) {
      setRefus(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const debrancher = async () => {
    setDit('')
    setRefus('')
    setOccupe(true)
    tourne.current = false
    try {
      setDit(await invoke<string>('whatsapp_debrancher'))
      setMessages([])
      // Le prochain branchement peut viser un autre relais : son point de
      // reprise n'a rien à voir avec celui-ci.
      depuis.current = 0
      await relire()
    } catch (e) {
      setRefus(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const repondre = async (a: string) => {
    const texte = (brouillons[a] ?? '').trim()
    if (!texte) return
    setEnvoi('')
    setRefus('')
    setOccupe(true)
    try {
      setEnvoi(await invoke<string>('whatsapp_repondre', { a, texte }))
      setBrouillons((avant) => ({ ...avant, [a]: '' }))
    } catch (e) {
      setRefus(String(e))
    } finally {
      setOccupe(false)
    }
  }

  /**
   * Les messages rangés par personne, la conversation la plus récente en haut.
   *
   * Un brouillon de réponse appartient à une conversation et non à un message :
   * affiché sous chaque message, celui d'une personne qui en a écrit deux se
   * serait montré deux fois, et le client aurait vu sa frappe apparaître dans
   * une case qu'il ne touchait pas.
   */
  const conversations = messages.reduce<
    { de: string; nom: string; messages: MessageRecu[] }[]
  >((rangees, m) => {
    const deja = rangees.find((c) => c.de === m.de)
    if (deja) {
      deja.messages.push(m)
      if (!deja.nom) deja.nom = m.nom
      return rangees
    }
    return [...rangees, { de: m.de, nom: m.nom, messages: [m] }]
  }, [])

  return (
    <section className="whatsapp">
      <h3>WhatsApp</h3>
      <p className="whatsapp-explication">
        Vos agents répondent aux personnes qui écrivent au numéro WhatsApp de votre
        entreprise. Vos réponses partent d'ici vers Meta avec votre jeton, qui reste dans le
        coffre de cet ordinateur. Les messages reçus, eux, passent par votre relais : Meta ne
        les livre qu'à une adresse publique, et un poste n'en a pas.
      </p>

      {branche === null && <p className="whatsapp-etat">Lecture du coffre…</p>}

      {branche === false && (
        <div className="whatsapp-saisie">
          <label htmlFor="whatsapp-jeton">Votre jeton d'accès Meta</label>
          <input
            id="whatsapp-jeton"
            type="password"
            autoComplete="off"
            placeholder="EAA…"
            value={jeton}
            onChange={(e) => setJeton(e.target.value)}
          />

          <label htmlFor="whatsapp-numero">L'identifiant de votre numéro</label>
          <input
            id="whatsapp-numero"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="106540352242922"
            value={numeroId}
            onChange={(e) => setNumeroId(e.target.value)}
          />

          <label htmlFor="whatsapp-relais">L'adresse de votre relais</label>
          <input
            id="whatsapp-relais"
            type="url"
            autoComplete="off"
            placeholder="https://mon-relais.exemple.fr"
            value={relais}
            onChange={(e) => setRelais(e.target.value)}
          />

          <label htmlFor="whatsapp-secret">Le secret de votre relais</label>
          <input
            id="whatsapp-secret"
            type="password"
            autoComplete="off"
            value={secretRelais}
            onChange={(e) => setSecretRelais(e.target.value)}
          />

          <button
            onClick={brancher}
            disabled={occupe || !jeton.trim() || !numeroId.trim() || !relais.trim() || !secretRelais.trim()}
          >
            Brancher WhatsApp
          </button>
          <p className="whatsapp-ou">
            Le jeton et l'identifiant du numéro sont sur developers.facebook.com, dans votre
            application WhatsApp Business. L'adresse et le secret sont ceux de votre relais.
          </p>
        </div>
      )}

      {branche === true && (
        <div className="whatsapp-branche">
          <p className="whatsapp-etat">
            WhatsApp est branché sur cet ordinateur.{' '}
            {ecoute
              ? 'Les messages reçus arrivent ci-dessous.'
              : "La relève est arrêtée."}
          </p>
          <button onClick={debrancher} disabled={occupe}>
            Le débrancher
          </button>
        </div>
      )}

      {branche === true && (
        <div className="whatsapp-recus">
          <p className="whatsapp-precision">
            Ces messages sont relevés pendant que cette page est ouverte. Votre relais les
            garde {GARDE_DU_RELAIS} : un message arrivé alors que l'application est fermée
            n'est pas encore ramassé. Et c'est vous qui écrivez la réponse, pas l'agent.
          </p>

          {arret && (
            <div className="whatsapp-arret">
              <p className="refus">{arret}</p>
              <button onClick={() => void boucler()} disabled={occupe}>
                Réessayer
              </button>
            </div>
          )}

          {messages.length === 0 && !arret && (
            <p className="whatsapp-etat">Aucun message pour l'instant.</p>
          )}

          {conversations.map((c) => (
            <article key={c.de} className="whatsapp-message">
              <header>
                <span className="whatsapp-qui">{c.nom || c.de}</span>
                {heure(c.messages[0]!.recu_le) && (
                  <span className="whatsapp-quand">{heure(c.messages[0]!.recu_le)}</span>
                )}
              </header>
              {c.messages.map((m, i) => (
                <p key={`${m.recu_le}-${i}`} className="whatsapp-texte">
                  {m.texte}
                </p>
              ))}
              <div className="whatsapp-reponse">
                <input
                  type="text"
                  aria-label={`Votre réponse à ${c.nom || c.de}`}
                  placeholder="Votre réponse"
                  value={brouillons[c.de] ?? ''}
                  onChange={(e) =>
                    setBrouillons((avant) => ({ ...avant, [c.de]: e.target.value }))
                  }
                />
                <button
                  onClick={() => repondre(c.de)}
                  disabled={occupe || !(brouillons[c.de] ?? '').trim()}
                >
                  Répondre
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {dit && <p className="succes">{dit}</p>}
      {envoi && <p className="succes">{envoi}</p>}
      {refus && <p className="refus">{refus}</p>}
    </section>
  )
}
