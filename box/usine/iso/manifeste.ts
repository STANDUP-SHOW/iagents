// Le manifeste d'une construction du Factory Installer (brief §5) : Build ID,
// commit, date, version de l'OS, de Commander, de l'agent de la Box, de
// l'updater, du watchdog… Chaque version est LUE dans le fichier qui la porte
// (package.json du desktop, Cargo.toml de chaque crate, SERVICES.json,
// source.json, installateur.json) ; un composant non livré vaut `null` avec son
// `pourquoi`, jamais un numéro inventé. box/check-manifeste.ts recompose le
// manifeste et refuse qu'une version soit écrite ici à la main.
//   node --experimental-strip-types box/usine/iso/manifeste.ts --profil business --iso <nom> [--commit <sha>] [--date <iso>]
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DEPOT = fileURLToPath(new URL('../../../', import.meta.url));
const lire = (relatif: string): string => readFileSync(join(DEPOT, relatif), 'utf8');
const json = <T = any>(relatif: string): T => JSON.parse(lire(relatif)) as T;

/** The `version = "x.y.z"` of a Cargo.toml [package] section, or null when the crate is not in the repository yet. */
export function versionCargo(relatif: string): string | null {
  try {
    const texte = lire(relatif);
    const m = texte.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
    if (m) return m[1];
    // `version.workspace = true`: the version is the one of the workspace root,
    // the Cargo.toml one level above the crate's folder.
    if (!/^\[package\][\s\S]*?^version\.workspace\s*=\s*true/m.test(texte)) return null;
    const racine = relatif.split('/').slice(0, -2).concat('Cargo.toml').join('/');
    const w = lire(racine).match(/^\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
    return w ? w[1] : null;
  } catch {
    return null;
  }
}

export type Manifeste = {
  build_id: string;
  installateur: { version: string; build_id: string; commit: string };
  date: string;
  profil: string;
  iso: string;
  os: { distribution: string; version: string; iso_source: string; sha256_source: string };
  iagent_os: string;
  composants: Record<string, { version: string | null; source: string; pourquoi?: string }>;
};

export const NOM_ISO = /^iagent-factory-installer-v(\d+\.\d+\.\d+)-(business|home)\.iso$/;

export function construireManifeste(p: { profil: string; iso: string; commit: string; date: string; numero?: string }): Manifeste {
  const installateur = json<{ version: string }>('box/usine/iso/installateur.json');
  const source = json<{ distribution: string; version: string; fichier: string; sha256: string }>('box/usine/iso/source.json');
  const services = json<{ version_os: string }>('box/os/systemd/SERVICES.json');
  const desktop = json<{ version: string }>('desktop/package.json');
  const nonLivre = (quoi: string, ou: string) => ({ version: null, source: ou, pourquoi: `${quoi} non livré dans iAgent OS ${services.version_os} (box/os/systemd/SERVICES.json)` });
  const m = p.iso.match(NOM_ISO);
  if (!m || m[1] !== installateur.version || m[2] !== p.profil) throw new Error(`Nom d'ISO « ${p.iso} » : attendu iagent-factory-installer-v${installateur.version}-${p.profil}.iso.`);
  if (!/^[0-9a-f]{7,40}$/.test(p.commit)) throw new Error(`Commit « ${p.commit} » illisible.`);
  const build_id = `IAGENT-FACTORY-${installateur.version}+${p.numero ?? p.commit.slice(0, 7)}`;
  return {
    build_id,
    installateur: { version: installateur.version, build_id, commit: p.commit },
    date: p.date,
    profil: p.profil,
    iso: p.iso,
    os: { distribution: source.distribution, version: source.version, iso_source: source.fichier, sha256_source: source.sha256 },
    iagent_os: services.version_os,
    composants: {
      commander: { version: desktop.version, source: 'desktop/package.json' },
      device: { version: versionCargo('box/services/agent-device/Cargo.toml'), source: 'box/services/agent-device/Cargo.toml' },
      updater: { version: versionCargo('box/services/updater/Cargo.toml'), source: 'box/services/updater/Cargo.toml' },
      watchdog: { version: versionCargo('box/services/watchdog/Cargo.toml'), source: 'box/services/watchdog/Cargo.toml' },
      agent_runtime: nonLivre("Le moteur d'exécution des agents", 'box/os/systemd/SERVICES.json'),
      browser_runtime: nonLivre('Le gestionnaire d’espaces de navigateur', 'box/os/systemd/SERVICES.json'),
      voice_runtime: nonLivre('Le moteur de voix', 'box/os/systemd/SERVICES.json'),
    },
  };
}

function argument(nom: string, defaut?: string): string {
  const i = process.argv.indexOf(`--${nom}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  if (defaut !== undefined) return defaut;
  throw new Error(`--${nom} manque.`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('manifeste.ts')) {
  const commit = argument('commit', (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: DEPOT, encoding: 'utf8' }).trim(); } catch { return ''; } })());
  const m = construireManifeste({
    profil: argument('profil'), iso: argument('iso'), commit, date: argument('date', new Date().toISOString()),
    numero: process.env.GITHUB_RUN_NUMBER ? `${process.env.GITHUB_RUN_NUMBER}.${commit.slice(0, 7)}` : undefined,
  });
  process.stdout.write(JSON.stringify(m, null, 2) + '\n');
}
