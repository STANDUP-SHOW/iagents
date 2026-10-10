// Stripe, spoken over its REST API with fetch: no SDK to install or keep up to
// date, and the bench swaps `fetch` for a fake to replay every call.
//
// The secret key is read from the environment only (Vercel, typed by max).
// Without it nothing here is called, and the site keeps its quote request.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { TVA_FR, metadonnees, texteEngagement } from './panier.js';

const API = 'https://api.stripe.com/v1';

/** 'test' | 'reel' | null, read from the key itself so it can't disagree with it. */
export function modeDeLaCle(cle) {
  if (typeof cle !== 'string') return null;
  if (/^(sk|rk)_test_/.test(cle)) return 'test';
  if (/^(sk|rk)_live_/.test(cle)) return 'reel';
  return null;
}

/** Stripe's form encoding: a[b][0][c]=… for nested objects and arrays. */
export function encoder(objet, prefixe = '', sortie = new URLSearchParams()) {
  for (const [k, v] of Object.entries(objet)) {
    if (v === undefined || v === null) continue;
    const cle = prefixe ? `${prefixe}[${k}]` : k;
    if (typeof v === 'object') encoder(v, cle, sortie);
    else sortie.append(cle, String(v));
  }
  return sortie;
}

export class ErreurStripe extends Error {
  constructor(message, statut) { super(message); this.statut = statut; }
}

export function client(cle, f = fetch) {
  const appeler = async (methode, chemin, corps) => {
    const r = await f(`${API}${chemin}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: corps ? encoder(corps).toString() : undefined,
    });
    const json = await r.json();
    if (!r.ok) throw new ErreurStripe(json?.error?.message ?? `Stripe a répondu ${r.status}`, r.status);
    return json;
  };
  return {
    get: (chemin) => appeler('GET', chemin),
    post: (chemin, corps) => appeler('POST', chemin, corps),
  };
}

// The Stripe catalogue builds itself on the first payment of each line: a price
// is found by its lookup key (which carries the amount), created otherwise.
// A price changed in tarifs.json therefore gets a new Stripe price; past
// subscriptions keep the one they were sold at.
const cache = new Map();

export async function prixStripe(s, ligne) {
  if (cache.has(ligne.cle)) return cache.get(ligne.cle);
  const trouve = await s.get(`/prices?active=true&lookup_keys[0]=${encodeURIComponent(ligne.cle)}`);
  let id = trouve.data?.[0]?.id;
  if (!id) {
    const cree = await s.post('/prices', {
      currency: 'eur',
      unit_amount: ligne.montant,
      recurring: { interval: 'month' },
      tax_behavior: 'exclusive',
      lookup_key: ligne.cle,
      transfer_lookup_key: true, // two first payments at once must not fail
      product_data: { name: ligne.nom, metadata: { iagent: ligne.type, ...ligne.detail } },
      metadata: { iagent: ligne.cle },
    });
    id = cree.id;
  }
  cache.set(ligne.cle, id);
  return id;
}

/** French VAT at 20 %, created once in the account and found by its metadata after that. */
export async function tauxTVA(s) {
  if (cache.has('tva')) return cache.get('tva');
  const liste = await s.get('/tax_rates?active=true&limit=100');
  let id = liste.data?.find((t) => t.metadata?.iagent === `tva-fr-${TVA_FR}`)?.id;
  if (!id) {
    const cree = await s.post('/tax_rates', {
      display_name: 'TVA',
      description: `TVA française ${TVA_FR} %`,
      percentage: TVA_FR,
      inclusive: false,
      country: 'FR',
      jurisdiction: 'FR',
      metadata: { iagent: `tva-fr-${TVA_FR}` },
    });
    id = cree.id;
  }
  cache.set('tva', id);
  return id;
}

/** Hosted Stripe Checkout: no card number ever crosses our pages. */
export async function creerSession(s, lignes, { origine }) {
  const tva = await tauxTVA(s);
  const line_items = [];
  for (const l of lignes) {
    line_items.push({ price: await prixStripe(s, l), quantity: l.quantite, tax_rates: [tva] });
  }
  const meta = metadonnees(lignes);
  return s.post('/checkout/sessions', {
    mode: 'subscription',
    locale: 'fr',
    line_items,
    billing_address_collection: 'required',
    phone_number_collection: { enabled: true },
    tax_id_collection: { enabled: true },
    custom_text: { submit: { message: texteEngagement(lignes) } },
    metadata: meta,
    subscription_data: { metadata: meta, description: 'Recrutement iAgent' },
    success_url: `${origine}/recrutement?paiement=reussi&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/recrutement?paiement=annule`,
  });
}

/** The webhook endpoint registers itself in production, once, so max has nothing to set up. */
export async function assurerWebhook(s, url) {
  if (cache.has('webhook')) return;
  const liste = await s.get('/webhook_endpoints?limit=100');
  if (!liste.data?.some((w) => w.url === url)) {
    await s.post('/webhook_endpoints', {
      url,
      enabled_events: ['checkout.session.completed', 'invoice.payment_failed', 'customer.subscription.deleted'],
      description: 'iagent.agency : liste de recrutement',
    });
  }
  cache.set('webhook', true);
}

export const viderCache = () => cache.clear();

/**
 * Stripe-Signature check (t=…,v1=…), 5 minutes of tolerance.
 * Used when STRIPE_WEBHOOK_SECRET exists; otherwise the webhook re-reads the
 * event from Stripe with the secret key and trusts only that copy.
 */
export function signatureValide(corps, entete, secret, maintenant = Date.now()) {
  if (!entete || !secret) return false;
  const parts = {};
  const v1 = [];
  for (const p of entete.split(',')) {
    const [k, v] = p.split('=');
    if (k === 't') parts.t = v;
    if (k === 'v1') v1.push(v);
  }
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(maintenant / 1000 - t) > 300) return false;
  const attendu = Buffer.from(createHmac('sha256', secret).update(`${parts.t}.${corps}`).digest('hex'));
  return v1.some((s) => {
    const b = Buffer.from(s);
    return b.length === attendu.length && timingSafeEqual(b, attendu);
  });
}
