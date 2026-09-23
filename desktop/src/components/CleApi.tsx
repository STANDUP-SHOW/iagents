import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * Où le client range sa clé d'API, et le seul endroit d'où elle peut venir.
 *
 * Elle ne venait que de la variable d'environnement `ANTHROPIC_API_KEY` :
 * après une installation par MSI, un client n'a aucun moyen d'en poser une, et
 * donc aucun moyen de faire travailler un agent tant qu'aucun moteur local
 * n'est installé sur son poste. Ici il la colle une fois ; elle part dans le
 * coffre du système (Windows : le gestionnaire d'identifiants) et ne revient
 * jamais dans l'écran — un champ qui réaffiche une clé finit dans une capture.
 *
 * Ce bloc ne dit pas « connecté » : il dit si une clé est rangée. C'est
 * `modele_etat`, à l'activation d'un agent, qui dit ce que ce poste fera.
 */
export default function CleApi() {
  const [posee, setPosee] = useState<boolean | null>(null)
  const [saisie, setSaisie] = useState('')
  const [dit, setDit] = useState('')
  const [refus, setRefus] = useState('')

  const relire = () =>
    invoke<boolean>('cle_api_presente')
      .then(setPosee)
      .catch((e) => {
        setPosee(false)
        setRefus(String(e))
      })

  useEffect(() => {
    relire()
  }, [])

  const ranger = async () => {
    setDit('')
    setRefus('')
    try {
      setDit(await invoke<string>('cle_api_ranger', { cle: saisie }))
      setSaisie('')
      await relire()
    } catch (e) {
      setRefus(String(e))
    }
  }

  const retirer = async () => {
    setDit('')
    setRefus('')
    try {
      setDit(await invoke<string>('cle_api_retirer'))
      await relire()
    } catch (e) {
      setRefus(String(e))
    }
  }

  return (
    <section className="cle-api">
      <h3>Le moteur de vos agents</h3>
      <p className="cle-api-explication">
        Vos agents réfléchissent sur votre poste quand le modèle de leur palier y est
        installé. Sinon, ils passent par l'API d'Anthropic, et cela demande votre clé.
        Elle reste sur cet ordinateur, dans son coffre : elle ne part ni dans un paquet
        d'agent, ni chez nous.
      </p>

      {posee === null && <p className="cle-api-etat">Lecture du coffre…</p>}

      {posee === true && (
        <div className="cle-api-rangee">
          <p className="cle-api-etat">Une clé est rangée sur cet ordinateur.</p>
          <button onClick={retirer}>La retirer</button>
        </div>
      )}

      {posee === false && (
        <div className="cle-api-saisie">
          <label htmlFor="cle-api-champ">
            Votre clé Anthropic (elle commence par sk-ant-)
          </label>
          <input
            id="cle-api-champ"
            type="password"
            autoComplete="off"
            placeholder="sk-ant-…"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
          />
          <button onClick={ranger} disabled={!saisie.trim()}>
            La ranger dans le coffre
          </button>
          <p className="cle-api-ou">
            Vous la créez sur console.anthropic.com, rubrique API keys.
          </p>
        </div>
      )}

      {dit && <p className="succes">{dit}</p>}
      {refus && <p className="refus">{refus}</p>}
    </section>
  )
}
