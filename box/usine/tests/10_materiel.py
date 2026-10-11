"""Test d'usine « materiel » (brief §6) : l'inventaire relevé par iagent-device
contre le profil matériel. Un écart = echec, et le détail nomme chaque écart."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, charger, emettre, resultat  # noqa: E402
from regles import comparer_materiel  # noqa: E402

LIBELLE = "Matériel conforme au profil"

if __name__ == "__main__":
    debut = time.monotonic()
    args = arguments(__doc__)
    inventaire = charger(args.inventaire)
    profil = charger(args.profil_materiel)
    ecarts = comparer_materiel(inventaire, profil)
    if ecarts:
        emettre(resultat("materiel", LIBELLE, "echec", debut, " ; ".join(ecarts)))
    else:
        emettre(resultat("materiel", LIBELLE, "passe", debut,
                         f"{inventaire.get('cpu')} · {inventaire.get('memoire_go')} Go · {inventaire.get('disque', {}).get('capacite_go')} Go · profil {profil['id']}"))
