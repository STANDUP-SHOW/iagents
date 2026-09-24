import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { empreinte, type Brouillon } from '../agents/courriel'

type CompteCourriel = {
  adresse: string
  identifiant: string
  imap_serveur: string
  imap_port: number
  smtp_serveur: string
  smtp_port: number
}

type Envoi = {
  date: number
  de: string
  destinataires: string[]
  objet: string
  empreinte: string
}

const COMPTE_VIDE: CompteCourriel = {
  adresse: '',
  identifiant: '',
  imap_serveur: '',
  imap_port: 993,
  smtp_serveur: '',
  smtp_port: 587,
}

function enClair(secondes: number): string {
  if (!secondes) return ''
  return new Date(secondes * 1000).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Courriel() {
  const [compte, setCompte] = useState<CompteCourriel>(COMPTE_VIDE)
  const [brouillon, setBrouillon] = useState<Brouillon>({
    destinataires: [],
    objet: '',
    corps: '',
  })
  const [destinataires, setDestinataires] = useState('')
  const [envois, setEnvois] = useState<Envoi[]>([])
  const [erreur, setErreur] = useState('')
  const [parti, setParti] = useState('')
  const [occupe, setOccupe] = useState(false)
  // L'empreinte du texte que le client a sous les yeux au moment où il demande
  // l'envoi. C'est elle qui part avec le message ; si le brouillon bouge après,
  // l'application refuse. Sans cette étape, « le client valide » ne voudrait
  // rien dire de vérifiable.
  const [relu, setRelu] = useState<string | null>(null)

  useEffect(() => {
    invoke<Envoi[]>('courriel_envois')
      .then(setEnvois)
      .catch((e) => setErreur(String(e)))
  }, [])

  // Toute modification du brouillon annule la relecture : le client relira.
  useEffect(() => {
    setRelu(null)
    setParti('')
  }, [brouillon.destinataires.join(','), brouillon.objet, brouillon.corps])

  const majDestinataires = (saisie: string) => {
    setDestinataires(saisie)
    setBrouillon({
      ...brouillon,
      destinataires: saisie
        .split(/[,;]/)
        .map((d) => d.trim())
        .filter((d) => d.length > 0),
    })
  }

  const envoyer = async () => {
    setErreur('')
    setOccupe(true)
    try {
      const envoi = await invoke<Envoi>('courriel_envoyer', {
        compte,
        brouillon,
        empreinteValidee: relu,
      })
      setEnvois([...envois, envoi])
      setParti(`Envoyé à ${envoi.destinataires.join(', ')}.`)
      setBrouillon({ destinataires: [], objet: '', corps: '' })
      setDestinataires('')
    } catch (e) {
      setErreur(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const pret =
    brouillon.destinataires.length > 0 &&
    brouillon.objet.trim().length > 0 &&
    brouillon.corps.trim().length > 0

  return (
    <div className="courriel">
      <h2>Courrier</h2>
      <p>
        Vos agents préparent les messages ; c'est vous qui les envoyez. Rien ne part sans que
        vous ayez relu le texte exact qui partira.
      </p>

      {erreur && <div className="error-banner">{erreur}</div>}
      {parti && <div className="succes-banner">{parti}</div>}

      <section className="courriel-compte">
        <h3>Votre boîte</h3>
        <div className="ligne">
          <input
            type="email"
            placeholder="vous@votre-entreprise.fr"
            value={compte.adresse}
            onChange={(e) => setCompte({ ...compte, adresse: e.target.value })}
          />
          <input
            type="text"
            placeholder="identifiant"
            value={compte.identifiant}
            onChange={(e) => setCompte({ ...compte, identifiant: e.target.value })}
          />
        </div>
        <div className="ligne">
          <input
            type="text"
            placeholder="smtp.votre-hebergeur.fr"
            value={compte.smtp_serveur}
            onChange={(e) => setCompte({ ...compte, smtp_serveur: e.target.value })}
          />
          <input
            type="number"
            value={compte.smtp_port}
            onChange={(e) => setCompte({ ...compte, smtp_port: Number(e.target.value) })}
          />
        </div>
        <p className="precision">
          Votre mot de passe est rangé dans le coffre du système, jamais dans un fichier de
          l'application.
        </p>
      </section>

      <section className="courriel-brouillon">
        <h3>Le message</h3>
        <input
          type="text"
          placeholder="destinataires, séparés par des virgules"
          value={destinataires}
          onChange={(e) => majDestinataires(e.target.value)}
        />
        <input
          type="text"
          placeholder="objet"
          value={brouillon.objet}
          onChange={(e) => setBrouillon({ ...brouillon, objet: e.target.value })}
        />
        <textarea
          rows={10}
          placeholder="texte du message"
          value={brouillon.corps}
          onChange={(e) => setBrouillon({ ...brouillon, corps: e.target.value })}
        />
      </section>

      <section className="courriel-relecture">
        {relu === null ? (
          <>
            <button disabled={!pret} onClick={() => setRelu(empreinte(brouillon))}>
              Relire avant d'envoyer
            </button>
            <p className="precision">
              L'envoi n'apparaît qu'après la relecture, et toute modification du texte la
              redemande.
            </p>
          </>
        ) : (
          <>
            <h3>Ce qui va partir</h3>
            <div className="relecture">
              <p>
                <strong>À</strong> {brouillon.destinataires.join(', ')}
              </p>
              <p>
                <strong>Objet</strong> {brouillon.objet}
              </p>
              <pre>{brouillon.corps}</pre>
            </div>
            <div className="ligne">
              <button disabled={occupe} onClick={envoyer}>
                Envoyer ce message
              </button>
              <button className="lien" onClick={() => setRelu(null)}>
                Modifier
              </button>
            </div>
          </>
        )}
      </section>

      <section className="courriel-envois">
        <h3>Déjà partis</h3>
        {envois.length === 0 ? (
          <p className="vide">Aucun message envoyé depuis cette application.</p>
        ) : (
          <ul>
            {[...envois].reverse().map((e) => (
              <li key={`${e.date}-${e.empreinte}`}>
                <span className="envoi-date">{enClair(e.date)}</span>
                <span className="envoi-objet">{e.objet}</span>
                <span className="envoi-a">à {e.destinataires.join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
