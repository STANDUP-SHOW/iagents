/**
 * Prints, for every package in agents/, the cheapest machine of the catalogue
 * that runs it 24/7 and how many copies that machine holds; then places a
 * sample pack. Read-only: a report for choosing what LocalAgent sells.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { machinesPourPack, agentsParMachine, materielPour, diagnosticLocal, MACHINES, type AgentDimension } from '../dimensionnement/calculer.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const agents: (AgentDimension & { nom: string })[] = readdirSync(join(racine, 'agents')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => { const p = JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8')); return { id: p.id, nom: p.nom, modeles: p.modeles }; });

console.log('Agent                          | modèles mémoire | charge | machine la moins chère            | prix  | copies');
for (const a of agents) {
  const m = materielPour(a.modeles);
  const r = machinesPourPack([a]);
  const ligne = r.impossibles.length ? 'AUCUNE (mode API)' : r.machines[0].machine.id;
  const copies = r.impossibles.length ? '-' : String(agentsParMachine(r.machines[0].machine, a));
  console.log(`${(a.id + ' ' + a.nom).padEnd(30)} | ${String(m.vram).padStart(6)} Go       | ${m.chargeContinue.toFixed(2).padStart(6)} | ${ligne.padEnd(33)} | ${(r.machines[0]?.machine.prixIndicatif ?? '').toString().padStart(4)}  | ${copies}`);
}

console.log('\nAgents hors local sur ce catalogue — pourquoi, et quelle configuration il faudrait :');
for (const a of agents) {
  const d = diagnosticLocal(a);
  if (d.possible) continue;
  console.log(`  ${a.id} ${a.nom}`);
  for (const r of d.raisons) console.log(`    - ${r}`);
  console.log(`    → configuration nécessaire : ${d.configurationNecessaire}`);
}

const pack = machinesPourPack(agents);
console.log(`\nPack « les 5 témoins » : ${pack.machines.length} machine(s), ${pack.prixTotal} €, en API : ${pack.impossibles.join(', ') || 'aucun'}`);
for (const m of pack.machines) console.log(`  ${m.machine.id} (${m.machine.prixIndicatif} €) : ${m.agents.join(', ')} — charge ${(m.besoins.charge / m.machine.capaciteGpu * 100).toFixed(0)} %, mémoire ${m.besoins.vram}/${m.machine.vram} Go`);

console.log(`\nCapacité par machine pour un poste de bureau (AG-0001) :`);
for (const m of [...MACHINES].sort((a, b) => a.prixIndicatif - b.prixIndicatif)) {
  const n = agentsParMachine(m, agents[0]);
  console.log(`  ${m.id.padEnd(30)} ${String(m.prixIndicatif).padStart(4)} €  ${String(m.ram).padStart(3)} Go  cap ${m.capaciteGpu.toFixed(2)}  → ${n} agent(s)  (${n ? Math.round(m.prixIndicatif / n) + ' €/agent' : 'aucun'})`);
}
