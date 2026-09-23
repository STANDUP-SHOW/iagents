import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  configurer,
  questionsCadre,
  questionsEntretien,
  reconnaitreActivite,
  confirmationActivite,
  resumeParle,
  type Activite,
  type FicheCompelete,
  type QuestionCadre,
  type Question,
  type Referentiel,
  type ReferentielActivites,
  type Reponse,
} from '../agents/entretien'
import type { Sexe } from '../agents/fiche'

/**
 * Le parcours d'embauche.
 *
 * Max, 22/09/2026 : le client « ne doit pas avoir l'impression de paramétrer
 * comme les agents du marché ». Ce qui se saisit ici tient donc en quatre
 * choses que l'agent ne peut pas demander lui-même, faute d'avoir encore un nom
 * et une voix : quelle fiche, quel prénom, quel genre, quel visage. Tout le
 * reste, c'est lui qui le demande, avec une proposition tirée de sa fiche que
 * le client confirme ou corrige.
 */

type Etape = 'identite' | 'visage' | 'entretien' | 'recapitulatif'

/** Tel que `catalogue/catalogue.json` l'écrit : ni « nom » ni « titre ». */
type EntreeCatalogue = { id: string; metier: string; secteur: string; slug: string }

const LIMITE_POSTES = 80

const ETAPES: { cle: Etape; titre: string }[] = [
  { cle: 'identite', titre: 'Qui vous rejoint' },
  { cle: 'visage', titre: 'Sa voix, son visage' },
  { cle: 'entretien', titre: "L'entretien" },
  { cle: 'recapitulatif', titre: 'Ce qu’il a compris' },
]

