import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/**
 * Ce qu'il manque pour que l'agent entende et parle, et le bouton qui va le
 * chercher.
 *
 * Constaté le 23/09/2026 : la voix n'est livrée par rien — ni le MSI, ni un
 * téléchargement — et sur un poste installé la conversation vocale ne pouvait
 * pas démarrer. L'écran n'en disait qu'une phrase en anglais. max a tranché le
 * 24/09 : l'application va chercher ces pièces elle-même.
 *
 * Le client voit ce qui va descendre et ce que ça pèse AVANT de cliquer. Une
 * barre de progression serait mieux, mais annoncer le poids est déjà l'essentiel
 * pour quelqu'un en partage de connexion.
 */
interface AManquer {
  role: string
  octets: number
  licence: string
}

/** Un poids se lit en Mo, pas en octets : 190085487 ne dit rien à personne. */
const enMegaoctets = (o: number) => `${Math.round(o / 1_000_000)} Mo`

/**
 * `apresInstallation` est appelé quand des pièces viennent d'arriver.
 *
 * Sans lui, le client téléchargeait 190 Mo, lisait « installé », et l'écoute
 * restait morte jusqu'à ce qu'il pense à relancer l'application — sans que
 * rien ne le lui dise. `init_voice` n'est appelé qu'une fois, au démarrage : à
 * ce moment-là le modèle n'était pas encore là, et personne ne rappelait la
 * commande une fois qu'il l'était.
 */
export default function InstallerVoix({ apresInstallation }: { apresInstallation?: () => void }) {
  const [manque, setManque] = useState<AManquer[] | null>(null)
  const [encours, setEncours] = useState(false)
  const [dit, setDit] = useState('')
  const [refus, setRefus] = useState('')

  const relire = () =>
    invoke<AManquer[]>('voix_a_installer')
      .then(setManque)
      .catch((e) => {
        setManque([])
        setRefus(String(e))
      })

  useEffect(() => {
    relire()
  }, [])

  const installer = async () => {
    setDit('')
    setRefus('')
    setEncours(true)
    try {
      setDit(await invoke<string>('voix_installer'))
      await relire()
      // Les pièces sont là : l'écoute peut démarrer, maintenant et pas au
      // prochain lancement.
      apresInstallation?.()
    } catch (e) {
      setRefus(String(e))
    } finally {
      setEncours(false)
    }
  }

  if (manque === null) return null
  const total = manque.reduce((n, m) => n + m.octets, 0)

  return (
    <div className="bloc">
      <h3>La voix</h3>
      {manque.length === 0 ? (
        <p className="precision">Tout ce qui se télécharge est déjà installé.</p>
      ) : (
        <>
          <p>
            Il manque {manque.length === 1 ? 'une pièce' : `${manque.length} pièces`} pour que
            votre agent vous entende et vous réponde de vive voix. Je peux aller les chercher :{' '}
            {enMegaoctets(total)} en tout, une seule fois.
          </p>
          <ul className="precision">
            {manque.map((m) => (
              <li key={m.role}>
                {m.role} — {enMegaoctets(m.octets)}
                {m.licence ? ` (${m.licence})` : ''}
              </li>
            ))}
          </ul>
          <button onClick={installer} disabled={encours}>
            {encours ? 'Installation en cours…' : 'Installer la voix'}
          </button>
          {encours && (
            <p className="precision">
              Ne fermez pas l'application. Rien n'est posé tant que le fichier reçu n'est pas
              reconnu.
            </p>
          )}
        </>
      )}
      {dit && <p className="succes-banner">{dit}</p>}
      {refus && <p className="error-banner">{refus}</p>}
    </div>
  )
}
