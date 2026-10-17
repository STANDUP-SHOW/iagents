"""Test d'usine « audio » (brief §25) : une carte son, une tonalité jouée sur
chaque canal, et pour une Box à micro un enregistrement d'une seconde dont le
niveau dépasse le silence. L'annulation d'écho (AEC) n'a pas d'outil ici : elle
reste « non constatée » dans le détail, le verdict porte sur ce qui est mesuré.
Sans sortie son attendue par le profil (VM), le test est non constaté."""
import os
import sys
import tempfile
import time
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from commun import arguments, charger, commande, emettre, resultat  # noqa: E402
from regles import niveau_rms  # noqa: E402

LIBELLE = "Son : enceintes et microphone"
SEUIL_SILENCE = 0.01

if __name__ == "__main__":
    debut = time.monotonic()
    args = arguments(__doc__)
    profil = charger(args.profil_materiel)
    if not profil["audio"]["sortie"]:
        emettre(resultat("audio", LIBELLE, "non_constate", debut, "le profil n'attend aucune carte son (machine virtuelle)"))
        sys.exit(0)
    code, cartes = commande(["aplay", "-l"])
    if code == 127:
        emettre(resultat("audio", LIBELLE, "non_constate", debut, cartes))
        sys.exit(0)
    if code != 0 or "card" not in cartes:
        emettre(resultat("audio", LIBELLE, "echec", debut, f"aucune carte son : {cartes[:200]}"))
        sys.exit(0)
    details = []
    for canal in ("gauche", "droite"):
        code, sortie = commande(["speaker-test", "-t", "sine", "-f", "440", "-l", "1", "-p", "1", "-c", "2", "-s", "1" if canal == "gauche" else "2"], delai=30)
        if code != 0:
            emettre(resultat("audio", LIBELLE, "echec", debut, f"lecture {canal} : {sortie[-200:]}"))
            sys.exit(0)
        details.append(f"enceinte {canal} jouée")
    if profil["audio"]["micro"]:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            chemin = f.name
        try:
            code, sortie = commande(["arecord", "-d", "1", "-f", "S16_LE", "-r", "16000", "-c", "1", chemin], delai=30)
            if code != 0:
                emettre(resultat("audio", LIBELLE, "echec", debut, f"enregistrement : {sortie[-200:]}"))
                sys.exit(0)
            with wave.open(chemin, "rb") as w:
                niveau = niveau_rms(w.readframes(w.getnframes()), w.getsampwidth())
        finally:
            try:
                os.unlink(chemin)
            except OSError:
                pass
        if niveau < SEUIL_SILENCE:
            emettre(resultat("audio", LIBELLE, "echec", debut, f"micro muet : niveau {niveau:.4f} sous {SEUIL_SILENCE}"))
            sys.exit(0)
        details.append(f"micro niveau {niveau:.3f}")
        details.append("AEC non constatée (aucun outil de mesure dans l'image)")
    emettre(resultat("audio", LIBELLE, "passe", debut, " ; ".join(details)))
