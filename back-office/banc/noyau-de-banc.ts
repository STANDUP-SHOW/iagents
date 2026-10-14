// The admin core's answers for the consoles' bench, produced by the REAL core
// (plateforme/noyau/) and never written by hand: a small fleet of simulated
// Boxes with their own Ed25519 keys, a few actors, an action executed, two
// waiting for approval, a Box gone silent and the incident it opened. Each
// GET the consoles read is then asked through the same `traiterRequete` both
// platform doors use, with the founder's break-glass key (= JETON_DE_BANC, the
// back-office token), and kept by « METHOD path ».
//
//   node --experimental-strip-types back-office/banc/noyau-de-banc.ts
// writes banc/noyau.genere.json, read by banc/rendu.jsx (`npm run banc` runs it first).
// If the core changes the shape of an answer, the screens are rendered on the new shape.
import { writeFileSync } from 'node:fs';
import { traiterRequete, type Reponse, type Socle } from '../../plateforme/http.ts';
import { Stockage } from '../../plateforme/stockage.ts';
import { toutesLesRoutes } from '../../plateforme/assemblage.ts';
import type { Entitlement, MiseAJour, Tenant } from '../../plateforme/modele.ts';
import { BoxSimulee } from '../../plateforme/noyau/simulateur.ts';
import { JETON_DE_BANC } from './donnees-de-banc.mjs';

