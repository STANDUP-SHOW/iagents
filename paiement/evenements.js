// Stripe events received by /api/paiement/webhook: believed only when signed,
// or when Stripe itself hands back the same event.
import { signatureValide } from './stripe.js';
import { stripeDepuisEnv } from './http.js';

export async function evenementVerifie(corps, signature, env = process.env, s = stripeDepuisEnv(env)) {
  if (env.STRIPE_WEBHOOK_SECRET) {
    if (!signatureValide(corps, signature, env.STRIPE_WEBHOOK_SECRET)) return null;
    try { return JSON.parse(corps); } catch { return null; }
  }
  // No signing secret set: only Stripe's own copy of the event is believed.
  if (!s) return null;
  let id;
  try { id = JSON.parse(corps)?.id; } catch { return null; }
  if (typeof id !== 'string' || !/^evt_[A-Za-z0-9]+$/.test(id)) return null;
  try { return await s.get(`/events/${id}`); } catch { return null; }
}

/** One log line per event: no name, no e-mail, no address. */
export function resume(evenement) {
  const o = evenement.data?.object ?? {};
  return {
    evenement: evenement.type,
    mode: evenement.livemode ? 'reel' : 'test',
    objet: o.id,
    abonnement: o.subscription ?? (o.object === 'subscription' ? o.id : undefined),
    montantTTC: o.amount_total ?? o.amount_due,
    lignes: Object.entries(o.metadata ?? {}).filter(([k]) => k.startsWith('ligne_')).map(([, v]) => v),
  };
}
