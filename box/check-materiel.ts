// Les profils matériel de l'usine (box/materiel/*.json) décrivent-ils une
// machine que la chaîne sait qualifier ?
//
// Le 11/10/2026, le brief Factory Installer nomme un BOSGAME M4 Neo (64 Go)
// pour la Box business, pendant que dimensionnement/offre-box.json vend encore
// un Minisforum MS-01 (32 Go) sous le nom « Box Commandeur ». Un profil qui ne
// décrit pas la machine reçue qualifierait le mauvais matériel sans qu'aucun
// test ne tombe : d'où une source datée sur chaque profil, des tests obligatoires
// qui existent vraiment dans box/usine/tests, et une gamme lue dans modele.ts.
//   node --experimental-strip-types box/check-materiel.ts
import { basename } from 'node:path';
import { compteur, estMain, fichiersJson, gammesDuModele, lireJson, testsUsineConnus, validateur } from './commun.ts';
import { PROFILS_MATERIEL, type ProfilMateriel } from './materiel/index.ts';

export function lancer(): number {
  const { verifier, bilan } = compteur('profils matériel');
  const valider = validateur('box/materiel/schema.json');
  const gammes = gammesDuModele();
  const tests = testsUsineConnus();
  const fichiers = fichiersJson('box/materiel');
  verifier('au moins un profil par gamme du modèle', gammes.every((g) => PROFILS_MATERIEL.some((p) => p.gammes.includes(g as never))), gammes.join(', '));
  verifier("l'index (index.ts) porte exactement les fichiers du dossier", PROFILS_MATERIEL.map((p) => `${p.id}.json`).sort().join() === fichiers.join(),
    `index : ${PROFILS_MATERIEL.map((p) => p.id).join(', ')} ; dossier : ${fichiers.join(', ')}`);
  const ids = new Set<string>();
  for (const f of fichiers) {
    const p = lireJson<ProfilMateriel>(`box/materiel/${f}`);
    const erreurs = valider(p);
    verifier(`${f} suit le schéma`, erreurs.length === 0, erreurs.join(' ; '));
    if (erreurs.length) continue;
    verifier(`${f} : l'identifiant est le nom du fichier`, p.id === basename(f, '.json'));
    verifier(`${f} : identifiant unique`, !ids.has(p.id));
    ids.add(p.id);
    verifier(`${f} : gammes connues du modèle`, p.gammes.every((g) => gammes.includes(g)), p.gammes.join(', '));
    const inconnus = p.tests_obligatoires.filter((t) => !tests.has(t));
    verifier(`${f} : chaque test obligatoire existe dans box/usine/tests`, inconnus.length === 0, `inconnus : ${inconnus.join(', ')}`);
    verifier(`${f} : le test « materiel » est obligatoire (sans lui le profil ne compare rien)`, p.tests_obligatoires.includes('materiel'));
    verifier(`${f} : mémoires acceptées croissantes`, p.memoire_go.every((m, i) => i === 0 || m > p.memoire_go[i - 1]));
    verifier(`${f} : l'expression du processeur se compile`, (() => { try { new RegExp(p.cpu.modele_regex); return true; } catch { return false; } })());
    verifier(`${f} : le test audio n'est obligatoire que si la machine a une sortie son`, !p.tests_obligatoires.includes('audio') || p.audio.sortie);
    verifier(`${f} : le test tpm n'est obligatoire que si le profil exige le TPM (toujours, 2.0)`, !p.tests_obligatoires.includes('tpm') || p.tpm === '2.0');
    verifier(`${f} : une fiche à confirmer le dit dans sa source`, !p.a_confirmer || /confirm|relev|échantillon|brief/i.test(p.source), p.source);
    verifier(`${f} : une fiche confirmée dit sur quoi elle a été relevée`, p.a_confirmer || /relev|QEMU|essayer/i.test(p.source), p.source);
  }
  return bilan();
}

if (estMain(import.meta.url)) process.exit(lancer() > 0 ? 1 : 0);
