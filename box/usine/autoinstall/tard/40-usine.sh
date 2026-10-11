#!/bin/sh
# Late-command 4/4: arm the factory mode of the first boot (brief §41, §44).
# The Box is not qualified: no marker, so iagent-usine.service takes tty1 and
# iagent-commander.service stays off by its condition. The operator, the lot and
# the platform address come from the ISO's seed (nocloud/usine.json, written by
# construire-iso.sh from the workshop's choices); the factory token is read from
# the same seed by iagent-device at enrolment and deleted right after.
set -eu
SRC=/opt/iagent-usine
install -d -m 0750 /var/lib/iagent/usine /etc/iagent
rm -f /var/lib/iagent/usine/qualifiee
if [ -f "$SRC/usine.json" ]; then
  install -m 0600 "$SRC/usine.json" /etc/iagent/usine.json
fi
# What the ISO carried is no longer needed on the installed system, except what 10-services.sh copied.
rm -rf "$SRC/paquets"
systemctl enable iagent-usine.service
