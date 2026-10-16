import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Procedure } from './ProceduresWeb'
import {
  REGISTRE,
  INFOS,
  type Infos,
  type Plateforme,
  consigneInscription,
  infosParDefaut,
  titreInscription,
} from '../inscriptions/consigne'

const CLE_INFOS = 'iagent-inscriptions-infos'

function lireInfos(): Infos {
  try {
    const brut = localStorage.getItem(CLE_INFOS)
    return brut ? { ...infosParDefaut(), ...JSON.parse(brut) } : infosParDefaut()
  } catch {
    return infosParDefaut()
  }
}

/** Où en est le compte, d'après la dernière procédure tirée de cette plateforme. */
function etat(p: Plateforme, derniere: Procedure | undefined): { libelle: string; classe: string; occupe: boolean } {
  if (p.mode === 'dirigeant') return { libelle: 'à créer par vous', classe: 'statut-en-attente', occupe: true }
  if (p.mode === 'plus-tard') return { libelle: 'plus tard', classe: '', occupe: true }
  if (!derniere) return { libelle: 'à ouvrir', classe: '', occupe: false }
  switch (derniere.statut) {
    case 'en-file':
      return { libelle: 'attend le navigateur', classe: '', occupe: true }
    case 'en-cours':
      return { libelle: 'un agent y travaille', classe: '', occupe: true }
    case 'en-attente':
      return { libelle: 'attend votre réponse', classe: 'statut-en-attente', occupe: true }
    case 'interrompue':
      return { libelle: 'interrompue', classe: 'statut-interrompue', occupe: true }
    case 'terminee':
      return { libelle: 'ouvert', classe: 'statut-terminee', occupe: true }
    case 'echec':
      return { libelle: 'non abouti', classe: 'statut-en-attente', occupe: false }
    default:
      return { libelle: 'abandonné', classe: '', occupe: false }
  }
}

/**
 * Les comptes officiels d'iAgent, plateforme par plateforme, dans l'ordre du
 * registre de max. Un clic confie l'ouverture d'un compte à un agent : il y
 * colle les textes du registre, joint le logo et la bannière, et pose ses
 * questions (code reçu, captcha) dans « Le travail de vos agents sur le web ».
 */
