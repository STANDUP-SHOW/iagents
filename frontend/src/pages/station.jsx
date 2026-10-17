// The iAgent Station, shown with max's own advertising visual (17/10/2026).
// Every picture is a crop of that visual at its native size, never enlarged:
// the visual is 1448 px wide, and stretched it looked pixelated.

/** The only place on the site allowed to announce something for later (max,
 *  17/10: « Coming soon. iAgent Station »). The site banc refuses this wording
 *  anywhere else. */
export const COMING_SOON = 'Coming soon';

export const PUBLICITE = { src: '/pages/station-publicite.webp', largeur: 1448, hauteur: 1086,
  alt: 'La Station iAgent, votre centre de commande IA : trois finitions Pearl White, Deep Navy et Brushed Aluminum, écran tactile 27 pouces QHD, micros, haut-parleurs, anneau lumineux et architecture modulaire.' };

const DETAILS = [
  ['station-micros', 452, 'Elle vous entend.', 'Quatre à six micros en couronne, un bouton qui les coupe, l’anneau lumineux qui dit ce qu’elle fait.'],
  ['station-connexions', 321, 'Tout se branche derrière.', 'Ethernet 2,5 Gb/s, Wi-Fi 6E, USB-A, USB-C, HDMI : les câbles passent dans le bras.'],
  ['station-trappe', 248, 'Elle s’ouvre par dessous.', 'Mémoire et SSD derrière une trappe de service : 16, 32 ou 64 Go, 1 ou 2 To.'],
  ['station-architecture', 420, 'Modulaire, de l’écran au châssis.', 'Écran, bras, micros, calcul et son sont des modules qui se changent un à un.'],
];

const Image = ({ src, largeur, hauteur, alt, charger = 'lazy', className = '' }) => (
  <img className={`st-image ${className}`} src={src} alt={alt} width={largeur} height={hauteur} loading={charger} decoding="async" style={{ maxWidth: `${largeur}px` }} />
);

/** Apple-style presentation of the Station for the Box page: big type, then
 *  the visual band by band (the whole visual is on the home page). */
export function StationApple() {
  return (
    <section className="st-apple" aria-labelledby="titre-station">
      <div className="st-tete">
        <p className="st-annonce">{COMING_SOON}</p>
        <h2 id="titre-station" className="st-titre">iAgent Station.</h2>
        <p className="st-chapeau">Votre centre de commande IA, à la maison comme en entreprise.</p>
      </div>
      <figure className="st-figure">
        <Image src="/accueil/box-commander.webp" largeur={1176} hauteur={600} alt="La Station iAgent en trois finitions : Pearl White, Deep Navy et Brushed Aluminum, écran tactile 27 pouces QHD sur bras articulé." />
      </figure>
      <div className="st-tete st-tete-petite">
        <h3 className="st-titre st-titre-moyen">Tout est dedans.</h3>
      </div>
      <figure className="st-figure">
        <Image src="/pages/station-experience.webp" largeur={1448} hauteur={134} alt="Ryzen 7, 32 ou 64 Go, SSD NVMe ; 4 à 6 micros far-field ; audio 2 × 5 W ; écran tactile 27 pouces QHD ; connectivité complète ; anneau lumineux à quatre statuts." />
      </figure>
      <ul className="st-details">
        {DETAILS.map(([src, largeur, titre, texte]) => (
          <li key={src}>
            <Image src={`/pages/${src}.webp`} largeur={largeur} hauteur={348} alt={`${titre} ${texte}`} />
            <h3>{titre}</h3>
            <p>{texte}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
