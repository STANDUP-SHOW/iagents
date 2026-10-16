#!/bin/bash
# Construit l'ISO du iAgent Box Factory Installer (brief §5) :
#   iagent-factory-installer-v<version>-<profil>.iso  +  manifeste.json
#
#   box/usine/iso/construire-iso.sh --profil business --paquets ./paquets --sortie ./dist \
#       [--source-iso ./ubuntu.iso] [--operateur "Léa"] [--lot L-2026-10-A] \
#       [--plateforme https://plateforme.iagent.agency] [--jeton-fichier ./jeton.txt] [--verifier]
#
# Ce que fait le script, dans l'ordre : vérifie l'ISO Ubuntu contre source.json
# (téléchargée si absente), en extrait l'arbre avec xorriso, y ajoute nocloud/
# (user-data, meta-data, clé d'usine aléatoire, et sous iagent/ tout ce que les
# late-commands posent sur la Box), remplace le menu GRUB, puis réassemble une
# ISO amorçable UEFI en rejouant les enregistrements El Torito de l'original
# (xorriso -boot_image any replay). Rien n'est écrit à la main : versions et
# commit viennent de manifeste.ts.
#
# --verifier : n'assemble pas l'ISO, ne télécharge rien ; construit seulement
# l'arbre nocloud/ et le manifeste, pour que controles.yml voie une faute
# d'assemblage sans 3 Go de téléchargement.
#
# Dépendances (Ubuntu) : xorriso, curl, node ≥ 22, git. Non constaté : aucune ISO
# produite par ce script n'a encore démarré sur une machine ; voir essayer-qemu.sh.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPOT="$(cd "$ICI/../../.." && pwd)"
PROFIL="" ; PAQUETS="" ; SORTIE="$DEPOT/dist" ; SOURCE_ISO="" ; OPERATEUR="" ; LOT="" ; PLATEFORME="" ; JETON_FICHIER="" ; VERIFIER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --profil) PROFIL="$2"; shift 2 ;;
    --paquets) PAQUETS="$2"; shift 2 ;;
    --sortie) SORTIE="$2"; shift 2 ;;
    --source-iso) SOURCE_ISO="$2"; shift 2 ;;
    --operateur) OPERATEUR="$2"; shift 2 ;;
    --lot) LOT="$2"; shift 2 ;;
    --plateforme) PLATEFORME="$2"; shift 2 ;;
    --jeton-fichier) JETON_FICHIER="$2"; shift 2 ;;
    --verifier) VERIFIER=1; shift ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
[ -f "$DEPOT/box/profils/$PROFIL.json" ] || { echo "--profil home|pro|business attendu (lu : « $PROFIL »)" >&2; exit 2; }
for outil in xorriso node git; do command -v "$outil" >/dev/null || { echo "outil manquant : $outil" >&2; exit 2; }; done

VERSION="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).version)' "$ICI/installateur.json")"
NOM_ISO="iagent-factory-installer-v${VERSION}-${PROFIL}.iso"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT
NOCLOUD="$TRAVAIL/nocloud"
mkdir -p "$NOCLOUD/iagent" "$SORTIE"

# --- nocloud/ : la graine de l'autoinstall ------------------------------------
cp "$ICI/../autoinstall/user-data" "$ICI/../autoinstall/meta-data" "$NOCLOUD/"
# La clé d'usine de DATA : aléatoire à chaque construction, remplacée puis retirée par tard/30-tpm.sh.
head -c 48 /dev/urandom | base64 -w0 > "$NOCLOUD/cle-usine"
chmod 0600 "$NOCLOUD/cle-usine"

