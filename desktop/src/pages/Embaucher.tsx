import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import plans from '../../../plateforme/tarifs/plans.json'
import Embauche from '../components/Embauche'
import type { Fiche } from '../agents/fiche'
import { EntetePage, Onde } from '../shell/Shell'
import { publier } from '../shell/evenements'
import type { Cible } from '../shell/intentions'
import { activitesNommees, placeDansActivite, sansAccents, type Activite } from '../agents/activites'
import { portraitDeFiche } from '../shell/portraits'
import Tiroir from '../shell/Tiroir'

/**
 * Embaucher (brief §7): search, the ready-made team, the catalogue of métiers
 * and the hiring interview. « Ne programmez pas votre agent. Rencontrez-le. »
 *
 * Prices are read from the tarifs engine (plateforme/tarifs/plans.json), never
 * written here: an agent is Essential, Professional or Expert, at 149, 249 or
 * 399 € HT a month, and the level is settled at the interview. The catalogue
 * counts métiers (max, 05/10): « 1 250 métiers », not « 1 250 agents ».
 * No rating, review or availability badge is shown: none is measured yet.
 */

type EntreeCatalogue = { id: string; metier: string; secteur: string; slug: string }
type Secteur = { id: string; nom: string; agents: number }
type Plan = { plan_id: string; base_price: number | null; base_price_max: number | null; tax_mode: string; effective_to: string | null }

const PAR_PAGE = 20

