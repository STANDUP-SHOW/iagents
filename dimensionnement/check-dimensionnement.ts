// Bench for the sizing engine against the REAL machine catalogue (AliExpress mini-PCs, iGPU only).
// Expectations are written by hand, never derived from the code under test.
import assert from 'node:assert/strict';
import { materielPour, machinesPourPack, agentsParMachine, appelsParJour, jaugeMachine, diagnosticLocal, MACHINES, type AgentDimension } from './calculer.ts';

const bureau: AgentDimension = { id: 'bureau', modeles: { texte: 'texte-standard', audio: 'audio-parole', embeddings: 'embeddings', activite: 0.15 } };
const analyste: AgentDimension = { id: 'analyste', modeles: { texte: 'texte-avance', audio: 'audio-parole', embeddings: 'embeddings', activite: 0.3 } };
const image: AgentDimension = { id: 'image', modeles: { texte: 'texte-standard', image: 'image-rapide', activite: 0.6 } };
const video: AgentDimension = { id: 'video', modeles: { texte: 'texte-leger', video: 'video', activite: 0.7 } };
const machine = (id: string) => { const m = MACHINES.find((m) => m.id === id); if (!m) throw new Error(`machine ${id} absente du catalogue`); return m; };
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

// 4. Five office agents = two machines (3 + 2), both AM02 Ryzen 7 : 99 €/agent, mieux que le Ryzen 5 a 134 €/agent.
const cinq = Array.from({ length: 5 }, (_, i) => ({ ...bureau, id: `bureau-${i}` }));
const pack = machinesPourPack(cinq);
assert.equal(pack.impossibles.length, 0);
assert.equal(pack.machines.length, 2);
assert.deepEqual(pack.machines.map((m) => m.machine.id), [AM02, AM02]);
assert.equal(pack.prixTotal, 2 * machine(AM02).prixIndicatif);
ok('cinq postes de bureau = deux Firebat AM02, prix total = deux machines');

// 5. An analyst (14B) needs more than 10 Go of model memory: never a 16 Go machine.
const pa = machinesPourPack([analyste]);
assert.equal(pa.impossibles.length, 0);
assert.ok(pa.machines[0].machine.ram >= 24, `analyste place sur ${pa.machines[0].machine.id} (${pa.machines[0].machine.ram} Go)`);
ok('un analyste (modele 14B) va sur une machine de 24 Go ou plus');

// 6. Image and video agents fit on NO machine of this catalogue: they must run through the API.
assert.deepEqual(machinesPourPack([image]).impossibles, ['image']);
assert.deepEqual(machinesPourPack([video]).impossibles, ['video']);
ok('agents image et video : impossibles en local sur ces mini-PC, donc mode API');

// 7. A mixed pack is placed without loss; the impossible ones are reported, the rest is placed.
const mixte = machinesPourPack([...cinq, analyste, image]);
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
const dImage = diagnosticLocal(image);
assert.equal(dImage.possible, false);
assert.equal(dImage.raisons.length, 1, `raisons : ${JSON.stringify(dImage.raisons)}`);
assert.match(dImage.raisons[0], /^puissance/);
assert.match(dImage.configurationNecessaire, /carte graphique dédiée/);
assert.equal(materielPour(image.modeles).gpu.classe, 'dediee-16', 'texte 6 + image-rapide 8 + travail = 15 Go : ni 8 ni 12 Go ne suffisent');
const dVideo = diagnosticLocal(video);
assert.equal(dVideo.possible, false);
assert.ok(dVideo.raisons.some((r) => r.startsWith('puissance')));
assert.equal(materielPour(video.modeles).gpu.classe, 'dediee-16');
const dBureau = diagnosticLocal(bureau);
assert.equal(dBureau.possible, true);
assert.deepEqual(dBureau.raisons, []);
assert.equal(dBureau.machine?.id, 'firebat-am02-ryzen-5-6600h');
ok('un agent hors local dit pourquoi (puissance) et la carte necessaire ; un agent local n a aucune raison');

console.log(`\n${n} attentes tenues — dimensionnement ok`);
