#!/bin/sh
# Factory mode of the first boot (brief §44): iagent-device serves the operator
# page on 127.0.0.1 and runs the tests; cog (WPE WebKit) shows it full screen in
# cage. It ends when the report is accepted: iagent-device writes the marker
# /var/lib/iagent/usine/qualifiee, and iagent-commander takes tty1 at next boot.
# Installed as /usr/lib/iagent/iagent-usine.sh.
set -eu
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
/usr/bin/iagent-device usine --ecouter 127.0.0.1:8787 &
agent=$!
trap 'kill "$agent" 2>/dev/null || true' EXIT INT TERM
# Give the local server a moment; cog retries by itself if the page is not up yet.
sleep 1
exec cage -s -- cog --platform=wl http://127.0.0.1:8787/
