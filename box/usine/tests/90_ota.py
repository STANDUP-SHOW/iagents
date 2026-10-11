"""Test d'usine « ota » (brief §31-§33) : la Box relève les mises à jour que la
plateforme vise et vérifie chaque signature, sans rien installer
(`iagent-updater verifier`). Aucune mise à jour publiée est un passage : la
chaîne a répondu."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, commande, emettre, resultat  # noqa: E402

LIBELLE = "Mises à jour : relevé et signatures vérifiées"

if __name__ == "__main__":
    debut = time.monotonic()
    arguments(__doc__)
    code, sortie = commande(["iagent-updater", "verifier"], delai=120)
    if code == 127:
        emettre(resultat("ota", LIBELLE, "non_constate", debut, sortie))
    elif code == 0:
        emettre(resultat("ota", LIBELLE, "passe", debut, sortie[-300:] or "aucune mise à jour publiée ; la chaîne répond"))
    else:
        emettre(resultat("ota", LIBELLE, "echec", debut, sortie[-400:] or f"iagent-updater verifier : code {code}"))
