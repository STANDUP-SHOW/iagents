// Bench for the sizing engine against the REAL machine catalogue (AliExpress mini-PCs, iGPU only).
// Expectations are written by hand, never derived from the code under test.
import assert from 'node:assert/strict';
import { materielPour, machinesPourPack, agentsParMachine, appelsParJour, jaugeMachine, diagnosticLocal, kitClient, MACHINES, BUNDLES, POSTES, type AgentDimension } from './calculer.ts';

const bureau: AgentDimension = { id: 'bureau', modeles: { texte: 'texte-standard', audio: 'audio-parole', embeddings: 'embeddings', activite: 0.15 } };
const analyste: AgentDimension = { id: 'analyste', modeles: { texte: 'texte-avance', audio: 'audio-parole', embeddings: 'embeddings', activite: 0.3 } };
const image: AgentDimension = { id: 'image', modeles: { texte: 'texte-standard', image: 'image-rapide', activite: 0.6 } };
const video: AgentDimension = { id: 'video', modeles: { texte: 'texte-leger', video: 'video', activite: 0.7 } };
const machine = (id: string) => { const m = MACHINES.find((m) => m.id === id); if (!m) throw new Error(`machine ${id} absente du catalogue`); return m; };
const MINIS = BUNDLES.filter((m) => m.gamme === 'S' && !m.id.startsWith('bundle-jetson'));
const AM02 = 'firebat-am02-ryzen-7-h255';

let n = 0;
const ok = (msg: string) => { n++; console.log('  ok  ' + msg); };

// 1. One office agent: modest hardware, low continuous load.
const m1 = materielPour(bureau.modeles);
assert.equal(m1.vram, 7, 'texte 6 + memoire de travail 0,5, arrondi au-dessus ; audio et embeddings sur CPU');
assert.ok(m1.chargeContinue < 0.1, `charge ${m1.chargeContinue} attendue < 0,1`);
assert.equal(m1.gpu.classe, 'integre');
ok('un poste de bureau demande 7 Go pour ses modeles, moins de 10 % de charge, un GPU integre suffit');

// 2. One office agent alone goes on the cheapest machine that holds it: the Firebat AM02 Ryzen 5 6600H (~268 €).
const seul = machinesPourPack([bureau]);
assert.equal(seul.impossibles.length, 0);
assert.equal(seul.machines[0].machine.id, 'firebat-am02-ryzen-5-6600h', `obtenu ${seul.machines[0].machine.id}`);
ok('un poste de bureau seul va sur la machine la moins chere qui le tient : Firebat AM02 Ryzen 5');

// 3. Shared weights: three office agents on one AM02 (memory 6,5 Go once ; load 3 × 0,057 ≤ 0,20), the fourth does not fit.
assert.equal(agentsParMachine(machine(AM02), bureau), 3);
ok('un Firebat AM02 fait tourner 3 postes de bureau 24h/24, pas 4 : c est la charge du 780M qui borne');

// 4. Five office agents = two machines (3 + 2) : le cout par agent restant a placer decide.
const cinq = Array.from({ length: 5 }, (_, i) => ({ ...bureau, id: `bureau-${i}` }));
const pack = machinesPourPack(cinq);
assert.equal(pack.impossibles.length, 0);
assert.equal(pack.machines.length, 2);
assert.deepEqual(pack.machines.map((m) => m.machine.id), [AM02, 'firebat-am02-ryzen-5-6600h'], 'Ryzen 7 pour les trois premiers (90 €/agent), Ryzen 5 pour les deux derniers (134 € contre 136)');
assert.equal(pack.prixTotal, machine(AM02).prixIndicatif + machine('firebat-am02-ryzen-5-6600h').prixIndicatif);
ok('cinq postes de bureau = deux Firebat AM02 (Ryzen 7 puis Ryzen 5), prix total = deux machines');

// 5. An analyst (14B) needs more than 10 Go of model memory: never a 16 Go machine.
const pa = machinesPourPack([analyste]);
assert.equal(pa.impossibles.length, 0);
assert.ok(pa.machines[0].machine.ram >= 24, `analyste place sur ${pa.machines[0].machine.id} (${pa.machines[0].machine.ram} Go)`);
ok('un analyste (modele 14B) va sur une machine de 24 Go ou plus');

// 6. Image and video agents fit on NO mini-PC (integrated GPU): on the minis alone they must run through the API.
assert.deepEqual(machinesPourPack([image], MINIS).impossibles, ['image']);
assert.deepEqual(machinesPourPack([video], MINIS).impossibles, ['video']);
// With the brain bundles, image goes on the first 16 Go dedicated card (gamme M) and video on gamme L.
const pi = machinesPourPack([image]); const pvid = machinesPourPack([video]);
assert.equal(pi.impossibles.length, 0); assert.equal(pi.machines[0].machine.gamme, 'M', `image sur ${pi.machines[0].machine.id}`);
assert.equal(pvid.impossibles.length, 0); assert.equal(pvid.machines[0].machine.gamme, 'L', `video sur ${pvid.machines[0].machine.id}`);
ok('image et video : impossibles sur les mini-PC seuls, bundle M (16 Go dedies) pour l image, bundle L pour la video');