const prix = (id: string) => (plans.plans as Plan[]).find((p) => p.plan_id === id && p.effective_to == null)
const euros = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('fr-FR')} €`)

export const PRIX_AGENT = {
  essential: prix('agent-essential'),
  professional: prix('agent-professional'),
  expert: prix('agent-expert'),
}

export default function Embaucher({
  cible,
  aller,
  apresEmbauche,
}: {
  cible?: Cible
  aller: (c: Cible) => void
  apresEmbauche: (prenom: string) => void
}) {
  const [catalogue, setCatalogue] = useState<EntreeCatalogue[]>([])
  const [secteurs, setSecteurs] = useState<Secteur[]>([])
  const [motif, setMotif] = useState<string | null>(null)
  const [recherche, setRecherche] = useState(cible?.recherche ?? '')
  const [secteur, setSecteur] = useState('')
  const [tri, setTri] = useState<'pertinence' | 'metier' | 'secteur'>('pertinence')
  const [pages, setPages] = useState(1)
  const [recrue, setRecrue] = useState<string | undefined>(cible?.ficheId)
  const [profil, setProfil] = useState<Fiche | null>(null)
  const [profilMotif, setProfilMotif] = useState<string | null>(null)
  const [activites, setActivites] = useState<Activite[]>([])
  const entretien = useRef<HTMLElement>(null)

  // On a touch screen the interview may sit out of sight: bring it to the finger.
  useEffect(() => {
    if (recrue) entretien.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [recrue])

  useEffect(() => {
    invoke<string>('lire_referentiel', { nom: 'catalogue' })
      .then((brut) => {
        const c = JSON.parse(brut)
        setCatalogue(c.agents ?? [])
        setSecteurs(c.secteurs ?? [])
      })
      .catch((e) => setMotif(String(e)))
    invoke<string>('lire_referentiel', { nom: 'activites' })
      .then((brut) => setActivites(JSON.parse(brut).activites ?? []))
      .catch(() => setActivites([]))
  }, [])

  useEffect(() => {
    if (cible?.ficheId) setRecrue(cible.ficheId)
    if (cible?.recherche !== undefined) setRecherche(cible.recherche ?? '')
  }, [cible])

  useEffect(() => setPages(1), [recherche, secteur, tri])

  const nomSecteur = (id: string) => secteurs.find((s) => s.id === id)?.nom ?? id.replace(/-/g, ' ')

  // The client's own branch: « imprimerie » names an activity, not a métier.
  const activite = useMemo(() => activitesNommees(recherche, activites)[0] ?? null, [recherche, activites])

  const retenus = useMemo(() => {
    const t = sansAccents(recherche)
    const parMetier = (c: EntreeCatalogue) => sansAccents(`${c.metier} ${nomSecteur(c.secteur)}`).includes(t)
    let l = catalogue.filter((c) => !secteur || c.secteur === secteur)
    if (t) {
      // A métier named in the search comes first; then, when the search names
      // an activity, every métier that works there, its own branch first.
      const directs = l.filter(parMetier)
      const parActivite = activite
        ? l
            .filter((c) => !directs.includes(c) && placeDansActivite(c, activite) != null)
            .sort((a, b) => (placeDansActivite(a, activite) ?? 2) - (placeDansActivite(b, activite) ?? 2))
        : []
      l = [...directs, ...parActivite]
    }
    if (tri === 'metier') l = [...l].sort((a, b) => a.metier.localeCompare(b.metier, 'fr'))
    if (tri === 'secteur') l = [...l].sort((a, b) => a.secteur.localeCompare(b.secteur, 'fr'))
    if (tri === 'pertinence' && t) l = [...l].sort((a, b) => Number(!sansAccents(a.metier).startsWith(t)) - Number(!sansAccents(b.metier).startsWith(t)))
    return l
  }, [catalogue, recherche, secteur, tri, activite, secteurs])

  const voirProfil = async (id: string) => {
    setProfil(null)
    setProfilMotif(null)
    try {
      setProfil(JSON.parse(await invoke<string>('lire_fiche', { id })))
    } catch (e) {
      setProfilMotif(String(e))
    }
  }

  const team = prix('pack-team')
  const essentiel = PRIX_AGENT.essential

  return (
    <div className="page-dc page-embaucher">
      <div className="embaucher-principal">
        <EntetePage
          onglet="embauche"
          titre="Embaucher des agents"
          sousTitre="Trouvez le bon métier, constituez votre équipe et faites grandir votre entreprise."
        />

        <label className="recherche-geante">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Un métier ou votre activité…" />
          {recherche ? (
            <button className="effacer-recherche" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              ×
            </button>
          ) : (
            <span className="precision">Ex. : comptable, imprimerie, boulangerie, facturation</span>
          )}
        </label>

        <div className="filtres-dc">
          <label className="filtre-bloc">
            <span>Secteur</span>
            <select className="choix-dc" value={secteur} onChange={(e) => setSecteur(e.target.value)}>
              <option value="">Tous les secteurs</option>
              {secteurs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="filtre-bloc">
            <span>Niveau</span>
            <select className="choix-dc" disabled title="Le niveau se fixe à l’entretien d’embauche">
              <option>Essential · Professional · Expert</option>
            </select>
          </label>
          <label className="filtre-bloc">
            <span>Mode d’exécution</span>
            <select className="choix-dc" disabled title="Chaque métier tourne en local, en API ou en hybride : vous choisissez à l’entretien">
              <option>Local · API · Hybride</option>
            </select>
          </label>
        </div>

        {!recherche.trim() && (
        <section className="equipe-ideale">
          <div className="ei-gauche">
            <span className="badge-magenta">Pack Team</span>
            <h2>Votre équipe idéale</h2>
            <p>Trois agents complémentaires, la Box et le Task Commander qui les tient. Décrivez votre activité, la composition se fait pour vous.</p>
            <div className="ei-roles">
              {['Commercial', 'Administratif', 'Support', 'Marketing', 'Opérations'].map((r) => (
                <span key={r} className="ei-role">
                  {r}
                </span>
              ))}
            </div>
          </div>
          <ul className="ei-points">
            <li>3 agents, la Box et le Task Commander</li>
            <li>L’équipe se compose depuis votre besoin, à l’oral ou par écrit</li>
            <li>Chaque agent reste modifiable à tout moment</li>
            <li>Consommation d’IA facturée à part, au réel</li>
          </ul>
          <div className="ei-prix">
            <span className="precision">À partir de</span>
            <strong>
              {euros(team?.base_price)}
              {team?.base_price_max ? ` à ${euros(team.base_price_max)}` : ''}
            </strong>
            <span className="precision">HT / mois</span>
            <button className="bouton-charte" onClick={() => aller({ onglet: 'create' })}>
              Composer cette équipe
            </button>
          </div>
        </section>
        )}

        <div className="catalogue-entete">
          <div>
            <h2 className="titre-section">Catalogue des métiers</h2>
            <p className="precision">
              {catalogue.length ? `${catalogue.length.toLocaleString('fr-FR')} métiers prêts à rejoindre votre entreprise` : 'Lecture du catalogue…'}
              {retenus.length !== catalogue.length && ` · ${retenus.length.toLocaleString('fr-FR')} affichés`}
            </p>
          </div>
          <label className="filtre-bloc en-ligne">
            <span>Trier par</span>
            <select className="choix-dc" value={tri} onChange={(e) => setTri(e.target.value as typeof tri)}>
              <option value="pertinence">Pertinence</option>
              <option value="metier">Métier</option>
              <option value="secteur">Secteur</option>
            </select>
          </label>
        </div>

        {motif && <p className="lecture-refus">{motif}</p>}

        {activite && (
          <div className="activite-reconnue" role="status">
            <strong>{activite.nom}</strong>
            <span>
              Ces métiers travaillent pour votre activité. Celui que vous embauchez reçoit le pack {activite.nom.toLowerCase()} : son vocabulaire, ses
              documents, ses règles et ses logiciels.
            </span>
          </div>
        )}
        {recherche.trim() && retenus.length === 0 && catalogue.length > 0 && (
          <div className="vide-dc">
            <p>Aucun métier ni aucune activité ne répond à « {recherche.trim()} ».</p>
            <div className="ligne-boutons">
              <button className="bouton-contour" onClick={() => setRecherche('')}>
                Voir tout le catalogue
              </button>
              <button className="bouton-cyan" onClick={() => aller({ onglet: 'create' })}>
                Le décrire à iAgent Create
              </button>
            </div>
          </div>
        )}

        <div className="grille-catalogue">
          {retenus.slice(0, pages * PAR_PAGE).map((c) => (
            <article key={c.id} className={`carte-metier${recrue === c.id ? ' carte-choisie' : ''}`}>
              <button className="metier-visuel" onClick={() => voirProfil(c.id)} aria-label={`Voir le profil : ${c.metier}`}>
                <img src={portraitDeFiche(c.id)} alt="" loading="lazy" />
              </button>
              <div className="metier-corps">
                <strong className="metier-nom">{c.metier}</strong>
                <span className="precision">{nomSecteur(c.secteur)}</span>
                <span className="metier-prix">
                  dès <strong>{euros(essentiel?.base_price)}</strong> HT / mois
                </span>
              </div>
              <div className="metier-actions">
                <button className="lien-dc" onClick={() => voirProfil(c.id)}>
                  Voir le profil ›
                </button>
                <button className="bouton-plus" onClick={() => setRecrue(c.id)} title={`Recruter : ${c.metier}`}>
                  +
                </button>
              </div>
            </article>
          ))}
        </div>
        {retenus.length > pages * PAR_PAGE && (
          <button className="bouton-contour voir-plus" onClick={() => setPages((p) => p + 1)}>
            Voir {Math.min(PAR_PAGE, retenus.length - pages * PAR_PAGE)} métiers de plus
          </button>
        )}
      </div>

      <aside className="embaucher-cote">
        <section className="carte-verre entretien-carte" ref={entretien}>
          <h3 className="carte-titre">
            Entretien d’embauche
          </h3>
          {!recrue ? (
            <>
              <div className="entretien-accroche">
                <Onde vivante barres={11} />
                <p>« Ne programmez pas votre agent. Rencontrez-le. »</p>
              </div>
              <ul className="coches">
                <li>Choisissez un métier dans le catalogue</li>
                <li>Donnez-lui un prénom, une voix, un visage</li>
                <li>Il vous pose ses questions, avec une proposition tirée de son métier</li>
                <li>Vous confirmez ou corrigez : il se configure seul</li>
                <li>L’entretien se relance plus tard pour le faire évoluer</li>
              </ul>
            </>
          ) : (
            <Embauche
              compact
              ficheInitiale={recrue}
              activiteInitiale={activite?.nom}
              onVoir={(p) => aller({ onglet: 'agents', agent: p })}
              apresEmbauche={(p) => {
                publier({ type: 'embauche', agent: p, texte: `${p} a rejoint votre équipe`, gravite: 'succes' })
                apresEmbauche(p)
              }}
            />
          )}
        </section>

        <section className="carte-verre">
          <h3 className="carte-titre">Besoin d’un agent spécifique ?</h3>
          <p className="precision">Décrivez votre besoin : iAgent Create compose l’agent ou l’équipe sur mesure, avec son coût estimé.</p>
          <button className="bouton-contour" onClick={() => aller({ onglet: 'create' })}>
            Créer un agent sur mesure
          </button>
        </section>

        <section className="carte-verre">
          <h3 className="carte-titre">Les niveaux d’un agent</h3>
          <ul className="niveaux">
            <li>
              <strong>Essential</strong>
              <span>{euros(PRIX_AGENT.essential?.base_price)} HT/mois</span>
            </li>
            <li>
              <strong>Professional</strong>
              <span>{euros(PRIX_AGENT.professional?.base_price)} HT/mois</span>
            </li>
            <li>
              <strong>Expert</strong>
              <span>{euros(PRIX_AGENT.expert?.base_price)} HT/mois</span>
            </li>
          </ul>
          <p className="precision">La Box et la consommation d’IA sont facturées à part.</p>
        </section>
      </aside>

      {(profil || profilMotif) && (
        <Tiroir titre="Profil du métier" onFermer={() => (setProfil(null), setProfilMotif(null))}>
            <div className="tiroir-entete">
              <h2>{profil?.nom ?? 'Profil'}</h2>
              <button className="bouton-rond" onClick={() => (setProfil(null), setProfilMotif(null))} title="Fermer">
                ×
              </button>
            </div>
            {profilMotif && <p className="lecture-refus">{profilMotif}</p>}
            {profil && (
              <>
                <img className="tiroir-portrait" src={portraitDeFiche(profil.id)} alt="" />
                <p className="precision">
                  {nomSecteur(profil.secteur)}
                  {activite && placeDansActivite({ metier: profil.nom, secteur: profil.secteur }, activite) != null ? ` · avec le pack ${activite.nom}` : ''}
                </p>
                <p>{profil.description}</p>
                <h4>Son travail ({profil.taches.length} tâches)</h4>
                <ul className="liste-simple">
                  {profil.taches.slice(0, 10).map((t) => (
                    <li key={t.id}>
                      <strong>{t.nom}</strong> · {t.description}
                    </li>
                  ))}
                </ul>
                <h4>Ce qu’il emploie</h4>
                <div className="etiquettes">
                  {profil.connecteurs.map((c) => (
                    <span key={c} className="etiquette-dc">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="tiroir-actions">
                  <button
                    className="bouton-charte"
                    onClick={() => {
                      setRecrue(profil.id)
                      setProfil(null)
                    }}
                  >
                    Recruter
                  </button>
                </div>
              </>
            )}
        </Tiroir>
      )}
    </div>
  )
}
