"""Banc des règles pures des tests d'usine (bibliothèque standard, unittest).

    python3 -m unittest discover -s box/usine/tests -v

Ce banc n'a pas de machine : il éprouve comparer_materiel, verifier_disque,
juger_services, verdict et niveau_rms sur des relevés fabriqués, puis rejoue
les témoins de box/usine/tests/temoins/ — les mêmes que box/check-rapport-usine.ts
rejoue avec verdictRapport() côté plateforme. Si Python et TypeScript cessaient
de rendre le même verdict sur ces fichiers, l'un des deux bancs tomberait.
"""
from __future__ import annotations

import json
import os
import struct
import sys
import unittest
from pathlib import Path

ICI = Path(__file__).resolve().parent
sys.path.insert(0, str(ICI))

from regles import comparer_materiel, juger_services, niveau_rms, verdict, verifier_disque  # noqa: E402

BOX = ICI.parents[1]
PROFILS = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (BOX / "materiel").glob("*.json") if p.name != "schema.json"}

INVENTAIRE_BOSGAME = {
    "cpu": "AMD Ryzen 7 7840HS w/ Radeon 780M Graphics", "coeurs": 8, "memoire_go": 62.7,
    "disque": {"modele": "Samsung SSD 980 PRO 1TB", "capacite_go": 1000},
    "mac": {"eth0": "a8:b1:c2:d3:e4:f5", "eth1": "a8:b1:c2:d3:e4:f6", "wifi": "a8:b1:c2:d3:e4:f7"},
    "bios": {"fournisseur": "American Megatrends", "version": "1.07", "date": "2026-06-02"},
    "tpm": {"present": True, "version": "2.0"}, "uefi": True, "secure_boot": True, "releve_le": "2026-10-11T09:00:00Z",
}


class Materiel(unittest.TestCase):
    def test_bosgame_conforme(self):
        self.assertEqual(comparer_materiel(INVENTAIRE_BOSGAME, PROFILS["bosgame-m4-neo-v1"]), [])

    def test_memoire_32_sur_profil_64_refusee(self):
        inv = {**INVENTAIRE_BOSGAME, "memoire_go": 31.2}
        ecarts = comparer_materiel(inv, PROFILS["bosgame-m4-neo-v1"])
        self.assertTrue(any("mémoire" in e for e in ecarts), ecarts)

    def test_tolerance_memoire_lue_sous_le_nominal(self):
        inv = {**INVENTAIRE_BOSGAME, "memoire_go": 61.0}
        self.assertEqual(comparer_materiel(inv, PROFILS["bosgame-m4-neo-v1"]), [])

    def test_un_seul_ethernet_sur_profil_a_deux(self):
        inv = {**INVENTAIRE_BOSGAME, "mac": {**INVENTAIRE_BOSGAME["mac"], "eth1": None}}
        self.assertTrue(any("Ethernet" in e for e in comparer_materiel(inv, PROFILS["bosgame-m4-neo-v1"])))

    def test_tpm_absent_et_secure_boot_inactif(self):
        inv = {**INVENTAIRE_BOSGAME, "tpm": {"present": False, "version": None}, "secure_boot": False}
        ecarts = comparer_materiel(inv, PROFILS["bosgame-m4-neo-v1"])
        self.assertEqual(len([e for e in ecarts if "TPM" in e]), 1)
        self.assertEqual(len([e for e in ecarts if "Secure Boot" in e]), 1)

    def test_exr1_exige_32_go(self):
        # max, 11/10/2026 : la Box Home a 32 Go (le brief disait 16/32) ; 16 Go est refusé.
        inv = {**INVENTAIRE_BOSGAME, "cpu": "Intel N305", "memoire_go": 31.2, "mac": {"eth0": "00:11:22:33:44:55", "eth1": None, "wifi": "00:11:22:33:44:56"}}
        self.assertEqual(comparer_materiel(inv, PROFILS["exr1-home-v1"]), [])
        self.assertNotEqual(comparer_materiel({**inv, "memoire_go": 15.6}, PROFILS["exr1-home-v1"]), [])
        self.assertNotEqual(comparer_materiel({**inv, "memoire_go": 24}, PROFILS["exr1-home-v1"]), [])

    def test_vm_sans_secure_boot_conforme(self):
        inv = {**INVENTAIRE_BOSGAME, "cpu": "QEMU Virtual CPU", "coeurs": 2, "memoire_go": 7.8, "disque": {"modele": "QEMU", "capacite_go": 64},
               "mac": {"eth0": "52:54:00:12:34:56", "eth1": None, "wifi": None}, "secure_boot": False}
        self.assertEqual(comparer_materiel(inv, PROFILS["vm-qemu"]), [])


