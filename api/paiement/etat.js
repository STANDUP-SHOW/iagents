// GET /api/paiement/etat — tells the recruitment list whether to show
// « Payer » (Stripe) or keep « Demander un devis ». Nothing secret goes out.
import { modeDeLaCle } from '../../paiement/stripe.js';
import { json } from '../../paiement/http.js';

export function GET() {
  const mode = modeDeLaCle(process.env.STRIPE_SECRET_KEY);
  return json({ paiement: Boolean(mode), mode });
}
