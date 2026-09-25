import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { parConversation, useReleve } from './useReleve'

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

/** Ce que le relais garde, d'après son propre contrat, avant d'oublier. */
const GARDE_DU_RELAIS = '10 minutes'

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

  /** Le brouillon de réponse, par numéro : deux conversations ne le partagent pas. */
  const [brouillons, setBrouillons] = useState<Record<string, string>>({})
  const [envoi, setEnvoi] = useState('')

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

  // La relève vient de `useReleve`, partagée avec Telegram : les deux côtés
  // Rust rendent exprès la même forme, et une boucle écrite deux fois aurait
  // fini par dire deux choses.
  const { messages, ecoute, arret, relancer, vider } = useReleve<MessageRecu>(
    'whatsapp_relever',
    branche === true
  )

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
    vider()
    try {
      setDit(await invoke<string>('whatsapp_debrancher'))
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

  const conversations = parConversation(messages, (m) => m.de, (m) => m.nom)

  return (
    <section className="canal">
      <h3>WhatsApp</h3>
      <p className="canal-explication">
        Vos agents répondent aux personnes qui écrivent au numéro WhatsApp de votre
        entreprise. Vos réponses partent d'ici vers Meta avec votre jeton, qui reste dans le
        coffre de cet ordinateur. Les messages reçus, eux, passent par votre relais : Meta ne
        les livre qu'à une adresse publique, et un poste n'en a pas.
      </p>

      {branche === null && <p className="canal-etat">Lecture du coffre…</p>}

      {branche === false && (
        <div className="canal-saisie">
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
          <p className="canal-ou">
            Le jeton et l'identifiant du numéro sont sur developers.facebook.com, dans votre
            application WhatsApp Business. L'adresse et le secret sont ceux de votre relais.
          </p>
        </div>
      )}

      {branche === true && (
        <div className="canal-branche">
          <p className="canal-etat">
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
        <div className="canal-recus">
          <p className="canal-precision">
            Ces messages sont relevés pendant que cette page est ouverte. Votre relais les
            garde {GARDE_DU_RELAIS} : un message arrivé alors que l'application est fermée
            n'est pas encore ramassé. Et c'est vous qui écrivez la réponse, pas l'agent.
          </p>

          {arret && (
            <div className="canal-arret">
              <p className="refus">{arret}</p>
              <button onClick={relancer} disabled={occupe}>
                Réessayer
              </button>
            </div>
          )}

          {messages.length === 0 && !arret && (
            <p className="canal-etat">Aucun message pour l'instant.</p>
          )}

          {conversations.map((c) => (
            <article key={c.cle} className="canal-message">
              <header>
                <span className="canal-qui">{c.nom || c.cle}</span>
                {heure(c.messages[0]!.recu_le) && (
                  <span className="canal-quand">{heure(c.messages[0]!.recu_le)}</span>
                )}
              </header>
              {c.messages.map((m, i) => (
                <p key={`${m.recu_le}-${i}`} className="canal-texte">
                  {m.texte}
                </p>
              ))}
              <div className="canal-reponse">
                <input
                  type="text"
                  aria-label={`Votre réponse à ${c.nom || c.cle}`}
                  placeholder="Votre réponse"
                  value={brouillons[c.cle] ?? ''}
                  onChange={(e) =>
                    setBrouillons((avant) => ({ ...avant, [c.cle]: e.target.value }))
                  }
                />
                <button
                  onClick={() => repondre(c.cle)}
                  disabled={occupe || !(brouillons[c.cle] ?? '').trim()}
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
