# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-09-23 sur 1249 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, le client utilise son propre PC. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

Règle commerciale : matériel + API résiduelle au moins **3× moins cher** que l'API seule. « Partagé » = le bundle d'un petit client porte un mélange d'agents et celui-ci paie sa part de charge (5 % au minimum) ; « seul » = un seul agent sur son bundle, le pire cas ; « en flotte » = sa part sur le bundle au meilleur prix par unité de puissance (gros client).

| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Matériel en flotte | Bundle | Employé |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| AG-0001 Secrétaire administratif | 2280 | 288 € | 720 € | 71 € | 58 € | 13 € | **4.1×** | **3.4×** | 7 € | S (2/bundle) | 2 800 € |
| AG-0002 Assistant administratif | 99 | 12 € | 30 € | 24 € | 2 € | 22 € | 0.5× ✗ | 0.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0003 Assistant de direction | 694 | 65 € | 162 € | 40 € | 13 € | 27 € | 1.6× ✗ | 1.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0004 Assistant virtuel | 484 | 45 € | 113 € | 41 € | 9 € | 32 € | 1.1× ✗ | 1.1× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0005 Opérateur de saisie | 1290 | 210 € | 392 € | 83 € | 42 € | 41 € | 2.5× ✗ | 1.4× ✗ | 26 € | M (2/bundle) | 2 800 € |
| AG-0006 Gestionnaire documentaire | 12 | 1 € | 3 € | 18 € | 0 € | 18 € | 0.1× ✗ | 0.1× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0007 Agent de classement | 2194 | 204 € | 511 € | 63 € | 41 € | 22 € | **3.3×** | **3.0×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0008 Agent de traitement de formulaires | 4620 | 531 € | 1 328 € | 128 € | 106 € | 22 € | **4.1×** | **3.8×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0009 Gestionnaire de courrier | 150 | 20 € | 49 € | 31 € | 4 € | 27 € | 0.6× ✗ | 0.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0010 Agent de reporting | 21 | 3 € | 6 € | 28 € | 1 € | 27 € | 0.1× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0011 Assistant de réunion | 1264 | 119 € | 298 € | 51 € | 24 € | 27 € | 2.3× ✗ | 2.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0012 Gestionnaire d'agenda | 1384 | 129 € | 322 € | 48 € | 26 € | 22 € | 2.7× ✗ | 2.5× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0013 Assistant achats | 154 | 19 € | 46 € | 31 € | 4 € | 27 € | 0.6× ✗ | 0.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0014 Assistant opérations | 2910 | 301 € | 751 € | 79 € | 60 € | 19 € | **3.8×** | **3.2×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0015 Assistant de projet | 21 | 3 € | 6 € | 23 € | 1 € | 22 € | 0.1× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0016 Gestionnaire de dossiers | 1590 | 157 € | 391 € | 45 € | 31 € | 13 € | **3.5×** | 2.7× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0017 Agent de back-office | 750 | 102 € | 255 € | 53 € | 20 € | 32 € | 1.9× ✗ | 1.9× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0018 Agent de contrôle documentaire | 870 | 119 € | 297 € | 51 € | 24 € | 27 € | 2.3× ✗ | 2.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0019 Agent de transcription | 1504 | 147 € | 368 € | 47 € | 29 € | 18 € | **3.1×** | 2.6× ✗ | 15 € | S (1/bundle) | 2 800 € |
| AG-0020 Assistant commercial administratif | 724 | 100 € | 249 € | 52 € | 20 € | 32 € | 1.9× ✗ | 1.9× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0021 Assistant juridique administratif | 811 | 84 € | 210 € | 43 € | 17 € | 26 € | 2.0× ✗ | 0.2× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0022 Assistant immobilier administratif | 274 | 28 € | 71 € | 38 € | 6 € | 32 € | 0.8× ✗ | 0.7× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0023 Assistant médical administratif | 694 | 66 € | 165 € | 31 € | 13 € | 18 € | 2.1× ✗ | 1.6× ✗ | 15 € | S (1/bundle) | 2 800 € |
| AG-0024 Agent de réservation | 6300 | 588 € | 1 471 € | 129 € | 118 € | 11 € | **4.6×** | **4.1×** | 6 € | S (2/bundle) | 2 800 € |
| AG-0025 Office manager | 49 | 5 € | 13 € | 27 € | 1 € | 26 € | 0.2× ✗ | 0.0× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0026 Assistant comptable | 74 | 10 € | 25 € | 33 € | 2 € | 31 € | 0.3× ✗ | 0.0× ✗ | 31 € | XL (12/bundle) | 2 800 € |
| AG-0027 Opérateur de saisie comptable | 150 | 18 € | 45 € | 49 € | 4 € | 45 € | 0.4× ✗ | 0.2× ✗ | 28 € | M (2/bundle) | 2 800 € |
| AG-0028 Agent de facturation | 274 | 37 € | 92 € | 40 € | 7 € | 32 € | 0.9× ✗ | 0.9× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0029 Agent de rapprochement bancaire | 121 | 16 € | 39 € | 29 € | 3 € | 26 € | 0.5× ✗ | 0.0× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0030 Gestionnaire fournisseurs | 669 | 65 € | 164 € | 39 € | 13 € | 26 € | 1.7× ✗ | 0.2× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0031 Gestionnaire clients | 669 | 65 € | 164 € | 39 € | 13 € | 26 € | 1.7× ✗ | 0.2× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0032 Agent de recouvrement | 124 | 16 € | 40 € | 30 € | 3 € | 27 € | 0.5× ✗ | 0.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0033 Gestionnaire de notes de frais | 100 | 14 € | 35 € | 35 € | 3 € | 32 € | 0.4× ✗ | 0.4× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0034 Agent de contrôle des factures | 150 | 20 € | 49 € | 30 € | 4 € | 26 € | 0.7× ✗ | 0.1× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0035 Préparateur de clôture | 9 | 1 € | 3 € | 46 € | 0 € | 45 € | 0.0× ✗ | 0.0× ✗ | 45 € | XL (8/bundle) | 2 800 € |
| AG-0036 Assistant trésorerie | 124 | 16 € | 40 € | 30 € | 3 € | 27 € | 0.5× ✗ | 0.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0037 Assistant paie | 34 | 5 € | 12 € | 28 € | 1 € | 27 € | 0.2× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0038 Assistant fiscal | 783 | 81 € | 204 € | 55 € | 16 € | 39 € | 1.5× ✗ | 0.2× ✗ | 39 € | XL (10/bundle) | 2 800 € |
| AG-0039 Analyste comptable junior | 5 | 1 € | 2 € | 30 € | 0 € | 30 € | 0.0× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0040 Contrôleur comptable | 9 | 1 € | 3 € | 39 € | 0 € | 39 € | 0.0× ✗ | 0.0× ✗ | 39 € | XL (10/bundle) | 2 800 € |
| AG-0041 Reporting financier | 35 | 5 € | 12 € | 31 € | 1 € | 30 € | 0.2× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0042 Gestionnaire des immobilisations | 307 | 43 € | 107 € | 42 € | 9 € | 34 € | 1.0× ✗ | 1.0× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0043 Gestionnaire des dépenses | 1320 | 155 € | 388 € | 46 € | 31 € | 15 € | **3.4×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0044 Assistant audit | 369 | 51 € | 128 € | 36 € | 10 € | 26 € | 1.4× ✗ | 0.1× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0045 Assistant contrôle de gestion | 6 | 1 € | 2 € | 30 € | 0 € | 30 € | 0.0× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0046 Analyste de trésorerie | 1110 | 155 € | 388 € | 39 € | 31 € | 8 € | **3.9×** | 2.4× ✗ | 20 € | S (4/bundle) | 2 800 € |
| AG-0047 Assistant budget | 602 | 84 € | 210 € | 46 € | 17 € | 30 € | 1.8× ✗ | 0.2× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0048 Gestionnaire de comptes clients | 216 | 30 € | 76 € | 38 € | 6 € | 32 € | 0.8× ✗ | 0.8× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0049 Gestionnaire de comptes fournisseurs | 41 | 6 € | 14 € | 33 € | 1 € | 32 € | 0.2× ✗ | 0.2× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0050 Assistant directeur financier | 339 | 40 € | 100 € | 47 € | 8 € | 39 € | 0.9× ✗ | 0.1× ✗ | 39 € | XL (10/bundle) | 2 800 € |
| AG-0051 Analyste financier junior | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0052 Analyste crédit | 1650 | 182 € | 454 € | 97 € | 36 € | 60 € | 1.9× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0053 Analyste investissement | 870 | 91 € | 227 € | 28 € | 18 € | 10 € | **3.2×** | 1.8× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0054 Assistant gestion de portefeuille | 331 | 36 € | 91 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0055 Assistant trésorerie | 784 | 79 € | 197 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0056 Analyste risques | 870 | 92 € | 231 € | 29 € | 18 € | 10 € | **3.2×** | 1.8× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0057 Analyste marché | 254 | 25 € | 64 € | 38 € | 5 € | 33 € | 0.7× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0058 Analyste FP&A | 1140 | 157 € | 391 € | 45 € | 31 € | 14 € | **3.5×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0059 Analyste rentabilité | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0060 Analyste coûts | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0061 Analyste pricing | 462 | 58 € | 144 € | 44 € | 12 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0062 Assistant banque d'affaires | 1530 | 165 € | 412 € | 93 € | 33 € | 60 € | 1.8× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0063 Assistant corporate finance | 1054 | 147 € | 368 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0064 Assistant due diligence | 960 | 119 € | 297 € | 84 € | 24 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0065 Analyste M&A junior | 1200 | 161 € | 402 € | 92 € | 32 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0066 Analyste ESG | 1440 | 198 € | 496 € | 60 € | 40 € | 20 € | **3.3×** | 2.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0067 Analyste cash-flow | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0068 Analyste performance | 420 | 56 € | 140 € | 25 € | 11 € | 14 € | 2.3× ✗ | 1.2× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0069 Assistant relation investisseurs | 1951 | 224 € | 559 € | 77 € | 45 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0070 Analyste financement | 1110 | 147 € | 367 € | 45 € | 29 € | 15 € | **3.3×** | 2.3× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0071 Analyste crédit immobilier | 1650 | 189 € | 472 € | 70 € | 38 € | 33 € | 2.7× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0072 Analyste assurance-crédit | 540 | 74 € | 185 € | 25 € | 15 € | 10 € | 3.0× ✗ | 1.5× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0073 Assistant contrôle financier | 11 | 2 € | 4 € | 33 € | 0 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0074 Reporting financier | 1260 | 131 € | 328 € | 40 € | 26 € | 14 € | **3.3×** | 2.2× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0075 Assistant CFO | 487 | 47 € | 118 € | 42 € | 9 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0076 Gestionnaire de sinistres | 2160 | 243 € | 608 € | 76 € | 49 € | 27 € | **3.2×** | 3.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0077 Agent de déclaration de sinistre | 2460 | 287 € | 716 € | 79 € | 57 € | 22 € | **3.6×** | **3.1×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0078 Gestionnaire contrats | 2580 | 275 € | 688 € | 68 € | 55 € | 13 € | **4.0×** | **3.4×** | 7 € | S (2/bundle) | 2 800 € |
| AG-0079 Gestionnaire polices | 1320 | 154 € | 384 € | 46 € | 31 € | 15 € | **3.3×** | 2.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0080 Souscripteur junior | 2460 | 287 € | 716 € | 71 € | 57 € | 14 € | **4.0×** | **3.1×** | 20 € | S (2/bundle) | 2 800 € |
| AG-0081 Assistant souscription | 1954 | 266 € | 665 € | 74 € | 53 € | 20 € | **3.6×** | **3.3×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0082 Analyste risques assurance | 1560 | 180 € | 451 € | 63 € | 36 € | 27 € | 2.9× ✗ | 2.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0083 Agent de renouvellement | 870 | 84 € | 210 € | 30 € | 17 € | 13 € | 2.8× ✗ | 1.9× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0084 Agent de résiliation | 1504 | 203 € | 508 € | 61 € | 41 € | 20 € | **3.3×** | **3.0×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0085 Agent de conformité assurance | 1440 | 171 € | 426 € | 54 € | 34 € | 20 € | **3.1×** | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0086 Gestionnaire indemnisation | 1054 | 140 € | 351 € | 48 € | 28 € | 20 € | 2.9× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0087 Assistant expert sinistre | 1504 | 264 € | 527 € | 73 € | 53 € | 20 € | **3.6×** | **3.3×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0088 Chargé de clientèle assurance | 1504 | 175 € | 438 € | 55 € | 35 € | 20 € | **3.2×** | 2.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0089 Agent de qualification sinistre | 1410 | 196 € | 489 € | 59 € | 39 € | 20 € | **3.3×** | 3.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0090 Agent de collecte documentaire | 1650 | 198 € | 496 € | 58 € | 40 € | 18 € | **3.5×** | 3.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0091 Analyste fraude assurance | 870 | 84 € | 210 € | 44 € | 17 € | 27 € | 1.9× ✗ | 1.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0092 Assistant courtier | 909 | 127 € | 317 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0093 Agent de relance primes | 780 | 105 € | 262 € | 34 € | 21 € | 13 € | **3.0×** | 2.2× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0094 Gestionnaire garanties | 905 | 119 € | 299 € | 44 € | 24 € | 20 € | 2.7× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0095 Assistant actuariat | 604 | 70 € | 176 € | 47 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0096 Analyste portefeuille assurance | 870 | 120 € | 301 € | 34 € | 24 € | 10 € | **3.5×** | 2.1× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0097 Agent de comparaison contrats | 1230 | 143 € | 356 € | 49 € | 29 € | 20 € | 2.9× ✗ | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0098 Assistant production | 934 | 131 € | 326 € | 46 € | 26 € | 20 € | 2.8× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0099 Assistant indemnisation | 934 | 124 € | 309 € | 45 € | 25 € | 20 € | 2.7× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0100 Assistant direction assurance | 607 | 78 € | 195 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0101 Conseiller bancaire digital | 1860 | 175 € | 437 € | 55 € | 35 € | 20 € | **3.2×** | 2.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0102 Agent de support bancaire | 3420 | 347 € | 867 € | 92 € | 69 € | 22 € | **3.8×** | **3.6×** | 11 € | S (1/bundle) | 2 800 € |
| AG-0103 Agent KYC | 1290 | 150 € | 374 € | 57 € | 30 € | 27 € | 2.6× ✗ | 2.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0104 Agent de contrôle documentaire bancaire | 1530 | 144 € | 360 € | 56 € | 29 € | 27 € | 2.6× ✗ | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0105 Gestionnaire de comptes | 1685 | 173 € | 432 € | 55 € | 35 € | 20 € | **3.1×** | 2.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0106 Agent de crédit | 1440 | 172 € | 430 € | 61 € | 34 € | 27 € | 2.8× ✗ | 2.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0107 Analyste crédit junior | 1530 | 214 € | 535 € | 75 € | 43 € | 33 € | 2.8× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0108 Agent de prêts | 1410 | 190 € | 475 € | 58 € | 38 € | 20 € | **3.3×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0109 Gestionnaire de dossiers de financement | 1020 | 137 € | 342 € | 49 € | 27 € | 22 € | 2.8× ✗ | 2.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0110 Agent de conformité | 870 | 120 € | 301 € | 44 € | 24 € | 20 € | 2.7× ✗ | 2.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0111 Analyste fraude bancaire | 665 | 79 € | 197 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0112 Agent de recouvrement bancaire | 1020 | 113 € | 283 € | 41 € | 23 € | 18 € | 2.8× ✗ | 2.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0113 Assistant trésorerie bancaire | 360 | 43 € | 108 € | 29 € | 9 € | 20 € | 1.5× ✗ | 1.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0114 Assistant opérations bancaires | 720 | 94 € | 234 € | 39 € | 19 € | 20 € | 2.4× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0115 Agent de paiement | 720 | 87 € | 217 € | 38 € | 17 € | 20 € | 2.3× ✗ | 1.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0116 Agent de rapprochement | 400 | 49 € | 122 € | 30 € | 10 € | 20 € | 1.6× ✗ | 1.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0117 Agent de réclamation | 1020 | 140 € | 349 € | 48 € | 28 € | 20 € | 2.9× ✗ | 2.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0118 Agent de clôture de compte | 931 | 116 € | 290 € | 44 € | 23 € | 20 € | 2.7× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0119 Agent de renouvellement | 1440 | 200 € | 500 € | 50 € | 40 € | 10 € | **4.0×** | 2.7× ✗ | 20 € | S (3/bundle) | 2 800 € |
| AG-0120 Assistant back-office bancaire | 131 | 18 € | 45 € | 24 € | 4 € | 20 € | 0.8× ✗ | 0.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0121 Analyste risque junior | 990 | 137 € | 342 € | 41 € | 27 € | 14 € | **3.4×** | 2.2× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0122 Assistant conformité | 244 | 26 € | 64 € | 38 € | 5 € | 33 € | 0.7× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0123 Assistant relation client | 1711 | 176 € | 441 € | 56 € | 35 € | 20 € | **3.2×** | 2.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0124 Assistant reporting bancaire | 306 | 29 € | 72 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0125 Assistant direction bancaire | 494 | 54 € | 134 € | 31 € | 11 € | 20 € | 1.7× ✗ | 1.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0126 Assistant RH | 750 | 73 € | 182 € | 32 € | 15 € | 18 € | 2.2× ✗ | 1.8× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0127 Chargé de sourcing | 369 | 36 € | 90 € | 34 € | 7 € | 27 € | 1.1× ✗ | 0.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0128 Screener CV | 720 | 70 € | 175 € | 40 € | 14 € | 26 € | 1.7× ✗ | 0.2× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0129 Coordinateur entretiens | 1410 | 133 € | 332 € | 44 € | 27 € | 18 € | 3.0× ✗ | 2.5× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0130 Agent onboarding | 364 | 48 € | 120 € | 27 € | 10 € | 18 € | 1.7× ✗ | 1.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0131 Gestionnaire congés | 1235 | 145 € | 362 € | 45 € | 29 € | 16 € | **3.2×** | 2.6× ✗ | 8 € | S (1/bundle) | 2 800 € |
| AG-0132 Gestionnaire absences | 95 | 10 € | 26 € | 15 € | 2 € | 13 € | 0.7× ✗ | 0.4× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0133 Assistant paie | 5 | 1 € | 2 € | 14 € | 0 € | 14 € | 0.1× ✗ | 0.0× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0134 Agent support RH | 1235 | 115 € | 288 € | 45 € | 23 € | 22 € | 2.5× ✗ | 2.3× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0135 Rédacteur offres d'emploi | 604 | 57 € | 141 € | 30 € | 11 € | 19 € | 1.9× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0136 Assistant formation | 190 | 26 € | 66 € | 21 € | 5 € | 16 € | 1.3× ✗ | 0.8× ✗ | 8 € | S (1/bundle) | 2 800 € |
| AG-0137 Agent de suivi candidats | 95 | 10 € | 26 € | 20 € | 2 € | 18 € | 0.5× ✗ | 0.4× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0138 Gestionnaire dossiers salariés | 640 | 88 € | 219 € | 36 € | 18 € | 19 € | 2.4× ✗ | 1.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0139 Assistant mobilité | 604 | 70 € | 176 € | 27 € | 14 € | 13 € | 2.6× ✗ | 1.7× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0140 Assistant recrutement | 484 | 61 € | 152 € | 34 € | 12 € | 22 € | 1.8× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0141 Analyste RH junior | 154 | 14 € | 36 € | 21 € | 3 € | 19 € | 0.7× ✗ | 0.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0142 Assistant talent management | 455 | 50 € | 124 € | 23 € | 10 € | 14 € | 2.1× ✗ | 1.1× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0143 Assistant performance | 339 | 40 € | 100 € | 21 € | 8 € | 13 € | 1.9× ✗ | 1.1× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0144 Agent de communication RH | 601 | 56 € | 140 € | 28 € | 11 € | 17 € | 2.0× ✗ | 1.2× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0145 Assistant administration du personnel | 244 | 34 € | 85 € | 22 € | 7 € | 16 € | 1.5× ✗ | 1.0× ✗ | 8 € | S (1/bundle) | 2 800 € |
| AG-0146 Gestionnaire avantages | 8 | 1 € | 3 € | 14 € | 0 € | 13 € | 0.1× ✗ | 0.0× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0147 Assistant relations sociales | 190 | 27 € | 66 € | 17 € | 5 € | 12 € | 1.6× ✗ | 0.7× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0148 Assistant SIRH | 41 | 6 € | 14 € | 20 € | 1 € | 19 € | 0.3× ✗ | 0.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0149 Reporting RH | 303 | 42 € | 106 € | 24 € | 8 € | 15 € | 1.8× ✗ | 1.0× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0150 HR operations assistant | 219 | 22 € | 54 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0151 Sourcer | 219 | 22 € | 55 € | 33 € | 4 € | 29 € | 0.7× ✗ | 0.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0152 Recruiter junior | 394 | 52 € | 130 € | 36 € | 10 € | 25 € | 1.5× ✗ | 1.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0153 Recruiter sédentaire | 124 | 14 € | 36 € | 27 € | 3 € | 25 € | 0.5× ✗ | 0.5× ✗ | 12 € | S (1/bundle) | 2 800 € |
| AG-0154 Talent acquisition assistant | 162 | 15 € | 38 € | 25 € | 3 € | 22 € | 0.6× ✗ | 0.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0155 Agent de préqualification | 361 | 34 € | 84 € | 29 € | 7 € | 22 € | 1.2× ✗ | 0.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0156 Agent de chasse | 244 | 33 € | 81 € | 34 € | 7 € | 27 € | 1.0× ✗ | 0.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0157 Coordinateur candidats | 244 | 24 € | 60 € | 25 € | 5 € | 20 € | 1.0× ✗ | 0.8× ✗ | 10 € | S (1/bundle) | 2 800 € |
| AG-0158 Agent de prise de rendez-vous | 694 | 65 € | 162 € | 26 € | 13 € | 13 € | 2.5× ✗ | 1.6× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0159 Agent de suivi candidats | 95 | 12 € | 30 € | 18 € | 2 € | 16 € | 0.7× ✗ | 0.4× ✗ | 8 € | S (1/bundle) | 2 800 € |
| AG-0160 Agent de recherche de profils | 244 | 26 € | 64 € | 32 € | 5 € | 27 € | 0.8× ✗ | 0.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0161 Rédacteur d'annonces | 604 | 57 € | 141 € | 30 € | 11 € | 19 € | 1.9× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0162 Analyste CV | 720 | 67 € | 168 € | 47 € | 13 € | 34 € | 1.4× ✗ | 1.4× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0163 Analyste profils LinkedIn | 630 | 59 € | 147 € | 35 € | 12 € | 24 € | 1.7× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0164 Assistant entretiens | 390 | 46 € | 115 € | 30 € | 9 € | 20 € | 1.6× ✗ | 1.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0165 Agent de référence candidats | 630 | 66 € | 164 € | 27 € | 13 € | 14 € | 2.5× ✗ | 1.4× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0166 Assistant recrutement international | 605 | 57 € | 142 € | 30 € | 11 € | 19 € | 1.9× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0167 Agent de matching candidats | 785 | 75 € | 187 € | 35 € | 15 € | 20 € | 2.1× ✗ | 1.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0168 Agent de relance candidats | 95 | 12 € | 29 € | 18 € | 2 € | 16 € | 0.7× ✗ | 0.4× ✗ | 8 € | S (1/bundle) | 2 800 € |
| AG-0169 Agent de relance clients | 640 | 61 € | 152 € | 30 € | 12 € | 18 € | 2.0× ✗ | 1.6× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0170 Assistant commercial recrutement | 364 | 51 € | 127 € | 32 € | 10 € | 22 € | 1.6× ✗ | 1.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0171 Analyste marché emploi | 310 | 36 € | 91 € | 28 € | 7 € | 20 € | 1.3× ✗ | 0.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0172 Assistant cabinet de recrutement | 215 | 23 € | 58 € | 18 € | 5 € | 13 € | 1.3× ✗ | 0.7× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0173 Gestionnaire ATS | 41 | 5 € | 14 € | 17 € | 1 € | 16 € | 0.3× ✗ | 0.2× ✗ | 8 € | S (1/bundle) | 2 800 € |
| AG-0174 Reporting recrutement | 5 | 1 € | 2 € | 17 € | 0 € | 17 € | 0.0× ✗ | 0.0× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0175 Recruitment operations specialist | 103 | 11 € | 27 € | 23 € | 2 € | 20 € | 0.5× ✗ | 0.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0176 SDR | 733 | 68 € | 171 € | 39 € | 14 € | 26 € | 1.7× ✗ | 1.7× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0177 BDR | 520 | 48 € | 121 € | 35 € | 10 € | 26 € | 1.4× ✗ | 1.3× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0178 Téléprospecteur | 904 | 84 € | 211 € | 36 € | 17 € | 19 € | 2.4× ✗ | 1.9× ✗ | 16 € | S (1/bundle) | 2 800 € |
| AG-0179 Assistant commercial | 1354 | 156 € | 389 € | 57 € | 31 € | 26 € | 2.7× ✗ | 2.7× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0180 Sales operations assistant | 53 | 7 € | 17 € | 34 € | 1 € | 33 € | 0.2× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0181 Lead generation specialist | 1051 | 98 € | 245 € | 45 € | 20 € | 26 € | 2.2× ✗ | 2.1× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0182 Lead qualifier | 784 | 73 € | 183 € | 40 € | 15 € | 26 € | 1.8× ✗ | 1.8× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0183 Appointment setter | 1354 | 126 € | 316 € | 44 € | 25 € | 19 € | 2.9× ✗ | 2.4× ✗ | 16 € | S (1/bundle) | 2 800 € |
| AG-0184 Account development representative | 313 | 29 € | 74 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0185 Inside sales assistant | 574 | 55 € | 137 € | 37 € | 11 € | 26 € | 1.5× ✗ | 1.4× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0186 Agent de relance commerciale | 189 | 19 € | 47 € | 30 € | 4 € | 26 € | 0.6× ✗ | 0.6× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0187 Agent de devis | 1024 | 98 € | 246 € | 45 € | 20 € | 26 € | 2.2× ✗ | 2.1× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0188 Agent de propositions commerciales | 1200 | 119 € | 297 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0189 Agent CRM | 646 | 62 € | 155 € | 45 € | 12 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0190 Sales analyst junior | 167 | 16 € | 39 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0191 Assistant account manager | 999 | 121 € | 303 € | 50 € | 24 € | 26 € | 2.4× ✗ | 2.4× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0192 Customer success assistant | 228 | 22 € | 54 € | 30 € | 4 € | 26 € | 0.7× ✗ | 0.7× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0193 Renewal specialist | 604 | 63 € | 158 € | 38 € | 13 € | 26 € | 1.6× ✗ | 1.6× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0194 Upsell assistant | 465 | 51 € | 126 € | 43 € | 10 € | 33 € | 1.2× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0195 Cross-sell assistant | 1210 | 113 € | 282 € | 55 € | 23 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0196 Sales support | 371 | 42 € | 104 € | 34 € | 8 € | 26 € | 1.2× ✗ | 1.2× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0197 Agent de qualification B2B | 909 | 99 € | 247 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0198 Agent de prospection B2C | 1290 | 120 € | 301 € | 43 € | 24 € | 19 € | 2.8× ✗ | 2.4× ✗ | 16 € | S (1/bundle) | 2 800 € |
| AG-0199 Assistant grands comptes | 756 | 78 € | 194 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0200 Sales operations manager | 306 | 36 € | 89 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0201 Rédacteur marketing | 1054 | 112 € | 281 € | 43 € | 22 € | 20 € | 2.6× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0202 Content manager | 487 | 61 € | 153 € | 33 € | 12 € | 20 € | 1.9× ✗ | 1.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0203 Content writer | 1054 | 112 € | 281 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0204 SEO specialist junior | 309 | 43 € | 108 € | 41 € | 9 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0205 SEO assistant | 756 | 106 € | 264 € | 41 € | 21 € | 20 € | 2.5× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0206 Email marketer | 633 | 68 € | 169 € | 34 € | 14 € | 20 € | 2.0× ✗ | 1.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0207 CRM marketer | 1054 | 112 € | 281 € | 43 € | 22 € | 20 € | 2.6× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0208 Community manager | 665 | 77 € | 194 € | 36 € | 15 € | 20 € | 2.2× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0209 Social media manager junior | 338 | 33 € | 83 € | 27 € | 7 € | 20 € | 1.2× ✗ | 1.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0210 Growth assistant | 931 | 102 € | 255 € | 53 € | 20 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0211 Marketing analyst junior | 458 | 57 € | 142 € | 44 € | 11 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0212 Market research analyst | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0213 Competitive intelligence analyst | 309 | 29 € | 73 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0214 Campaign assistant | 931 | 116 € | 290 € | 44 € | 23 € | 20 € | 2.7× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0215 Marketing operations assistant | 905 | 126 € | 316 € | 46 € | 25 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0216 Marketing automation specialist | 756 | 92 € | 229 € | 39 € | 18 € | 20 € | 2.4× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0217 Lead nurturing specialist | 1210 | 162 € | 405 € | 53 € | 32 € | 20 € | **3.1×** | 2.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0218 Landing page specialist | 1054 | 105 € | 263 € | 41 € | 21 € | 20 € | 2.5× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0219 Conversion optimization assistant | 633 | 68 € | 169 € | 46 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0220 Product marketing assistant | 753 | 91 € | 228 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0221 Affiliate marketing assistant | 614 | 86 € | 214 € | 50 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0222 Influencer marketing assistant | 785 | 96 € | 239 € | 52 € | 19 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0223 Event marketing assistant | 1381 | 186 € | 465 € | 58 € | 37 € | 20 € | **3.2×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0224 Marketing reporting analyst | 215 | 23 € | 58 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0225 Marketing coordinator | 108 | 14 € | 34 € | 23 € | 3 € | 20 € | 0.6× ✗ | 0.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0226 Media buyer junior | 513 | 63 € | 158 € | 45 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0227 Paid search specialist | 199 | 21 € | 52 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0228 Paid social specialist | 691 | 81 € | 203 € | 49 € | 16 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0229 Campaign manager junior | 960 | 126 € | 314 € | 45 € | 25 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0230 Ad copywriter | 1051 | 126 € | 315 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0231 Creative strategist assistant | 902 | 119 € | 298 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0232 Advertising analyst | 458 | 64 € | 160 € | 73 € | 13 € | 60 € | 0.9× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0233 PPC analyst | 18 | 2 € | 6 € | 33 € | 0 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0234 SEM assistant | 225 | 30 € | 75 € | 26 € | 6 € | 20 € | 1.1× ✗ | 0.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0235 Display advertising specialist | 228 | 32 € | 79 € | 39 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0236 Programmatic assistant | 50 | 5 € | 14 € | 34 € | 1 € | 33 € | 0.2× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0237 Campaign trafficking specialist | 1054 | 126 € | 316 € | 46 € | 25 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0238 Ad operations assistant | 163 | 21 € | 53 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0239 Audience analyst | 455 | 64 € | 159 € | 45 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0240 Conversion analyst | 66 | 9 € | 23 € | 34 € | 2 € | 33 € | 0.3× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0241 ROAS analyst | 8 | 1 € | 3 € | 60 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0242 Ad reporting specialist | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0243 Retargeting specialist | 44 | 6 € | 15 € | 34 € | 1 € | 33 € | 0.2× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0244 Affiliate advertising assistant | 21 | 3 € | 7 € | 33 € | 1 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0245 Local advertising specialist | 50 | 7 € | 18 € | 22 € | 1 € | 20 € | 0.3× ✗ | 0.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0246 Marketplace advertising specialist | 102 | 14 € | 35 € | 35 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0247 Creative testing assistant | 785 | 103 € | 257 € | 53 € | 21 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0248 Ad account manager junior | 934 | 96 € | 239 € | 39 € | 19 € | 20 € | 2.4× ✗ | 2.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0249 Media planning assistant | 1051 | 133 € | 332 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0250 Advertising operations manager | 306 | 43 € | 107 € | 41 € | 9 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0251 Assistant communication | 1261 | 154 € | 385 € | 51 € | 31 € | 20 € | **3.0×** | 2.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0252 Chargé de communication junior | 1200 | 161 € | 402 € | 65 € | 32 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0253 Community manager | 156 | 18 € | 44 € | 24 € | 4 € | 20 € | 0.7× ✗ | 0.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0254 Social media assistant | 960 | 120 € | 301 € | 44 € | 24 € | 20 € | 2.7× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0255 Rédacteur corporate | 1200 | 147 € | 367 € | 90 € | 29 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0256 Rédacteur communiqué | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0257 Attaché de presse assistant | 902 | 119 € | 298 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0258 Veilleur médias | 240 | 28 € | 70 € | 38 € | 6 € | 33 € | 0.7× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0259 Veilleur réputation | 276 | 37 € | 93 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0260 Analyste sentiment | 309 | 29 € | 73 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0261 Assistant relations presse | 753 | 105 € | 263 € | 54 € | 21 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0262 Assistant communication interne | 760 | 92 € | 230 € | 39 € | 18 € | 20 € | 2.4× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0263 Assistant événementiel | 1200 | 161 € | 402 € | 52 € | 32 € | 20 € | **3.1×** | 2.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0264 Rédacteur newsletter | 902 | 105 € | 263 € | 54 € | 21 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0265 Gestionnaire intranet | 167 | 23 € | 58 € | 25 € | 5 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0266 Assistant marque employeur | 607 | 85 € | 212 € | 50 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0267 Content coordinator | 247 | 26 € | 65 € | 26 € | 5 € | 20 € | 1.0× ✗ | 0.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0268 Communication digitale | 189 | 26 € | 66 € | 38 € | 5 € | 33 € | 0.7× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0269 Communication locale | 1682 | 200 € | 500 € | 60 € | 40 € | 20 € | **3.3×** | 3.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0270 Assistant influence | 753 | 91 € | 228 € | 78 € | 18 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0271 Assistant partenariats | 902 | 112 € | 280 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0272 Communication reporting | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0273 Assistant crise documentaire | 840 | 110 € | 276 € | 82 € | 22 € | 60 € | 1.3× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0274 Media monitoring specialist | 157 | 22 € | 55 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0275 Communication operations | 47 | 6 € | 15 € | 22 € | 1 € | 20 € | 0.3× ✗ | 0.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0276 Graphiste de production | 3600 | 512 € | 1 015 € | 188 € | 102 € | 85 € | 2.7× ✗ | 1.0× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0277 Graphiste web | 900 | 150 € | 276 € | 115 € | 30 € | 85 € | 1.3× ✗ | 0.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0278 Designer social media | 930 | 208 € | 349 € | 144 € | 42 € | 102 € | 1.4× ✗ | 0.5× ✗ | 102 € | XL (3/bundle) | 2 800 € |
| AG-0279 Designer publicitaire | 3600 | 568 € | 1 155 € | 199 € | 114 € | 85 € | 2.9× ✗ | 1.1× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0280 Designer présentation | 3600 | 391 € | 978 € | 140 € | 78 € | 61 € | 2.8× ✗ | 0.8× ✗ | 61 € | XL (6/bundle) | 2 800 € |
| AG-0281 Designer email | 3600 | 335 € | 839 € | 152 € | 67 € | 85 € | 2.2× ✗ | 0.7× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0282 Designer landing page | 900 | 128 € | 254 € | 111 € | 26 € | 85 € | 1.2× ✗ | 0.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0283 UI designer junior | 900 | 128 € | 254 € | 111 € | 26 € | 85 € | 1.2× ✗ | 0.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0284 UX designer junior | 900 | 91 € | 227 € | 49 € | 18 € | 31 € | 1.9× ✗ | 0.2× ✗ | 31 € | XL (12/bundle) | 2 800 € |
| AG-0285 Product designer junior | 900 | 84 € | 210 € | 102 € | 17 € | 85 € | 0.8× ✗ | 0.2× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0286 Brand designer junior | 602 | 100 € | 184 € | 105 € | 20 € | 85 € | 0.9× ✗ | 0.2× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0287 Logo designer | 900 | 128 € | 254 € | 111 € | 26 € | 85 € | 1.2× ✗ | 0.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0288 Illustrateur commercial | 900 | 135 € | 271 € | 112 € | 27 € | 85 € | 1.2× ✗ | 0.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0289 Infographiste | 900 | 113 € | 249 € | 108 € | 23 € | 85 € | 1.1× ✗ | 0.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0290 Maquettiste | 900 | 105 € | 262 € | 106 € | 21 € | 85 € | 1.0× ✗ | 0.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0291 Retoucheur photo | 3600 | 689 € | 1 192 € | 223 € | 138 € | 85 € | **3.1×** | 1.3× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0292 Détoureur | 3600 | 600 € | 1 104 € | 205 € | 120 € | 85 € | 2.9× ✗ | 1.2× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0293 Designer e-commerce | 900 | 179 € | 315 € | 121 € | 36 € | 85 € | 1.5× ✗ | 0.4× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0294 Designer packaging | 3600 | 419 € | 1 048 € | 169 € | 84 € | 85 € | 2.5× ✗ | 0.9× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0295 Designer catalogue | 2100 | 287 € | 716 € | 143 € | 57 € | 85 € | 2.0× ✗ | 0.6× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0296 Designer print | 1650 | 189 € | 472 € | 123 € | 38 € | 85 € | 1.5× ✗ | 0.4× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0297 Designer événementiel | 1650 | 211 € | 494 € | 127 € | 42 € | 85 € | 1.6× ✗ | 0.5× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0298 Designer infographie | 2100 | 260 € | 616 € | 137 € | 52 € | 85 € | 1.9× ✗ | 0.6× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0299 Creative production specialist | 1650 | 232 € | 546 € | 132 € | 46 € | 85 € | 1.8× ✗ | 0.5× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0300 Design operations assistant | 2440 | 257 € | 642 € | 96 € | 51 € | 45 € | 2.7× ✗ | 1.7× ✗ | 28 € | M (2/bundle) | 2 800 € |
| AG-0301 Monteur vidéo junior | 1200 | 347 € | 556 € | 178 € | 69 € | 109 € | 1.9× ✗ | 0.7× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0302 Monteur shorts | 1200 | 264 € | 452 € | 162 € | 53 € | 109 € | 1.6× ✗ | 0.6× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0303 Monteur podcast | 1200 | 126 € | 314 € | 51 € | 25 € | 26 € | 2.5× ✗ | 2.4× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0304 Sous-titreur | 1200 | 112 € | 280 € | 48 € | 22 € | 26 € | 2.3× ✗ | 2.3× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0305 Transcripteur audio | 1650 | 161 € | 402 € | 58 € | 32 € | 26 € | 2.8× ✗ | 2.7× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0306 Nettoyeur audio | 1650 | 196 € | 489 € | 65 € | 39 € | 26 € | **3.0×** | 3.0× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0307 Assistant sound design | 1200 | 133 € | 332 € | 86 € | 27 € | 59 € | 1.6× ✗ | 0.3× ✗ | 59 € | XL (6/bundle) | 2 800 € |
| AG-0308 Voice-over producer | 1200 | 140 € | 349 € | 54 € | 28 € | 26 € | 2.6× ✗ | 2.5× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0309 Doublage assistant | 1051 | 140 € | 350 € | 54 € | 28 € | 26 € | 2.6× ✗ | 2.5× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0310 Assistant postproduction | 662 | 85 € | 214 € | 126 € | 17 € | 109 € | 0.7× ✗ | 0.2× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0311 Coloriste junior | 1054 | 181 € | 350 € | 145 € | 36 € | 109 € | 1.3× ✗ | 0.4× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0312 Retoucheur photo | 1200 | 199 € | 398 € | 125 € | 40 € | 85 € | 1.6× ✗ | 0.5× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0313 Photographe produit assistant | 1200 | 162 € | 372 € | 118 € | 32 € | 85 € | 1.4× ✗ | 0.4× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0314 Créateur thumbnail | 1200 | 214 € | 403 € | 128 € | 43 € | 85 € | 1.7× ✗ | 0.5× ✗ | 85 € | XL (4/bundle) | 2 800 € |
| AG-0315 Motion designer junior | 1200 | 286 € | 475 € | 166 € | 57 € | 109 € | 1.7× ✗ | 0.6× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0316 Assistant motion graphics | 1054 | 279 € | 459 € | 165 € | 56 € | 109 € | 1.7× ✗ | 0.6× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0317 Vidéo publicitaire editor | 1054 | 264 € | 454 € | 162 € | 53 € | 109 € | 1.6× ✗ | 0.6× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0318 Social video editor | 1200 | 355 € | 544 € | 180 € | 71 € | 109 € | 2.0× ✗ | 0.8× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0319 Podcast producer assistant | 1504 | 161 € | 403 € | 58 € | 32 € | 26 € | 2.8× ✗ | 2.7× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0320 Webinar editor | 1200 | 286 € | 475 € | 166 € | 57 € | 109 € | 1.7× ✗ | 0.6× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0321 Interview editor | 1200 | 224 € | 423 € | 154 € | 45 € | 109 € | 1.5× ✗ | 0.5× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0322 Media localization specialist | 1051 | 126 € | 315 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0323 Audio transcription specialist | 905 | 113 € | 281 € | 48 € | 23 € | 26 € | 2.3× ✗ | 2.3× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-0324 Video localization specialist | 1054 | 319 € | 488 € | 173 € | 64 € | 109 € | 1.9× ✗ | 0.7× ✗ | 109 € | XL (3/bundle) | 2 800 € |
| AG-0325 Postproduction coordinator | 1264 | 156 € | 389 € | 64 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0326 Traducteur généraliste | 1200 | 154 € | 384 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0327 Traducteur e-commerce | 1200 | 140 € | 349 € | 61 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0328 Traducteur marketing | 1200 | 140 € | 349 € | 88 € | 28 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0329 Traducteur technique | 1200 | 161 € | 402 € | 92 € | 32 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0330 Traducteur logiciel | 1200 | 140 € | 349 € | 72 € | 28 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0331 Traducteur documentaire | 1200 | 161 € | 402 € | 92 € | 32 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0332 Traducteur touristique | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0333 Traducteur support client | 1504 | 182 € | 456 € | 57 € | 36 € | 20 € | **3.2×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0334 Traducteur RH | 1200 | 154 € | 384 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0335 Traducteur financier | 1200 | 147 € | 367 € | 90 € | 29 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0336 Traducteur juridique assistant | 1200 | 154 € | 384 € | 91 € | 31 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0337 Localisation specialist | 1200 | 140 € | 349 € | 61 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0338 Post-editor traduction | 1054 | 140 € | 351 € | 61 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0339 Sous-titreur | 1200 | 126 € | 314 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0340 Localisation e-commerce | 814 | 98 € | 246 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0341 Localisation app | 1200 | 154 € | 384 € | 75 € | 31 € | 44 € | 2.0× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0342 Localisation jeu vidéo | 1200 | 147 € | 367 € | 74 € | 29 € | 44 € | 2.0× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0343 QA linguistique | 1200 | 154 € | 384 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0344 Terminologue assistant | 902 | 126 € | 315 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0345 Gestionnaire de glossaire | 607 | 78 € | 195 € | 36 € | 16 € | 20 € | 2.2× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0346 Coordinateur traduction | 1264 | 168 € | 421 € | 54 € | 34 € | 20 € | **3.1×** | 2.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0347 Assistant interprétariat | 1054 | 126 € | 316 € | 46 € | 25 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0348 Traducteur SEO | 1051 | 126 € | 315 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0349 Traducteur catalogue | 1200 | 147 € | 367 € | 74 € | 29 € | 44 € | 2.0× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0350 Translation operations specialist | 309 | 36 € | 90 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0351 Développeur junior | 1200 | 112 € | 280 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0352 Développeur frontend | 1200 | 126 € | 314 € | 69 € | 25 € | 44 € | 1.8× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0353 Développeur backend | 1200 | 112 € | 280 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0354 Développeur full-stack | 1200 | 112 € | 280 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0355 Développeur API | 1200 | 119 € | 297 € | 84 € | 24 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0356 Développeur mobile | 1054 | 112 € | 281 € | 67 € | 22 € | 44 € | 1.7× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0357 Intégrateur web | 1200 | 119 € | 297 € | 68 € | 24 € | 44 € | 1.8× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0358 Développeur WordPress | 756 | 78 € | 194 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0359 Développeur Shopify | 905 | 92 € | 229 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0360 Développeur e-commerce | 1200 | 112 € | 280 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0361 Développeur PHP | 1054 | 112 € | 281 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0362 Développeur JavaScript | 756 | 78 € | 194 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0363 Développeur Python | 1200 | 112 € | 280 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0364 Développeur Java | 1054 | 105 € | 264 € | 81 € | 21 € | 60 € | 1.3× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0365 Développeur .NET | 1051 | 112 € | 280 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0366 Développeur SQL | 1200 | 126 € | 314 € | 85 € | 25 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0367 Testeur logiciel | 1200 | 133 € | 332 € | 71 € | 27 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0368 QA engineer junior | 909 | 92 € | 230 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0369 Bug fixer | 1054 | 98 € | 246 € | 80 € | 20 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0370 Code reviewer | 934 | 89 € | 222 € | 78 € | 18 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0371 Technical writer | 902 | 84 € | 210 € | 61 € | 17 € | 44 € | 1.4× ✗ | 0.2× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0372 Support technique niveau 1 | 1384 | 129 € | 323 € | 46 € | 26 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0373 Support technique niveau 2 | 1355 | 126 € | 316 € | 85 € | 25 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0374 DevOps junior | 756 | 78 € | 194 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0375 Développeur automation | 934 | 96 € | 239 € | 52 € | 19 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0376 Data entry specialist | 1504 | 210 € | 526 € | 86 € | 42 € | 44 € | 2.4× ✗ | 0.5× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0377 Data analyst junior | 1200 | 126 € | 314 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0378 BI analyst junior | 902 | 91 € | 228 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0379 Reporting analyst | 760 | 78 € | 196 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0380 Data quality analyst | 931 | 109 € | 273 € | 54 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0381 Data cleaning specialist | 1650 | 161 € | 402 € | 65 € | 32 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0382 Data labeling specialist | 1200 | 119 € | 297 € | 68 € | 24 € | 44 € | 1.8× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0383 Research analyst | 1054 | 112 € | 281 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0384 Web analyst | 497 | 54 € | 135 € | 43 € | 11 € | 33 € | 1.2× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0385 Product analyst junior | 611 | 78 € | 196 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0386 Marketing data analyst | 756 | 92 € | 229 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0387 Sales data analyst | 167 | 16 € | 41 € | 36 € | 3 € | 33 € | 0.5× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0388 Finance data analyst | 604 | 63 € | 159 € | 73 € | 13 € | 60 € | 0.9× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0389 Operations analyst | 348 | 42 € | 104 € | 41 € | 8 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0390 Forecasting assistant | 753 | 84 € | 211 € | 77 € | 17 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0391 Dashboard builder | 902 | 105 € | 263 € | 65 € | 21 € | 44 € | 1.6× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0392 Data visualization assistant | 1051 | 120 € | 267 € | 68 € | 24 € | 44 € | 1.8× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0393 Database assistant | 782 | 74 € | 186 € | 47 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0394 SQL analyst junior | 1054 | 112 € | 281 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0395 Data migration specialist | 1200 | 140 € | 349 € | 88 € | 28 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0396 ETL assistant | 694 | 73 € | 183 € | 47 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0397 Data governance assistant | 756 | 78 € | 194 € | 76 € | 16 € | 60 € | 1.0× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0398 Master data specialist | 1061 | 141 € | 353 € | 61 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0399 Data operations analyst | 662 | 72 € | 179 € | 47 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0400 Analytics engineer junior | 934 | 95 € | 239 € | 79 € | 19 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0401 SOC analyst junior | 1384 | 157 € | 393 € | 64 € | 31 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0402 Security monitoring analyst | 342 | 41 € | 102 € | 41 € | 8 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0403 Vulnerability analyst junior | 607 | 71 € | 177 € | 47 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0404 Compliance security assistant | 313 | 44 € | 109 € | 41 € | 9 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0405 GRC analyst junior | 604 | 84 € | 211 € | 77 € | 17 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0406 Security documentation specialist | 604 | 56 € | 141 € | 44 € | 11 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0407 IAM assistant | 1384 | 193 € | 484 € | 71 € | 39 € | 33 € | 2.7× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0408 Access review analyst | 604 | 84 € | 211 € | 49 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0409 Security awareness coordinator | 788 | 74 € | 184 € | 47 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0410 Phishing simulation coordinator | 902 | 98 € | 245 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0411 Incident documentation assistant | 1355 | 134 € | 334 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0412 Threat intelligence assistant | 491 | 60 € | 150 € | 72 € | 12 € | 60 € | 0.8× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0413 Security reporting analyst | 753 | 77 € | 193 € | 48 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0414 Audit security assistant | 1051 | 133 € | 332 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0415 Risk assessment assistant | 902 | 112 € | 280 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0416 Asset inventory specialist | 167 | 23 € | 58 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0417 Security questionnaire analyst | 1501 | 161 € | 402 € | 65 € | 32 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0418 Third-party risk assistant | 1203 | 154 € | 385 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0419 Privacy security assistant | 1054 | 105 € | 263 € | 81 € | 21 € | 60 € | 1.3× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0420 Endpoint monitoring assistant | 342 | 41 € | 102 € | 41 € | 8 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0421 Cloud security assistant | 342 | 41 € | 102 € | 41 € | 8 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0422 Security operations assistant | 374 | 44 € | 110 € | 29 € | 9 € | 20 € | 1.5× ✗ | 1.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0423 Cyber threat researcher junior | 1051 | 105 € | 262 € | 81 € | 21 € | 60 € | 1.3× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0424 Security policy assistant | 1051 | 112 € | 280 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0425 Cybersecurity operations analyst | 455 | 50 € | 124 € | 70 € | 10 € | 60 € | 0.7× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0426 Assistant juridique | 429 | 49 € | 121 € | 30 € | 10 € | 20 € | 1.6× ✗ | 1.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0427 Juriste junior | 1501 | 147 € | 367 € | 90 € | 29 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0428 Legal researcher | 1650 | 161 € | 402 € | 92 € | 32 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0429 Contract analyst | 1501 | 168 € | 420 € | 78 € | 34 € | 44 € | 2.2× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0430 Contract reviewer | 1650 | 175 € | 437 € | 95 € | 35 € | 60 € | 1.8× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0431 Clause analyst | 458 | 43 € | 108 € | 69 € | 9 € | 60 € | 0.6× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0432 Legal document specialist | 1530 | 158 € | 395 € | 52 € | 32 € | 20 € | **3.0×** | 2.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0433 Due diligence assistant | 549 | 63 € | 156 € | 57 € | 13 € | 44 € | 1.1× ✗ | 0.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0434 Compliance assistant | 462 | 64 € | 161 € | 45 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0435 GDPR assistant | 1504 | 147 € | 368 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0436 Corporate legal assistant | 607 | 78 € | 195 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0437 IP assistant | 196 | 20 € | 51 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0438 Litigation research assistant | 1054 | 126 € | 316 € | 86 € | 25 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0439 Case file assistant | 1530 | 164 € | 409 € | 77 € | 33 € | 44 € | 2.1× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0440 Legal intake agent | 1381 | 137 € | 343 € | 48 € | 27 € | 20 € | 2.9× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0441 Legal correspondence agent | 1384 | 145 € | 361 € | 61 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0442 Legal billing assistant | 374 | 51 € | 127 € | 30 € | 10 € | 20 € | 1.7× ✗ | 1.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0443 Legal operations specialist | 455 | 57 € | 142 € | 44 € | 11 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0444 Contract lifecycle specialist | 1086 | 150 € | 376 € | 63 € | 30 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0445 Legal knowledge analyst | 604 | 70 € | 176 € | 47 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0446 Regulatory monitoring analyst | 371 | 45 € | 112 € | 69 € | 9 € | 60 € | 0.7× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0447 Legal translation assistant | 1504 | 154 € | 386 € | 91 € | 31 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0448 Paralegal | 1054 | 119 € | 299 € | 84 € | 24 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0449 Legal project assistant | 669 | 93 € | 233 € | 51 € | 19 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0450 Legal operations manager | 157 | 22 € | 55 € | 65 € | 4 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0451 Assistant immobilier | 853 | 112 € | 280 € | 43 € | 22 € | 20 € | 2.6× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0452 Agent de qualification immobilier | 2130 | 282 € | 706 € | 89 € | 56 € | 33 € | **3.2×** | 1.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0453 Agent de prospection immobilier | 429 | 53 € | 132 € | 31 € | 11 € | 20 € | 1.7× ✗ | 1.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0454 Rédacteur d'annonces immobilières | 1650 | 182 € | 454 € | 81 € | 36 € | 44 € | 2.3× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0455 Property listing manager | 257 | 28 € | 69 € | 26 € | 6 € | 20 € | 1.1× ✗ | 0.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0456 Property search agent | 1384 | 137 € | 343 € | 60 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0457 Agent de prise de rendez-vous | 2580 | 323 € | 807 € | 85 € | 65 € | 20 € | **3.8×** | **3.5×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0458 Assistant gestion locative | 66 | 9 € | 23 € | 22 € | 2 € | 20 € | 0.4× ✗ | 0.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0459 Gestionnaire locatif junior | 970 | 120 € | 300 € | 57 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0460 Assistant syndic | 756 | 99 € | 247 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0461 Assistant transaction | 1119 | 141 € | 352 € | 61 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0462 Assistant location | 1650 | 196 € | 489 € | 83 € | 39 € | 44 € | 2.3× ✗ | 0.5× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0463 Analyste immobilier junior | 753 | 98 € | 246 € | 80 € | 20 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0464 Assistant estimation | 1051 | 140 € | 350 € | 72 € | 28 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0465 Assistant investissement immobilier | 1051 | 140 € | 350 € | 88 € | 28 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0466 Property data analyst | 455 | 50 € | 124 € | 70 € | 10 € | 60 € | 0.7× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0467 Agent relation locataire | 2370 | 303 € | 758 € | 93 € | 61 € | 33 € | **3.3×** | 1.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0468 Agent relation propriétaire | 611 | 64 € | 160 € | 45 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0469 Agent suivi visites | 254 | 26 € | 64 € | 25 € | 5 € | 20 € | 1.0× ✗ | 0.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0470 Agent relance prospects | 1115 | 149 € | 372 € | 50 € | 30 € | 20 € | 3.0× ✗ | 2.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0471 Agent renouvellement bail | 789 | 103 € | 258 € | 53 € | 21 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0472 Assistant immobilier commercial | 753 | 91 € | 228 € | 63 € | 18 € | 44 € | 1.5× ✗ | 0.2× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0473 Assistant immobilier entreprise | 909 | 113 € | 283 € | 83 € | 23 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0474 Real estate marketing assistant | 756 | 100 € | 216 € | 64 € | 20 € | 44 € | 1.6× ✗ | 0.2× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0475 Property operations assistant | 1235 | 157 € | 393 € | 76 € | 31 € | 44 € | 2.1× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0476 E-commerce manager junior | 351 | 42 € | 105 € | 69 € | 8 € | 60 € | 0.6× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0477 Gestionnaire catalogue | 345 | 48 € | 121 € | 30 € | 10 € | 20 € | 1.6× ✗ | 1.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0478 Product listing specialist | 1650 | 203 € | 507 € | 85 € | 41 € | 44 € | 2.4× ✗ | 0.5× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0479 Importateur produits | 1650 | 196 € | 489 € | 59 € | 39 € | 20 € | **3.3×** | 3.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0480 Product description writer | 1501 | 175 € | 437 € | 79 € | 35 € | 44 € | 2.2× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0481 Product data specialist | 640 | 89 € | 223 € | 38 € | 18 € | 20 € | 2.3× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0482 Pricing assistant | 814 | 107 € | 267 € | 54 € | 21 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0483 Marketplace manager junior | 1119 | 121 € | 303 € | 57 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0484 Order management specialist | 1050 | 116 € | 290 € | 44 € | 23 € | 20 € | 2.7× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0485 Returns specialist | 999 | 138 € | 345 € | 72 € | 28 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0486 Customer support e-commerce | 4385 | 476 € | 1 190 € | 128 € | 95 € | 33 € | **3.7×** | 1.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0487 Review management specialist | 104 | 11 € | 29 € | 35 € | 2 € | 33 € | 0.3× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0488 Email commerce specialist | 225 | 24 € | 60 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0489 E-commerce SEO specialist | 79 | 9 € | 24 € | 34 € | 2 € | 33 € | 0.3× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0490 Product feed specialist | 131 | 18 € | 46 € | 24 € | 4 € | 20 € | 0.8× ✗ | 0.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0491 Inventory assistant | 131 | 18 € | 46 € | 24 € | 4 € | 20 € | 0.8× ✗ | 0.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0492 Supplier sourcing assistant | 905 | 106 € | 264 € | 54 € | 21 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0493 Dropshipping assistant | 251 | 28 € | 70 € | 26 € | 6 € | 20 € | 1.1× ✗ | 0.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0494 Product research specialist | 31 | 4 € | 9 € | 33 € | 1 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0495 Conversion rate assistant | 494 | 55 € | 137 € | 44 € | 11 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0496 Merchandising assistant | 50 | 7 € | 17 € | 46 € | 1 € | 44 € | 0.1× ✗ | 0.0× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0497 Marketplace operations specialist | 73 | 10 € | 25 € | 22 € | 2 € | 20 € | 0.5× ✗ | 0.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0498 E-commerce analyst | 251 | 26 € | 66 € | 66 € | 5 € | 60 € | 0.4× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0499 E-commerce automation specialist | 513 | 49 € | 123 € | 42 € | 10 € | 33 € | 1.2× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0500 E-commerce operations manager | 788 | 75 € | 188 € | 75 € | 15 € | 60 € | 1.0× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0501 Assistant achats | 211 | 27 € | 67 € | 26 € | 5 € | 20 € | 1.0× ✗ | 0.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0502 Acheteur junior | 960 | 98 € | 245 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0503 Sourcing specialist | 760 | 92 € | 230 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0504 Supplier researcher | 1051 | 119 € | 297 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0505 Demandeur de devis | 960 | 105 € | 262 € | 41 € | 21 € | 20 € | 2.5× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0506 Comparateur fournisseurs | 1200 | 140 € | 349 € | 61 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0507 Analyste prix | 908 | 85 € | 213 € | 77 € | 17 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0508 Analyste fournisseurs | 8 | 1 € | 2 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0509 Gestionnaire commandes fournisseurs | 334 | 38 € | 96 € | 28 € | 8 € | 20 € | 1.4× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0510 Gestionnaire contrats fournisseurs | 908 | 92 € | 230 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0511 Procurement operations assistant | 941 | 90 € | 224 € | 38 € | 18 € | 20 € | 2.3× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0512 Assistant négociation | 1051 | 112 € | 280 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0513 Assistant appels d'offres | 934 | 110 € | 274 € | 42 € | 22 € | 20 € | 2.6× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0514 Analyste dépenses | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0515 Spend analyst junior | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0516 Procurement data analyst | 306 | 29 € | 72 € | 66 € | 6 € | 60 € | 0.4× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0517 Supplier onboarding specialist | 1080 | 116 € | 290 € | 44 € | 23 € | 20 € | 2.7× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0518 Supplier compliance assistant | 371 | 42 € | 105 € | 41 € | 8 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0519 Purchase order specialist | 276 | 32 € | 79 € | 27 € | 6 € | 20 € | 1.2× ✗ | 0.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0520 Procurement reporting analyst | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0521 Category assistant | 309 | 36 € | 90 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0522 Assistant approvisionnement | 40 | 6 € | 14 € | 21 € | 1 € | 20 € | 0.3× ✗ | 0.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0523 Assistant achats internationaux | 636 | 82 € | 205 € | 49 € | 16 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0524 Procurement automation specialist | 484 | 47 € | 117 € | 42 € | 9 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0525 Procurement operations manager | 160 | 15 € | 38 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0526 Assistant logistique | 240 | 28 € | 70 € | 26 € | 6 € | 20 € | 1.1× ✗ | 0.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0527 Dispatch assistant | 930 | 127 € | 318 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0528 Route planner | 131 | 18 € | 46 € | 36 € | 4 € | 33 € | 0.5× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0529 Transport planner | 422 | 51 € | 126 € | 43 € | 10 € | 33 € | 1.2× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0530 Fleet assistant | 795 | 76 € | 190 € | 36 € | 15 € | 20 € | 2.1× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0531 Shipment tracker | 542 | 60 € | 151 € | 32 € | 12 € | 20 € | 1.9× ✗ | 1.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0532 Order fulfillment specialist | 211 | 28 € | 70 € | 26 € | 6 € | 20 € | 1.1× ✗ | 0.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0533 Warehouse planning assistant | 127 | 18 € | 44 € | 36 € | 4 € | 33 € | 0.5× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0534 Inventory planner | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0535 Supply chain analyst junior | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0536 Demand planning assistant | 164 | 16 € | 40 € | 63 € | 3 € | 60 € | 0.3× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0537 Delivery coordinator | 1591 | 185 € | 462 € | 57 € | 37 € | 20 € | **3.2×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0538 Returns logistics specialist | 160 | 22 € | 55 € | 49 € | 4 € | 44 € | 0.5× ✗ | 0.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0539 Freight assistant | 170 | 17 € | 42 € | 24 € | 3 € | 20 € | 0.7× ✗ | 0.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0540 Carrier management assistant | 164 | 23 € | 57 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0541 Logistics customer support | 3241 | 369 € | 923 € | 94 € | 74 € | 20 € | **3.9×** | **3.7×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0542 Transport quotation assistant | 1051 | 119 € | 297 € | 44 € | 24 € | 20 € | 2.7× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0543 Delivery scheduling agent | 331 | 36 € | 91 € | 28 € | 7 € | 20 € | 1.3× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0544 Warehouse reporting analyst | 79 | 10 € | 24 € | 35 € | 2 € | 33 € | 0.3× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0545 Stock control assistant | 276 | 37 € | 93 € | 28 € | 7 € | 20 € | 1.3× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0546 Logistics data analyst | 310 | 34 € | 86 € | 67 € | 7 € | 60 € | 0.5× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0547 Supply chain documentation specialist | 931 | 102 € | 255 € | 65 € | 20 € | 44 € | 1.6× ✗ | 0.2× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0548 Logistics operations specialist | 200 | 19 € | 47 € | 36 € | 4 € | 33 € | 0.5× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0549 Procurement logistics assistant | 811 | 81 € | 203 € | 49 € | 16 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0550 Logistics operations manager | 200 | 19 € | 47 € | 64 € | 4 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0551 Dispatching agent | 1740 | 168 € | 419 € | 66 € | 34 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0552 Agent réservation transport | 5700 | 667 € | 1 667 € | 154 € | 133 € | 20 € | **4.3×** | **4.2×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0553 Planificateur de tournées | 31 | 4 € | 10 € | 61 € | 1 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0554 Gestionnaire flotte | 314 | 37 € | 92 € | 68 € | 7 € | 60 € | 0.5× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0555 Assistant flotte | 1333 | 185 € | 462 € | 81 € | 37 € | 44 € | 2.3× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0556 Agent suivi livraison | 4381 | 478 € | 1 195 € | 116 € | 96 € | 20 € | **4.1×** | **3.9×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0557 Agent support conducteur | 7080 | 678 € | 1 695 € | 168 € | 136 € | 33 € | **4.0×** | 2.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0558 Agent support client transport | 6811 | 642 € | 1 604 € | 161 € | 128 € | 33 € | **4.0×** | 1.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0559 Agent de qualification livraison | 331 | 43 € | 109 € | 53 € | 9 € | 44 € | 0.8× ✗ | 0.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0560 Agent de planification taxi | 2260 | 214 € | 534 € | 63 € | 43 € | 20 € | **3.4×** | **3.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0561 Agent de dispatch VTC | 13141 | 1 561 € | 3 903 € | 333 € | 312 € | 20 € | **4.7×** | **4.6×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0562 Agent de dispatch livraison | 1050 | 103 € | 259 € | 53 € | 21 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0563 Assistant transport routier | 189 | 25 € | 62 € | 25 € | 5 € | 20 € | 1.0× ✗ | 0.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0564 Assistant transport international | 871 | 85 € | 213 € | 50 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0565 Agent de gestion carburant | 225 | 30 € | 74 € | 26 € | 6 € | 20 € | 1.1× ✗ | 0.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0566 Agent de suivi maintenance | 255 | 33 € | 82 € | 39 € | 7 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0567 Assistant conformité transport | 225 | 30 € | 75 € | 66 € | 6 € | 60 € | 0.5× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0568 Agent de gestion documents transport | 334 | 45 € | 113 € | 53 € | 9 € | 44 € | 0.8× ✗ | 0.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0569 Analyste coûts transport | 157 | 22 € | 55 € | 65 € | 4 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0570 Analyste performance flotte | 44 | 5 € | 11 € | 61 € | 1 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0571 Assistant affrètement | 515 | 54 € | 135 € | 43 € | 11 € | 33 € | 1.2× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0572 Agent de recherche transporteurs | 31 | 4 € | 10 € | 33 € | 1 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0573 Agent de confirmation livraison | 211 | 24 € | 60 € | 25 € | 5 € | 20 € | 0.9× ✗ | 0.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0574 Transport operations specialist | 47 | 5 € | 12 € | 34 € | 1 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0575 Transport operations manager | 458 | 50 € | 124 € | 70 € | 10 € | 60 € | 0.7× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0576 Agent de voyage | 4050 | 444 € | 1 111 € | 121 € | 89 € | 33 € | **3.7×** | 1.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0577 Travel planner | 1054 | 126 € | 315 € | 85 € | 25 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0578 Agent réservation | 360 | 41 € | 101 € | 28 € | 8 € | 20 € | 1.4× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0579 Concierge virtuel | 8704 | 811 € | 2 028 € | 183 € | 162 € | 20 € | **4.4×** | **4.3×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0580 Agent support voyage | 4950 | 468 € | 1 171 € | 126 € | 94 € | 33 € | **3.7×** | 1.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0581 Agent hôtel | 1260 | 141 € | 353 € | 49 € | 28 € | 20 € | 2.9× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0582 Agent location vacances | 1921 | 206 € | 514 € | 85 € | 41 € | 44 € | 2.4× ✗ | 0.5× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0583 Agent recherche vols | 6510 | 742 € | 1 855 € | 181 € | 148 € | 33 € | **4.1×** | 2.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0584 Agent recherche hôtels | 6480 | 704 € | 1 761 € | 173 € | 141 € | 33 € | **4.1×** | 2.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0585 Itinerary planner | 1200 | 133 € | 332 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0586 Travel customer support | 1891 | 178 € | 444 € | 68 € | 36 € | 33 € | 2.6× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0587 Agent modification réservation | 4680 | 503 € | 1 258 € | 133 € | 101 € | 33 € | **3.8×** | 1.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0588 Agent annulation | 3964 | 420 € | 1 050 € | 117 € | 84 € | 33 € | **3.6×** | 1.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0589 Agent assurance voyage | 2134 | 224 € | 561 € | 105 € | 45 € | 60 € | 2.1× ✗ | 0.5× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0590 Destination advisor | 2885 | 319 € | 798 € | 124 € | 64 € | 60 € | 2.6× ✗ | 0.7× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0591 Travel content specialist | 753 | 77 € | 193 € | 48 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0592 Travel marketing assistant | 309 | 36 € | 90 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0593 Travel pricing analyst | 18 | 2 € | 6 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0594 Revenue management assistant | 486 | 67 € | 166 € | 74 € | 13 € | 60 € | 0.9× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0595 Guest relations assistant | 901 | 87 € | 217 € | 50 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0596 Booking operations specialist | 156 | 22 € | 55 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0597 Travel expense assistant | 254 | 28 € | 71 € | 50 € | 6 € | 44 € | 0.6× ✗ | 0.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0598 Corporate travel assistant | 3932 | 368 € | 920 € | 106 € | 74 € | 33 € | **3.5×** | 1.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0599 Travel operations specialist | 189 | 25 € | 62 € | 38 € | 5 € | 33 € | 0.7× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0600 Travel operations manager | 160 | 15 € | 38 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0601 Agent réservation restaurant | 2434 | 230 € | 575 € | 66 € | 46 € | 20 € | **3.5×** | **3.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0602 Agent réservation hôtel | 5461 | 594 € | 1 485 € | 139 € | 119 € | 20 € | **4.3×** | **4.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0603 Réceptionniste virtuel | 10805 | 1 007 € | 2 517 € | 222 € | 201 € | 20 € | **4.5×** | **4.4×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0604 Concierge digital | 13111 | 1 255 € | 3 138 € | 271 € | 251 € | 20 € | **4.6×** | **4.5×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0605 Guest support agent | 12274 | 1 144 € | 2 860 € | 261 € | 229 € | 33 € | **4.4×** | 2.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0606 Restaurant customer support | 1570 | 147 € | 366 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0607 Agent commandes | 15874 | 1 481 € | 3 702 € | 316 € | 296 € | 20 € | **4.7×** | **4.6×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0608 Agent avis clients | 156 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0609 Assistant planning équipes | 1489 | 139 € | 349 € | 60 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0610 Assistant achats restaurant | 160 | 19 € | 48 € | 36 € | 4 € | 33 € | 0.5× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0611 Assistant stock restaurant | 1518 | 142 € | 356 € | 61 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0612 Assistant menu | 18 | 2 € | 5 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0613 Assistant marketing restaurant | 53 | 6 € | 13 € | 45 € | 1 € | 44 € | 0.1× ✗ | 0.0× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0614 Assistant livraison restaurant | 4391 | 409 € | 1 023 € | 114 € | 82 € | 33 € | **3.6×** | 1.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0615 Revenue assistant hôtel | 134 | 14 € | 36 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0616 Pricing assistant hôtel | 182 | 21 € | 53 € | 64 € | 4 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0617 Housekeeping planning assistant | 1569 | 148 € | 370 € | 62 € | 30 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0618 Maintenance request coordinator | 5161 | 481 € | 1 202 € | 141 € | 96 € | 44 € | **3.4×** | 1.0× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0619 Hotel sales assistant | 737 | 69 € | 172 € | 46 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0620 Restaurant sales assistant | 737 | 69 € | 173 € | 46 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0621 Event booking assistant | 2281 | 215 € | 538 € | 76 € | 43 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0622 Catering booking assistant | 1591 | 151 € | 378 € | 63 € | 30 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0623 Hospitality CRM assistant | 98 | 11 € | 27 € | 35 € | 2 € | 33 € | 0.3× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0624 Hospitality operations specialist | 79 | 9 € | 22 € | 62 € | 2 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0625 Hospitality operations manager | 53 | 5 € | 14 € | 61 € | 1 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0626 Assistant pédagogique | 772 | 72 € | 181 € | 47 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0627 Créateur de cours | 163 | 15 € | 38 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0628 Créateur d'exercices | 185 | 17 € | 43 € | 64 € | 3 € | 60 € | 0.3× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0629 Créateur de quiz | 131 | 14 € | 34 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0630 Correcteur automatique | 163 | 15 € | 38 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0631 Tuteur IA | 11584 | 1 080 € | 2 699 € | 276 € | 216 € | 60 € | **3.9×** | 1.8× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0632 Assistant professeur | 108 | 13 € | 32 € | 35 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0633 Assistant formation | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0634 Learning content specialist | 40 | 4 € | 10 € | 45 € | 1 € | 44 € | 0.1× ✗ | 0.0× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0635 LMS administrator junior | 1486 | 139 € | 346 € | 60 € | 28 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0636 Formation linguistique assistant | 76 | 8 € | 19 € | 34 € | 2 € | 33 € | 0.2× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0637 Formation informatique assistant | 131 | 14 € | 34 € | 35 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0638 Corporate training assistant | 47 | 6 € | 16 € | 34 € | 1 € | 33 € | 0.2× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0639 Training coordinator | 189 | 22 € | 54 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0640 Learning analyst junior | 15 | 2 € | 4 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0641 Assessment assistant | 37 | 4 € | 9 € | 61 € | 1 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0642 Certification assistant | 95 | 12 € | 29 € | 35 € | 2 € | 33 € | 0.3× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0643 Student support agent | 6515 | 609 € | 1 521 € | 142 € | 122 € | 20 € | **4.3×** | **4.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0644 Enrollment assistant | 904 | 86 € | 215 € | 37 € | 17 € | 20 € | 2.3× ✗ | 1.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0645 Course localization specialist | 108 | 11 € | 26 € | 46 € | 2 € | 44 € | 0.2× ✗ | 0.0× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0646 Education content editor | 185 | 19 € | 47 € | 64 € | 4 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0647 Instructional design assistant | 134 | 14 € | 35 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0648 Learning operations specialist | 11 | 1 € | 4 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0649 Training operations assistant | 875 | 87 € | 218 € | 38 € | 17 € | 20 € | 2.3× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0650 Training operations manager | 8 | 1 € | 3 € | 60 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0651 Consultant junior | 934 | 115 € | 288 € | 56 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0652 Business analyst junior | 1054 | 133 € | 333 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0653 Strategy research assistant | 1054 | 119 € | 299 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0654 Market research consultant | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0655 Competitive intelligence consultant | 231 | 24 € | 59 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0656 Process analyst | 1200 | 133 € | 332 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0657 Operations consultant assistant | 607 | 78 € | 194 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0658 Digital transformation assistant | 909 | 113 € | 282 € | 55 € | 23 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0659 SEO consultant assistant | 348 | 41 € | 103 € | 29 € | 8 € | 20 € | 1.4× ✗ | 1.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0660 Marketing consultant assistant | 306 | 36 € | 89 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0661 E-commerce consultant assistant | 228 | 25 € | 62 € | 38 € | 5 € | 33 € | 0.7× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0662 Financial consulting assistant | 1200 | 161 € | 402 € | 65 € | 32 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0663 HR consulting assistant | 604 | 63 € | 159 € | 45 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0664 Procurement consulting assistant | 604 | 84 € | 211 € | 49 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0665 Data consulting assistant | 1054 | 119 € | 299 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0666 Technology consulting assistant | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0667 Research consultant | 1054 | 112 € | 281 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0668 Benchmark analyst | 1200 | 154 € | 384 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0669 Business plan analyst | 1200 | 154 € | 384 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0670 Due diligence consultant assistant | 814 | 100 € | 250 € | 53 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0671 PMO consultant assistant | 86 | 12 € | 29 € | 23 € | 2 € | 20 € | 0.5× ✗ | 0.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0672 Reporting consultant | 306 | 36 € | 89 € | 27 € | 7 € | 20 € | 1.3× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0673 Process documentation consultant | 902 | 105 € | 263 € | 41 € | 21 € | 20 € | 2.5× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0674 Consulting analyst | 1200 | 133 € | 332 € | 87 € | 27 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0675 Consulting operations manager | 206 | 22 € | 54 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0676 Secrétaire médical | 7324 | 685 € | 1 713 € | 170 € | 137 € | 33 € | **4.0×** | 2.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0677 Assistant médical administratif | 160 | 16 € | 41 € | 48 € | 3 € | 44 € | 0.3× ✗ | 0.0× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0678 Agent prise de rendez-vous médical | 13684 | 1 275 € | 3 188 € | 275 € | 255 € | 20 € | **4.6×** | **4.5×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0679 Agent accueil téléphonique médical | 14461 | 1 347 € | 3 369 € | 290 € | 270 € | 20 € | **4.7×** | **4.5×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0680 Transcripteur médical | 5104 | 544 € | 1 360 € | 141 € | 109 € | 33 € | **3.9×** | 1.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0681 Assistant dossier patient | 1565 | 147 € | 369 € | 74 € | 29 € | 44 € | 2.0× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0682 Agent rappels patients | 2263 | 211 € | 528 € | 63 € | 42 € | 20 € | **3.4×** | **3.0×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0683 Agent facturation médicale | 185 | 20 € | 50 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0684 Agent assurance maladie | 127 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0685 Agent codage administratif | 156 | 15 € | 37 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0686 Assistant cabinet médical | 374 | 36 € | 91 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0687 Assistant cabinet dentaire | 185 | 20 € | 50 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0688 Assistant laboratoire administratif | 9360 | 875 € | 2 187 € | 208 € | 175 € | 33 € | **4.2×** | 2.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0689 Assistant clinique | 3090 | 291 € | 727 € | 91 € | 58 € | 33 € | **3.2×** | 1.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0690 Agent coordination soins administratif | 1050 | 99 € | 248 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0691 Agent de préqualification administrative | 8220 | 767 € | 1 918 € | 174 € | 153 € | 20 € | **4.4×** | **4.3×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0692 Agent support patient | 5855 | 547 € | 1 368 € | 142 € | 109 € | 33 € | **3.9×** | 1.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0693 Agent suivi rendez-vous | 1540 | 147 € | 366 € | 50 € | 29 € | 20 € | 3.0× ✗ | 2.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0694 Agent documents médicaux | 6571 | 646 € | 1 615 € | 173 € | 129 € | 44 € | **3.7×** | 1.2× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0695 Agent gestion agenda médical | 2373 | 221 € | 553 € | 77 € | 44 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0696 Agent relation patient | 5731 | 534 € | 1 335 € | 139 € | 107 € | 33 € | **3.8×** | 1.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0697 Assistant télémédecine administratif | 211 | 21 € | 53 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0698 Medical office assistant | 795 | 77 € | 193 € | 36 € | 15 € | 20 € | 2.2× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0699 Healthcare operations assistant | 21 | 3 € | 7 € | 61 € | 1 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0700 Healthcare operations manager | 11 | 1 € | 4 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0701 Assistant conducteur travaux | 1570 | 149 € | 373 € | 62 € | 30 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0702 Assistant chantier | 3694 | 352 € | 872 € | 115 € | 70 € | 44 € | **3.1×** | 0.8× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0703 Assistant devis | 640 | 67 € | 167 € | 46 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0704 Métré assistant | 1954 | 245 € | 613 € | 93 € | 49 € | 44 € | 2.6× ✗ | 0.6× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0705 Assistant appels d'offres BTP | 665 | 78 € | 194 € | 76 € | 16 € | 60 € | 1.0× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0706 Assistant planning chantier | 669 | 69 € | 174 € | 46 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0707 Assistant achats chantier | 947 | 89 € | 222 € | 50 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0708 Assistant fournisseurs BTP | 18 | 2 € | 6 € | 33 € | 0 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0709 Assistant facturation chantier | 15 | 2 € | 4 € | 33 € | 0 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0710 Assistant administratif BTP | 769 | 72 € | 180 € | 35 € | 14 € | 20 € | 2.1× ✗ | 1.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0711 Assistant suivi sous-traitants | 1061 | 100 € | 251 € | 53 € | 20 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0712 Assistant documents chantier | 2110 | 225 € | 561 € | 77 € | 45 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0713 Assistant conformité chantier | 1907 | 185 € | 464 € | 70 € | 37 € | 33 € | 2.7× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0714 Assistant qualité chantier | 497 | 56 € | 138 € | 55 € | 11 € | 44 € | 1.0× ✗ | 0.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0715 Assistant sécurité documentaire | 2383 | 231 € | 577 € | 66 € | 46 € | 20 € | **3.5×** | **3.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0716 Assistant relation client BTP | 2974 | 279 € | 696 € | 88 € | 56 € | 33 € | **3.1×** | 1.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0717 Assistant SAV BTP | 2731 | 255 € | 636 € | 95 € | 51 € | 44 € | 2.7× ✗ | 0.6× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0718 Assistant maintenance bâtiment | 2058 | 226 € | 565 € | 78 € | 45 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0719 Assistant patrimoine bâtiment | 1454 | 136 € | 340 € | 60 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0720 Assistant facility management | 1358 | 128 € | 321 € | 58 € | 26 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0721 Estimating assistant | 902 | 112 € | 280 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0722 Construction cost analyst junior | 8 | 1 € | 3 € | 60 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0723 Construction project assistant | 1371 | 163 € | 408 € | 65 € | 33 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0724 Construction operations specialist | 60 | 8 € | 20 € | 34 € | 2 € | 33 € | 0.2× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0725 Construction operations manager | 164 | 16 € | 40 € | 63 € | 3 € | 60 € | 0.3× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0726 Assistant plombier | 8310 | 986 € | 2 148 € | 242 € | 197 € | 44 € | **4.1×** | 1.7× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0727 Assistant électricien | 8550 | 1 049 € | 2 305 € | 254 € | 210 € | 44 € | **4.1×** | 1.7× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0728 Assistant peintre | 5820 | 782 € | 1 638 € | 201 € | 156 € | 44 € | **3.9×** | 1.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0729 Assistant maçon | 909 | 85 € | 212 € | 50 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0730 Assistant menuisier | 2220 | 221 € | 552 € | 77 € | 44 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0731 Assistant couvreur | 1594 | 149 € | 372 € | 62 € | 30 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0732 Assistant chauffagiste | 5531 | 516 € | 1 289 € | 136 € | 103 € | 33 € | **3.8×** | 1.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0733 Assistant climatisation | 3516 | 540 € | 1 032 € | 152 € | 108 € | 44 € | **3.5×** | 1.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0734 Assistant serrurier | 10470 | 1 110 € | 2 774 € | 266 € | 222 € | 44 € | **4.2×** | 1.8× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0735 Assistant vitrier | 6300 | 587 € | 1 468 € | 162 € | 117 € | 44 € | **3.6×** | 1.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0736 Assistant carreleur | 909 | 92 € | 230 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0737 Assistant plaquiste | 1384 | 153 € | 349 € | 75 € | 31 € | 44 € | 2.0× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0738 Assistant façadier | 694 | 88 € | 187 € | 62 € | 18 € | 44 € | 1.4× ✗ | 0.2× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0739 Assistant isolation | 665 | 70 € | 176 € | 74 € | 14 € | 60 € | 0.9× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0740 Assistant multiservice | 1536 | 150 € | 376 € | 63 € | 30 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0741 Agent devis artisan | 1261 | 154 € | 385 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0742 Agent planning artisan | 1595 | 149 € | 372 € | 62 € | 30 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0743 Agent SAV artisan | 1501 | 140 € | 350 € | 72 € | 28 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0744 Agent relance artisan | 425 | 41 € | 103 € | 41 € | 8 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0745 Agent acquisition artisan | 2077 | 244 € | 576 € | 81 € | 49 € | 33 € | **3.0×** | 1.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0746 Agent qualification chantier | 1530 | 165 € | 378 € | 77 € | 33 € | 44 € | 2.1× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0747 Agent suivi intervention | 334 | 40 € | 93 € | 52 € | 8 € | 44 € | 0.8× ✗ | 0.1× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0748 Agent facturation artisan | 811 | 92 € | 231 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0749 Agent avis clients artisan | 940 | 89 € | 222 € | 50 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0750 Artisan operations manager | 160 | 15 € | 38 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0751 Assistant jardinier | 309 | 32 € | 79 € | 39 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0752 Assistant paysagiste | 1200 | 133 € | 332 € | 71 € | 27 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0753 Agent devis jardinage | 1080 | 123 € | 307 € | 57 € | 25 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0754 Agent planning jardinage | 846 | 79 € | 198 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0755 Agent qualification jardinage | 1530 | 172 € | 396 € | 79 € | 34 € | 44 € | 2.2× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0756 Agent suivi chantier paysager | 811 | 88 € | 214 € | 62 € | 18 € | 44 € | 1.4× ✗ | 0.2× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0757 Agent relation client jardinage | 1471 | 137 € | 343 € | 72 € | 27 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0758 Agent relance jardinage | 251 | 24 € | 59 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0759 Agent acquisition clients jardinage | 1358 | 127 € | 317 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0760 Agent réservation jardinier | 1831 | 172 € | 430 € | 67 € | 34 € | 33 € | 2.6× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0761 Agent calcul durée intervention | 782 | 95 € | 238 € | 52 € | 19 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0762 Agent calcul matériel jardinage | 189 | 22 € | 55 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0763 Agent facturation jardinage | 215 | 23 € | 57 € | 65 € | 5 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0764 Agent suivi saisonnier | 164 | 15 € | 38 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0765 Agent entretien contrats | 157 | 22 € | 55 € | 65 € | 4 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0766 Agent gestion tournées jardinage | 1565 | 181 € | 452 € | 69 € | 36 € | 33 € | 2.6× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0767 Agent météo chantier jardinage | 127 | 12 € | 30 € | 35 € | 2 € | 33 € | 0.3× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0768 Agent catalogue végétaux | 157 | 15 € | 37 € | 63 € | 3 € | 60 € | 0.2× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0769 Agent conseil plantation administratif | 1200 | 119 € | 297 € | 84 € | 24 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0770 Agent SAV jardinage | 1501 | 162 € | 372 € | 77 € | 32 € | 44 € | 2.1× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0771 Agent avis clients jardinage | 1354 | 177 € | 377 € | 80 € | 35 € | 44 € | 2.2× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0772 Agent recrutement jardiniers | 636 | 61 € | 152 € | 45 € | 12 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0773 Agent matching jardiniers | 247 | 23 € | 58 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0774 Agent opérations paysagisme | 1290 | 129 € | 321 € | 70 € | 26 € | 44 € | 1.8× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0775 Jardinage operations manager | 11 | 1 € | 4 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0776 Assistant entreprise nettoyage | 1050 | 99 € | 248 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0777 Agent devis nettoyage | 1200 | 154 € | 384 € | 91 € | 31 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0778 Agent planning nettoyage | 21 | 3 € | 6 € | 33 € | 1 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0779 Agent qualification nettoyage | 1054 | 105 € | 263 € | 65 € | 21 € | 44 € | 1.6× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0780 Agent affectation intervenants | 1808 | 169 € | 422 € | 66 € | 34 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0781 Agent suivi intervention | 4540 | 499 € | 1 247 € | 120 € | 100 € | 20 € | **4.2×** | **3.9×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0782 Agent relation client nettoyage | 1660 | 155 € | 387 € | 64 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0783 Agent relance nettoyage | 105 | 12 € | 29 € | 23 € | 2 € | 20 € | 0.5× ✗ | 0.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0784 Agent acquisition nettoyage | 348 | 48 € | 121 € | 42 € | 10 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0785 Agent réservation nettoyage | 5254 | 557 € | 1 392 € | 132 € | 111 € | 20 € | **4.2×** | **4.0×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0786 Agent facturation nettoyage | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0787 Agent contrats nettoyage | 1802 | 217 € | 542 € | 104 € | 43 € | 60 € | 2.1× ✗ | 0.5× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0788 Agent renouvellement nettoyage | 1206 | 126 € | 316 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0789 Agent contrôle qualité administratif | 2404 | 280 € | 700 € | 100 € | 56 € | 44 € | 2.8× ✗ | 0.6× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0790 Agent gestion consommables | 15 | 2 € | 5 € | 21 € | 0 € | 20 € | 0.1× ✗ | 0.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0791 Agent gestion tournées | 912 | 120 € | 301 € | 57 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0792 Agent recrutement agents nettoyage | 1090 | 131 € | 328 € | 59 € | 26 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0793 Agent matching nettoyeurs | 326 | 38 € | 95 € | 40 € | 8 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0794 Agent SAV nettoyage | 1656 | 161 € | 403 € | 65 € | 32 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0795 Agent avis clients nettoyage | 1504 | 140 € | 351 € | 48 € | 28 € | 20 € | 2.9× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0796 Agent B2B nettoyage | 785 | 103 € | 257 € | 81 € | 21 € | 60 € | 1.3× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0797 Agent B2C nettoyage | 1656 | 190 € | 474 € | 70 € | 38 € | 33 € | 2.7× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0798 Agent planning récurrent | 8563 | 800 € | 1 999 € | 180 € | 160 € | 20 € | **4.4×** | **4.3×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0799 Cleaning operations specialist | 15 | 2 € | 5 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0800 Cleaning operations manager | 18 | 2 € | 5 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0801 Assistant garage | 7174 | 670 € | 1 675 € | 167 € | 134 € | 33 € | **4.0×** | 2.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0802 Agent prise de rendez-vous garage | 2469 | 230 € | 576 € | 66 € | 46 € | 20 € | **3.5×** | **3.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0803 Agent qualification panne | 3450 | 321 € | 804 € | 97 € | 64 € | 33 € | **3.3×** | 1.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0804 Agent collecte photos véhicule | 3450 | 321 € | 804 € | 109 € | 64 € | 44 € | 3.0× ✗ | 0.7× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0805 Agent devis automobile | 1355 | 147 € | 368 € | 90 € | 29 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0806 Agent planning atelier | 904 | 122 € | 305 € | 57 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0807 Agent commande pièces | 3305 | 339 € | 847 € | 100 € | 68 € | 33 € | **3.4×** | 1.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0808 Agent suivi réparation | 1951 | 217 € | 542 € | 64 € | 43 € | 20 € | **3.4×** | **3.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0809 Agent relation client garage | 1235 | 122 € | 306 € | 57 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0810 Agent relance entretien | 18 | 2 € | 5 € | 21 € | 0 € | 20 € | 0.1× ✗ | 0.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0811 Agent rappel contrôle technique | 792 | 110 € | 275 € | 42 € | 22 € | 20 € | 2.6× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0812 Agent facturation garage | 901 | 90 € | 224 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0813 Agent SAV automobile | 1206 | 112 € | 281 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0814 Agent garantie automobile | 1206 | 134 € | 334 € | 87 € | 27 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0815 Agent recherche pièces | 909 | 92 € | 230 € | 79 € | 18 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0816 Agent comparaison fournisseurs pièces | 21 | 3 € | 7 € | 33 € | 1 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0817 Agent gestion flotte garage | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0818 Agent suivi maintenance flotte | 11 | 2 € | 4 € | 21 € | 0 € | 20 € | 0.1× ✗ | 0.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0819 Agent acquisition garage | 610 | 57 € | 143 € | 44 € | 11 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0820 Agent avis clients garage | 632 | 60 € | 151 € | 32 € | 12 € | 20 € | 1.9× ✗ | 1.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0821 Agent support atelier | 6124 | 579 € | 1 448 € | 148 € | 116 € | 33 € | **3.9×** | 1.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0822 Agent estimation réparation assistant | 2553 | 273 € | 682 € | 87 € | 55 € | 33 € | **3.1×** | 1.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0823 Agent documentation technique automobile | 44 | 4 € | 11 € | 61 € | 1 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0824 Automotive operations specialist | 21 | 3 € | 7 € | 61 € | 1 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0825 Automotive operations manager | 15 | 2 € | 4 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0826 Agent état des lieux | 1500 | 196 € | 489 € | 83 € | 39 € | 44 € | 2.3× ✗ | 0.5× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0827 Agent collecte documents immobiliers | 1564 | 161 € | 403 € | 65 € | 32 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0828 Agent dossier location | 1950 | 203 € | 507 € | 73 € | 41 € | 33 € | 2.8× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0829 Agent dossier vente | 1089 | 117 € | 292 € | 56 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0830 Agent suivi notaire | 823 | 84 € | 210 € | 49 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0831 Agent relance documents | 515 | 55 € | 138 € | 31 € | 11 € | 20 € | 1.8× ✗ | 1.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-0832 Agent qualification locataire | 1234 | 115 € | 288 € | 56 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0833 Agent qualification acheteur | 755 | 78 € | 194 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0834 Agent qualification vendeur | 901 | 98 € | 245 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0835 Agent préparation compromis assistant | 1050 | 112 € | 280 € | 83 € | 22 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0836 Agent suivi signature | 810 | 82 € | 206 € | 49 € | 16 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0837 Agent gestion diagnostics | 2105 | 231 € | 578 € | 79 € | 46 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0838 Agent suivi travaux immobilier | 1380 | 136 € | 339 € | 71 € | 27 € | 44 € | 1.9× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0839 Agent gestion sinistres immobilier | 1209 | 148 € | 369 € | 74 € | 30 € | 44 € | 2.0× ✗ | 0.3× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-0840 Agent relation syndic | 1085 | 103 € | 256 € | 53 € | 21 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0841 Agent relation copropriété | 936 | 89 € | 222 € | 78 € | 18 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0842 Agent convocations | 1050 | 119 € | 297 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0843 Agent comptes rendus copropriété | 1500 | 154 € | 384 € | 91 € | 31 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0844 Agent appels de charges assistant | 454 | 56 € | 141 € | 44 € | 11 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0845 Agent suivi prestataires immobilier | 904 | 98 € | 246 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0846 Agent maintenance locative | 1205 | 119 € | 299 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0847 Agent réclamation locataire | 1234 | 115 € | 288 € | 56 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0848 Agent reporting patrimoine | 7 | 1 € | 2 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0849 Property legal operations assistant | 610 | 64 € | 160 € | 73 € | 13 € | 60 € | 0.9× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0850 Property operations manager | 159 | 22 € | 56 € | 65 € | 4 € | 60 € | 0.3× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0851 Agent support SaaS | 1089 | 103 € | 258 € | 53 € | 21 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0852 Agent support e-commerce | 1085 | 101 € | 253 € | 53 € | 20 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0853 Agent support marketplace | 1231 | 116 € | 290 € | 56 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0854 Agent support logiciel | 1500 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0855 Agent support télécom | 1234 | 115 € | 288 € | 56 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0856 Agent support énergie | 1652 | 189 € | 472 € | 70 € | 38 € | 33 € | 2.7× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0857 Agent support banque | 1500 | 140 € | 349 € | 88 € | 28 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0858 Agent support assurance | 1804 | 168 € | 421 € | 94 € | 34 € | 60 € | 1.8× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0859 Agent support voyage | 4924 | 459 € | 1 148 € | 124 € | 92 € | 33 € | **3.7×** | 1.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0860 Agent support immobilier | 1830 | 172 € | 430 € | 67 € | 34 € | 33 € | 2.6× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0861 Agent support automobile | 1351 | 133 € | 332 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0862 Agent support santé administratif | 1234 | 122 € | 305 € | 57 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0863 Agent support formation | 1234 | 117 € | 292 € | 56 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0864 Agent support B2B | 2492 | 232 € | 581 € | 79 € | 46 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0865 Agent support abonnement | 1380 | 136 € | 339 € | 60 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0866 Agent support facturation | 1202 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0867 Agent support livraison | 1114 | 105 € | 263 € | 54 € | 21 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0868 Agent support retours | 1681 | 157 € | 392 € | 64 € | 31 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0869 Agent support technique niveau 1 | 2070 | 226 € | 566 € | 66 € | 45 € | 20 € | **3.5×** | **3.1×** | 17 € | S (1/bundle) | 2 800 € |
| AG-0870 Agent support technique niveau 2 | 1050 | 98 € | 245 € | 80 € | 20 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0871 Agent réclamation | 1231 | 116 € | 290 € | 83 € | 23 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0872 Agent fidélisation | 1202 | 112 € | 280 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0873 Agent renouvellement | 755 | 84 € | 211 € | 49 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-0874 Customer success specialist | 312 | 29 € | 73 € | 66 € | 6 € | 60 € | 0.4× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0875 Customer operations manager | 43 | 6 € | 14 € | 61 € | 1 € | 60 € | 0.1× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-0876 Assistant CEO | 103 | 10 € | 24 € | 32 € | 2 € | 30 € | 0.3× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0877 Assistant COO | 51 | 7 € | 17 € | 28 € | 1 € | 27 € | 0.2× ✗ | 0.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0878 Assistant CFO | 38 | 4 € | 10 € | 30 € | 1 € | 30 € | 0.1× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0879 Assistant CTO | 38 | 5 € | 13 € | 31 € | 1 € | 30 € | 0.2× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0880 Assistant CMO | 608 | 85 € | 212 € | 44 € | 17 € | 27 € | 1.9× ✗ | 1.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0881 Executive assistant | 695 | 65 € | 162 € | 40 € | 13 € | 27 € | 1.6× ✗ | 1.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0882 Meeting assistant | 3600 | 363 € | 908 € | 100 € | 73 € | 27 € | **3.6×** | **3.4×** | 20 € | S (1/bundle) | 2 800 € |
| AG-0883 Research assistant | 900 | 98 € | 245 € | 55 € | 20 € | 35 € | 1.8× ✗ | 0.2× ✗ | 35 € | XL (11/bundle) | 2 800 € |
| AG-0884 Decision support assistant | 900 | 105 € | 262 € | 46 € | 21 € | 25 € | 2.3× ✗ | 0.3× ✗ | 25 € | XL (15/bundle) | 2 800 € |
| AG-0885 OKR assistant | 13 | 1 € | 4 € | 19 € | 0 € | 19 € | 0.1× ✗ | 0.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0886 Project management assistant | 77 | 10 € | 26 € | 29 € | 2 € | 27 € | 0.4× ✗ | 0.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0887 PMO assistant | 19 | 2 € | 5 € | 22 € | 0 € | 22 € | 0.1× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0888 Task management agent | 9000 | 839 € | 2 097 € | 186 € | 168 € | 18 € | **4.5×** | **4.3×** | 9 € | S (1/bundle) | 2 800 € |
| AG-0889 Documentation agent | 634 | 59 € | 148 € | 34 € | 12 € | 22 € | 1.8× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0890 Knowledge management agent | 162 | 15 € | 38 € | 25 € | 3 € | 22 € | 0.6× ✗ | 0.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0891 Internal search agent | 900 | 84 € | 210 € | 49 € | 17 € | 32 € | 1.7× ✗ | 1.7× ✗ | 22 € | S (1/bundle) | 2 800 € |
| AG-0892 Company wiki agent | 13 | 2 € | 4 € | 18 € | 0 € | 18 € | 0.1× ✗ | 0.1× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0893 Policy assistant | 641 | 60 € | 150 € | 31 € | 12 € | 19 € | 2.0× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0894 Process automation agent | 511 | 49 € | 123 € | 37 € | 10 € | 27 € | 1.3× ✗ | 1.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0895 Workflow analyst | 900 | 112 € | 280 € | 44 € | 22 € | 22 € | 2.5× ✗ | 2.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0896 Business operations assistant | 38 | 5 € | 13 € | 23 € | 1 € | 22 € | 0.2× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0897 Executive reporting assistant | 6 | 1 € | 2 € | 22 € | 0 € | 22 € | 0.0× ✗ | 0.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0898 Management reporting agent | 6 | 1 € | 2 € | 23 € | 0 € | 22 € | 0.0× ✗ | 0.0× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0899 Operations analyst | 13 | 2 € | 4 € | 27 € | 0 € | 27 € | 0.1× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0900 AI operations manager | 223 | 31 € | 78 € | 28 € | 6 € | 22 € | 1.1× ✗ | 0.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0901 Assistant événementiel | 750 | 99 € | 248 € | 38 € | 20 € | 18 € | 2.6× ✗ | 2.1× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0902 Event planner assistant | 300 | 29 € | 73 € | 19 € | 6 € | 13 € | 1.5× ✗ | 0.9× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0903 Agent réservation salle | 1230 | 150 € | 374 € | 48 € | 30 € | 18 € | **3.1×** | 2.6× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0904 Agent inscription participants | 1560 | 180 € | 451 € | 54 € | 36 € | 18 € | **3.3×** | 2.9× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0905 Agent invitations | 1230 | 115 € | 287 € | 41 € | 23 € | 18 € | 2.8× ✗ | 2.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0906 Agent relance participants | 750 | 71 € | 178 € | 28 € | 14 € | 13 € | 2.6× ✗ | 1.7× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0907 Agent gestion intervenants | 420 | 41 € | 101 € | 26 € | 8 € | 18 € | 1.6× ✗ | 1.2× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0908 Agent gestion fournisseurs | 1680 | 219 € | 549 € | 62 € | 44 € | 18 € | **3.5×** | **3.1×** | 9 € | S (1/bundle) | 2 800 € |
| AG-0909 Agent planning événement | 630 | 74 € | 185 € | 28 € | 15 € | 13 € | 2.6× ✗ | 1.8× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0910 Agent budget événement | 1560 | 217 € | 542 € | 57 € | 43 € | 14 € | **3.8×** | 2.8× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0911 Agent devis événement | 1230 | 137 € | 342 € | 46 € | 27 € | 19 € | 3.0× ✗ | 2.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0912 Agent communication événement | 540 | 64 € | 161 € | 35 € | 13 € | 22 € | 1.8× ✗ | 1.6× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0913 Agent emailing événement | 660 | 63 € | 157 € | 30 € | 13 € | 18 € | 2.1× ✗ | 1.6× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0914 Agent accueil digital | 4740 | 442 € | 1 104 € | 111 € | 88 € | 22 € | **4.0×** | **3.8×** | 11 € | S (1/bundle) | 2 800 € |
| AG-0915 Agent FAQ événement | 870 | 82 € | 206 € | 30 € | 16 € | 13 € | 2.8× ✗ | 1.9× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0916 Agent billetterie support | 1800 | 176 € | 440 € | 58 € | 35 € | 22 € | **3.1×** | 2.8× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0917 Agent sponsors | 540 | 73 € | 182 € | 37 € | 15 € | 22 € | 2.0× ✗ | 1.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0918 Agent partenaires | 390 | 45 € | 112 € | 22 € | 9 € | 13 € | 2.0× ✗ | 1.3× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0919 Agent reporting événement | 750 | 91 € | 227 € | 32 € | 18 € | 14 € | 2.9× ✗ | 1.8× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0920 Agent post-event survey | 900 | 91 € | 227 € | 32 € | 18 € | 14 € | 2.9× ✗ | 1.8× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0921 Agent gestion hôtels participants | 1680 | 212 € | 531 € | 60 € | 42 € | 18 € | **3.5×** | **3.1×** | 9 € | S (1/bundle) | 2 800 € |
| AG-0922 Agent transport participants | 900 | 98 € | 245 € | 37 € | 20 € | 18 € | 2.6× ✗ | 2.1× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0923 Event operations assistant | 540 | 59 € | 147 € | 30 € | 12 € | 18 € | 2.0× ✗ | 1.5× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0924 Event marketing assistant | 660 | 75 € | 189 € | 37 € | 15 € | 22 € | 2.0× ✗ | 1.8× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0925 Event operations manager | 784 | 89 € | 222 € | 52 € | 18 € | 34 € | 1.7× ✗ | 1.7× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0926 Assistant association | 514 | 69 € | 172 € | 32 € | 14 € | 18 € | 2.2× ✗ | 1.7× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0927 Agent adhésions | 365 | 41 € | 103 € | 26 € | 8 € | 18 € | 1.6× ✗ | 1.2× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0928 Agent dons | 220 | 28 € | 69 € | 23 € | 6 € | 18 € | 1.2× ✗ | 0.9× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0929 Agent bénévoles | 77 | 8 € | 19 € | 19 € | 2 € | 18 € | 0.4× ✗ | 0.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0930 Agent événements | 489 | 60 € | 150 € | 30 € | 12 € | 18 € | 2.0× ✗ | 1.5× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0931 Agent newsletter | 456 | 43 € | 106 € | 26 € | 9 € | 18 € | 1.6× ✗ | 1.2× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0932 Agent relation adhérents | 103 | 10 € | 24 € | 20 € | 2 € | 18 € | 0.5× ✗ | 0.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0933 Agent support membres | 154 | 14 € | 36 € | 25 € | 3 € | 22 € | 0.6× ✗ | 0.5× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0934 Agent collecte de documents | 223 | 22 € | 55 € | 26 € | 4 € | 22 € | 0.8× ✗ | 0.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0935 Agent facturation association | 340 | 46 € | 115 € | 27 € | 9 € | 18 € | 1.7× ✗ | 1.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0936 Agent comptabilité association assistant | 191 | 25 € | 62 € | 32 € | 5 € | 27 € | 0.8× ✗ | 0.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0937 Agent subventions | 460 | 57 € | 142 € | 33 € | 11 € | 22 € | 1.7× ✗ | 1.3× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0938 Agent recherche financements | 340 | 39 € | 97 € | 30 € | 8 € | 22 € | 1.3× ✗ | 0.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0939 Agent reporting association | 453 | 56 € | 141 € | 25 € | 11 € | 13 € | 2.3× ✗ | 1.5× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0940 Agent communication association | 605 | 70 € | 176 € | 32 € | 14 € | 18 € | 2.2× ✗ | 1.7× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0941 Agent réseaux sociaux association | 71 | 7 € | 17 € | 46 € | 1 € | 45 € | 0.2× ✗ | 0.1× ✗ | 28 € | M (2/bundle) | 2 800 € |
| AG-0942 Agent CRM association | 48 | 4 € | 11 € | 19 € | 1 € | 18 € | 0.2× ✗ | 0.2× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0943 Agent gestion campagnes | 780 | 87 € | 217 € | 40 € | 17 € | 22 € | 2.2× ✗ | 2.0× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0944 Agent inscription activités | 129 | 12 € | 30 € | 20 € | 2 € | 18 € | 0.6× ✗ | 0.4× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0945 Agent réservation activités | 151 | 16 € | 39 € | 21 € | 3 € | 18 € | 0.7× ✗ | 0.5× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0946 Agent suivi bénévoles | 307 | 36 € | 89 € | 21 € | 7 € | 13 € | 1.7× ✗ | 1.1× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0947 Agent recrutement bénévoles | 511 | 48 € | 119 € | 27 € | 10 € | 18 € | 1.7× ✗ | 1.3× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0948 Agent gestion partenaires | 460 | 57 € | 143 € | 25 € | 11 € | 13 € | 2.3× ✗ | 1.5× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0949 Association operations specialist | 194 | 19 € | 49 € | 22 € | 4 € | 18 € | 0.9× ✗ | 0.6× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0950 Association operations manager | 305 | 36 € | 89 € | 26 € | 7 € | 19 € | 1.4× ✗ | 0.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0951 Assistant visa | 514 | 55 € | 137 € | 38 € | 11 € | 27 € | 1.4× ✗ | 1.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0952 Agent collecte documents visa | 394 | 37 € | 92 € | 29 € | 7 € | 22 € | 1.3× ✗ | 0.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0953 Agent suivi dossier visa | 249 | 23 € | 58 € | 23 € | 5 € | 18 € | 1.0× ✗ | 0.7× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0954 Agent formulaire administratif | 900 | 98 € | 245 € | 47 € | 20 € | 27 € | 2.1× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0955 Agent traduction dossier | 754 | 77 € | 193 € | 49 € | 15 € | 34 € | 1.6× ✗ | 1.6× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0956 Agent prise de rendez-vous consulaire | 394 | 44 € | 109 € | 27 € | 9 € | 18 € | 1.6× ✗ | 1.2× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0957 Agent checklist immigration | 751 | 84 € | 210 € | 39 € | 17 € | 22 € | 2.2× ✗ | 1.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0958 Agent suivi échéances | 51 | 5 € | 12 € | 14 € | 1 € | 13 € | 0.3× ✗ | 0.2× ✗ | 7 € | S (2/bundle) | 2 800 € |
| AG-0959 Agent notification dossier | 154 | 14 € | 36 € | 21 € | 3 € | 18 € | 0.7× ✗ | 0.5× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0960 Agent recherche informations réglementaires | 463 | 43 € | 108 € | 38 € | 9 € | 30 € | 1.1× ✗ | 0.1× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0961 Agent dossier expatriation | 754 | 91 € | 228 € | 40 € | 18 € | 22 € | 2.3× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0962 Agent dossier relocation | 754 | 91 € | 228 € | 40 € | 18 € | 22 € | 2.3× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0963 Agent logement expatrié | 780 | 80 € | 199 € | 50 € | 16 € | 34 € | 1.6× ✗ | 1.6× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0964 Agent services expatrié | 754 | 84 € | 211 € | 35 € | 17 € | 18 € | 2.4× ✗ | 1.9× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0965 Agent assurance expatrié | 751 | 91 € | 227 € | 37 € | 18 € | 19 € | 2.5× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0966 Agent voyage administratif | 754 | 91 € | 228 € | 40 € | 18 € | 22 € | 2.3× ✗ | 1.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0967 Agent support expatriation | 274 | 26 € | 64 € | 27 € | 5 € | 22 € | 0.9× ✗ | 0.8× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0968 Agent relocation assistant | 369 | 41 € | 103 € | 26 € | 8 € | 18 € | 1.6× ✗ | 1.2× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0969 Agent onboarding expatrié | 317 | 37 € | 91 € | 25 € | 7 € | 18 € | 1.4× ✗ | 1.1× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0970 Agent renouvellement documents | 609 | 57 € | 142 € | 29 € | 11 € | 18 € | 1.9× ✗ | 1.5× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0971 Agent compliance immigration assistant | 165 | 23 € | 56 € | 32 € | 5 € | 27 € | 0.7× ✗ | 0.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0972 Agent mobilité internationale | 336 | 32 € | 79 € | 25 € | 6 € | 19 € | 1.3× ✗ | 0.8× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0973 Agent travel documentation | 314 | 29 € | 73 € | 21 € | 6 € | 15 € | 1.4× ✗ | 0.7× ✗ | 20 € | S (2/bundle) | 2 800 € |
| AG-0974 Mobility operations specialist | 220 | 22 € | 55 € | 22 € | 4 € | 18 € | 1.0× ✗ | 0.7× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0975 Mobility operations manager | 155 | 15 € | 37 € | 22 € | 3 € | 19 € | 0.7× ✗ | 0.4× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0976 Assistant énergie | 197 | 19 € | 46 € | 26 € | 4 € | 22 € | 0.7× ✗ | 0.5× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0977 Agent suivi consommation | 125 | 13 € | 33 € | 27 € | 3 € | 25 € | 0.5× ✗ | 0.5× ✗ | 12 € | S (1/bundle) | 2 800 € |
| AG-0978 Agent analyse factures énergie | 197 | 26 € | 64 € | 39 € | 5 € | 34 € | 0.7× ✗ | 0.7× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0979 Agent comparaison fournisseurs énergie | 900 | 105 € | 262 € | 43 € | 21 € | 22 € | 2.4× ✗ | 1.9× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0980 Agent devis énergie | 900 | 91 € | 227 € | 52 € | 18 € | 34 € | 1.8× ✗ | 1.8× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0981 Agent planification intervention | 724 | 70 € | 176 € | 36 € | 14 € | 22 € | 1.9× ✗ | 1.7× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0982 Agent maintenance énergie | 194 | 25 € | 63 € | 27 € | 5 € | 22 € | 0.9× ✗ | 0.7× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0983 Agent relation client énergie | 151 | 14 € | 35 € | 27 € | 3 € | 25 € | 0.5× ✗ | 0.5× ✗ | 12 € | S (1/bundle) | 2 800 € |
| AG-0984 Agent qualification travaux énergie | 754 | 70 € | 176 € | 48 € | 14 € | 34 € | 1.5× ✗ | 1.5× ✗ | 23 € | S (1/bundle) | 2 800 € |
| AG-0985 Agent suivi contrats énergie | 162 | 22 € | 56 € | 23 € | 4 € | 19 € | 1.0× ✗ | 0.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0986 Agent reporting carbone | 751 | 84 € | 210 € | 46 € | 17 € | 30 € | 1.8× ✗ | 0.2× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0987 Agent collecte données ESG | 343 | 32 € | 80 € | 29 € | 6 € | 22 € | 1.1× ✗ | 1.0× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0988 Agent reporting ESG | 900 | 112 € | 280 € | 52 € | 22 € | 30 € | 2.1× ✗ | 0.3× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-0989 Agent documentation environnement | 165 | 22 € | 56 € | 32 € | 4 € | 27 € | 0.7× ✗ | 0.6× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0990 Agent veille réglementaire environnement | 18 | 2 € | 5 € | 27 € | 0 € | 26 € | 0.1× ✗ | 0.0× ✗ | 26 € | XL (15/bundle) | 2 800 € |
| AG-0991 Agent analyse consommation bâtiment | 38 | 5 € | 13 € | 28 € | 1 € | 27 € | 0.2× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0992 Agent optimisation énergétique assistant | 6 | 1 € | 2 € | 22 € | 0 € | 22 € | 0.0× ✗ | 0.0× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0993 Agent conformité environnementale assistant | 44 | 4 € | 11 € | 20 € | 1 € | 19 € | 0.2× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0994 Agent reporting déchets | 42 | 6 € | 14 € | 23 € | 1 € | 22 € | 0.2× ✗ | 0.2× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-0995 Agent suivi recyclage | 16 | 2 € | 5 € | 18 € | 0 € | 18 € | 0.1× ✗ | 0.1× ✗ | 9 € | S (1/bundle) | 2 800 € |
| AG-0996 Agent gestion fournisseurs énergie | 42 | 5 € | 13 € | 23 € | 1 € | 22 € | 0.2× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-0997 Agent opérations énergie | 150 | 18 € | 45 € | 21 € | 4 € | 18 € | 0.9× ✗ | 0.6× ✗ | 15 € | S (1/bundle) | 2 800 € |
| AG-0998 Energy data analyst junior | 154 | 17 € | 43 € | 28 € | 3 € | 25 € | 0.6× ✗ | 0.6× ✗ | 12 € | S (1/bundle) | 2 800 € |
| AG-0999 Energy operations specialist | 45 | 6 € | 14 € | 28 € | 1 € | 27 € | 0.2× ✗ | 0.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-1000 Energy operations manager | 19 | 2 € | 5 € | 30 € | 0 € | 30 € | 0.1× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-1001 Assistant production | 390 | 48 € | 119 € | 42 € | 10 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1002 Assistant maintenance | 674 | 66 € | 165 € | 46 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1003 Agent planning production | 253 | 27 € | 67 € | 66 € | 5 € | 60 € | 0.4× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1004 Agent ordonnancement | 845 | 83 € | 208 € | 77 € | 17 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1005 Agent achats industriels | 512 | 65 € | 161 € | 73 € | 13 € | 60 € | 0.9× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1006 Agent fournisseurs industriels | 616 | 58 € | 145 € | 44 € | 12 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1007 Agent qualité documentaire | 645 | 62 € | 155 € | 73 € | 12 € | 60 € | 0.8× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1008 Agent traçabilité | 281 | 39 € | 97 € | 68 € | 8 € | 60 € | 0.6× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1009 Agent documentation technique | 2134 | 263 € | 658 € | 85 € | 53 € | 33 € | **3.1×** | 1.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1010 Agent reporting production | 72 | 9 € | 21 € | 34 € | 2 € | 33 € | 0.3× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1011 Agent stocks industriels | 616 | 58 € | 145 € | 44 € | 12 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1012 Agent approvisionnement | 126 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1013 Agent planification maintenance | 23 | 3 € | 7 € | 33 € | 1 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1014 Agent suivi incidents | 820 | 114 € | 286 € | 55 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1015 Agent gestion ordres de travail | 725 | 101 € | 253 € | 53 € | 20 € | 33 € | 1.9× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1016 Agent conformité documentaire | 616 | 86 € | 215 € | 77 € | 17 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1017 Agent qualité fournisseur | 1357 | 190 € | 474 € | 82 € | 38 € | 44 € | 2.3× ✗ | 0.4× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-1018 Agent gestion pièces détachées | 642 | 88 € | 221 € | 50 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1019 Agent relation clients industriels | 1295 | 124 € | 309 € | 57 € | 25 € | 33 € | 2.2× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1020 Agent devis industriel | 1804 | 182 € | 456 € | 97 € | 36 € | 60 € | 1.9× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1021 Agent commande industrielle | 2490 | 291 € | 727 € | 91 € | 58 € | 33 € | **3.2×** | 1.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1022 Agent support SAV industriel | 2461 | 287 € | 717 € | 90 € | 57 € | 33 € | **3.2×** | 1.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1023 Agent analyse performance industrielle | 163 | 16 € | 39 € | 63 € | 3 € | 60 € | 0.3× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1024 Industrial operations specialist | 308 | 43 € | 107 € | 69 € | 9 € | 60 € | 0.6× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1025 Industrial operations manager | 17 | 2 € | 6 € | 61 € | 0 € | 60 € | 0.0× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1026 Assistant éditeur | 279 | 36 € | 90 € | 42 € | 7 € | 35 € | 0.9× ✗ | 0.2× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1027 Correcteur | 1050 | 126 € | 314 € | 96 € | 25 € | 70 € | 1.3× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1028 Relecteur | 1050 | 126 € | 314 € | 96 € | 25 € | 70 € | 1.3× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1029 Rédacteur technique | 1209 | 127 € | 317 € | 60 € | 25 € | 35 € | 2.1× ✗ | 0.6× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1030 Rédacteur documentation | 315 | 37 € | 91 € | 42 € | 7 € | 35 € | 0.9× ✗ | 0.2× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1031 Assistant recherche | 1050 | 105 € | 262 € | 91 € | 21 € | 70 € | 1.1× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1032 Research assistant | 169 | 23 € | 59 € | 40 € | 5 € | 35 € | 0.6× ✗ | 0.1× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1033 Fact-checking assistant | 1050 | 126 € | 314 € | 96 € | 25 € | 70 € | 1.3× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1034 Bibliography assistant | 901 | 105 € | 262 € | 56 € | 21 € | 35 € | 1.9× ✗ | 0.5× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1035 Indexation specialist | 762 | 71 € | 178 € | 49 € | 14 € | 35 € | 1.4× ✗ | 0.3× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1036 Metadata specialist | 1082 | 109 € | 273 € | 92 € | 22 € | 70 € | 1.2× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1037 Content editor junior | 930 | 102 € | 255 € | 91 € | 20 € | 70 € | 1.1× ✗ | 0.2× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1038 Content curator | 246 | 33 € | 82 € | 42 € | 7 € | 35 € | 0.8× ✗ | 0.2× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1039 Newsletter editor | 52 | 5 € | 13 € | 36 € | 1 € | 35 € | 0.1× ✗ | 0.0× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1040 Knowledge base editor | 914 | 86 € | 214 € | 52 € | 17 € | 35 € | 1.6× ✗ | 0.4× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1041 Documentation manager junior | 14 | 1 € | 4 € | 35 € | 0 € | 35 € | 0.0× ✗ | 0.0× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1042 Technical documentation specialist | 312 | 36 € | 91 € | 78 € | 7 € | 70 € | 0.5× ✗ | 0.1× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1043 Content localization specialist | 464 | 57 € | 144 € | 46 € | 11 € | 35 € | 1.2× ✗ | 0.3× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1044 Digital publishing assistant | 1050 | 119 € | 297 € | 59 € | 24 € | 35 € | 2.0× ✗ | 0.5× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1045 Publishing operations assistant | 969 | 128 € | 320 € | 61 € | 26 € | 35 € | 2.1× ✗ | 0.6× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1046 Research data assistant | 1060 | 113 € | 282 € | 58 € | 23 € | 35 € | 2.0× ✗ | 0.5× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1047 Literature review assistant | 1050 | 112 € | 280 € | 93 € | 22 € | 70 € | 1.2× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1048 Editorial operations specialist | 221 | 29 € | 73 € | 76 € | 6 € | 70 € | 0.4× ✗ | 0.1× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1049 Editorial operations manager | 10 | 1 € | 3 € | 71 € | 0 € | 70 € | 0.0× ✗ | 0.0× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1050 Knowledge operations manager | 10 | 1 € | 3 € | 71 € | 0 € | 70 € | 0.0× ✗ | 0.0× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1051 Assistant gestion patrimoine | 849 | 116 € | 289 € | 58 € | 23 € | 35 € | 2.0× ✗ | 0.5× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1052 Agent collecte documents patrimoine | 2584 | 305 € | 763 € | 105 € | 61 € | 44 € | 2.9× ✗ | 0.7× ✗ | 44 € | XL (8/bundle) | 2 800 € |
| AG-1053 Agent reporting patrimoine | 7 | 1 € | 2 € | 35 € | 0 € | 35 € | 0.0× ✗ | 0.0× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1054 Agent suivi investissements | 765 | 107 € | 267 € | 56 € | 21 € | 35 € | 1.9× ✗ | 0.5× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1055 Agent suivi portefeuille | 1840 | 228 € | 569 € | 81 € | 46 € | 35 € | 2.8× ✗ | 0.9× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1056 Agent rendez-vous conseiller | 1920 | 210 € | 524 € | 62 € | 42 € | 20 € | **3.4×** | **3.0×** | 17 € | S (1/bundle) | 2 800 € |
| AG-1057 Agent reporting client | 7 | 1 € | 2 € | 35 € | 0 € | 35 € | 0.0× ✗ | 0.0× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1058 Agent documentation fiscale | 454 | 63 € | 159 € | 83 € | 13 € | 70 € | 0.8× ✗ | 0.1× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1059 Agent suivi contrats | 1811 | 225 € | 563 € | 80 € | 45 € | 35 € | 2.8× ✗ | 0.9× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1060 Agent suivi assurance | 1956 | 245 € | 614 € | 84 € | 49 € | 35 € | 2.9× ✗ | 1.0× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1061 Agent suivi immobilier | 1208 | 169 € | 422 € | 69 € | 34 € | 35 € | 2.5× ✗ | 0.7× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1062 Agent suivi crédit | 907 | 127 € | 317 € | 60 € | 25 € | 35 € | 2.1× ✗ | 0.6× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1063 Agent relation client patrimoine | 1985 | 243 € | 606 € | 84 € | 49 € | 35 € | 2.9× ✗ | 1.0× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1064 Agent relance documents | 133 | 17 € | 42 € | 24 € | 3 € | 20 € | 0.7× ✗ | 0.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1065 Agent onboarding client patrimoine | 930 | 123 € | 307 € | 60 € | 25 € | 35 € | 2.1× ✗ | 0.5× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1066 Agent KYC patrimoine | 901 | 119 € | 297 € | 94 € | 24 € | 70 € | 1.3× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1067 Agent conformité patrimoine | 758 | 106 € | 264 € | 92 € | 21 € | 70 € | 1.1× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1068 Agent préparation réunion | 1354 | 168 € | 421 € | 69 € | 34 € | 35 € | 2.5× ✗ | 0.7× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1069 Agent synthèse portefeuille | 7 | 1 € | 2 € | 35 € | 0 € | 35 € | 0.0× ✗ | 0.0× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1070 Agent analyse patrimoine junior | 1050 | 133 € | 332 € | 97 € | 27 € | 70 € | 1.4× ✗ | 0.3× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1071 Agent suivi échéances | 969 | 134 € | 335 € | 47 € | 27 € | 20 € | 2.8× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1072 Agent reporting fiscal assistant | 606 | 85 € | 212 € | 87 € | 17 € | 70 € | 1.0× ✗ | 0.2× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1073 Wealth operations assistant | 965 | 134 € | 334 € | 62 € | 27 € | 35 € | 2.2× ✗ | 0.6× ✗ | 33 € | L (5/bundle) | 2 800 € |
| AG-1074 Wealth operations specialist | 10 | 1 € | 3 € | 71 € | 0 € | 70 € | 0.0× ✗ | 0.0× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1075 Wealth operations manager | 17 | 2 € | 5 € | 71 € | 0 € | 70 € | 0.0× ✗ | 0.0× ✗ | 70 € | XL (5/bundle) | 2 800 € |
| AG-1083 Auditeur interne junior | 51 | 7 € | 16 € | 23 € | 1 € | 22 € | 0.3× ✗ | 0.2× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-1084 Superviseur audit interne | 77 | 8 € | 19 € | 27 € | 2 € | 25 € | 0.3× ✗ | 0.0× ✗ | 25 € | XL (15/bundle) | 2 800 € |
| AG-1085 Auditeur conformité interne | 22 | 3 € | 7 € | 23 € | 1 € | 22 € | 0.1× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-1086 Auditeur opérationnel | 22 | 3 € | 7 € | 23 € | 1 € | 22 € | 0.1× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-1087 Auditeur financier interne | 6 | 1 € | 2 € | 30 € | 0 € | 30 € | 0.0× ✗ | 0.0× ✗ | 30 € | XL (13/bundle) | 2 800 € |
| AG-1088 Coordinateur audit qualité | 19 | 2 € | 6 € | 19 € | 0 € | 19 € | 0.1× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-1089 Assistant vérification conformité | 100 | 11 € | 27 € | 27 € | 2 € | 25 € | 0.4× ✗ | 0.4× ✗ | 12 € | S (1/bundle) | 2 800 € |
| AG-1090 Analyste risques audit | 6 | 1 € | 2 € | 25 € | 0 € | 25 € | 0.0× ✗ | 0.0× ✗ | 25 € | XL (15/bundle) | 2 800 € |
| AG-1091 Auditeur système d'information | 6 | 1 € | 2 € | 25 € | 0 € | 25 € | 0.0× ✗ | 0.0× ✗ | 25 € | XL (15/bundle) | 2 800 € |
| AG-1092 Gestionnaire documentation audit | 96 | 11 € | 27 € | 24 € | 2 € | 22 € | 0.4× ✗ | 0.4× ✗ | 11 € | S (1/bundle) | 2 800 € |
| AG-1093 Specialiste recommandations audit | 26 | 3 € | 7 € | 26 € | 1 € | 25 € | 0.1× ✗ | 0.0× ✗ | 25 € | XL (15/bundle) | 2 800 € |
| AG-1094 Coordinateur suivi correction | 45 | 5 € | 12 € | 23 € | 1 € | 22 € | 0.2× ✗ | 0.1× ✗ | 20 € | S (1/bundle) | 2 800 € |
| AG-1095 Analyste fiscal junior | 487 | 54 € | 135 € | 43 € | 11 € | 33 € | 1.2× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1096 Specialiste impot revenu | 1054 | 126 € | 315 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1097 Assistant planification fiscale | 309 | 36 € | 91 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1098 Coordinateur fiscalité international | 309 | 36 € | 91 € | 67 € | 7 € | 60 € | 0.5× ✗ | 0.1× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1099 Agent gestion TVA | 313 | 44 € | 109 € | 29 € | 9 € | 20 € | 1.5× ✗ | 1.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1100 Analyste conformité fiscale | 11 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1101 Gestionnaire dossiers contentieux fiscal | 1980 | 247 € | 618 € | 110 € | 49 € | 60 € | 2.3× ✗ | 0.6× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1102 Assistant reporting fiscal | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1103 Coordinateur impots régionaux | 1384 | 186 € | 466 € | 58 € | 37 € | 20 € | **3.2×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1104 Specialiste optimisation fiscale | 753 | 84 € | 211 € | 77 € | 17 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1105 Agent declarations impots | 643 | 88 € | 221 € | 38 € | 18 € | 20 € | 2.3× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1106 Analyste droits d'auteur | 8 | 1 € | 3 € | 21 € | 0 € | 20 € | 0.1× ✗ | 0.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1107 Assistant audit fiscal | 1682 | 221 € | 553 € | 77 € | 44 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1108 Gestionnaire amendes fiscales | 1682 | 193 € | 483 € | 59 € | 39 € | 20 € | **3.3×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1109 Coordinateur verifications fiscales | 1264 | 156 € | 389 € | 64 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1110 Assistant budget junior | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1111 Coordinateur prévisions financières | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1112 Analyste ecarts budgetaires | 8 | 1 € | 2 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1113 Gestionnaire allocations budgétaires | 756 | 106 € | 264 € | 41 € | 21 € | 20 € | 2.5× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1114 Agent suivi budget opérationnel | 86 | 12 € | 29 € | 23 € | 2 € | 20 € | 0.5× ✗ | 0.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1115 Coordinateur reporting budgetaire | 335 | 40 € | 99 € | 28 € | 8 € | 20 € | 1.4× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1116 Assistant planification annuelle | 633 | 67 € | 169 € | 34 € | 13 € | 20 € | 2.0× ✗ | 1.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1117 Specialiste scenarios budgetaires | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1118 Analyste tendances prévisions | 8 | 1 € | 2 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1119 Agent consolidation données budget | 157 | 22 € | 55 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1120 Gestionnaire demandes investissements | 1206 | 169 € | 422 € | 66 € | 34 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1121 Coordinateur budget départements | 753 | 77 € | 193 € | 36 € | 15 € | 20 € | 2.2× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1122 Assistant analyses flux trésorerie | 8 | 1 € | 3 € | 33 € | 0 € | 33 € | 0.0× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1123 Analyste impact budgetaire | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1124 Gestionnaire justifications budget | 306 | 43 € | 107 € | 29 € | 9 € | 20 € | 1.5× ✗ | 1.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1125 Gestionnaire opérations bancaires | 970 | 129 € | 321 € | 46 € | 26 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1126 Analyste liquidités banque | 400 | 49 € | 122 € | 42 € | 10 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1127 Assistant relation banquiers | 455 | 50 € | 124 € | 30 € | 10 € | 20 € | 1.6× ✗ | 1.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1128 Coordinateur flux bancaires | 251 | 35 € | 87 € | 27 € | 7 € | 20 € | 1.3× ✗ | 1.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1129 Agent suivi crédits bancaires | 306 | 36 € | 89 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1130 Analyste taux bancaires | 186 | 19 € | 48 € | 36 € | 4 € | 33 € | 0.5× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1131 Specialiste swaps couverture | 604 | 77 € | 194 € | 48 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1132 Coordinateur emprunts obligations | 763 | 100 € | 249 € | 53 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1133 Assistant trésorerie banque | 189 | 24 € | 59 € | 25 € | 5 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1134 Analyste conditions financement | 1355 | 182 € | 456 € | 69 € | 36 € | 33 € | 2.6× ✗ | 0.8× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1135 Agent suivi facilities | 218 | 30 € | 76 € | 26 € | 6 € | 20 € | 1.1× ✗ | 0.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1136 Gestionnaire lettres crédit | 1384 | 180 € | 449 € | 68 € | 36 € | 33 € | 2.6× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1137 Assistant syndication prêts | 1067 | 114 € | 286 € | 55 € | 23 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1138 Analyste benchmarking bancaire | 604 | 70 € | 176 € | 47 € | 14 € | 33 € | 1.5× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1139 Coordinateur conventions bancaires | 604 | 77 € | 194 € | 48 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1140 Agent suivi covenants prêts | 306 | 29 € | 72 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1141 Analyste coûts services bancaires | 157 | 22 € | 55 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1142 Gestionnaire comptes bancaires | 756 | 106 € | 264 € | 41 € | 21 € | 20 € | 2.5× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1143 Assistant gestion valeurs | 766 | 107 € | 268 € | 42 € | 21 € | 20 € | 2.6× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1144 Coordinateur rapprochements banque | 396 | 47 € | 117 € | 30 € | 9 € | 20 € | 1.6× ✗ | 1.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1145 Specialiste confirmation échanges | 1384 | 180 € | 449 € | 56 € | 36 € | 20 € | **3.2×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1146 Agent versements impôts | 607 | 78 € | 195 € | 36 € | 16 € | 20 € | 2.2× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1147 Analyste concurrence bancaire | 1054 | 133 € | 333 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1148 Gestionnaire paiements multis | 1384 | 180 € | 449 € | 56 € | 36 € | 20 € | **3.2×** | 2.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1149 Assistant gestion cash pool | 98 | 14 € | 34 € | 23 € | 3 € | 20 € | 0.6× ✗ | 0.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1150 Agent souscription assurance | 1384 | 180 € | 449 € | 68 € | 36 € | 33 € | 2.6× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1151 Analyste actuariel junior | 306 | 29 € | 72 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1152 Coordinateur sinistres assurance | 905 | 135 € | 303 € | 47 € | 27 € | 20 € | 2.9× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1153 Assistant gestion portefeuille assurance | 610 | 85 € | 213 € | 37 € | 17 € | 20 € | 2.3× ✗ | 1.9× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1154 Specialiste garanties assurance | 1051 | 133 € | 332 € | 59 € | 27 € | 33 € | 2.3× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1155 Gestionnaire primes assurance | 908 | 127 € | 317 € | 46 € | 25 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1156 Analyste risques assurance | 306 | 29 € | 72 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1157 Agent relation assureurs | 753 | 105 € | 263 € | 41 € | 21 € | 20 € | 2.5× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1158 Coordinateur appels offre assurance | 1650 | 231 € | 577 € | 79 € | 46 € | 33 € | 2.9× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1159 Assistant couvertures assurance | 607 | 78 € | 194 € | 36 € | 16 € | 20 € | 2.2× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1160 Analyste conditions contrats | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1161 Gestionnaire franchises assurance | 306 | 36 € | 89 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1162 Agent suivi renovations contrats | 902 | 119 € | 298 € | 44 € | 24 € | 20 € | 2.7× ✗ | 2.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1163 Specialiste assurance cyber | 753 | 98 € | 246 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1164 Coordinateur déclarations assurance | 1083 | 151 € | 378 € | 51 € | 30 € | 20 € | 3.0× ✗ | 2.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1165 Agent indemnisation sinistres | 465 | 65 € | 162 € | 33 € | 13 € | 20 € | 1.9× ✗ | 1.6× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1166 Analyste provisions techniques | 306 | 43 € | 107 € | 41 € | 9 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1167 Gestionnaire dossiers contentieux assurance | 760 | 99 € | 248 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1168 Assistant gestion risques residuels | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1169 Coordinateur assurance conformité | 309 | 36 € | 91 € | 28 € | 7 € | 20 € | 1.3× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1170 Agent suivi expiration contrats | 338 | 46 € | 114 € | 29 € | 9 € | 20 € | 1.6× ✗ | 1.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1171 Analyste benchmarking assurance | 455 | 50 € | 124 € | 43 € | 10 € | 33 € | 1.2× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1172 Gestionnaire preferences fournisseurs | 306 | 36 € | 89 € | 27 € | 7 € | 20 € | 1.3× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1173 Assistant gestion documents assurance | 1054 | 133 € | 333 € | 47 € | 27 € | 20 € | 2.8× ✗ | 2.5× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1174 Specialiste assurance multirisque | 306 | 36 € | 89 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1175 Gestionnaire portefeuille actions | 302 | 41 € | 102 € | 41 € | 8 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1176 Analyste sélection valeurs | 1650 | 196 € | 489 € | 99 € | 39 € | 60 € | 2.0× ✗ | 0.5× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1177 Coordinateur rebalancing portefeuille | 614 | 79 € | 197 € | 48 € | 16 € | 33 € | 1.6× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1178 Assistant gestion OPCVM | 182 | 24 € | 60 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1179 Specialiste allocation d'actifs | 1200 | 161 € | 402 € | 92 € | 32 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1180 Agent suivi performance portefeuille | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1181 Analyste risques portefeuille | 173 | 17 € | 43 € | 64 € | 3 € | 60 € | 0.3× ✗ | 0.0× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1182 Gestionnaire diversification | 164 | 23 € | 57 € | 37 € | 5 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1183 Assistant gestion obligations | 225 | 24 € | 61 € | 37 € | 5 € | 33 € | 0.7× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1184 Coordinateur reporting portefeuille | 335 | 47 € | 117 € | 30 € | 9 € | 20 € | 1.6× ✗ | 1.3× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1185 Analyste benchmark portefeuille | 306 | 36 € | 89 € | 40 € | 7 € | 33 € | 0.9× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1186 Assistant gestion dividendes | 970 | 108 € | 269 € | 42 € | 22 € | 20 € | 2.6× ✗ | 2.2× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1187 Assistant relation investisseurs | 2255 | 238 € | 596 € | 80 € | 48 € | 33 € | 3.0× ✗ | 0.9× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1188 Coordinateur roadshow financiers | 1504 | 175 € | 438 € | 55 € | 35 € | 20 € | **3.2×** | 2.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1189 Agent suivi ratings crédit | 309 | 43 € | 107 € | 41 € | 9 € | 33 € | 1.0× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1190 Analyste sensibilité investisseurs | 15 | 2 € | 4 € | 33 € | 0 € | 33 € | 0.1× ✗ | 0.0× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1191 Specialiste communication financière | 604 | 77 € | 193 € | 48 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1192 Gestionnaire calendrier événements investisseurs | 1355 | 175 € | 438 € | 55 € | 35 € | 20 € | **3.2×** | 2.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1193 Coordinateur conférences analysts | 2550 | 273 € | 681 € | 75 € | 55 € | 20 € | **3.6×** | **3.3×** | 17 € | S (1/bundle) | 2 800 € |
| AG-1194 Agent réponses actionnaires | 2284 | 249 € | 623 € | 70 € | 50 € | 20 € | **3.5×** | **3.2×** | 17 € | S (1/bundle) | 2 800 € |
| AG-1195 Analyste structure actionnariat | 484 | 54 € | 134 € | 43 € | 11 € | 33 € | 1.2× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1196 Assistant gestion demandes informations | 2585 | 325 € | 812 € | 85 € | 65 € | 20 € | **3.8×** | **3.5×** | 17 € | S (1/bundle) | 2 800 € |
| AG-1197 Analyste M&A junior | 902 | 105 € | 263 € | 54 € | 21 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1198 Assistant due diligence financière | 1200 | 154 € | 384 € | 91 € | 31 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1199 Coordinateur transactions | 694 | 82 € | 204 € | 49 € | 16 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1200 Agent suivi intégration post-fusion | 196 | 20 € | 51 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1201 Specialiste structure transactions | 1200 | 161 € | 402 € | 92 € | 32 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1202 Gestionnaire documentation M&A | 1530 | 200 € | 500 € | 60 € | 40 € | 20 € | **3.3×** | 3.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1203 Assistant évaluation cibles | 1200 | 154 € | 384 € | 91 € | 31 € | 60 € | 1.7× ✗ | 0.4× ✗ | 60 € | XL (6/bundle) | 2 800 € |
| AG-1204 Analyste synergies | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1205 Coordinateur closing M&A | 1080 | 130 € | 325 € | 59 € | 26 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1206 Agent suivi conditions suspensives | 763 | 92 € | 231 € | 39 € | 18 € | 20 € | 2.4× ✗ | 2.0× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1207 Assistant gestion earnouts | 1210 | 127 € | 318 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1208 Analyste comparables M&A | 1200 | 154 € | 384 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1209 Gestionnaire communications M&A | 1200 | 154 € | 384 € | 51 € | 31 € | 20 € | **3.0×** | 2.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1210 Assistant gestion réactions marchés | 571 | 64 € | 161 € | 45 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1211 Coordinateur approbations réglementaires | 763 | 106 € | 266 € | 54 € | 21 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1212 Commercial BtoB junior | 720 | 67 € | 168 € | 39 € | 13 € | 26 € | 1.7× ✗ | 1.7× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-1213 Coordinateur prospection commerciale | 202 | 21 € | 52 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1214 Agent suivi pipeline ventes | 111 | 14 € | 34 € | 35 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1215 Analyste conversion prospects | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1216 Specialiste négociation contrats | 1200 | 119 € | 297 € | 56 € | 24 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1217 Gestionnaire contrats clients | 1808 | 169 € | 421 € | 66 € | 34 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1218 Assistant gestion comptes clés | 821 | 84 € | 210 € | 43 € | 17 € | 26 € | 2.0× ✗ | 1.9× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-1219 Agent suivi délais livraison | 189 | 23 € | 58 € | 24 € | 5 € | 19 € | 1.0× ✗ | 0.7× ✗ | 16 € | S (1/bundle) | 2 800 € |
| AG-1220 Coordinateur appels offres | 691 | 80 € | 200 € | 49 € | 16 € | 33 € | 1.6× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1221 Analyste stratégie tarifaire | 455 | 50 € | 124 € | 43 € | 10 € | 33 € | 1.2× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1222 Agent gestion objections ventes | 170 | 16 € | 41 € | 36 € | 3 € | 33 € | 0.5× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1223 Specialiste démonstrations produits | 1504 | 140 € | 350 € | 54 € | 28 € | 26 € | 2.6× ✗ | 2.5× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-1224 Gestionnaire conditions commerciales | 759 | 99 € | 247 € | 52 € | 20 € | 33 € | 1.9× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1225 Assistant préparation visites | 189 | 19 € | 48 € | 23 € | 4 € | 19 € | 0.8× ✗ | 0.6× ✗ | 16 € | S (1/bundle) | 2 800 € |
| AG-1226 Coordinateur ventes régionales | 313 | 29 € | 74 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1227 Agent suivi satisfactions clients | 672 | 63 € | 158 € | 45 € | 13 € | 33 € | 1.4× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1228 Analyste besoins clients | 164 | 16 € | 39 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1229 Gestionnaire crédits clients | 875 | 84 € | 211 € | 49 € | 17 € | 33 € | 1.7× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1230 Assistant documentation commerciale | 908 | 85 € | 212 € | 43 € | 17 € | 26 € | 2.0× ✗ | 1.9× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-1231 Coordinateur formations équipes ventes | 759 | 78 € | 195 € | 41 € | 16 € | 26 € | 1.9× ✗ | 1.8× ✗ | 21 € | S (1/bundle) | 2 800 € |
| AG-1232 Agent suivi contrats en cours | 646 | 90 € | 225 € | 51 € | 18 € | 33 € | 1.8× ✗ | 0.4× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1233 Analyste risques commerciaux | 157 | 15 € | 37 € | 36 € | 3 € | 33 € | 0.4× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1234 Specialiste solutions personnalisées | 1504 | 154 € | 386 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1235 Coordinateur promotion produits | 1080 | 123 € | 307 € | 57 € | 25 € | 33 € | 2.1× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1236 Assistant gestion objectifs ventes | 316 | 44 € | 109 € | 41 € | 9 € | 33 € | 1.1× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1237 Consultant Business Development | 462 | 50 € | 126 € | 43 € | 10 € | 33 € | 1.2× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1238 Analyste opportunités marché | 465 | 58 € | 144 € | 44 € | 12 € | 33 € | 1.3× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1239 Coordinateur prospection stratégique | 640 | 75 € | 189 € | 35 € | 15 € | 20 € | 2.1× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1240 Agent identification partenaires | 1051 | 126 € | 315 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1241 Specialiste évaluation nouveaux marchés | 1200 | 161 € | 402 € | 65 € | 32 € | 33 € | 2.5× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1242 Gestionnaire pipeline partenariats | 199 | 21 € | 52 € | 24 € | 4 € | 20 € | 0.8× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1243 Assistant études faisabilité | 1200 | 154 € | 384 € | 63 € | 31 € | 33 € | 2.4× ✗ | 0.7× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1244 Analyste positionnement stratégique | 902 | 112 € | 280 € | 55 € | 22 € | 33 € | 2.0× ✗ | 0.5× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1245 Agent suivi alliances | 160 | 22 € | 56 € | 25 € | 4 € | 20 € | 0.9× ✗ | 0.7× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1246 Coordinateur réunions développement | 1054 | 126 € | 316 € | 46 € | 25 € | 20 € | 2.8× ✗ | 2.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1247 Specialiste structuration deals | 1200 | 147 € | 367 € | 62 € | 29 € | 33 € | 2.4× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1248 Gestionnaire relationnel partenaires | 491 | 53 € | 133 € | 31 € | 11 € | 20 € | 1.7× ✗ | 1.4× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1249 Assistant analyses concurrentielles | 468 | 51 € | 129 € | 43 € | 10 € | 33 € | 1.2× ✗ | 0.2× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1250 Coordinateur intégration partenaires | 760 | 78 € | 196 € | 36 € | 16 € | 20 € | 2.2× ✗ | 1.8× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1251 Agent suivi KPIs partenariats | 306 | 36 € | 89 € | 27 € | 7 € | 20 € | 1.3× ✗ | 1.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1252 Analyste ROI partenariats | 157 | 22 € | 55 € | 37 € | 4 € | 33 € | 0.6× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1253 Assistant prospection internationale | 1051 | 126 € | 315 € | 58 € | 25 € | 33 € | 2.2× ✗ | 0.6× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1254 Coordinateur approbation nouveaux projets | 756 | 99 € | 247 € | 40 € | 20 € | 20 € | 2.5× ✗ | 2.1× ✗ | 17 € | S (1/bundle) | 2 800 € |
| AG-1255 Specialiste innovation produits | 753 | 77 € | 193 € | 48 € | 15 € | 33 € | 1.6× ✗ | 0.3× ✗ | 31 € | L (6/bundle) | 2 800 € |
| AG-1256 Agent suivi tendances marchés | 306 | 29 € | 72 € | 38 € | 6 € | 33 € | 0.8× ✗ | 0.1× ✗ | 31 € | L (6/bundle) | 2 800 € |

**136 fiches sur 1249 tiennent la règle des 3× en bundle partagé, 45 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
