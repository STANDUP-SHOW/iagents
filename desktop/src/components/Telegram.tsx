import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { parConversation, useReleve } from './useReleve'

/**
 * Telegram : le bot du client, et les messages qu'on lui écrit.
 *
 * Exactement le même trou que WhatsApp, et resté ouvert un jour de plus.
 * `telegram.rs` sait brancher, envoyer, relever et même expliquer au client
 * comment créer son bot ; `main.rs` enregistre ses six commandes ; **aucun écran
 * n'en appelait une seule.** On avait donc annoncé que Telegram marchait, et un
 * client n'avait aucun moyen de le brancher.
 *
 * **Pourquoi pas de relais, contrairement à WhatsApp.** Telegram laisse la
 * machine du client appeler et attendre (`getUpdates`), donc il n'y a rien à
 * héberger : un jeton suffit. C'est Meta qui exige une adresse publique.
 *
 * **Ce que ce panneau ne fait pas, et le dit.** L'agent ne répond pas seul, et
 * la relève ne tourne que pendant que le panneau est ouvert.
 */

/** Un message reçu, tel que `telegram.rs` le sérialise (noms en clair, pas de camelCase). */
type MessageRecu = {
  chat_id: number
  de: string
  texte: string
}

export default function Telegram() {
  const [branche, setBranche] = useState<boolean | null>(null)
  const [jeton, setJeton] = useState('')
  const [modeDEmploi, setModeDEmploi] = useState('')
  const [montreLeMode, setMontreLeMode] = useState(false)
  const [dit, setDit] = useState('')
  const [refus, setRefus] = useState('')
  const [occupe, setOccupe] = useState(false)

  /** Le brouillon de réponse, par conversation. */
  const [brouillons, setBrouillons] = useState<Record<number, string>>({})
  const [envoi, setEnvoi] = useState('')

  const relire = useCallback(
    () =>
      invoke<boolean>('telegram_branche')
        .then(setBranche)
        .catch((e) => {
          setBranche(false)
          setRefus(String(e))
        }),
    []
  )

  useEffect(() => {
    relire()
    // Le mode d'emploi est écrit en français dans `telegram.rs`, à un seul
    // endroit : le recopier ici en ferait deux textes à corriger.
    invoke<string>('telegram_mode_d_emploi').then(setModeDEmploi).catch(() => setModeDEmploi(''))
  }, [relire])

  const { messages, ecoute, arret, relancer, vider } = useReleve<MessageRecu>(
    'telegram_relever',
    branche === true
  )

  const brancher = async () => {
    setDit('')
    setRefus('')
    setOccupe(true)
    try {
      setDit(await invoke<string>('telegram_brancher', { jeton }))
      // Le jeton ne reste pas dans le champ : aucune commande ne sait le relire,
      // et un écran qui le garde finit dans une capture.
      setJeton('')
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
      setDit(await invoke<string>('telegram_debrancher'))
      await relire()
    } catch (e) {
      setRefus(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const repondre = async (chatId: number) => {
    const texte = (brouillons[chatId] ?? '').trim()
    if (!texte) return
    setEnvoi('')
    setRefus('')
    setOccupe(true)
    try {
      // `chatId` devient `chat_id` en Rust : Tauri convertit les ARGUMENTS d'une
      // commande, contrairement aux champs d'une structure.
      setEnvoi(await invoke<string>('telegram_envoyer', { chatId, texte }))
      setBrouillons((avant) => ({ ...avant, [chatId]: '' }))
    } catch (e) {
      setRefus(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const conversations = parConversation(
    messages,
    (m) => m.chat_id,
    (m) => m.de
  )

  return (
    <section className="canal">
      <h3>Telegram</h3>
      <p className="canal-explication">
        Vos agents répondent sur Telegram à travers un bot que vous créez vous-même. Il n'y a
        rien à héberger : Telegram laisse cet ordinateur venir chercher ses messages. Votre
        jeton reste dans son coffre, il ne part ni dans un paquet d'agent, ni chez nous.
      </p>

      {branche === null && <p className="canal-etat">Lecture du coffre…</p>}

      {branche === false && (
        <div className="canal-saisie">
          <label htmlFor="telegram-jeton">Le jeton de votre bot</label>
          <input
            id="telegram-jeton"
            type="password"
            autoComplete="off"
            placeholder="123456:AA…"
            value={jeton}
            onChange={(e) => setJeton(e.target.value)}
          />
          <button onClick={brancher} disabled={occupe || !jeton.trim()}>
            Brancher Telegram
          </button>
          <p className="canal-ou">
            Il est vérifié auprès de Telegram avant d'être rangé.{' '}
            <button className="canal-lien" onClick={() => setMontreLeMode(!montreLeMode)}>
              {montreLeMode ? 'Masquer' : 'Comment créer un bot ?'}
            </button>
          </p>
          {montreLeMode && modeDEmploi && <pre className="canal-mode">{modeDEmploi}</pre>}
        </div>
      )}

      {branche === true && (
        <div className="canal-branche">
          <p className="canal-etat">
            Telegram est branché sur cet ordinateur.{' '}
            {ecoute ? 'Les messages reçus arrivent ci-dessous.' : 'La relève est arrêtée.'}
          </p>
          <button onClick={debrancher} disabled={occupe}>
            Le débrancher
          </button>
        </div>
      )}

      {branche === true && (
        <div className="canal-recus">
          <p className="canal-precision">
            Ces messages sont relevés pendant que cette page est ouverte, et c'est vous qui
            écrivez la réponse, pas l'agent. Une personne doit avoir écrit la première à votre
            bot : c'est ce qui lui donne le droit de répondre.
          </p>

          {arret && (
            <div className="canal-arret">
              <p className="refus">{arret}</p>
              <button onClick={relancer} disabled={occupe}>
                Réessayer
              </button>
            </div>
          )}

          {conversations.length === 0 && !arret && (
            <p className="canal-etat">Aucun message pour l'instant.</p>
          )}

          {conversations.map((c) => (
            <article key={c.cle} className="canal-message">
              <header>
                <span className="canal-qui">{c.nom}</span>
              </header>
              {c.messages.map((m, i) => (
                <p key={i} className="canal-texte">
                  {m.texte}
                </p>
              ))}
              <div className="canal-reponse">
                <input
                  type="text"
                  aria-label={`Votre réponse à ${c.nom}`}
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
