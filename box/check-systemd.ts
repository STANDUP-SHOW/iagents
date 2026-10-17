// Les unités systemd d'iAgent OS (box/os/systemd/*.service) disent-elles la
// vérité sur ce qui tourne ?
//
// Personne ne lance ces fichiers sur la machine de développement (Windows) : une
// faute s'y découvrirait au premier démarrage d'une Box, 20 minutes après le
// début de l'installation, sur un écran qui ne montre rien. Ce banc lit les
// unités comme systemd les lirait et les tient à SERVICES.json : un service réel
// a son binaire, son redémarrage et son journal ; un service absent n'a ni
// [Install] ni autre ExecStart que le refus ; les deux maîtres de tty1
// (usine, commander) s'excluent par la même condition, en miroir.
//   node --experimental-strip-types box/check-systemd.ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { compteur, estMain, lireJson, RACINE } from './commun.ts';

type Service = { etat: 'reel' | 'absent'; binaire?: string; source?: string; journal: string; role?: string; pourquoi?: string };
type Services = { version_os: string; journaux: string[]; absent: { binaire: string; source: string }; actifs: string[]; kiosque: { application: string; edition: 'box' }; services: Record<string, Service> };

/** A unit file as a map of sections to repeated key/value pairs. */
function lireUnite(chemin: string): Record<string, Record<string, string[]>> {
  const sections: Record<string, Record<string, string[]>> = {};
  let courante = '';
  for (const brute of readFileSync(chemin, 'utf8').split('\n')) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#') || ligne.startsWith(';')) continue;
    const s = ligne.match(/^\[([A-Za-z]+)\]$/);
    if (s) { courante = s[1]; sections[courante] ??= {}; continue; }
    const kv = ligne.match(/^([A-Za-z]+)=(.*)$/);
    if (!kv || !courante) throw new Error(`${chemin} : ligne illisible « ${ligne} »`);
    (sections[courante][kv[1]] ??= []).push(kv[2]);
  }
  return sections;
}
const une = (u: Record<string, Record<string, string[]>>, section: string, cle: string): string | undefined => u[section]?.[cle]?.at(-1);

