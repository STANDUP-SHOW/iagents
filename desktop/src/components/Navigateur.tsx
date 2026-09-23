import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/** Un compte que le client déclare avoir connecté dans le navigateur. */
type SiteConnecte = {
  nom: string
  hote: string
  declare_le: number
}

const SUGGESTIONS: { nom: string; adresse: string }[] = [
  { nom: 'Sage', adresse: 'https://www.sage.com/fr-fr/' },
  { nom: 'Cegid', adresse: 'https://www.cegid.com/fr/' },
  { nom: 'Pennylane', adresse: 'https://app.pennylane.com/' },
  { nom: 'LinkedIn', adresse: 'https://www.linkedin.com/' },
]

function enClair(secondes: number): string {
  if (!secondes) return ''
  return new Date(secondes * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function Navigateur() {
  const [sites, setSites] = useState<SiteConnecte[]>([])
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  // La demande d'effacement passe par une confirmation : déconnecter le client
  // de tous ses comptes sur un clic de travers se répare mal.
  const [effacementDemande, setEffacementDemande] = useState(false)

  useEffect(() => {
    invoke<SiteConnecte[]>('navigateur_sites')
      .then(setSites)
      .catch((e) => setErreur(String(e)))
  }, [])

  const ouvrir = async (cible: string) => {
    setErreur('')
    setOccupe(true)
    try {
      await invoke('navigateur_ouvrir', { adresse: cible })
    } catch (e) {
      setErreur(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const declarer = async () => {
    setErreur('')
    setOccupe(true)
    try {
      const liste = await invoke<SiteConnecte[]>('navigateur_declarer_site', { nom, adresse })
      setSites(liste)
      setNom('')
      setAdresse('')
    } catch (e) {
      setErreur(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const oublier = async (hote: string) => {
    setErreur('')
    try {
      setSites(await invoke<SiteConnecte[]>('navigateur_oublier_site', { hote }))
    } catch (e) {
      setErreur(String(e))
    }
  }

  const effacer = async () => {
    setErreur('')
    setOccupe(true)
    try {
      await invoke('navigateur_effacer_sessions')
      setSites([])
      setEffacementDemande(false)
    } catch (e) {
      setErreur(String(e))
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div className="navigateur">
      <h2>Vos comptes</h2>
      <p>
        Ouvrez ici les sites que vous utilisez et connectez-vous avec vos identifiants, comme
        dans un navigateur ordinaire. La connexion reste ouverte d'un lancement à l'autre.
        L'application ne saisit jamais votre mot de passe et ne le conserve nulle part.
      </p>
      <p className="precision">
        Vos agents travailleront dans ces sessions. Pour l'instant ils regardent : ils ne
        cliquent, ne remplissent et ne publient rien sans que vous validiez.
      </p>

      {erreur && <div className="error-banner">{erreur}</div>}

      <section className="navigateur-ouvrir">
        <h3>Ouvrir un site</h3>
        <div className="ligne">
          <input
            type="url"
            placeholder="https://mon-erp.exemple.fr"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
          <button disabled={occupe || !adresse.trim()} onClick={() => ouvrir(adresse)}>
            Ouvrir
          </button>
        </div>
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s.adresse} className="lien" disabled={occupe} onClick={() => ouvrir(s.adresse)}>
              {s.nom}
            </button>
          ))}
        </div>
      </section>

      <section className="navigateur-declarer">
        <h3>Dire à vos agents où vous êtes connecté</h3>
        <p>
          Une fois connecté sur un site, déclarez-le : vos agents sauront qu'ils peuvent y
          travailler. Rien d'autre n'est enregistré que le nom et l'adresse du site.
        </p>
        <div className="ligne">
          <input
            type="text"
            placeholder="Mon compte Sage"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
          />
          <input
            type="url"
            placeholder="https://www.sage.com"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
          <button disabled={occupe || !nom.trim() || !adresse.trim()} onClick={declarer}>
            Déclarer
          </button>
        </div>
      </section>

      <section className="navigateur-liste">
        <h3>Comptes déclarés</h3>
        {sites.length === 0 ? (
          <p className="vide">Aucun compte déclaré pour l'instant.</p>
        ) : (
          <ul>
            {sites.map((s) => (
              <li key={s.hote}>
                <span className="site-nom">{s.nom}</span>
                <span className="site-hote">{s.hote}</span>
                <span className="site-date">déclaré le {enClair(s.declare_le)}</span>
                <button className="lien" onClick={() => ouvrir(`https://${s.hote}`)}>
                  Ouvrir
                </button>
                <button className="lien" onClick={() => oublier(s.hote)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="navigateur-effacer">
        <h3>Me déconnecter partout</h3>
        <p>
          Efface toutes les sessions ouvertes dans ce navigateur, sur tous les sites, et la
          liste des comptes déclarés. Vous devrez vous reconnecter partout.
        </p>
        {effacementDemande ? (
          <div className="ligne">
            <button disabled={occupe} onClick={effacer}>
              Oui, tout effacer
            </button>
            <button className="lien" onClick={() => setEffacementDemande(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button disabled={occupe} onClick={() => setEffacementDemande(true)}>
            Me déconnecter partout
          </button>
        )}
        <p className="precision">
          Fermez d'abord la fenêtre de navigation : le profil ne s'efface pas pendant qu'il
          sert.
        </p>
      </section>
    </div>
  )
}