def lsblk(data_fstype="crypto_LUKS", ouverte=True, point="/var/lib/iagent", sans=()):
    parts = []
    for label in ("EFI", "SYSTEM_A", "SYSTEM_B", "RECOVERY", "DATA"):
        if label in sans:
            continue
        p = {"name": f"nvme0n1p{len(parts) + 1}", "partlabel": label, "fstype": "vfat" if label == "EFI" else ("ext4" if label != "DATA" else data_fstype), "type": "part", "mountpoint": None, "children": []}
        if label == "DATA" and data_fstype == "crypto_LUKS" and ouverte:
            p["children"] = [{"name": "donnees", "type": "crypt", "fstype": "ext4", "mountpoint": point, "partlabel": None}]
        parts.append(p)
    return {"blockdevices": [{"name": "nvme0n1", "type": "disk", "partlabel": None, "children": parts}]}


class Disque(unittest.TestCase):
    def test_decoupage_attendu(self):
        self.assertEqual(verifier_disque(lsblk()), [])

    def test_partition_manquante(self):
        self.assertEqual(verifier_disque(lsblk(sans=("RECOVERY",))), ["partition RECOVERY absente"])

    def test_data_en_clair(self):
        self.assertTrue(any("chiffrée" in e for e in verifier_disque(lsblk(data_fstype="ext4"))))

    def test_data_fermee(self):
        self.assertTrue(any("fermée" in e for e in verifier_disque(lsblk(ouverte=False))))

    def test_data_montee_ailleurs(self):
        self.assertTrue(any("montée sur /mnt" in e for e in verifier_disque(lsblk(point="/mnt"))))


class Services(unittest.TestCase):
    ATTENDUS = ["iagent-device", "iagent-commander", "iagent-updater", "iagent-watchdog"]

    def test_tout_actif(self):
        etats = {n: {"ActiveState": "active"} for n in self.ATTENDUS}
        self.assertEqual(juger_services(etats, self.ATTENDUS, en_usine=False), [])

    def test_commander_arrete_par_sa_condition_en_usine(self):
        etats = {n: {"ActiveState": "active"} for n in self.ATTENDUS}
        etats["iagent-commander"] = {"ActiveState": "inactive", "ConditionResult": "no"}
        self.assertEqual(juger_services(etats, self.ATTENDUS, en_usine=True), [])
        self.assertEqual(len(juger_services(etats, self.ATTENDUS, en_usine=False)), 1)

    def test_service_tombe(self):
        etats = {n: {"ActiveState": "active"} for n in self.ATTENDUS}
        etats["iagent-watchdog"] = {"ActiveState": "failed", "Result": "exit-code"}
        self.assertEqual(juger_services(etats, self.ATTENDUS, en_usine=True), ["iagent-watchdog : failed (exit-code)"])

    def test_unite_absente(self):
        self.assertEqual(juger_services({}, ["iagent-device"], en_usine=True), ["iagent-device : état inconnu (unité absente ?)"])


class Verdict(unittest.TestCase):
    OBL = ["materiel", "disque", "controle"]

    def t(self, i, v="passe"):
        return {"id": i, "libelle": i, "verdict": v, "duree_ms": 1, "detail": None}

    def test_tout_passe(self):
        self.assertEqual(verdict([self.t("materiel"), self.t("disque"), self.t("controle"), self.t("audio", "non_constate")], self.OBL),
                         {"verdict": "passe", "manquants": [], "echoues": []})

    def test_un_echec_meme_hors_obligatoire(self):
        r = verdict([self.t("materiel"), self.t("disque"), self.t("controle"), self.t("audio", "echec")], self.OBL)
        self.assertEqual((r["verdict"], r["echoues"]), ("echec", ["audio"]))

    def test_obligatoire_non_constate_ou_absent(self):
        self.assertEqual(verdict([self.t("materiel"), self.t("disque"), self.t("controle", "non_constate")], self.OBL)["manquants"], ["controle"])
        self.assertEqual(verdict([self.t("materiel"), self.t("disque")], self.OBL)["manquants"], ["controle"])


class Temoins(unittest.TestCase):
    """Les rapports témoins portent le verdict que verdict() rend : même règle que la plateforme."""

    def test_temoins_coherents(self):
        fichiers = sorted((ICI / "temoins").glob("*.json"))
        self.assertTrue(fichiers, "aucun témoin dans box/usine/tests/temoins")
        for f in fichiers:
            r = json.loads(f.read_text(encoding="utf-8"))
            with self.subTest(temoin=f.name):
                self.assertEqual(f.stem, r["reference"], "le fichier porte le nom de sa référence")
                v = verdict(r["tests"], PROFILS[r["profil_materiel"]]["tests_obligatoires"])
                self.assertEqual(v["verdict"], r["verdict"])
                self.assertEqual(v["manquants"], r["manquants"])
                self.assertEqual(v["echoues"], r["echoues"])


class Son(unittest.TestCase):
    def test_silence_et_signal(self):
        silence = struct.pack("<" + "h" * 1600, *([0] * 1600))
        self.assertLess(niveau_rms(silence), 0.001)
        signal = struct.pack("<" + "h" * 1600, *([12000, -12000] * 800))
        self.assertGreater(niveau_rms(signal), 0.3)


if __name__ == "__main__":
    unittest.main()
