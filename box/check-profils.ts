// Les deux profils d'iAgent OS (box/profils/*.json) n'allument-ils que ce qui
// existe ?
//
// Règle du mémo (24/09/2026) : « du code qui rend Ok sans avoir agi ment au
// client dès qu'on l'appelle ». Transposée aux services : un profil qui
// activerait iagent-voice alors que SERVICES.json le déclare absent ferait dire
// à systemctl qu'un moteur de voix tourne. Ce banc tient les profils à
// SERVICES.json, aux profils matériel et aux gammes du modèle.
//   node --experimental-strip-types box/check-profils.ts
import { compteur, estMain, fichiersJson, gammesDuModele, lireJson, validateur } from './commun.ts';
import { PROFILS_OS, type ProfilOs } from './profils/index.ts';
import { profilMateriel } from './materiel/index.ts';

type Services = { services: Record<string, { etat: 'reel' | 'absent' }> };

export function lancer(): number {
  const { verifier, bilan } = compteur("profils d'OS");
  const valider = validateur('box/profils/schema.json');
  const gammes = gammesDuModele().sort();
  const services = lireJson<Services>('box/os/systemd/SERVICES.json').services;
  const fichiers = fichiersJson('box/profils');
  verifier("un profil par gamme du modèle, ni plus ni moins", fichiers.map((f) => f.replace(/\.json$/, '')).join() === gammes.join(), `fichiers : ${fichiers.join(', ')} ; gammes : ${gammes.join(', ')}`);
  verifier("l'index (index.ts) porte exactement les fichiers du dossier", PROFILS_OS.map((p) => p.id).sort().join() === fichiers.map((f) => f.replace(/\.json$/, '')).join());
  for (const f of fichiers) {
    const p = lireJson<ProfilOs>(`box/profils/${f}`);
    const erreurs = valider(p);
    verifier(`${f} suit le schéma`, erreurs.length === 0, erreurs.join(' ; '));
    if (erreurs.length) continue;
    verifier(`${f} : l'identifiant est le nom du fichier`, `${p.id}.json` === f);
    const absents = p.services_actifs.filter((s) => services[s]?.etat !== 'reel');
    verifier(`${f} : chaque service actif est réel dans SERVICES.json`, absents.length === 0, `non réels : ${absents.join(', ')}`);
    verifier(`${f} : iagent-device et iagent-commander sont actifs (sans eux il n'y a pas de Box)`, ['iagent-device', 'iagent-commander'].every((s) => p.services_actifs.includes(s)));
    const materiels = p.materiel.map((id) => profilMateriel(id));
    verifier(`${f} : chaque profil matériel existe`, materiels.every(Boolean), p.materiel.join(', '));
    verifier(`${f} : chaque profil matériel sert cette gamme`, materiels.every((m) => m?.gammes.includes(p.id)));
    verifier(`${f} : au moins une vraie machine (pas seulement la VM)`, p.materiel.some((id) => id !== 'vm-qemu'));
    verifier(`${f} : un espace de navigateur par agent (brief §18)`, p.espaces_navigateur === p.agents_max);
    if (p.id === 'home') verifier(`${f} : Home = un seul agent (brief §3)`, p.agents_max === 1 && p.voix.demarrage_auto);
    if (p.id === 'business') verifier(`${f} : Business = plusieurs agents (brief §3)`, p.agents_max >= 2);
    const micro = materiels.some((m) => m?.audio.micro);
    verifier(`${f} : le test micro/enceintes/AEC suit le matériel (${micro ? 'un micro existe' : 'aucun micro'})`, p.voix.test_micro_hp_aec === micro);
  }
  return bilan();
}

if (estMain(import.meta.url)) process.exit(lancer() > 0 ? 1 : 0);
