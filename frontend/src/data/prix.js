// max's price per agent (docs/cadrage.md, catalogue V6 of 21/09/2026). It is
// not in the fiches, whose commercial.prixMensuel is the study's market range.
// Always shown apart from the machine and the box subscription.
export const PRIX_AGENT = { mensuel: 9.9, achat: 49.9 };

/** « 9,90 € » the French way, cents kept. */
export const prix = (x) => `${x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