export async function monde({ stockage = new Stockage(null), depart = new Date('2026-10-14T08:00:00Z') }: { stockage?: Stockage; depart?: Date } = {}): Promise<{ reponses: Record<string, unknown>; ids: Record<string, string> }> {
  let horloge = depart;
  const socle: Socle = { reglages: { secretAdmin: JETON_DE_BANC, fichierDonnees: null }, stockage, maintenant: () => horloge, routes: toutesLesRoutes };
  const appel = (methode: string, url: string, jeton: string | null, corps: unknown = null): Promise<Reponse> =>
    traiterRequete(socle, { methode, url, brut: corps === null ? '' : JSON.stringify(corps), entetes: { 'content-type': 'application/json', ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) } });
  const exiger = async (quoi: string, r: Promise<Reponse>, attendu: number[] = [200, 201, 202]) => {
    const x = await r;
    if (!attendu.includes(x.statut)) throw new Error(`noyau de banc : ${quoi} → ${x.statut} ${JSON.stringify(x.corps)}`);
    return x.corps as Record<string, any>;
  };
  let n = 0;
  const idem = () => `console-banc-${++n}`;

  for (const [id, nom] of [['T-BOULANGERIE', 'Boulangerie Martin (banc)'], ['T-CABINET', 'Cabinet Roux Avocats (banc)']]) {
    stockage.poser<Tenant>('tenants', id, { tenant_id: id, nom, segment: 'business', pays: 'FR', opt_in_skills: false, cree_le: horloge.toISOString() });
  }
  const fournil = BoxSimulee.nouvelle(1, 'T-BOULANGERIE');
  const cabinet = BoxSimulee.nouvelle(2, 'T-CABINET');
  const neuve = BoxSimulee.nouvelle(3, 'T-CABINET', 'home');
  for (const s of [fournil, cabinet, neuve]) stockage.poser('boxes', s.box.device_id, s.box);
  const droit: Entitlement = { id: 'ENT-JULIE', tenant_id: 'T-BOULANGERIE', device_id: fournil.box.device_id, agent_template_id: 'AG-0179', specialisation_id: null, licence: 'professional', statut: 'active', debut: '2026-10-01T00:00:00Z', fin: null };
  stockage.poser('entitlements', droit.id, droit);
  const maj: MiseAJour = { id: 'desktop:stable:0.2.2', composant: 'desktop', version: '0.2.2', canal: 'stable', url: 'https://plateforme.iagent.agency/maj/desktop-0.2.2.deb', empreinte: 'a'.repeat(64), signature: 'signature-de-banc', publiee_le: horloge.toISOString() };
  stockage.poser('mises_a_jour', maj.id, maj);

  // Actors: two humans, a support agent and a sales agent.
  const creer = (d: Record<string, unknown>) => exiger(`créer ${String(d.nom_affiche)}`, appel('POST', '/v1/acteurs', JETON_DE_BANC, d));
  const ines = await creer({ type: 'HUMAN', nom_affiche: 'Inès (flotte, banc)', departement: 'flotte', roles: [{ role: 'FLEET_ADMIN', scope: { type: 'GLOBAL', id: null } }] });
  await creer({ type: 'HUMAN', nom_affiche: 'Paul (finance, banc)', departement: 'finance', roles: [{ role: 'FINANCE', scope: { type: 'GLOBAL', id: null } }] });
  const laura = await creer({ type: 'AGENT', nom_affiche: 'Laura Support (banc)', autonomie: 2, departement: 'support', roles: [{ role: 'SUPPORT_L1', scope: { type: 'TENANT', id: 'T-BOULANGERIE' } }] });
  const vendeur = await creer({ type: 'AGENT', nom_affiche: 'Hugo Ventes (banc)', autonomie: 3, departement: 'ventes', roles: [{ role: 'VENTES', scope: { type: 'GLOBAL', id: null } }] });
  const session = async (a: Record<string, any>) => (await exiger('session', appel('POST', '/v1/sessions', null, { acteur_id: a.acteur.id, cle: a.cle }))).jeton as string;

  // The fleet talks: two Boxes converge, the third has never been seen.
  await fournil.tour(socle);
  await cabinet.tour(socle);

  // Founder runs a diagnostic; Laura restarts a service on her client's Box.
  await exiger('diagnostic', appel('POST', `/v1/devices/${fournil.box.device_id}/diagnostics`, JETON_DE_BANC, { motif: 'Lenteur signalée au téléphone', idempotence: idem() }));
  await exiger('redémarrage de service', appel('POST', `/v1/devices/${fournil.box.device_id}/commands`, await session(laura), { type: 'restart_service', parametres: { service: 'iagent-commander' }, motif: 'Écran figé chez le client', idempotence: idem() }));
  await fournil.tour(socle);

  // Two requests wait for a human: a discount above the agent's ceiling, a factory reset by a human (R4).
  await exiger('remise 18 %', appel('POST', '/v1/actions', await session(vendeur), { verbe: 'sales.discount.apply', parametres: { tenant_id: 'T-BOULANGERIE', pourcentage: 18, motif: 'Contrat de trois boutiques' }, motif: 'Contrat de trois boutiques', idempotence: idem() }), [202]);
  // Inès has no second factor yet: the factory reset is asked by the founder, so another human must approve it.
  await exiger('remise à zéro', appel('POST', `/v1/devices/${cabinet.box.device_id}/commands`, JETON_DE_BANC, { type: 'factory_reset', parametres: { motif: 'Box rendue par le cabinet' }, motif: 'Box rendue par le cabinet', idempotence: idem() }), [202]);

  // The cabinet's Box falls silent: four minutes later the sweep sees it offline and opens an incident.
  horloge = new Date(horloge.getTime() + 4 * 60_000);
  await fournil.appeler(socle, 'POST', '/v1/box/battement', { uptime_s: 4000 });
  await exiger('balayage', appel('POST', '/v1/balayage', JETON_DE_BANC, {}));
  horloge = new Date(horloge.getTime() + 30_000);

  const reponses: Record<string, unknown> = {};
  const lire = async (chemin: string) => { reponses[`GET ${chemin}`] = await exiger(`lire ${chemin}`, appel('GET', chemin, JETON_DE_BANC), [200]); };
  for (const c of ['/v1/moi', '/v1/registre', '/v1/vue-ensemble', '/v1/devices', '/v1/approbations', '/v1/incidents', '/v1/acteurs', '/v1/actions', '/v1/evenements', '/v1/audit']) await lire(c);
  for (const s of [fournil, cabinet, neuve]) await lire(`/v1/devices/${s.box.device_id}`);
  return { reponses, ids: { fournil: fournil.box.device_id, cabinet: cabinet.box.device_id, neuve: neuve.box.device_id, ines: ines.acteur.id, laura: laura.acteur.id } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = await monde();
  writeFileSync(new URL('./noyau.genere.json', import.meta.url), JSON.stringify(m, null, 1) + '\n');
  console.log(`noyau de banc : ${Object.keys(m.reponses).length} réponses du vrai noyau écrites dans banc/noyau.genere.json`);
}
