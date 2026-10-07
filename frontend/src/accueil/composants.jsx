// Shared pieces of the home page, written to be reused by the catalogue,
// « Créez votre entreprise », the Box page and the agent profiles when they
// adopt the same charter.
import { useEffect, useRef, useState } from 'react';
import { suivre } from './analytique.js';

// Stable asset name published by build-windows-msi.yml: /latest/download/
// serves the installer itself (same link as the shop's Navbar).
export const TELECHARGEMENT = 'https://github.com/STANDUP-SHOW/iagents/releases/latest/download/iAgent-Windows.msi';

export const LIENS = {
  catalogue: '/catalogue',
  entreprise: '/catalogue?page=entreprise',
  box: '/catalogue?page=box',
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
