"""Lance les tests d'usine d'une Box et écrit son rapport (brief §44-§46).

    python3 -I lancer.py --profil-os /opt/iagent/profils/business.json \
        --profil-materiel /opt/iagent/materiel/bosgame-m4-neo-v1.json \
        --inventaire /var/lib/iagent/usine/inventaire.json \
        --device /etc/iagent/device.json --manifeste /opt/iagent/manifeste.json \
        --operateur "Léa" --sortie /var/lib/iagent/usine

Chaque `NN_<id>.py` tourne dans son propre processus (`python3 -I`, donc sans
le dossier courant dans le chemin des modules) et rend une ligne JSON ; un test
qui plante devient un « echec » avec sa trace, jamais un trou dans le rapport.
L'ordre est celui des numéros. `iagent-device usine` appelle ce script et lit
les lignes au fil de l'eau pour l'écran opérateur ; `iagent-device rapport`
dépose ensuite le fichier écrit ici.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

from commun import charger
from rapport import assembler, ecrire, maintenant_iso

ICI = Path(__file__).resolve().parent


def scripts() -> list[Path]:
    return sorted(p for p in ICI.iterdir() if p.name[:2].isdigit() and p.name[2] == "_" and p.suffix == ".py")


def executer(script: Path, args: argparse.Namespace) -> dict:
    ident = script.stem[3:].replace("_", "-")
    debut = time.monotonic()
    cmd = [sys.executable, "-I", str(script), "--profil-materiel", args.profil_materiel, "--profil-os", args.profil_os,
           "--inventaire", args.inventaire, "--etat", args.etat]
    if args.plateforme:
        cmd += ["--plateforme", args.plateforme]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=args.delai, check=False)
    except subprocess.TimeoutExpired:
        return {"id": ident, "libelle": f"Test {ident}", "verdict": "echec", "duree_ms": int((time.monotonic() - debut) * 1000),
                "detail": f"le test n'a pas répondu en {args.delai} s"}
    lignes = [l for l in p.stdout.splitlines() if l.strip()]
    if p.returncode != 0 or not lignes:
        trace = (p.stderr or p.stdout).strip()[-800:]
        return {"id": ident, "libelle": f"Test {ident}", "verdict": "echec", "duree_ms": int((time.monotonic() - debut) * 1000),
                "detail": f"le test a planté (code {p.returncode}) : {trace}" if trace else f"le test a planté (code {p.returncode})"}
    try:
        r = json.loads(lignes[-1])
    except ValueError:
        return {"id": ident, "libelle": f"Test {ident}", "verdict": "echec", "duree_ms": int((time.monotonic() - debut) * 1000),
                "detail": f"sortie illisible : {lignes[-1][:300]}"}
    if r.get("id") != ident:
        r["detail"] = f"le script {script.name} se dit « {r.get('id')} » : identifiant corrigé. {r.get('detail') or ''}".strip()
        r["id"] = ident
    return r


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--profil-os", required=True)
    p.add_argument("--profil-materiel", required=True)
    p.add_argument("--inventaire", required=True)
    p.add_argument("--device", default="/etc/iagent/device.json", help="identité posée à l'enrôlement : device_id, reference, serial, gamme, lot, plateforme")
    p.add_argument("--manifeste", default="/opt/iagent/manifeste.json", help="manifeste de l'installateur : version, build_id, commit")
    p.add_argument("--operateur", required=True)
    p.add_argument("--sortie", default="/var/lib/iagent/usine")
    p.add_argument("--etat", default="/var/lib/iagent")
    p.add_argument("--plateforme", default="")
    p.add_argument("--delai", type=int, default=300, help="secondes au plus par test")
    p.add_argument("--seulement", default="", help="identifiants de tests à lancer, séparés par des virgules (banc)")
    args = p.parse_args()

    profil_materiel = charger(args.profil_materiel)
    profil_os = charger(args.profil_os)
    if profil_materiel["id"] not in profil_os["materiel"]:
        print(f"Le profil matériel {profil_materiel['id']} ne sert pas la gamme {profil_os['id']}.", file=sys.stderr)
        return 2
    device = charger(args.device)
    manifeste = charger(args.manifeste)
    inventaire = charger(args.inventaire)
    voulus = {s.strip() for s in args.seulement.split(",") if s.strip()}

    commence_le = maintenant_iso()
    tests: list[dict] = []
    for script in scripts():
        ident = script.stem[3:].replace("_", "-")
        if voulus and ident not in voulus:
            continue
        r = executer(script, args)
        tests.append(r)
        # Une ligne par test au fil de l'eau : l'écran opérateur la lit telle quelle.
        sys.stdout.write(json.dumps(r, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    rapport = assembler(device, profil_materiel, inventaire, manifeste["installateur"], args.operateur, tests, commence_le, maintenant_iso())
    chemin = ecrire(rapport, args.sortie)
    sys.stdout.write(json.dumps({"rapport": str(chemin), "verdict": rapport["verdict"], "manquants": rapport["manquants"], "echoues": rapport["echoues"]}, ensure_ascii=False) + "\n")
    return 0 if rapport["verdict"] == "passe" else 1


if __name__ == "__main__":
    sys.exit(main())
