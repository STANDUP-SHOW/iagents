"""Les règles pures des tests d'usine : comparer, juger, rendre un verdict.

Séparées des scripts qui lisent la machine pour être éprouvées sans machine
(`test_usine.py`, unittest). `verdict()` dit exactement ce que
`verdictRapport()` de plateforme/controle/regles.ts dit : aucun test en
« echec », et chaque test obligatoire du profil matériel présent et « passe ».
Les deux implémentations sont rejouées sur les mêmes témoins
(box/usine/tests/temoins/*.json) par box/check-rapport-usine.ts et par
test_usine.py ; si l'une bouge sans l'autre, l'un des deux bancs tombe.
"""
from __future__ import annotations

import re

TOLERANCE_MEMOIRE = 0.12  # un module de 64 Go se lit 61-63 Go une fois le firmware servi


def comparer_materiel(inventaire: dict, profil: dict) -> list[str]:
    """Les écarts entre ce que la machine dit d'elle et ce que le profil exige. Vide = conforme."""
    ecarts: list[str] = []
    cpu = str(inventaire.get("cpu", ""))
    if not re.search(profil["cpu"]["modele_regex"], cpu):
        ecarts.append(f"processeur « {cpu} » hors profil ({profil['cpu']['modele_regex']})")
    if int(inventaire.get("coeurs", 0)) < profil["cpu"]["coeurs_min"]:
        ecarts.append(f"{inventaire.get('coeurs')} cœurs, {profil['cpu']['coeurs_min']} attendus au moins")
    memoire = float(inventaire.get("memoire_go", 0))
    if not any(abs(memoire - attendu) <= attendu * TOLERANCE_MEMOIRE for attendu in profil["memoire_go"]):
        ecarts.append(f"{memoire:g} Go de mémoire, attendu {' ou '.join(str(m) for m in profil['memoire_go'])} Go")
    capacite = float(inventaire.get("disque", {}).get("capacite_go", 0))
    if capacite < profil["disque_go_min"]:
        ecarts.append(f"disque de {capacite:g} Go, {profil['disque_go_min']} Go attendus au moins")
    mac = inventaire.get("mac", {})
    ethernets = sum(1 for k in ("eth0", "eth1") if mac.get(k))
    if ethernets < profil["reseau"]["ethernet"]:
        ecarts.append(f"{ethernets} port(s) Ethernet, {profil['reseau']['ethernet']} attendu(s)")
    if profil["reseau"]["wifi"] and not mac.get("wifi"):
        ecarts.append("aucune carte Wi-Fi vue, le profil en exige une")
    tpm = inventaire.get("tpm", {})
    if not tpm.get("present"):
        ecarts.append("aucun TPM vu, le profil exige un TPM 2.0")
    elif str(tpm.get("version") or "") != profil["tpm"]:
        ecarts.append(f"TPM {tpm.get('version')} vu, {profil['tpm']} exigé")
    if not inventaire.get("uefi"):
        ecarts.append("démarrage hors UEFI")
    if profil["secure_boot"] and inventaire.get("secure_boot") is not True:
        ecarts.append("Secure Boot inactif ou non lu, le profil l'exige")
    return ecarts


def verifier_disque(lsblk: dict, chiffrees: tuple[str, ...] = ("DATA",), point_donnees: str = "/var/lib/iagent") -> list[str]:
    """Le découpage voulu par l'autoinstall : EFI, SYSTEM_A, SYSTEM_B, RECOVERY, DATA ; DATA en LUKS2, ouverte sur /var/lib/iagent."""
    attendues = {"EFI", "SYSTEM_A", "SYSTEM_B", "RECOVERY", "DATA"}
    vues: dict[str, dict] = {}

    def parcourir(noeuds: list[dict]) -> None:
        for n in noeuds:
            if n.get("partlabel"):
                vues[n["partlabel"]] = n
            parcourir(n.get("children", []) or [])

    parcourir(lsblk.get("blockdevices", []))
    ecarts = [f"partition {p} absente" for p in sorted(attendues - set(vues))]
    for nom in chiffrees:
        p = vues.get(nom)
        if not p:
            continue
        if p.get("fstype") != "crypto_LUKS":
            ecarts.append(f"{nom} n'est pas chiffrée (fstype {p.get('fstype')})")
            continue
        enfants = p.get("children", []) or []
        ouverte = [c for c in enfants if c.get("type") == "crypt"]
        if not ouverte:
            ecarts.append(f"{nom} chiffrée mais fermée (aucun volume dm-crypt ouvert)")
        elif ouverte[0].get("mountpoint") != point_donnees and point_donnees not in (ouverte[0].get("mountpoints") or []):
            ecarts.append(f"{nom} ouverte mais montée sur {ouverte[0].get('mountpoint') or ouverte[0].get('mountpoints')}, attendu {point_donnees}")
    return ecarts


def juger_services(etats: dict[str, dict], attendus: list[str], en_usine: bool) -> list[str]:
    """`etats` : nom -> {ActiveState, Result, ConditionResult} (systemctl show). En mode usine, iagent-commander est
    légitimement arrêté par sa condition (la Box n'est pas qualifiée) ; tout autre service attendu doit être actif."""
    ecarts: list[str] = []
    for nom in attendus:
        e = etats.get(nom)
        if e is None:
            ecarts.append(f"{nom} : état inconnu (unité absente ?)")
            continue
        actif = e.get("ActiveState") == "active"
        if actif:
            continue
        if en_usine and nom == "iagent-commander" and e.get("ConditionResult") == "no":
            continue
        ecarts.append(f"{nom} : {e.get('ActiveState')} ({e.get('Result') or '?'})")
    return ecarts


def verdict(tests: list[dict], obligatoires: list[str]) -> dict:
    """Même règle que verdictRapport() côté plateforme : {verdict, manquants, echoues}."""
    par_id = {t["id"]: t["verdict"] for t in tests}
    echoues = [t["id"] for t in tests if t["verdict"] == "echec"]
    manquants = [i for i in obligatoires if par_id.get(i) != "passe"]
    return {"verdict": "passe" if not echoues and not manquants else "echec", "manquants": manquants, "echoues": echoues}


def niveau_rms(trames: bytes, largeur_octets: int = 2) -> float:
    """Niveau efficace (0..1) d'un enregistrement 16 bits signé, sans numpy : le silence d'une pièce est sous 0,01."""
    if largeur_octets != 2 or len(trames) < 2:
        return 0.0
    import array

    echantillons = array.array("h")
    echantillons.frombytes(trames[: len(trames) - len(trames) % 2])
    if not echantillons:
        return 0.0
    somme = sum(e * e for e in echantillons)
    return (somme / len(echantillons)) ** 0.5 / 32768.0
