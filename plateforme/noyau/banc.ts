// Banc du noyau iAgent : rejoue les critères d'acceptation de l'ADMIN MASTER (§22)
// que ce lot couvre, par les vraies routes, avec des Box simulées qui signent comme
// des Box réelles. Lancé par plateforme/banc.ts (npm run controle) ou seul :
//   node --experimental-strip-types plateforme/noyau/banc.ts

import { Buffer } from 'node:buffer';
import { traiterRequete, type Reponse, type Socle } from '../http.ts';
import { Stockage } from '../stockage.ts';
import { toutesLesRoutes } from '../assemblage.ts';
import type { Audit, Entitlement, MiseAJour, Tenant } from '../modele.ts';
import { base32, depuisBase32, hotp, totpValide } from './acteurs.ts';
import { BoxSimulee } from './simulateur.ts';
import type { Action, Approbation } from './passerelle.ts';
import type { Commande } from './commandes.ts';
import type { Evenement, Incident } from './evenements.ts';
import { decider } from './politique.ts';
import { CATALOGUE } from './passerelle.ts';

export async function lancer(): Promise<number> {
  let fautes = 0;
  const verifier = (quoi: string, vrai: boolean, detail?: unknown) => {
    if (vrai) console.log(`  ok  ${quoi}`);
    else { fautes++; console.log(`  FAUTE  ${quoi}${detail === undefined ? '' : ` → ${JSON.stringify(detail).slice(0, 400)}`}`); }
  };

  // --- TOTP against the RFC 6238 test vector (SHA-1, T = 59 s → 94287082, six digits 287082)
  const graine = Buffer.from('12345678901234567890', 'ascii');
  verifier('TOTP : vecteur de la RFC 6238 (59 s → 287082)', hotp(graine, 1) === '287082');
  verifier('TOTP : un code de la fenêtre voisine passe, un code faux non', totpValide(graine, '287082', new Date(59_000 + 30_000)) && !totpValide(graine, '000000', new Date(59_000)));
  verifier('base32 : relu à l’identique', base32(graine) === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');

  // --- a platform in memory, a clock we move by hand
  let horloge = new Date('2026-10-14T09:00:00Z');
  const secret = 'secret-de-secours-du-banc-noyau-assez-long';
  const stockage = new Stockage(null);
  const socle: Socle = { reglages: { secretAdmin: secret, fichierDonnees: null }, stockage, maintenant: () => horloge, routes: toutesLesRoutes };
  const appel = (methode: string, url: string, jeton: string | null, corps: unknown = null, entetes: Record<string, string> = {}): Promise<Reponse> =>
    traiterRequete(socle, { methode, url, brut: corps === null ? '' : JSON.stringify(corps), entetes: { 'content-type': 'application/json', ...(jeton ? { authorization: `Bearer ${jeton}` } : {}), ...entetes } });
  const corps = <T>(r: Reponse) => r.corps as T;
  let n = 0;
  const idem = () => `banc-${++n}`;

  // --- Platform creates tenants, Boxes, entitlements (existing Control Plane routes, founder key)
  for (const t of [{ id: 'T-DUPONT', nom: 'Dupont BTP' }, { id: 'T-MARTIN', nom: 'Martin Immobilier' }]) {
    stockage.poser<Tenant>('tenants', t.id, { tenant_id: t.id, nom: t.nom, segment: 'business', pays: 'FR', opt_in_skills: false, cree_le: horloge.toISOString() });
  }
  const dupont = BoxSimulee.nouvelle(1, 'T-DUPONT');
  const martin = BoxSimulee.nouvelle(2, 'T-MARTIN');
  for (const s of [dupont, martin]) stockage.poser('boxes', s.box.device_id, s.box);
  const droit: Entitlement = { id: 'ENT-JULIE', tenant_id: 'T-DUPONT', device_id: dupont.box.device_id, agent_template_id: 'AG-0179', specialisation_id: null, licence: 'professional', statut: 'active', debut: '2026-10-01T00:00:00Z', fin: null };
  stockage.poser('entitlements', droit.id, droit);

  console.log('Identité et rôles');
  verifier('sans jeton : refusé', (await appel('GET', '/v1/moi', null)).statut === 401);
  verifier('clé de secours = acteur Fondateur', corps<{ id: string }>(await appel('GET', '/v1/moi', secret)).id === 'ACT-FONDATEUR');
  const creer = async (d: Record<string, unknown>) => corps<{ acteur: { id: string }; cle: string }>(await appel('POST', '/v1/acteurs', secret, d));
  const humain = (nom: string, role: string, scope = { type: 'GLOBAL', id: null as string | null }) => creer({ type: 'HUMAN', nom_affiche: nom, roles: [{ role, scope }] });
  const fleet = await humain('Inès (flotte)', 'FLEET_ADMIN');
  const fleet2 = await humain('Hugo (flotte)', 'FLEET_ADMIN');
  const ops = await humain('Léa (plateforme)', 'PLATEFORME_OPS');
  const finance = await humain('Paul (finance)', 'FINANCE');
  const laura = await creer({ type: 'AGENT', nom_affiche: 'Laura Support', autonomie: 2, departement: 'support', roles: [{ role: 'SUPPORT_L1', scope: { type: 'TENANT', id: 'T-DUPONT' } }] });
  const vendeur = await creer({ type: 'AGENT', nom_affiche: 'Sales Agent', autonomie: 3, departement: 'sales', roles: [{ role: 'VENTES', scope: { type: 'GLOBAL', id: null } }] });
  const financeAgent = await creer({ type: 'AGENT', nom_affiche: 'Finance Agent', autonomie: 3, departement: 'finance', budgets: { remboursement_max_eur: 50 }, roles: [{ role: 'FINANCE', scope: { type: 'GLOBAL', id: null } }] });
  const balayeur = await creer({ type: 'SERVICE', nom_affiche: 'Balayage', roles: [{ role: 'SERVICE_BALAYAGE', scope: { type: 'GLOBAL', id: null } }] });
  verifier('un acteur reçoit une clé personnelle, une seule fois', typeof fleet.cle === 'string' && fleet.cle.startsWith('iak_'));
  verifier('le rôle FONDATEUR ne se donne pas', (await appel('POST', '/v1/acteurs', secret, { type: 'HUMAN', nom_affiche: 'x', roles: [{ role: 'FONDATEUR', scope: { type: 'GLOBAL', id: null } }] })).statut === 400);
  verifier('aucun acteur listé ne porte sa clé ni son second facteur', !JSON.stringify(corps(await appel('GET', '/v1/acteurs', secret))).match(/cle_empreinte|scelle/));

  const session = async (a: { acteur: { id: string }; cle: string }, code?: string) =>
    corps<{ jeton: string }>(await appel('POST', '/v1/sessions', null, { acteur_id: a.acteur.id, cle: a.cle, ...(code ? { code } : {}) })).jeton;
  verifier('mauvaise clé : refusée', (await appel('POST', '/v1/sessions', null, { acteur_id: fleet.acteur.id, cle: 'iak_faux' })).statut === 401);

  // MFA: enrol, confirm, then sessions need the code
  const sansMfa = await session(fleet);
  const enrol = corps<{ secret: string }>(await appel('POST', '/v1/moi/mfa', sansMfa));
  const code = () => hotp(depuisBase32(enrol.secret), Math.floor(horloge.getTime() / 30_000));
  verifier('second facteur confirmé par un code', (await appel('POST', '/v1/moi/mfa/confirmer', sansMfa, { code: code() })).statut === 200);
  verifier('session sans code refusée une fois le second facteur actif', (await appel('POST', '/v1/sessions', null, { acteur_id: fleet.acteur.id, cle: fleet.cle })).statut === 401);
  const jFleet = await session(fleet, code());
  const mfaPour = async (a: { acteur: { id: string }; cle: string }) => {
    const j = await session(a);
    const e = corps<{ secret: string }>(await appel('POST', '/v1/moi/mfa', j));
    await appel('POST', '/v1/moi/mfa/confirmer', j, { code: hotp(depuisBase32(e.secret), Math.floor(horloge.getTime() / 30_000)) });
    return () => hotp(depuisBase32(e.secret), Math.floor(horloge.getTime() / 30_000));
  };
  const codeFleet2 = await mfaPour(fleet2);
  const jFleet2 = await session(fleet2, codeFleet2());
  const codeOps = await mfaPour(ops);
  const jOps = await session(ops, codeOps());
  const codeFin = await mfaPour(finance);
  const jFinance = await session(finance, codeFin());
  const jLaura = await session(laura);
  const jVendeur = await session(vendeur);
  const jFinAgent = await session(financeAgent);
  const jBalayeur = await session(balayeur);

  console.log('Box simulée : battement, état voulu, réconciliation');
  const t1 = await dupont.tour(socle);
  verifier('la Box simulée bat, lit son état voulu et converge', t1.battement === 200 && t1.convergee, t1);
  await martin.tour(socle);
  const liste = corps<{ elements: { device_id: string; connexion: string }[] }>(await appel('GET', '/v1/devices', jFleet));
  verifier('Fleet voit les deux Box, en ligne', liste.elements.length === 2 && liste.elements.every((l) => l.connexion === 'en_ligne'), liste);
  const jMarc = await session(await humain('Marc (support Martin)', 'SUPPORT_L1', { type: 'TENANT', id: 'T-MARTIN' }));
  const vueMarc = corps<{ elements: { device_id: string }[] }>(await appel('GET', '/v1/devices', jMarc));
  verifier('un acteur limité à un client ne voit que ses Box', vueMarc.elements.length === 1 && vueMarc.elements[0].device_id === martin.box.device_id);
  verifier('la fiche d’une Box ne sort aucune clé', !JSON.stringify(corps(await appel('GET', `/v1/devices/${dupont.box.device_id}`, jFleet))).includes('PUBLIC KEY'));

  console.log('Diagnostic audité');
  const diag = await appel('POST', `/v1/devices/${dupont.box.device_id}/diagnostics`, jFleet, { motif: 'contrôle', idempotence: idem() }, { 'x-correlation-id': 'banc-correlation-diag-1' });
  const actDiag = corps<{ action: Action }>(diag).action;
  verifier('le diagnostic part en file (R1, autorisé)', diag.statut === 200 && actDiag.statut === 'executee', corps(diag));
  await dupont.tour(socle);
  const cmd = stockage.lister<Commande>('commandes', (c) => c.action_id === actDiag.id)[0];
  verifier('la Box relève la commande et rend son résultat', cmd?.statut === 'reussie', cmd);
  const traces = stockage.lister<Audit>('audit', (a) => a.correlation_id === 'banc-correlation-diag-1');
  verifier('chaque étape porte la même corrélation dans l’audit (demande et résultat)', traces.length >= 2 && traces.some((a) => a.acteur_type === 'DEVICE'), traces);
  const memeAction = await appel('POST', `/v1/devices/${dupont.box.device_id}/diagnostics`, jFleet, { motif: 'contrôle', idempotence: `banc-${n}` });
  verifier('même clé d’idempotence : la première réponse, rien de refait', corps<{ deja: boolean; action: Action }>(memeAction).deja && corps<{ action: Action }>(memeAction).action.id === actDiag.id);

  console.log('Agent interne de support via la passerelle');
  const restart = await appel('POST', '/v1/actions', jLaura, { verbe: 'fleet.service.restart', parametres: { device_id: dupont.box.device_id, service: 'commander' }, motif: 'ticket : écran figé', idempotence: idem() });
  verifier('Laura (autonomie 2) redémarre un service de la Box de son client', restart.statut === 200, corps(restart));
  const voix = await appel('POST', '/v1/actions', jLaura, { verbe: 'fleet.service.restart', parametres: { device_id: dupont.box.device_id, service: 'voice' }, motif: 'voix muette', idempotence: idem() });
  verifier('redémarrer la voix est refusé en clair : le service n’est pas encore livré sur iAgent OS', voix.statut === 400 && /pas encore livré/.test(JSON.stringify(voix.corps)), voix.corps);
  const autreClient = await appel('POST', '/v1/actions', jLaura, { verbe: 'fleet.service.restart', parametres: { device_id: martin.box.device_id, service: 'commander' }, motif: 'x', idempotence: idem() });
  verifier('…mais pas sur la Box d’un autre client (403)', autreClient.statut === 403);
  const reset = await appel('POST', '/v1/actions', jLaura, { verbe: 'fleet.device.reset.factory', parametres: { device_id: dupont.box.device_id, motif: 'x' }, motif: 'x', idempotence: idem() });
  verifier('Laura ne peut pas demander une remise à zéro (refus, pas la permission)', reset.statut === 403);
  verifier('un refus publie security.policy_denied', stockage.lister<Evenement>('evenements', (e) => e.type === 'security.policy_denied').length >= 2);

  console.log('Moteur de règles : seuils, autonomie, deux personnes');
  const remise8 = await appel('POST', '/v1/actions', jVendeur, { verbe: 'sales.discount.apply', parametres: { tenant_id: 'T-DUPONT', pourcentage: 8, motif: 'fidélité' }, motif: 'fidélité', idempotence: idem() });
  verifier('remise 8 % sous plafond 10 % : automatique', remise8.statut === 200, corps(remise8));
  verifier('la remise enregistrée dit qu’aucun paiement n’est parti', corps<{ action: Action }>(remise8).action.resultat?.versement === 'non_effectue');
  const remise18 = await appel('POST', '/v1/actions', jVendeur, { verbe: 'sales.discount.apply', parametres: { tenant_id: 'T-DUPONT', pourcentage: 18, motif: 'gros contrat' }, motif: 'gros contrat', idempotence: idem() });
  verifier('remise 18 % : en attente d’approbation', remise18.statut === 202 && corps<{ approbation: Approbation }>(remise18).approbation.requises === 1, corps(remise18));
  const rembourse40 = await appel('POST', '/v1/actions', jFinAgent, { verbe: 'billing.refund.create', parametres: { tenant_id: 'T-DUPONT', montant_eur: 40, motif: 'double prélèvement' }, motif: 'x', idempotence: idem() });
  verifier('remboursement 40 € par l’agent finance (budget 50 €) : automatique', rembourse40.statut === 200, corps(rembourse40));
  const rembourse10k = await appel('POST', '/v1/actions', jFinAgent, { verbe: 'billing.refund.create', parametres: { tenant_id: 'T-DUPONT', montant_eur: 10_000, motif: 'litige' }, motif: 'x', idempotence: idem() });
  const ap10k = corps<{ approbation: Approbation }>(rembourse10k).approbation;
  verifier('remboursement 10 000 € : double approbation humaine (R4)', rembourse10k.statut === 202 && ap10k.risque === 'R4' && ap10k.requises === 2, corps(rembourse10k));
  verifier('une approbation montre son impact', /10000 €|10 000 €|10000/.test(ap10k.impact));
  const dec1 = await appel('POST', `/v1/approbations/${ap10k.id}/decision`, jFinance, { decision: 'approuve', note: 'vu' });
  verifier('première approbation : l’action attend encore', dec1.statut === 200 && corps<{ approbation: Approbation }>(dec1).approbation.statut === 'en_attente');
  const dec1bis = await appel('POST', `/v1/approbations/${ap10k.id}/decision`, jFinance, { decision: 'approuve', note: 'encore' });
  verifier('le même approbateur ne compte pas deux fois', dec1bis.statut === 400);
  const dec2 = await appel('POST', `/v1/approbations/${ap10k.id}/decision`, secret, { decision: 'approuve', note: 'ok fondateur' });
  verifier('deuxième approbation distincte : l’action s’exécute', corps<{ action: Action }>(dec2).action.statut === 'executee', corps(dec2));

  console.log('Action critique : attente, règle des deux personnes');
  const resetHumain = await appel('POST', `/v1/devices/${dupont.box.device_id}/commands`, jFleet, { type: 'factory_reset', parametres: { motif: 'Box revendue' }, motif: 'Box revendue', idempotence: idem() });
  const apReset = corps<{ approbation: Approbation }>(resetHumain).approbation;
  verifier('remise à zéro demandée par un humain : une autre personne doit approuver', resetHumain.statut === 202 && apReset.requises === 1);
  verifier('aucune commande ne part avant l’approbation', !stockage.lister<Commande>('commandes', (c) => c.type === 'factory_reset').length);
  verifier('le demandeur ne peut pas approuver sa propre demande', (await appel('POST', `/v1/approbations/${apReset.id}/decision`, jFleet, { decision: 'approuve', note: 'moi' })).statut === 400);
  const jSansMfa = await session(await humain('Zoé (flotte, sans second facteur)', 'FLEET_ADMIN'));
  verifier('approuver demande un second facteur', (await appel('POST', `/v1/approbations/${apReset.id}/decision`, jSansMfa, { decision: 'approuve', note: 'x' })).statut === 400);
  verifier('…et agir en R2 aussi', (await appel('POST', `/v1/devices/${dupont.box.device_id}/commands`, jSansMfa, { type: 'update', parametres: { composant: 'desktop', version: '0.2.2' }, motif: 'x', idempotence: idem() })).statut === 403);
  const okReset = await appel('POST', `/v1/approbations/${apReset.id}/decision`, jFleet2, { decision: 'approuve', note: 'confirmé avec le client' });
  verifier('approuvée par une deuxième personne : la commande part', corps<{ action: Action }>(okReset).action.statut === 'executee' && stockage.lister<Commande>('commandes', (c) => c.type === 'factory_reset').length === 1);
  const apExpire = corps<{ approbation: Approbation }>(await appel('POST', `/v1/devices/${dupont.box.device_id}/commands`, jFleet, { type: 'restart_box', motif: 'x', idempotence: idem() }));
  verifier('redémarrer une Box (R3) : autorisé à un humain avec second facteur', apExpire.approbation === null);

  console.log('Mise à jour signée et état voulu');
  stockage.poser<MiseAJour>('mises_a_jour', 'desktop:stable:0.2.2', { id: 'desktop:stable:0.2.2', composant: 'desktop', version: '0.2.2', canal: 'stable', url: 'https://exemple.invalid/p.deb', empreinte: 'a'.repeat(64), signature: 'sig', publiee_le: horloge.toISOString() });
  const maj = await appel('POST', `/v1/devices/${dupont.box.device_id}/commands`, jFleet, { type: 'update', parametres: { composant: 'desktop', version: '0.2.2' }, motif: 'correctif', idempotence: idem() });
  verifier('mise à jour vers une version publiée : commande et état voulu changés', maj.statut === 200 && typeof corps<{ action: Action }>(maj).action.resultat?.etat_voulu_version === 'number', corps(maj));
  verifier('mise à jour vers une version non publiée : refusée', (await appel('POST', `/v1/devices/${dupont.box.device_id}/commands`, jFleet, { type: 'update', parametres: { composant: 'desktop', version: '9.9.9' }, motif: 'x', idempotence: idem() })).statut === 422);
  const conv1 = corps<{ convergence: { convergee: boolean; ecarts: unknown[] } }>(await appel('GET', `/v1/devices/${dupont.box.device_id}/desired-state`, jFleet));
  verifier('avant son tour, la Box n’a pas convergé (écart de version visible)', !conv1.convergence.convergee && conv1.convergence.ecarts.length === 1, conv1);
  await dupont.tour(socle);

  console.log('Suspension d’un agent : droit modifié, Box convergente');
  const susp = await appel('POST', `/v1/agents/${droit.id}/suspend`, jOps, { motif: 'impayé confirmé', idempotence: idem() });
  verifier('suspendre un agent (R3, humain avec second facteur)', susp.statut === 200, corps(susp));
  verifier('le droit d’exécution passe « suspendue »', stockage.lire<Entitlement>('entitlements', droit.id)?.statut === 'suspendue');
  const voulu = corps<{ etat_voulu: { voulu: { agents: Record<string, { consigne: string }> } }; convergence: { convergee: boolean } }>(await appel('GET', `/v1/devices/${dupont.box.device_id}/desired-state`, jFleet));
  verifier('l’état voulu demande à la Box de retenir l’agent (HOLD)', voulu.etat_voulu.voulu.agents[droit.id]?.consigne === 'HOLD' && !voulu.convergence.convergee);
  const t2 = await dupont.tour(socle);
  verifier('la Box s’aligne et converge', t2.convergee);
  verifier('device.converged est publié', stockage.lister<Evenement>('evenements', (e) => e.type === 'device.converged').length >= 1);
  verifier('mettre fin puis relancer : refusé par le cycle de vie', (await appel('POST', `/v1/agents/${droit.id}/terminate`, jOps, { motif: 'fin', idempotence: idem() })).statut === 200
    && (await appel('POST', `/v1/agents/${droit.id}/resume`, jOps, { motif: 'x', idempotence: idem() })).statut === 422);
  verifier('rien n’est effacé à la fin du contrat : le droit reste, révoqué', stockage.lire<Entitlement>('entitlements', droit.id)?.statut === 'revoquee');

  console.log('Hors ligne, incident, retour');
  horloge = new Date(horloge.getTime() + 10 * 60_000);
  await martin.tour(socle);
  const bal = await appel('POST', '/v1/balayage', jBalayeur);
  verifier('le balayage voit la Box Dupont hors ligne', corps<{ changements_connexion: number }>(bal).changements_connexion === 1, corps(bal));
  const inc = stockage.lister<Incident>('incidents', (i) => i.ressource === dupont.box.device_id)[0];
  verifier('device.offline ouvre un incident flotte (DETECTED)', inc?.etat === 'DETECTED' && inc.domaine === 'fleet');
  await appel('POST', '/v1/balayage', jBalayeur);
  verifier('un second balayage n’ouvre pas un second incident', stockage.lister<Incident>('incidents', (i) => i.ressource === dupont.box.device_id).length === 1);
  await dupont.tour(socle);
  verifier('le retour de la Box passe l’incident en surveillance', stockage.lire<Incident>('incidents', inc.id)?.etat === 'MONITORING');
  verifier('Laura (agent) ne lance pas un balayage', (await appel('POST', '/v1/balayage', jLaura)).statut === 403);

  console.log('Jetons et expirations');
  horloge = new Date(horloge.getTime() + 16 * 60_000);
  verifier('le jeton d’un agent meurt après 15 minutes', (await appel('GET', '/v1/moi', jLaura)).statut === 401);
  horloge = new Date(horloge.getTime() + 25 * 3600_000);
  const ap18 = corps<{ approbation: Approbation }>(remise18).approbation;
  const fresh = await session(fleet, code());
  await appel('GET', '/v1/approbations', fresh);
  verifier('une approbation non tranchée expire avec son action', stockage.lire<Approbation>('approbations', ap18.id)?.statut === 'expiree' && stockage.lire<Action>('actions', corps<{ action: Action }>(remise18).action.id)?.statut === 'expiree');
  const suspendre = await appel('POST', `/v1/acteurs/${laura.acteur.id}/statut`, secret, { statut: 'suspendu', motif: 'banc' });
  verifier('suspendre un acteur révoque ses jetons', suspendre.statut === 200 && (await appel('POST', '/v1/sessions', null, { acteur_id: laura.acteur.id, cle: laura.cle })).statut === 401);

  console.log('Règles pures et contrat');
  const autonomie0 = decider({ acteur: { id: 'a', type: 'AGENT', statut: 'actif', nom_affiche: 'Obs', roles: [{ role: 'FLEET_L1', scope: { type: 'GLOBAL', id: null } }], autonomie: 0, departement: null, manager_id: null, budgets: {}, cle_empreinte: null, mfa: null, cree_le: '', cree_par: '' }, mfa: false, secours: false },
    CATALOGUE['fleet.device.diagnostic'], {}, { device_id: 'X' });
  verifier('autonomie 0 : un agent ne fait que lire', autonomie0.verdict === 'DENY');
  const contrat = corps<{ openapi: string; paths: Record<string, unknown> }>(await appel('GET', '/v1/openapi.json', null));
  verifier('le contrat OpenAPI 3.1 décrit chaque route du noyau', contrat.openapi === '3.1.0' && Object.keys(contrat.paths).length >= 25);
  verifier('aucune trace d’audit ne porte un jeton ou une clé', !stockage.lister<Audit>('audit').some((a) => /iat_|iak_|BEGIN/.test(JSON.stringify(a))));
  const sansCorrelation = stockage.lister<Audit>('audit', (a) => a.action.includes('.') && a.acteur_type !== undefined && !a.correlation_id && !a.action.startsWith('core.actor'));
  verifier('chaque action passée par la passerelle a sa corrélation', sansCorrelation.length === 0, sansCorrelation.slice(0, 3));

  return fautes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = await lancer();
  if (f > 0) { console.log(`\n${f} faute(s).`); process.exit(1); }
  console.log('\nNoyau : tout passe.');
}
