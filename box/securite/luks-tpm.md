# Chiffrement du stockage client et TPM (brief §9, §10)

**Statut : conçu et scripté, non constaté sur machine.** Rien de cette page n'a
tourné sur un BOSGAME M4 Neo ni sur un EXR1 ; `box/usine/iso/essayer-qemu.sh`
(swtpm) est le premier endroit où l'observer, et le test d'usine `tpm`
(`box/usine/tests/30_tpm.py`) est ce qui le constate Box par Box.

## Ce que fait l'installation

1. L'autoinstall (`box/usine/autoinstall/user-data`) crée `DATA` en **LUKS2**
   (`type: dm_crypt`) avec une **clé d'usine aléatoire**, écrite par
   `construire-iso.sh` dans `/cdrom/nocloud/cle-usine` et différente à chaque ISO.
   `SYSTEM_A` reste en clair : il ne porte que l'OS et les logiciels iAgent,
   identiques sur toutes les Box ; ce qui est au client est sur `DATA`
   (`/var/lib/iagent` : espaces de navigateur, bases, mémoire des agents, cache,
   réglages, identité de la Box).
2. `tard/30-tpm.sh`, dans le système installé :
   - enrôle une **clé de secours** (`systemd-cryptenroll --recovery-key`) et
     l'écrit une seule fois dans `/var/lib/iagent/usine/cle-de-secours.txt`
     (0600), que l'opérateur **imprime et range avec le dossier de la Box**, puis
     efface (procédure ci-dessous) ;
   - **scelle une clé au TPM 2.0** (`systemd-cryptenroll --tpm2-device=auto
     --tpm2-pcrs=7`) : PCR 7 est l'état Secure Boot, donc le disque s'ouvre seul
     sur cette machine, avec ce firmware, et ne s'ouvre pas sur une autre ;
   - **retire la clé d'usine** du header LUKS (`--wipe-slot=password`) ;
   - écrit `/etc/crypttab` (`tpm2-device=auto`) et refait l'initramfs.
3. Sans TPM (BIOS, VM sans swtpm), le script **ne plante pas et ne laisse pas la
   clé d'usine** : il écrit `{"tpm":"non_constate"}` dans
   `/var/lib/iagent/usine/etat.json`, garde la clé de secours comme seul moyen
   d'ouvrir, et le test d'usine `tpm` rend `echec` — la Box n'est pas qualifiée.

Résultat visé (brief §9) : SSD retiré, posé dans un autre ordinateur →
**DONNÉES ILLISIBLES**.

## Pourquoi systemd-cryptenroll et pas clevis

Les deux font la même chose (une clé scellée au TPM qui ouvre un LUKS au
démarrage). `systemd-cryptenroll` est dans systemd, déjà sur l'image, sans
service de plus ni dépendance réseau ; clevis vise d'abord le déverrouillage
par un serveur (tang), que la Box n'a pas et ne doit pas avoir (brief §38 :
aucun port entrant). Si une Box doit un jour se déverrouiller sans TPM depuis
la plateforme, c'est clevis/tang qu'il faudra regarder, pas avant.

## La clé de secours : qui la garde, qui ne la voit pas

- **Le client ne la voit jamais** (brief §9). Elle n'est ni sur la Box après
  l'usine, ni dans le rapport d'usine, ni dans la télémétrie.
- **Phase 0** : imprimée à l'atelier depuis `cle-de-secours.txt`, mise sous
  enveloppe au nom de la `reference` de la Box, le fichier effacé
  (`shred -u`) avant l'expédition. C'est une procédure humaine ; elle n'est pas
  encore tenue par le code.
- **Phase 1 (à faire)** : séquestre chiffré. La Box chiffre la clé de secours
  pour une clé X25519 de la plateforme (`PLATEFORME_CLE_SECOURS`, nouvelle, à
  part de la clé de signature) et la dépose par une route `box` ; le
  back-office ne la rend qu'à un administrateur, avec trace d'audit. Même
  recette que les Skill Packs (`scellement.ts`), dans l'autre sens.

## Quand le TPM refuse d'ouvrir (changement de firmware, Secure Boot touché)

PCR 7 a changé → le TPM ne rend plus la clé → systemd demande la clé de
secours sur la console. Procédure atelier : saisir la clé de secours, puis
réenrôler le TPM (`systemd-cryptenroll --wipe-slot=tpm2 --tpm2-device=auto
--tpm2-pcrs=7 /dev/disk/by-partlabel/DATA`). Une mise à jour de firmware
n'est donc jamais poussée sans cette procédure prête. **Rotation** : le même
geste, sur demande du Control Plane, quand une rotation planifiée l'exige
(brief §9) — route à écrire.

## RMA

Voir `rma.md` : une Box qui revient a ses données **détruites** par la
réinitialisation d'usine (brief §36), jamais lues ; la clé de secours de
l'enveloppe est détruite avec.
