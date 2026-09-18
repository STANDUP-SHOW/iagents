/**
 * Writes docs/economie.md: for every package in agents/, the monthly cost through
 * the API alone, through Local-Agent (residual API + hardware over one year), the
 * ratio against the 3x rule, and the cost of an employee. Read-only on agents/.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { economiePour, RATIO_MINIMUM, type PaquetEco } from '../dimensionnement/economie.ts';
import tarifs from '../dimensionnement/tarifs-api.json' with { type: 'json' };

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const avecPoste = process.argv.includes('--poste');
const paquets: PaquetEco[] = readdirSync(join(racine, 'agents')).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8')));
const e = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €';

let md = `# Coût par agent et par mois — API seule contre Local-Agent\n\nGénéré par \`outils/economie.ts\` le ${new Date().toISOString().slice(0, 10)} sur ${paquets.length} fiches. Hypothèses dans \`dimensionnement/tarifs-api.json\` (version ${tarifs.version}) : ${tarifs.tour.jetonsEntree.toLocaleString('fr-FR')} jetons d'entrée par tour dont ${tarifs.tour.partCache * 100} % en cache, ${tarifs.tour.jetonsSortie} en sortie, ${tarifs.toursParExecution.base} tours par exécution (+${tarifs.toursParExecution.navigateur} avec navigateur, +${tarifs.toursParExecution.documentLourd} pour un document lourd), ${tarifs.partApiResiduelle * 100} % des exécutions restent par l'API chez Local-Agent, matériel amorti sur ${tarifs.amortissementMois} mois, électricité ${tarifs.electricite.prixKwhEur} €/kWh${avecPoste ? ', un poste N150 par agent' : ', le client utilise son propre PC'}. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.\n\nRègle commerciale : matériel + API résiduelle au moins **${RATIO_MINIMUM}× moins cher** que l'API seule. « Partagé » = le bundle est rempli d'agents de ce type ; « seul » = un seul agent sur son bundle.\n\n| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Bundle | Employé |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|\n`;
let tenus = 0, seulsTenus = 0;
for (const p of paquets) {
  const c = economiePour(p, { avecPoste });
  if (c.ratioPartage >= RATIO_MINIMUM) tenus++;
  if (c.ratioSeul >= RATIO_MINIMUM) seulsTenus++;
  const marque = (x: number) => (x >= RATIO_MINIMUM ? `**${x.toFixed(1)}×**` : `${x.toFixed(1)}× ✗`);
  md += `| ${p.id} ${(p as any).nom} | ${c.executionsParMois} | ${e(c.apiSeulReference)} | ${e(c.apiSeulHautDeGamme)} | ${e(c.localAgentPartage)} | ${e(c.apiResiduelle)} | ${e(c.materielPartage + c.poste)} | ${marque(c.ratioPartage)} | ${marque(c.ratioSeul)} | ${c.bundle ? `${c.bundle.gamme} (${c.agentsParBundle}/bundle)` : 'API'} | ${e(c.employe)} |\n`;
}
md += `\n**${tenus} fiches sur ${paquets.length} tiennent la règle des ${RATIO_MINIMUM}× en bundle partagé, ${seulsTenus} avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.\n\nLecture : un employé au coût employeur médian revient à ${e(tarifs.employe.coutEmployeurMensuelEur)} par mois, un SMIC chargé à ${e(tarifs.employe.smicChargeMensuelEur)}. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des ${RATIO_MINIMUM}×.\n`;
mkdirSync(join(racine, 'docs'), { recursive: true });
writeFileSync(join(racine, 'docs/economie.md'), md);
console.log(md.split('\n').slice(-4).join('\n'));
