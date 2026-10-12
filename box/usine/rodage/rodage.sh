#!/bin/bash
# Rodage d'une Box (brief §47) : charge processeur et mémoire, disque, réseau,
# relevé des températures, et redémarrages, pendant la durée demandée.
#   rodage.sh --heures 24 [--redemarrages 10] [--iperf <hote>] [--sortie /var/lib/iagent/usine/rodage]
# Prototypes : 24 h au moins ; qualification d'une plateforme matérielle : 72 h.
# Écrit une ligne JSON par cycle dans <sortie>/rodage.ndjson et un bilan dans
# <sortie>/rodage.json (cycles, températures max, erreurs disque, échecs
# réseau). Un redémarrage demandé reprend le compte depuis le fichier d'état :
# relancer le script après le démarrage (une unité à écrire quand la première
# machine sera là). Non constaté : jamais lancé sur une Box.
set -euo pipefail
HEURES=24 ; REDEMARRAGES=0 ; IPERF="" ; SORTIE=/var/lib/iagent/usine/rodage
while [ $# -gt 0 ]; do
  case "$1" in
    --heures) HEURES="$2"; shift 2 ;;
    --redemarrages) REDEMARRAGES="$2"; shift 2 ;;
    --iperf) IPERF="$2"; shift 2 ;;
    --sortie) SORTIE="$2"; shift 2 ;;
    *) echo "argument inconnu : $1" >&2; exit 2 ;;
  esac
done
for outil in stress-ng fio sensors; do command -v "$outil" >/dev/null || { echo "outil manquant : $outil (box/os/base/paquets.txt)" >&2; exit 2; }; done
mkdir -p "$SORTIE"
ETAT="$SORTIE/etat.json"
[ -f "$ETAT" ] || echo '{"cycles":0,"redemarrages_faits":0,"temp_max":0,"erreurs_disque":0,"echecs_reseau":0,"debut":"'"$(date -u +%FT%TZ)"'"}' > "$ETAT"
lire() { python3 -c "import json,sys; print(json.load(open('$ETAT'))['$1'])"; }
ecrire() { python3 - "$ETAT" "$1" "$2" <<'PY'
import json, sys
f, cle, val = sys.argv[1:]
d = json.load(open(f)); d[cle] = json.loads(val); json.dump(d, open(f, "w"))
PY
}
FIN=$(( $(date -d "$(lire debut)" +%s) + HEURES * 3600 ))
CYCLE=$(lire cycles)
while [ "$(date +%s)" -lt "$FIN" ]; do
  CYCLE=$((CYCLE + 1))
  debut_cycle=$(date -u +%FT%TZ)
  # 10 min de charge processeur + mémoire, 2 min de disque (lecture/écriture aléatoire sur DATA), relevé de température toutes les minutes.
  stress-ng --cpu 0 --vm 2 --vm-bytes 60% --timeout 600s --metrics-brief > "$SORTIE/stress-$CYCLE.log" 2>&1 || ecrire erreurs_disque "$(( $(lire erreurs_disque) ))"
  if ! fio --name=rodage --directory=/var/lib/iagent/usine/rodage --size=1G --rw=randrw --bs=4k --iodepth=16 --runtime=120 --time_based --verify=crc32c --output="$SORTIE/fio-$CYCLE.log" >/dev/null 2>&1; then
    ecrire erreurs_disque "$(( $(lire erreurs_disque) + 1 ))"
  fi
  rm -f /var/lib/iagent/usine/rodage/rodage.0.0
  temp=$(sensors -u 2>/dev/null | awk '/_input/ {if ($2 > m) m = $2} END {print int(m + 0)}')
  [ "${temp:-0}" -gt "$(lire temp_max)" ] && ecrire temp_max "$temp"
  if [ -n "$IPERF" ]; then iperf3 -c "$IPERF" -t 20 > "$SORTIE/iperf-$CYCLE.log" 2>&1 || ecrire echecs_reseau "$(( $(lire echecs_reseau) + 1 ))"; fi
  echo "{\"cycle\":$CYCLE,\"debut\":\"$debut_cycle\",\"fin\":\"$(date -u +%FT%TZ)\",\"temp_max_c\":${temp:-null}}" >> "$SORTIE/rodage.ndjson"
  ecrire cycles "$CYCLE"
  faits=$(lire redemarrages_faits)
  if [ "$faits" -lt "$REDEMARRAGES" ]; then
    ecrire redemarrages_faits "$((faits + 1))"
    echo "redémarrage $((faits + 1))/$REDEMARRAGES ; relancer rodage.sh après le démarrage"
    systemctl reboot
    exit 0
  fi
done
python3 - "$ETAT" "$SORTIE/rodage.json" "$HEURES" <<'PY'
import json, sys
etat = json.load(open(sys.argv[1]))
etat["heures_demandees"] = int(sys.argv[3])
etat["verdict"] = "passe" if etat["erreurs_disque"] == 0 and etat["echecs_reseau"] == 0 and etat["temp_max"] < 95 else "echec"
json.dump(etat, open(sys.argv[2], "w"), indent=2)
print(json.dumps(etat, indent=2))
PY
