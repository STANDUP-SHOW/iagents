"""Test d'usine « tpm » (brief §10) : un TPM 2.0 est vu par le noyau et par
tpm2-tools, et la partition DATA porte un jeton systemd-tpm2 (clé scellée par
systemd-cryptenroll, 30-tpm.sh). Sans TPM matériel ni swtpm, le détail le dit
et le verdict est « echec » : le profil l'exige."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, commande, emettre, resultat  # noqa: E402

LIBELLE = "TPM 2.0 présent et clé du disque scellée"

if __name__ == "__main__":
    debut = time.monotonic()
    arguments(__doc__)
    if not os.path.isdir("/sys/class/tpm/tpm0"):
        emettre(resultat("tpm", LIBELLE, "echec", debut, "aucun /sys/class/tpm/tpm0 : pas de TPM vu par le noyau"))
        sys.exit(0)
    code, sortie = commande(["tpm2_getcap", "properties-fixed"])
    if code == 127:
        emettre(resultat("tpm", LIBELLE, "non_constate", debut, sortie))
        sys.exit(0)
    if code != 0 or "2.0" not in sortie:
        emettre(resultat("tpm", LIBELLE, "echec", debut, f"tpm2_getcap : {sortie[:300]}"))
        sys.exit(0)
    code, dump = commande(["cryptsetup", "luksDump", "/dev/disk/by-partlabel/DATA"])
    if code != 0:
        emettre(resultat("tpm", LIBELLE, "echec", debut, f"cryptsetup luksDump DATA : {dump[:300]}"))
        sys.exit(0)
    if "systemd-tpm2" not in dump:
        emettre(resultat("tpm", LIBELLE, "echec", debut, "DATA n'a pas de jeton systemd-tpm2 : la clé n'est pas scellée par le TPM (30-tpm.sh a-t-il tourné ?)"))
        sys.exit(0)
    emettre(resultat("tpm", LIBELLE, "passe", debut, "TPM 2.0, jeton systemd-tpm2 sur DATA"))
