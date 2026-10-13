#!/bin/sh
# What a service that is NOT delivered in this version of iAgent OS does when
# something starts it: say so, in French, in the journal, and exit 78 (EX_CONFIG).
# No waiting loop and no success code: a unit that reports "active" without doing
# anything would lie to systemctl, to the watchdog and to the factory tests.
# Installed as /usr/lib/iagent/iagent-absent ; the unit passes its own name (%N).
set -eu
nom="${1:-service inconnu}"
version="$(cat /usr/lib/iagent/version 2>/dev/null || echo '?')"
echo "Ce service (${nom}) n'est pas livré dans iAgent OS ${version} : rien ne tourne. Voir box/os/systemd/SERVICES.json." >&2
exit 78
