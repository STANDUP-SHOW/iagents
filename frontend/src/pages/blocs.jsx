import { useState } from 'react';
import { Bouton, Fleche, Icone } from '../accueil/composants.jsx';
import { suivre } from '../accueil/analytique.js';
import { CONTACT } from './site.js';

/** The top of an offer page: overline, one title, one paragraph, the actions. */
export function Tete({ surtitre, titre, texte, children }) {
  return (
    <section className="pg-tete">
      <div className="mq-cadre">
        <p className="mq-surtitre">{surtitre}</p>
        <h1 className="mq-display pg-titre">{titre}</h1>
        {texte && <p className="pg-chapeau">{texte}</p>}
        {children && <div className="pg-actions">{children}</div>}
      </div>
    </section>
  );
}

/** One band of a page: overline, title, text, then whatever it carries. */
export function Bande({ surtitre, titre, texte, id, children }) {
  return (
    <section className="mq-bande pg-bande" id={id}>
      {surtitre && <p className="mq-surtitre">{surtitre}</p>}
      {titre && <h2 className="mq-titre">{titre}</h2>}
      {texte && <p className="mq-texte pg-texte">{texte}</p>}
      {children}
    </section>
  );
}

/** Cards with a line icon: [icone, titre, texte, href?]. */
export function Cartes({ items, colonnes = 3 }) {
  return (
    <ul className={`pg-cartes pg-cartes-${colonnes}`}>
      {items.map(([icone, titre, texte, href]) => {
        const corps = <>{icone && <span className="pg-icone"><Icone nom={icone} taille={20} /></span>}<b>{titre}</b>{texte && <small>{texte}</small>}</>;
        return <li key={titre}>{href ? <a href={href}>{corps}<span className="pg-lien">En savoir plus <Fleche /></span></a> : <div>{corps}</div>}</li>;
      })}
    </ul>
  );
}

/** Numbered steps: [titre, texte]. */
export function Etapes({ items }) {
  return (
    <ol className="pg-etapes">
      {items.map(([titre, texte], i) => <li key={titre}><span>{i + 1}</span><b>{titre}</b><small>{texte}</small></li>)}
    </ol>
  );
}

/** A plain list with check marks. */
export function Coches({ items }) {
  return <ul className="pg-coches">{items.map((t) => <li key={t}><Icone nom="coche" taille={16} />{t}</li>)}</ul>;
}

/** The links between the offer pages (plan, §21: they are all linked to each other). */
const VOISINES = [
  ['/workforce', 'iAgent Workforce'],
  ['/box', 'iAgent Box'],
  ['/pricing', 'Tarifs'],
  ['/how-it-works', 'Comment ça marche'],
  ['/local-ai', 'IA locale et hybride'],
  ['/security', 'Sécurité et contrôle'],
  ['/skills', 'Évolution des agents'],
  ['/inside-iagent', 'iAgent inside iAgent'],
  ['/enterprise', 'Enterprise'],
  ['/faq', 'Questions fréquentes'],
];
export function Voisines({ ici }) {
  return (
    <nav className="mq-bande pg-voisines" aria-label="Les pages de l'offre">
      <p className="mq-surtitre">Aller plus loin</p>
      <ul>{VOISINES.filter(([h]) => h !== `/${ici}`).map(([h, t]) => <li key={h}><a href={h}>{t}</a></li>)}</ul>
    </nav>
  );
}

/** The closing call to action of a page. */
export function Fin({ titre, children }) {
  return (
    <section className="mq-bande pg-fin">
      <h2 className="mq-titre">{titre}</h2>
      <div className="pg-actions">{children}</div>
    </section>
  );
}

export { Bouton };

/**
 * A request: what the visitor wants, in the plan's fields. It writes an email
 * to CONTACT; while no address is set it says so, and sends nothing.
 */
export function Demande({ sujet, champs = [], evenement }) {
  const [envoye, setEnvoye] = useState(false);
  const soumettre = (e) => {
    e.preventDefault();
    if (evenement) suivre(evenement);
    if (!CONTACT) { setEnvoye(true); return; }
    const donnees = new FormData(e.currentTarget);
    const corps = [...donnees.entries()].filter(([, v]) => String(v).trim()).map(([k, v]) => `${k} : ${v}`).join('\n');
    window.location.href = `mailto:${CONTACT}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  };
  return (
    <form className="pg-demande" onSubmit={soumettre}>
      <label><span>Votre nom</span><input name="Nom" autoComplete="name" required /></label>
      <label><span>Votre entreprise</span><input name="Entreprise" autoComplete="organization" required /></label>
      <label><span>Votre adresse e-mail</span><input name="E-mail" type="email" autoComplete="email" required /></label>
      {champs.map(([nom, libelle, options]) => (
        <label key={nom}>
          <span>{libelle}</span>
          {options ? <select name={nom} defaultValue="">{['', ...options].map((o) => <option key={o} value={o}>{o || 'Choisir'}</option>)}</select> : <input name={nom} />}
        </label>
      ))}
      <label className="pg-large"><span>Ce que vous voulez accomplir</span><textarea name="Message" rows="4" /></label>
      <button type="submit" className="bouton bouton-plein">Envoyer la demande <Fleche /></button>
      {envoye && !CONTACT && <p className="pg-note" role="status">La réception des demandes n'est pas encore branchée : rien n'est parti. Revenez très bientôt, ou téléchargez l'application pour essayer un agent dès maintenant.</p>}
    </form>
  );
}
