// The site's prices, read from tarifs.json and nowhere else (max's site plan of
// 07/10, §7: no price is written in a component). Every price stays marked
// « tarif pilote » while its status says so.
import tarifs from './tarifs.json';

// A pack priced as the sum of its parts (« somme ») gets its monthly price from
// the box and agent prices above, so the two can never disagree (max, 07/10:
// Starter = Box 36 mois + 1 Essential).
for (const p of tarifs.packs) {
  if (!p.somme) continue;
  const box = tarifs.box.find((b) => b.id === p.somme.box);
  const agents = Object.entries(p.somme.agents ?? {}).map(([id, n]) => n * tarifs.agents.paliers.find((a) => a.id === id).mensuel);
  p.mensuel = box.mensuel + agents.reduce((x, y) => x + y, 0);
}

export default tarifs;

const fmt = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(x) ? 0 : 2, maximumFractionDigits: 2 }).replace(/ /g, ' ');

/** « 149 € », « 9,90 € ». */
export const euros = (x) => `${fmt(x)} €`;

/** The price of a pack or of the commander, as one line: « ≈ 599 à 749 € », « à partir de 999 € », « Sur devis ». */
export function montant(o) {
  if (o.surDevis) return 'Sur devis';
  if (o.aPartirDe != null) return `à partir de ${euros(o.aPartirDe)}`;
  const environ = o.environ ? '≈ ' : '';
  if (o.mensuelMin != null) return `${environ}${fmt(o.mensuelMin)} à ${euros(o.mensuelMax)}`;
  return `${environ}${euros(o.mensuel)}`;
}

export const STATUTS = { pilote: 'Tarif pilote', public: 'Tarif public', 'sur-devis': 'Sur devis', bientot: 'Bientôt' };

/** The voice offers (document global, §12), by id. */
export const VOICE = Object.fromEntries(tarifs.voice.offres.map((o) => [o.id, o]));

/** The box plans the public may see, cheapest per month first. */
export const BOX_PUBLIQUES = tarifs.box.filter((b) => b.public).sort((a, b) => a.mensuel - b.mensuel);

/** The lowest box rent, the one the site quotes in a sentence. */
export const BOX_DES = BOX_PUBLIQUES[0];

/** What an agent costs, as the site shows it while max has not settled between the plan and 9,90 €. */
export function prixAgentEnUneLigne() {
  const a = tarifs.agents;
  if (a.affichage === 'devis') return 'Sur devis';
  if (a.affichage === 'unique') return `${euros(a.unique.mensuel)} par mois`;
  return `de ${euros(a.paliers[0].mensuel)} à ${euros(a.paliers.at(-1).mensuel)} par mois`;
}

/** Installation ids of dimensionnement/offre-box.json that stay unpublished (plan, §6 and §17). */
export const INSTALLATIONS_MASQUEES = new Set(tarifs.archives.masquees);
