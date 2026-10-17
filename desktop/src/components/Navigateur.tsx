import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'

/** Un compte que le client déclare avoir connecté dans le navigateur. */
type SiteConnecte = {
  nom: string
  hote: string
  declare_le: number
}

/** Lecture structurelle : aucune valeur de champ, cookie ou mot de passe. */
type Observation = {
  version: number
  id: string
  origine: string
  titre: string
  titres: string[]
  elements: Array<{
    tag: string
    role: string
    type_champ: string
    nom: string
    requis: boolean
    inactif: boolean
  }>
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
  const [observation, setObservation] = useState<Observation | null>(null)
  const [texteAction, setTexteAction] = useState('')
  const [resultatAction, setResultatAction] = useState('')
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
    setObservation(null)
    setOccupe(true)
    try {
      await invoke('navigateur_ouvrir', { adresse: cible })
    } catch (e) {
      setErreur(String(e))
    } finally {
      setOccupe(false)
    }
  }

  const observer = async () => {
    setErreur('')
    setOccupe(true)
    setObservation(null)
    try {
      setObservation(await invoke<Observation>('navigateur_observer'))
    } catch (e) {
      setErreur(String(e))
    } finally {
      setOccupe(false)
    }
  }

  // Ce pilote initial sert a valider MANUELLEMENT la chaine de pilotage WebView.
  // L'agent IA n'y a pas encore acces : la permission doit etre raccordee a
  // l'orchestrateur de confiance avant toute execution non supervisee.
  const agir = async (index: number, geste: 'renseigner' | 'cliquer') => {
    if (!observation) return
    const element = observation.elements[index]
    if (!element) return
    const nomElement = element.nom || 'element sans libelle'
    const question = geste === 'cliquer'
      ? `Confirmer le clic sur « ${nomElement} » sur ${observation.origine} ? Ce bouton peut declencher une action sur le site.`
      : `Confirmer le remplissage du champ « ${nomElement} » sur ${observation.origine} ?`
    if (!window.confirm(question)) return
    setErreur('')
    setResultatAction('')
    setOccupe(true)
    try {
      const retour = await invoke<{ statut: string; observation_a_rafraichir: boolean }>('navigateur_action', {
        observationId: observation.id,
        index,
        geste,
        texte: geste === 'renseigner' ? texteAction : null,
        confirmationHumaine: true,
      })
      setObservation(null)
      setResultatAction(`${retour.statut} : l'evenement a ete emis. Verifiez le resultat sur le site et relancez une observation.`)
    } catch (e) {
      setObservation(null)
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
    setObservation(null)
    try {
      setSites(await invoke<SiteConnecte[]>('navigateur_oublier_site', { hote }))
    } catch (e) {
      setErreur(String(e))
    }
  }

  const effacer = async () => {
    setErreur('')
    setObservation(null)
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

      <section className="navigateur-observation">
        <h3>Analyser et tester les actions sur une page</h3>
        <p className="precision">
          Lecture locale des titres, boutons et noms de champs du site HTTPS déclaré.
          Cette fonction ne lit ni les textes saisis dans les formulaires, ni les mots de passe,
          ni les cookies, et n'effectue aucune action. Elle ne fonctionne pas sur les pages
          qui refusent cette lecture. Les boutons de test ci-dessous exigent toujours
          une confirmation humaine, ne publient rien automatiquement et ne prouvent
          pas qu'une mission est terminee.
        </p>
        <button disabled={occupe || sites.length === 0} onClick={observer}>
          {occupe ? 'Lecture en cours…' : 'Analyser la page ouverte'}
        </button>
        {resultatAction && <p className="precision" role="status">{resultatAction}</p>}
        {observation && (
          <div className="navigateur-resultat">
            <p><strong>{observation.titre || 'Page sans titre'}</strong> — {observation.origine}</p>
            {observation.titres.length > 0 && (
              <p className="precision">Rubriques : {observation.titres.join(' · ')}</p>
            )}
            <p className="precision">
              {observation.elements.length} élément(s) interactif(s) relevé(s), sans leurs valeurs.
              Chaque tentative d'action consomme cette observation et necessite ensuite une nouvelle lecture.
            </p>
            <label htmlFor="web-operator-texte">Texte de test à placer dans un champ autorisé</label>
            <input
              id="web-operator-texte"
              type="text"
              maxLength={2000}
              value={texteAction}
              onChange={(e) => setTexteAction(e.target.value)}
              placeholder="Texte à saisir dans le champ sélectionné"
            />
            <ul>
              {observation.elements.map((element, index) => (
                <li key={index}>
                  <strong>{element.nom || 'Sans libellé'}</strong>
                  {' — '}{element.role || element.tag}
                  {element.type_champ ? ' / ' + element.type_champ : ''}
                  {element.requis ? ' · obligatoire' : ''}
                  {element.inactif ? ' · inactif' : ''}
                  {' '}
                  {((element.tag === 'textarea') ||
                    (element.tag === 'input' && ['', 'text', 'email', 'tel', 'search', 'url', 'number'].includes(element.type_champ))) &&
                    !!element.nom && !element.inactif && (
                      <button disabled={occupe} onClick={() => agir(index, 'renseigner')}>Remplir (test)</button>
                    )}
                  {element.tag === 'button' && element.type_champ === 'button' &&
                    !!element.nom && !element.inactif && (
                      <button disabled={occupe} onClick={() => agir(index, 'cliquer')}>Cliquer (test)</button>
                    )}
                </li>
              ))}
            </ul>
          </div>
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
