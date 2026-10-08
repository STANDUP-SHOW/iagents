// Banc commun de la plateforme : le socle (stockage, authentification) puis le
// banc de chaque module, s'il existe. Lancé par `npm run controle`.
import { generateKeyPairSync, sign } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { creerPlateforme, messageASigner, ok, type Route } from './serveur.ts';
import { Stockage } from './stockage.ts';
import type { Box } from './modele.ts';

let fautes = 0;
function verifier(quoi: string, vrai: boolean): void {
  if (vrai) console.log(`  ok  ${quoi}`);
  else { fautes++; console.log(`  FAUTE  ${quoi}`); }
}

console.log('Socle de la plateforme');
const s = new Stockage(null);
s.poser('boxes', 'b1', { tenant_id: 't1', x: 1 });
s.poser('boxes', 'b2', { tenant_id: 't2', x: 2 });
const vue = s.pourTenant('t1');
verifier('un tenant ne voit que ses documents', vue.lister('boxes').length === 1);
verifier("un tenant ne lit pas le document d'un autre", vue.lire('boxes', 'b2') === null);
let refuse = false;
try { vue.poser('boxes', 'b3', { tenant_id: 't2' }); } catch { refuse = true; }
verifier("un tenant n'écrit pas pour un autre", refuse);

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const box: Box = {
  device_id: 'BOX-1', tenant_id: 't1', serial: 'SN1', gamme: 'business', os: 'ubuntu-core',
  identite_publique: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  version_desktop: '0.2.1', statut: 'active', plan_id: null, sante: null, garantie_jusqu_au: null,
};
s.poser('boxes', box.device_id, box);
const routeTest: Route[] = [
  { methode: 'GET', chemin: '/test/admin', acces: 'admin', traiter: () => ok({ ok: true }) },
  { methode: 'POST', chemin: '/test/box/:x', acces: 'box', traiter: (c) => ok({ box: c.box?.device_id, x: c.params.x }) },
];
const secret = 'secret-admin-de-banc-assez-long';
const { serveur } = creerPlateforme({ secretAdmin: secret, fichierDonnees: null }, { stockage: s, routes: routeTest });
await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;

verifier('admin sans jeton refusé', (await fetch(`${base}/test/admin`)).status === 401);
verifier('admin avec mauvais jeton refusé', (await fetch(`${base}/test/admin`, { headers: { authorization: 'Bearer faux' } })).status === 401);
verifier('admin avec jeton accepté', (await fetch(`${base}/test/admin`, { headers: { authorization: `Bearer ${secret}` } })).status === 200);

const appelBox = async (corps: string, h: string, modifier?: (sig: string) => string) => {
  const sig = sign(null, Buffer.from(messageASigner('POST', '/test/box/42', h, corps)), privateKey).toString('base64');
  return fetch(`${base}/test/box/42`, {
    method: 'POST', body: corps,
    headers: { 'x-box-id': 'BOX-1', 'x-horodatage': h, 'x-signature': modifier ? modifier(sig) : sig },
  });
};
const maintenant = new Date().toISOString();
const r = await appelBox('{"a":1}', maintenant);
verifier('Box signée acceptée', r.status === 200 && (await r.json()).box === 'BOX-1');
verifier('Box au corps modifié refusée', (await fetch(`${base}/test/box/42`, {
  method: 'POST', body: '{"a":2}',
  headers: { 'x-box-id': 'BOX-1', 'x-horodatage': maintenant,
    'x-signature': sign(null, Buffer.from(messageASigner('POST', '/test/box/42', maintenant, '{"a":1}')), privateKey).toString('base64') },
})).status === 401);
verifier('Box à horodatage ancien refusée (rejeu)', (await appelBox('{}', new Date(Date.now() - 3600_000).toISOString())).status === 401);
s.poser('boxes', 'BOX-1', { ...box, statut: 'suspendue' });
verifier('Box suspendue refusée', (await appelBox('{}', new Date().toISOString())).status === 403);
serveur.close();

for (const m of ['controle', 'voix', 'create', 'tarifs']) {
  const chemin = new URL(`./${m}/banc.ts`, import.meta.url);
  if (existsSync(chemin)) {
    console.log(`\nModule ${m}`);
    const { lancer } = await import(chemin.href);
    fautes += await lancer();
  }
}

if (fautes > 0) { console.log(`\n${fautes} faute(s).`); process.exit(1); }
console.log('\nPlateforme : tout passe.');
