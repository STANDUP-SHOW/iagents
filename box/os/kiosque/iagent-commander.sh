#!/bin/sh
# The kiosk session of the Box (brief §28-§29): D-Bus and the system's secret
# service for the user session, then cage (one-application Wayland compositor)
# running iagent-desktop in its Box edition. No desktop, no window manager, no
# terminal reachable from the screen. Started by iagent-commander.service on tty1.
# Installed as /usr/lib/iagent/iagent-commander.sh.
set -eu
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export GDK_BACKEND=wayland
# Where iagent-desktop reads what the image ships, and where it writes (chemins.rs: two roots).
export IAGENT_RESSOURCES=/opt/iagent/desktop
export IAGENT_DONNEES=/var/lib/iagent/desktop
# Fallback for integrated GPUs whose DMA-BUF path is not observed yet (non constaté sur BOSGAME / EXR1).
export WEBKIT_DISABLE_DMABUF_RENDERER="${WEBKIT_DISABLE_DMABUF_RENDERER:-1}"
mkdir -p "$IAGENT_DONNEES"
exec dbus-run-session -- sh -c '
  eval "$(gnome-keyring-daemon --start --components=secrets)"
  export GNOME_KEYRING_CONTROL
  exec cage -s -- /usr/bin/iagent-desktop
'
