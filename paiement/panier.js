// The recruitment list (the site's cart) turned into lines Stripe can bill.
// Pure: no network, no secret, so the bench replays it without an account.
//
// The browser only says WHAT it wants (which fiche, which tier, which Box).
// Every amount and every product name is read here, from tarifs.json and from
// the agent's own fiche; a price sent by the page is never read at all.
import tarifs from '../frontend/src/data/tarifs.json' with { type: 'json' };
import { readdirSync, readFileSync } from 'node:fs';

// Stripe refuses a subscription of more than 20 items. Past that, the cart
// stays a quote request: a big team is a conversation anyway.
export const LIGNES_MAX = 20;
export const QUANTITE_MAX = 20;
export const TVA_FR = 20;

export class RefusPanier extends Error {}

const centimes = (euros) => Math.round(euros * 100);

/** Agents directory, resolved from this file so it works on Vercel as in the bench. */
const DOSSIER_AGENTS = new URL('../agents/', import.meta.url);
let index = null;

/** id ("AG-0001") or slug ("secretaire-administratif") -> file name, read once. */
function indexDesFiches() {
  if (index) return index;
  index = new Map();
  for (const f of readdirSync(DOSSIER_AGENTS)) {
    const m = /^(AG-\d{4})-(.+)\.json$/.exec(f);
    if (!m) continue;
    index.set(m[1], f);
    index.set(m[2], f);
  }
  return index;
}

/** The fiche's id and French name, from the fiche itself. */
export function lireFiche(reference) {
  if (typeof reference !== 'string' || !/^[A-Za-z0-9-]{1,120}$/.test(reference)) return null;
  const fichier = indexDesFiches().get(reference);
  if (!fichier) return null;
  const f = JSON.parse(readFileSync(new URL(fichier, DOSSIER_AGENTS), 'utf8'));
  return { id: f.id, nom: f.nom };
}

/** Agent price for a tier, following agents.affichage; null when not sold online. */
export function prixAgent(palier, t = tarifs) {
  const a = t.agents;
  if (a.affichage === 'paliers') {
    const p = a.paliers.find((x) => x.id === palier);
    return p && typeof p.mensuel === 'number' ? { palier: p.id, nomPalier: p.nom, mensuel: p.mensuel } : null;
  }
  if (a.affichage === 'unique' && typeof a.unique?.mensuel === 'number') {
    return { palier: 'unique', nomPalier: null, mensuel: a.unique.mensuel };
  }
  return null; // 'devis': agents are not sold online
}

/** A Box offer the site sells online; null for a hidden or quote-only one. */
export function offreBox(id, t = tarifs) {
  const b = t.box.find((x) => x.id === id);
  if (!b || !b.public || typeof b.mensuel !== 'number' || b.statut === 'sur-devis' || b.statut === 'bientot') return null;
  return b;
}

/**
 * Cart sent by the site:
 *   { lignes: [ { type: 'agent', fiche: 'AG-0001', palier: 'essential', quantite: 1 },
 *               { type: 'box', offre: 'box-commander-36', quantite: 1 } ] }
 * Returns the lines to bill, merged by price, or throws RefusPanier with a
 * French sentence the page can show as is.
 */
export function lignesAFacturer(panier, t = tarifs) {
  const entree = panier?.lignes;
  if (!Array.isArray(entree) || entree.length === 0) throw new RefusPanier('La liste de recrutement est vide.');
  if (entree.length > 100) throw new RefusPanier('La liste de recrutement est trop longue pour un paiement en ligne.');

  const parCle = new Map();
  for (const l of entree) {
    const quantite = l?.quantite ?? 1;
    if (!Number.isInteger(quantite) || quantite < 1 || quantite > QUANTITE_MAX) {
      throw new RefusPanier(`Une quantité doit être un nombre entier entre 1 et ${QUANTITE_MAX}.`);
    }
    let ligne;
    if (l?.type === 'agent') {
      const fiche = lireFiche(l.fiche);
      if (!fiche) throw new RefusPanier('Un agent de la liste n\'existe pas au catalogue.');
      const prix = prixAgent(l.palier, t);
      if (!prix) throw new RefusPanier('Cette formule d\'agent ne se règle pas en ligne : demandez un devis.');
      const montant = centimes(prix.mensuel);
      ligne = {
        cle: `iagent_agent_${fiche.id}_${prix.palier}_${montant}`,
        nom: prix.nomPalier ? `Agent ${fiche.nom} · ${prix.nomPalier}` : `Agent ${fiche.nom}`,
        montant,
        quantite,
        type: 'agent',
        detail: { fiche: fiche.id, palier: prix.palier },
      };
    } else if (l?.type === 'box') {
      const b = offreBox(l.offre, t);
      if (!b) throw new RefusPanier('Cette offre de Box ne se règle pas en ligne : demandez un devis.');
      const montant = centimes(b.mensuel);
      ligne = {
        cle: `iagent_box_${b.id}_${montant}`,
        nom: `${b.nom} · engagement ${b.engagementMois} mois`,
        montant,
        quantite,
        type: 'box',
        detail: { offre: b.id, engagementMois: b.engagementMois },
      };
    } else {
      throw new RefusPanier('Une ligne de la liste n\'est ni un agent ni une Box.');
    }
    const deja = parCle.get(ligne.cle);
    if (deja) deja.quantite += ligne.quantite;
    else parCle.set(ligne.cle, ligne);
  }

  const lignes = [...parCle.values()];
  if (lignes.length > LIGNES_MAX) {
    throw new RefusPanier(`Au-delà de ${LIGNES_MAX} postes différents, la liste part en demande de devis.`);
  }
  for (const l of lignes) {
    if (l.quantite > QUANTITE_MAX) throw new RefusPanier(`Au-delà de ${QUANTITE_MAX} exemplaires d'un même poste, la liste part en demande de devis.`);
  }
  return lignes;
}

/** Monthly total excluding VAT, in cents (what the page and the bench compare). */
export const totalHT = (lignes) => lignes.reduce((s, l) => s + l.montant * l.quantite, 0);

/** Longest Box commitment of the cart, 0 without a Box. */
export const engagement = (lignes) => Math.max(0, ...lignes.filter((l) => l.type === 'box').map((l) => l.detail.engagementMois));

/** What Stripe Checkout shows above the pay button. */
export function texteEngagement(lignes) {
  const mois = engagement(lignes);
  const base = 'Abonnement mensuel, montants hors taxes, TVA française de 20 % ajoutée.';
  return mois ? `${base} La Box Commander est louée avec un engagement de ${mois} mois.` : base;
}

/** Order metadata kept on the subscription (Stripe: 50 keys, 500 characters each). */
export function metadonnees(lignes) {
  const m = { origine: 'iagent.agency', engagement_box_mois: String(engagement(lignes)) };
  lignes.forEach((l, i) => {
    m[`ligne_${i + 1}`] = l.type === 'agent'
      ? `agent ${l.detail.fiche} ${l.detail.palier} x${l.quantite}`
      : `box ${l.detail.offre} x${l.quantite}`;
  });
  return m;
}
