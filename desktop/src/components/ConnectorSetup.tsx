import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  demanderActivation,
  matrice,
  besoinsDeLaFiche,
  CAPACITES,
  type Capacite,
  type Connecteur,
  type ReferentielConnecteurs,
} from '../agents/connecteurs'

/**
 * La matrice à cocher.
 *
 * Le client coche ce qu'il utilise — Odoo, Shopify, Pennylane — et l'application sait quoi
 * lui demander, parce que c'est écrit au catalogue. Ce qui se joue ici, au-delà de la liste :
 * aucun bouton « Connecter » ne s'affiche sans passer par `demanderActivation`. Quand la
 * règle refuse, on écrit ce qui manque au lieu de griser un bouton sans explication.
 *
 * L'écran d'avant listait six plateformes codées en dur dont cinq disaient « Coming Soon »,
 * et la sixième affichait « connected » après avoir validé un jeton qu'elle ne rangeait nulle
 * part. Personne n'était connecté à rien.
 */

const RUBRIQUES: Record<string, string> = {
  metier: 'Vos logiciels métier',
  communication: 'Vos canaux',
  bureautique: 'Votre bureautique',
}

const RISQUES: Record<string, string> = {
  critique: 'risque critique',
  eleve: 'risque élevé',
  moyen: 'risque moyen',
  faible: 'risque faible',
}

const BESOINS: Record<Capacite, string> = {
  voix: 'Parler et entendre',
  conversation: 'Discuter avec vous',
  email: 'Envoyer des courriels',
  whatsapp: 'Répondre sur WhatsApp',
  calendrier: 'Tenir un agenda',
  fichiers: 'Lire et déposer des fichiers',
  navigateur: 'Se servir de vos sites',
  telephone: 'Passer des appels',
}

