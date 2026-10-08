import { POLITIQUE, NIVEAUX, CONTENU_OFFRES, FONCTIONS } from '../contenu.js';
import { PLANS, HYPOTHESES, montant, unite } from '../tarifs.js';

export function TablePolitique() {
  return (
    <div className="table-cadre">
      <table className="politique">
        <caption>Ce que l’agent fait seul, et ce qu’il vous demande</caption>
        <thead>
          <tr><th scope="col">Action</th><th scope="col">Politique</th></tr>
        </thead>
        <tbody>
          {POLITIQUE.map((l) => (
            <tr key={l.action}>
              <th scope="row">{l.action}</th>
              <td><span className={`niveau niveau-${l.niveau}`}>{NIVEAUX[l.niveau].libelle}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegendeNiveaux() {
  return (
    <dl className="legende">
      {Object.entries(NIVEAUX).map(([id, n]) => (
        <div key={id}>
          <dt><span className={`niveau niveau-${id}`}>{n.libelle}</span></dt>
          <dd>{n.explication}</dd>
        </div>
      ))}
    </dl>
  );
}

export function GrilleFonctions({ limite }) {
  const liste = limite ? FONCTIONS.slice(0, limite) : FONCTIONS;
  return (
    <ul className="fonctions">
      {liste.map((f) => (
        <li key={f.id} className="carte">
          <h3>{f.titre}</h3>
          <p>{f.texte}</p>
        </li>
      ))}
    </ul>
  );
}

export function CarteOffre({ plan, mise }) {
  const c = CONTENU_OFFRES[plan.id];
  return (
    <article className={`offre${mise ? ' offre-mise' : ''}`} aria-labelledby={`offre-${plan.id}`}>
      <h3 id={`offre-${plan.id}`}>{plan.nom}</h3>
      <p className="offre-accroche">{c.accroche}</p>
      <p className="offre-prix" data-plan={plan.id}>
        <span className="offre-montant">{montant(plan)}</span>
        <span className="offre-unite">{unite(plan)}</span>
      </p>
      <ul className="offre-points">
        {c.points.map((p) => <li key={p}>{p}</li>)}
      </ul>
    </article>
  );
}

export function GrilleOffres() {
  return (
    <>
      <div className="offres">
        {PLANS.map((p) => <CarteOffre key={p.id} plan={p} mise={p.id === 'home-box'} />)}
      </div>
      <p className="mention-prix">
        Prix toutes taxes comprises, par mois.
        {HYPOTHESES && ' Ce sont des hypothèses de lancement : ils peuvent encore évoluer avant l’ouverture.'}
      </p>
    </>
  );
}
