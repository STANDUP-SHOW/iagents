# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-09-18 sur 28 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, un poste N150 par agent. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

Règle commerciale : matériel + API résiduelle au moins **3× moins cher** que l'API seule. « Partagé » = le bundle est rempli d'agents de ce type ; « seul » = un seul agent sur son bundle.

| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Bundle | Employé |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| AG-0001 Secrétaire administratif | 2280 | 288 € | 720 € | 88 € | 58 € | 30 € | **3.3×** | 2.8× ✗ | S (2/bundle) | 2 800 € |
| AG-0003 Assistant de direction | 3000 | 324 € | 811 € | 116 € | 65 € | 51 € | 2.8× ✗ | 2.8× ✗ | S (1/bundle) | 2 800 € |
| AG-0004 Assistant virtuel | 2280 | 221 € | 552 € | 95 € | 44 € | 51 € | 2.3× ✗ | 2.3× ✗ | S (1/bundle) | 2 800 € |
| AG-0005 Opérateur de saisie | 3000 | 396 € | 989 € | 130 € | 79 € | 51 € | **3.0×** | **3.0×** | S (1/bundle) | 2 800 € |
| AG-0006 Gestionnaire documentaire | 1020 | 105 € | 262 € | 72 € | 21 € | 51 € | 1.5× ✗ | 1.5× ✗ | S (1/bundle) | 2 800 € |
| AG-0007 Agent de classement | 2850 | 362 € | 905 € | 106 € | 72 € | 34 € | **3.4×** | 2.9× ✗ | S (2/bundle) | 2 800 € |
| AG-0008 Agent de traitement de formulaires | 4740 | 792 € | 1 980 € | 209 € | 158 € | 51 € | **3.8×** | **3.8×** | S (1/bundle) | 2 800 € |
| AG-0009 Gestionnaire de courrier | 2850 | 274 € | 685 € | 89 € | 55 € | 34 € | **3.1×** | 2.6× ✗ | S (2/bundle) | 2 800 € |
| AG-0010 Agent de reporting | 2730 | 348 € | 870 € | 120 € | 70 € | 51 € | 2.9× ✗ | 2.9× ✗ | S (1/bundle) | 2 800 € |
| AG-0011 Assistant de réunion | 2010 | 245 € | 611 € | 93 € | 49 € | 44 € | 2.6× ✗ | 2.6× ✗ | S (1/bundle) | 2 800 € |
| AG-0012 Gestionnaire d'agenda | 3750 | 356 € | 891 € | 115 € | 71 € | 44 € | **3.1×** | **3.1×** | S (1/bundle) | 2 800 € |
| AG-0013 Assistant achats | 2040 | 250 € | 625 € | 101 € | 50 € | 51 € | 2.5× ✗ | 2.5× ✗ | S (1/bundle) | 2 800 € |
| AG-0014 Assistant opérations | 2910 | 401 € | 1 003 € | 131 € | 80 € | 51 € | **3.1×** | **3.1×** | S (1/bundle) | 2 800 € |
| AG-0015 Assistant de projet | 870 | 93 € | 233 € | 69 € | 19 € | 51 € | 1.3× ✗ | 1.3× ✗ | S (1/bundle) | 2 800 € |
| AG-0016 Gestionnaire de dossiers | 1560 | 198 € | 496 € | 90 € | 40 € | 51 € | 2.2× ✗ | 2.2× ✗ | S (1/bundle) | 2 800 € |
| AG-0017 Agent de back-office | 2010 | 255 € | 638 € | 102 € | 51 € | 51 € | 2.5× ✗ | 2.5× ✗ | S (1/bundle) | 2 800 € |
| AG-0018 Agent de contrôle documentaire | 870 | 164 € | 409 € | 83 € | 33 € | 51 € | 2.0× ✗ | 2.0× ✗ | S (1/bundle) | 2 800 € |
| AG-0019 Agent de transcription | 1680 | 232 € | 580 € | 90 € | 46 € | 44 € | 2.6× ✗ | 2.6× ✗ | S (1/bundle) | 2 800 € |
| AG-0020 Assistant commercial administratif | 3630 | 368 € | 920 € | 124 € | 74 € | 51 € | 3.0× ✗ | 3.0× ✗ | S (1/bundle) | 2 800 € |
| AG-0021 Assistant juridique administratif | 2160 | 300 € | 749 € | 111 € | 60 € | 51 € | 2.7× ✗ | 2.7× ✗ | S (1/bundle) | 2 800 € |
| AG-0022 Assistant immobilier administratif | 3450 | 485 € | 1 212 € | 148 € | 97 € | 51 € | **3.3×** | **3.3×** | S (1/bundle) | 2 800 € |
| AG-0023 Assistant médical administratif | 3000 | 321 € | 804 € | 98 € | 64 € | 34 € | **3.3×** | 2.8× ✗ | S (2/bundle) | 2 800 € |
| AG-0024 Agent de réservation | 6300 | 723 € | 1 806 € | 175 € | 145 € | 30 € | **4.1×** | **3.8×** | S (2/bundle) | 2 800 € |
| AG-0025 Office manager | 2280 | 356 € | 890 € | 122 € | 71 € | 51 € | 2.9× ✗ | 2.9× ✗ | S (1/bundle) | 2 800 € |
| AG-0208 Community manager | 3660 | 618 € | 1 411 € | 243 € | 124 € | 119 € | 2.5× ✗ | 2.5× ✗ | M (1/bundle) | 2 800 € |
| AG-0278 Designer social media | 930 | 208 € | 349 € | 191 € | 42 € | 149 € | 1.1× ✗ | 0.5× ✗ | XL (3/bundle) | 2 800 € |
| AG-0493 Dropshipping assistant | 1140 | 177 € | 443 € | 86 € | 35 € | 51 € | 2.1× ✗ | 2.1× ✗ | S (1/bundle) | 2 800 € |
| AG-0888 Agent de tâches à configurer | 9000 | 1 375 € | 3 438 € | 319 € | 275 € | 44 € | **4.3×** | **4.3×** | S (1/bundle) | 2 800 € |

**11 fiches sur 28 tiennent la règle des 3× en bundle partagé, 7 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
