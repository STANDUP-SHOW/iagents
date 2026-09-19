# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-09-19 sur 126 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, un poste N150 par agent. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

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
| AG-0026 Assistant comptable | 1560 | 189 € | 472 € | 77 € | 38 € | 39 € | 2.5× ✗ | 2.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0027 Opérateur de saisie comptable | 1200 | 113 € | 283 € | 67 € | 23 € | 44 € | 1.7× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0028 Agent de facturation | 870 | 91 € | 227 € | 48 € | 18 € | 30 € | 1.9× ✗ | 1.5× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0029 Agent de rapprochement bancaire | 750 | 74 € | 185 € | 43 € | 15 € | 28 € | 1.7× ✗ | 1.3× ✗ | 22 € | S (2/bundle) | 2 800 € |
| AG-0030 Gestionnaire fournisseurs | 900 | 115 € | 287 € | 55 € | 23 € | 32 € | 2.1× ✗ | 1.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0031 Gestionnaire clients | 1440 | 144 € | 360 € | 59 € | 29 € | 30 € | 2.4× ✗ | 2.0× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0032 Agent de recouvrement | 870 | 119 € | 297 € | 54 € | 24 € | 30 € | 2.2× ✗ | 1.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0033 Gestionnaire de notes de frais | 750 | 162 € | 274 € | 71 € | 32 € | 39 € | 2.3× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0034 Agent de contrôle des factures | 1320 | 127 € | 318 € | 58 € | 25 € | 32 € | 2.2× ✗ | 1.7× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0035 Préparateur de clôture | 990 | 108 € | 269 € | 52 € | 22 € | 30 € | 2.1× ✗ | 1.5× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0036 Assistant trésorerie | 750 | 74 € | 185 € | 41 € | 15 € | 26 € | 1.8× ✗ | 1.3× ✗ | 22 € | S (3/bundle) | 2 800 € |
| AG-0037 Assistant paie | 990 | 102 € | 255 € | 47 € | 20 € | 27 € | 2.1× ✗ | 1.4× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0038 Assistant fiscal | 1560 | 215 € | 538 € | 68 € | 43 € | 25 € | **3.1×** | 2.3× ✗ | 37 € | S (4/bundle) | 2 800 € |
| AG-0039 Analyste comptable junior | 990 | 136 € | 339 € | 54 € | 27 € | 27 € | 2.5× ✗ | 1.7× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0040 Contrôleur comptable | 300 | 39 € | 98 € | 38 € | 8 € | 30 € | 1.0× ✗ | 0.7× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0041 Reporting financier | 870 | 97 € | 235 € | 46 € | 19 € | 27 € | 2.1× ✗ | 1.4× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0042 Gestionnaire des immobilisations | 1110 | 126 € | 314 € | 51 € | 25 € | 26 € | 2.5× ✗ | 1.8× ✗ | 22 € | S (3/bundle) | 2 800 € |
| AG-0043 Gestionnaire des dépenses | 1320 | 155 € | 388 € | 63 € | 31 € | 32 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0044 Assistant audit | 2130 | 270 € | 674 € | 84 € | 54 € | 30 € | **3.2×** | 2.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0045 Assistant contrôle de gestion | 870 | 120 € | 301 € | 54 € | 24 € | 30 € | 2.2× ✗ | 1.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0046 Analyste de trésorerie | 1110 | 155 € | 388 € | 56 € | 31 € | 25 € | 2.8× ✗ | 1.9× ✗ | 37 € | S (4/bundle) | 2 800 € |
| AG-0047 Assistant budget | 1680 | 205 € | 514 € | 68 € | 41 € | 27 € | **3.0×** | 2.2× ✗ | 37 € | S (3/bundle) | 2 800 € |
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
| AG-0065 Analyste M&A junior | 1260 | 147 € | 367 € | 67 € | 29 € | 37 € | 2.2× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0066 Analyste ESG | 1440 | 198 € | 496 € | 77 € | 40 € | 37 € | 2.6× ✗ | 2.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0067 Analyste cash-flow | 990 | 137 € | 342 € | 54 € | 27 € | 27 € | 2.5× ✗ | 1.8× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0068 Analyste performance | 420 | 56 € | 140 € | 42 € | 11 € | 30 € | 1.3× ✗ | 0.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0069 Assistant relation investisseurs | 1110 | 124 € | 311 € | 53 € | 25 € | 28 € | 2.4× ✗ | 1.8× ✗ | 22 € | S (2/bundle) | 2 800 € |
| AG-0070 Analyste financement | 1110 | 147 € | 367 € | 61 € | 29 € | 32 € | 2.4× ✗ | 1.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0071 Analyste crédit immobilier | 1020 | 112 € | 280 € | 66 € | 22 € | 44 € | 1.7× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0072 Analyste assurance-crédit | 540 | 74 € | 185 € | 42 € | 15 € | 27 € | 1.8× ✗ | 1.1× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0073 Assistant contrôle financier | 870 | 91 € | 227 € | 62 € | 18 € | 44 € | 1.5× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0074 Reporting financier | 1260 | 131 € | 328 € | 57 € | 26 € | 30 € | 2.3× ✗ | 1.7× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0075 Assistant CFO | 990 | 136 € | 339 € | 68 € | 27 € | 41 € | 2.0× ✗ | 1.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
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
| AG-0091 Analyste fraude assurance | 870 | 84 € | 210 € | 61 € | 17 € | 44 € | 1.4× ✗ | 1.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0092 Assistant courtier | 1020 | 110 € | 276 € | 55 € | 22 € | 33 € | 2.0× ✗ | 1.7× ✗ | 25 € | S (1/bundle) | 2 800 € |
| AG-0093 Agent de relance primes | 780 | 105 € | 262 € | 51 € | 21 € | 30 € | 2.0× ✗ | 1.6× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0094 Gestionnaire garanties | 1560 | 217 € | 542 € | 80 € | 43 € | 37 € | 2.7× ✗ | 2.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0095 Assistant actuariat | 1230 | 143 € | 356 € | 59 € | 29 € | 30 € | 2.4× ✗ | 1.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0096 Analyste portefeuille assurance | 870 | 120 € | 301 € | 51 € | 24 € | 27 € | 2.4× ✗ | 1.6× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0097 Agent de comparaison contrats | 1230 | 143 € | 356 € | 66 € | 29 € | 37 € | 2.2× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0098 Assistant production | 1350 | 129 € | 321 € | 65 € | 26 € | 39 € | 2.0× ✗ | 1.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0099 Assistant indemnisation | 1440 | 144 € | 360 € | 64 € | 29 € | 35 € | 2.2× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0100 Assistant direction assurance | 1140 | 157 € | 391 € | 62 € | 31 € | 30 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0101 Conseiller bancaire digital | 990 | 134 € | 335 € | 62 € | 27 € | 35 € | 2.2× ✗ | 1.9× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0102 Agent de support bancaire | 3420 | 347 € | 867 € | 109 € | 69 € | 39 € | **3.2×** | **3.1×** | 28 € | S (1/bundle) | 2 800 € |
| AG-0103 Agent KYC | 1290 | 150 € | 374 € | 74 € | 30 € | 44 € | 2.0× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0104 Agent de contrôle documentaire bancaire | 1530 | 144 € | 360 € | 73 € | 29 € | 44 € | 2.0× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0105 Gestionnaire de comptes | 1440 | 200 € | 500 € | 70 € | 40 € | 30 € | 2.8× ✗ | 2.2× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0106 Agent de crédit | 1440 | 172 € | 430 € | 78 € | 34 € | 44 € | 2.2× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0107 Analyste crédit junior | 870 | 112 € | 280 € | 66 € | 22 € | 44 € | 1.7× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0108 Agent de prêts | 1440 | 200 € | 500 € | 77 € | 40 € | 37 € | 2.6× ✗ | 2.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0109 Gestionnaire de dossiers de financement | 1020 | 137 € | 342 € | 66 € | 27 € | 39 € | 2.1× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0110 Agent de conformité | 870 | 120 € | 301 € | 61 € | 24 € | 37 € | 2.0× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0111 Analyste fraude bancaire | 2130 | 261 € | 653 € | 103 € | 52 € | 51 € | 2.5× ✗ | 2.5× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0112 Agent de recouvrement bancaire | 1020 | 113 € | 283 € | 57 € | 23 € | 35 € | 2.0× ✗ | 1.7× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0113 Assistant trésorerie bancaire | 300 | 32 € | 80 € | 37 € | 6 € | 30 € | 0.9× ✗ | 0.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0114 Assistant opérations bancaires | 1680 | 232 € | 580 € | 85 € | 46 € | 39 € | 2.7× ✗ | 2.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0115 Agent de paiement | 750 | 75 € | 189 € | 47 € | 15 € | 32 € | 1.6× ✗ | 1.1× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0116 Agent de rapprochement | 420 | 57 € | 143 € | 42 € | 11 € | 30 € | 1.4× ✗ | 1.0× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0117 Agent de réclamation | 1020 | 140 € | 349 € | 65 € | 28 € | 37 € | 2.1× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0118 Agent de clôture de compte | 870 | 92 € | 231 € | 49 € | 18 € | 30 € | 1.9× ✗ | 1.3× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0119 Agent de renouvellement | 1440 | 200 € | 500 € | 67 € | 40 € | 27 € | 3.0× ✗ | 2.2× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0120 Assistant back-office bancaire | 2160 | 299 € | 748 € | 109 € | 60 € | 49 € | 2.8× ✗ | 2.7× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0121 Analyste risque junior | 990 | 137 € | 342 € | 58 € | 27 € | 30 € | 2.4× ✗ | 1.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0122 Assistant conformité | 1440 | 200 € | 500 € | 68 € | 40 € | 28 € | 2.9× ✗ | 2.4× ✗ | 22 € | S (2/bundle) | 2 800 € |
| AG-0123 Assistant relation client | 750 | 98 € | 245 € | 54 € | 20 € | 35 € | 1.8× ✗ | 1.6× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0124 Assistant reporting bancaire | 990 | 124 € | 277 € | 55 € | 25 € | 30 € | 2.3× ✗ | 1.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0125 Assistant direction bancaire | 1590 | 191 € | 479 € | 74 € | 38 € | 35 € | 2.6× ✗ | 2.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0208 Community manager | 3660 | 618 € | 1 411 € | 196 € | 124 € | 73 € | **3.1×** | 2.5× ✗ | 52 € | M (1/bundle) | 2 800 € |
| AG-0278 Designer social media | 930 | 208 € | 349 € | 161 € | 42 € | 119 € | 1.3× ✗ | 0.5× ✗ | 119 € | XL (3/bundle) | 2 800 € |
| AG-0493 Dropshipping assistant | 1140 | 177 € | 443 € | 84 € | 35 € | 49 € | 2.1× ✗ | 2.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0888 Agent de tâches à configurer | 9000 | 1 375 € | 3 438 € | 310 € | 275 € | 35 € | **4.4×** | **4.3×** | 26 € | S (1/bundle) | 2 800 € |

**23 fiches sur 126 tiennent la règle des 3× en bundle partagé, 8 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
