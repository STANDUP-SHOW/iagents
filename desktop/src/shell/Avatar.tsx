/**
 * An agent's portrait, from max's bank (see portraits.ts); the initial on the
 * brand gradient only when no portrait applies.
 *
 * A photo is shown only when it is an address the window can load (http(s),
 * data: or a portrait shipped with the application). A bare path on the disk
 * would need the asset protocol, which this application does not open.
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
  const affichable = !!photo && /^(https?:|data:|\/portraits\/)/.test(photo)
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
