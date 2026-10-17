"""Test d'usine « reseau » (brief §6, §13) : un lien actif, le nom de la
plateforme se résout, et `GET /controle/cle-publique` répond en https (200, ou
503 si la plateforme n'a pas sa clé de signature : elle est joignable quand même,
et le détail le dit)."""
import json
import socket
import os
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import adresse_plateforme, arguments, commande, emettre, resultat  # noqa: E402

LIBELLE = "Réseau sortant et plateforme joignable"

if __name__ == "__main__":
    debut = time.monotonic()
    args = arguments(__doc__)
    code, sortie = commande(["ip", "-j", "link"])
    liens = []
    if code == 0:
        try:
            liens = [l["ifname"] for l in json.loads(sortie) if l.get("ifname") != "lo" and "UP" in l.get("flags", []) and l.get("operstate") in ("UP", "UNKNOWN")]
        except ValueError:
            liens = []
    if not liens:
        emettre(resultat("reseau", LIBELLE, "echec", debut, "aucun lien réseau actif (ip -j link)"))
        sys.exit(0)
    adresse = adresse_plateforme(args)
    if not adresse:
        emettre(resultat("reseau", LIBELLE, "echec", debut, f"liens {', '.join(liens)} ; adresse de la plateforme inconnue (/etc/iagent/device.json)"))
        sys.exit(0)
    hote = urlparse(adresse).hostname or ""
    try:
        socket.getaddrinfo(hote, 443)
    except socket.gaierror as e:
        emettre(resultat("reseau", LIBELLE, "echec", debut, f"liens {', '.join(liens)} ; {hote} ne se résout pas ({e})"))
        sys.exit(0)
    try:
        with urllib.request.urlopen(adresse.rstrip("/") + "/controle/cle-publique", timeout=15) as r:
            statut = r.status
    except urllib.error.HTTPError as e:
        statut = e.code
    except (urllib.error.URLError, OSError) as e:
        emettre(resultat("reseau", LIBELLE, "echec", debut, f"liens {', '.join(liens)} ; {hote} injoignable en https : {e}"))
        sys.exit(0)
    if statut == 200:
        emettre(resultat("reseau", LIBELLE, "passe", debut, f"liens {', '.join(liens)} ; {hote} répond (clé publique servie)"))
    elif statut == 503:
        emettre(resultat("reseau", LIBELLE, "passe", debut, f"liens {', '.join(liens)} ; {hote} répond mais n'a pas sa clé de signature (503) : à poser avant toute Box active"))
    else:
        emettre(resultat("reseau", LIBELLE, "echec", debut, f"{hote} répond {statut} sur /controle/cle-publique"))
