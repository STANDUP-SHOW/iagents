import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { Onglet } from '../components/Dashboard'
import type { AgentInstalle } from '../agents/fiche'
import { MODULES, SOUS_PAGES } from './modules'
import { comprendre, type Cible } from './intentions'
import { activitesNommees, type Activite } from '../agents/activites'

/**
 * The universal command (brief §16): Ctrl+K, or a tap on the search bar.
 * One field searches modules, agents, their tasks, the client's activity
 * (« imprimerie ») and the 1 250 métiers of the
 * catalogue, and understands a few plain intents (« tâches bloquées »,
 * « ouvre le courrier », « embaucher un comptable »). The same intent reader
 * is what a spoken command will go through, so both paths stay identical.
 */

interface Resultat {
  groupe: string
  titre: string
  detail?: string
  cible: Cible
}

type Metier = { id: string; metier: string; secteur: string }

const sansAccents = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function Palette({
  ouvert,
  onFermer,
  installes,
  aller,
  admin,
}: {
  ouvert: boolean
  onFermer: () => void
  installes: readonly AgentInstalle[]
  aller: (c: Cible) => void
  admin: boolean
}) {
  const [q, setQ] = useState('')
  const [choix, setChoix] = useState(0)
  const [metiers, setMetiers] = useState<Metier[] | null>(null)
  const [activites, setActivites] = useState<Activite[]>([])
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ouvert) return
    setQ('')
    setChoix(0)
    setTimeout(() => champ.current?.focus(), 0)
    if (metiers == null) {
      invoke<string>('lire_referentiel', { nom: 'catalogue' })
        .then((brut) => {
          const c = JSON.parse(brut) as { agents?: Metier[]; secteurs?: { id: string; nom: string }[] }
          const noms = new Map((c.secteurs ?? []).map((s) => [s.id, s.nom]))
          setMetiers((c.agents ?? []).map((m) => ({ ...m, secteur: noms.get(m.secteur) ?? m.secteur.replace(/-/g, ' ') })))
        })
        .catch(() => setMetiers([]))
      invoke<string>('lire_referentiel', { nom: 'activites' })
        .then((brut) => setActivites(JSON.parse(brut).activites ?? []))
        .catch(() => setActivites([]))
    }
  }, [ouvert])

  const resultats = useMemo<Resultat[]>(() => {
    const t = sansAccents(q.trim())
    const out: Resultat[] = []
    const intention = comprendre(q, installes)
    if (intention) out.push({ groupe: 'Action', titre: intention.libelle, cible: intention.cible })

    const pages: { id: Onglet; titre: string }[] = [
      ...MODULES.map((m) => ({ id: m.id as Onglet, titre: m.titre })),
      ...Object.values(SOUS_PAGES).flatMap((l) => (l ?? []).slice(1)),
      ...(admin ? [{ id: 'admin' as Onglet, titre: 'Administration iAgent' }] : []),
    ]
    for (const p of pages) {
      if (!t || sansAccents(p.titre).includes(t)) out.push({ groupe: 'Modules', titre: p.titre, cible: { onglet: p.id } })
    }
    if (t) {
      for (const a of installes) {
        if (sansAccents(`${a.prenom} ${a.fiche.nom}`).includes(t)) {
          out.push({ groupe: 'Agents', titre: a.prenom, detail: a.fiche.nom, cible: { onglet: 'agents', agent: a.prenom } })
        }
        for (const tache of a.planning) {
          if (tache.active && sansAccents(tache.nom).includes(t)) {
            out.push({ groupe: 'Tâches', titre: tache.nom, detail: a.prenom, cible: { onglet: 'travail', agent: a.prenom, recherche: tache.nom } })
          }
        }
      }
      activitesNommees(q, activites)
        .slice(0, 4)
        .forEach((a) =>
          out.push({
            groupe: 'Votre activité',
            titre: a.nom,
            detail: 'les métiers qui la servent',
            cible: { onglet: 'embauche', recherche: a.nom },
          })
        )
      if (t.length >= 3 && metiers) {
        metiers
          .filter((m) => sansAccents(`${m.metier} ${m.secteur}`).includes(t))
          .slice(0, 8)
          .forEach((m) =>
            out.push({
              groupe: 'Métiers à embaucher',
              titre: m.metier,
              detail: m.secteur,
              cible: { onglet: 'embauche', ficheId: m.id },
            })
          )
      }
    }
    return out.slice(0, 40)
  }, [q, installes, metiers, activites, admin])

  useEffect(() => setChoix(0), [q])

  if (!ouvert) return null

  const valider = (r: Resultat | undefined) => {
    if (!r) return
    aller(r.cible)
    onFermer()
  }

  let groupe = ''
  return (
    <div className="palette-voile" onMouseDown={onFermer}>
      <div className="palette" role="dialog" aria-label="Commande universelle" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-champ">
          <svg className="icone" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            ref={champ}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Un agent, une tâche, un métier, ou « tâches bloquées »…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onFermer()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setChoix((c) => Math.min(c + 1, resultats.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setChoix((c) => Math.max(c - 1, 0))
              }
              if (e.key === 'Enter') valider(resultats[choix])
            }}
          />
          <kbd>Échap</kbd>
        </div>
        <ul className="palette-resultats" role="listbox">
          {resultats.length === 0 && <li className="vide">Rien ne correspond. Essayez un prénom, une tâche ou un métier.</li>}
          {resultats.map((r, i) => {
            const entete = r.groupe !== groupe
            groupe = r.groupe
            return (
              <li key={`${r.groupe}-${r.titre}-${i}`}>
                {entete && <span className="palette-groupe">{r.groupe}</span>}
                <button
                  role="option"
                  aria-selected={i === choix}
                  className={i === choix ? 'choisi' : ''}
                  onMouseEnter={() => setChoix(i)}
                  onClick={() => valider(r)}
                >
                  <span>{r.titre}</span>
                  {r.detail && <span className="palette-detail">{r.detail}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
