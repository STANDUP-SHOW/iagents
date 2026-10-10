// POST /api/paiement/session — the recruitment list becomes a Stripe Checkout
// session; the answer carries the URL of Stripe's hosted payment page.
// GET  /api/paiement/session?id=cs_… — what the return page shows afterwards.
import { RefusPanier, lignesAFacturer, totalHT } from '../../paiement/panier.js';
import { ErreurStripe, assurerWebhook, creerSession } from '../../paiement/stripe.js';
import { SITE, json, origineDeRetour, stripeDepuisEnv } from '../../paiement/http.js';

export async function POST(request) {
  const s = stripeDepuisEnv();
  if (!s) return json({ erreur: 'Le paiement en ligne n\'est pas encore ouvert : envoyez la liste en demande de devis.', devis: true }, 503);

  let panier;
  try {
    panier = await request.json();
  } catch {
    return json({ erreur: 'La liste de recrutement est illisible.' }, 400);
  }

  let lignes;
  try {
    lignes = lignesAFacturer(panier);
  } catch (e) {
    if (e instanceof RefusPanier) return json({ erreur: e.message, devis: true }, 400);
    throw e;
  }

  if (process.env.VERCEL_ENV === 'production') {
    const site = (process.env.SITE_URL || SITE).replace(/\/$/, '');
    // Never blocks a payment: without the webhook, Stripe still records the order.
    await assurerWebhook(s, `${site}/api/paiement/webhook`).catch((e) => console.error('webhook Stripe non enregistré :', e.message));
  }

  try {
    const session = await creerSession(s, lignes, { origine: origineDeRetour(request) });
    return json({ url: session.url, totalHT: totalHT(lignes) });
  } catch (e) {
    console.error('session Stripe refusée :', e.message);
    const message = e instanceof ErreurStripe ? 'Le paiement n\'a pas pu s\'ouvrir. Réessayez, ou envoyez la liste en demande de devis.' : 'Erreur inattendue.';
    return json({ erreur: message, devis: true }, 502);
  }
}

export async function GET(request) {
  const s = stripeDepuisEnv();
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!s || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(id)) return json({ erreur: 'Session inconnue.' }, 404);
  try {
    const session = await s.get(`/checkout/sessions/${id}`);
    return json({
      statut: session.status, // open | complete | expired
      paye: session.payment_status === 'paid',
      totalHT: session.amount_subtotal,
      totalTTC: session.amount_total,
    });
  } catch {
    return json({ erreur: 'Session inconnue.' }, 404);
  }
}