export default function Embauche() {
  const [etape, setEtape] = useState<Etape>('identite')
  const [erreur, setErreur] = useState('')
  const [enregistre, setEnregistre] = useState('')

  const [catalogue, setCatalogue] = useState<EntreeCatalogue[]>([])
  const [ref, setRef] = useState<Referentiel | null>(null)
  const [refActivites, setRefActivites] = useState<ReferentielActivites | null>(null)

  const [filtre, setFiltre] = useState('')
  const [ficheId, setFicheId] = useState('')
  const [fiche, setFiche] = useState<FicheCompelete | null>(null)
  const [prenom, setPrenom] = useState('')
  const [sexe, setSexe] = useState<Sexe | ''>('')
  const [photo, setPhoto] = useState('')
  const [voix, setVoix] = useState('')

  const [activite, setActivite] = useState<Activite | null>(null)
  const [reponsesCadre, setReponsesCadre] = useState<Record<string, string>>({})
  const [reponsesOutils, setReponsesOutils] = useState<Record<string, string>>({})

  useEffect(() => {
    invoke<string>('lire_referentiel', { nom: 'catalogue' })
      .then((brut) => setCatalogue(JSON.parse(brut).agents ?? []))
      .catch((e) => setErreur(String(e)))
    invoke<string>('lire_referentiel', { nom: 'logiciels' })
      .then((brut) => setRef(JSON.parse(brut)))
      .catch((e) => setErreur(String(e)))
    invoke<string>('lire_referentiel', { nom: 'activites' })
      .then((brut) => setRefActivites(JSON.parse(brut)))
      .catch((e) => setErreur(String(e)))
  }, [])

  const chargerFiche = async (id: string) => {
    setErreur('')
    setFicheId(id)
    setFiche(null)
    if (!id) return
    try {
      setFiche(JSON.parse(await invoke<string>('lire_fiche', { id })))
    } catch (e) {
      setErreur(String(e))
    }
  }

  // Au-delà de cette limite la liste déroulante devient inutilisable, et le
  // navigateur peine : le filtre sert à descendre sous ce seuil.
  const postesAffiches = useMemo(() => {
    const f = filtre.trim().toLowerCase()
    const retenus = f
      ? catalogue.filter(
          (c) => c.metier.toLowerCase().includes(f) || c.secteur.toLowerCase().includes(f)
        )
      : catalogue
    return retenus.slice(0, LIMITE_POSTES)
  }, [catalogue, filtre])

  const cadre: QuestionCadre[] = useMemo(
    () => (fiche ? questionsCadre(fiche) : []),
    [fiche]
  )
  const outils: Question[] = useMemo(
    () => (fiche && ref ? questionsEntretien(fiche, ref, activite ?? undefined) : []),
    [fiche, ref, activite]
  )

  // Ce que le client a dit de son activité fait entrer le pack de la branche :
  // à partir de là, l'agent cite les outils qu'on y rencontre.
  const direActivite = (dit: string) => {
    setReponsesCadre({ ...reponsesCadre, activite: dit })
    if (!refActivites || !dit.trim()) {
      setActivite(null)
      return
    }
    const v = reconnaitreActivite(dit, refActivites)
    setActivite(v.etat === 'reconnu' ? v.activite : null)
  }

  const configuration = useMemo(() => {
    if (!fiche || !ref) return null
    const reponses: Reponse[] = Object.entries(reponsesOutils)
      .filter(([, dit]) => dit.trim().length > 0)
      .map(([categorie, dit]) => ({ categorie, dit }))
    return configurer(fiche, ref, reponses)
  }, [fiche, ref, reponsesOutils])

  const embaucher = async () => {
    setErreur('')
    try {
      const existant = JSON.parse(await invoke<string>('lire_installation').catch(() => '{}'))
      const agents = Array.isArray(existant.agents) ? existant.agents : []
      const nouveau: Record<string, unknown> = { prenom: prenom.trim(), ficheId, voix }
      if (sexe) nouveau.sexe = sexe
      if (photo.trim()) nouveau.photo = photo.trim()

      const contenu = JSON.stringify(
        { ...existant, agents: [...agents, nouveau] },
        null,
        2
      )
      const chemin = await invoke<string>('installation_ecrire', { contenu })
      setEnregistre(`${prenom.trim()} est embauché. Configuration écrite dans ${chemin}.`)
    } catch (e) {
      setErreur(String(e))
    }
  }

  const identitePrete = ficheId.length > 0 && fiche !== null && prenom.trim().length > 0

  return (
    <div className="embauche">
      <h2>Embaucher un agent</h2>

      <ol className="etapes">
        {ETAPES.map((e) => (
          <li key={e.cle} className={e.cle === etape ? 'active' : ''}>
            {e.titre}
          </li>
        ))}
      </ol>

      {erreur && <div className="error-banner">{erreur}</div>}
      {enregistre && <div className="succes-banner">{enregistre}</div>}

      {etape === 'identite' && (
        <section>
          <h3>Qui vous rejoint</h3>
          <p>
            Choisissez le poste, donnez-lui un prénom. C'est tout ce que vous remplissez :
            le reste, c'est lui qui vous le demandera.
          </p>
          <input
            type="text"
            placeholder="cherchez un poste : facturation, paie, atelier…"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
          />
          <select value={ficheId} onChange={(e) => chargerFiche(e.target.value)}>
            <option value="">— choisissez un poste —</option>
            {postesAffiches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.metier} — {c.secteur.replace(/-/g, ' ')}
              </option>
            ))}
          </select>
          <p className="precision">
            {postesAffiches.length} poste(s) affiché(s) sur {catalogue.length}.
            {postesAffiches.length === LIMITE_POSTES
              ? ' Affinez votre recherche pour voir les suivants.'
              : ''}
          </p>
          {fiche && <p className="precision">Poste reconnu : {fiche.nom}.</p>}
          <div className="ligne">
            <input
              type="text"
              placeholder="son prénom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
            />
            <select value={sexe} onChange={(e) => setSexe(e.target.value as Sexe | '')}>
              <option value="">genre non précisé</option>
              <option value="femme">femme</option>
              <option value="homme">homme</option>
            </select>
          </div>
          <p className="precision">
            Le genre ne change rien à son métier : il change la façon dont il parle de
            lui-même. Vous pouvez le laisser de côté.
          </p>
          <button disabled={!identitePrete} onClick={() => setEtape('visage')}>
            Continuer
          </button>
        </section>
      )}

      {etape === 'visage' && (
        <section>
          <h3>Sa voix, son visage</h3>
          <p className="precision">
            Une seule voix française est installée pour l'instant, et c'est elle qui parlera
            quoi que vous choisissiez ici. Le choix de voix comptera le jour où les autres
            voix seront livrées ; ce que vous mettez est conservé jusque-là.
          </p>
          <input
            type="text"
            placeholder="identifiant de voix (facultatif)"
            value={voix}
            onChange={(e) => setVoix(e.target.value)}
          />
          <input
            type="text"
            placeholder="chemin d'une photo sur votre poste (facultatif)"
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
          />
          <div className="ligne">
            <button onClick={() => setEtape('entretien')}>Passer à l'entretien</button>
            <button className="lien" onClick={() => setEtape('identite')}>
              Revenir
            </button>
          </div>
        </section>
      )}

      {etape === 'entretien' && fiche && (
        <section>
          <h3>{prenom.trim()} vous pose ses questions</h3>
          <p className="precision">
            Chaque question porte déjà une proposition tirée de son poste. Confirmez, ou
            corrigez avec vos mots.
          </p>

          {cadre.map((q) => (
            <div key={q.sujet} className="question">
              <p className="dit">{q.intitule}</p>
              {q.defaut && <p className="precision">Sa proposition : {q.defaut}</p>}
              {q.options ? (
                <select
                  value={reponsesCadre[q.sujet] ?? q.defaut}
                  onChange={(e) =>
                    setReponsesCadre({ ...reponsesCadre, [q.sujet]: e.target.value })
                  }
                >
                  {q.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={q.defaut || 'votre réponse'}
                  value={reponsesCadre[q.sujet] ?? ''}
                  onChange={(e) =>
                    q.sujet === 'activite'
                      ? direActivite(e.target.value)
                      : setReponsesCadre({ ...reponsesCadre, [q.sujet]: e.target.value })
                  }
                />
              )}
              {q.sujet === 'activite' && activite && (
                <p className="dit">{confirmationActivite(activite)}</p>
              )}
            </div>
          ))}

          {outils.map((q) => (
            <div key={q.categorie} className="question">
              <p className="dit">
                {q.intitule}
                {q.principale ? ' (sans ça, je ne peux pas faire mon travail)' : ''}
              </p>
              {q.propositions.length > 0 && (
                <p className="precision">Je sais tenir : {q.propositions.join(', ')}.</p>
              )}
              <input
                type="text"
                placeholder="le vôtre, ou « aucun »"
                value={reponsesOutils[q.categorie] ?? ''}
                onChange={(e) =>
                  setReponsesOutils({ ...reponsesOutils, [q.categorie]: e.target.value })
                }
              />
            </div>
          ))}

          <div className="ligne">
            <button onClick={() => setEtape('recapitulatif')}>Voir ce qu'il a compris</button>
            <button className="lien" onClick={() => setEtape('visage')}>
              Revenir
            </button>
          </div>
        </section>
      )}

      {etape === 'recapitulatif' && configuration && (
        <section>
          <h3>Ce que {prenom.trim()} a compris</h3>
          <div className="relecture">
            {resumeParle(configuration).length === 0 ? (
              <p className="vide">Il n'a encore rien retenu : reprenez l'entretien.</p>
            ) : (
              resumeParle(configuration).map((ligne, i) => (
                <p key={i} className="dit">
                  {ligne}
                </p>
              ))
            )}
          </div>
          <p className="precision">
            Ce qui reste à préciser peut l'être plus tard : il le redemandera plutôt que de
            choisir à votre place.
          </p>
          <div className="ligne">
            <button onClick={embaucher}>Embaucher {prenom.trim()}</button>
            <button className="lien" onClick={() => setEtape('entretien')}>
              Reprendre l'entretien
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
