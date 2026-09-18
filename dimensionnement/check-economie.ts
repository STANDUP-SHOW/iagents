// Bench for the economic case. Expectations written by hand against the commercial rule.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { economiePour, coutApiMensuel, RATIO_MINIMUM, type PaquetEco } from './economie.ts';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (id: string): PaquetEco => { const f = readdirSync(join(racine, 'agents')).find((f) => f.startsWith(id)); if (!f) throw new Error(`${id} absent`); return JSON.parse(readFileSync(join(racine, 'agents', f), 'utf8')); };
let n = 0; const ok = (m: string) => { n++; console.log('  ok  ' + m); };

// 1. An office agent (secretary) is at least 3x cheaper with Local-Agent, hardware shared by load on a mixed mini-PC, poste included.
const sec = economiePour(lire('AG-0001'), { avecPoste: true });
assert.ok(sec.apiSeulReference > 100, `API seule ${sec.apiSeulReference} €/mois attendue > 100`);
assert.ok(sec.ratioPartage >= RATIO_MINIMUM, `ratio ${sec.ratioPartage} < ${RATIO_MINIMUM}`);
assert.ok(sec.localAgentPartage < sec.smic / 10, 'un agent de bureau coute moins du dixieme d un SMIC charge');
ok(`secretaire : ${sec.apiSeulReference} €/mois en API seule, ${sec.localAgentPartage} €/mois chez Local-Agent (ratio ${sec.ratioPartage}), employe ${sec.employe} €`);

// 2. High-end API is strictly more expensive than the reference: the case only gets better against Opus.
assert.ok(sec.apiSeulHautDeGamme > sec.apiSeulReference * 2);
ok('l API haut de gamme coute plus de deux fois la reference');

// 3. Residual API is exactly the commercial share of the API-only bill when everything runs locally.
assert.equal(Math.round(sec.apiResiduelle * 100), Math.round(sec.apiSeulReference * 0.2 * 100));
ok('l API residuelle vaut 20 % de la facture API seule quand tout tourne en local');

// 4. An agent alone on its own bundle (nothing shared) is still cheaper than API-only for a text agent, but the ratio drops.
assert.ok(sec.ratioSeul < sec.ratioPartage);
assert.ok(sec.ratioSeul > 1, `seul sur son mini-PC : ratio ${sec.ratioSeul}`);
ok(`seul sur son mini-PC (rien partage) : ratio ${sec.ratioSeul}`);

// 5. The designer (image, gamme XL bundle) does NOT pass the rule alone: the bundle must be shared. The report must say so, never hide it.
const des = economiePour(lire('AG-0278'));
assert.ok(des.bundle && des.bundle.gamme === 'XL', `designer sur ${des.bundle?.id}`);
assert.ok(des.ratioSeul < RATIO_MINIMUM, `designer seul : ratio ${des.ratioSeul}, attendu < 3`);
ok(`designer seul sur un bundle XL : ratio ${des.ratioSeul} (< 3, la regle ne tient pas sans partage) ; partage ${des.ratioPartage}`);

// 5b. Fleet hardware is never dearer than the small-customer share: bigger bundles cost less per unit of load.
assert.ok(sec.materielFlotte <= sec.materielPartage + 0.01, `flotte ${sec.materielFlotte} > partage ${sec.materielPartage}`);
ok(`en flotte, la part de materiel du secretaire tombe a ${sec.materielFlotte} €/mois`);

// 6. Inactive tasks cost nothing; a package with no active task has no API bill.
assert.equal(coutApiMensuel({ id: 'x', modeles: { texte: 'texte-standard', activite: 0.1 }, taches: [{ planification: { type: 'quotidienne' }, active: false }] }).total, 0);
ok('une tache inactive ne coute rien');

console.log(`\n${n} attentes tenues — economie ok`);