export function lancer(): number {
  const { verifier, bilan } = compteur('unités systemd');
  const dossier = join(RACINE, 'box/os/systemd');
  const S = lireJson<Services>('box/os/systemd/SERVICES.json');
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.service')).sort();
  const noms = Object.keys(S.services).sort();
  verifier('chaque service de SERVICES.json a son unité, et chaque unité son service', fichiers.map((f) => f.replace(/\.service$/, '')).join() === noms.join(),
    `unités : ${fichiers.join(', ')} ; services : ${noms.join(', ')}`);
  verifier('le script de refus des services absents existe', existsSync(join(RACINE, S.absent.source)), S.absent.source);
  const refus = readFileSync(join(RACINE, S.absent.source), 'utf8');
  verifier('le refus sort en 78 et ne rend jamais 0', /exit 78/.test(refus) && !/exit 0/.test(refus) && !/sleep/.test(refus));
  verifier('la version d\'OS de SERVICES.json est une version semver', /^\d+\.\d+\.\d+$/.test(S.version_os));
  // One factory image for every Station (max, 17/10/2026): the services enabled at install are the same for every profile.
  const nonReels = S.actifs.filter((s) => S.services[s]?.etat !== 'reel');
  verifier('chaque service actif à l’installation est réel dans SERVICES.json', nonReels.length === 0, `non réels : ${nonReels.join(', ')}`);
  verifier('iagent-device et iagent-commander sont actifs (sans eux il n’y a pas de Box)', ['iagent-device', 'iagent-commander'].every((s) => S.actifs.includes(s)));
  verifier('le kiosque lance l’application desktop en édition Box', S.kiosque?.application === 'iagent-desktop' && S.kiosque?.edition === 'box');

  const unites = new Map(fichiers.map((f) => [f.replace(/\.service$/, ''), lireUnite(join(dossier, f))]));
  for (const [nom, decl] of Object.entries(S.services)) {
    const u = unites.get(nom);
    if (!u) continue;
    const exec = une(u, 'Service', 'ExecStart') ?? '';
    const type = une(u, 'Service', 'Type') ?? 'simple';
    const restart = une(u, 'Service', 'Restart');
    verifier(`${nom} : journal « ${decl.journal} » de la convention (brief §39), posé en SyslogIdentifier`, S.journaux.includes(decl.journal) && une(u, 'Service', 'SyslogIdentifier') === decl.journal, `SyslogIdentifier=${une(u, 'Service', 'SyslogIdentifier')}`);
    verifier(`${nom} : une Description`, Boolean(une(u, 'Unit', 'Description')));
    if (decl.etat === 'reel') {
      verifier(`${nom} (réel) : ExecStart lance son binaire ${decl.binaire}`, exec.split(/\s+/)[0] === decl.binaire, `ExecStart=${exec}`);
      verifier(`${nom} (réel) : le code source déclaré existe (${decl.source})`, Boolean(decl.source) && existsSync(join(RACINE, decl.source!)));
      const timer = existsSync(join(dossier, `${nom}.timer`));
      verifier(`${nom} (réel) : redémarre s'il tombe, sauf un oneshot cadencé par un timer`, type === 'oneshot' ? timer : restart === 'on-failure' || restart === 'always', `Type=${type} Restart=${restart}`);
      verifier(`${nom} (réel) : activable au démarrage ([Install]) ou par son timer`, Boolean(u.Install) || (timer && Boolean(lireUnite(join(dossier, `${nom}.timer`)).Install)));
      if (decl.binaire?.endsWith('.sh')) {
        const script = readFileSync(join(RACINE, decl.source!), 'utf8');
        verifier(`${nom} : le script commence par #!/bin/sh et set -eu`, script.startsWith('#!/bin/sh') && /^set -eu/m.test(script));
      }
    } else {
      verifier(`${nom} (absent) : ExecStart est le refus, et rien d'autre`, exec === `${S.absent.binaire} %N` && (u.Service?.ExecStart?.length ?? 0) === 1, `ExecStart=${exec}`);
      verifier(`${nom} (absent) : pas de [Install], rien ne l'active`, !u.Install);
      verifier(`${nom} (absent) : pas de redémarrage en boucle`, restart === undefined || restart === 'no');
      verifier(`${nom} (absent) : SERVICES.json dit pourquoi`, typeof decl.pourquoi === 'string' && decl.pourquoi.length > 20);
    }
  }
  const usine = unites.get('iagent-usine');
  const commander = unites.get('iagent-commander');
  if (usine && commander) {
    const marque = une(commander, 'Unit', 'ConditionPathExists');
    verifier('iagent-usine et iagent-commander se partagent tty1 par la même condition, en miroir', Boolean(marque) && une(usine, 'Unit', 'ConditionPathExists') === `!${marque}`, `${une(usine, 'Unit', 'ConditionPathExists')} / ${marque}`);
    verifier('tous deux tiennent tty1 sans getty', [usine, commander].every((u) => une(u, 'Service', 'TTYPath') === '/dev/tty1' && (une(u, 'Unit', 'Conflicts') ?? '').includes('getty@tty1.service')));
    verifier('tous deux tournent sous l\'utilisateur iagent, jamais root', [usine, commander].every((u) => une(u, 'Service', 'User') === 'iagent'));
    verifier('chacun déclare l\'autre en Conflicts', (une(usine, 'Unit', 'Conflicts') ?? '').includes('iagent-commander.service') && (une(commander, 'Unit', 'Conflicts') ?? '').includes('iagent-usine.service'));
  }
  const device = unites.get('iagent-device');
  if (device) verifier('iagent-device est Type=notify avec un WatchdogSec (brief §30)', une(device, 'Service', 'Type') === 'notify' && Boolean(une(device, 'Service', 'WatchdogSec')));
  return bilan();
}

if (estMain(import.meta.url)) process.exit(lancer() > 0 ? 1 : 0);
