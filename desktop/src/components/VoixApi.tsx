import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * La voix de vos agents : celle du poste par défaut, ou un moteur en ligne si
 * le client range sa clé. Ranger une clé, c'est choisir ce moteur : Rust
 * (`voix_api::moteur_retenu`) dit lequel parle quand il y en a plusieurs, et
 * revient à la voix du poste en disant pourquoi si l'appel échoue.
 *
 * Mêmes règles que la clé Anthropic : le coffre du système, jamais réaffichée.
 * Les champs gardent les noms de Rust (pas de `rename_all`).
 */

interface Etat {
  elevenlabs: boolean
  mistral: boolean
  gemini: boolean
  parle: string
}

const MOTEURS: { compte: 'mistral' | 'elevenlabs' | 'google-ai-studio'; cle: keyof Etat; nom: string; quoi: string; ou: string }[] = [
  {
    compte: 'mistral',
    cle: 'mistral',
    nom: 'Mistral Voxtral',
    quoi: 'Voix française, européenne, la moins chère pour bien parler (environ 10 $ par mois pour une heure par jour).',
    ou: 'console.mistral.ai, rubrique API Keys',
  },
  {
    compte: 'elevenlabs',
    cle: 'elevenlabs',
    nom: 'ElevenLabs',
    quoi: 'La plus expressive du marché : elle rit, chuchote, change de ton. La plus chère.',
    ou: 'elevenlabs.io, rubrique API Keys',
  },
  {
    compte: 'google-ai-studio',
    cle: 'gemini',
    nom: 'Google Gemini',
    quoi: 'Très bonne et bon marché, on lui donne le ton en une phrase.',
    ou: 'aistudio.google.com, rubrique Get API key',
  },
]

export default function VoixApi() {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [saisies, setSaisies] = useState<Record<string, string>>({})
  const [dit, setDit] = useState('')
  const [refus, setRefus] = useState('')

  const relire = () =>
    invoke<Etat>('voix_api_etat')
      .then(setEtat)
      .catch((e) => setRefus(String(e)))

  useEffect(() => {
    relire()
  }, [])

  const ranger = async (compte: string) => {
    setDit('')
    setRefus('')
    try {
      setDit(await invoke<string>('voix_api_ranger', { compte, cle: saisies[compte] ?? '' }))
      setSaisies((s) => ({ ...s, [compte]: '' }))
      await relire()
    } catch (e) {
      setRefus(String(e))
    }
  }

  const retirer = async (compte: string) => {
    setDit('')
    setRefus('')
    try {
      setDit(await invoke<string>('voix_api_retirer', { compte }))
      await relire()
    } catch (e) {
      setRefus(String(e))
    }
  }

  return (
    <section className="cle-api">
      <h3>La voix de vos agents</h3>
      <p className="cle-api-explication">
        Sans rien ranger ici, vos agents parlent avec la voix installée sur ce poste. Pour une voix plus
        humaine, rangez la clé d'un de ces services : vos agents s'en servent aussitôt. Si le service ne
        répond pas, ils reprennent la voix du poste et vous disent pourquoi.
      </p>
      {etat && <p className="cle-api-etat">{etat.parle}</p>}

      {MOTEURS.map((m) => (
        <div key={m.compte} className="voix-api-moteur">
          <h4>{m.nom}</h4>
          <p className="cle-api-explication">{m.quoi}</p>
          {etat?.[m.cle] ? (
            <div className="cle-api-rangee">
              <p className="cle-api-etat">Une clé est rangée.</p>
              <button onClick={() => retirer(m.compte)}>La retirer</button>
            </div>
          ) : (
            <div className="cle-api-saisie">
              <input
                type="password"
                autoComplete="off"
                aria-label={`Votre clé ${m.nom}`}
                placeholder={`Votre clé ${m.nom}`}
                value={saisies[m.compte] ?? ''}
                onChange={(e) => setSaisies((s) => ({ ...s, [m.compte]: e.target.value }))}
              />
              <button onClick={() => ranger(m.compte)} disabled={!(saisies[m.compte] ?? '').trim()}>
                La ranger dans le coffre
              </button>
              <p className="cle-api-ou">Vous la créez sur {m.ou}.</p>
            </div>
          )}
        </div>
      ))}

      {dit && <p className="succes">{dit}</p>}
      {refus && <p className="refus">{refus}</p>}
    </section>
  )
}
