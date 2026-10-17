import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { EntetePage } from '../shell/Shell'
import type { Cible } from '../shell/intentions'
import './catalogue-connecteurs.css'

/**
 * The connector catalogue (max's referential of 21/09/2026, 350 entries): MCP
 * servers, business APIs, cloud AI, local AI and creative engines.
 *
 * Nothing here is decided by the screen. `connecteurs/referentiel.json` is
 * derived by `outils/referentiel.ts`: the trust level comes from the "Statut"
 * column (max's four cases — official, reference, to audit, connector iAgent
 * must write), and "branché" only shows for what the application really
 * reaches — a server declared in `serveurs-mcp.json` whose connector passes the
 * activation rule, or an engine whose source file the bench checks. Being in
 * the MCP registry is never shown as a guarantee.
 */

type Confiance = 'officiel' | 'reference' | 'a-auditer' | 'a-ecrire'
type Famille = 'mcp' | 'api' | 'ia-cloud' | 'ia-locale' | 'creation'

type Branche =
  | { par: 'serveur'; serveur: string; connecteur: string | null; activable: boolean; outils: number }
  | { par: 'application'; fichier: string; comment: string; activable: true }

export type Entree = {
  id: string
  famille: Famille
  nom: string
  priorite: string | null
  statutReleve: string | null
  confiance: Confiance | null
  acces: 'mcp' | 'api' | 'local' | 'api-ou-local'
  champs: [string, string][]
  source: string | null
  branche: Branche | null
}

export type Referentiel = {
  verifie: string
  regle: string
  confiances: Record<Confiance, { titre: string; pourLeClient: string }>
  familles: { id: Famille; titre: string }[]
  entrees: Entree[]
}

const ACCES: Record<Entree['acces'], string> = {
  mcp: 'Serveur MCP',
  api: 'Par API, avec votre clé',
  local: 'Sur votre machine',
  'api-ou-local': 'En ligne ou sur votre machine',
}

/** What the card says about the connection, in the client's words. */
export function etatDe(e: Entree): { ton: 'actif' | 'attente' | 'pause'; texte: string } {
  if (e.branche?.par === 'application') return { ton: 'actif', texte: 'Branché : l’application s’en sert' }
  if (e.branche?.par === 'serveur') {
    return e.branche.activable
      ? { ton: 'actif', texte: `Branché : ${e.branche.outils} outils pour vos agents` }
      : { ton: 'attente', texte: 'Déclaré, fermé tant que la règle n’est pas remplie' }
  }
  if (e.confiance === 'a-auditer') return { ton: 'pause', texte: 'Fermé : à auditer avant tout branchement' }
  if (e.confiance === 'a-ecrire') return { ton: 'pause', texte: 'Connecteur iAgent à écrire' }
  return { ton: 'pause', texte: 'Pas encore branché' }
}

