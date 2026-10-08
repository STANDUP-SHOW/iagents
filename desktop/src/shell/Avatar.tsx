/**
 * An agent's portrait. max's official portraits are not delivered yet, so an
 * agent without a displayable photo gets its initial on the brand gradient:
 * never a stock face that would pass for the agent.
 *
 * A photo is shown only when it is an address the window can load (http(s) or
 * data:). A bare path on the disk would need the asset protocol, which this
 * application does not open.
 */
export default function Avatar({
  prenom,
  photo,
  taille = 'm',
  statut,
}: {
  prenom: string
  photo?: string
  taille?: 's' | 'm' | 'l' | 'xl'
  statut?: 'actif' | 'pause' | 'tache' | 'hors-ligne'
}) {
  const affichable = !!photo && /^(https?:|data:)/.test(photo)
  return (
    <span className={`avatar avatar-${taille}`} aria-hidden="true">
      {affichable ? (
        <img src={photo} alt="" />
      ) : (
        <span className="avatar-initiale">{(prenom.trim()[0] ?? '?').toUpperCase()}</span>
      )}
      {statut && <span className={`avatar-statut statut-${statut}`} />}
    </span>
  )
}
