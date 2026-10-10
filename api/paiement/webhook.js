// POST /api/paiement/webhook — Stripe tells us an order was paid, a payment
// failed or a subscription ended. Stripe stays the record of the orders (its
// dashboard, its receipts, its e-mails to max); this route writes a line in the
// Vercel logs and is where the platform will hand out the agents once it is online.
import { evenementVerifie, resume } from '../../paiement/evenements.js';
import { json } from '../../paiement/http.js';

export async function POST(request) {
  const corps = await request.text();
  const evenement = await evenementVerifie(corps, request.headers.get('stripe-signature'));
  if (!evenement) return json({ erreur: 'Événement non reconnu.' }, 400);
  console.log('paiement', JSON.stringify(resume(evenement)));
  return json({ recu: true });
}
