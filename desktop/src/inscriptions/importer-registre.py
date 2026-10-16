"""Convertit le registre d'inscription de max (classeur Excel du 16/10/2026)
en `registre.json`, que l'écran et le banc lisent.

Le classeur reste la source : ses textes, ses plafonds, ses priorités et ses
mises en garde sont repris tels quels. Ce que ce script ajoute est écrit ici et
nulle part ailleurs : qui ouvre le compte (un agent, le dirigeant, ou personne
pour l'instant) et pourquoi, l'étape du planning, et les visuels joints.

Lancement : python3 -I desktop/src/inscriptions/importer-registre.py
            (openpyxl requis ; le banc check-inscriptions.ts refuse un
            registre qui ne correspond plus à ces règles)
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

ICI = Path(__file__).resolve().parent
SOURCE = ICI / "registre-source.xlsx"
SORTIE = ICI / "registre.json"

AVATAR = "avatar-iagent-800.png"
BANNIERES = {
    "linkedin": "banniere-iagent-linkedin-1128x191.jpg",
    "facebook": "banniere-iagent-facebook-1640x624.jpg",
    "youtube": "banniere-iagent-youtube-2560x1440.jpg",
}
BANNIERE_COMMUNE = "banniere-iagent-1500x500.jpg"
# Ces comptes n'ont pas d'image de couverture : seul l'avatar se pose.
SANS_BANNIERE = {"instagram", "threads", "tiktok", "whatsapp-business", "snapchat", "telegram", "quora"}

# Qui ouvre le compte, quand ce n'est pas un agent.
DIRIGEANT = {
    "linkedin": "LinkedIn n'est jamais piloté par un agent : vous créez la page vous-même, les textes sont prêts à copier.",
    "whatsapp-business": "WhatsApp Business se crée dans l'application du téléphone, avec un numéro dédié : il n'y a pas d'inscription par le navigateur.",
    "quora": "Quora exige le compte d'une personne réelle avant l'espace d'entreprise : ce compte est le vôtre, un agent ne le crée pas à votre nom.",
}
PLUS_TARD = {
    "google-business-profile": "Google refuse une fiche d'établissement à une activité sans accueil de clients en personne à une adresse réelle ; à ouvrir le jour où c'est le cas.",
    "indeed": "Une page employeur suppose un vrai recrutement ; à ouvrir avec la première offre réelle.",
    "glassdoor": "Une page employeur suppose un vrai recrutement ; à ouvrir avec la première offre réelle.",
    "welcome-to-the-jungle": "Une page employeur suppose un vrai recrutement, et souvent une offre payante ; à ouvrir avec la première offre réelle.",
    "g2": "Le registre la place après les premiers clients pilotes : une fiche sans avis réels ne sert pas.",
    "capterra": "Le registre la place après les premiers clients pilotes : une fiche sans avis réels ne sert pas.",
    "trustpilot": "Le registre la place après les premiers clients pilotes : ne solliciter que des avis de vrais clients.",
}
# Un compte qui ne s'ouvre qu'avec un autre.
DEPEND_DE = {"threads": "instagram"}

ETAPES = [
    ("J1", ["linkedin", "facebook", "instagram", "x"]),
    ("J2", ["youtube", "tiktok", "threads", "whatsapp-business"]),
    ("J3", ["google-business-profile"]),
    # Snapchat manque au planning du classeur ; P2 comme Pinterest, il va avec.
    ("J4", ["pinterest", "bluesky", "telegram", "snapchat"]),
    ("J5", ["crunchbase", "product-hunt", "wellfound"]),
    ("Semaine 2", ["indeed", "glassdoor", "welcome-to-the-jungle", "github", "hugging-face", "g2", "capterra", "trustpilot"]),
    ("Semaine 3", ["discord", "reddit", "mastodon"]),
    ("Semaine 3+", ["medium", "substack", "vimeo", "behance", "dribbble", "dev-community", "twitch", "quora"]),
]


def identifiant(nom: str) -> str:
    base = nom.split("—")[0].split("(")[0].strip()
    base = unicodedata.normalize("NFKD", base).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", base).strip("-")


def texte(v) -> str:
    return "" if v is None else str(v).strip()


def lignes(ws, en_tete: str):
    """Les lignes sous l'en-tête dont la première cellule vaut `en_tete`."""
    rangs = list(ws.iter_rows(values_only=True))
    for i, r in enumerate(rangs):
        if texte(r[0]) == en_tete:
            noms = [texte(c) for c in r]
            for suite in rangs[i + 1:]:
                if any(c is not None for c in suite):
                    yield dict(zip(noms, suite))
            return
    raise SystemExit(f"{ws.title} : en-tête « {en_tete} » introuvable")


