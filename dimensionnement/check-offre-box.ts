// Bench for the machine offer (max, 25/09/2026). Expectations written by hand; prices are provisional.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFRES, COMMANDEUR, AGENTS_PAR_BOX, AGENTS_SANS_MACHINE_MAX, machineDe, mensualite, coutInstallation, devisParBox, devisPack, conseillerBox } from './offre-box.ts';
import { coutApiMensuel, type PaquetEco } from './economie.ts';
import { tientSur, RESERVE_MEMOIRE_UNIFIEE } from './calculer.ts';
import offreJson from './offre-box.json' with { type: 'json' };

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const tous: PaquetEco[] = readdirSync(join(racine, 'agents')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8')));
const lire = (id: string) => { const p = tous.find((x) => x.id === id); if (!p) throw new Error(`${id} absent`); return p; };
let n = 0; const ok = (m: string) => { n++; console.log('  ok  ' + m); };

// 1. Six installations, in the order max gave them: none, commander, Box Max, three power machines.
assert.deepEqual(OFFRES.map((o) => o.id), ['aucune', 'box-commandeur', 'box-max', 'puissance-1', 'puissance-2', 'puissance-3']);
assert.equal(OFFRES.filter((o) => o.role === 'commande').length, 1);
assert.ok(OFFRES.filter((o) => o.id.startsWith('puissance-')).every((o) => o.avecCommandeur), 'chaque machine de puissance est vendue avec une Box Commandeur');
assert.ok(!OFFRES.find((o) => o.id === 'box-max')!.avecCommandeur, 'la Box Max commande elle-meme ses agents');
ok('six installations : sans machine, Box Commandeur, Box Max, trois machines de puissance livrees avec un commandeur');

// 2. Every power offer carries a machine, and so does the Box since max's decision of 16/10/2026
// (every pro machine has 64 Go); only « sans machine » has none. A unified-memory machine follows
// the repo rule (RAM minus the reserve), never a figure typed by hand.
for (const o of OFFRES) {
  if (o.role === 'aucune') assert.equal(o.machine, null, `${o.id} ne porte aucune puissance`);
  else { const m = machineDe(o); assert.ok(m && m.role === 'bundle', `${o.id} : machine de calcul absente`); }
  if (o.role === 'commande') assert.equal(machineDe(o)!.ram, 64, 'max, 16/10 : toutes les machines pro en 64 Go');
  const m = machineDe(o);
  if (m?.memoireUnifiee) assert.equal(m.vram, m.ram - RESERVE_MEMOIRE_UNIFIEE, `${o.id} : ${m.vram} Go annonces aux modeles pour ${m.ram} Go de memoire unifiee`);
}
ok('chaque Box porte sa machine (64 Go pour la Box), « sans machine » n en a pas ; memoire unifiee = RAM - reserve');

// 3. A confirmed price carries its source and the date it was given. A provisional one says so on every quote.
for (const o of OFFRES) {
  if (!o.aConfirmer && o.prixAchat > 0) assert.ok(o.source && o.lueLe, `${o.id} : prix confirme sans source ni date`);
  const inst = coutInstallation(o);
  if (o.aConfirmer) assert.ok(inst.aConfirmer && devisParBox(lire('AG-0001')).find((l) => l.offre === o.id)!.aConfirmer, `${o.id} : un prix provisoire doit le dire sur le devis`);
}
// Prices stay apart (max, 25/09): a power machine is two lines, its own and the commander's.
const p1 = coutInstallation(OFFRES.find((o) => o.id === 'puissance-1')!);
assert.deepEqual(p1.lignes.map((l) => l.id), ['puissance-1', COMMANDEUR.id], 'machine de puissance : sa ligne puis celle du commandeur');
assert.equal(p1.prixAchat, p1.lignes[0].prixAchat + p1.lignes[1].prixAchat);
assert.ok(p1.lignes.every((l) => l.abonnement > 0), 'chaque box porte son abonnement');
assert.deepEqual(coutInstallation(OFFRES.find((o) => o.id === 'aucune')!).lignes, []);
ok('un prix confirme porte sa source et sa date ; une machine de puissance et son commandeur sont deux lignes, chacune avec son abonnement');

// 4. Financing: 0 % over 24 months is the price divided by 24; a positive rate always costs more.
// The file's rate and term must give back, to the cent, the lease column of max's catalogue.
assert.equal(mensualite(2400, 0, 24), 100);
assert.ok(mensualite(2400, 0.06, 24) > 100 && Math.abs(mensualite(2400, 0.06, 24) - 106.37) < 0.01, `a 6 % : ${mensualite(2400, 0.06, 24)}`);
// The catalogue's lease column is at ITS term (36 months); the shop's term is max's (24 months).
const cat = offreJson.financement.catalogue;
const lignes = [...OFFRES, ...offreJson.autresLignesDuCatalogue.lignes] as { nom: string; prixAchat: number; leasingMensuelHT?: number }[];
for (const l of lignes.filter((l) => l.leasingMensuelHT)) assert.ok(Math.abs(mensualite(l.prixAchat, cat.tauxAnnuel, cat.mois) - l.leasingMensuelHT!) < 0.01, `${l.nom} : ${mensualite(l.prixAchat, cat.tauxAnnuel, cat.mois).toFixed(2)} calcule, ${l.leasingMensuelHT} au catalogue`);
assert.equal(offreJson.financement.mois, 24, 'max, 25/09 : 24 mois');
ok(`financement : 2 400 € sur 24 mois = 100 €/mois a 0 % ; ${lignes.filter((l) => l.leasingMensuelHT).length} mensualites du catalogue (36 mois) retrouvees au centime ; la boutique finance sur 24`);

// 5. Without a machine every agent pays its API price. On the 64 Go Box every agent costs at least
// 40 % less (max, 16/10/2026): the one he quoted, an engineer at 231 € both with and without the
// Box, was the proof that the Box carried no power at all.
const plancher = COMMANDEUR.partLocaleMinimum!.valeur;
assert.equal(plancher, 0.4, 'max, 16/10 : au moins 40 % de gain par agent');
let entiers = 0;
for (const p of tous) for (const l of devisParBox(p)) {
  if (l.offre === 'aucune') assert.ok(!l.enLocal && !l.enPartie && l.coutAgent === l.apiSeule, `${p.id} tourne sans machine`);
  if (l.offre === COMMANDEUR.id) {
    assert.ok(l.coutAgent <= l.apiSeule * (1 - plancher) + 0.01, `${p.id} : ${l.coutAgent} € sur la Box contre ${l.apiSeule} € en API`);
    if (l.enLocal) entiers++;
  }
}
const ingenieur = devisParBox(lire('AG-1458'));
const [sansBox, avecBox] = ['aucune', COMMANDEUR.id].map((id) => ingenieur.find((l) => l.offre === id)!);
assert.ok(avecBox.coutAgent < sansBox.coutAgent, 'AG-1458 coute moins cher avec la Box');
ok(`sur ${tous.length} fiches, chacune coute au moins ${plancher * 100} % de moins sur la Box 64 Go (${entiers} y tiennent en entier) ; ingenieur controle technique : ${sansBox.coutAgent} € sans Box, ${avecBox.coutAgent} € avec`);

// 6. The largest machine holds every fiche alone, and everything a smaller one holds. Between the
// others the ladder is not strict, and the bench REPORTS it rather than refusing: a memory-rich but
// slow machine (Box Max, GB10) holds analysis agents a 24 Go card does not, and a fast card holds
// busy agents the slow ones cannot keep up with. That is a question for max, not a bug.
const echelle = ['box-max', 'puissance-1', 'puissance-2', 'puissance-3'].map((id) => machineDe(OFFRES.find((o) => o.id === id)!)!);
const tenues = echelle.map((m) => tous.filter((p) => tientSur(m, [p])).length);
assert.equal(tenues[3], tous.length, 'la plus grande machine tient chaque fiche seule');
for (const m of echelle.slice(0, 3)) for (const p of tous) if (tientSur(m, [p])) assert.ok(tientSur(echelle[3], [p]), `${p.id} tient sur ${m.id} mais pas sur la plus grande`);
ok(`la machine de puissance 3 tient chaque fiche seule ; Box Max, puissance 1, 2, 3 : ${tenues.join(', ')} fiches tenues seules`);
for (let i = 1; i < 3; i++) {
  const perdues = tous.filter((p) => tientSur(echelle[i - 1], [p]) && !tientSur(echelle[i], [p]));
  if (perdues.length) console.log(`  attention  ${perdues.length} fiches tiennent sur ${echelle[i - 1].nom} et pas sur ${echelle[i].nom}, ex. ${perdues.slice(0, 3).map((p) => p.id).join(', ')}`);
}

// 7. On a machine that holds it, the agent pays only the API share the customer chose.
const sec = devisParBox(lire('AG-0001'));
const api = coutApiMensuel(lire('AG-0001')).total;
for (const l of sec.filter((l) => l.enLocal)) assert.equal(Math.round(l.coutAgent * 100), Math.round(api * 0.2 * 100));
for (const l of sec) assert.equal(l.rembourseSeul, l.mensualite + l.abonnement + l.electricite > 0 && l.economie >= l.mensualite + l.abonnement + l.electricite);
ok(`secretaire : ${sec[0].apiSeule} €/mois en API, ${sec.find((l) => l.offre === 'box-max')!.coutAgent} €/mois sur la Box Max ; « rembourse seul » = economie >= mensualite + abonnement + electricite`);

// 8. A team: never more agents placed than the machine holds; without a machine the total is the API bill.
const equipe = tous.filter((_, i) => i % 50 === 0);
for (const o of OFFRES) {
  const d = devisPack(equipe, o.id);
  assert.equal(d.enLocal.length + d.enApi.length, equipe.length);
  const m = machineDe(o);
  if (m && d.nombreBox <= 1) assert.ok(tientSur(m, equipe.filter((p) => d.enLocal.includes(p.id))), `${o.id} : equipe placee au-dela de la machine`);
  if (o.id === 'aucune') assert.equal(d.totalPendant, d.toutApi);
}
ok(`equipe de ${equipe.length} : placement jamais au-dela de la machine, « sans machine » = facture API`);

// 9. The advice (max, 16/10/2026): a customer's computer does not run a team. No machine only
// for 1 or 2 agents; beyond, the 64 Go Box, one per ten agents. Before, the cheapest-on-paper
// rule advised « sans machine » for every team, 42 agents included.
const parCout = [...tous].sort((a, b) => coutApiMensuel(a).total - coutApiMensuel(b).total);
for (let k = 1; k <= AGENTS_SANS_MACHINE_MAX; k++) assert.equal(conseillerBox(parCout.slice(-k)).conseil.offre, 'aucune', `${k} agent(s) : sans machine`);
for (const k of [3, 5, 10, 11, 42]) {
  const c = conseillerBox(parCout.slice(0, k)).conseil;
  assert.equal(c.offre, COMMANDEUR.id, `${k} agents : la Box`);
  assert.equal(c.nombreBox, Math.ceil(k / AGENTS_PAR_BOX), `${k} agents : ${c.nombreBox} Box`);
  assert.ok(c.api < c.toutApi, `${k} agents : la Box fait baisser la facture d API`);
}
const quarante = conseillerBox(parCout.slice(0, 42)).conseil;
ok(`conseil : 1 ou 2 agents -> sans machine ; 3 a 10 -> une Box ; 42 agents -> ${quarante.nombreBox} Box, ${quarante.api} € d API par mois contre ${quarante.toutApi} € tout par API`);

console.log(`\ncheck-offre-box : ${n} verifications passees`);