// 7. A mixed pack on the minis only: the impossible one is reported, the rest is placed once each.
const mixte = machinesPourPack([...cinq, analyste, image], MINIS);
assert.deepEqual(mixte.impossibles, ['image']);
assert.equal(mixte.machines.flatMap((m) => m.agents).length, 6, 'chaque agent possible est place exactement une fois');
assert.equal(mixte.prixTotal, mixte.machines.reduce((s, m) => s + m.machine.prixIndicatif, 0));
ok('un pack mixte est place sans perte et l agent impossible est signale');

// 8. Unknown tier fails loudly.
assert.throws(() => materielPour({ texte: 'texte-geant' as never, activite: 0.5 }), /Palier inconnu/);
ok('un palier inconnu leve une erreur claire');

// 9. Calls per day follow the schedule; inactive tasks do not count.
assert.equal(appelsParJour([
  { planification: { type: 'quotidienne' }, active: true },
  { planification: { type: 'intervalle', minutes: 30 }, active: true },
  { planification: { type: 'declencheur' }, active: true },
  { planification: { type: 'a-la-demande' }, active: true },
  { planification: { type: 'intervalle', minutes: 5 }, active: false },
]), 1 + 48 + 20 + 5);
ok('les appels par jour suivent la planification et ignorent les taches inactives');

// 10. The gauge tells the user what to do, in the right order.
const trois = cinq.slice(0, 3), quatre = cinq.slice(0, 4);
assert.equal(jaugeMachine(machine(AM02), [bureau]).jauge, 'confortable');
assert.equal(jaugeMachine(machine(AM02), trois).jauge, 'chargee');
assert.equal(jaugeMachine(machine(AM02), quatre).jauge, 'saturee');
assert.equal(jaugeMachine(machine(AM02), [video]).jauge, 'impossible');
assert.match(jaugeMachine(machine(AM02), [video]).message, /mode API/);
ok('la jauge distingue confortable / chargee / saturee / impossible et renvoie vers le mode API');

// 11. An agent kept off local says why and which configuration it needs; a local one has no reason.
const dImage = diagnosticLocal(image, MINIS);
assert.equal(dImage.possible, false);
assert.equal(dImage.raisons.length, 1, `raisons : ${JSON.stringify(dImage.raisons)}`);
assert.match(dImage.raisons[0], /^puissance/);
assert.match(dImage.configurationNecessaire, /carte graphique dédiée/);
assert.equal(materielPour(image.modeles).gpu.classe, 'dediee-16', 'texte 6 + image-rapide 8 + travail = 15 Go : ni 8 ni 12 Go ne suffisent');
const dVideo = diagnosticLocal(video, MINIS);
assert.equal(dVideo.possible, false);
assert.ok(dVideo.raisons.some((r) => r.startsWith('puissance')));
assert.equal(materielPour(video.modeles).gpu.classe, 'dediee-16');
const dBureau = diagnosticLocal(bureau);
assert.equal(dBureau.possible, true);
assert.deepEqual(dBureau.raisons, []);
assert.equal(dBureau.machine?.id, 'firebat-am02-ryzen-5-6600h');
ok('un agent hors local dit pourquoi (puissance) et la carte necessaire ; un agent local n a aucune raison');

// 12. Fleets: 20 office agents land on ONE gamme L bundle, 50 on gamme L/XL bundles, never on a pile of mini-PCs.
const vingt = Array.from({ length: 20 }, (_, i) => ({ ...bureau, id: `b${i}` }));
const p20 = machinesPourPack(vingt);
assert.equal(p20.impossibles.length, 0);
assert.equal(p20.machines.length, 1, `20 agents sur ${p20.machines.length} machine(s) : ${p20.machines.map((m) => m.machine.id).join(', ')}`);
assert.equal(p20.machines[0].machine.gamme, 'L');
const cinquante = Array.from({ length: 50 }, (_, i) => ({ ...bureau, id: `c${i}` }));
const p50 = machinesPourPack(cinquante);
assert.equal(p50.impossibles.length, 0);
assert.ok(p50.machines.length <= 3, `50 agents sur ${p50.machines.length} machines`);
assert.ok(p50.machines.every((m) => ['L', 'XL'].includes(m.machine.gamme)), p50.machines.map((m) => m.machine.id).join(', '));
ok(`flottes : 20 postes de bureau = 1 bundle L ; 50 = ${p50.machines.length} bundles L/XL (${p50.prixTotal} €)`);

// 13. Two agents still get the cheap mini-PC: a fleet bundle is never forced on a small customer.
const p2 = machinesPourPack(cinq.slice(0, 2));
assert.equal(p2.machines.length, 1);
assert.equal(p2.machines[0].machine.gamme, 'S');
ok('deux agents restent sur un mini-PC de gamme S');

// 14. The Jetson appliance is never chosen on price: same throughput as a 780M mini-PC for 3,5× the price.
const surJetson = machinesPourPack([...vingt, ...cinquante]).machines.some((m) => m.machine.id.startsWith('bundle-jetson'));
assert.equal(surJetson, false);
ok('le Jetson n est jamais retenu sur le prix (meme debit qu un mini-PC 780M)');

// 15. Customer kit = bundles + postes, postes never carry agents.
const kit = kitClient(cinq, 5);
assert.equal(kit.postes.nombre, 5);
assert.equal(kit.postes.machine.role, 'poste');
assert.equal(kit.prixKit, kit.prixTotal + 5 * POSTES[0].prixIndicatif);
assert.ok(kit.machines.every((m) => m.machine.role === 'bundle'));
ok('un kit client = bundles cerveau + postes ; un poste ne porte jamais d agent');

console.log(`\n${n} attentes tenues — dimensionnement ok`);
