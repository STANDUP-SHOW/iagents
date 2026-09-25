/**
 * La mise à jour automatique des postes : ce que le flux du MSI prépare pour
 * une version signée, et ce que la configuration embarquée promet.
 *
 * Deux fautes coûteraient cher sans rien casser à la construction : une
 * version signée à moitié configurée (les postes chercheraient des mises à
 * jour qu'ils ne pourraient jamais vérifier), et un manifeste qui pointerait
 * vers l'installeur MSI (installé pour toute la machine, il réclame un
 * administrateur à chaque mise à jour, donc quelqu'un devant l'écran).
 */
import { readFileSync } from 'node:fs';
import { lireReglages, configuration, manifeste, nomInstalleur } from './version-signee.mjs';
import { lireSignature, fusionner } from './signature-windows.mjs';

let fautes = 0;
function verifier(condition: boolean, quoi: string) {
  if (!condition) {
    fautes++;
    console.error(`  FAUTE : ${quoi}`);
  }
}
function leve(f: () => unknown): string {
  try {
    f();
    return '';
  } catch (e) {
    return String((e as Error).message);
  }
}

const complet = {
  GITHUB_REF: 'refs/tags/v0.2.0',
  TAURI_SIGNING_PRIVATE_KEY: 'cle-privee',
  IAGENT_MAJ_CLE_PUBLIQUE: 'cle-publique',
  IAGENT_MAJ_ADRESSE: 'https://maj.exemple.fr/desktop/latest.json',
};

verifier(lireReglages({}) === null, 'sans rien, la construction reste ordinaire');
verifier(
  lireReglages({ ...complet, GITHUB_REF: 'refs/heads/main' }) === null,
  "hors d'une étiquette, rien n'est signé pour les postes",
);
const moitie = leve(() => lireReglages({ ...complet, IAGENT_MAJ_CLE_PUBLIQUE: '' }));
verifier(moitie.includes('IAGENT_MAJ_CLE_PUBLIQUE'), 'une version à moitié configurée échoue en nommant ce qui manque');
verifier(
  leve(() => lireReglages({ ...complet, GITHUB_REF: 'refs/tags/essai' })).includes('essai'),
  "une étiquette qui n'est pas une version est refusée",
);
for (const adresse of [
  'http://maj.exemple.fr/latest.json',
  'https://jeton@maj.exemple.fr/latest.json',
  'https://maj.exemple.fr/latest.json?cle=1',
  'https://maj.exemple.fr/desktop/',
]) {
  verifier(
    leve(() => lireReglages({ ...complet, IAGENT_MAJ_ADRESSE: adresse })) !== '',
    `adresse refusée : ${adresse}`,
  );
}

const r = lireReglages(complet)!;
verifier(r.version === '0.2.0', "la version vient de l'étiquette");
const conf = configuration(r);
verifier(conf.bundle.createUpdaterArtifacts === true, 'la version signée produit ses signatures');
verifier(conf.plugins.updater.pubkey === 'cle-publique', 'la clé publique entre dans la configuration');
verifier(
  JSON.stringify(conf.plugins.updater.endpoints) === JSON.stringify([complet.IAGENT_MAJ_ADRESSE]),
  "l'adresse du manifeste entre dans la configuration",
);
verifier(!JSON.stringify(conf).includes('cle-privee'), "la clé privée n'entre jamais dans la configuration");

const m = manifeste(r, 'SIG', new Date('2026-09-24T12:00:00.123Z'));
const poste = m.platforms['windows-x86_64'];
verifier(m.version === '0.2.0', 'le manifeste annonce la version');
verifier(m.pub_date === '2026-09-24T12:00:00Z', 'date au format RFC 3339 sans millisecondes');
verifier(poste.signature === 'SIG', 'le manifeste porte la signature');
verifier(
  poste.url === `https://maj.exemple.fr/desktop/${nomInstalleur('0.2.0')}`,
  "l'installeur est posé à côté du manifeste",
);
verifier(poste.url.endsWith('-setup.exe') && !poste.url.includes(' '), "c'est l'installeur NSIS, sans espace dans le nom");

// Ce que l'application embarque.
const tauri = JSON.parse(readFileSync(new URL('./src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
const updater = tauri.plugins?.updater;
verifier(updater !== undefined, 'plugins.updater existe : sans lui le greffon refuse de démarrer');
verifier(updater?.windows?.installMode === 'passive', 'installation sans clic (passive)');
verifier(
  updater?.pubkey === '' && (updater?.endpoints ?? []).length === 0,
  "ni clé ni adresse au dépôt : elles n'entrent qu'à la construction d'une version signée",
);
verifier(tauri.bundle.targets.includes('nsis'), "l'installeur NSIS est construit");
const capacites = readFileSync(new URL('./src-tauri/capabilities/default.json', import.meta.url), 'utf8');
verifier(!capacites.includes('updater'), "l'écran ne peut ni chercher ni installer : seul le cœur décide");

// Signature des installeurs Windows (Azure Artifact Signing).
const signature = {
  GITHUB_REF: 'refs/tags/v0.2.1',
  AZURE_CLIENT_ID: 'id',
  AZURE_CLIENT_SECRET: 'secret',
  AZURE_TENANT_ID: 'tenant',
  IAGENT_SIGNATURE_POINT: 'https://weu.codesigning.azure.net/',
  IAGENT_SIGNATURE_COMPTE: 'iagent-signature',
  IAGENT_SIGNATURE_PROFIL: 'iagent-public',
};
verifier(lireSignature({}) === null, 'sans réglage de signature, installeurs non signés comme avant');
verifier(
  lireSignature({ ...signature, GITHUB_REF: 'refs/pull/30/merge' }) === null,
  'une PR ne consomme pas le quota de signatures',
);
const { AZURE_CLIENT_SECRET: _s, ...sansSecret } = signature;
verifier(
  leve(() => lireSignature(sansSecret)).includes('AZURE_CLIENT_SECRET'),
  'une signature à moitié configurée échoue en nommant ce qui manque',
);
verifier(
  leve(() => lireSignature({ ...signature, IAGENT_SIGNATURE_POINT: 'http://weu.codesigning.azure.net' })) !== '',
  "le point de terminaison n'est accepté qu'en https chez Azure",
);
verifier(
  leve(() => lireSignature({ ...signature, IAGENT_SIGNATURE_PROFIL: 'x; rm -rf /' })) !== '',
  'un nom de compte ou de profil ne peut rien glisser dans la ligne de commande',
);
const signee = fusionner(configuration(lireReglages(complet)!), lireSignature(signature)!);
verifier(
  signee.bundle.windows.signCommand ===
    'artifact-signing-cli -e https://weu.codesigning.azure.net -a iagent-signature -c iagent-public -d iAgent %1',
  'la commande de signature suit la syntaxe relevée chez Tauri',
);
verifier(
  signee.bundle.createUpdaterArtifacts === true && signee.plugins.updater.endpoints.length === 1,
  'signer les installeurs ne perd rien des réglages de mise à jour',
);
verifier(tauri.bundle.windows?.signCommand === undefined, 'aucune commande de signature écrite au dépôt');

if (fautes > 0) {
  console.error(`check-mise-a-jour : ${fautes} faute(s)`);
  process.exit(1);
}
console.log('check-mise-a-jour : version signée, manifeste et configuration cohérents');
