// How long an agent can be rented (max, 15/10/2026): 24 hours, 7 days, 14 days
// or a month. The short rentals are a rule of three on the monthly price, the
// share of the month being written in tarifs.json (agents.durees) and nowhere
// else. Read by the site and by the payment alike, so the page and Stripe can
// never bill two different amounts.

/** The rental lengths of tarifs.json, month last. */
export const dureesDe = (tarifs) => tarifs.agents.durees?.liste ?? [];

/** The rental length by id, null when tarifs.json does not know it. */
export const dureeDe = (tarifs, id) => dureesDe(tarifs).find((d) => d.id === id) ?? null;

/** The month, the length a line gets when nothing else is chosen. */
export const dureeParDefaut = (tarifs) => dureesDe(tarifs).find((d) => d.recurrent) ?? null;

/**
 * Price of a rental from the monthly price, rounded to the cent:
 * 149 € a month → 4,97 € for 24 hours, 37,25 € for 7 days, 74,50 € for 14 days.
 * Computed in cents so that 0.1 + 0.2 never leaks into a price.
 */
export function prixPourDuree(mensuel, duree) {
  const [num, den] = duree.partDuMois;
  return Math.round((mensuel * 100 * num) / den) / 100;
}
