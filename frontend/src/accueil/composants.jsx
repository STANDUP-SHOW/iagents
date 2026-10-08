// Shared pieces of the home page, written to be reused by the catalogue,
// « Créez votre entreprise », the Box page and the agent profiles when they
// adopt the same charter.
import { useEffect, useRef, useState } from 'react';
import { suivre } from './analytique.js';

// Where every « recruit » button leads: the page that explains recruiting,
// from the need to the interview. The site never offers the installer:
// Desktop Commander comes preinstalled on the Box we provide (max, 08/10).
export const RECRUTER = '/how-it-works';

export const LIENS = {
  catalogue: '/catalogue',
  entreprise: '/catalogue?page=entreprise',
  box: '/box',
  idee: (texte) => `/catalogue?page=entreprise&idee=${encodeURIComponent(texte)}`,
};

/** « 9,90 € » the French way. */
export const euros = (x) =>
  `${x.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 })} €`;

/** « 1 249 » with a non-breaking thin space, as French writes it. */
export const nombre = (x) => x.toLocaleString('fr-FR').replace(/ /g, ' ');

/**
 * The iAgent logo, cut from max's charte e-agent (07/10): the brain in the
 * charte gradient and the wordmark in white, for the site's dark ground. The
 * monochrome version is the same mark all in white.
 */
export function Logo({ variante = 'principal', className = 'h-7 w-auto' }) {
  const [src, largeur, hauteur] = variante === 'blanc'
    ? ['/accueil/logo-iagent-blanc.svg', 3256, 928]
    : ['/accueil/logo-iagent.svg', 4177, 1153];
  return <img src={src} alt="iAgent" width={largeur} height={hauteur} className={className} decoding="async" />;
}

export function Surtitre({ children, className = '' }) {
  return <p className={`surtitre ${className}`}>{children}</p>;
}

export function Fleche() {
  return (
    <svg className="fleche" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Bouton({ href, children, variante = 'plein', evenement, className = '', ...reste }) {
  return (
    <a href={href} className={`bouton bouton-${variante} ${className}`} onClick={() => evenement && suivre(evenement)} {...reste}>
      {children}
      {variante !== 'contour' && <Fleche />}
    </a>
  );
}

export function Avatar({ personne, taille = 44, className = '' }) {
  return (
    <span className={`avatar ${className}`} style={{ width: taille, height: taille }}>
      <img src={`/accueil/${personne.portrait}.webp`} alt="" width="256" height="256" loading="lazy" decoding="async" />
    </span>
  );
}

/**
 * An agent as a professional profile, not a product: portrait, first name,
 * the catalogue job it stands for, its sector and the software it already
 * knows. The link opens the fiche's own page.
 */
export function AgentCard({ personne, compact = false, actif = false, className = '' }) {
  return (
    <article className={`verre carte-agent ${actif ? 'verre-actif' : ''} ${className}`}>
      <div className={`portrait ${compact ? 'aspect-[4/4]' : 'aspect-[4/4.4]'}`}>
        <img src={`/accueil/${personne.portrait}.webp`} alt={`Portrait de ${personne.prenom}, ${personne.titre ?? personne.metier}`} width="256" height="256" loading="lazy" decoding="async" />
      </div>
      <div>
        <h3 className="font-[Montserrat] font-semibold text-[1.02rem] leading-tight text-white">{personne.prenom}</h3>
        <p className="text-[0.82rem] text-[var(--cyan)] leading-snug">{personne.titre ?? personne.metier}</p>
        {!compact && <p className="text-[0.75rem] text-[var(--texte-pale)] mt-0.5">Fiche {personne.id} · {personne.metier}</p>}
      </div>
      {!compact && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Logiciels maîtrisés">
          {personne.logiciels.slice(0, 3).map((l) => <li key={l} className="puce !text-[0.72rem] !py-1">{l}</li>)}
        </ul>
      )}
      {!compact && personne.url && (
        <a href={personne.url} className="bouton-lien inline-flex items-center gap-2 text-sm font-semibold mt-auto" onClick={() => suivre('catalog_click', { fiche: personne.id })}>
          Voir le profil <Fleche />
        </a>
      )}
    </article>
  );
}

/**
 * The conversational field. When empty and not focused it writes its examples
 * slowly, one after the other; sending opens « Créez votre entreprise » with
 * the idea already typed in. The idea goes nowhere else.
 */
export function IntentInput({ exemples, cta = 'Commencer', id, evenement = 'idea_submit', grand = false }) {
  const [valeur, setValeur] = useState('');
  const [focus, setFocus] = useState(false);
  const [montre, setMontre] = useState(exemples[0]);
  const actif = useRef(true);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    actif.current = true;
    let i = 0;
    let c = exemples[0].length;
    let sens = -1;
    let attente = 70;
    const pas = () => {
      if (!actif.current) return;
      const phrase = exemples[i];
      if (attente > 0) { attente--; }
      else if (sens < 0) {
        c -= 2;
        if (c <= 0) { c = 0; sens = 1; i = (i + 1) % exemples.length; }
      } else {
        c += 1;
        if (c >= exemples[i].length) { c = exemples[i].length; sens = -1; attente = 90; }
      }
      setMontre((sens > 0 ? exemples[i] : phrase).slice(0, c) || '​');
    };
    const t = setInterval(pas, 38);
    return () => { actif.current = false; clearInterval(t); };
  }, [exemples]);

  const envoyer = (e) => {
    e.preventDefault();
    const texte = valeur.trim() || exemples[0];
    suivre(evenement, { longueur: texte.length });
    window.location.href = `/catalogue?page=entreprise&idee=${encodeURIComponent(texte)}`;
  };

  return (
    <form className={`intention ${grand ? 'md:!py-3' : ''}`} onSubmit={envoyer} role="search" aria-label="Décrire ce que vous voulez accomplir">
      <svg className="intention-etoile" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill="currentColor" />
      </svg>
      <label htmlFor={id} className="sr-only">Que voulez-vous accomplir ?</label>
      <input
        id={id}
        type="text"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        onFocus={() => { setFocus(true); suivre('idea_input_focus'); }}
        onBlur={() => setFocus(false)}
        placeholder={focus ? exemples[0] : montre}
        autoComplete="off"
      />
      <button type="submit" className="bouton bouton-plein !min-h-[44px] !px-4 md:!px-5" aria-label={cta}>
        <span className="hidden sm:inline">{cta}</span>
        <span className="sm:hidden sr-only">{cta}</span>
        <Fleche />
      </button>
    </form>
  );
}

