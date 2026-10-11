#!/bin/sh
# Late-command 3/4: the key of the DATA partition (brief §9, §10). The installer
# opened DATA with the factory key file of this ISO (/cdrom/nocloud/cle-usine,
# random per build). Here, inside the installed system:
#   1. a recovery key is enrolled (systemd-cryptenroll --recovery-key) and shown
#      ONCE to the factory log file that the operator exports; never stored on the
#      Box, never sent to the platform in Phase 0 (see box/securite/luks-tpm.md);
#   2. the TPM 2.0 seals a key bound to PCR 7 (Secure Boot state), so the disk
#      opens alone on this machine and on no other;
#   3. the factory key is removed from the LUKS header.
# Without a TPM (VM without swtpm, BIOS with TPM off) the script says so in
# /var/lib/iagent/usine/etat.json and keeps the recovery key as the only slot:
# the factory test « tpm » then fails, as it must.
# Non constaté sur machine : this script has not run on a BOSGAME or an EXR1.
set -eu
DATA=/dev/disk/by-partlabel/DATA
CLE_USINE=/cdrom/nocloud/cle-usine
ETAT=/var/lib/iagent/usine
install -d -m 0750 "$ETAT"
JOURNAL="$ETAT/chiffrement.log"

# /cdrom of the live system is visible from the target through curtin's bind mount.
[ -f "$CLE_USINE" ] || CLE_USINE=/target/cdrom/nocloud/cle-usine
if [ ! -f "$CLE_USINE" ]; then
  echo '{"tpm":"non_constate","motif":"clé d'usine introuvable : le réenrôlement n'a pas eu lieu"}' > "$ETAT/etat.json"
  echo "clé d'usine introuvable, DATA garde la clé de l'ISO" >> "$JOURNAL"
  exit 0
fi

# 1. Recovery key, printed once into the factory log (exported with the report, see securite/luks-tpm.md).
SECOURS="$(systemd-cryptenroll --unlock-key-file="$CLE_USINE" --recovery-key "$DATA" 2>>"$JOURNAL" | tail -n 1)"
if [ -n "$SECOURS" ]; then
  printf 'CLE DE SECOURS DATA (a imprimer, jamais a garder sur la Box) : %s\n' "$SECOURS" > "$ETAT/cle-de-secours.txt"
  chmod 0600 "$ETAT/cle-de-secours.txt"
fi

# 2. TPM 2.0 sealing, PCR 7.
if systemd-cryptenroll --unlock-key-file="$CLE_USINE" --tpm2-device=auto --tpm2-pcrs=7 "$DATA" >>"$JOURNAL" 2>&1; then
  printf '{"tpm":"scelle","pcrs":[7]}\n' > "$ETAT/etat.json"
  # crypttab: open by TPM at boot, recovery key by hand if the TPM refuses.
  printf 'donnees PARTLABEL=DATA none luks,tpm2-device=auto\n' > /etc/crypttab
else
  printf '{"tpm":"non_constate","motif":"systemd-cryptenroll --tpm2-device=auto a échoué : voir chiffrement.log"}\n' > "$ETAT/etat.json"
  printf 'donnees PARTLABEL=DATA none luks\n' > /etc/crypttab
fi

# 3. The factory key leaves the header: only the TPM (and the printed recovery key) can open DATA now.
if [ -n "$SECOURS" ]; then
  systemd-cryptenroll --unlock-key-file="$CLE_USINE" --wipe-slot=password "$DATA" >>"$JOURNAL" 2>&1 || echo "wipe-slot=password refusé" >> "$JOURNAL"
fi
update-initramfs -u >>"$JOURNAL" 2>&1
