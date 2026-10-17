// L'autoinstall (box/usine/autoinstall/user-data) installe-t-il la Box voulue ?
//
// Une faute dans ce YAML se découvre vingt minutes après le début d'une
// installation, sur une machine sans clavier ni compte. Et une liste de paquets
// recopiée perd des lignes : le 23/09/2026, celle du flux d'intégration en
// avait perdu deux sur sept. Ce banc relit user-data sans parseur YAML (aucune
// dépendance : des motifs sur un fichier dont la forme est la nôtre) : cinq
// partitions nommées, DATA sur dm_crypt avec la clé d'usine, aucun serveur SSH,
// aucun mot de passe utilisable, la liste de paquets ÉGALE à
// box/os/base/paquets.txt, et chaque script de late-commands présent, exécutable
// par sh, et cité une fois.
//   node --experimental-strip-types box/check-autoinstall.ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compteur, estMain, RACINE } from './commun.ts';

export function lancer(): number {
  const { verifier, bilan } = compteur('autoinstall');
  const texte = readFileSync(join(RACINE, 'box/usine/autoinstall/user-data'), 'utf8');
  const lignes = texte.split('\n');
  verifier('la première ligne est #cloud-config', lignes[0] === '#cloud-config');
  verifier('autoinstall version 1', /^autoinstall:\n(?:[\s\S]*?)^\s+version: 1$/m.test(texte));
  verifier('aucune section interactive', /interactive-sections: \[\]/.test(texte));
  verifier('image minimale', /id: ubuntu-server-minimal/.test(texte));

  const noms = [...texte.matchAll(/^\s+partition_name: ([A-Z_]+)$/gm)].map((m) => m[1]);
  verifier('cinq partitions : EFI, SYSTEM_A, SYSTEM_B, RECOVERY, DATA', noms.join() === 'EFI,SYSTEM_A,SYSTEM_B,RECOVERY,DATA', noms.join(', '));
  verifier('autant de `type: partition` que de noms', (texte.match(/^\s+- type: partition$/gm) ?? []).length === 5);
  verifier('DATA passe par dm_crypt (LUKS), avec la clé d’usine de l’ISO', /- type: dm_crypt\n\s+id: c-data\n\s+volume: p-data\n[\s\S]*?keyfile: \/cdrom\/nocloud\/cle-usine/.test(texte));
  verifier('le volume chiffré est formaté et monté sur /var/lib/iagent', /volume: c-data\n\s+fstype: ext4\n\s+label: DATA/.test(texte) && /device: f-data\n\s+path: \/var\/lib\/iagent/.test(texte));
  verifier('SYSTEM_B n’est ni formatée ni montée (réservée au futur A/B)', !/volume: p-sys-b/.test(texte));
  verifier('la racine est SYSTEM_A, l’EFI sur /boot/efi, RECOVERY sur /recovery', /device: f-sys-a\n\s+path: \/$/m.test(texte) && /device: f-efi\n\s+path: \/boot\/efi/.test(texte) && /device: f-rec\n\s+path: \/recovery/.test(texte));
  verifier('pas de swap', /swap:\n\s+size: 0/.test(texte));

  verifier('aucun serveur SSH', /install-server: false/.test(texte) && /allow-pw: false/.test(texte));
  const motsDePasse = [...texte.matchAll(/^\s+password: (.*)$/gm)].map((m) => m[1]);
  verifier('le seul mot de passe est « ! » (compte verrouillé)', motsDePasse.length === 1 && motsDePasse[0] === '"!"', motsDePasse.join(' | '));
  verifier('aucun condensé de mot de passe, aucune clé', !/\$6\$|\$y\$|ssh-ed25519|ssh-rsa|BEGIN /.test(texte));
  verifier('le compte temporaire s’appelle iagent-usine et le durcissement le retire', /username: iagent-usine/.test(texte)
    && /deluser --remove-home iagent-usine/.test(readFileSync(join(RACINE, 'box/os/durcissement/10-aucun-compte-admin.sh'), 'utf8')));

  const paquetsAttendus = readFileSync(join(RACINE, 'box/os/base/paquets.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const bloc = texte.match(/^\s+packages:\n((?:\s+- .+\n)+)/m);
  const paquets = bloc ? bloc[1].split('\n').map((l) => l.replace(/^\s+- /, '').trim()).filter(Boolean) : [];
  verifier(`la liste de paquets est celle de paquets.txt, à l'identique (${paquetsAttendus.length})`, paquets.join('\n') === paquetsAttendus.join('\n'),
    `manquent : ${paquetsAttendus.filter((p) => !paquets.includes(p)).join(', ') || '—'} ; en trop : ${paquets.filter((p) => !paquetsAttendus.includes(p)).join(', ') || '—'}`);

  const cites = [...texte.matchAll(/curtin in-target --target=\/target -- sh \/opt\/iagent-usine\/tard\/([0-9]{2}-[a-z-]+\.sh)/g)].map((m) => m[1]);
  const presents = readdirSync(join(RACINE, 'box/usine/autoinstall/tard')).filter((f) => f.endsWith('.sh')).sort();
  verifier('les scripts de late-commands sont exactement ceux de tard/, dans l’ordre', cites.join() === presents.join(), `cités : ${cites.join(', ')} ; présents : ${presents.join(', ')}`);
  verifier('l’arbre de l’ISO est copié avant le premier script', texte.indexOf('cp -a /cdrom/nocloud/iagent/.') < texte.indexOf('tard/10-services.sh'));
  for (const f of presents) {
    const s = readFileSync(join(RACINE, 'box/usine/autoinstall/tard', f), 'utf8');
    verifier(`${f} : #!/bin/sh et set -eu`, s.startsWith('#!/bin/sh') && /^set -eu/m.test(s));
    const installs = s.split('\n').filter((l) => /apt-get install/.test(l));
    verifier(`${f} : apt n'installe que les .deb de l'ISO (la liste de paquets vit dans paquets.txt)`, installs.every((l) => /\/paquets\/\*\.deb/.test(l)), installs.join(' | '));
  }
  const tpm = readFileSync(join(RACINE, 'box/usine/autoinstall/tard/30-tpm.sh'), 'utf8');
  verifier('30-tpm.sh scelle au TPM (PCR 7), enrôle une clé de secours et retire la clé d’usine', /--tpm2-device=auto --tpm2-pcrs=7/.test(tpm) && /--recovery-key/.test(tpm) && /--wipe-slot=password/.test(tpm));
  verifier('30-tpm.sh écrit son état plutôt que de planter sans TPM', /non_constate/.test(tpm) && /etat\.json/.test(tpm));
  verifier('un redémarrage ferme l’installation', /shutdown: reboot/.test(texte));
  const grub = readFileSync(join(RACINE, 'box/usine/iso/grub.cfg'), 'utf8');
  verifier('GRUB démarre l’autoinstall seul, graine nocloud sur le cédérom, en trois secondes', /set timeout=3/.test(grub) && /autoinstall ds=nocloud\\;s=\/cdrom\/nocloud\//.test(grub) && /__PROFIL__/.test(grub));
  verifier('construire-iso.sh existe et vérifie le SHA-256 de la source', existsSync(join(RACINE, 'box/usine/iso/construire-iso.sh')) && /sha256sum/.test(readFileSync(join(RACINE, 'box/usine/iso/construire-iso.sh'), 'utf8')));
  return bilan();
}

if (estMain(import.meta.url)) process.exit(lancer() > 0 ? 1 : 0);
