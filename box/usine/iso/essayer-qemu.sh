#!/bin/bash
# Démarre l'ISO du Factory Installer dans QEMU, comme une Box : UEFI (OVMF),
# TPM 2.0 émulé (swtpm), disque NVMe de 64 Go, réseau utilisateur avec la
# plateforme de l'hôte joignable en https://10.0.2.2:8443 si vous la lancez
# (voir box/README.md). Premier passage : l'installation (15-25 min selon le
# miroir apt), puis redémarrage sur le disque et le mode usine sur la console.
#
#   box/usine/iso/essayer-qemu.sh dist/iagent-factory-installer-v0.1.0-business.iso [--sans-ecran]
#
# Dépendances (Ubuntu) : qemu-system-x86, ovmf, swtpm, swtpm-tools. Non constaté :
# ce script a été écrit sans machine Linux sous la main ; sa première exécution
# est l'étape 13 du plan.
set -euo pipefail
[ $# -ge 1 ] || { echo "usage : essayer-qemu.sh <chemin de l'ISO> [--sans-ecran]" >&2; exit 2; }
ISO="$1"
shift || true
ECRAN="-display gtk"
for a in "$@"; do [ "$a" = "--sans-ecran" ] && ECRAN="-display none"; done
TRAVAIL="${IAGENT_QEMU_DIR:-$HOME/.cache/iagent-qemu}"
mkdir -p "$TRAVAIL/tpm"
DISQUE="$TRAVAIL/box.qcow2"
[ -f "$DISQUE" ] || qemu-img create -f qcow2 "$DISQUE" 64G
OVMF_CODE="$(ls /usr/share/OVMF/OVMF_CODE_4M.fd /usr/share/OVMF/OVMF_CODE.fd 2>/dev/null | head -n1)"
OVMF_VARS_SRC="$(ls /usr/share/OVMF/OVMF_VARS_4M.fd /usr/share/OVMF/OVMF_VARS.fd 2>/dev/null | head -n1)"
[ -n "$OVMF_CODE" ] || { echo "OVMF introuvable : apt-get install ovmf" >&2; exit 2; }
[ -f "$TRAVAIL/ovmf_vars.fd" ] || cp "$OVMF_VARS_SRC" "$TRAVAIL/ovmf_vars.fd"

# Le TPM 2.0 émulé : une prise UNIX que QEMU joint.
swtpm socket --tpmstate dir="$TRAVAIL/tpm" --ctrl type=unixio,path="$TRAVAIL/swtpm.sock" --tpm2 --daemon --log level=1
trap 'pkill -f "swtpm socket --tpmstate dir=$TRAVAIL/tpm" || true' EXIT

ACCEL="tcg"; [ -w /dev/kvm ] && ACCEL="kvm"
exec qemu-system-x86_64 \
  -machine q35,accel="$ACCEL" -cpu max -smp 2 -m 8G \
  -drive if=pflash,format=raw,readonly=on,file="$OVMF_CODE" \
  -drive if=pflash,format=raw,file="$TRAVAIL/ovmf_vars.fd" \
  -chardev socket,id=chrtpm,path="$TRAVAIL/swtpm.sock" -tpmdev emulator,id=tpm0,chardev=chrtpm -device tpm-tis,tpmdev=tpm0 \
  -drive file="$DISQUE",if=none,id=nvme0,format=qcow2 -device nvme,drive=nvme0,serial=IAGENT-BANC-0001 \
  -drive file="$ISO",media=cdrom,if=none,id=cd0 -device ide-cd,drive=cd0,bootindex=1 \
  -netdev user,id=n0 -device virtio-net-pci,netdev=n0 \
  -device virtio-vga -device qemu-xhci -device usb-kbd -device usb-tablet \
  -audiodev none,id=snd0 \
  -serial mon:stdio $ECRAN
