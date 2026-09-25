// Bench for the machine offer (max, 25/09/2026). Expectations written by hand; prices are provisional.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFRES, COMMANDEUR, machineDe, mensualite, coutInstallation, devisParBox, devisPack, conseillerBox } from './offre-box.ts';
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

// 2. Every power offer carries a machine, none other does; a unified-memory machine follows the
// repo rule (RAM minus the reserve), never a figure typed by hand.
for (const o of OFFRES) {
  if (o.role === 'puissance') { const m = machineDe(o); assert.ok(m && m.role === 'bundle', `${o.id} : machine de calcul absente`); }
  else assert.equal(o.machine, null, `${o.id} ne porte aucune puissance`);
  const m = machineDe(o);
  if (m?.memoireUnifiee) assert.equal(m.vram, m.ram - RESERVE_MEMOIRE_UNIFIEE, `${o.id} : ${m.vram} Go annonces aux modeles pour ${m.ram} Go de memoire unifiee`);
}
ok('chaque machine de puissance porte sa machine, ni « sans machine » ni le commandeur n en ont ; memoire unifiee = RAM - reserve');

// 3. A confirmed price carries its source and the date it was given. A provisional one says so on every quote.
for (const o of OFFRES) {
  if (!o.aConfirmer && o.prixAchat > 0) assert.ok(o.source && o.lueLe, `${o.id} : prix confirme sans source ni date`);
  const inst = coutInstallation(o);
  if (o.aConfirmer) assert.ok(inst.aConfirmer && devisParBox(lire('AG-0001')).find((l) => l.offre === o.id)!.aConfirmer, `${o.id} : un prix provisoire doit le dire sur le devis`);
}
assert.ok(coutInstallation(OFFRES.find((o) => o.id === 'puissance-1')!).prixAchat > OFFRES.find((o) => o.id === 'puissance-1')!.prixAchat, 'le commandeur livre avec la machine est compte');
ok('un prix confirme porte sa source et sa date ; un prix provisoire est marque sur chaque devis ; le commandeur livre est compte');

// 4. Financing: 0 % over 24 months is the price divided by 24; a positive rate always costs more.
// The file's rate and term must give back, to the cent, the lease column of max's catalogue.
assert.equal(mensualite(2400, 0, 24), 100);
assert.ok(mensualite(2400, 0.06, 24) > 100 && Math.abs(mensualite(2400, 0.06, 24) - 106.37) < 0.01, `a 6 % : ${mensualite(2400, 0.06, 24)}`);
const lignes = [...OFFRES, ...offreJson.autresLignesDuCatalogue.lignes] as { nom: string; prixAchat: number; leasingMensuelHT?: number }[];
for (const l of lignes.filter((l) => l.leasingMensuelHT)) assert.ok(Math.abs(mensualite(l.prixAchat) - l.leasingMensuelHT!) < 0.01, `${l.nom} : ${mensualite(l.prixAchat).toFixed(2)} calcule, ${l.leasingMensuelHT} au catalogue`);
ok(`financement : 2 400 € sur 24 mois = 100 €/mois a 0 % ; ${lignes.filter((l) => l.leasingMensuelHT).length} mensualites du catalogue retrouvees au centime`);

// 5. The commander is an extension of the desk: no agent ever runs on it, nor without a machine.
for (const p of tous) for (const l of devisParBox(p).filter((l) => l.offre === 'aucune' || l.offre === COMMANDEUR.id)) {
  assert.ok(!l.enLocal && l.coutAgent === l.apiSeule, `${p.id} tourne sur ${l.offre}`);
}
ok(`sur ${tous.length} fiches, aucune ne tourne sans machine ni sur la Box Commandeur : elles y coutent leur prix API`);

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
for (const l of sec) assert.equal(l.rembourseSeul, l.mensualite + l.electricite > 0 && l.economie >= l.mensualite + l.electricite);
ok(`secretaire : ${sec[0].apiSeule} €/mois en API, ${sec.find((l) => l.offre === 'box-max')!.coutAgent} €/mois sur la Box Max ; « rembourse seul » = economie >= mensualite + electricite`);

// 8. A team: never more agents placed than the machine holds; without a machine the total is the API bill.
const equipe = tous.filter((_, i) => i % 50 === 0);
for (const o of OFFRES) {
  const d = devisPack(equipe, o.id);
  assert.equal(d.enLocal.length + d.enApi.length, equipe.length);
  const m = machineDe(o);
  if (m) assert.ok(tientSur(m, equipe.filter((p) => d.enLocal.includes(p.id))), `${o.id} : equipe placee au-dela de la machine`);
  if (o.id === 'aucune') assert.equal(d.totalPendant, d.toutApi);
}
ok(`equipe de ${equipe.length} : placement jamais au-dela de la machine, « sans machine » = facture API`);

// 9. The advice: the commander alone is never the cheapest (it only adds cost); a lightly used team gets no machine (max, 24/09).
const parCout = [...tous].sort((a, b) => coutApiMensuel(a).total - coutApiMensuel(b).total);
const legers = parCout.slice(0, 5);
assert.equal(conseillerBox(legers).conseil.offre, 'aucune', 'equipe peu sollicitee : pas de machine');
for (const eq of [legers, equipe, parCout.slice(-5), [lire('AG-0001')]]) assert.notEqual(conseillerBox(eq).conseil.offre, COMMANDEUR.id);
const lourds = conseillerBox(parCout.slice(-5)).conseil;
assert.notEqual(lourds.offre, 'aucune', 'equipe tres sollicitee : une machine se rembourse');
ok(`conseil : 5 agents peu sollicites -> sans machine ; 5 agents tres sollicites -> ${lourds.nom} (${lourds.totalPendant} €/mois contre ${lourds.toutApi} € en API)`);

console.log(`\ncheck-offre-box : ${n} verifications passees`);
