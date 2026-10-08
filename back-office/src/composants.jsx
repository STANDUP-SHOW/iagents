// Shared building blocks of the screens. No colour is written here: they all
// come from charte.css.

export const euros = (n, devise = 'EUR') => (typeof n === 'number' && Number.isFinite(n)
  ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise || 'EUR' }).format(n)
  : '—');
export const nombre = (n) => (typeof n === 'number' && Number.isFinite(n) ? new Intl.NumberFormat('fr-FR').format(n) : '—');
export const date = (iso) => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'Europe/Paris' }).format(new Date(t)) : String(iso);
};
export const dateHeure = (iso) => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(t)) : String(iso);
};
export const liste = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '—');
/** A platform list answer may be a bare array or `{ <clé>: [...] }`; anything else is shown as an error by the caller. */
export function lignesDe(donnees, ...cles) {
  if (Array.isArray(donnees)) return donnees;
  if (donnees && typeof donnees === 'object') {
    for (const c of cles) if (Array.isArray(donnees[c])) return donnees[c];
  }
  return null;
}

export function Panneau({ titre, sousTitre, actions, children, id }) {
  return (
    <section className="panneau" id={id}>
      <header className="panneau-tete">
        <div>
          <h2>{titre}</h2>
          {sousTitre ? <p className="discret">{sousTitre}</p> : null}
        </div>
        {actions ? <div className="panneau-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** The platform's sentence, verbatim. */
export function Erreur({ message, locale = false }) {
  return (
    <div className="erreur" role="alert">
      <strong>{locale ? "Rien n'est parti :" : 'La plateforme refuse :'}</strong> <span className="erreur-texte">{message}</span>
    </div>
  );
}

export function Chargement() {
  return <p className="discret" aria-busy="true">Lecture en cours…</p>;
}

/** Renders a read: loading, the platform's error, or the data. */
export function Lecture({ lecture, children }) {
  if (lecture.erreur) return <Erreur message={lecture.erreur} locale={lecture.plateforme === false} />;
  if (lecture.chargement || lecture.donnees === null || lecture.donnees === undefined) return <Chargement />;
  return children(lecture.donnees);
}

/** Outcome of an action: what the platform answered, never a success it did not give. */
export function Resultat({ etat, succes }) {
  if (!etat || etat.statut === 'repos') return null;
  if (etat.statut === 'en-cours') return <p className="discret" aria-busy="true">Envoi à la plateforme…</p>;
  if (etat.statut === 'erreur') return <Erreur message={etat.erreur} locale={etat.plateforme === false} />;
  return (
    <div className="succes" role="status">
      <strong>La plateforme a enregistré :</strong> {succes ? succes(etat.corps) : JSON.stringify(etat.corps)}
    </div>
  );
}

export function Tableau({ colonnes, lignes, cle, vide }) {
  if (!lignes || lignes.length === 0) return <p className="vide">{vide}</p>;
  return (
    <div className="tableau-cadre">
      <table className="tableau">
        <thead>
          <tr>{colonnes.map((c) => <th key={c.titre} scope="col">{c.titre}</th>)}</tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={cle ? cle(l) : i}>
              {colonnes.map((c) => <td key={c.titre} data-titre={c.titre}>{c.rendu(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Champ({ libelle, aide, children }) {
  return (
    <label className="champ">
      <span className="champ-libelle">{libelle}</span>
      {children}
      {aide ? <span className="champ-aide">{aide}</span> : null}
    </label>
  );
}

export function Pastille({ ton = 'neutre', children }) {
  return <span className={`pastille pastille-${ton}`}>{children}</span>;
}

export function Bouton({ principal, children, ...props }) {
  return <button type="button" className={principal ? 'bouton bouton-principal' : 'bouton'} {...props}>{children}</button>;
}

/** Said plainly when the contract has no route for what the screen should do. */
export function RouteAbsente({ titre, ceQuiManque, proposition }) {
  return (
    <div className="route-absente" role="note">
      <h3>{titre}</h3>
      <p>{ceQuiManque}</p>
      {proposition && proposition.length ? (
        <>
          <p className="discret">Route proposée au contrat (docs/master/routes.md) :</p>
          <ul className="proposition">
            {proposition.map((r) => (
              <li key={`${r.methode} ${r.chemin}`}><code>{r.methode} {r.chemin}</code> <Pastille>{r.acces}</Pastille> {r.role}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** Parses a JSON textarea; throws a French sentence the screen shows before calling anything. */
export function lireJson(texte, quoi) {
  try { return JSON.parse(texte); } catch (e) { throw new Error(`${quoi} n'est pas du JSON lisible : ${e.message}`); }
}
