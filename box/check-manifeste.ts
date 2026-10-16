// Le manifeste du Factory Installer (box/usine/iso/manifeste.ts) ne porte-t-il
// que des versions lues dans leur fichier ?
//
// Le brief (§5) veut un artefact traçable : Build ID, commit, version de l'OS,
// de Commander, de l'agent, de la voix… Une version recopiée à la main dans le
// manifeste finit fausse le jour où le fichier qui la porte bouge (c'est arrivé
// à `miseAJour.appMinimum`, « 1.0.0 » partout quand l'application était en
// 0.1.0). Ce banc recompose le manifeste et compare chaque champ à sa source ;
// il refuse aussi un nom d'ISO hors forme et un composant « non livré » sans
// son pourquoi.
//   node --experimental-strip-types box/check-manifeste.ts
import { compteur, estMain, lireJson } from './commun.ts';
import { construireManifeste, NOM_ISO, versionCargo } from './usine/iso/manifeste.ts';

export function lancer(): number {
  const { verifier, bilan } = compteur('manifeste du Factory Installer');
  const installateur = lireJson<{ version: string }>('box/usine/iso/installateur.json');
  const source = lireJson<{ version: string; fichier: string; sha256: string; url: string; releve_le: string }>('box/usine/iso/source.json');
  const services = lireJson<{ version_os: string }>('box/os/systemd/SERVICES.json');
  const desktop = lireJson<{ version: string }>('desktop/package.json');
  verifier('la version de l’installateur est semver', /^\d+\.\d+\.\d+$/.test(installateur.version));
  verifier("la source Ubuntu est une 24.04.x live-server, condensé de 64 hexadécimaux, relevée à une date", /^24\.04\.\d+$/.test(source.version)
    && source.fichier === `ubuntu-${source.version}-live-server-amd64.iso` && /^[0-9a-f]{64}$/.test(source.sha256) && source.url.endsWith(source.fichier) && /^\d{4}-\d{2}-\d{2}$/.test(source.releve_le));
  for (const profil of ['home', 'pro', 'business']) {
    const iso = `iagent-factory-installer-v${installateur.version}-${profil}.iso`;
    verifier(`le nom d'ISO ${iso} a la forme du brief`, NOM_ISO.test(iso));
    const m = construireManifeste({ profil, iso, commit: 'ad6c328f0000000000000000000000000000abcd', date: '2026-10-11T12:00:00.000Z', numero: '42.ad6c328' });
    verifier(`${profil} : build_id = IAGENT-FACTORY-<version>+<numéro>`, m.build_id === `IAGENT-FACTORY-${installateur.version}+42.ad6c328` && m.installateur.build_id === m.build_id);
    verifier(`${profil} : la version de l'OS vient de source.json et celle d'iAgent OS de SERVICES.json`, m.os.version === source.version && m.os.sha256_source === source.sha256 && m.iagent_os === services.version_os);
    verifier(`${profil} : la version de Commander est celle de desktop/package.json`, m.composants.commander.version === desktop.version);
    for (const c of ['device', 'updater', 'watchdog']) {
      verifier(`${profil} : ${c} = version du Cargo.toml de son crate (${m.composants[c].version ?? 'absent'})`, m.composants[c].version === versionCargo(m.composants[c].source));
    }
    const nonLivres = Object.entries(m.composants).filter(([, c]) => c.version === null);
    verifier(`${profil} : chaque composant non livré dit pourquoi (${nonLivres.map(([n]) => n).join(', ') || 'aucun'})`, nonLivres.every(([, c]) => typeof c.pourquoi === 'string' && c.pourquoi.length > 10));
    verifier(`${profil} : les trois runtimes (agents, navigateur, voix) sont déclarés non livrés, comme SERVICES.json`, ['agent_runtime', 'browser_runtime', 'voice_runtime'].every((c) => m.composants[c].version === null));
  }
  let refuse = false;
  try { construireManifeste({ profil: 'business', iso: 'iagent-factory-installer-v9.9.9-business.iso', commit: 'abcdef1', date: '2026-10-11T12:00:00.000Z' }); } catch { refuse = true; }
  verifier("un nom d'ISO dont la version n'est pas celle d'installateur.json est refusé", refuse);
  refuse = false;
  try { construireManifeste({ profil: 'home', iso: `iagent-factory-installer-v${installateur.version}-business.iso`, commit: 'abcdef1', date: '2026-10-11T12:00:00.000Z' }); } catch { refuse = true; }
  verifier("un nom d'ISO d'un autre profil est refusé", refuse);
  return bilan();
}

if (estMain(import.meta.url)) process.exit(lancer() > 0 ? 1 : 0);
