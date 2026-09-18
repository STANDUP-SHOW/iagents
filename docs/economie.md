# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-09-18 sur 28 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, le client utilise son propre PC. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

Règle commerciale : matériel + API résiduelle au moins **3× moins cher** que l'API seule. « Partagé » = le bundle d'un petit client porte un mélange d'agents et celui-ci paie sa part de charge (5 % au minimum) ; « seul » = un seul agent sur son bundle, le pire cas ; « en flotte » = sa part sur le bundle au meilleur prix par unité de puissance (gros client).

| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Matériel en flotte | Bundle | Employé |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| AG-0001 Secrétaire administratif | 2280 | 288 € | 720 € | 71 € | 58 € | 13 € | **4.1×** | **3.4×** | 7 € | S (2/bundle) | 2 800 € |
| AG-0003 Assistant de direction | 3000 | 324 € | 811 € | 83 € | 65 € | 19 € | **3.9×** | **3.3×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0004 Assistant virtuel | 2280 | 221 € | 552 € | 66 € | 44 € | 22 € | **3.3×** | 2.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0005 Opérateur de saisie | 3000 | 396 € | 989 € | 111 € | 79 € | 32 € | **3.6×** | **3.5×** | 22 € | S (1/bundle) | 2 800 € |
| AG-0006 Gestionnaire documentaire | 1020 | 105 € | 262 € | 48 € | 21 € | 27 € | 2.2× ✗ | 1.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0007 Agent de classement | 2850 | 362 € | 905 € | 84 € | 72 € | 12 € | **4.3×** | **3.4×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0008 Agent de traitement de formulaires | 4740 | 792 € | 1 980 € | 185 € | 158 € | 27 € | **4.3×** | **4.1×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0009 Gestionnaire de courrier | 2850 | 274 € | 685 € | 70 € | 55 € | 15 € | **3.9×** | **3.1×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0010 Agent de reporting | 2730 | 348 € | 870 € | 92 € | 70 € | 22 € | **3.8×** | **3.4×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0011 Assistant de réunion | 2010 | 245 € | 611 € | 67 € | 49 € | 18 € | **3.7×** | **3.2×** | 9 € | S (1/bundle) | 2 800 € |
| AG-0012 Gestionnaire d'agenda | 3750 | 356 € | 891 € | 89 € | 71 € | 18 € | **4.0×** | **3.6×** | 9 € | S (1/bundle) | 2 800 € |
| AG-0013 Assistant achats | 2040 | 250 € | 625 € | 77 € | 50 € | 27 € | **3.2×** | 3.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0014 Assistant opérations | 2910 | 401 € | 1 003 € | 99 € | 80 € | 19 € | **4.1×** | **3.5×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0015 Assistant de projet | 870 | 93 € | 233 € | 41 € | 19 € | 22 € | 2.3× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0016 Gestionnaire de dossiers | 1560 | 198 € | 496 € | 67 € | 40 € | 27 € | 3.0× ✗ | 2.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0017 Agent de back-office | 2010 | 255 € | 638 € | 73 € | 51 € | 22 € | **3.5×** | **3.0×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0018 Agent de contrôle documentaire | 870 | 164 € | 409 € | 60 € | 33 € | 27 € | 2.7× ✗ | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0019 Agent de transcription | 1680 | 232 € | 580 € | 69 € | 46 € | 22 € | **3.4×** | **3.2×** | 11 € | S (1/bundle) | 2 800 € |
| AG-0020 Assistant commercial administratif | 3630 | 368 € | 920 € | 96 € | 74 € | 22 € | **3.9×** | **3.4×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0021 Assistant juridique administratif | 2160 | 300 € | 749 € | 87 € | 60 € | 27 € | **3.4×** | **3.2×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0022 Assistant immobilier administratif | 3450 | 485 € | 1 212 € | 119 € | 97 € | 22 € | **4.1×** | **3.7×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0023 Assistant médical administratif | 3000 | 321 € | 804 € | 80 € | 64 € | 15 € | **4.0×** | **3.3×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0024 Agent de réservation | 6300 | 723 € | 1 806 € | 156 € | 145 € | 11 € | **4.6×** | **4.2×** | 6 € | S (2/bundle) | 2 800 € |
| AG-0025 Office manager | 2280 | 356 € | 890 € | 93 € | 71 € | 22 € | **3.8×** | **3.4×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0208 Community manager | 3660 | 618 € | 1 411 € | 179 € | 124 € | 56 € | **3.4×** | 2.7× ✗ | 35 € | M (1/bundle) | 2 800 € |
| AG-0278 Designer social media | 930 | 208 € | 349 € | 144 € | 42 € | 102 € | 1.4× ✗ | 0.5× ✗ | 102 € | XL (3/bundle) | 2 800 € |
| AG-0493 Dropshipping assistant | 1140 | 177 € | 443 € | 68 € | 35 € | 32 € | 2.6× ✗ | 2.6× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0888 Agent de tâches à configurer | 9000 | 1 375 € | 3 438 € | 293 € | 275 € | 18 € | **4.7×** | **4.6×** | 9 € | S (1/bundle) | 2 800 € |

**22 fiches sur 28 tiennent la règle des 3× en bundle partagé, 19 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
