import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { USAGES, comptes, filtrer, initiales, type Compte } from '../agents/moteurs-ia'
import './moteurs-ia.css'

/** Tel que `cles_ia::CleCompte` le rend : jamais la clé, seulement son état. */
type EtatCle = { compte: string; rangee: boolean; employee: boolean }

// Logos read as text so they take the neon colour through `currentColor`.
const LOGOS = import.meta.glob('../assets/logos-ia/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>
const logo = (fichier: string | null) => (fichier ? LOGOS[`../assets/logos-ia/${fichier}`] : undefined)

function Logo({ fichier, nom }: { fichier: string | null; nom: string }) {
  const svg = logo(fichier)
  return svg ? (
    <span className="moteur-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <span className="moteur-logo moteur-initiales" aria-hidden="true">{initiales(nom)}</span>
  )
}

/**
 * Les moteurs d'IA que le client peut relier : un compte par éditeur, son logo,
 * ce qu'il sait faire, un lien pour créer son compte et une case pour la clé.
 *
 * La clé part au coffre du système et ne revient jamais à l'écran. Une clé
 * rangée n'est pas une clé employée : tant que l'application n'appelle pas ce
 * service, la carte le dit au lieu d'afficher « connecté ».
 */
export default function MoteursIa() {
  const tous = useMemo(comptes, [])
  const [etats, setEtats] = useState<Record<string, EtatCle>>({})
  const [usage, setUsage] = useState<string | null>(null)
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')
  const [dit, setDit] = useState<{ compte: string; texte: string; refus: boolean } | null>(null)

  const relire = () =>
    invoke<EtatCle[]>('cles_ia_etat')
      .then((l) => setEtats(Object.fromEntries(l.map((e) => [e.compte, e]))))
      .catch(() => setEtats({}))

  useEffect(() => {
    relire()
  }, [])

  const visibles = filtrer(tous, usage, recherche)
  const rangees = Object.values(etats).filter((e) => e.rangee).length

  const ranger = async (compte: string) => {
    try {
      const texte = await invoke<string>('cle_ia_ranger', { compte, cle: saisie })
      setDit({ compte, texte, refus: false })
      setSaisie('')
      setOuvert(null)
      await relire()
    } catch (e) {
      setDit({ compte, texte: String(e), refus: true })
    }
  }

  const retirer = async (compte: string) => {
    try {
      setDit({ compte, texte: await invoke<string>('cle_ia_retirer', { compte }), refus: false })
      await relire()
    } catch (e) {
      setDit({ compte, texte: String(e), refus: true })
    }
  }

  const creerCompte = (c: Compte) =>
    invoke('navigateur_ouvrir', { adresse: c.inscription }).catch((e) =>
      setDit({ compte: c.id, texte: String(e), refus: true }),
    )

  return (
    <section className="moteurs-ia">
      <h3>Vos moteurs d'IA</h3>
      <p className="moteurs-ia-explication">
        {tous.length} services d'intelligence artificielle : texte, image, vidéo, publicité, voix,
        musique… Pour en relier un, créez votre compte chez l'éditeur, copiez la clé qu'il vous
        donne et collez-la ici. Elle reste dans le coffre de cet ordinateur. Une seule clé suffit
        pour tous les modèles d'un même éditeur.
        {rangees > 0 && ` ${rangees} clé${rangees > 1 ? 's' : ''} rangée${rangees > 1 ? 's' : ''}.`}
      </p>

      <div className="moteurs-ia-filtres" role="toolbar" aria-label="Filtrer par usage">
        <button className={usage === null ? 'actif' : ''} onClick={() => setUsage(null)}>
          Tout
        </button>
        {USAGES.map((u) => (
          <button key={u.cle} className={usage === u.cle ? 'actif' : ''} onClick={() => setUsage(u.cle)}>
            {u.libelle}
          </button>
        ))}
        <input
          type="search"
          placeholder="Chercher un service…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          aria-label="Chercher un service"
        />
      </div>

      <ul className="moteurs-ia-liste">
        {visibles.map((c) => {
          const etat = etats[c.id]
          return (
            <li key={c.id} className="moteur">
              <div className="moteur-tete">
                <Logo fichier={c.logo ?? c.apis.find((a) => a.logo)?.logo ?? null} nom={c.nom} />
                <div>
                  <strong>{c.nom}</strong>
                  <span className="moteur-site">{c.site}</span>
                </div>
                {etat?.rangee && (
                  <span className={etat.employee ? 'moteur-badge employe' : 'moteur-badge'}>
                    {etat.employee ? 'Utilisé par vos agents' : 'Clé rangée, pas encore employée'}
                  </span>
                )}
              </div>
              <p className="moteur-apis">
                {c.apis.map((a) => a.nom).join(' · ')}
              </p>
              <p className="moteur-usages">
                {USAGES.filter((u) => c.usages.includes(u.cle)).map((u) => (
                  <span key={u.cle}>{u.libelle}</span>
                ))}
              </p>

              {ouvert === c.id ? (
                <div className="moteur-saisie">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder={`Votre clé ${c.nom}`}
                    value={saisie}
                    onChange={(e) => setSaisie(e.target.value)}
                    aria-label={`Votre clé ${c.nom}`}
                  />
                  <button onClick={() => ranger(c.id)} disabled={!saisie.trim()}>
                    La ranger
                  </button>
                  <button className="discret" onClick={() => { setOuvert(null); setSaisie('') }}>
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="moteur-actions">
                  <button className="discret" onClick={() => creerCompte(c)}>
                    Créer votre compte
                  </button>
                  {etat?.rangee ? (
                    <button className="discret" onClick={() => retirer(c.id)}>
                      Retirer la clé
                    </button>
                  ) : (
                    <button onClick={() => { setOuvert(c.id); setSaisie(''); setDit(null) }}>
                      Ajouter ma clé
                    </button>
                  )}
                </div>
              )}
              {dit?.compte === c.id && <p className={dit.refus ? 'refus' : 'succes'}>{dit.texte}</p>}
            </li>
          )
        })}
      </ul>
      {visibles.length === 0 && <p className="moteurs-ia-vide">Aucun service ne correspond.</p>}
    </section>
  )
}
