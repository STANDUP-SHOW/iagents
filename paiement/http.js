// What the three /api/paiement routes share: the key, the site address, JSON answers.
import { client, modeDeLaCle } from './stripe.js';

export const SITE = 'https://iagent.agency';

/** Stripe client when a valid key is set in Vercel, null otherwise. */
export function stripeDepuisEnv(env = process.env, f = fetch) {
  const cle = env.STRIPE_SECRET_KEY;
  return modeDeLaCle(cle) ? client(cle, f) : null;
}

/** Where Stripe sends the customer back: the site, or the preview that asked. */
export function origineDeRetour(request, env = process.env) {
  const site = (env.SITE_URL || SITE).replace(/\/$/, '');
  const o = request.headers.get('origin');
  if (!o) return site;
  try {
    const u = new URL(o);
    const sure = u.protocol === 'https:' && (u.hostname === 'iagent.agency' || u.hostname === 'www.iagent.agency' || u.hostname.endsWith('.vercel.app'));
    return sure ? u.origin : site;
  } catch {
    return site;
  }
}

export const json = (corps, statut = 200) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
