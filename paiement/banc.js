// Bench of the payment: cart rules, prices read from tarifs.json, the calls
// sent to Stripe (against a fake Stripe), the webhook signature, and the three
// routes as Vercel calls them. No account, no network.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import tarifs from '../frontend/src/data/tarifs.json' with { type: 'json' };
import { LIGNES_MAX, RefusPanier, lignesAFacturer, lireFiche, metadonnees, texteEngagement, totalHT } from './panier.js';
import { client, creerSession, encoder, modeDeLaCle, signatureValide, viderCache } from './stripe.js';
import { evenementVerifie } from './evenements.js';
import { origineDeRetour } from './http.js';

let echecs = 0;
const cas = async (nom, f) => {
  try { await f(); console.log(`  ok  ${nom}`); } catch (e) { echecs++; console.log(`  FAUTE  ${nom}\n        ${e.message}`); }
};
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof RefusPanier && motif.test(e.message));

const essential = tarifs.agents.paliers.find((p) => p.id === 'essential').mensuel;
const box36 = tarifs.box.find((b) => b.id === 'box-commander-36');

console.log('Panier');
await cas('une fiche se trouve par identifiant et par adresse du site', () => {
  assert.deepEqual(lireFiche('AG-0001'), { id: 'AG-0001', nom: 'Secrétaire administratif' });
  assert.deepEqual(lireFiche('secretaire-administratif'), lireFiche('AG-0001'));
  assert.equal(lireFiche('../package'), null);
  assert.equal(lireFiche('AG-9999'), null);
});
await cas('le Starter coûte ce que dit tarifs.json (Box 36 mois + Essential)', () => {
  const l = lignesAFacturer({ lignes: [{ type: 'box', offre: 'box-commander-36' }, { type: 'agent', fiche: 'AG-0001', palier: 'essential' }] });
  assert.equal(totalHT(l), Math.round((box36.mensuel + essential) * 100));
  assert.equal(totalHT(l), 21800, 'Starter = 218 € HT (choix de max du 07/10)');
});
await cas('un prix envoyé par la page est ignoré', () => {
  const l = lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'essential', mensuel: 1, montant: 1, prix: 1 }] });
  assert.equal(l[0].montant, essential * 100);
});
await cas('le nom vient de la fiche, pas de la page', () => {
  const l = lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'expert', nom: 'Gratuit' }] });
  assert.equal(l[0].nom, 'Agent Secrétaire administratif · Expert');
});
await cas('deux fois le même poste font une ligne de quantité 2', () => {
  const a = { type: 'agent', fiche: 'AG-0002', palier: 'professional' };
  const l = lignesAFacturer({ lignes: [a, { ...a, quantite: 1 }] });
  assert.equal(l.length, 1);
  assert.equal(l[0].quantite, 2);
});
await cas('le même poste à deux paliers fait deux lignes', () => {
  const l = lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0002', palier: 'essential' }, { type: 'agent', fiche: 'AG-0002', palier: 'expert' }] });
  assert.equal(l.length, 2);
});
await cas('refus en français : vide, inconnu, quantité, palier, offre', () => {
  refuse(() => lignesAFacturer({}), /vide/);
  refuse(() => lignesAFacturer({ lignes: [] }), /vide/);
  refuse(() => lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-9999', palier: 'essential' }] }), /n'existe pas/);
  refuse(() => lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'gold' }] }), /devis/);
  refuse(() => lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'essential', quantite: 0 }] }), /entier/);
  refuse(() => lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'essential', quantite: 1.5 }] }), /entier/);
  refuse(() => lignesAFacturer({ lignes: [{ type: 'box', offre: 'box-max' }] }), /devis/);
  refuse(() => lignesAFacturer({ lignes: [{ type: 'remise' }] }), /ni un agent ni une Box/);
});
await cas(`au-delà de ${LIGNES_MAX} postes différents, la liste part en devis (limite Stripe)`, () => {
  const lignes = Array.from({ length: LIGNES_MAX + 1 }, (_, i) => ({ type: 'agent', fiche: `AG-${String(i + 1).padStart(4, '0')}`, palier: 'essential' }));
  refuse(() => lignesAFacturer({ lignes }), /devis/);
  lignesAFacturer({ lignes: lignes.slice(0, LIGNES_MAX) });
});
await cas('agents « devis » : rien ne se règle en ligne', () => {
  const t = structuredClone(tarifs);
  t.agents.affichage = 'devis';
  refuse(() => lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'essential' }] }, t), /devis/);
});
await cas('agents « unique » : le prix unique de tarifs.json', () => {
  const t = structuredClone(tarifs);
  t.agents.affichage = 'unique';
  const l = lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001' }] }, t);
  assert.equal(l[0].montant, Math.round(t.agents.unique.mensuel * 100));
});
await cas('une Box masquée ou sur devis ne se paie pas', () => {
  const t = structuredClone(tarifs);
  t.box[0].public = false;
  refuse(() => lignesAFacturer({ lignes: [{ type: 'box', offre: t.box[0].id }] }, t), /devis/);
});
await cas('l\'engagement de la Box est écrit au-dessus du bouton de paiement', () => {
  const avec = lignesAFacturer({ lignes: [{ type: 'box', offre: 'box-commander-24' }] });
  assert.match(texteEngagement(avec), /engagement de 24 mois/);
  assert.match(texteEngagement(avec), /TVA française de 20 %/);
  const sans = lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'essential' }] });
  assert.doesNotMatch(texteEngagement(sans), /engagement/);
});
await cas('les métadonnées tiennent dans les limites de Stripe', () => {
  const lignes = lignesAFacturer({ lignes: Array.from({ length: LIGNES_MAX }, (_, i) => ({ type: 'agent', fiche: `AG-${String(i + 1).padStart(4, '0')}`, palier: 'expert', quantite: 20 })) });
  const m = metadonnees(lignes);
  assert.ok(Object.keys(m).length <= 50);
  for (const [k, v] of Object.entries(m)) assert.ok(k.length <= 40 && v.length <= 500, k);
});

