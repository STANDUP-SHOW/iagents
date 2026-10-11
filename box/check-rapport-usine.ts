// Les rapports d'usine témoins (box/usine/tests/temoins/*.json) suivent-ils le
// contrat, et portent-ils le verdict que la plateforme recalculerait ?
//
// Le rapport est écrit par Python (rapport.py) et jugé par TypeScript
// (plateforme/controle/regles.ts, verdictRapport) : deux implémentations d'une
// même règle, « aucun échec, tous les obligatoires passés ». Ce banc rejoue
// verdictRapport() sur les témoins ; test_usine.py rejoue verdict() en Python
// sur les mêmes fichiers. Un rapport qui dirait PASS sur un FAIL, c'est une Box
// expédiée avec un TPM absent : l'opérateur fait confiance à l'écran.
//   node --experimental-strip-types box/check-rapport-usine.ts
import { readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { compteur, estMain, lireJson, RACINE, testsUsineConnus, validateur } from './commun.ts';
import { profilMateriel } from './materiel/index.ts';
import { REFERENCE_BOX, verdictRapport } from '../plateforme/controle/regles.ts';
import { detecterDonneeClient, textesDe } from '../plateforme/controle/detecteur.ts';
import type { RapportUsine } from '../plateforme/modele.ts';

type Temoin = Omit<RapportUsine, 'id' | 'recu_le'> & { manquants: string[]; echoues: string[] };

export function lancer(): number {
  const { verifier, bilan } = compteur("rapports d'usine témoins");
  const valider = validateur('box/usine/tests/rapport.schema.json');
  const tests = testsUsineConnus();
  const dossier = join(RACINE, 'box/usine/tests/temoins');
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.json')).sort();
  verifier('au moins un témoin qui passe et un qui échoue', fichiers.length >= 2);
  let unPasse = false;
  let unEchec = false;
  for (const f of fichiers) {
    const r = lireJson<Temoin>(`box/usine/tests/temoins/${f}`);
    const erreurs = valider(r);
    verifier(`${f} suit rapport.schema.json`, erreurs.length === 0, erreurs.join(' ; '));
    if (erreurs.length) continue;
    verifier(`${f} : le fichier porte le nom de sa référence`, basename(f, '.json') === r.reference);
    verifier(`${f} : référence au format du brief et de la gamme`, REFERENCE_BOX.test(r.reference) && r.reference.includes(r.gamme === 'business' ? '-CMD-' : '-HOME-'));
    const profil = profilMateriel(r.profil_materiel);
    verifier(`${f} : le profil matériel ${r.profil_materiel} existe et sert la gamme`, Boolean(profil) && profil!.gammes.includes(r.gamme));
    if (!profil) continue;
    const v = verdictRapport(r.tests, profil.tests_obligatoires);
    verifier(`${f} : verdict « ${r.verdict} » = ce que la plateforme recalcule`, v.verdict === r.verdict && v.manquants.join() === r.manquants.join() && v.echoues.join() === r.echoues.join(),
      `plateforme : ${v.verdict}, manquants ${v.manquants.join(', ') || '—'}, échoués ${v.echoues.join(', ') || '—'}`);
    const inconnus = r.tests.map((t) => t.id).filter((id) => !tests.has(id));
    verifier(`${f} : chaque test cité existe dans box/usine/tests`, inconnus.length === 0, inconnus.join(', '));
    const types = [...new Set(textesDe(r.tests.map((t) => [t.libelle, t.detail])).flatMap(detecterDonneeClient))];
    verifier(`${f} : aucun secret ni donnée client dans les détails`, types.length === 0, types.join(', '));
    verifier(`${f} : fin après début`, Date.parse(r.termine_le) >= Date.parse(r.commence_le));
    verifier(`${f} : la somme des durées tient dans la fenêtre du rapport`, r.tests.reduce((s, t) => s + t.duree_ms, 0) <= Date.parse(r.termine_le) - Date.parse(r.commence_le));
    if (r.verdict === 'passe') unPasse = true; else unEchec = true;
  }
  verifier('les témoins couvrent les deux verdicts', unPasse && unEchec);
  return bilan();
}

if (estMain(import.meta.url)) process.exit(lancer() > 0 ? 1 : 0);