function hote(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export default function CatalogueConnecteurs({ aller }: { aller: (c: Cible) => void }) {
  const [ref, setRef] = useState<Referentiel | null>(null)
  const [erreur, setErreur] = useState('')
  const [famille, setFamille] = useState<Famille>('mcp')
  const [recherche, setRecherche] = useState('')
  const [priorite, setPriorite] = useState('')
  const [confiance, setConfiance] = useState<Confiance | ''>('')
  const [branchesSeuls, setBranchesSeuls] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>(null)

  useEffect(() => {
    invoke<string>('lire_referentiel', { nom: 'referentiel' })
      .then((brut) => setRef(JSON.parse(brut)))
      .catch((e) => setErreur(String(e)))
  }, [])

  const visibles = useMemo(() => {
    if (!ref) return []
    const q = recherche.trim().toLowerCase()
    return ref.entrees
      .filter((e) => e.famille === famille)
      .filter((e) => !priorite || e.priorite === priorite)
      .filter((e) => !confiance || e.confiance === confiance)
      .filter((e) => !branchesSeuls || e.branche)
      .filter(
        (e) =>
          !q ||
          e.nom.toLowerCase().includes(q) ||
          e.champs.some(([, v]) => v.toLowerCase().includes(q))
      )
      .sort((a, b) => Number(!!b.branche) - Number(!!a.branche) || (a.priorite ?? 'P9').localeCompare(b.priorite ?? 'P9'))
  }, [ref, famille, recherche, priorite, confiance, branchesSeuls])

  if (erreur) {
    return (
      <div className="page-dc">
        <EntetePage onglet="connectors" titre="Catalogue des connecteurs" />
        <p className="lecture-refus">Le catalogue des connecteurs n’a pas pu être lu : {erreur}</p>
      </div>
    )
  }
  if (!ref) {
    return (
      <div className="page-dc">
        <EntetePage onglet="connectors" titre="Catalogue des connecteurs" />
        <p className="precision">Lecture du catalogue…</p>
      </div>
    )
  }

  const branches = ref.entrees.filter((e) => etatDe(e).ton === 'actif')
  const mcp = ref.entrees.filter((e) => e.famille === 'mcp')
  const officiels = mcp.filter((e) => e.confiance === 'officiel' || e.confiance === 'reference').length
  const aAuditer = mcp.filter((e) => e.confiance === 'a-auditer').length
  const aEcrire = ref.entrees.filter((e) => e.confiance === 'a-ecrire').length
  const avecConfiance = famille === 'mcp' || famille === 'api'
  const dateReleve = new Date(ref.verifie).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="page-dc page-catalogue-connecteurs">
      <EntetePage
        onglet="connectors"
        titre="Catalogue des connecteurs"
        sousTitre={`${ref.entrees.length} outils, API et moteurs d’IA que vos agents pourront employer. Relevé vérifié le ${dateReleve}.`}
      />

      <div className="kpis-dc">
        <button className={`kpi-dc ton-vert${branchesSeuls ? ' kpi-actif' : ''}`} onClick={() => setBranchesSeuls((v) => !v)}>
          <span className="kpi-valeur">{branches.length}</span>
          <span className="kpi-libelle">Branchés</span>
          <span className="kpi-contexte">{branches.map((e) => e.nom).join(', ')}</span>
        </button>
        <button className="kpi-dc ton-cyan" onClick={() => { setFamille('mcp'); setConfiance('officiel') }}>
          <span className="kpi-valeur">{officiels}</span>
          <span className="kpi-libelle">Serveurs MCP officiels</span>
          <span className="kpi-contexte">éditeur vérifié ou serveur de référence</span>
        </button>
        <button className="kpi-dc ton-magenta" onClick={() => { setFamille('mcp'); setConfiance('a-auditer') }}>
          <span className="kpi-valeur">{aAuditer}</span>
          <span className="kpi-libelle">À auditer</span>
          <span className="kpi-contexte">fermés tant qu’iAgent ne les a pas relus</span>
        </button>
        <button className="kpi-dc ton-bleu" onClick={() => { setFamille('api'); setConfiance('') }}>
          <span className="kpi-valeur">{aEcrire}</span>
          <span className="kpi-libelle">Connecteurs iAgent à écrire</span>
          <span className="kpi-contexte">API officielle, sans serveur MCP fiable</span>
        </button>
      </div>

      <p className="regle-connecteurs">
        <strong>La règle :</strong> {ref.regle}
      </p>

      <div className="sous-onglets familles-connecteurs" role="tablist">
        {ref.familles.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={f.id === famille}
            className={f.id === famille ? 'actif' : ''}
            onClick={() => {
              setFamille(f.id)
              setConfiance('')
            }}
          >
            {f.titre} <span className="compte">{ref.entrees.filter((e) => e.famille === f.id).length}</span>
          </button>
        ))}
      </div>

      <div className="filtres-dc">
        <label className="champ-recherche">
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher : Notion, factures, vidéo…" />
        </label>
        <select className="choix-dc" value={priorite} onChange={(e) => setPriorite(e.target.value)} aria-label="Priorité">
          <option value="">Toutes priorités</option>
          <option value="P0">P0 : d’abord</option>
          <option value="P1">P1 : ensuite</option>
          <option value="P2">P2 : plus tard</option>
        </select>
        {avecConfiance && (
          <select className="choix-dc" value={confiance} onChange={(e) => setConfiance(e.target.value as Confiance | '')} aria-label="Confiance">
            <option value="">Toutes confiances</option>
            {(Object.keys(ref.confiances) as Confiance[]).map((c) => (
              <option key={c} value={c}>
                {ref.confiances[c].titre}
              </option>
            ))}
          </select>
        )}
        <span className="precision">{visibles.length} affiché{visibles.length > 1 ? 's' : ''}</span>
      </div>

      {confiance && <p className="precision explication-confiance">{ref.confiances[confiance].pourLeClient}</p>}

      {visibles.length === 0 ? (
        <p className="vide">Rien ne correspond à cette recherche dans cette famille.</p>
      ) : (
        <div className="grille-connecteurs">
          {visibles.map((e) => {
            const etat = etatDe(e)
            const [categorie, ...reste] = e.champs
            const utilite = reste.find(([k]) => /Utilit|Usages|Fonction|quoi il sert|capacit/i.test(k)) ?? reste[0]
            const autres = reste.filter((c) => c !== utilite)
            const deplie = ouvert === e.id
            return (
              <article key={e.id} className={`carte-connecteur${etat.ton === 'actif' ? ' fournisseur-branche' : ''}`}>
                <div className="carte-connecteur-tete">
                  <strong>{e.nom}</strong>
                  {e.priorite && <span className={`pastille-priorite p-${e.priorite.toLowerCase()}`}>{e.priorite}</span>}
                </div>
                <span className="precision">{categorie?.[1]}</span>
                <div className="etiquettes">
                  {e.confiance && <span className={`etiquette-dc confiance-${e.confiance}`}>{ref.confiances[e.confiance].titre}</span>}
                  <span className="etiquette-dc">{ACCES[e.acces]}</span>
                </div>
                <p className="utilite">{utilite?.[1]}</p>
                <span className={`statut-ligne statut-${etat.ton === 'actif' ? 'actif' : 'pause'}`}>
                  <span className="point" />
                  <span>{etat.texte}</span>
                </span>
                {e.branche?.par === 'application' && <span className="precision">{e.branche.comment}</span>}
                {deplie && (
                  <dl className="details-connecteur">
                    {autres.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                    {e.statutReleve && (
                      <div>
                        <dt>Statut relevé</dt>
                        <dd>{e.statutReleve}</dd>
                      </div>
                    )}
                    {e.source && (
                      <div>
                        <dt>Documentation</dt>
                        <dd>{hote(e.source)}</dd>
                      </div>
                    )}
                  </dl>
                )}
                <div className="ligne-boutons">
                  <button className="lien-dc" onClick={() => setOuvert(deplie ? null : e.id)}>
                    {deplie ? 'Moins de détails' : 'Détails'}
                  </button>
                  {e.branche?.par === 'serveur' && e.branche.activable && (
                    <button className="bouton-contour petit" onClick={() => aller({ onglet: 'connectors' })}>
                      Voir ce que vos agents en font ›
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
