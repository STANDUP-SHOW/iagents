# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-09-18 sur 28 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, un poste N150 par agent. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

Règle commerciale : matériel + API résiduelle au moins **3× moins cher** que l'API seule. « Partagé » = le bundle d'un petit client porte un mélange d'agents et celui-ci paie sa part de charge (5 % au minimum) ; « seul » = un seul agent sur son bundle, le pire cas ; « en flotte » = sa part sur le bundle au meilleur prix par unité de puissance (gros client).

| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Matériel en flotte | Bundle | Employé |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| AG-0001 Secrétaire administratif | 2280 | 288 € | 720 € | 88 € | 58 € | 30 € | **3.3×** | 2.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0003 Assistant de direction | 3000 | 324 € | 811 € | 100 € | 65 € | 35 € | **3.2×** | 2.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0004 Assistant virtuel | 2280 | 221 € | 552 € | 83 € | 44 € | 39 € | 2.7× ✗ | 2.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0005 Opérateur de saisie | 3000 | 396 € | 989 € | 128 € | 79 € | 49 € | **3.1×** | **3.0×** | 38 € | S (1/bundle) | 2 800 € |
| AG-0006 Gestionnaire documentaire | 1020 | 105 € | 262 € | 65 € | 21 € | 44 € | 1.6× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0007 Agent de classement | 2850 | 362 € | 905 € | 101 € | 72 € | 29 € | **3.6×** | 2.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0008 Agent de traitement de formulaires | 4740 | 792 € | 1 980 € | 202 € | 158 € | 44 € | **3.9×** | **3.8×** | 37 € | S (1/bundle) | 2 800 € |
| AG-0009 Gestionnaire de courrier | 2850 | 274 € | 685 € | 87 € | 55 € | 32 € | **3.1×** | 2.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0010 Agent de reporting | 2730 | 348 € | 870 € | 108 € | 70 € | 39 € | **3.2×** | 2.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0011 Assistant de réunion | 2010 | 245 € | 611 € | 84 € | 49 € | 35 € | 2.9× ✗ | 2.6× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0012 Gestionnaire d'agenda | 3750 | 356 € | 891 € | 106 € | 71 € | 35 € | **3.4×** | **3.1×** | 26 € | S (1/bundle) | 2 800 € |
| AG-0013 Assistant achats | 2040 | 250 € | 625 € | 94 € | 50 € | 44 € | 2.7× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0014 Assistant opérations | 2910 | 401 € | 1 003 € | 116 € | 80 € | 35 € | **3.5×** | **3.1×** | 37 € | S (1/bundle) | 2 800 € |
| AG-0015 Assistant de projet | 870 | 93 € | 233 € | 57 € | 19 € | 39 € | 1.6× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0016 Gestionnaire de dossiers | 1560 | 198 € | 496 € | 84 € | 40 € | 44 € | 2.4× ✗ | 2.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0017 Agent de back-office | 2010 | 255 € | 638 € | 90 € | 51 € | 39 € | 2.8× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0018 Agent de contrôle documentaire | 870 | 164 € | 409 € | 77 € | 33 € | 44 € | 2.1× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0019 Agent de transcription | 1680 | 232 € | 580 € | 86 € | 46 € | 39 € | 2.7× ✗ | 2.6× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0020 Assistant commercial administratif | 3630 | 368 € | 920 € | 112 € | 74 € | 39 € | **3.3×** | 3.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0021 Assistant juridique administratif | 2160 | 300 € | 749 € | 104 € | 60 € | 44 € | 2.9× ✗ | 2.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0022 Assistant immobilier administratif | 3450 | 485 € | 1 212 € | 136 € | 97 € | 39 € | **3.6×** | **3.3×** | 37 € | S (1/bundle) | 2 800 € |
| AG-0023 Assistant médical administratif | 3000 | 321 € | 804 € | 96 € | 64 € | 32 € | **3.3×** | 2.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0024 Agent de réservation | 6300 | 723 € | 1 806 € | 173 € | 145 € | 28 € | **4.2×** | **3.8×** | 22 € | S (2/bundle) | 2 800 € |
| AG-0025 Office manager | 2280 | 356 € | 890 € | 110 € | 71 € | 39 € | **3.2×** | 2.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0208 Community manager | 3660 | 618 € | 1 411 € | 196 € | 124 € | 73 € | **3.1×** | 2.5× ✗ | 52 € | M (1/bundle) | 2 800 € |
| AG-0278 Designer social media | 930 | 208 € | 349 € | 161 € | 42 € | 119 € | 1.3× ✗ | 0.5× ✗ | 119 € | XL (3/bundle) | 2 800 € |
| AG-0493 Dropshipping assistant | 1140 | 177 € | 443 € | 84 € | 35 € | 49 € | 2.1× ✗ | 2.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0888 Agent de tâches à configurer | 9000 | 1 375 € | 3 438 € | 310 € | 275 € | 35 € | **4.4×** | **4.3×** | 26 € | S (1/bundle) | 2 800 € |

**16 fiches sur 28 tiennent la règle des 3× en bundle partagé, 7 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
