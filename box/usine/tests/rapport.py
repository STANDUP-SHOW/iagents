"""Assemble le rapport d'usine d'une Box (brief §46) depuis les lignes des tests.

Le rapport suit `rapport.schema.json` ; `iagent-device rapport <fichier>` le
signe et le dépose sur `POST /controle/box/usine/rapport`, qui recalcule le
verdict. Il s'écrit aussi dans `<etat>/usine/<reference>.json` pour l'export USB
de l'écran final. Rien ici n'est écrit à la main : la référence, la série et
la gamme viennent de /etc/iagent/device.json (posé à l'enrôlement), les
versions de l'installateur de son manifeste.
"""
from __future__ import annotations

import datetime as dt
import json
from pathlib import Path

from regles import verdict


def maintenant_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def assembler(device: dict, profil_materiel: dict, inventaire: dict, installateur: dict, operateur: str,
              tests: list[dict], commence_le: str, termine_le: str) -> dict:
    v = verdict(tests, profil_materiel["tests_obligatoires"])
    return {
        "device_id": device["device_id"],
        "reference": device["reference"],
        "serial": device["serial"],
        "gamme": device["gamme"],
        "profil_materiel": profil_materiel["id"],
        "inventaire": inventaire,
        "installateur": {"version": installateur["version"], "build_id": installateur["build_id"], "commit": installateur["commit"]},
        "operateur": operateur,
        "lot": device.get("lot"),
        "commence_le": commence_le,
        "termine_le": termine_le,
        "tests": tests,
        "verdict": v["verdict"],
        "manquants": v["manquants"],
        "echoues": v["echoues"],
    }


def ecrire(rapport: dict, dossier: str | Path) -> Path:
    d = Path(dossier)
    d.mkdir(parents=True, exist_ok=True)
    chemin = d / f"{rapport['reference']}.json"
    partiel = chemin.with_suffix(".partiel")
    with open(partiel, "w", encoding="utf-8") as f:
        json.dump(rapport, f, ensure_ascii=False, indent=2)
        f.write("\n")
    partiel.replace(chemin)  # écriture en .partiel puis renommage, comme telechargement.rs
    return chemin
