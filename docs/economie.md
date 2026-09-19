# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-09-19 sur 126 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, le client utilise son propre PC. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

Règle commerciale : matériel + API résiduelle au moins **3× moins cher** que l'API seule. « Partagé » = le bundle d'un petit client porte un mélange d'agents et celui-ci paie sa part de charge (5 % au minimum) ; « seul » = un seul agent sur son bundle, le pire cas ; « en flotte » = sa part sur le bundle au meilleur prix par unité de puissance (gros client).

| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Matériel en flotte | Bundle | Employé |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| AG-0001 Secrétaire administratif | 2280 | 288 € | 720 € | 71 € | 58 € | 13 € | **4.1×** | **3.4×** | 7 € | S (2/bundle) | 2 800 € |
| AG-0002 Assistant administratif | 1470 | 174 € | 434 € | 57 € | 35 € | 22 € | **3.1×** | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0003 Assistant de direction | 3000 | 324 € | 811 € | 83 € | 65 € | 19 € | **3.9×** | **3.3×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0004 Assistant virtuel | 2280 | 221 € | 552 € | 66 € | 44 € | 22 € | **3.3×** | 2.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0005 Opérateur de saisie | 3000 | 396 € | 989 € | 111 € | 79 € | 32 € | **3.6×** | **3.5×** | 22 € | S (1/bundle) | 2 800 € |
| AG-0006 Gestionnaire documentaire | 1020 | 105 € | 262 € | 48 € | 21 € | 27 € | 2.2× ✗ | 1.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0007 Agent de classement | 2280 | 287 € | 716 € | 73 € | 57 € | 15 € | **4.0×** | **3.1×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0008 Agent de traitement de formulaires | 4620 | 665 € | 1 663 € | 155 € | 133 € | 22 € | **4.3×** | **4.0×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0009 Gestionnaire de courrier | 2880 | 278 € | 695 € | 71 € | 56 € | 15 € | **3.9×** | **3.1×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0010 Agent de reporting | 2730 | 348 € | 870 € | 92 € | 70 € | 22 € | **3.8×** | **3.4×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0011 Assistant de réunion | 2010 | 245 € | 611 € | 67 € | 49 € | 18 € | **3.7×** | **3.2×** | 9 € | S (1/bundle) | 2 800 € |
| AG-0012 Gestionnaire d'agenda | 3750 | 356 € | 891 € | 89 € | 71 € | 18 € | **4.0×** | **3.6×** | 9 € | S (1/bundle) | 2 800 € |
| AG-0013 Assistant achats | 2040 | 250 € | 625 € | 77 € | 50 € | 27 € | **3.2×** | 3.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0014 Assistant opérations | 2910 | 401 € | 1 003 € | 99 € | 80 € | 19 € | **4.1×** | **3.5×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0015 Assistant de projet | 870 | 93 € | 233 € | 41 € | 19 € | 22 € | 2.3× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0016 Gestionnaire de dossiers | 1590 | 157 € | 391 € | 45 € | 31 € | 13 € | **3.5×** | 2.7× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0017 Agent de back-office | 2010 | 255 € | 638 € | 73 € | 51 € | 22 € | **3.5×** | **3.0×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0018 Agent de contrôle documentaire | 870 | 164 € | 409 € | 60 € | 33 € | 27 € | 2.7× ✗ | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0019 Agent de transcription | 2010 | 273 € | 681 € | 77 € | 55 € | 22 € | **3.5×** | **3.4×** | 11 € | S (1/bundle) | 2 800 € |
| AG-0020 Assistant commercial administratif | 3630 | 368 € | 920 € | 96 € | 74 € | 22 € | **3.9×** | **3.4×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0021 Assistant juridique administratif | 870 | 121 € | 302 € | 46 € | 24 € | 22 € | 2.6× ✗ | 2.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0022 Assistant immobilier administratif | 3450 | 485 € | 1 212 € | 119 € | 97 € | 22 € | **4.1×** | **3.7×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0023 Assistant médical administratif | 3000 | 321 € | 804 € | 80 € | 64 € | 15 € | **4.0×** | **3.3×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0024 Agent de réservation | 6300 | 723 € | 1 806 € | 156 € | 145 € | 11 € | **4.6×** | **4.2×** | 6 € | S (2/bundle) | 2 800 € |
| AG-0025 Office manager | 2280 | 356 € | 890 € | 93 € | 71 € | 22 € | **3.8×** | **3.4×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0026 Assistant comptable | 1560 | 189 € | 472 € | 60 € | 38 € | 22 € | **3.2×** | 2.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0027 Opérateur de saisie comptable | 1200 | 113 € | 283 € | 50 € | 23 € | 27 € | 2.3× ✗ | 2.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0028 Agent de facturation | 870 | 91 € | 227 € | 32 € | 18 € | 13 € | 2.9× ✗ | 2.0× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0029 Agent de rapprochement bancaire | 750 | 74 € | 185 € | 26 € | 15 € | 11 € | 2.9× ✗ | 1.8× ✗ | 6 € | S (2/bundle) | 2 800 € |
| AG-0030 Gestionnaire fournisseurs | 900 | 115 € | 287 € | 38 € | 23 € | 15 € | **3.0×** | 2.0× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0031 Gestionnaire clients | 1440 | 144 € | 360 € | 42 € | 29 € | 13 € | **3.4×** | 2.6× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0032 Agent de recouvrement | 870 | 119 € | 297 € | 37 € | 24 € | 13 € | **3.2×** | 2.4× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0033 Gestionnaire de notes de frais | 750 | 162 € | 274 € | 54 € | 32 € | 22 € | 3.0× ✗ | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0034 Agent de contrôle des factures | 1320 | 127 € | 318 € | 41 € | 25 € | 15 € | **3.1×** | 2.1× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0035 Préparateur de clôture | 990 | 108 € | 269 € | 35 € | 22 € | 14 € | **3.1×** | 1.9× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0036 Assistant trésorerie | 750 | 74 € | 185 € | 24 € | 15 € | 9 € | **3.1×** | 1.8× ✗ | 5 € | S (3/bundle) | 2 800 € |
| AG-0037 Assistant paie | 990 | 102 € | 255 € | 31 € | 20 € | 10 € | **3.3×** | 1.9× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0038 Assistant fiscal | 1560 | 215 € | 538 € | 52 € | 43 € | 8 € | **4.2×** | 2.8× ✗ | 20 € | S (4/bundle) | 2 800 € |
| AG-0039 Analyste comptable junior | 990 | 136 € | 339 € | 37 € | 27 € | 10 € | **3.6×** | 2.2× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0040 Contrôleur comptable | 300 | 39 € | 98 € | 21 € | 8 € | 14 € | 1.8× ✗ | 0.9× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0041 Reporting financier | 870 | 97 € | 235 € | 29 € | 19 € | 10 € | **3.3×** | 1.8× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0042 Gestionnaire des immobilisations | 1110 | 126 € | 314 € | 34 € | 25 € | 9 € | **3.7×** | 2.4× ✗ | 5 € | S (3/bundle) | 2 800 € |
| AG-0043 Gestionnaire des dépenses | 1320 | 155 € | 388 € | 46 € | 31 € | 15 € | **3.4×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0044 Assistant audit | 2130 | 270 € | 674 € | 67 € | 54 € | 14 € | **4.0×** | **3.1×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0045 Assistant contrôle de gestion | 870 | 120 € | 301 € | 38 € | 24 € | 14 € | **3.2×** | 2.1× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0046 Analyste de trésorerie | 1110 | 155 € | 388 € | 39 € | 31 € | 8 € | **3.9×** | 2.4× ✗ | 20 € | S (4/bundle) | 2 800 € |
| AG-0047 Assistant budget | 1680 | 205 € | 514 € | 51 € | 41 € | 10 € | **4.0×** | 2.7× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0051 Analyste financier junior | 870 | 119 € | 297 € | 37 € | 24 € | 14 € | **3.2×** | 2.1× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0052 Analyste crédit | 870 | 91 € | 227 € | 38 € | 18 € | 20 € | 2.4× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0053 Analyste investissement | 870 | 91 € | 227 € | 28 € | 18 € | 10 € | **3.2×** | 1.8× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0054 Assistant gestion de portefeuille | 870 | 120 € | 301 € | 39 € | 24 € | 15 € | **3.1×** | 2.1× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0055 Assistant trésorerie | 750 | 74 € | 185 € | 39 € | 15 € | 24 € | 1.9× ✗ | 1.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0056 Analyste risques | 870 | 92 € | 231 € | 29 € | 18 € | 10 € | **3.2×** | 1.8× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0057 Analyste marché | 870 | 102 € | 255 € | 47 € | 20 € | 26 € | 2.2× ✗ | 0.2× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0058 Analyste FP&A | 1140 | 157 € | 391 € | 45 € | 31 € | 14 € | **3.5×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0059 Analyste rentabilité | 870 | 120 € | 301 € | 38 € | 24 € | 14 € | **3.2×** | 2.1× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0060 Analyste coûts | 870 | 119 € | 297 € | 44 € | 24 € | 20 € | 2.7× ✗ | 2.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0061 Analyste pricing | 420 | 58 € | 144 € | 30 € | 12 € | 19 € | 1.9× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0062 Assistant banque d'affaires | 1020 | 110 € | 276 € | 39 € | 22 € | 17 € | 2.8× ✗ | 2.0× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0063 Assistant corporate finance | 1140 | 157 € | 391 € | 47 € | 31 € | 15 € | **3.4×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0064 Assistant due diligence | 990 | 137 € | 342 € | 61 € | 27 € | 34 € | 2.2× ✗ | 2.2× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0065 Analyste M&A junior | 1260 | 147 € | 367 € | 50 € | 29 € | 20 € | 3.0× ✗ | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0066 Analyste ESG | 1440 | 198 € | 496 € | 60 € | 40 € | 20 € | **3.3×** | 2.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0067 Analyste cash-flow | 990 | 137 € | 342 € | 38 € | 27 € | 10 € | **3.6×** | 2.2× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0068 Analyste performance | 420 | 56 € | 140 € | 25 € | 11 € | 14 € | 2.3× ✗ | 1.2× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0069 Assistant relation investisseurs | 1110 | 124 € | 311 € | 36 € | 25 € | 11 € | **3.5×** | 2.4× ✗ | 6 € | S (2/bundle) | 2 800 € |
| AG-0070 Analyste financement | 1110 | 147 € | 367 € | 45 € | 29 € | 15 € | **3.3×** | 2.3× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0071 Analyste crédit immobilier | 1020 | 112 € | 280 € | 49 € | 22 € | 27 € | 2.3× ✗ | 2.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0072 Analyste assurance-crédit | 540 | 74 € | 185 € | 25 € | 15 € | 10 € | 3.0× ✗ | 1.5× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0073 Assistant contrôle financier | 870 | 91 € | 227 € | 45 € | 18 € | 27 € | 2.0× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0074 Reporting financier | 1260 | 131 € | 328 € | 40 € | 26 € | 14 € | **3.3×** | 2.2× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0075 Assistant CFO | 990 | 136 € | 339 € | 51 € | 27 € | 24 € | 2.7× ✗ | 2.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0076 Gestionnaire de sinistres | 2160 | 243 € | 608 € | 76 € | 49 € | 27 € | **3.2×** | 3.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0077 Agent de déclaration de sinistre | 2460 | 287 € | 716 € | 79 € | 57 € | 22 € | **3.6×** | **3.1×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0078 Gestionnaire contrats | 2580 | 275 € | 688 € | 68 € | 55 € | 13 € | **4.0×** | **3.4×** | 7 € | S (2/bundle) | 2 800 € |
| AG-0079 Gestionnaire polices | 1320 | 154 € | 384 € | 46 € | 31 € | 15 € | **3.3×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0080 Souscripteur junior | 2460 | 287 € | 716 € | 71 € | 57 € | 14 € | **4.0×** | **3.1×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0081 Assistant souscription | 2010 | 249 € | 622 € | 63 € | 50 € | 13 € | **3.9×** | **3.3×** | 7 € | S (2/bundle) | 2 800 € |
| AG-0082 Analyste risques assurance | 1560 | 180 € | 451 € | 63 € | 36 € | 27 € | 2.9× ✗ | 2.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0083 Agent de renouvellement | 870 | 84 € | 210 € | 30 € | 17 € | 13 € | 2.8× ✗ | 1.9× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0084 Agent de résiliation | 1890 | 208 € | 521 € | 53 € | 42 € | 11 € | **3.9×** | **3.0×** | 6 € | S (2/bundle) | 2 800 € |
| AG-0085 Agent de conformité assurance | 1440 | 171 € | 426 € | 54 € | 34 € | 20 € | **3.1×** | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0086 Gestionnaire indemnisation | 2160 | 245 € | 611 € | 76 € | 49 € | 27 € | **3.2×** | 3.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0087 Assistant expert sinistre | 1890 | 207 € | 517 € | 63 € | 41 € | 22 € | **3.3×** | 2.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0088 Chargé de clientèle assurance | 2760 | 260 € | 650 € | 74 € | 52 € | 22 € | **3.5×** | **3.3×** | 11 € | S (1/bundle) | 2 800 € |
| AG-0089 Agent de qualification sinistre | 2460 | 259 € | 646 € | 72 € | 52 € | 20 € | **3.6×** | **3.0×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0090 Agent de collecte documentaire | 1650 | 198 € | 496 € | 58 € | 40 € | 18 € | **3.5×** | 3.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0091 Analyste fraude assurance | 870 | 84 € | 210 € | 44 € | 17 € | 27 € | 1.9× ✗ | 1.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0092 Assistant courtier | 1020 | 110 € | 276 € | 38 € | 22 € | 16 € | 2.9× ✗ | 2.3× ✗ | 8 € | S (1/bundle) | 2 800 € |
| AG-0093 Agent de relance primes | 780 | 105 € | 262 € | 34 € | 21 € | 13 € | **3.0×** | 2.2× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0094 Gestionnaire garanties | 1560 | 217 € | 542 € | 64 € | 43 € | 20 € | **3.4×** | 2.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0095 Assistant actuariat | 1230 | 143 € | 356 € | 42 € | 29 € | 14 € | **3.4×** | 2.3× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0096 Analyste portefeuille assurance | 870 | 120 € | 301 € | 34 € | 24 € | 10 € | **3.5×** | 2.1× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0097 Agent de comparaison contrats | 1230 | 143 € | 356 € | 49 € | 29 € | 20 € | 2.9× ✗ | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0098 Assistant production | 1350 | 129 € | 321 € | 48 € | 26 € | 22 € | 2.7× ✗ | 2.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0099 Assistant indemnisation | 1440 | 144 € | 360 € | 47 € | 29 € | 19 € | **3.0×** | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0100 Assistant direction assurance | 1140 | 157 € | 391 € | 45 € | 31 € | 14 € | **3.5×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0101 Conseiller bancaire digital | 990 | 134 € | 335 € | 45 € | 27 € | 18 € | **3.0×** | 2.5× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0102 Agent de support bancaire | 3420 | 347 € | 867 € | 92 € | 69 € | 22 € | **3.8×** | **3.6×** | 11 € | S (1/bundle) | 2 800 € |
| AG-0103 Agent KYC | 1290 | 150 € | 374 € | 57 € | 30 € | 27 € | 2.6× ✗ | 2.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0104 Agent de contrôle documentaire bancaire | 1530 | 144 € | 360 € | 56 € | 29 € | 27 € | 2.6× ✗ | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0105 Gestionnaire de comptes | 1440 | 200 € | 500 € | 54 € | 40 € | 14 € | **3.7×** | 2.7× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0106 Agent de crédit | 1440 | 172 € | 430 € | 61 € | 34 € | 27 € | 2.8× ✗ | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0107 Analyste crédit junior | 870 | 112 € | 280 € | 49 € | 22 € | 27 € | 2.3× ✗ | 2.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0108 Agent de prêts | 1440 | 200 € | 500 € | 60 € | 40 € | 20 € | **3.3×** | 2.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0109 Gestionnaire de dossiers de financement | 1020 | 137 € | 342 € | 49 € | 27 € | 22 € | 2.8× ✗ | 2.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0110 Agent de conformité | 870 | 120 € | 301 € | 44 € | 24 € | 20 € | 2.7× ✗ | 2.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0111 Analyste fraude bancaire | 2130 | 261 € | 653 € | 86 € | 52 € | 34 € | **3.0×** | **3.0×** | 23 € | S (1/bundle) | 2 800 € |
| AG-0112 Agent de recouvrement bancaire | 1020 | 113 € | 283 € | 41 € | 23 € | 18 € | 2.8× ✗ | 2.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0113 Assistant trésorerie bancaire | 300 | 32 € | 80 € | 20 € | 6 € | 14 € | 1.6× ✗ | 0.8× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0114 Assistant opérations bancaires | 1680 | 232 € | 580 € | 68 € | 46 € | 22 € | **3.4×** | 2.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0115 Agent de paiement | 750 | 75 € | 189 € | 30 € | 15 € | 15 € | 2.5× ✗ | 1.5× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0116 Agent de rapprochement | 420 | 57 € | 143 € | 25 € | 11 € | 13 € | 2.3× ✗ | 1.5× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0117 Agent de réclamation | 1020 | 140 € | 349 € | 48 € | 28 € | 20 € | 2.9× ✗ | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0118 Agent de clôture de compte | 870 | 92 € | 231 € | 32 € | 18 € | 14 € | 2.9× ✗ | 1.8× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0119 Agent de renouvellement | 1440 | 200 € | 500 € | 50 € | 40 € | 10 € | **4.0×** | 2.7× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0120 Assistant back-office bancaire | 2160 | 299 € | 748 € | 92 € | 60 € | 32 € | **3.3×** | **3.2×** | 22 € | S (1/bundle) | 2 800 € |
| AG-0121 Analyste risque junior | 990 | 137 € | 342 € | 41 € | 27 € | 14 € | **3.4×** | 2.2× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0122 Assistant conformité | 1440 | 200 € | 500 € | 51 € | 40 € | 11 € | **3.9×** | 3.0× ✗ | 6 € | S (2/bundle) | 2 800 € |
| AG-0123 Assistant relation client | 750 | 98 € | 245 € | 37 € | 20 € | 18 € | 2.6× ✗ | 2.1× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0124 Assistant reporting bancaire | 990 | 124 € | 277 € | 38 € | 25 € | 13 € | **3.3×** | 2.4× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0125 Assistant direction bancaire | 1590 | 191 € | 479 € | 57 € | 38 € | 19 € | **3.4×** | 2.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0208 Community manager | 3660 | 618 € | 1 411 € | 179 € | 124 € | 56 € | **3.4×** | 2.7× ✗ | 35 € | M (1/bundle) | 2 800 € |
| AG-0278 Designer social media | 930 | 208 € | 349 € | 144 € | 42 € | 102 € | 1.4× ✗ | 0.5× ✗ | 102 € | XL (3/bundle) | 2 800 € |
| AG-0493 Dropshipping assistant | 1140 | 177 € | 443 € | 68 € | 35 € | 32 € | 2.6× ✗ | 2.6× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0888 Agent de tâches à configurer | 9000 | 1 375 € | 3 438 € | 293 € | 275 € | 18 € | **4.7×** | **4.6×** | 9 € | S (1/bundle) | 2 800 € |

**83 fiches sur 126 tiennent la règle des 3× en bundle partagé, 29 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
