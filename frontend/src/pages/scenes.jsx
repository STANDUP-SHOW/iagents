import { useEffect, useRef } from 'react';
import { Icone, Fleche } from '../accueil/composants.jsx';

// The visual language of the inner pages (max's audit « Pages intérieures,
// refonte visuelle MASTER », 11/10): every major title opens a scene, a
// product proof or a demonstration, and the text stays HTML for search
// engines. Images are the official assets (Box, Desktop Commander screens,
// the iAgent portraits) or crops of max's own mockups; nothing here carries
// a price or a count of its own: pages pass them in from tarifs.json and the
// catalogue.

const IMG = '/pages';

/** Words in the iAgent light: cyan to magenta, for one strong word of a title. */
export const Eclat = ({ children }) => <span className="sc-eclat">{children}</span>;

/** Reveals a block once, when it enters the screen (still visible without script or with reduced motion). */
export function useApparition() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return undefined;
    el.classList.add('sc-a-venir');
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('sc-vu'); o.disconnect(); } }, { threshold: 0.18 });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return ref;
}

/**
 * The opening scene of a page: a background (city, sunrise or orbit), the
 * text on the left, a visual on the right, and a row of proofs under the
 * actions. `decor` picks one of the home page's backgrounds.
 */
export function Heros({ surtitre, titre, texte, actions, preuves, visuel, decor = 'ville', className = '', badge }) {
  return (
    <section className={`sc-heros sc-decor-${decor} ${className}`}>
      <div className="sc-heros-fond" aria-hidden="true">
        <img src={`/accueil/decor-${decor}-1280.webp`} srcSet={`/accueil/decor-${decor}-1280.webp 1280w, /accueil/decor-${decor}.webp 2560w`} sizes="100vw" alt="" width="1280" height="720" fetchpriority="high" decoding="async" />
      </div>
      <div className="sc-cadre sc-heros-grille">
        <div className="sc-heros-texte">
          {badge && <p className="sc-badge">{badge}</p>}
          <p className="mq-surtitre">{surtitre}</p>
          <h1 className="sc-h1">{titre}</h1>
          {texte && <p className="sc-chapeau">{texte}</p>}
          {actions && <div className="sc-actions">{actions}</div>}
          {preuves && (
            <ul className="sc-preuves">
              {preuves.map(([icone, fort, doux]) => (
                <li key={fort}><span className="sc-preuve-icone"><Icone nom={icone} taille={18} /></span><span><b>{fort}</b>{doux && <small>{doux}</small>}</span></li>
              ))}
            </ul>
          )}
        </div>
        {visuel && <div className="sc-heros-visuel">{visuel}</div>}
      </div>
    </section>
  );
}