console.log('Stripe');
await cas('la clé dit le mode, et rien d\'autre n\'est une clé', () => {
  assert.equal(modeDeLaCle('sk_test_abc'), 'test');
  assert.equal(modeDeLaCle('rk_live_abc'), 'reel');
  assert.equal(modeDeLaCle('pk_test_abc'), null, 'une clé publique ne crée pas de session');
  assert.equal(modeDeLaCle(undefined), null);
});
await cas('encodage des formulaires de Stripe', () => {
  const e = encoder({ a: 1, b: { c: 'x', d: [{ e: 2 }] }, z: undefined });
  assert.equal(decodeURIComponent(e.toString()), 'a=1&b[c]=x&b[d][0][e]=2');
});

/** A fake Stripe that keeps what it was sent and remembers what it created. */
function fauxStripe() {
  const appels = [];
  const prix = new Map();
  let taux = null;
  const f = async (url, init) => {
    const u = new URL(url);
    const corps = Object.fromEntries(new URLSearchParams(init.body ?? ''));
    appels.push({ methode: init.method, chemin: u.pathname, corps });
    const rep = (o, statut = 200) => ({ ok: statut < 400, status: statut, json: async () => o });
    if (u.pathname === '/v1/prices' && init.method === 'GET') {
      const id = prix.get(u.searchParams.get('lookup_keys[0]'));
      return rep({ data: id ? [{ id }] : [] });
    }
    if (u.pathname === '/v1/prices') { const id = `price_${prix.size + 1}`; prix.set(corps.lookup_key, id); return rep({ id }); }
    if (u.pathname === '/v1/tax_rates' && init.method === 'GET') return rep({ data: taux ? [{ id: taux, metadata: { iagent: 'tva-fr-20' } }] : [] });
    if (u.pathname === '/v1/tax_rates') { taux = 'txr_1'; return rep({ id: taux }); }
    if (u.pathname === '/v1/checkout/sessions') return rep({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    if (u.pathname.startsWith('/v1/events/')) return rep({ id: u.pathname.split('/').pop(), type: 'checkout.session.completed', data: { object: {} } });
    return rep({ error: { message: 'inconnu' } }, 404);
  };
  return { f, appels };
}

await cas('Checkout hébergé, abonnement mensuel HT, TVA 20 %, retour sur la liste', async () => {
  viderCache();
  const { f, appels } = fauxStripe();
  const lignes = lignesAFacturer({ lignes: [{ type: 'box', offre: 'box-commander-36' }, { type: 'agent', fiche: 'AG-0001', palier: 'essential', quantite: 2 }] });
  const s = await creerSession(client('sk_test_x', f), lignes, { origine: 'https://iagent.agency' });
  assert.equal(s.url.startsWith('https://checkout.stripe.com/'), true);
  const prixCrees = appels.filter((a) => a.chemin === '/v1/prices' && a.methode === 'POST');
  assert.equal(prixCrees.length, 2);
  for (const p of prixCrees) {
    assert.equal(p.corps.currency, 'eur');
    assert.equal(p.corps['recurring[interval]'], 'month');
    assert.equal(p.corps.tax_behavior, 'exclusive');
  }
  assert.deepEqual(prixCrees.map((p) => Number(p.corps.unit_amount)).sort((a, b) => a - b), [essential * 100, box36.mensuel * 100].sort((a, b) => a - b));
  const tva = appels.find((a) => a.chemin === '/v1/tax_rates' && a.methode === 'POST');
  assert.equal(tva.corps.percentage, '20');
  assert.equal(tva.corps.inclusive, 'false');
  const session = appels.find((a) => a.chemin === '/v1/checkout/sessions').corps;
  assert.equal(session.mode, 'subscription');
  assert.equal(session.locale, 'fr');
  assert.equal(session['line_items[1][quantity]'], '2');
  assert.equal(session['line_items[0][tax_rates][0]'], 'txr_1');
  assert.equal(session.success_url, 'https://iagent.agency/recrutement?paiement=reussi&session={CHECKOUT_SESSION_ID}');
  assert.equal(session.cancel_url, 'https://iagent.agency/recrutement?paiement=annule');
  assert.equal(session['subscription_data[metadata][engagement_box_mois]'], '36');
});
await cas('le catalogue Stripe ne se crée qu\'une fois', async () => {
  viderCache();
  const { f, appels } = fauxStripe();
  const lignes = lignesAFacturer({ lignes: [{ type: 'agent', fiche: 'AG-0001', palier: 'essential' }] });
  await creerSession(client('sk_test_x', f), lignes, { origine: 'https://iagent.agency' });
  viderCache(); // another Vercel instance, empty memory
  await creerSession(client('sk_test_x', f), lignes, { origine: 'https://iagent.agency' });
  assert.equal(appels.filter((a) => a.methode === 'POST' && a.chemin === '/v1/prices').length, 1);
  assert.equal(appels.filter((a) => a.methode === 'POST' && a.chemin === '/v1/tax_rates').length, 1);
});

console.log('Webhook');
const secret = 'whsec_banc';
const signe = (corps, t = Math.floor(Date.now() / 1000), s = secret) => `t=${t},v1=${createHmac('sha256', s).update(`${t}.${corps}`).digest('hex')}`;
await cas('signature : bonne acceptée, fausse, vieille ou absente refusée', () => {
  const corps = '{"id":"evt_1"}';
  assert.equal(signatureValide(corps, signe(corps), secret), true);
  assert.equal(signatureValide(corps + ' ', signe(corps), secret), false);
  assert.equal(signatureValide(corps, signe(corps, Math.floor(Date.now() / 1000) - 600), secret), false);
  assert.equal(signatureValide(corps, signe(corps, undefined, 'whsec_autre'), secret), false);
  assert.equal(signatureValide(corps, null, secret), false);
});
await cas('sans secret de signature, seule la copie de Stripe est crue', async () => {
  const { f, appels } = fauxStripe();
  const env = { STRIPE_SECRET_KEY: 'sk_test_x' };
  const e = await evenementVerifie('{"id":"evt_42","type":"faux","data":{"object":{"amount_total":1}}}', null, env, client('sk_test_x', f));
  assert.equal(e.type, 'checkout.session.completed', 'le type vient de Stripe, pas du corps reçu');
  assert.equal(appels.at(-1).chemin, '/v1/events/evt_42');
  assert.equal(await evenementVerifie('{"id":"../balance"}', null, env, client('sk_test_x', f)), null);
  assert.equal(await evenementVerifie('{"id":"evt_1"}', null, {}, null), null, 'sans clé, rien n\'est cru');
});

console.log('Routes');
const routeEtat = await import('../api/paiement/etat.js');
const routeSession = await import('../api/paiement/session.js');
await cas('sans clé : état fermé, la session renvoie vers le devis', async () => {
  delete process.env.STRIPE_SECRET_KEY;
  assert.deepEqual(await routeEtat.GET().json(), { paiement: false, mode: null });
  const r = await routeSession.POST(new Request('https://iagent.agency/api/paiement/session', { method: 'POST', body: '{}' }));
  assert.equal(r.status, 503);
  assert.equal((await r.json()).devis, true);
});
await cas('avec une clé de test : état ouvert en mode test', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_banc';
  assert.deepEqual(await routeEtat.GET().json(), { paiement: true, mode: 'test' });
  const r = await routeSession.POST(new Request('https://iagent.agency/api/paiement/session', { method: 'POST', body: '{"lignes":[]}' }));
  assert.equal(r.status, 400);
  assert.match((await r.json()).erreur, /vide/);
  delete process.env.STRIPE_SECRET_KEY;
});
await cas('retour de paiement : le site ou sa préversion, jamais une adresse tierce', () => {
  const req = (o) => new Request('https://iagent.agency/api/paiement/session', { headers: o ? { origin: o } : {} });
  assert.equal(origineDeRetour(req(), {}), 'https://iagent.agency');
  assert.equal(origineDeRetour(req('https://iagents-git-paiement.vercel.app'), {}), 'https://iagents-git-paiement.vercel.app');
  assert.equal(origineDeRetour(req('https://pirate.example'), {}), 'https://iagent.agency');
  assert.equal(origineDeRetour(req('http://iagent.agency'), {}), 'https://iagent.agency');
});

if (echecs) { console.log(`\n${echecs} faute(s).`); process.exit(1); }
console.log('\nPaiement : tout passe.');
