#!/bin/sh
# Run by the autoinstall late-commands inside the installed system (chroot):
# iAgent OS has no account a client could log into (brief §4, §29). The
# installer's temporary user is removed, root stays locked, no sudoers entry
# remains, no SSH server, no login prompt on the consoles the kiosk owns.
set -eu
if id iagent-usine >/dev/null 2>&1; then deluser --remove-home iagent-usine; fi
passwd -l root
rm -f /etc/sudoers.d/90-cloud-init-users
# The kiosk owns tty1; no login prompt there, nor on the other consoles.
for n in 1 2 3 4 5 6; do systemctl mask "getty@tty${n}.service"; done
systemctl disable --now ssh.service 2>/dev/null || true
systemctl mask ssh.service 2>/dev/null || true
# The appliance user: no password, no shell login, owns the kiosk session only.
if ! id iagent >/dev/null 2>&1; then adduser --system --group --home /var/lib/iagent/desktop --shell /usr/sbin/nologin iagent; fi
usermod -aG audio,video,render,input iagent