I="$NOCLOUD/iagent"
mkdir -p "$I/tard" "$I/scripts" "$I/systemd" "$I/durcissement" "$I/profils" "$I/materiel" "$I/tests" "$I/paquets"
printf '%s\n' "$PROFIL" > "$I/profil"
cp "$ICI/../autoinstall/tard/"*.sh "$I/tard/"
cp "$DEPOT/box/services/absent/iagent-absent.sh" "$DEPOT/box/os/kiosque/iagent-commander.sh" "$DEPOT/box/os/kiosque/iagent-usine.sh" "$I/scripts/"
cp "$DEPOT/box/os/systemd/"*.service "$DEPOT/box/os/systemd/"*.timer "$DEPOT/box/os/systemd/SERVICES.json" "$I/systemd/"
cp "$DEPOT/box/os/durcissement/"* "$I/durcissement/"
cp "$DEPOT/box/profils/"*.json "$I/profils/"
cp "$DEPOT/box/materiel/"*.json "$I/materiel/"
cp "$DEPOT/box/usine/tests/"*.py "$I/tests/"
rm -f "$I/tests/test_usine.py" "$I/profils/schema.json" "$I/materiel/schema.json"
if [ -d "$DEPOT/box/usine/ui/dist" ]; then cp -a "$DEPOT/box/usine/ui/dist" "$I/ui"; else echo "avertissement : box/usine/ui/dist absent, l'écran opérateur ne sera pas dans l'ISO (npm --prefix box/usine/ui run build)" >&2; fi
if [ -n "$PAQUETS" ]; then
  n=0; for deb in "$PAQUETS"/*.deb; do [ -f "$deb" ] && { cp "$deb" "$I/paquets/"; n=$((n+1)); }; done
  echo "$n paquet(s) .deb embarqué(s)"
else
  echo "avertissement : aucun dossier --paquets ; l'ISO n'installera ni iagent-device ni iagent-desktop (les tests d'usine le diront)" >&2
fi
# La graine d'usine : opérateur, lot, adresse de la plateforme ; le jeton d'usine n'y entre que si un fichier le porte.
node -e '
const [op, lot, plat, jetonFichier] = process.argv.slice(1);
const g = { operateur: op || null, lot: lot || null, plateforme: plat || null, jeton: null };
if (jetonFichier) g.jeton = require("fs").readFileSync(jetonFichier, "utf8").trim();
process.stdout.write(JSON.stringify(g, null, 2) + "\n");
' "$OPERATEUR" "$LOT" "$PLATEFORME" "$JETON_FICHIER" > "$I/usine.json"
chmod 0600 "$I/usine.json"

# --- le manifeste, depuis les fichiers qui portent chaque version ---------------
node --experimental-strip-types "$ICI/manifeste.ts" --profil "$PROFIL" --iso "$NOM_ISO" > "$I/manifeste.json"
cp "$I/manifeste.json" "$SORTIE/manifeste-${PROFIL}.json"
echo "manifeste : $(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")); console.log(m.build_id, "os", m.os.version, "commander", m.composants.commander.version ?? "-", "device", m.composants.device.version ?? "-")' "$I/manifeste.json")"

if [ "$VERIFIER" = 1 ]; then
  (cd "$NOCLOUD" && find . -type f | sort) > "$SORTIE/arbre-nocloud-${PROFIL}.txt"
  echo "--verifier : arbre nocloud/ et manifeste construits ($(wc -l < "$SORTIE/arbre-nocloud-${PROFIL}.txt") fichiers), ISO non assemblée."
  exit 0
fi

# --- l'ISO Ubuntu, vérifiée contre source.json ---------------------------------
lire_source() { node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[process.argv[2]])' "$ICI/source.json" "$1"; }
ATTENDU="$(lire_source sha256)"
[ -n "$SOURCE_ISO" ] || SOURCE_ISO="$SORTIE/$(lire_source fichier)"
if [ ! -f "$SOURCE_ISO" ]; then
  command -v curl >/dev/null || { echo "curl manquant pour télécharger l'ISO Ubuntu" >&2; exit 2; }
  echo "téléchargement de $(lire_source url)"
  curl -fL --retry 3 -o "$SOURCE_ISO.partiel" "$(lire_source url)" && mv "$SOURCE_ISO.partiel" "$SOURCE_ISO"
fi
LU="$(sha256sum "$SOURCE_ISO" | cut -d' ' -f1)"
[ "$LU" = "$ATTENDU" ] || { echo "ISO Ubuntu refusée : SHA-256 $LU, attendu $ATTENDU (source.json)" >&2; exit 1; }

# --- extraction, greffe, réassemblage ---------------------------------------------
ARBRE="$TRAVAIL/arbre"
mkdir -p "$ARBRE"
xorriso -osirrox on -indev "$SOURCE_ISO" -extract / "$ARBRE" 2>/dev/null
chmod -R u+w "$ARBRE"
cp -a "$NOCLOUD" "$ARBRE/nocloud"
sed "s/__PROFIL__/${PROFIL}/g" "$ICI/grub.cfg" > "$ARBRE/boot/grub/grub.cfg"
# Les enregistrements d'amorçage (El Torito BIOS + EFI) de l'ISO d'origine, rejoués tels quels.
xorriso -indev "$SOURCE_ISO" -report_el_torito as_mkisofs > "$TRAVAIL/boot.args" 2>/dev/null
# Les options d'amorçage d'origine renvoient à des fichiers de l'ISO source ; -boot_image any replay les reprend par -indev.
xorriso -indev "$SOURCE_ISO" -outdev "$SORTIE/$NOM_ISO" \
  -volid "IAGENT-FACTORY" -boot_image any replay \
  -map "$ARBRE/nocloud" /nocloud -map "$ARBRE/boot/grub/grub.cfg" /boot/grub/grub.cfg \
  -end 2>&1 | tail -n 3
sha256sum "$SORTIE/$NOM_ISO" > "$SORTIE/$NOM_ISO.sha256"
echo "ISO : $SORTIE/$NOM_ISO ($(du -h "$SORTIE/$NOM_ISO" | cut -f1))"
