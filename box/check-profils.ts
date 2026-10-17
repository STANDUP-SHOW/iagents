// Les trois profils logiciels de la Station (box/profils/*.json) tiennent-ils au
// modèle et au matériel ?
//
// Max, 17/10/2026 : une seule machine, la Station, et un profil (home, business,
// enterprise) posé au provisioning sur la même image d'usine. Un profil qui
// citerait un matériel qui ne le sert pas laisserait attribuer une Station 32 en
// Enterprise ; ce banc le refuse, comme la plateforme (`gammeRefusee`). Les
// services actifs, communs à toutes, sont tenus par check-systemd.ts.
//   node --experimental-strip-types box/check-profils.ts
import { compteur, estMain, fichiersJson, gammesDuModele, lireJson, validateur } from './commun.ts';
import { PROFILS_OS, type ProfilOs } from './profils/index.ts';
import { profilMateriel } from './materiel/index.ts';


export function lancer(): number {
  const { verifier, bilan } = compteur("profils d'OS");
  const valider = validateur('box/profils/schema.json');
  const gammes = gammesDuModele().sort();
  const fichiers = fichiersJson('box/profils');
  verifier("un profil par gamme du modèle, ni plus ni moins", fichiers.map((f) => f.replace(/\.json$/, '')).join() === gammes.join(), `fichiers : ${fichiers.join(', ')} ; gammes : ${gammes.join(', ')}`);
  verifier("l'index (index.ts) porte exactement les fichiers du dossier", PROFILS_OS.map((p) => p.id).sort().join() === fichiers.map((f) => f.replace(/\.json$/, '')).join());
  for (const f of fichiers) {
    const p = lireJson<ProfilOs>(`box/profils/${f}`);
    const erreurs = valider(p);
    verifier(`${f} suit le schéma`, erreurs.length === 0, erreurs.join(' ; '));
    if (erreurs.length) continue;
    verifier(`${f} : l'identifiant est le nom du fichier`, `${p.id}.json` === f);
    const materiels = p.materiel.map((id) => profilMateriel(id));
    verifier(`${f} : chaque profil matériel existe`, materiels.every(Boolean), p.materiel.join(', '));
    verifier(`${f} : chaque profil matériel sert cette gamme`, materiels.every((m) => m?.gammes.includes(p.id)));
    verifier(`${f} : au moins une vraie machine (pas seulement la VM)`, p.materiel.some((id) => id !== 'vm-qemu'));
    verifier(`${f} : un espace de navigateur par agent (brief §18)`, p.espaces_navigateur === p.agents_max);
    if (p.id === 'home') verifier(`${f} : Home = un seul agent (brief §3)`, p.agents_max === 1 && p.voix.demarrage_auto);
    if (p.id === 'enterprise') verifier(`${f} : Enterprise = au moins autant d'agents que Business (max, 17/10/2026)`, p.agents_max >= 8);
    if (p.id === 'business') verifier(`${f} : Business = 8 agents (brief §3)`, p.agents_max === 8);
    const micro = materiels.some((m) => m?.audio.micro);
    verifier(`${f} : le test micro/enceintes/AEC suit le matériel (${micro ? 'un micro existe' : 'aucun micro'})`, p.voix.test_micro_hp_aec === micro);
  }
  return bilan();
}

if (estMain(import.meta.url)) process.exit(lancer() > 0 ? 1 : 0);
