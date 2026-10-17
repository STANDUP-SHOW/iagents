#!/bin/sh
# Late-command 1/4, inside the installed system: lay down what the ISO carries
# under /opt/iagent-usine (copied from /cdrom/nocloud/iagent by user-data):
# the .deb packages (iagent-device, iagent-updater, iagent-watchdog, iagent-desktop),
# the systemd units, the kiosk scripts, the refusal script, the profiles, the
# factory tests and the operator page. Then enable the services every Station runs.
# One image for every Station (max, 17/10/2026): no profile is chosen here. The
# profile (home, business, enterprise) is set at provisioning on the platform;
# carrying it down to /etc/iagent/profil is not written yet (docs/box-usine.md).
set -eu
SRC=/opt/iagent-usine
MANIFESTE="$SRC/manifeste.json"
[ -f "$MANIFESTE" ] || { echo "manifeste.json manquant dans l'ISO : installation refusée" >&2; exit 1; }

install -d -m 0755 /usr/lib/iagent /opt/iagent /opt/iagent/profils /opt/iagent/materiel /opt/iagent/usine /var/lib/iagent/usine /var/lib/iagent/paquets /etc/iagent
install -m 0755 "$SRC/scripts/iagent-absent.sh" /usr/lib/iagent/iagent-absent
install -m 0755 "$SRC/scripts/iagent-commander.sh" /usr/lib/iagent/iagent-commander.sh
install -m 0755 "$SRC/scripts/iagent-usine.sh" /usr/lib/iagent/iagent-usine.sh
install -m 0644 "$MANIFESTE" /opt/iagent/manifeste.json
install -m 0644 "$SRC/systemd/SERVICES.json" /opt/iagent/SERVICES.json
install -m 0644 "$SRC"/profils/*.json /opt/iagent/profils/
install -m 0644 "$SRC"/materiel/*.json /opt/iagent/materiel/
cp -a "$SRC/tests/." /opt/iagent/usine/
[ -d "$SRC/ui" ] && cp -a "$SRC/ui" /opt/iagent/usine/ui
# The OS version the refusal script prints, read from the manifest, never typed here.
python3 -c 'import json,sys; print(json.load(open("/opt/iagent/manifeste.json"))["os"]["version"])' > /usr/lib/iagent/version

# Packages built by the repository's workflows and placed in the ISO by construire-iso.sh.
for deb in "$SRC"/paquets/*.deb; do
  [ -f "$deb" ] || continue
  # Keep every delivered .deb: iagent-updater rolls back to the previous one from here.
  cp "$deb" /var/lib/iagent/paquets/
done
if ls "$SRC"/paquets/*.deb >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$SRC"/paquets/*.deb
fi

install -m 0644 "$SRC"/systemd/*.service "$SRC"/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload
# Only the services SERVICES.json lists as active are enabled; absent services have no [Install] and could not be anyway.
python3 - <<'PY'
import json, subprocess, sys
s = json.load(open("/opt/iagent/SERVICES.json"))
for nom in s["actifs"]:
    if s["services"].get(nom, {}).get("etat") != "reel":
        print(f"{nom} n'est pas un service réel : refus de l'activer", file=sys.stderr); sys.exit(1)
    subprocess.run(["systemctl", "enable", f"{nom}.service"], check=True)
subprocess.run(["systemctl", "enable", "iagent-updater.timer"], check=True)
PY
systemctl set-default graphical.target