def main() -> None:
    wb = openpyxl.load_workbook(SOURCE)
    plateformes = {}
    for r in lignes(wb["01_PLATEFORMES"], "Priorité"):
        if not texte(r["Plateforme"]):
            continue
        pid = identifiant(r["Plateforme"])
        plateformes[pid] = {
            "id": pid,
            "nom": texte(r["Plateforme"]),
            "priorite": texte(r["Priorité"]),
            "genre": texte(r["Type"]),
            "public": texte(r["Public cible"]),
            "adresse": texte(r["Lien création / accueil"]),
            "typeCompte": texte(r["Type de compte"]),
            "nomPublic": texte(r["Nom public"]),
            "identifiant": texte(r["Identifiant souhaité (non réservé)"]),
            "categorie": texte(r["Catégorie indicative"]),
            "site": texte(r["Site officiel"]),
            "avatar": AVATAR,
            "banniere": None if pid in SANS_BANNIERE else BANNIERES.get(pid, BANNIERE_COMMUNE),
            "vigilance": texte(r["Vigilance"]),
            "source": texte(r["Source plateforme"]),
            "textes": [],
            "premierMessage": None,
        }
    for r in lignes(wb["02_TEXTES_A_COPIER"], "Priorité"):
        pid = identifiant(texte(r["Plateforme"]))
        if pid not in plateformes:
            raise SystemExit(f"texte pour une plateforme inconnue : {r['Plateforme']}")
        plafond = r["Plafond (si connu)"]
        plateformes[pid]["textes"].append({
            "champ": texte(r["Champ à remplir"]),
            "texte": texte(r["TEXTE À COPIER"]),
            "plafond": int(plafond) if plafond not in (None, "") else None,
            "fiabilite": texte(r["Fiabilité plafond"]),
            "consigne": texte(r["Instructions"]),
        })
    for r in lignes(wb["03_POSTS_LANCEMENT"], "Priorité"):
        pid = identifiant(texte(r["Plateforme"]))
        if pid not in plateformes:
            raise SystemExit(f"message pour une plateforme inconnue : {r['Plateforme']}")
        plateformes[pid]["premierMessage"] = {
            "texte": texte(r["POST DE LANCEMENT À COPIER"]),
            "visuel": texte(r["Visuel recommandé"]),
            "lien": texte(r["Lien cible"]),
            "note": texte(r["Note de publication"]),
        }

    vus = set()
    for etape, ids in ETAPES:
        for pid in ids:
            if pid not in plateformes:
                raise SystemExit(f"planning : {pid} n'est pas au registre")
            vus.add(pid)
            p = plateformes[pid]
            p["etape"] = etape
            if pid in DIRIGEANT:
                p["mode"], p["raison"] = "dirigeant", DIRIGEANT[pid]
            elif pid in PLUS_TARD:
                p["mode"], p["raison"] = "plus-tard", PLUS_TARD[pid]
            else:
                p["mode"], p["raison"] = "agent", None
            p["dependDe"] = DEPEND_DE.get(pid)
    oublies = set(plateformes) - vus
    if oublies:
        raise SystemExit(f"plateformes sans étape : {sorted(oublies)}")

    marque = []
    for r in lignes(wb["04_DONNEES_MARQUE"], "Champ"):
        marque.append({
            "champ": texte(r["Champ"]),
            "valeur": texte(r["Texte à copier / compléter"]),
            "statut": texte(r["Fiabilité / statut"]),
            "consigne": texte(r["Consigne"]),
        })
    vigilance = []
    ws = wb["00_MODE_EMPLOI"]
    dedans = False
    for r in ws.iter_rows(values_only=True):
        t = texte(r[0])
        if t == "POINTS DE VIGILANCE AVANT PUBLICATION":
            dedans = True
        elif dedans and t:
            vigilance.append(t)

    ordre = [pid for _, ids in ETAPES for pid in ids]
    registre = {
        "source": "Registre d'inscription aux réseaux, édition octobre 2026 (classeur de max du 16/10/2026)",
        "etapes": [e for e, _ in ETAPES],
        "vigilance": vigilance,
        "marque": marque,
        "plateformes": [plateformes[pid] for pid in ordre],
    }
    SORTIE.write_text(json.dumps(registre, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(ordre)} plateformes, {sum(len(p['textes']) for p in registre['plateformes'])} textes -> {SORTIE.name}", file=sys.stderr)


if __name__ == "__main__":
    main()
