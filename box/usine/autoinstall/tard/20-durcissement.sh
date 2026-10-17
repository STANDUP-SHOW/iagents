#!/bin/sh
# Late-command 2/4: the appliance has no account, no inbound port, no forwarding,
# a bounded journal (brief §4, §29, §38, §39). Everything comes from
# box/os/durcissement/, copied into the ISO; nothing is typed here.
set -eu
SRC=/opt/iagent-usine/durcissement
sh "$SRC/10-aucun-compte-admin.sh"
install -m 0644 "$SRC/nftables.conf" /etc/nftables.conf
systemctl enable nftables.service
install -m 0644 "$SRC/90-iagent.conf" /etc/sysctl.d/90-iagent.conf
install -d -m 0755 /etc/systemd/journald.conf.d
install -m 0644 "$SRC/journald.conf" /etc/systemd/journald.conf.d/iagent.conf
# The data partition belongs to the appliance user and the services; nobody else reads it.
chown root:iagent /var/lib/iagent
chmod 0750 /var/lib/iagent
install -d -m 0750 -o iagent -g iagent /var/lib/iagent/desktop
# No automatic upgrades from Ubuntu: iagent-updater owns every update (one updater on the machine).
systemctl disable --now unattended-upgrades.service 2>/dev/null || true
systemctl mask apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true
