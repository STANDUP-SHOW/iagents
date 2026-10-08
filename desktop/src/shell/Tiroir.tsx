import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * A side drawer drawn above the whole frame. Rendered inside the page it sat
 * under the right panel, whose glass makes its own layer: the clock and the
 * activity feed showed through the drawer.
 */
export default function Tiroir({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  const hote = document.querySelector('.dc') ?? document.body
  return createPortal(
    <div className="tiroir-voile" onClick={onFermer}>
      <aside className="tiroir" role="dialog" aria-label={titre} onClick={(e) => e.stopPropagation()}>
        {children}
      </aside>
    </div>,
    hote
  )
}
