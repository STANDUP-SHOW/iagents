import type { ReactNode } from 'react'
import type { EtatPlateforme, Lecture } from '../../agents/plateforme'
import type { Onglet } from '../Dashboard'

/**
 * Pieces shared by the Desktop Commander modules (MASTER §14).
 *
 * The rule they carry: every figure comes from a command. When the platform is
 * not linked, or a route answers nothing, the screen says WHAT is missing —
 * never a sample number dressed as a real one.
 */

export type Ouvrir = (onglet: Onglet) => void

/** « Poste non relié » and the list of what is missing, with the way to fix it. */
export function NonRelie({ etat, onOuvrir, quoi }: { etat: EtatPlateforme | null; onOuvrir?: Ouvrir; quoi: string }) {
  return (
    <div className="non-relie" role="status">
      <strong>Poste non relié à la plateforme iAgent.</strong>
      <p>
        {quoi} vient de la plateforme : rien n'est affiché à la place, pas même un exemple.
        {etat && etat.manque.length > 0 && <> Il manque : {etat.manque.join(', ')}.</>}
      </p>
      {onOuvrir && (
        <button className="commander-action" onClick={() => onOuvrir('box')}>
          Relier cette Box
        </button>
      )}
    </div>
  )
}

/** A titled block of a module. */
export function Rubrique({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rubrique">
      <div className="rubrique-entete">
        <h3>{titre}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A part of the module that nothing feeds yet, said as such. */
export function SansSource({ children }: { children: ReactNode }) {
  return <p className="sans-source">{children}</p>
}

/** What a read gives: waiting, the French reason it failed, or its content. */
export function Lu<T>({
  lecture,
  vide,
  children,
}: {
  lecture: Lecture<T>
  vide?: string
  children: (d: T) => ReactNode
}) {
  if (lecture.erreur) return <p className="lecture-refus">{lecture.erreur}</p>
  if (lecture.donnee == null) return <p className="vide">{lecture.charge ? 'Lecture…' : vide ?? 'Rien de lu.'}</p>
  return <>{children(lecture.donnee)}</>
}

const libelle = (cle: string) => cle.replace(/_/g, ' ')

/** An estimate as the create module writes it: never a bare number. */
export type UneEstimation = { nature: 'estimation'; min: number; max: number; unite: string; hypotheses?: string[] }

export const estEstimation = (v: unknown): v is UneEstimation =>
  !!v && typeof v === 'object' && (v as { nature?: unknown }).nature === 'estimation'

const nombre = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

export function Estimation({ e }: { e: UneEstimation }) {
  return (
    <span className="estimation">
      entre {nombre(e.min)} et {nombre(e.max)} {e.unite} <em>(estimation)</em>
      {e.hypotheses && e.hypotheses.length > 0 && (
        <span className="estimation-hypotheses"> — hypothèses : {e.hypotheses.join(' ; ')}</span>
      )}
    </span>
  )
}

function valeur(v: unknown): ReactNode {
  if (v == null || v === '') return '—'
  if (estEstimation(v)) return <Estimation e={v} />
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  if (typeof v === 'number') return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d.toLocaleString('fr-FR')
    }
    return v
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return 'aucun'
    if (v.every((x) => typeof x !== 'object' || x === null)) return v.map(String).join(', ')
    return <Donnees valeur={v} />
  }
  return <Donnees valeur={v} />
}

/**
 * Whatever the platform returned, laid out as it is. The other modules write
 * their servers in parallel: the screen does not guess a shape it was not
 * given, it shows the fields the answer actually carries, under their names.
 */
export function Donnees({ valeur: v }: { valeur: unknown }) {
  if (Array.isArray(v)) {
    if (v.length === 0) return <p className="vide">Aucun élément.</p>
    return (
      <div className="donnees-liste">
        {v.map((x, i) => (
          <div key={i} className="donnees-carte">
            <Donnees valeur={x} />
          </div>
        ))}
      </div>
    )
  }
  if (v && typeof v === 'object') {
    const champs = Object.entries(v as Record<string, unknown>)
    if (champs.length === 0) return <p className="vide">Réponse vide.</p>
    return (
      <dl className="donnees">
        {champs.map(([k, x]) => (
          <div key={k} className="donnees-ligne">
            <dt>{libelle(k)}</dt>
            <dd>{valeur(x)}</dd>
          </div>
        ))}
      </dl>
    )
  }
  return <span>{valeur(v)}</span>
}
