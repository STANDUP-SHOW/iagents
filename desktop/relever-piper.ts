/**
 * Relève chez l'éditeur ce qu'il faut pour déclarer le moteur de voix Piper
 * dans `src-tauri/sources-ressources.json`.
 *
 * Pourquoi un script plutôt qu'une ligne écrite à la main : les adresses et les
 * empreintes de ce fichier sont relevées chez l'éditeur, jamais de mémoire, et
 * la session qui a écrit le téléchargement ne joint pas github.com (403 par le
 * mandataire). L'intégration continue, elle, TOURNE chez GitHub. Ce script y
 * fait le relevé qu'on ne peut pas faire ailleurs.
 *
 * Deux usages, un seul code :
 *  - le moteur n'est pas encore déclaré : le script imprime ce qu'il faudrait
 *    écrire, et sort 0. C'est une information, pas une faute — rien n'est cassé
 *    tant que l'application dit clairement qu'elle ne parle pas encore.
 *  - le moteur est déclaré : le script compare, et sort 1 si l'éditeur ne
 *    publie plus ce qui est écrit. Une version qui bouge se verrait alors ici
 *    plutôt que chez le client, au moment où il clique.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const DEPOT = 'rhasspy/piper';
const racine = join(import.meta.dirname, 'src-tauri');

interface Piece {
  role: string;
  chemin: string;
  url: string;
  sha256: string | null;
  octets: number;
}

const declare = (): Piece[] => {
  const f = JSON.parse(readFileSync(join(racine, 'sources-ressources.json'), 'utf8'));
  return (f.pieces as Piece[]).filter((p) => p.chemin.startsWith('piper/'));
};

// Le jeton du flux si on l'a : l'API sans jeton plafonne a 60 appels par heure
// et par machine, partagée avec tout le monde sur le meme coureur.
const entetes = (): Record<string, string> => {
  const e: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'iagent-releve-piper',
  };
  const jeton = process.env.GITHUB_TOKEN;
  if (jeton) e.Authorization = `Bearer ${jeton}`;
  return e;
};

const empreinteDistante = async (url: string): Promise<{ sha256: string; octets: number }> => {
  const r = await fetch(url, { headers: { 'User-Agent': 'iagent-releve-piper' } });
  if (!r.ok) throw new Error(`${r.status} sur ${new URL(url).host}`);
  const octets = new Uint8Array(await r.arrayBuffer());
  return { sha256: createHash('sha256').update(octets).digest('hex'), octets: octets.length };
};

const principal = async () => {
  const r = await fetch(`https://api.github.com/repos/${DEPOT}/releases/latest`, {
    headers: entetes(),
  });
  if (!r.ok) {
    // Ne pas faire échouer tout le flux parce que l'API de GitHub a hoqueté :
    // ce relevé informe, il ne garde rien d'essentiel au produit.
    console.log(`  ⟳ relevé Piper impossible (${r.status}) — rien n'est conclu`);
    return 0;
  }
  const version = (await r.json()) as {
    tag_name: string;
    assets: { name: string; browser_download_url: string; size: number; digest?: string | null }[];
  };

  console.log(`\nmoteur Piper — dernière version publiée : ${version.tag_name}`);
  for (const a of version.assets) {
    console.log(`  ${a.name}  ${a.size} o  ${a.digest ?? '(pas de digest publié)'}`);
  }

  const attendus = declare();
  if (attendus.length === 0) {
    // Ce dépôt ne publie aucun digest (version de 2023, antérieure au champ) :
    // sans empreinte, la pièce ne peut pas être déclarée, et sans déclaration
    // l'application ne la télécharge pas. On la calcule donc ici, une fois —
    // cette branche disparaît dès que le moteur est déclaré.
    console.log(`\n  ⟳ le moteur Piper n'est pas déclaré dans sources-ressources.json.`);
    for (const nom of ['piper_windows_amd64.zip', 'piper_linux_x86_64.tar.gz']) {
      const a = version.assets.find((x) => x.name === nom);
      if (!a) {
        console.log(`     ${nom} : plus publié en ${version.tag_name}`);
        continue;
      }
      const { sha256, octets } = await empreinteDistante(a.browser_download_url);
      console.log(`     ${nom}`);
      console.log(`       url     ${a.browser_download_url}`);
      console.log(`       octets  ${octets}`);
      console.log(`       sha256  ${sha256}`);
    }
    console.log(
      `     Ce sont des ARCHIVES, pas des binaires : les déclarer demande\n` +
        `     d'ouvrir l'archive après la vérification, ce que telechargement.rs\n` +
        `     ne fait pas encore. Tant que ça manque, un poste installé écoute\n` +
        `     mais ne parle pas.`
    );
    return 0;
  }

  let fautes = 0;
  for (const piece of attendus) {
    const nom = piece.url.split('/').pop() ?? '';
    const chez = version.assets.find((a) => a.name === nom);
    if (!chez) {
      console.log(`  ✗ ${piece.chemin} : « ${nom} » n'est plus publié en ${version.tag_name}`);
      fautes += 1;
      continue;
    }
    // Le digest de l'API évite de tirer vingt mégaoctets a chaque passage ;
    // quand l'éditeur n'en publie pas, on télécharge et on calcule, parce
    // qu'une empreinte non vérifiée ne vaut pas mieux qu'une empreinte absente.
    const publie = chez.digest?.startsWith('sha256:')
      ? { sha256: chez.digest.slice('sha256:'.length), octets: chez.size }
      : await empreinteDistante(chez.browser_download_url);

    if (publie.octets !== piece.octets) {
      console.log(`  ✗ ${piece.chemin} : ${piece.octets} o déclarés, ${publie.octets} o publiés`);
      fautes += 1;
    } else if (piece.sha256 && publie.sha256 !== piece.sha256) {
      console.log(`  ✗ ${piece.chemin} : l'empreinte publiée a changé (${publie.sha256})`);
      fautes += 1;
    } else {
      console.log(`  ok  ${piece.chemin} est bien ce que l'éditeur publie`);
    }
  }
  console.log(`moteur Piper : ${fautes} faute(s)`);
  return fautes ? 1 : 0;
};

process.exit(await principal());
