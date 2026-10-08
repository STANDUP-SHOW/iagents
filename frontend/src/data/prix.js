// An agent's price as the shop shows it, read from tarifs.json (max's site plan
// of 07/10). Always shown apart from the box and the AI consumption.
import tarifs from './tarifs.json';

/** « 9,90 € » the French way, cents kept when there are any. */
export const prix = (x) => `${x.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 })} €`;

const a = tarifs.agents;

/** The monthly price of one agent on a card: « dès 149 € », « 9,90 € », « Sur devis ». */
export const PRIX_AGENT_MOIS =
  a.affichage === 'paliers' ? `dès ${prix(a.paliers[0].mensuel)}`
  : a.affichage === 'unique' ? prix(a.unique.mensuel)
  : null;

/** The purchase alternative, only when the price grid has one. */
export const NOTE_ACHAT = a.affichage === 'unique' && a.unique.achat ? `ou ${prix(a.unique.achat)} à l'achat` : null;

/** « dès 149 € / mois » or « Sur devis », in one string. */
export const prixAgentCourt = () => (PRIX_AGENT_MOIS ? `${PRIX_AGENT_MOIS} / mois` : 'Sur devis');