/** A very discreet bar showing where the reader is in the film. */
export function ScrollProgress() {
  const barre = useRef(null);
  useEffect(() => {
    let attente = false;
    const maj = () => {
      attente = false;
      const h = document.documentElement;
      const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
      if (barre.current) barre.current.style.transform = `scaleX(${p})`;
    };
    const surDefilement = () => { if (!attente) { attente = true; requestAnimationFrame(maj); } };
    window.addEventListener('scroll', surDefilement, { passive: true });
    maj();
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);
  return <div ref={barre} className="progression" aria-hidden="true" />;
}

/** A scene title made of lines, each line its own block so motion can take them one by one. */
export function Lignes({ lignes, as: Balise = 'h2', className = '' }) {
  return (
    <Balise className={className}>
      {lignes.map((l, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <span className="ligne block">{l}</span>
        </span>
      ))}
    </Balise>
  );
}

// Small line icons, drawn once (24×24, stroke).
export const TRACES = {
  graphe: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  agenda: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5',
  pieces: 'M12 3v18 M17 7H9.5a2.5 2.5 0 000 5h5a2.5 2.5 0 010 5H6',
  bouclier: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  equipe: 'M9 11a3 3 0 100-6 3 3 0 000 6z M3 20a6 6 0 0112 0 M17 11a2.5 2.5 0 100-5 M21 20a5 5 0 00-4-4.9',
  ampoule: 'M9 18h6 M10 21h4 M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
  rouage: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19 12l2-1-1-3-2 .3-1.4-1.4.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L5.3 8.3 3.3 8l-1 3 2 1v0l-2 1 1 3 2-.3 1.4 1.4-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.4-1.4 2 .3 1-3z',
  fusee: 'M5 19l3-1-2-2z M14 4c3 0 6 3 6 6l-7 7-6-6z M15 9h.01 M9 13l-4 1 2-4',
  puce: 'M7 7h10v10H7z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4',
  cadenas: 'M6 11h12v10H6z M9 11V7a3 3 0 016 0v4',
  eclair: 'M13 3L5 14h6l-1 7 8-11h-6z',
  ecran: 'M3 5h18v11H3z M8 20h8 M12 16v4',
  email: 'M3 6h18v12H3z M3 7l9 6 9-6',
  web: 'M12 21a9 9 0 100-18 9 9 0 000 18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18',
  tel: 'M7 3h4l1 5-2.5 1.5a11 11 0 005 5L16 12l5 1v4a2 2 0 01-2 2A16 16 0 015 5a2 2 0 012-2z',
  bulle: 'M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-4.1-1.1z',
  crm: 'M8 11a3 3 0 100-6 3 3 0 000 6z M3 20a5 5 0 0110 0 M16 8h5 M16 12h5 M16 16h3',
  erp: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  doc: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6 M9 16h6',
  reseau: 'M7 12a2 2 0 100-.01 M17 6a2 2 0 100-.01 M17 18a2 2 0 100-.01 M8.7 11l6.6-4 M8.7 13l6.6 4',
  micro: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3z M5 11a7 7 0 0014 0 M12 18v3',
  voix: 'M4 10v4 M8 7v10 M12 4v16 M16 8v8 M20 11v2',
  visage: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 21a8 8 0 0116 0',
  outils: 'M14 7l3-3 3 3-3 3 M17 4L9 12 M4 20l5-5 M7 13l4 4',
  cible: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 16a4 4 0 100-8 4 4 0 000 8z M12 12h.01',
  cle: 'M15 9a4 4 0 11-3.5 6H9v2H7v2H4v-3l6.5-6.5A4 4 0 0115 9z',
  nuage: 'M7 18h10a4 4 0 00.5-8A6 6 0 006 9.5 4.3 4.3 0 007 18z',
  serveur: 'M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01',
  hybride: 'M4 18h7v-6H4z M13 12h7V6h-7z M11 15h2 M16.5 12v3',
  coche: 'M5 12l4 4 10-10',
};
export function Icone({ nom, taille = 20, className = '' }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={TRACES[nom]} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
