"""Ce que les tests d'usine partagent (brief Factory Installer, §6, §45, §46).

Chaque test est un script `NN_<id>.py` lancé par `lancer.py` dans son propre
processus, avec `python3 -I` ; il lit les fichiers que lancer lui passe et
imprime UNE ligne JSON sur sa sortie standard :

    {"id": "...", "libelle": "...", "verdict": "passe|echec|non_constate",
     "duree_ms": 1234, "detail": "..." | null}

Le verdict est dans la ligne, jamais dans le code de sortie : un test qui
plante (exception) sort en 1 et lancer inscrit un « echec » avec la trace.
`non_constate` dit ce que le banc n'a PAS pu voir (pas de carte son sur une VM,
outil absent) ; la plateforme compte un obligatoire non constaté comme un échec.

Bibliothèque standard seule : Python 3 est dans box/os/base/paquets.txt, rien
d'autre ne l'est.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

VERDICTS = ("passe", "echec", "non_constate")

# Ce qui ne doit jamais apparaître dans un détail de rapport : il traverse le
# réseau de l'atelier et finit dans le back-office. Même famille de motifs que
# plateforme/controle/detecteur.ts (secret ou clé d'accès) ; la plateforme
# refuse de toute façon un rapport qui en porte (422).
_SECRET = re.compile(r"(sk-ant-[A-Za-z0-9_-]{8,}|-----BEGIN|PRIVATE KEY|Bearer\s+\S+|UF-[A-Za-z0-9_-]{20,})")


def masquer(texte: str | None) -> str | None:
    """Remplace ce qui ressemble à un secret par « [masqué] » : un détail utile ne cite jamais une clé."""
    if texte is None:
        return None
    return _SECRET.sub("[masqué]", texte)[:2000]


def resultat(ident: str, libelle: str, verdict: str, debut: float, detail: str | None = None) -> dict:
    if verdict not in VERDICTS:
        raise ValueError(f"verdict inconnu : {verdict}")
    return {
        "id": ident,
        "libelle": libelle,
        "verdict": verdict,
        "duree_ms": int((time.monotonic() - debut) * 1000),
        "detail": masquer(detail),
    }


def emettre(r: dict) -> None:
    sys.stdout.write(json.dumps(r, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def arguments(description: str) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=description)
    p.add_argument("--profil-materiel", required=True, help="box/materiel/<id>.json")
    p.add_argument("--services", default="/opt/iagent/SERVICES.json", help="box/os/systemd/SERVICES.json : services actifs et kiosque, communs à toutes les Stations")
    p.add_argument("--inventaire", required=True, help="inventaire JSON produit par `iagent-device inventaire`")
    p.add_argument("--etat", default="/var/lib/iagent", help="dossier d'état de la Box")
    p.add_argument("--plateforme", default="", help="adresse https du Control Plane (lue dans /etc/iagent/device.json sinon)")
    return p.parse_args()


def charger(chemin: str | Path) -> dict:
    with open(chemin, encoding="utf-8") as f:
        return json.load(f)


def commande(args: list[str], delai: int = 60) -> tuple[int, str]:
    """Lance une commande système ; (code, sortie). Un outil absent vaut code 127 et un texte qui le dit."""
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=delai, check=False)
    except FileNotFoundError:
        return 127, f"outil absent : {args[0]}"
    except subprocess.TimeoutExpired:
        return 124, f"délai dépassé ({delai} s) : {' '.join(args)}"
    return p.returncode, (p.stdout + p.stderr).strip()


def adresse_plateforme(args: argparse.Namespace) -> str | None:
    if args.plateforme:
        return args.plateforme
    reglages = Path("/etc/iagent/device.json")
    if reglages.exists():
        try:
            return charger(reglages).get("plateforme") or None
        except (OSError, ValueError):
            return None
    return None
