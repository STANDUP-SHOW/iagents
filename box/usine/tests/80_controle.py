"""Test d'usine « controle » (brief §13-§15) : la Box parle à son Control Plane
avec son identité — une télémétrie signée part et revient en 200. C'est
iagent-device qui signe ; ce test lui demande un envoi unique."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, commande, emettre, resultat  # noqa: E402

LIBELLE = "Control Plane : télémétrie signée acceptée"

if __name__ == "__main__":
    debut = time.monotonic()
    arguments(__doc__)
    code, sortie = commande(["iagent-device", "telemetrie", "--une-fois"], delai=60)
    if code == 127:
        emettre(resultat("controle", LIBELLE, "non_constate", debut, sortie))
    elif code == 0:
        emettre(resultat("controle", LIBELLE, "passe", debut, sortie[-300:] or "télémétrie acceptée"))
    else:
        emettre(resultat("controle", LIBELLE, "echec", debut, sortie[-400:] or f"iagent-device telemetrie : code {code}"))
