# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-09-19 sur 58 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, un poste N150 par agent. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

Règle commerciale : matériel + API résiduelle au moins **3× moins cher** que l'API seule. « Partagé » = le bundle d'un petit client porte un mélange d'agents et celui-ci paie sa part de charge (5 % au minimum) ; « seul » = un seul agent sur son bundle, le pire cas ; « en flotte » = sa part sur le bundle au meilleur prix par unité de puissance (gros client).

| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Matériel en flotte | Bundle | Employé |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| AG-0001 Secrétaire administratif | 2280 | 288 € | 720 € | 88 € | 58 € | 30 € | **3.3×** | 2.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0002 Assistant administratif | 1470 | 174 € | 434 € | 74 € | 35 € | 39 € | 2.4× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0003 Assistant de direction | 3000 | 324 € | 811 € | 100 € | 65 € | 35 € | **3.2×** | 2.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0004 Assistant virtuel | 2280 | 221 € | 552 € | 83 € | 44 € | 39 € | 2.7× ✗ | 2.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0005 Opérateur de saisie | 3000 | 396 € | 989 € | 128 € | 79 € | 49 € | **3.1×** | **3.0×** | 38 € | S (1/bundle) | 2 800 € |
| AG-0006 Gestionnaire documentaire | 1020 | 105 € | 262 € | 65 € | 21 € | 44 € | 1.6× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0007 Agent de classement | 2280 | 287 € | 716 € | 89 € | 57 € | 32 € | **3.2×** | 2.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0008 Agent de traitement de formulaires | 4620 | 665 € | 1 663 € | 172 € | 133 € | 39 € | **3.9×** | **3.6×** | 37 € | S (1/bundle) | 2 800 € |
| AG-0009 Gestionnaire de courrier | 2880 | 278 € | 695 € | 88 € | 56 € | 32 € | **3.2×** | 2.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0010 Agent de reporting | 2730 | 348 € | 870 € | 108 € | 70 € | 39 € | **3.2×** | 2.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0011 Assistant de réunion | 2010 | 245 € | 611 € | 84 € | 49 € | 35 € | 2.9× ✗ | 2.6× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0012 Gestionnaire d'agenda | 3750 | 356 € | 891 € | 106 € | 71 € | 35 € | **3.4×** | **3.1×** | 26 € | S (1/bundle) | 2 800 € |
| AG-0013 Assistant achats | 2040 | 250 € | 625 € | 94 € | 50 € | 44 € | 2.7× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0014 Assistant opérations | 2910 | 401 € | 1 003 € | 116 € | 80 € | 35 € | **3.5×** | **3.1×** | 37 € | S (1/bundle) | 2 800 € |
| AG-0015 Assistant de projet | 870 | 93 € | 233 € | 57 € | 19 € | 39 € | 1.6× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0016 Gestionnaire de dossiers | 1590 | 157 € | 391 € | 62 € | 31 € | 30 € | 2.5× ✗ | 2.1× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0017 Agent de back-office | 2010 | 255 € | 638 € | 90 € | 51 € | 39 € | 2.8× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0018 Agent de contrôle documentaire | 870 | 164 € | 409 € | 77 € | 33 € | 44 € | 2.1× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0019 Agent de transcription | 2010 | 273 € | 681 € | 94 € | 55 € | 39 € | 2.9× ✗ | 2.8× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0020 Assistant commercial administratif | 3630 | 368 € | 920 € | 112 € | 74 € | 39 € | **3.3×** | 3.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0021 Assistant juridique administratif | 870 | 121 € | 302 € | 63 € | 24 € | 39 € | 1.9× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0022 Assistant immobilier administratif | 3450 | 485 € | 1 212 € | 136 € | 97 € | 39 € | **3.6×** | **3.3×** | 37 € | S (1/bundle) | 2 800 € |
| AG-0023 Assistant médical administratif | 3000 | 321 € | 804 € | 96 € | 64 € | 32 € | **3.3×** | 2.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0024 Agent de réservation | 6300 | 723 € | 1 806 € | 173 € | 145 € | 28 € | **4.2×** | **3.8×** | 22 € | S (2/bundle) | 2 800 € |
| AG-0025 Office manager | 2280 | 356 € | 890 € | 110 € | 71 € | 39 € | **3.2×** | 2.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0051 Analyste financier junior | 870 | 119 € | 297 € | 54 € | 24 € | 30 € | 2.2× ✗ | 1.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0052 Analyste crédit | 870 | 91 € | 227 € | 55 € | 18 € | 37 € | 1.6× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0053 Analyste investissement | 870 | 91 € | 227 € | 45 € | 18 € | 27 € | 2.0× ✗ | 1.3× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0054 Assistant gestion de portefeuille | 870 | 120 € | 301 € | 56 € | 24 € | 32 € | 2.1× ✗ | 1.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0055 Assistant trésorerie | 750 | 74 € | 185 € | 55 € | 15 € | 41 € | 1.3× ✗ | 1.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0056 Analyste risques | 870 | 92 € | 231 € | 45 € | 18 € | 27 € | 2.0× ✗ | 1.3× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0057 Analyste marché | 870 | 102 € | 255 € | 63 € | 20 € | 43 € | 1.6× ✗ | 0.2× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0058 Analyste FP&A | 1140 | 157 € | 391 € | 62 € | 31 € | 30 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0059 Analyste rentabilité | 870 | 120 € | 301 € | 54 € | 24 € | 30 € | 2.2× ✗ | 1.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0060 Analyste coûts | 870 | 119 € | 297 € | 61 € | 24 € | 37 € | 1.9× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0061 Analyste pricing | 420 | 58 € | 144 € | 47 € | 12 € | 35 € | 1.2× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0062 Assistant banque d'affaires | 1020 | 110 € | 276 € | 56 € | 22 € | 34 € | 2.0× ✗ | 1.5× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0063 Assistant corporate finance | 1140 | 157 € | 391 € | 63 € | 31 € | 32 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0064 Assistant due diligence | 990 | 137 € | 342 € | 78 € | 27 € | 51 € | 1.8× ✗ | 1.8× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0076 Gestionnaire de sinistres | 2160 | 243 € | 608 € | 93 € | 49 € | 44 € | 2.6× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0077 Agent de déclaration de sinistre | 2460 | 287 € | 716 € | 96 € | 57 € | 39 € | 3.0× ✗ | 2.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0078 Gestionnaire contrats | 2580 | 275 € | 688 € | 85 € | 55 € | 30 € | **3.2×** | 2.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0079 Gestionnaire polices | 1320 | 154 € | 384 € | 63 € | 31 € | 32 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0080 Souscripteur junior | 2460 | 287 € | 716 € | 88 € | 57 € | 30 € | **3.3×** | 2.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0081 Assistant souscription | 2010 | 249 € | 622 € | 80 € | 50 € | 30 € | **3.1×** | 2.7× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0082 Analyste risques assurance | 1560 | 180 € | 451 € | 80 € | 36 € | 44 € | 2.3× ✗ | 2.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0083 Agent de renouvellement | 870 | 84 € | 210 € | 47 € | 17 € | 30 € | 1.8× ✗ | 1.4× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0084 Agent de résiliation | 1890 | 208 € | 521 € | 70 € | 42 € | 28 € | 3.0× ✗ | 2.4× ✗ | 22 € | S (2/bundle) | 2 800 € |
| AG-0085 Agent de conformité assurance | 1440 | 171 € | 426 € | 71 € | 34 € | 37 € | 2.4× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0086 Gestionnaire indemnisation | 2160 | 245 € | 611 € | 93 € | 49 € | 44 € | 2.6× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0087 Assistant expert sinistre | 1890 | 207 € | 517 € | 80 € | 41 € | 39 € | 2.6× ✗ | 2.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0088 Chargé de clientèle assurance | 2760 | 260 € | 650 € | 91 € | 52 € | 39 € | 2.9× ✗ | 2.7× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0089 Agent de qualification sinistre | 2460 | 259 € | 646 € | 89 € | 52 € | 37 € | 2.9× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0090 Agent de collecte documentaire | 1650 | 198 € | 496 € | 74 € | 40 € | 35 € | 2.7× ✗ | 2.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0208 Community manager | 3660 | 618 € | 1 411 € | 196 € | 124 € | 73 € | **3.1×** | 2.5× ✗ | 52 € | M (1/bundle) | 2 800 € |
| AG-0278 Designer social media | 930 | 208 € | 349 € | 161 € | 42 € | 119 € | 1.3× ✗ | 0.5× ✗ | 119 € | XL (3/bundle) | 2 800 € |
| AG-0493 Dropshipping assistant | 1140 | 177 € | 443 € | 84 € | 35 € | 49 € | 2.1× ✗ | 2.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0888 Agent de tâches à configurer | 9000 | 1 375 € | 3 438 € | 310 € | 275 € | 35 € | **4.4×** | **4.3×** | 26 € | S (1/bundle) | 2 800 € |

**19 fiches sur 58 tiennent la règle des 3× en bundle partagé, 7 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
