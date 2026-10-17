"""Test d'usine « services » (brief §16, §30) : les services actifs de SERVICES.json
(communs à toutes les Stations) tournent (systemctl show), iagent-commander excepté en mode usine, où sa
condition l'arrête exprès tant que la Box n'est pas qualifiée."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, charger, commande, emettre, resultat  # noqa: E402
from regles import juger_services  # noqa: E402

LIBELLE = "Services iAgent actifs"


def etat_de(nom: str) -> dict | None:
    code, sortie = commande(["systemctl", "show", f"{nom}.service", "-p", "ActiveState,Result,ConditionResult,LoadState"])
    if code != 0 and not sortie:
        return None
    e = dict(l.split("=", 1) for l in sortie.splitlines() if "=" in l)
    return None if e.get("LoadState") in (None, "not-found") else e


if __name__ == "__main__":
    debut = time.monotonic()
    args = arguments(__doc__)
    services = charger(args.services)
    attendus = list(services["actifs"])
    etats = {nom: etat_de(nom) for nom in attendus}
    if all(e is None for e in etats.values()):
        emettre(resultat("services", LIBELLE, "non_constate", debut, "systemctl ne répond pas : hors d'un système installé ?"))
        sys.exit(0)
    en_usine = not os.path.exists(os.path.join(args.etat, "usine", "qualifiee"))
    ecarts = juger_services({k: v for k, v in etats.items() if v is not None}, attendus, en_usine)
    emettre(resultat("services", LIBELLE, "echec" if ecarts else "passe", debut,
                     " ; ".join(ecarts) if ecarts else ", ".join(attendus) + (" (iagent-commander attend la qualification)" if en_usine else "")))
