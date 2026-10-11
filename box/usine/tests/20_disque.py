"""Test d'usine « disque » (brief §8-§9) : les cinq partitions de l'autoinstall
(EFI, SYSTEM_A, SYSTEM_B, RECOVERY, DATA), DATA chiffrée en LUKS et ouverte sur
/var/lib/iagent. Lu dans `lsblk -J`, jugé par regles.verifier_disque."""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, commande, emettre, resultat  # noqa: E402
from regles import verifier_disque  # noqa: E402

LIBELLE = "Disque découpé et données chiffrées"

if __name__ == "__main__":
    debut = time.monotonic()
    args = arguments(__doc__)
    code, sortie = commande(["lsblk", "-J", "-o", "NAME,PARTLABEL,FSTYPE,TYPE,MOUNTPOINT,MOUNTPOINTS,SIZE"])
    if code != 0:
        emettre(resultat("disque", LIBELLE, "echec", debut, f"lsblk : {sortie[:300]}"))
        sys.exit(0)
    try:
        arbre = json.loads(sortie)
    except ValueError:
        emettre(resultat("disque", LIBELLE, "echec", debut, "lsblk a rendu autre chose que du JSON"))
        sys.exit(0)
    ecarts = verifier_disque(arbre, point_donnees=args.etat)
    emettre(resultat("disque", LIBELLE, "echec" if ecarts else "passe", debut, " ; ".join(ecarts) if ecarts else "EFI, SYSTEM_A, SYSTEM_B, RECOVERY, DATA (LUKS, ouverte)"))
