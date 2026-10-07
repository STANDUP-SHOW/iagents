import { useState } from 'react';
import { NAVIGATION, BUSINESS } from '../contenu.js';

export function EnTete({ chemin }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <header className="entete">
      <div className="entete-ligne enveloppe">
        <a href="/" className="marque" aria-label="iAgent Home — accueil">
          <img src="/logo-iagent.svg" alt="iAgent" width="132" height="36" />
          <span className="marque-home">Home</span>
        </a>
        <button
          type="button"
          className="menu-bouton"
          aria-expanded={ouvert}
          aria-controls="navigation"
          onClick={() => setOuvert((o) => !o)}
        >
          {ouvert ? 'Fermer' : 'Menu'}
        </button>
        <nav id="navigation" className={`navigation${ouvert ? ' ouverte' : ''}`} aria-label="Navigation principale">
          <ul>
            {NAVIGATION.map((l) => (
              <li key={l.chemin}>
                <a href={l.chemin} aria-current={l.chemin === chemin ? 'page' : undefined}>{l.libelle}</a>
              </li>
            ))}
          </ul>
          <a className="lien-business" href={BUSINESS}>iAgent Business<span aria-hidden="true"> ↗</span></a>
        </nav>
      </div>
    </header>
  );
}

export function Pied() {
  return (
    <footer className="pied">
      <div className="enveloppe pied-grille">
        <div>
          <img src="/logo-iagent.svg" alt="iAgent" width="110" height="30" />
          <p className="pied-texte">iAgent Home, l’agent du foyer. Une offre de la marque iAgent.</p>
        </div>
        <nav aria-label="Plan du site">
          <ul className="pied-liens">
            {NAVIGATION.map((l) => <li key={l.chemin}><a href={l.chemin}>{l.libelle}</a></li>)}
          </ul>
        </nav>
        <p className="pied-business">
          Pour une entreprise : <a href={BUSINESS}>iAgent Business</a>
        </p>
      </div>
    </footer>
  );
}

export function Page({ chemin, children }) {
  return (
    <>
      <a className="evitement" href="#contenu">Aller au contenu</a>
      <EnTete chemin={chemin} />
      <main id="contenu" tabIndex={-1}>{children}</main>
      <Pied />
    </>
  );
}

export function Bandeau({ surtitre, titre, children }) {
  return (
    <section className="bandeau">
      <div className="enveloppe etroite">
        {surtitre && <p className="surtitre">{surtitre}</p>}
        <h1>{titre}</h1>
        {children}
      </div>
    </section>
  );
}