export default function ConnectorSetup() {
  const [ref, setRef] = useState<ReferentielConnecteurs | null>(null)
  const [erreur, setErreur] = useState('')
  const [rubrique, setRubrique] = useState('metier')
  const [filtre, setFiltre] = useState('')
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [coches, setCoches] = useState<string[]>([])

  useEffect(() => {
    invoke<string>('lire_referentiel', { nom: 'connecteurs' })
      .then((brut) => setRef(JSON.parse(brut)))
      .catch((e) => setErreur(String(e)))
  }, [])

  const rubriques = useMemo(() => (ref ? matrice(ref) : []), [ref])

  const courante = rubriques.find((r) => r.categorie === rubrique)
  const cherche = filtre.trim().toLowerCase()
  const familles = (courante?.familles ?? [])
    .map((f) => ({
      ...f,
      connecteurs: f.connecteurs.filter(
        (c) =>
          !cherche ||
          c.nom.toLowerCase().includes(cherche) ||
          c.specialite.toLowerCase().includes(cherche)
      ),
    }))
    .filter((f) => f.connecteurs.length > 0)

  const cocher = (id: string) =>
    setCoches((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))

  if (erreur) {
    return (
      <div className="connecteurs">
        <h2>Vos connexions</h2>
        <div className="error-banner">Catalogue des connecteurs illisible — {erreur}</div>
      </div>
    )
  }
  if (!ref) {
    return (
      <div className="connecteurs">
        <h2>Vos connexions</h2>
        <p>Lecture du catalogue…</p>
      </div>
    )
  }

  const ouvrables = ref.connecteurs.filter((c) => demanderActivation(ref, c.id).accorde)
  // Une fiche type sert à montrer la traduction besoin → connecteurs sans en choisir une.
  const besoins = besoinsDeLaFiche(ref, [...CAPACITES])

  return (
    <div className="connecteurs">
      <h2>Vos connexions</h2>
      <p className="subtitle">
        {ref.connecteurs.length} logiciels et canaux sont décrits au catalogue.{' '}
        {ouvrables.length === 0
          ? "Aucun n'est encore ouvrable : chacun attend d'être chiffré et son risque classé avant qu'on vous propose de vous y brancher."
          : `${ouvrables.length} sont ouvrables aujourd'hui.`}
      </p>

      <section className="besoins">
        <h3>Ce que vos agents réclament</h3>
        <ul>
          {besoins.map((b) => (
            <li key={b.capacite}>
              <strong>{BESOINS[b.capacite]}</strong>{' '}
              {b.parLApplication ? (
                <span className="servi">tenu par {b.parLApplication}</span>
              ) : (
                <span>
                  {b.candidats.length} possibilité{b.candidats.length > 1 ? 's' : ''} au
                  catalogue
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Outillage />

      <nav className="rubriques">
        {ref.categories.map((c) => (
          <button
            key={c}
            className={rubrique === c ? 'active' : ''}
            onClick={() => setRubrique(c)}
          >
            {RUBRIQUES[c] ?? c}
          </button>
        ))}
      </nav>

      <input
        type="search"
        placeholder="Chercher un logiciel…"
        value={filtre}
        onChange={(e) => setFiltre(e.target.value)}
      />

      {coches.length > 0 && (
        <p className="coches">
          {coches.length} coché{coches.length > 1 ? 's' : ''} — on vous les proposera dès
          qu'ils seront ouvrables.
        </p>
      )}

      {familles.length === 0 && <p>Rien ne correspond à « {filtre} » dans cette rubrique.</p>}

      {familles.map((f) => (
        <section key={f.famille} className="famille">
          <h3>{f.famille.replace(/-/g, ' ')}</h3>
          {f.connecteurs.map((c) => (
            <Ligne
              key={c.id}
              connecteur={c}
              ref_={ref}
              coche={coches.includes(c.id)}
              onCocher={() => cocher(c.id)}
              ouvert={ouvert === c.id}
              onOuvrir={() => setOuvert(ouvert === c.id ? null : c.id)}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

interface ServeurVisible {
  nom: string
  commande: string
  role: string
  connecteur: string | null
  secrets_attendus: string[]
  pret: boolean
}

/**
 * Ce que les agents savent faire, en dehors des logiciels du client.
 *
 * Volontairement écrit du point de vue de l'employeur et pas de l'intégrateur :
 * il lit ce que l'outil permet et ce qu'il lui reste à fournir, pas une commande
 * ni un protocole. Quand un serveur ne se lance pas, la raison s'affiche telle
 * quelle plutôt que de laisser croire à une panne de l'application.
 */
function Outillage() {
  const [serveurs, setServeurs] = useState<ServeurVisible[]>([])
  const [erreur, setErreur] = useState('')
  const [secret, setSecret] = useState<Record<string, string>>({})
  const [dit, setDit] = useState('')

  useEffect(() => {
    invoke<ServeurVisible[]>('mcp_serveurs')
      .then(setServeurs)
      .catch((e) => setErreur(String(e)))
  }, [])

  const ranger = async (nom: string) => {
    setErreur('')
    try {
      setDit(await invoke<string>('mcp_ranger_secret', { nomDeVariable: nom, valeur: secret[nom] ?? '' }))
      setSecret((v) => ({ ...v, [nom]: '' }))
      setServeurs(await invoke<ServeurVisible[]>('mcp_serveurs'))
    } catch (e) {
      setErreur(String(e))
    }
  }

  if (erreur && serveurs.length === 0) {
    return (
      <section className="besoins">
        <h3>Ce que vos agents savent faire</h3>
        <p className="refus">{erreur}</p>
      </section>
    )
  }

  return (
    <section className="besoins">
      <h3>Ce que vos agents savent faire</h3>
      {dit && <p className="servi">{dit}</p>}
      {erreur && <p className="refus">{erreur}</p>}
      <ul>
        {serveurs.map((s) => (
          <li key={s.nom}>
            <strong>{s.role}</strong>
            {s.secrets_attendus.length > 0 && !s.pret && (
              <span className="etapes">
                {s.secrets_attendus.map((nom) => (
                  <span key={nom}>
                    <input
                      type="password"
                      placeholder={`Votre ${nom.toLowerCase().replace(/_/g, ' ')}`}
                      value={secret[nom] ?? ''}
                      onChange={(e) => setSecret((v) => ({ ...v, [nom]: e.target.value }))}
                    />
                    <button className="setup-btn" onClick={() => ranger(nom)}>
                      Ranger dans le coffre
                    </button>
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="context">
        Ce que vous rangez ici va dans le coffre de votre ordinateur, jamais dans un fichier
        ni chez nous. Un agent ne se sert que des outils que vous lui avez confiés, et rien
        qui modifie quelque chose ne part sans que vous l'ayez validé.
      </p>
    </section>
  )
}

function Ligne({
  connecteur,
  ref_,
  coche,
  onCocher,
  ouvert,
  onOuvrir,
}: {
  connecteur: Connecteur
  ref_: ReferentielConnecteurs
  coche: boolean
  onCocher: () => void
  ouvert: boolean
  onOuvrir: () => void
}) {
  const reponse = demanderActivation(ref_, connecteur.id)

  return (
    <article className={`connecteur${coche ? ' coche' : ''}`}>
      <label>
        <input type="checkbox" checked={coche} onChange={onCocher} />
        <span className="nom">{connecteur.nom}</span>
      </label>
      <p className="specialite">{connecteur.specialite}</p>

      <p className="marques">
        {connecteur.risque && <span className="marque">{RISQUES[connecteur.risque]}</span>}
        {connecteur.sert.map((s) => (
          <span className="marque" key={s}>
            {BESOINS[s]}
          </span>
        ))}
      </p>

      {reponse.accorde ? (
        <button className="setup-btn" onClick={onOuvrir}>
          {ouvert ? 'Fermer' : 'Se connecter'}
        </button>
      ) : (
        <p className="refus">{reponse.motif}</p>
      )}

      {ouvert && reponse.accorde && (
        <div className="etapes">
          {/* La règle exige que le risque soit identifié, pas qu'il soit faible. Quand il est
              lourd, le client doit le lire avant de cliquer, pas le découvrir après. */}
          {(connecteur.risque === 'critique' || connecteur.risque === 'eleve') && (
            <p className="alerte">
              Connexion à {RISQUES[connecteur.risque]} : votre agent pourra{' '}
              {connecteur.ecriture === true ? 'lire et écrire' : 'lire'} dans {connecteur.nom}.
              Rien n'est envoyé ni publié sans que vous l'ayez validé.
            </p>
          )}
          <p>
            Authentification : {reponse.authentification}. Accès demandé :{' '}
            {reponse.accesRequis}.
          </p>
          <ol>
            {reponse.etapesClient.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}