/** A section of a page: overline, title (one word may shine), text, then its scene. */
export function Scene({ id, surtitre, titre, texte, droite, children, className = '', etroit = false }) {
  const ref = useApparition();
  return (
    <section id={id} ref={ref} className={`sc-scene ${className}`}>
      <div className={`sc-cadre ${etroit ? 'sc-etroit' : ''}`}>
        {(surtitre || titre || droite) && (
          <div className="sc-scene-tete">
            <div>
              {surtitre && <p className="mq-surtitre">{surtitre}</p>}
              {titre && <h2 className="sc-h2">{titre}</h2>}
              {texte && <p className="sc-texte">{texte}</p>}
            </div>
            {droite && <div className="sc-scene-droite">{droite}</div>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/** A screen of the real application, in a glass frame. */
export function Ecran({ src, alt, largeur = 1280, hauteur = 800, legende, className = '', charger = 'lazy' }) {
  return (
    <figure className={`sc-ecran ${className}`}>
      <div className="sc-ecran-cadre">
        <img src={`${IMG}/${src}.webp`} alt={alt} width={largeur} height={hauteur} loading={charger} decoding="async" />
      </div>
      {legende && <figcaption>{legende}</figcaption>}
    </figure>
  );
}

/** An image of the product or of a scene (official assets, max's mockups). */
export function Photo({ src, alt = '', largeur, hauteur, className = '', charger = 'lazy', dossier = IMG }) {
  return <img className={`sc-photo ${className}`} src={`${dossier}/${src}.webp`} alt={alt} width={largeur} height={hauteur} loading={charger} decoding="async" />;
}

/** One of the 25 featured iAgent portraits (e01 to e25). */
export const Visage = ({ n, alt = '', taille = 480, className = '' }) => (
  <img className={`sc-visage ${className}`} src={`${IMG}/equipe/e${String(n).padStart(2, '0')}.webp`} alt={alt} width={taille} height={taille} loading="lazy" decoding="async" />
);

/** A portrait with its role (never a first name: the client gives it at hiring). */
export function Collaborateur({ n, role, statut, className = '' }) {
  return (
    <figure className={`sc-collab ${className}`}>
      <Visage n={n} alt={`Portrait d'un collaborateur iAgent : ${role}`} />
      <figcaption><b>{role}</b>{statut && <small>{statut}</small>}</figcaption>
    </figure>
  );
}

/**
 * Steps on a rail: horizontal on a computer, vertical on a phone, the line
 * lighting up as the reader arrives. Each step: [titre, texte, visuel?].
 */
export function Rail({ etapes, colonnes }) {
  const ref = useApparition();
  return (
    <ol ref={ref} className="sc-rail" style={colonnes ? { '--colonnes': colonnes } : undefined}>
      {etapes.map(([titre, texte, visuel], i) => (
        <li key={titre} style={{ '--i': i }}>
          <div className="sc-rail-tete"><span className="sc-rail-n">{i + 1}</span><b>{titre}</b></div>
          {visuel && <div className="sc-rail-visuel">{visuel}</div>}
          <p>{texte}</p>
        </li>
      ))}
    </ol>
  );
}

/** Big feature tiles with an icon and, for voice and listening, a waveform. Items: [icone, titre, sousTitre, texte, onde?]. */
export function Atouts({ items, colonnes = 4 }) {
  return (
    <ul className={`sc-atouts sc-col-${colonnes}`}>
      {items.map(([icone, titre, sous, texte, onde]) => (
        <li key={titre} className="sc-verre">
          <span className="sc-atout-icone"><Icone nom={icone} taille={30} /></span>
          <div>
            <h3>{titre}{onde && <Onde className="sc-atout-onde" />}</h3>
            {sous && <p className="sc-atout-sous">{sous}</p>}
            <p>{texte}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Cards with an icon: [icone, titre, texte, href?]. Lighter than Atouts, for proofs. */
export function Preuves({ items, colonnes = 4, className = '' }) {
  return (
    <ul className={`sc-cartes sc-col-${colonnes} ${className}`}>
      {items.map(([icone, titre, texte, href]) => {
        const corps = (<><span className="sc-carte-icone"><Icone nom={icone} taille={22} /></span><b>{titre}</b>{texte && <small>{texte}</small>}{href && <span className="sc-lien">En savoir plus <Fleche /></span>}</>);
        return <li key={titre}>{href ? <a href={href} className="sc-verre">{corps}</a> : <div className="sc-verre">{corps}</div>}</li>;
      })}
    </ul>
  );
}

/** A check list. */
export function Liste({ items, className = '' }) {
  return <ul className={`sc-coches ${className}`}>{items.map((t) => <li key={t}><Icone nom="coche" taille={16} />{t}</li>)}</ul>;
}

/** A sound wave, drawn once; it moves slowly only when motion is allowed. */
export function Onde({ className = '', barres = 38 }) {
  const h = Array.from({ length: barres }, (_, i) => 3 + Math.round(Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)) * 18 + (i % 5 === 0 ? 4 : 0)));
  return (
    <svg className={`sc-onde ${className}`} viewBox={`0 0 ${barres * 5} 30`} aria-hidden="true" preserveAspectRatio="none">
      {h.map((v, i) => <rect key={i} x={i * 5} y={15 - v / 2} width="2.4" height={v} rx="1.2" style={{ animationDelay: `${(i % 9) * 0.11}s` }} />)}
    </svg>
  );
}

/**
 * A mock screen or document, framed as an example: it shows what the product
 * does with made-up data, never a live figure (audit, §6: « Scénario / aperçu
 * produit »).
 */
export function Exemple({ titre, icone, children, className = '', mention = 'Exemple illustratif' }) {
  return (
    <div className={`sc-exemple sc-verre ${className}`}>
      <div className="sc-exemple-tete">
        {icone && <span className="sc-exemple-icone"><Icone nom={icone} taille={16} /></span>}
        <b>{titre}</b>
        <span className="sc-mention">{mention}</span>
      </div>
      {children}
    </div>
  );
}

/** Label / value lines inside an example card. */
export function Champs({ lignes }) {
  return (
    <dl className="sc-champs">
      {lignes.map(([k, v, ton]) => <div key={k}><dt>{k}</dt><dd className={ton ? `sc-ton-${ton}` : ''}>{v}</dd></div>)}
    </dl>
  );
}

/** The closing call to action, in the official gradient's light. */
export function Final({ titre, texte, children, visage }) {
  const ref = useApparition();
  return (
    <section ref={ref} className="sc-scene sc-final-zone">
      <div className="sc-cadre">
        <div className="sc-final sc-verre">
          {visage && <Visage n={visage} className="sc-final-visage" />}
          <div className="sc-final-texte">
            <h2 className="sc-h2">{titre}</h2>
            {texte && <p className="sc-texte">{texte}</p>}
          </div>
          <div className="sc-actions">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** A choice between two or three paths (Box or cloud, local or hybrid). */
export function Choix({ items }) {
  return (
    <div className="sc-choix">
      {items.map(([icone, titre, texte, actif]) => (
        <div key={titre} className={`sc-choix-ligne ${actif ? 'actif' : ''}`}>
          <Icone nom={icone} taille={22} /><span><b>{titre}</b><small>{texte}</small></span>
        </div>
      ))}
    </div>
  );
}
