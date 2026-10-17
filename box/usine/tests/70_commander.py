"""Test d'usine « commander » (brief §28) : Desktop Commander est installé par
son paquet (.deb), son binaire est exécutable et son unité de kiosque est
activée. L'affichage réel sous cage n'est pas observé en mode usine (c'est
l'écran opérateur qui tient tty1) : le détail le dit."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, charger, commande, emettre, resultat  # noqa: E402

LIBELLE = "Desktop Commander installé et armé"

if __name__ == "__main__":
    debut = time.monotonic()
    args = arguments(__doc__)
    services = charger(args.services)
    application = services["kiosque"]["application"]
    binaire = f"/usr/bin/{application}"
    if not os.access(binaire, os.X_OK):
        emettre(resultat("commander", LIBELLE, "echec", debut, f"{binaire} absent ou non exécutable"))
        sys.exit(0)
    code, version = commande(["dpkg-query", "-W", "-f=${Version}", application])
    if code != 0 or not version:
        emettre(resultat("commander", LIBELLE, "echec", debut, f"{application} n'est pas installé par dpkg : {version[:200]}"))
        sys.exit(0)
    code, actif = commande(["systemctl", "is-enabled", "iagent-commander.service"])
    if actif.strip() != "enabled":
        emettre(resultat("commander", LIBELLE, "echec", debut, f"iagent-commander.service : {actif.strip() or 'état inconnu'}"))
        sys.exit(0)
    emettre(resultat("commander", LIBELLE, "passe", debut, f"{application} {version} (dpkg), kiosque armé ; affichage sous cage non constaté en mode usine"))