export default function ComptesIAgent() {
  const [infos, setInfos] = useState<Infos>(lireInfos)
  const [procedures, setProcedures] = useState<Procedure[]>([])
  const [publier, setPublier] = useState(false)
  const [ouverte, setOuverte] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [copie, setCopie] = useState('')

  useEffect(() => {
    invoke<Procedure[]>('procedure_liste').then(setProcedures).catch(() => {})
    const fin = listen<Procedure>('procedure', (e) => {
      setProcedures((l) => [e.payload, ...l.filter((p) => p.id !== e.payload.id)].sort((a, b) => b.modifiee - a.modifiee))
    })
    return () => {
      fin.then((f) => f())
    }
  }, [])

  const changerInfo = (cle: keyof Infos, valeur: string) => {
    const suite = { ...infos, [cle]: valeur }
    setInfos(suite)
    try {
      localStorage.setItem(CLE_INFOS, JSON.stringify(suite))
    } catch {
      // Sans stockage, les réponses valent pour cette session seulement.
    }
  }

  // La liste est triée de la plus récente à la plus ancienne.
  const derniere = useMemo(() => {
    const m = new Map<string, Procedure>()
    for (const p of procedures) if (p.modele && !m.has(p.modele)) m.set(p.modele, p)
    return m
  }, [procedures])

  const confier = async (liste: Plateforme[]) => {
    setErreur('')
    try {
      await invoke('inscriptions_preparer_visuels')
      for (const p of liste) {
        await invoke('procedure_lancer', {
          titre: titreInscription(p),
          consigne: consigneInscription(p, infos, publier),
          modele: p.id,
        })
      }
      setProcedures(await invoke<Procedure[]>('procedure_liste'))
    } catch (e) {
      setErreur(String(e))
    }
  }

  const copier = async (texte: string, cle: string) => {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(cle)
    } catch {
      setErreur('La copie a échoué : sélectionnez le texte à la main.')
    }
  }

  const voir = (adresse: string) => invoke('navigateur_ouvrir', { adresse }).catch((e) => setErreur(String(e)))

  const libres = (ids: Plateforme[]) => ids.filter((p) => p.mode === 'agent' && !etat(p, derniere.get(p.id)).occupe)
  const ouverts = REGISTRE.plateformes.filter((p) => derniere.get(p.id)?.statut === 'terminee').length
  const parAgent = REGISTRE.plateformes.filter((p) => p.mode === 'agent').length

  return (
    <section className="comptes-iagent">
      <h3>Les comptes d’iAgent sur les réseaux</h3>
      <p>
        {REGISTRE.plateformes.length} plateformes du registre d’octobre 2026 : {parAgent} s’ouvrent par un agent, les autres sont à
        vous ou attendent leur moment. {ouverts} compte{ouverts > 1 ? 's' : ''} ouvert{ouverts > 1 ? 's' : ''} à ce jour. Les
        agents travaillent l’un après l’autre dans le navigateur ; quand l’un attend un code, le suivant prend la main.
      </p>

      <details className="comptes-infos">
        <summary>Informations de l’entreprise données aux agents</summary>
        <p className="precision">Ce qui reste vide n’est jamais deviné : l’agent vous le demande si un formulaire l’exige.</p>
        {INFOS.map((i) => (
          <label key={i.cle} className="comptes-info">
            <span>{i.libelle}</span>
            <input type="text" value={infos[i.cle]} onChange={(e) => changerInfo(i.cle, e.target.value)} />
            <span className="precision">{i.aide}</span>
          </label>
        ))}
      </details>

      <label className="comptes-publier">
        <input type="checkbox" checked={publier} onChange={(e) => setPublier(e.target.checked)} />
        Publier aussi le premier message de chaque compte (sinon il reste en brouillon, ou n’est pas posté)
      </label>

      {erreur && <div className="error-banner">{erreur}</div>}

      {REGISTRE.etapes.map((etape) => {
        const plateformes = REGISTRE.plateformes.filter((p) => p.etape === etape)
        const aConfier = libres(plateformes)
        return (
          <div key={etape} className="comptes-etape">
            <div className="ligne">
              <h4>{etape}</h4>
              {aConfier.length > 1 && (
                <button className="lien" onClick={() => confier(aConfier)}>
                  Confier les {aConfier.length} comptes de l’étape
                </button>
              )}
            </div>
            <ul>
              {plateformes.map((p) => {
                const d = derniere.get(p.id)
                const e = etat(p, d)
                return (
                  <li key={p.id}>
                    <div className="ligne">
                      <span className="site-nom">{p.nom}</span>
                      <span className="precision">{p.priorite}</span>
                      <span className={`procedure-statut ${e.classe}`}>{e.libelle}</span>
                      {d?.adresse && (
                        <button className="lien" onClick={() => voir(d.adresse!)}>
                          voir le profil
                        </button>
                      )}
                      {p.mode === 'agent' && !e.occupe && <button onClick={() => confier([p])}>Confier à un agent</button>}
                      <button className="lien" onClick={() => setOuverte(ouverte === p.id ? null : p.id)}>
                        {ouverte === p.id ? 'Masquer' : p.mode === 'dirigeant' ? 'Textes à copier' : 'Détail'}
                      </button>
                    </div>
                    {p.raison && <p className="precision">{p.raison}</p>}
                    {d?.statut === 'echec' && d.resultat && <p className="lecture-refus">{d.resultat}</p>}
                    {ouverte === p.id && (
                      <div className="comptes-detail">
                        <p className="precision">
                          {p.typeCompte} · identifiant souhaité {p.identifiant} · {p.categorie} ·{' '}
                          <button className="lien" onClick={() => voir(p.adresse)}>
                            page d’inscription
                          </button>
                        </p>
                        {p.textes.map((t, i) => (
                          <div key={i} className="comptes-texte">
                            <div className="ligne">
                              <strong>{t.champ}</strong>
                              <span className="precision">
                                {[...t.texte].length} caractères{t.plafond ? ` sur ${t.plafond}` : ''}
                              </span>
                              <button className="lien" onClick={() => copier(t.texte, `${p.id}-${i}`)}>
                                {copie === `${p.id}-${i}` ? 'copié' : 'copier'}
                              </button>
                            </div>
                            <p>{t.texte}</p>
                          </div>
                        ))}
                        {p.premierMessage && (
                          <div className="comptes-texte">
                            <div className="ligne">
                              <strong>Premier message</strong>
                              <button className="lien" onClick={() => copier(p.premierMessage!.texte, `${p.id}-post`)}>
                                {copie === `${p.id}-post` ? 'copié' : 'copier'}
                              </button>
                            </div>
                            <p>{p.premierMessage.texte}</p>
                          </div>
                        )}
                        <p className="precision">À respecter : {p.vigilance}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
