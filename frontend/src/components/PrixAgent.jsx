import { DUREES, DUREE_MOIS, GRILLE_LOCATION, BOX_DES, euros } from '../data/tarifs.js';
import { devisAgent, COMMANDEUR_ID } from '../data/offres.js';

/**
 * How long to hire the agent for (max, 16/10: « pour la journée à tel tarif, pour
 * la semaine, pour 15 jours, pour un mois »), shown on the fiche before the hire
 * button. Every price is the rule of three of tarifs.json (agents.durees); the
 * chosen length goes with the agent onto the recruitment list.
 */
export function ChoixDuree({ duree, onDuree, compact = false }) {
  if (!DUREES.length || !GRILLE_LOCATION.length) return null;
  const choisie = DUREES.find((d) => d.id === duree) ?? DUREE_MOIS;
  const prixDe = (f, d) => f.prix.find((p) => p.duree.id === d.id)?.montant;
  const premier = GRILLE_LOCATION[0];
  return (
    <div className={`fd-durees${compact ? ' fd-durees-compact' : ''}`}>
      <p className="fd-etiquette">Pour combien de temps</p>
      <div className="fd-durees-choix" role="radiogroup" aria-label="Durée de la location">
        {DUREES.map((d) => (
          <button key={d.id} type="button" role="radio" aria-checked={d.id === choisie.id} onClick={() => onDuree(d.id)} className="fd-duree">
            <span className="fd-duree-nom">{d.nom}</span>
            <span className="fd-duree-prix">{GRILLE_LOCATION.length > 1 ? 'dès ' : ''}{euros(prixDe(premier, d))}</span>
          </button>
        ))}
      </div>
      {GRILLE_LOCATION.length > 1 && (
        <p className="fd-note">
          {choisie.nom}, selon le niveau : {GRILLE_LOCATION.map((f) => `${f.nom} ${euros(prixDe(f, choisie))}`).join(' · ')} HT.
          {choisie.recurrent ? ' Renouvelé chaque mois.' : ' Payé une fois, sans engagement.'}
        </p>
      )}
    </div>
  );
}

/** The two lines of one agent's quote max wants side by side: without the Box and with it. */
export function lignesBox(agent) {
  const devis = devisAgent(agent);
  const sans = devis.find((l) => l.offre === 'aucune');
  const avec = devis.find((l) => l.offre === COMMANDEUR_ID);
  if (!sans || !avec || !(sans.apiSeule > 0)) return null;
  const gain = sans.coutAgent - avec.coutAgent;
  return { sans, avec, gain, pct: Math.round((gain / sans.coutAgent) * 100), agentsPourLaBox: gain > 0 ? Math.ceil(BOX_DES.mensuel / gain) : null };
}

/**
 * What the agent's AI consumption costs without a machine and on the 64 Go Box
 * (max, 16/10: the Box must bring a financial gain, not only a technical one),
 * and how many such agents pay the Box's rent.
 */
export function AvecSansBox({ agent, compact = false }) {
  const l = lignesBox(agent);
  if (!l) return null;
  return (
    <div className={`fd-box-compare${compact ? ' fd-box-compare-compact' : ''}`}>
      <p className="fd-etiquette">Sa consommation d'IA par mois</p>
      <div className="fd-box-colonnes">
        <div>
          <p className="fd-note">Sans Box, tout par API</p>
          <p className="fd-box-montant fd-attenue">{euros(Math.round(l.sans.coutAgent))}</p>
        </div>
        <div>
          <p className="fd-note">Avec la Box 64 Go</p>
          <p className="fd-box-montant">{euros(Math.round(l.avec.coutAgent))} <span className="fd-gain">−{l.pct} %</span></p>
        </div>
      </div>
      {!compact && (
        <p className="fd-note">
          {l.avec.enLocal ? 'Il tient en entier sur la Box : seule une petite part passe par l\'API.' : 'Il fait sur la Box son travail courant (courriels, factures, vos logiciels) ; le raisonnement le plus lourd part par l\'API.'}
          {l.agentsPourLaBox && ` La location de la Box (${euros(BOX_DES.mensuel)} HT par mois) se paie avec ${l.agentsPourLaBox === 1 ? 'cet agent seul' : `${l.agentsPourLaBox} agents comme lui`}.`}
          {' '}Estimation sur ses tâches, abonnement de l'agent à part.
        </p>
      )}
    </div>
  );
}
