# Coût par agent et par mois — API seule contre Local-Agent

Généré par `outils/economie.ts` le 2026-10-10 sur 1761 fiches. Hypothèses dans `dimensionnement/tarifs-api.json` (version 2026-09-19) : 12 000 jetons d'entrée par tour dont 70 % en cache, 800 en sortie, 6 tours par exécution (+4 avec navigateur, +3 pour un document lourd), 20 % des exécutions restent par l'API chez Local-Agent, matériel amorti sur 12 mois, électricité 0.25 €/kWh, un poste N150 par agent. **Ce sont des hypothèses, pas des mesures** : à remplacer par les moyennes relevées dès que des agents tournent.

Règle commerciale : matériel + API résiduelle au moins **3× moins cher** que l'API seule. « Partagé » = le bundle d'un petit client porte un mélange d'agents et celui-ci paie sa part de charge (5 % au minimum) ; « seul » = un seul agent sur son bundle, le pire cas ; « en flotte » = sa part sur le bundle au meilleur prix par unité de puissance (gros client).

| Agent | Exéc./mois | API seule (Sonnet) | API seule (Opus) | Local-Agent partagé | dont API résid. | dont matériel | Ratio partagé | Ratio seul | Matériel en flotte | Bundle | Employé |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| AG-0001 Secrétaire administratif | 2280 | 288 € | 720 € | 88 € | 58 € | 30 € | **3.3×** | 2.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0002 Assistant administratif | 99 | 12 € | 30 € | 41 € | 2 € | 39 € | 0.3× ✗ | 0.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0003 Assistant de direction | 694 | 65 € | 162 € | 57 € | 13 € | 44 € | 1.1× ✗ | 1.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0004 Assistant virtuel | 484 | 45 € | 113 € | 58 € | 9 € | 49 € | 0.8× ✗ | 0.8× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0005 Opérateur de saisie | 1290 | 210 € | 392 € | 100 € | 42 € | 58 € | 2.1× ✗ | 1.3× ✗ | 43 € | M (2/bundle) | 2 800 € |
| AG-0006 Gestionnaire documentaire | 12 | 1 € | 3 € | 35 € | 0 € | 35 € | 0.0× ✗ | 0.0× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0007 Agent de classement | 2194 | 204 € | 511 € | 79 € | 41 € | 39 € | 2.6× ✗ | 2.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0008 Agent de traitement de formulaires | 4620 | 531 € | 1 328 € | 145 € | 106 € | 39 € | **3.7×** | **3.4×** | 37 € | S (1/bundle) | 2 800 € |
| AG-0009 Gestionnaire de courrier | 150 | 20 € | 49 € | 48 € | 4 € | 44 € | 0.4× ✗ | 0.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0010 Agent de reporting | 21 | 3 € | 6 € | 44 € | 1 € | 44 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0011 Assistant de réunion | 1264 | 119 € | 298 € | 68 € | 24 € | 44 € | 1.8× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0012 Gestionnaire d'agenda | 1384 | 129 € | 322 € | 65 € | 26 € | 39 € | 2.0× ✗ | 1.9× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0013 Assistant achats | 154 | 19 € | 46 € | 48 € | 4 € | 44 € | 0.4× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0014 Assistant opérations | 2910 | 301 € | 751 € | 96 € | 60 € | 35 € | **3.1×** | 2.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0015 Assistant de projet | 21 | 3 € | 6 € | 39 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0016 Gestionnaire de dossiers | 1590 | 157 € | 391 € | 62 € | 31 € | 30 € | 2.5× ✗ | 2.1× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0017 Agent de back-office | 750 | 102 € | 255 € | 69 € | 20 € | 49 € | 1.5× ✗ | 1.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0018 Agent de contrôle documentaire | 870 | 119 € | 297 € | 68 € | 24 € | 44 € | 1.8× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0019 Agent de transcription | 1504 | 147 € | 368 € | 64 € | 29 € | 34 € | 2.3× ✗ | 2.0× ✗ | 31 € | S (1/bundle) | 2 800 € |
| AG-0020 Assistant commercial administratif | 724 | 100 € | 249 € | 69 € | 20 € | 49 € | 1.4× ✗ | 1.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0021 Assistant juridique administratif | 811 | 84 € | 210 € | 60 € | 17 € | 43 € | 1.4× ✗ | 0.2× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0022 Assistant immobilier administratif | 274 | 28 € | 71 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.5× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0023 Assistant médical administratif | 694 | 66 € | 165 € | 48 € | 13 € | 34 € | 1.4× ✗ | 1.2× ✗ | 31 € | S (1/bundle) | 2 800 € |
| AG-0024 Agent de réservation | 6300 | 588 € | 1 471 € | 146 € | 118 € | 28 € | **4.0×** | **3.6×** | 22 € | S (2/bundle) | 2 800 € |
| AG-0025 Responsable des services généraux | 49 | 5 € | 13 € | 44 € | 1 € | 43 € | 0.1× ✗ | 0.0× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0026 Assistant comptable | 74 | 10 € | 25 € | 50 € | 2 € | 48 € | 0.2× ✗ | 0.0× ✗ | 48 € | XL (12/bundle) | 2 800 € |
| AG-0027 Opérateur de saisie comptable | 150 | 18 € | 45 € | 65 € | 4 € | 62 € | 0.3× ✗ | 0.1× ✗ | 45 € | M (2/bundle) | 2 800 € |
| AG-0028 Agent de facturation | 274 | 37 € | 92 € | 56 € | 7 € | 49 € | 0.7× ✗ | 0.6× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0029 Agent de rapprochement bancaire | 121 | 16 € | 39 € | 46 € | 3 € | 43 € | 0.3× ✗ | 0.0× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0030 Gestionnaire fournisseurs | 669 | 65 € | 164 € | 56 € | 13 € | 43 € | 1.2× ✗ | 0.1× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0031 Gestionnaire clients | 669 | 65 € | 164 € | 56 € | 13 € | 43 € | 1.2× ✗ | 0.1× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0032 Agent de recouvrement | 124 | 16 € | 40 € | 47 € | 3 € | 44 € | 0.3× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0033 Gestionnaire de notes de frais | 100 | 14 € | 35 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.3× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0034 Agent de contrôle des factures | 150 | 20 € | 49 € | 47 € | 4 € | 43 € | 0.4× ✗ | 0.1× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0035 Préparateur de clôture | 9 | 1 € | 3 € | 63 € | 0 € | 62 € | 0.0× ✗ | 0.0× ✗ | 62 € | XL (8/bundle) | 2 800 € |
| AG-0036 Assistant trésorerie | 124 | 16 € | 40 € | 47 € | 3 € | 44 € | 0.3× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0037 Assistant paie | 34 | 5 € | 12 € | 45 € | 1 € | 44 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0038 Assistant fiscal | 783 | 81 € | 204 € | 72 € | 16 € | 56 € | 1.1× ✗ | 0.2× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-0039 Analyste comptable | 5 | 1 € | 2 € | 47 € | 0 € | 46 € | 0.0× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0040 Contrôleur comptable | 9 | 1 € | 3 € | 56 € | 0 € | 56 € | 0.0× ✗ | 0.0× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-0041 Reporting financier | 35 | 5 € | 12 € | 47 € | 1 € | 46 € | 0.1× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0042 Gestionnaire des immobilisations | 307 | 43 € | 107 € | 59 € | 9 € | 51 € | 0.7× ✗ | 0.7× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0043 Gestionnaire des dépenses | 1320 | 155 € | 388 € | 63 € | 31 € | 32 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0044 Assistant audit | 369 | 51 € | 128 € | 53 € | 10 € | 43 € | 1.0× ✗ | 0.1× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0045 Assistant contrôle de gestion | 6 | 1 € | 2 € | 47 € | 0 € | 46 € | 0.0× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0046 Analyste de trésorerie | 1110 | 155 € | 388 € | 56 € | 31 € | 25 € | 2.8× ✗ | 1.9× ✗ | 37 € | S (4/bundle) | 2 800 € |
| AG-0047 Assistant budget | 602 | 84 € | 210 € | 63 € | 17 € | 46 € | 1.3× ✗ | 0.2× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0048 Gestionnaire de comptes clients | 216 | 30 € | 76 € | 55 € | 6 € | 49 € | 0.6× ✗ | 0.5× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0049 Gestionnaire de comptes fournisseurs | 41 | 6 € | 14 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0050 Assistant directeur financier | 339 | 40 € | 100 € | 64 € | 8 € | 56 € | 0.6× ✗ | 0.1× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-0051 Analyste financier | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0052 Analyste crédit | 1650 | 182 € | 454 € | 113 € | 36 € | 77 € | 1.6× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0053 Analyste investissement | 870 | 91 € | 227 € | 45 € | 18 € | 27 € | 2.0× ✗ | 1.3× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0054 Assistant gestion de portefeuille | 331 | 36 € | 91 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0055 Assistant trésorerie | 784 | 79 € | 197 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0056 Analyste risques | 870 | 92 € | 231 € | 45 € | 18 € | 27 € | 2.0× ✗ | 1.3× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0057 Analyste marché | 254 | 25 € | 64 € | 55 € | 5 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0058 Analyste FP&A | 1140 | 157 € | 391 € | 62 € | 31 € | 30 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0059 Analyste rentabilité | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0060 Analyste coûts | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0061 Analyste tarification | 462 | 58 € | 144 € | 61 € | 12 € | 49 € | 0.9× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0062 Assistant banque d'affaires | 1530 | 165 € | 412 € | 110 € | 33 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0063 Assistant en financement d'entreprise | 1054 | 147 € | 368 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0064 Assistant d'audit d'acquisition | 960 | 119 € | 297 € | 101 € | 24 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0065 Analyste fusions-acquisitions | 1200 | 161 € | 402 € | 109 € | 32 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0066 Analyste ESG | 1440 | 198 € | 496 € | 77 € | 40 € | 37 € | 2.6× ✗ | 2.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0067 Analyste cash-flow | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0068 Analyste performance | 420 | 56 € | 140 € | 42 € | 11 € | 30 € | 1.3× ✗ | 0.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0069 Assistant relation investisseurs | 1951 | 224 € | 559 € | 94 € | 45 € | 49 € | 2.4× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0070 Analyste financement | 1110 | 147 € | 367 € | 61 € | 29 € | 32 € | 2.4× ✗ | 1.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0071 Analyste crédit immobilier | 1650 | 189 € | 472 € | 87 € | 38 € | 49 € | 2.2× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0072 Analyste assurance-crédit | 540 | 74 € | 185 € | 42 € | 15 € | 27 € | 1.8× ✗ | 1.1× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0073 Assistant contrôle financier | 11 | 2 € | 4 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0074 Reporting financier | 1260 | 131 € | 328 € | 57 € | 26 € | 30 € | 2.3× ✗ | 1.7× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0075 Assistant de la direction financière | 487 | 47 € | 118 € | 59 € | 9 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0076 Gestionnaire de sinistres | 2160 | 243 € | 608 € | 93 € | 49 € | 44 € | 2.6× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0077 Agent de déclaration de sinistre | 2460 | 287 € | 716 € | 96 € | 57 € | 39 € | 3.0× ✗ | 2.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0078 Gestionnaire contrats | 2580 | 275 € | 688 € | 85 € | 55 € | 30 € | **3.2×** | 2.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0079 Gestionnaire polices | 1320 | 154 € | 384 € | 63 € | 31 € | 32 € | 2.5× ✗ | 1.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0080 Souscripteur | 2460 | 287 € | 716 € | 88 € | 57 € | 30 € | **3.3×** | 2.6× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0081 Assistant souscription | 1954 | 266 € | 665 € | 90 € | 53 € | 37 € | 2.9× ✗ | 2.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0082 Analyste risques assurance | 1560 | 180 € | 451 € | 80 € | 36 € | 44 € | 2.3× ✗ | 2.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0083 Agent de renouvellement | 870 | 84 € | 210 € | 47 € | 17 € | 30 € | 1.8× ✗ | 1.4× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0084 Agent de résiliation | 1504 | 203 € | 508 € | 78 € | 41 € | 37 € | 2.6× ✗ | 2.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0085 Agent de conformité assurance | 1440 | 171 € | 426 € | 71 € | 34 € | 37 € | 2.4× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0086 Gestionnaire indemnisation | 1054 | 140 € | 351 € | 65 € | 28 € | 37 € | 2.1× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0087 Assistant expert sinistre | 1504 | 264 € | 527 € | 90 € | 53 € | 37 € | 2.9× ✗ | 2.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0088 Chargé de clientèle assurance | 1504 | 175 € | 438 € | 72 € | 35 € | 37 € | 2.4× ✗ | 2.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0089 Agent de qualification sinistre | 1410 | 196 € | 489 € | 76 € | 39 € | 37 € | 2.6× ✗ | 2.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0090 Agent de collecte documentaire | 1650 | 198 € | 496 € | 74 € | 40 € | 35 € | 2.7× ✗ | 2.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0091 Analyste fraude assurance | 870 | 84 € | 210 € | 61 € | 17 € | 44 € | 1.4× ✗ | 1.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0092 Assistant courtier | 909 | 127 € | 317 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0093 Agent de relance primes | 780 | 105 € | 262 € | 51 € | 21 € | 30 € | 2.0× ✗ | 1.6× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0094 Gestionnaire garanties | 905 | 119 € | 299 € | 61 € | 24 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0095 Assistant actuariat | 604 | 70 € | 176 € | 64 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0096 Analyste portefeuille assurance | 870 | 120 € | 301 € | 51 € | 24 € | 27 € | 2.4× ✗ | 1.6× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0097 Agent de comparaison contrats | 1230 | 143 € | 356 € | 66 € | 29 € | 37 € | 2.2× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0098 Assistant production | 934 | 131 € | 326 € | 63 € | 26 € | 37 € | 2.1× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0099 Assistant indemnisation | 934 | 124 € | 309 € | 62 € | 25 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0100 Assistant direction assurance | 607 | 78 € | 195 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0101 Conseiller bancaire à distance | 1860 | 175 € | 437 € | 72 € | 35 € | 37 € | 2.4× ✗ | 2.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0102 Agent de support bancaire | 3420 | 347 € | 867 € | 109 € | 69 € | 39 € | **3.2×** | **3.1×** | 28 € | S (1/bundle) | 2 800 € |
| AG-0103 Agent KYC | 1290 | 150 € | 374 € | 74 € | 30 € | 44 € | 2.0× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0104 Agent de contrôle documentaire bancaire | 1530 | 144 € | 360 € | 73 € | 29 € | 44 € | 2.0× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0105 Gestionnaire de comptes | 1685 | 173 € | 432 € | 72 € | 35 € | 37 € | 2.4× ✗ | 2.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0106 Agent de crédit | 1440 | 172 € | 430 € | 78 € | 34 € | 44 € | 2.2× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0107 Analyste crédit junior | 1530 | 214 € | 535 € | 92 € | 43 € | 49 € | 2.3× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0108 Agent de prêts | 1410 | 190 € | 475 € | 75 € | 38 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0109 Gestionnaire de dossiers de financement | 1020 | 137 € | 342 € | 66 € | 27 € | 39 € | 2.1× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0110 Agent de conformité | 870 | 120 € | 301 € | 61 € | 24 € | 37 € | 2.0× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0111 Analyste fraude bancaire | 665 | 79 € | 197 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0112 Agent de recouvrement bancaire | 1020 | 113 € | 283 € | 57 € | 23 € | 35 € | 2.0× ✗ | 1.7× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0113 Assistant trésorerie bancaire | 360 | 43 € | 108 € | 46 € | 9 € | 37 € | 0.9× ✗ | 0.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0114 Assistant opérations bancaires | 720 | 94 € | 234 € | 56 € | 19 € | 37 € | 1.7× ✗ | 1.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0115 Agent de paiement | 720 | 87 € | 217 € | 55 € | 17 € | 37 € | 1.6× ✗ | 1.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0116 Agent de rapprochement | 400 | 49 € | 122 € | 47 € | 10 € | 37 € | 1.0× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0117 Agent de réclamation | 1020 | 140 € | 349 € | 65 € | 28 € | 37 € | 2.1× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0118 Agent de clôture de compte | 931 | 116 € | 290 € | 60 € | 23 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0119 Agent de renouvellement | 1440 | 200 € | 500 € | 67 € | 40 € | 27 € | 3.0× ✗ | 2.2× ✗ | 37 € | S (3/bundle) | 2 800 € |
| AG-0120 Assistant back-office bancaire | 131 | 18 € | 45 € | 41 € | 4 € | 37 € | 0.4× ✗ | 0.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0121 Analyste risques bancaires | 990 | 137 € | 342 € | 58 € | 27 € | 30 € | 2.4× ✗ | 1.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0122 Assistant conformité | 244 | 26 € | 64 € | 55 € | 5 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0123 Assistant relation client | 1711 | 176 € | 441 € | 72 € | 35 € | 37 € | 2.4× ✗ | 2.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0124 Assistant reporting bancaire | 306 | 29 € | 72 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0125 Assistant direction bancaire | 494 | 54 € | 134 € | 48 € | 11 € | 37 € | 1.1× ✗ | 1.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0126 Assistant RH | 750 | 73 € | 182 € | 49 € | 15 € | 35 € | 1.5× ✗ | 1.3× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0127 Chargé de sourcing | 369 | 36 € | 90 € | 51 € | 7 € | 44 € | 0.7× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0128 Screener CV | 720 | 70 € | 175 € | 57 € | 14 € | 43 € | 1.2× ✗ | 0.2× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0129 Coordinateur entretiens | 1410 | 133 € | 332 € | 61 € | 27 € | 35 € | 2.2× ✗ | 1.9× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0130 Agent onboarding | 364 | 48 € | 120 € | 44 € | 10 € | 35 € | 1.1× ✗ | 0.9× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0131 Gestionnaire congés | 1235 | 145 € | 362 € | 61 € | 29 € | 33 € | 2.4× ✗ | 2.0× ✗ | 25 € | S (1/bundle) | 2 800 € |
| AG-0132 Gestionnaire absences | 95 | 10 € | 26 € | 32 € | 2 € | 30 € | 0.3× ✗ | 0.2× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0133 Assistant paie | 5 | 1 € | 2 € | 31 € | 0 € | 30 € | 0.0× ✗ | 0.0× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0134 Agent support RH | 1235 | 115 € | 288 € | 62 € | 23 € | 39 € | 1.9× ✗ | 1.7× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0135 Rédacteur offres d'emploi | 604 | 57 € | 141 € | 47 € | 11 € | 35 € | 1.2× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0136 Assistant formation | 190 | 26 € | 66 € | 38 € | 5 € | 33 € | 0.7× ✗ | 0.5× ✗ | 25 € | S (1/bundle) | 2 800 € |
| AG-0137 Agent de suivi candidats | 95 | 10 € | 26 € | 37 € | 2 € | 35 € | 0.3× ✗ | 0.2× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0138 Gestionnaire dossiers salariés | 640 | 88 € | 219 € | 53 € | 18 € | 35 € | 1.7× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0139 Assistant mobilité | 604 | 70 € | 176 € | 44 € | 14 € | 30 € | 1.6× ✗ | 1.2× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0140 Assistant recrutement | 484 | 61 € | 152 € | 51 € | 12 € | 39 € | 1.2× ✗ | 1.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0141 Analyste RH | 154 | 14 € | 36 € | 38 € | 3 € | 35 € | 0.4× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0142 Assistant gestion des talents | 455 | 50 € | 124 € | 40 € | 10 € | 30 € | 1.2× ✗ | 0.8× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0143 Assistant évaluation des performances | 339 | 40 € | 100 € | 38 € | 8 € | 30 € | 1.1× ✗ | 0.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0144 Agent de communication RH | 601 | 56 € | 140 € | 45 € | 11 € | 34 € | 1.2× ✗ | 0.9× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0145 Assistant administration du personnel | 244 | 34 € | 85 € | 39 € | 7 € | 33 € | 0.9× ✗ | 0.7× ✗ | 25 € | S (1/bundle) | 2 800 € |
| AG-0146 Gestionnaire avantages | 8 | 1 € | 3 € | 31 € | 0 € | 30 € | 0.0× ✗ | 0.0× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0147 Assistant relations sociales | 190 | 27 € | 66 € | 34 € | 5 € | 29 € | 0.8× ✗ | 0.5× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0148 Assistant SIRH | 41 | 6 € | 14 € | 37 € | 1 € | 35 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0149 Reporting RH | 303 | 42 € | 106 € | 41 € | 8 € | 32 € | 1.0× ✗ | 0.7× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0150 Gestionnaire administration du personnel | 219 | 22 € | 54 € | 42 € | 4 € | 37 € | 0.5× ✗ | 0.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0151 Sourcer | 219 | 22 € | 55 € | 50 € | 4 € | 46 € | 0.4× ✗ | 0.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0152 Chargé de recrutement | 394 | 52 € | 130 € | 53 € | 10 € | 42 € | 1.0× ✗ | 0.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0153 Recruiter sédentaire | 124 | 14 € | 36 € | 44 € | 3 € | 41 € | 0.3× ✗ | 0.3× ✗ | 29 € | S (1/bundle) | 2 800 € |
| AG-0154 Chargé de sourcing candidats | 162 | 15 € | 38 € | 42 € | 3 € | 39 € | 0.4× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0155 Agent de préqualification | 361 | 34 € | 84 € | 46 € | 7 € | 39 € | 0.7× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0156 Agent de chasse | 244 | 33 € | 81 € | 50 € | 7 € | 44 € | 0.7× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0157 Coordinateur candidats | 244 | 24 € | 60 € | 42 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 27 € | S (1/bundle) | 2 800 € |
| AG-0158 Agent de prise de rendez-vous | 694 | 65 € | 162 € | 43 € | 13 € | 30 € | 1.5× ✗ | 1.1× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0159 Agent de suivi candidats | 95 | 12 € | 30 € | 35 € | 2 € | 33 € | 0.3× ✗ | 0.3× ✗ | 25 € | S (1/bundle) | 2 800 € |
| AG-0160 Agent de recherche de profils | 244 | 26 € | 64 € | 49 € | 5 € | 44 € | 0.5× ✗ | 0.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0161 Rédacteur d'annonces | 604 | 57 € | 141 € | 47 € | 11 € | 35 € | 1.2× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0162 Analyste CV | 720 | 67 € | 168 € | 64 € | 13 € | 51 € | 1.1× ✗ | 1.1× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0163 Analyste profils LinkedIn | 630 | 59 € | 147 € | 52 € | 12 € | 41 € | 1.1× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0164 Assistant entretiens | 390 | 46 € | 115 € | 46 € | 9 € | 37 € | 1.0× ✗ | 0.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0165 Agent de référence candidats | 630 | 66 € | 164 € | 44 € | 13 € | 30 € | 1.5× ✗ | 1.0× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0166 Assistant recrutement international | 605 | 57 € | 142 € | 47 € | 11 € | 35 € | 1.2× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0167 Agent de matching candidats | 785 | 75 € | 187 € | 52 € | 15 € | 37 € | 1.4× ✗ | 1.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0168 Agent de relance candidats | 95 | 12 € | 29 € | 35 € | 2 € | 33 € | 0.3× ✗ | 0.3× ✗ | 25 € | S (1/bundle) | 2 800 € |
| AG-0169 Agent de relance clients | 640 | 61 € | 152 € | 47 € | 12 € | 35 € | 1.3× ✗ | 1.1× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0170 Assistant commercial recrutement | 364 | 51 € | 127 € | 49 € | 10 € | 39 € | 1.0× ✗ | 0.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0171 Analyste marché emploi | 310 | 36 € | 91 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0172 Assistant cabinet de recrutement | 215 | 23 € | 58 € | 35 € | 5 € | 30 € | 0.7× ✗ | 0.5× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0173 Gestionnaire ATS | 41 | 5 € | 14 € | 34 € | 1 € | 33 € | 0.2× ✗ | 0.1× ✗ | 25 € | S (1/bundle) | 2 800 € |
| AG-0174 Reporting recrutement | 5 | 1 € | 2 € | 34 € | 0 € | 34 € | 0.0× ✗ | 0.0× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0175 Responsable des opérations de recrutement | 103 | 11 € | 27 € | 39 € | 2 € | 37 € | 0.3× ✗ | 0.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0176 SDR | 733 | 68 € | 171 € | 56 € | 14 € | 43 € | 1.2× ✗ | 1.2× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0177 BDR | 520 | 48 € | 121 € | 52 € | 10 € | 43 € | 0.9× ✗ | 0.9× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0178 Téléprospecteur | 904 | 84 € | 211 € | 53 € | 17 € | 36 € | 1.6× ✗ | 1.4× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-0179 Assistant commercial | 1354 | 156 € | 389 € | 74 € | 31 € | 43 € | 2.1× ✗ | 2.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0180 Assistant administration des ventes | 53 | 7 € | 17 € | 51 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0181 Chargé de génération de prospects | 1051 | 98 € | 245 € | 62 € | 20 € | 43 € | 1.6× ✗ | 1.5× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0182 Chargé de qualification de prospects | 784 | 73 € | 183 € | 57 € | 15 € | 43 € | 1.3× ✗ | 1.3× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0183 Appointment setter | 1354 | 126 € | 316 € | 61 € | 25 € | 36 € | 2.1× ✗ | 1.8× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-0184 Chargé de développement de comptes | 313 | 29 € | 74 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0185 Commercial sédentaire | 574 | 55 € | 137 € | 54 € | 11 € | 43 € | 1.0× ✗ | 1.0× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0186 Agent de relance commerciale | 189 | 19 € | 47 € | 46 € | 4 € | 43 € | 0.4× ✗ | 0.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0187 Agent de devis | 1024 | 98 € | 246 € | 62 € | 20 € | 43 € | 1.6× ✗ | 1.6× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0188 Agent de propositions commerciales | 1200 | 119 € | 297 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0189 Gestionnaire CRM | 646 | 62 € | 155 € | 62 € | 12 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0190 Analyste des ventes | 167 | 16 € | 39 € | 53 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0191 Assistant chargé de clientèle | 999 | 121 € | 303 € | 67 € | 24 € | 43 € | 1.8× ✗ | 1.8× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0192 Chargé de réussite client | 228 | 22 € | 54 € | 47 € | 4 € | 43 € | 0.5× ✗ | 0.5× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0193 Chargé des renouvellements de contrats | 604 | 63 € | 158 € | 55 € | 13 € | 43 € | 1.1× ✗ | 1.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0194 Chargé de montée en gamme client | 465 | 51 € | 126 € | 60 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0195 Chargé de ventes complémentaires | 1210 | 113 € | 282 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0196 Assistant support commercial | 371 | 42 € | 104 € | 51 € | 8 € | 43 € | 0.8× ✗ | 0.8× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0197 Agent de qualification B2B | 909 | 99 € | 247 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0198 Agent de prospection B2C | 1290 | 120 € | 301 € | 60 € | 24 € | 36 € | 2.0× ✗ | 1.8× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-0199 Assistant grands comptes | 756 | 78 € | 194 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0200 Responsable administration des ventes | 306 | 36 € | 89 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0201 Rédacteur marketing | 1054 | 112 € | 281 € | 60 € | 22 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0202 Responsable de contenus | 487 | 61 € | 153 € | 49 € | 12 € | 37 € | 1.2× ✗ | 1.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0203 Rédacteur de contenus | 1054 | 112 € | 281 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0204 Spécialiste référencement naturel | 309 | 43 € | 108 € | 58 € | 9 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0205 Assistant référencement naturel | 756 | 106 € | 264 € | 58 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0206 Chargé de marketing par e-mail | 633 | 68 € | 169 € | 51 € | 14 € | 37 € | 1.3× ✗ | 1.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0207 Chargé de marketing relationnel | 1054 | 112 € | 281 € | 60 € | 22 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0208 Gestionnaire de communauté en marketing | 665 | 77 € | 194 € | 53 € | 15 € | 37 € | 1.5× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0209 Responsable réseaux sociaux | 338 | 33 € | 83 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0210 Assistant marketing de croissance | 931 | 102 € | 255 € | 70 € | 20 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0211 Analyste marketing | 458 | 57 € | 142 € | 61 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0212 Chargé d'études de marché | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0213 Chargé de veille concurrentielle | 309 | 29 € | 73 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0214 Assistant campagnes marketing | 931 | 116 € | 290 € | 60 € | 23 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0215 Assistant opérations marketing | 905 | 126 € | 316 € | 62 € | 25 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0216 Spécialiste automatisation marketing | 756 | 92 € | 229 € | 56 € | 18 € | 37 € | 1.6× ✗ | 1.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0217 Chargé de maturation des prospects | 1210 | 162 € | 405 € | 70 € | 32 € | 37 € | 2.3× ✗ | 2.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0218 Concepteur de pages d'atterrissage | 1054 | 105 € | 263 € | 58 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0219 Chargé d'optimisation des conversions | 633 | 68 € | 169 € | 63 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0220 Assistant chef de produit marketing | 753 | 91 € | 228 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0221 Chargé d'affiliation | 614 | 86 € | 214 € | 67 € | 17 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0222 Chargé de marketing d'influence | 785 | 96 € | 239 € | 69 € | 19 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0223 Chargé de marketing événementiel | 1381 | 186 € | 465 € | 74 € | 37 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0224 Chargé de tableaux de bord marketing | 215 | 23 € | 58 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0225 Coordinateur marketing | 108 | 14 € | 34 € | 40 € | 3 € | 37 € | 0.3× ✗ | 0.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0226 Acheteur d'espaces publicitaires | 513 | 63 € | 158 € | 62 € | 13 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0227 Spécialiste liens sponsorisés | 199 | 21 € | 52 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0228 Spécialiste publicité sur les réseaux sociaux | 691 | 81 € | 203 € | 66 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0229 Chef de campagne publicitaire | 960 | 126 € | 314 € | 62 € | 25 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0230 Concepteur-rédacteur publicitaire | 1051 | 126 € | 315 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0231 Assistant stratégie créative | 902 | 119 € | 298 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0232 Analyste publicitaire | 458 | 64 € | 160 € | 90 € | 13 € | 77 € | 0.7× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0233 Analyste coût par clic | 18 | 2 € | 6 € | 50 € | 0 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0234 Assistant référencement payant | 225 | 30 € | 75 € | 43 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0235 Spécialiste bannières publicitaires | 228 | 32 € | 79 € | 56 € | 6 € | 49 € | 0.6× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0236 Assistant achat programmatique | 50 | 5 € | 14 € | 51 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0237 Chargé de diffusion des campagnes | 1054 | 126 € | 316 € | 62 € | 25 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0238 Assistant opérations publicitaires | 163 | 21 € | 53 € | 41 € | 4 € | 37 € | 0.5× ✗ | 0.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0239 Analyste d'audience | 455 | 64 € | 159 € | 62 € | 13 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0240 Analyste des conversions | 66 | 9 € | 23 € | 51 € | 2 € | 49 € | 0.2× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0241 Analyste rentabilité publicitaire | 8 | 1 € | 3 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0242 Chargé de reporting publicitaire | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0243 Spécialiste reciblage publicitaire | 44 | 6 € | 15 € | 51 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0244 Assistant publicité d'affiliation | 21 | 3 € | 7 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0245 Spécialiste publicité locale | 50 | 7 € | 18 € | 39 € | 1 € | 37 € | 0.2× ✗ | 0.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0246 Spécialiste publicité sur places de marché | 102 | 14 € | 35 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0247 Chargé de tests créatifs | 785 | 103 € | 257 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0248 Chargé de comptes publicitaires | 934 | 96 € | 239 € | 56 € | 19 € | 37 € | 1.7× ✗ | 1.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0249 Assistant média-planneur | 1051 | 133 € | 332 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0250 Responsable des opérations publicitaires | 306 | 43 € | 107 € | 58 € | 9 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0251 Assistant communication | 1261 | 154 € | 385 € | 68 € | 31 € | 37 € | 2.3× ✗ | 2.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0252 Chargé de communication junior | 1200 | 161 € | 402 € | 82 € | 32 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0253 Gestionnaire de communauté | 156 | 18 € | 44 € | 41 € | 4 € | 37 € | 0.4× ✗ | 0.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0254 Assistant réseaux sociaux | 960 | 120 € | 301 € | 61 € | 24 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0255 Rédacteur corporate | 1200 | 147 € | 367 € | 106 € | 29 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0256 Rédacteur communiqué | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0257 Attaché de presse assistant | 902 | 119 € | 298 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0258 Veilleur médias | 240 | 28 € | 70 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0259 Veilleur réputation | 276 | 37 € | 93 € | 57 € | 7 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0260 Analyste sentiment | 309 | 29 € | 73 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0261 Assistant relations presse | 753 | 105 € | 263 € | 71 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0262 Assistant communication interne | 760 | 92 € | 230 € | 56 € | 18 € | 37 € | 1.7× ✗ | 1.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0263 Assistant événementiel | 1200 | 161 € | 402 € | 69 € | 32 € | 37 € | 2.3× ✗ | 2.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0264 Rédacteur newsletter | 902 | 105 € | 263 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0265 Gestionnaire intranet | 167 | 23 € | 58 € | 42 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0266 Assistant marque employeur | 607 | 85 € | 212 € | 66 € | 17 € | 49 € | 1.3× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0267 Coordinateur de contenus | 247 | 26 € | 65 € | 42 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0268 Communication digitale | 189 | 26 € | 66 € | 55 € | 5 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0269 Communication locale | 1682 | 200 € | 500 € | 77 € | 40 € | 37 € | 2.6× ✗ | 2.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0270 Assistant influence | 753 | 91 € | 228 € | 95 € | 18 € | 77 € | 1.0× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0271 Assistant partenariats | 902 | 112 € | 280 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0272 Communication reporting | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0273 Assistant crise documentaire | 840 | 110 € | 276 € | 99 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0274 Chargé de veille médias | 157 | 22 € | 55 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0275 Responsable des opérations de communication | 47 | 6 € | 15 € | 38 € | 1 € | 37 € | 0.2× ✗ | 0.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0276 Graphiste de production | 3600 | 512 € | 1 015 € | 205 € | 102 € | 102 € | 2.5× ✗ | 1.0× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0277 Graphiste web | 900 | 150 € | 276 € | 132 € | 30 € | 102 € | 1.1× ✗ | 0.3× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0278 Graphiste réseaux sociaux | 930 | 208 € | 349 € | 161 € | 42 € | 119 € | 1.3× ✗ | 0.5× ✗ | 119 € | XL (3/bundle) | 2 800 € |
| AG-0279 Designer publicitaire | 3600 | 568 € | 1 155 € | 216 € | 114 € | 102 € | 2.6× ✗ | 1.1× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0280 Designer présentation | 3600 | 391 € | 978 € | 156 € | 78 € | 78 € | 2.5× ✗ | 0.8× ✗ | 78 € | XL (6/bundle) | 2 800 € |
| AG-0281 Graphiste e-mailing | 3600 | 335 € | 839 € | 169 € | 67 € | 102 € | 2.0× ✗ | 0.7× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0282 Graphiste pages d'atterrissage | 900 | 128 € | 254 € | 128 € | 26 € | 102 € | 1.0× ✗ | 0.3× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0283 Designer d'interfaces | 900 | 128 € | 254 € | 128 € | 26 € | 102 € | 1.0× ✗ | 0.3× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0284 Designer expérience utilisateur | 900 | 91 € | 227 € | 66 € | 18 € | 48 € | 1.4× ✗ | 0.2× ✗ | 48 € | XL (12/bundle) | 2 800 € |
| AG-0285 Designer produit numérique | 900 | 84 € | 210 € | 119 € | 17 € | 102 € | 0.7× ✗ | 0.2× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0286 Designer d'identité de marque | 602 | 100 € | 184 € | 122 € | 20 € | 102 € | 0.8× ✗ | 0.2× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0287 Créateur de logos | 900 | 128 € | 254 € | 128 € | 26 € | 102 € | 1.0× ✗ | 0.3× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0288 Illustrateur commercial | 900 | 135 € | 271 € | 129 € | 27 € | 102 € | 1.1× ✗ | 0.3× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0289 Infographiste | 900 | 113 € | 249 € | 125 € | 23 € | 102 € | 0.9× ✗ | 0.3× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0290 Maquettiste | 900 | 105 € | 262 € | 123 € | 21 € | 102 € | 0.8× ✗ | 0.2× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0291 Retoucheur photo | 3600 | 689 € | 1 192 € | 240 € | 138 € | 102 € | 2.9× ✗ | 1.3× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0292 Détoureur | 3600 | 600 € | 1 104 € | 222 € | 120 € | 102 € | 2.7× ✗ | 1.1× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0293 Designer e-commerce | 900 | 179 € | 315 € | 138 € | 36 € | 102 € | 1.3× ✗ | 0.4× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0294 Designer packaging | 3600 | 419 € | 1 048 € | 186 € | 84 € | 102 € | 2.3× ✗ | 0.8× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0295 Designer catalogue | 2100 | 287 € | 716 € | 159 € | 57 € | 102 € | 1.8× ✗ | 0.6× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0296 Designer print | 1650 | 189 € | 472 € | 140 € | 38 € | 102 € | 1.4× ✗ | 0.4× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0297 Designer événementiel | 1650 | 211 € | 494 € | 144 € | 42 € | 102 € | 1.5× ✗ | 0.5× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0298 Designer infographie | 2100 | 260 € | 616 € | 154 € | 52 € | 102 € | 1.7× ✗ | 0.6× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0299 Chargé de production créative | 1650 | 232 € | 546 € | 148 € | 46 € | 102 € | 1.6× ✗ | 0.5× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0300 Assistant coordination design | 2440 | 257 € | 642 € | 113 € | 51 € | 62 € | 2.3× ✗ | 1.5× ✗ | 45 € | M (2/bundle) | 2 800 € |
| AG-0301 Monteur vidéo junior | 1200 | 347 € | 556 € | 195 € | 69 € | 126 € | 1.8× ✗ | 0.7× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0302 Monteur shorts | 1200 | 264 € | 452 € | 179 € | 53 € | 126 € | 1.5× ✗ | 0.6× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0303 Monteur podcast | 1200 | 126 € | 314 € | 68 € | 25 € | 43 € | 1.9× ✗ | 1.8× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0304 Sous-titreur | 1200 | 112 € | 280 € | 65 € | 22 € | 43 € | 1.7× ✗ | 1.7× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0305 Transcripteur audio | 1650 | 161 € | 402 € | 75 € | 32 € | 43 € | 2.1× ✗ | 2.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0306 Nettoyeur audio | 1650 | 196 € | 489 € | 82 € | 39 € | 43 € | 2.4× ✗ | 2.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0307 Assistant conception sonore | 1200 | 133 € | 332 € | 103 € | 27 € | 76 € | 1.3× ✗ | 0.3× ✗ | 76 € | XL (6/bundle) | 2 800 € |
| AG-0308 Voice-over producer | 1200 | 140 € | 349 € | 71 € | 28 € | 43 € | 2.0× ✗ | 1.9× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0309 Assistant doublage | 1051 | 140 € | 350 € | 71 € | 28 € | 43 € | 2.0× ✗ | 1.9× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0310 Assistant postproduction | 662 | 85 € | 214 € | 143 € | 17 € | 126 € | 0.6× ✗ | 0.2× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0311 Coloriste étalonneur | 1054 | 181 € | 350 € | 162 € | 36 € | 126 € | 1.1× ✗ | 0.4× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0312 Retoucheur photo | 1200 | 199 € | 398 € | 142 € | 40 € | 102 € | 1.4× ✗ | 0.4× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0313 Photographe produit | 1200 | 162 € | 372 € | 134 € | 32 € | 102 € | 1.2× ✗ | 0.4× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0314 Créateur thumbnail | 1200 | 214 € | 403 € | 145 € | 43 € | 102 € | 1.5× ✗ | 0.5× ✗ | 102 € | XL (4/bundle) | 2 800 € |
| AG-0315 Graphiste animateur | 1200 | 286 € | 475 € | 183 € | 57 € | 126 € | 1.6× ✗ | 0.6× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0316 Assistant animation graphique | 1054 | 279 € | 459 € | 182 € | 56 € | 126 € | 1.5× ✗ | 0.6× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0317 Vidéo publicitaire editor | 1054 | 264 € | 454 € | 179 € | 53 € | 126 € | 1.5× ✗ | 0.6× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0318 Monteur vidéo réseaux sociaux | 1200 | 355 € | 544 € | 197 € | 71 € | 126 € | 1.8× ✗ | 0.7× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0319 Assistant production de podcasts | 1504 | 161 € | 403 € | 75 € | 32 € | 43 € | 2.2× ✗ | 2.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0320 Webinar editor | 1200 | 286 € | 475 € | 183 € | 57 € | 126 € | 1.6× ✗ | 0.6× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0321 Interview editor | 1200 | 224 € | 423 € | 171 € | 45 € | 126 € | 1.3× ✗ | 0.5× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0322 Spécialiste localisation audiovisuelle | 1051 | 126 € | 315 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0323 Spécialiste transcription audio | 905 | 113 € | 281 € | 65 € | 23 € | 43 € | 1.7× ✗ | 1.7× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0324 Sous-titreur adaptateur vidéo | 1054 | 319 € | 488 € | 190 € | 64 € | 126 € | 1.7× ✗ | 0.7× ✗ | 126 € | XL (3/bundle) | 2 800 € |
| AG-0325 Coordinateur de postproduction | 1264 | 156 € | 389 € | 81 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0326 Traducteur généraliste | 1200 | 154 € | 384 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0327 Traducteur e-commerce | 1200 | 140 € | 349 € | 77 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0328 Traducteur marketing | 1200 | 140 € | 349 € | 105 € | 28 € | 77 € | 1.3× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0329 Traducteur technique | 1200 | 161 € | 402 € | 109 € | 32 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0330 Traducteur logiciel | 1200 | 140 € | 349 € | 89 € | 28 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0331 Traducteur documentaire | 1200 | 161 € | 402 € | 109 € | 32 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0332 Traducteur touristique | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0333 Traducteur support client | 1504 | 182 € | 456 € | 74 € | 36 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0334 Traducteur RH | 1200 | 154 € | 384 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0335 Traducteur financier | 1200 | 147 € | 367 € | 106 € | 29 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0336 Traducteur juridique | 1200 | 154 € | 384 € | 108 € | 31 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0337 Spécialiste localisation | 1200 | 140 € | 349 € | 77 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0338 Post-editor traduction | 1054 | 140 € | 351 € | 78 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0339 Sous-titreur | 1200 | 126 € | 314 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0340 Localisation e-commerce | 814 | 98 € | 246 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0341 Localisation d'applications | 1200 | 154 € | 384 € | 92 € | 31 € | 61 € | 1.7× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0342 Localisation jeu vidéo | 1200 | 147 € | 367 € | 91 € | 29 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0343 Contrôleur qualité linguistique | 1200 | 154 € | 384 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0344 Terminologue | 902 | 126 € | 315 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0345 Gestionnaire de glossaire | 607 | 78 € | 195 € | 53 € | 16 € | 37 € | 1.5× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0346 Coordinateur traduction | 1264 | 168 € | 421 € | 71 € | 34 € | 37 € | 2.4× ✗ | 2.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0347 Assistant interprétariat | 1054 | 126 € | 316 € | 62 € | 25 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0348 Traducteur SEO | 1051 | 126 € | 315 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0349 Traducteur catalogue | 1200 | 147 € | 367 € | 91 € | 29 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0350 Responsable de production en traduction | 309 | 36 € | 90 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0351 Développeur junior | 1200 | 112 € | 280 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0352 Développeur frontend | 1200 | 126 € | 314 € | 86 € | 25 € | 61 € | 1.5× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0353 Développeur backend | 1200 | 112 € | 280 € | 99 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0354 Développeur full-stack | 1200 | 112 € | 280 € | 99 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0355 Développeur API | 1200 | 119 € | 297 € | 101 € | 24 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0356 Développeur mobile | 1054 | 112 € | 281 € | 84 € | 22 € | 61 € | 1.3× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0357 Intégrateur web | 1200 | 119 € | 297 € | 85 € | 24 € | 61 € | 1.4× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0358 Développeur WordPress | 756 | 78 € | 194 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0359 Développeur Shopify | 905 | 92 € | 229 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0360 Développeur e-commerce | 1200 | 112 € | 280 € | 99 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0361 Développeur PHP | 1054 | 112 € | 281 € | 100 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0362 Développeur JavaScript | 756 | 78 € | 194 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0363 Développeur Python | 1200 | 112 € | 280 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0364 Développeur Java | 1054 | 105 € | 264 € | 98 € | 21 € | 77 € | 1.1× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0365 Développeur .NET | 1051 | 112 € | 280 € | 99 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0366 Développeur SQL | 1200 | 126 € | 314 € | 102 € | 25 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0367 Testeur logiciel | 1200 | 133 € | 332 € | 88 € | 27 € | 61 € | 1.5× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0368 Ingénieur test et qualité logicielle | 909 | 92 € | 230 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0369 Bug fixer | 1054 | 98 € | 246 € | 97 € | 20 € | 77 € | 1.0× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0370 Code reviewer | 934 | 89 € | 222 € | 95 € | 18 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0371 Rédacteur technique informatique | 902 | 84 € | 210 € | 78 € | 17 € | 61 € | 1.1× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0372 Support technique niveau 1 | 1384 | 129 € | 323 € | 63 € | 26 € | 37 € | 2.0× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0373 Support technique niveau 2 | 1355 | 126 € | 316 € | 102 € | 25 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0374 Ingénieur d'exploitation et déploiement | 756 | 78 € | 194 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0375 Développeur automation | 934 | 96 € | 239 € | 69 € | 19 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0376 Opérateur de saisie de données | 1504 | 210 € | 526 € | 103 € | 42 € | 61 € | 2.0× ✗ | 0.5× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0377 Analyste de données | 1200 | 126 € | 314 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0378 Analyste décisionnel | 902 | 91 € | 228 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0379 Chargé de reporting | 760 | 78 € | 196 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0380 Analyste qualité des données | 931 | 109 € | 273 € | 71 € | 22 € | 49 € | 1.5× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0381 Spécialiste nettoyage de données | 1650 | 161 € | 402 € | 82 € | 32 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0382 Annotateur de données | 1200 | 119 € | 297 € | 85 € | 24 € | 61 € | 1.4× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0383 Chargé d'études | 1054 | 112 € | 281 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0384 Analyste d'audience web | 497 | 54 € | 135 € | 60 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0385 Analyste produit | 611 | 78 € | 196 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0386 Analyste données marketing | 756 | 92 € | 229 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0387 Analyste données commerciales | 167 | 16 € | 41 € | 53 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0388 Analyste données financières | 604 | 63 € | 159 € | 90 € | 13 € | 77 € | 0.7× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0389 Analyste des opérations | 348 | 42 € | 104 € | 58 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0390 Assistant prévisions | 753 | 84 € | 211 € | 94 € | 17 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0391 Dashboard builder | 902 | 105 € | 263 € | 82 € | 21 € | 61 € | 1.3× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0392 Assistant visualisation de données | 1051 | 120 € | 267 € | 85 € | 24 € | 61 € | 1.4× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0393 Assistant bases de données | 782 | 74 € | 186 € | 64 € | 15 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0394 Analyste requêtes et bases de données | 1054 | 112 € | 281 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0395 Spécialiste migration de données | 1200 | 140 € | 349 € | 105 € | 28 € | 77 € | 1.3× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0396 Assistant intégration de données | 694 | 73 € | 183 € | 64 € | 15 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0397 Assistant gouvernance des données | 756 | 78 € | 194 € | 93 € | 16 € | 77 € | 0.8× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0398 Gestionnaire des données de référence | 1061 | 141 € | 353 € | 78 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0399 Analyste exploitation des données | 662 | 72 € | 179 € | 64 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0400 Ingénieur de données analytiques | 934 | 95 € | 239 € | 96 € | 19 € | 77 € | 1.0× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0401 Analyste en centre opérationnel de sécurité | 1384 | 157 € | 393 € | 81 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0402 Analyste surveillance sécurité | 342 | 41 € | 102 € | 58 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0403 Analyste vulnérabilités | 607 | 71 € | 177 € | 64 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0404 Assistant conformité sécurité | 313 | 44 € | 109 € | 58 € | 9 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0405 Analyste gouvernance, risques et conformité | 604 | 84 € | 211 € | 94 € | 17 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0406 Chargé de documentation sécurité | 604 | 56 € | 141 € | 61 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0407 Assistant gestion des identités et des accès | 1384 | 193 € | 484 € | 88 € | 39 € | 49 € | 2.2× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0408 Analyste revue des habilitations | 604 | 84 € | 211 € | 66 € | 17 € | 49 € | 1.3× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0409 Chargé de sensibilisation à la cybersécurité | 788 | 74 € | 184 € | 64 € | 15 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0410 Chargé de campagnes d'hameçonnage simulé | 902 | 98 € | 245 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0411 Assistant documentation des incidents | 1355 | 134 € | 334 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0412 Assistant renseignement sur les menaces | 491 | 60 € | 150 € | 89 € | 12 € | 77 € | 0.7× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0413 Analyste reporting sécurité | 753 | 77 € | 193 € | 65 € | 15 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0414 Assistant audit sécurité | 1051 | 133 € | 332 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0415 Assistant analyse de risques cyber | 902 | 112 € | 280 € | 100 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0416 Gestionnaire de l'inventaire informatique | 167 | 23 € | 58 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0417 Analyste questionnaires de sécurité | 1501 | 161 € | 402 € | 82 € | 32 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0418 Assistant risques fournisseurs | 1203 | 154 € | 385 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0419 Assistant protection des données | 1054 | 105 € | 263 € | 98 € | 21 € | 77 € | 1.1× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0420 Assistant surveillance des postes de travail | 342 | 41 € | 102 € | 58 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0421 Assistant sécurité du cloud | 342 | 41 € | 102 € | 58 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0422 Assistant opérations de sécurité | 374 | 44 € | 110 € | 46 € | 9 € | 37 € | 0.9× ✗ | 0.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0423 Chercheur en menaces cyber | 1051 | 105 € | 262 € | 98 € | 21 € | 77 € | 1.1× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0424 Assistant politique de sécurité | 1051 | 112 € | 280 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0425 Analyste opérations cybersécurité | 455 | 50 € | 124 € | 87 € | 10 € | 77 € | 0.6× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0426 Assistant juridique | 429 | 49 € | 121 € | 47 € | 10 € | 37 € | 1.0× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0427 Juriste | 1501 | 147 € | 367 € | 106 € | 29 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0428 Documentaliste juridique | 1650 | 161 € | 402 € | 109 € | 32 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0429 Juriste contrats | 1501 | 168 € | 420 € | 95 € | 34 € | 61 € | 1.8× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0430 Contract reviewer | 1650 | 175 € | 437 € | 112 € | 35 € | 77 € | 1.6× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0431 Analyste des clauses contractuelles | 458 | 43 € | 108 € | 86 € | 9 € | 77 € | 0.5× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0432 Rédacteur d'actes juridiques | 1530 | 158 € | 395 € | 69 € | 32 € | 37 € | 2.3× ✗ | 2.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0433 Assistant audit juridique | 549 | 63 € | 156 € | 74 € | 13 € | 61 € | 0.8× ✗ | 0.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0434 Assistant conformité juridique | 462 | 64 € | 161 € | 62 € | 13 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0435 Assistant RGPD | 1504 | 147 € | 368 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0436 Assistant juridique droit des sociétés | 607 | 78 € | 195 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0437 Assistant propriété intellectuelle | 196 | 20 € | 51 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0438 Assistant recherche contentieux | 1054 | 126 € | 316 € | 102 € | 25 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0439 Assistant dossiers contentieux | 1530 | 164 € | 409 € | 94 € | 33 € | 61 € | 1.7× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0440 Chargé d'accueil juridique | 1381 | 137 € | 343 € | 65 € | 27 € | 37 € | 2.1× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0441 Chargé de correspondance juridique | 1384 | 145 € | 361 € | 78 € | 29 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0442 Assistant facturation juridique | 374 | 51 € | 127 € | 47 € | 10 € | 37 € | 1.1× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0443 Spécialiste organisation juridique | 455 | 57 € | 142 € | 61 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0444 Gestionnaire du cycle de vie des contrats | 1086 | 150 € | 376 € | 80 € | 30 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0445 Gestionnaire de la documentation juridique | 604 | 70 € | 176 € | 64 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0446 Chargé de veille réglementaire | 371 | 45 € | 112 € | 86 € | 9 € | 77 € | 0.5× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0447 Assistant traduction juridique | 1504 | 154 € | 386 € | 108 € | 31 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0448 Paralegal | 1054 | 119 € | 299 € | 101 € | 24 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0449 Assistant projets juridiques | 669 | 93 € | 233 € | 68 € | 19 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0450 Responsable organisation de la direction juridique | 157 | 22 € | 55 € | 81 € | 4 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0451 Assistant immobilier | 853 | 112 € | 280 € | 60 € | 22 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0452 Agent de qualification immobilier | 2130 | 282 € | 706 € | 106 € | 56 € | 49 € | 2.7× ✗ | 1.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0453 Agent de prospection immobilier | 429 | 53 € | 132 € | 48 € | 11 € | 37 € | 1.1× ✗ | 1.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0454 Rédacteur d'annonces immobilières | 1650 | 182 € | 454 € | 98 € | 36 € | 61 € | 1.9× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0455 Responsable des annonces immobilières | 257 | 28 € | 69 € | 43 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0456 Chasseur immobilier | 1384 | 137 € | 343 € | 77 € | 27 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0457 Agent de prise de rendez-vous | 2580 | 323 € | 807 € | 102 € | 65 € | 37 € | **3.2×** | 3.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0458 Assistant gestion locative | 66 | 9 € | 23 € | 39 € | 2 € | 37 € | 0.2× ✗ | 0.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0459 Gestionnaire locatif | 970 | 120 € | 300 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0460 Assistant syndic | 756 | 99 € | 247 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0461 Assistant transaction | 1119 | 141 € | 352 € | 78 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0462 Assistant location | 1650 | 196 € | 489 € | 100 € | 39 € | 61 € | 1.9× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0463 Analyste immobilier | 753 | 98 € | 246 € | 97 € | 20 € | 77 € | 1.0× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0464 Assistant estimation | 1051 | 140 € | 350 € | 89 € | 28 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0465 Assistant investissement immobilier | 1051 | 140 € | 350 € | 105 € | 28 € | 77 € | 1.3× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0466 Analyste données immobilières | 455 | 50 € | 124 € | 87 € | 10 € | 77 € | 0.6× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0467 Agent relation locataire | 2370 | 303 € | 758 € | 110 € | 61 € | 49 € | 2.8× ✗ | 1.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0468 Agent relation propriétaire | 611 | 64 € | 160 € | 62 € | 13 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0469 Agent suivi visites | 254 | 26 € | 64 € | 42 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0470 Agent relance prospects | 1115 | 149 € | 372 € | 67 € | 30 € | 37 € | 2.2× ✗ | 2.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0471 Agent renouvellement bail | 789 | 103 € | 258 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0472 Assistant immobilier commercial | 753 | 91 € | 228 € | 79 € | 18 € | 61 € | 1.1× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0473 Assistant immobilier entreprise | 909 | 113 € | 283 € | 100 € | 23 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0474 Assistant marketing immobilier | 756 | 100 € | 216 € | 81 € | 20 € | 61 € | 1.2× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0475 Assistant gestion technique immobilière | 1235 | 157 € | 393 € | 93 € | 31 € | 61 € | 1.7× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0476 Responsable e-commerce | 351 | 42 € | 105 € | 86 € | 8 € | 77 € | 0.5× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0477 Gestionnaire catalogue | 345 | 48 € | 121 € | 47 € | 10 € | 37 € | 1.0× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0478 Chargé de mise en ligne des produits | 1650 | 203 € | 507 € | 102 € | 41 € | 61 € | 2.0× ✗ | 0.5× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0479 Importateur produits | 1650 | 196 € | 489 € | 76 € | 39 € | 37 € | 2.6× ✗ | 2.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0480 Rédacteur de fiches produits | 1501 | 175 € | 437 € | 96 € | 35 € | 61 € | 1.8× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0481 Gestionnaire des données produits | 640 | 89 € | 223 € | 55 € | 18 € | 37 € | 1.6× ✗ | 1.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0482 Assistant tarification | 814 | 107 € | 267 € | 71 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0483 Responsable places de marché | 1119 | 121 € | 303 € | 74 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0484 Gestionnaire des commandes | 1050 | 116 € | 290 € | 60 € | 23 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0485 Gestionnaire des retours | 999 | 138 € | 345 € | 89 € | 28 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0486 Conseiller service client e-commerce | 4385 | 476 € | 1 190 € | 145 € | 95 € | 49 € | **3.3×** | 1.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0487 Gestionnaire des avis clients | 104 | 11 € | 29 € | 52 € | 2 € | 49 € | 0.2× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0488 Chargé d'e-mailing commercial | 225 | 24 € | 60 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0489 Spécialiste référencement e-commerce | 79 | 9 € | 24 € | 51 € | 2 € | 49 € | 0.2× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0490 Gestionnaire des flux produits | 131 | 18 € | 46 € | 41 € | 4 € | 37 € | 0.5× ✗ | 0.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0491 Assistant gestion des stocks | 131 | 18 € | 46 € | 41 € | 4 € | 37 € | 0.5× ✗ | 0.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0492 Assistant recherche de fournisseurs | 905 | 106 € | 264 € | 71 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0493 Assistant vente en livraison directe | 251 | 28 € | 70 € | 43 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0494 Chargé de recherche de produits | 31 | 4 € | 9 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0495 Assistant optimisation du taux de conversion | 494 | 55 € | 137 € | 60 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0496 Assistant marchandisage | 50 | 7 € | 17 € | 63 € | 1 € | 61 € | 0.1× ✗ | 0.0× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0497 Spécialiste opérations places de marché | 73 | 10 € | 25 € | 39 € | 2 € | 37 € | 0.3× ✗ | 0.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0498 E-commerce analyst | 251 | 26 € | 66 € | 82 € | 5 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0499 Spécialiste automatisation e-commerce | 513 | 49 € | 123 € | 59 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0500 Responsable des opérations e-commerce | 788 | 75 € | 188 € | 92 € | 15 € | 77 € | 0.8× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0501 Assistant achats | 211 | 27 € | 67 € | 43 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0502 Acheteur | 960 | 98 € | 245 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0503 Acheteur sourcing | 760 | 92 € | 230 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0504 Supplier researcher | 1051 | 119 € | 297 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0505 Demandeur de devis | 960 | 105 € | 262 € | 58 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0506 Comparateur fournisseurs | 1200 | 140 € | 349 € | 77 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0507 Analyste prix | 908 | 85 € | 213 € | 94 € | 17 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0508 Analyste fournisseurs | 8 | 1 € | 2 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0509 Gestionnaire commandes fournisseurs | 334 | 38 € | 96 € | 45 € | 8 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0510 Gestionnaire contrats fournisseurs | 908 | 92 € | 230 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0511 Assistant opérations achats | 941 | 90 € | 224 € | 55 € | 18 € | 37 € | 1.6× ✗ | 1.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0512 Assistant négociation | 1051 | 112 € | 280 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0513 Assistant appels d'offres | 934 | 110 € | 274 € | 59 € | 22 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0514 Analyste dépenses | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0515 Analyste des dépenses | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0516 Analyste données achats | 306 | 29 € | 72 € | 83 € | 6 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0517 Chargé de référencement fournisseurs | 1080 | 116 € | 290 € | 60 € | 23 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0518 Assistant conformité fournisseurs | 371 | 42 € | 105 € | 58 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0519 Gestionnaire des commandes d'achat | 276 | 32 € | 79 € | 44 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0520 Analyste reporting achats | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0521 Assistant acheteur famille | 309 | 36 € | 90 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0522 Assistant approvisionnement | 40 | 6 € | 14 € | 38 € | 1 € | 37 € | 0.1× ✗ | 0.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0523 Assistant achats internationaux | 636 | 82 € | 205 € | 66 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0524 Spécialiste automatisation des achats | 484 | 47 € | 117 € | 59 € | 9 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0525 Responsable des opérations achats | 160 | 15 € | 38 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0526 Assistant logistique | 240 | 28 € | 70 € | 43 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0527 Assistant répartition des tournées | 930 | 127 € | 318 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0528 Planificateur de tournées de livraison | 131 | 18 € | 46 € | 53 € | 4 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0529 Planificateur transport | 422 | 51 € | 126 € | 60 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0530 Assistant gestionnaire de parc | 795 | 76 € | 190 € | 52 € | 15 € | 37 € | 1.4× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0531 Shipment tracker | 542 | 60 € | 151 € | 49 € | 12 € | 37 € | 1.2× ✗ | 1.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0532 Chargé de préparation des commandes | 211 | 28 € | 70 € | 43 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0533 Assistant planification d'entrepôt | 127 | 18 € | 44 € | 53 € | 4 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0534 Planificateur des stocks | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0535 Analyste chaîne logistique | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0536 Assistant prévision de la demande | 164 | 16 € | 40 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0537 Coordinateur des livraisons | 1591 | 185 € | 462 € | 74 € | 37 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0538 Spécialiste logistique des retours | 160 | 22 € | 55 € | 66 € | 4 € | 61 € | 0.3× ✗ | 0.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0539 Assistant fret | 170 | 17 € | 42 € | 41 € | 3 € | 37 € | 0.4× ✗ | 0.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0540 Assistant gestion des transporteurs | 164 | 23 € | 57 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0541 Conseiller service client logistique | 3241 | 369 € | 923 € | 111 € | 74 € | 37 € | **3.3×** | **3.1×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0542 Assistant cotation transport | 1051 | 119 € | 297 € | 61 € | 24 € | 37 € | 1.9× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0543 Delivery scheduling agent | 331 | 36 € | 91 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0544 Analyste reporting entrepôt | 79 | 10 € | 24 € | 51 € | 2 € | 49 € | 0.2× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0545 Assistant contrôle des stocks | 276 | 37 € | 93 € | 45 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0546 Analyste données logistiques | 310 | 34 € | 86 € | 84 € | 7 € | 77 € | 0.4× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0547 Chargé de documentation logistique | 931 | 102 € | 255 € | 82 € | 20 € | 61 € | 1.3× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0548 Spécialiste des opérations logistiques | 200 | 19 € | 47 € | 53 € | 4 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0549 Assistant approvisionnement logistique | 811 | 81 € | 203 € | 66 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0550 Responsable des opérations logistiques | 200 | 19 € | 47 € | 81 € | 4 € | 77 € | 0.2× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0551 Dispatching agent | 1740 | 168 € | 419 € | 83 € | 34 € | 49 € | 2.0× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0552 Agent réservation transport | 5700 | 667 € | 1 667 € | 171 € | 133 € | 37 € | **3.9×** | **3.8×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0553 Planificateur de tournées | 31 | 4 € | 10 € | 78 € | 1 € | 77 € | 0.1× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0554 Gestionnaire flotte | 314 | 37 € | 92 € | 84 € | 7 € | 77 € | 0.4× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0555 Assistant flotte | 1333 | 185 € | 462 € | 98 € | 37 € | 61 € | 1.9× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0556 Agent suivi livraison | 4381 | 478 € | 1 195 € | 133 € | 96 € | 37 € | **3.6×** | **3.4×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0557 Agent support conducteur | 7080 | 678 € | 1 695 € | 185 € | 136 € | 49 € | **3.7×** | 1.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0558 Agent support client transport | 6811 | 642 € | 1 604 € | 178 € | 128 € | 49 € | **3.6×** | 1.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0559 Agent de qualification livraison | 331 | 43 € | 109 € | 70 € | 9 € | 61 € | 0.6× ✗ | 0.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0560 Agent de planification taxi | 2260 | 214 € | 534 € | 80 € | 43 € | 37 € | 2.7× ✗ | 2.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0561 Agent de dispatch VTC | 13141 | 1 561 € | 3 903 € | 349 € | 312 € | 37 € | **4.5×** | **4.4×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0562 Agent de dispatch livraison | 1050 | 103 € | 259 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0563 Assistant transport routier | 189 | 25 € | 62 € | 42 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0564 Assistant transport international | 871 | 85 € | 213 € | 67 € | 17 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0565 Agent de gestion carburant | 225 | 30 € | 74 € | 43 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0566 Agent de suivi maintenance | 255 | 33 € | 82 € | 56 € | 7 € | 49 € | 0.6× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0567 Assistant conformité transport | 225 | 30 € | 75 € | 83 € | 6 € | 77 € | 0.4× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0568 Agent de gestion documents transport | 334 | 45 € | 113 € | 70 € | 9 € | 61 € | 0.7× ✗ | 0.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0569 Analyste coûts transport | 157 | 22 € | 55 € | 81 € | 4 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0570 Analyste performance flotte | 44 | 5 € | 11 € | 78 € | 1 € | 77 € | 0.1× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0571 Assistant affrètement | 515 | 54 € | 135 € | 60 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0572 Agent de recherche transporteurs | 31 | 4 € | 10 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0573 Agent de confirmation livraison | 211 | 24 € | 60 € | 42 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0574 Spécialiste exploitation transport | 47 | 5 € | 12 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0575 Responsable d'exploitation transport | 458 | 50 € | 124 € | 87 € | 10 € | 77 € | 0.6× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0576 Agent de voyage | 4050 | 444 € | 1 111 € | 138 € | 89 € | 49 € | **3.2×** | 1.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0577 Organisateur de voyages | 1054 | 126 € | 315 € | 102 € | 25 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0578 Agent réservation | 360 | 41 € | 101 € | 45 € | 8 € | 37 € | 0.9× ✗ | 0.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0579 Concierge virtuel | 8704 | 811 € | 2 028 € | 199 € | 162 € | 37 € | **4.1×** | **3.9×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0580 Agent support voyage | 4950 | 468 € | 1 171 € | 143 € | 94 € | 49 € | **3.3×** | 1.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0581 Agent hôtel | 1260 | 141 € | 353 € | 65 € | 28 € | 37 € | 2.2× ✗ | 2.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0582 Agent location vacances | 1921 | 206 € | 514 € | 102 € | 41 € | 61 € | 2.0× ✗ | 0.5× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0583 Agent recherche vols | 6510 | 742 € | 1 855 € | 198 € | 148 € | 49 € | **3.8×** | 2.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0584 Agent recherche hôtels | 6480 | 704 € | 1 761 € | 190 € | 141 € | 49 € | **3.7×** | 1.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0585 Concepteur d'itinéraires | 1200 | 133 € | 332 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0586 Conseiller service client voyages | 1891 | 178 € | 444 € | 85 € | 36 € | 49 € | 2.1× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0587 Agent modification réservation | 4680 | 503 € | 1 258 € | 150 € | 101 € | 49 € | **3.4×** | 1.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0588 Agent annulation | 3964 | 420 € | 1 050 € | 133 € | 84 € | 49 € | **3.1×** | 1.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0589 Agent assurance voyage | 2134 | 224 € | 561 € | 122 € | 45 € | 77 € | 1.8× ✗ | 0.5× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0590 Destination advisor | 2885 | 319 € | 798 € | 141 € | 64 € | 77 € | 2.3× ✗ | 0.7× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0591 Rédacteur de contenus touristiques | 753 | 77 € | 193 € | 65 € | 15 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0592 Assistant marketing touristique | 309 | 36 € | 90 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0593 Analyste tarification voyages | 18 | 2 € | 6 € | 78 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0594 Assistant gestion des recettes | 486 | 67 € | 166 € | 90 € | 13 € | 77 € | 0.7× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0595 Assistant relations clientèle | 901 | 87 € | 217 € | 67 € | 17 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0596 Spécialiste gestion des réservations | 156 | 22 € | 55 € | 42 € | 4 € | 37 € | 0.5× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0597 Assistant frais de déplacement | 254 | 28 € | 71 € | 67 € | 6 € | 61 € | 0.4× ✗ | 0.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0598 Assistant voyages d'affaires | 3932 | 368 € | 920 € | 123 € | 74 € | 49 € | 3.0× ✗ | 1.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0599 Spécialiste production voyages | 189 | 25 € | 62 € | 54 € | 5 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0600 Responsable de production voyages | 160 | 15 € | 38 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0601 Agent réservation restaurant | 2434 | 230 € | 575 € | 83 € | 46 € | 37 € | 2.8× ✗ | 2.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0602 Agent réservation hôtel | 5461 | 594 € | 1 485 € | 156 € | 119 € | 37 € | **3.8×** | **3.6×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0603 Réceptionniste virtuel | 10805 | 1 007 € | 2 517 € | 239 € | 201 € | 37 € | **4.2×** | **4.1×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0604 Concierge numérique | 13111 | 1 255 € | 3 138 € | 288 € | 251 € | 37 € | **4.4×** | **4.3×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0605 Conseiller clientèle hôtelière | 12274 | 1 144 € | 2 860 € | 278 € | 229 € | 49 € | **4.1×** | 2.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0606 Conseiller service client restauration | 1570 | 147 € | 366 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0607 Agent commandes | 15874 | 1 481 € | 3 702 € | 333 € | 296 € | 37 € | **4.4×** | **4.3×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0608 Agent avis clients | 156 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0609 Assistant planning équipes | 1489 | 139 € | 349 € | 77 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0610 Assistant achats restaurant | 160 | 19 € | 48 € | 53 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0611 Assistant stock restaurant | 1518 | 142 € | 356 € | 78 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0612 Assistant menu | 18 | 2 € | 5 € | 78 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0613 Assistant marketing restaurant | 53 | 6 € | 13 € | 62 € | 1 € | 61 € | 0.1× ✗ | 0.0× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0614 Assistant livraison restaurant | 4391 | 409 € | 1 023 € | 131 € | 82 € | 49 € | **3.1×** | 1.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0615 Assistant gestion des recettes hôtelières | 134 | 14 € | 36 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0616 Assistant tarification hôtelière | 182 | 21 € | 53 € | 81 € | 4 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0617 Assistant planification des étages | 1569 | 148 € | 370 € | 79 € | 30 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0618 Coordinateur des demandes de maintenance | 5161 | 481 € | 1 202 € | 157 € | 96 € | 61 € | **3.1×** | 0.9× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0619 Assistant commercial hôtel | 737 | 69 € | 172 € | 63 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0620 Assistant commercial restaurant | 737 | 69 € | 173 € | 63 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0621 Assistant réservation événements | 2281 | 215 € | 538 € | 93 € | 43 € | 49 € | 2.3× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0622 Assistant réservation traiteur | 1591 | 151 € | 378 € | 80 € | 30 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0623 Assistant relation client hôtellerie | 98 | 11 € | 27 € | 52 € | 2 € | 49 € | 0.2× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0624 Spécialiste exploitation hôtelière | 79 | 9 € | 22 € | 79 € | 2 € | 77 € | 0.1× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0625 Responsable d'exploitation hôtellerie-restauration | 53 | 5 € | 14 € | 78 € | 1 € | 77 € | 0.1× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0626 Assistant pédagogique | 772 | 72 € | 181 € | 64 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0627 Créateur de cours | 163 | 15 € | 38 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0628 Créateur d'exercices | 185 | 17 € | 43 € | 81 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0629 Créateur de quiz | 131 | 14 € | 34 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0630 Correcteur automatique | 163 | 15 € | 38 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0631 Tuteur IA | 11584 | 1 080 € | 2 699 € | 293 € | 216 € | 77 € | **3.7×** | 1.7× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0632 Assistant professeur | 108 | 13 € | 32 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0633 Assistant formation | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0634 Concepteur de contenus pédagogiques | 40 | 4 € | 10 € | 62 € | 1 € | 61 € | 0.1× ✗ | 0.0× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0635 Administrateur de plateforme de formation | 1486 | 139 € | 346 € | 77 € | 28 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0636 Assistant formation linguistique | 76 | 8 € | 19 € | 51 € | 2 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0637 Assistant formation informatique | 131 | 14 € | 34 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0638 Assistant formation en entreprise | 47 | 6 € | 16 € | 51 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0639 Coordinateur de formation | 189 | 22 € | 54 € | 42 € | 4 € | 37 € | 0.5× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0640 Analyste formation | 15 | 2 € | 4 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0641 Assistant évaluation des acquis | 37 | 4 € | 9 € | 78 € | 1 € | 77 € | 0.1× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0642 Assistant certification | 95 | 12 € | 29 € | 52 € | 2 € | 49 € | 0.2× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0643 Conseiller vie étudiante | 6515 | 609 € | 1 521 € | 159 € | 122 € | 37 € | **3.8×** | **3.7×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0644 Assistant inscriptions | 904 | 86 € | 215 € | 54 € | 17 € | 37 € | 1.6× ✗ | 1.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0645 Spécialiste adaptation de cours | 108 | 11 € | 26 € | 63 € | 2 € | 61 € | 0.2× ✗ | 0.0× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0646 Éditeur de contenus éducatifs | 185 | 19 € | 47 € | 81 € | 4 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0647 Assistant ingénierie pédagogique | 134 | 14 € | 35 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0648 Spécialiste organisation de la formation | 11 | 1 € | 4 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0649 Assistant gestion administrative de la formation | 875 | 87 € | 218 € | 55 € | 17 € | 37 € | 1.6× ✗ | 1.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0650 Responsable des opérations de formation | 8 | 1 € | 3 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0651 Consultant | 934 | 115 € | 288 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0652 Analyste métier | 1054 | 133 € | 333 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0653 Assistant recherche stratégique | 1054 | 119 € | 299 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0654 Market research consultant | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0655 Competitive intelligence consultant | 231 | 24 € | 59 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0656 Analyste processus | 1200 | 133 € | 332 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0657 Assistant consultant en organisation | 607 | 78 € | 194 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0658 Assistant transformation numérique | 909 | 113 € | 282 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0659 Assistant consultant référencement | 348 | 41 € | 103 € | 45 € | 8 € | 37 € | 0.9× ✗ | 0.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0660 Assistant consultant marketing | 306 | 36 € | 89 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0661 Assistant consultant e-commerce | 228 | 25 € | 62 € | 54 € | 5 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0662 Assistant conseil financier | 1200 | 161 € | 402 € | 82 € | 32 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0663 Assistant conseil RH | 604 | 63 € | 159 € | 62 € | 13 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0664 Assistant conseil achats | 604 | 84 € | 211 € | 66 € | 17 € | 49 € | 1.3× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0665 Assistant conseil données | 1054 | 119 € | 299 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0666 Assistant conseil technologique | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0667 Research consultant | 1054 | 112 € | 281 € | 100 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0668 Analyste études comparatives | 1200 | 154 € | 384 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0669 Analyste plans d'affaires | 1200 | 154 € | 384 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0670 Assistant consultant audit d'acquisition | 814 | 100 € | 250 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0671 Assistant bureau de gestion de projets | 86 | 12 € | 29 € | 40 € | 2 € | 37 € | 0.3× ✗ | 0.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0672 Reporting consultant | 306 | 36 € | 89 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0673 Process documentation consultant | 902 | 105 € | 263 € | 58 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0674 Analyste en conseil | 1200 | 133 € | 332 € | 104 € | 27 € | 77 € | 1.3× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0675 Responsable des opérations du cabinet de conseil | 206 | 22 € | 54 € | 41 € | 4 € | 37 € | 0.5× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0676 Secrétaire médical | 7324 | 685 € | 1 713 € | 187 € | 137 € | 49 € | **3.7×** | 1.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0677 Assistant médical administratif | 160 | 16 € | 41 € | 64 € | 3 € | 61 € | 0.3× ✗ | 0.0× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0678 Agent prise de rendez-vous médical | 13684 | 1 275 € | 3 188 € | 292 € | 255 € | 37 € | **4.4×** | **4.3×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0679 Agent accueil téléphonique médical | 14461 | 1 347 € | 3 369 € | 307 € | 270 € | 37 € | **4.4×** | **4.3×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0680 Transcripteur médical | 5104 | 544 € | 1 360 € | 158 € | 109 € | 49 € | **3.4×** | 1.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0681 Assistant dossier patient | 1565 | 147 € | 369 € | 91 € | 29 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0682 Agent rappels patients | 2263 | 211 € | 528 € | 79 € | 42 € | 37 € | 2.7× ✗ | 2.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0683 Agent facturation médicale | 185 | 20 € | 50 € | 53 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0684 Agent assurance maladie | 127 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0685 Agent codage administratif | 156 | 15 € | 37 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0686 Assistant cabinet médical | 374 | 36 € | 91 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0687 Assistant cabinet dentaire | 185 | 20 € | 50 € | 53 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0688 Assistant laboratoire administratif | 9360 | 875 € | 2 187 € | 224 € | 175 € | 49 € | **3.9×** | 2.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0689 Assistant clinique | 3090 | 291 € | 727 € | 108 € | 58 € | 49 € | 2.7× ✗ | 1.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0690 Agent coordination soins administratif | 1050 | 99 € | 248 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0691 Agent de préqualification administrative | 8220 | 767 € | 1 918 € | 191 € | 153 € | 37 € | **4.0×** | **3.9×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0692 Agent support patient | 5855 | 547 € | 1 368 € | 159 € | 109 € | 49 € | **3.4×** | 1.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0693 Agent suivi rendez-vous | 1540 | 147 € | 366 € | 66 € | 29 € | 37 € | 2.2× ✗ | 2.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0694 Agent documents médicaux | 6571 | 646 € | 1 615 € | 190 € | 129 € | 61 € | **3.4×** | 1.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0695 Agent gestion agenda médical | 2373 | 221 € | 553 € | 94 € | 44 € | 49 € | 2.4× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0696 Agent relation patient | 5731 | 534 € | 1 335 € | 156 € | 107 € | 49 € | **3.4×** | 1.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0697 Assistant télémédecine administratif | 211 | 21 € | 53 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0698 Secrétaire de cabinet médical | 795 | 77 € | 193 € | 53 € | 15 € | 37 € | 1.5× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0699 Assistant gestion d'établissement de santé | 21 | 3 € | 7 € | 78 € | 1 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0700 Responsable des opérations en établissement de santé | 11 | 1 € | 4 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0701 Assistant conducteur travaux | 1570 | 149 € | 373 € | 79 € | 30 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0702 Assistant chantier | 3694 | 352 € | 872 € | 132 € | 70 € | 61 € | 2.7× ✗ | 0.7× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0703 Assistant devis | 640 | 67 € | 167 € | 63 € | 13 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0704 Métré assistant | 1954 | 245 € | 613 € | 110 € | 49 € | 61 € | 2.2× ✗ | 0.5× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0705 Assistant appels d'offres BTP | 665 | 78 € | 194 € | 93 € | 16 € | 77 € | 0.8× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0706 Assistant planning chantier | 669 | 69 € | 174 € | 63 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0707 Assistant achats chantier | 947 | 89 € | 222 € | 67 € | 18 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0708 Assistant fournisseurs BTP | 18 | 2 € | 6 € | 50 € | 0 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0709 Assistant facturation chantier | 15 | 2 € | 4 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0710 Assistant administratif BTP | 769 | 72 € | 180 € | 52 € | 14 € | 37 € | 1.4× ✗ | 1.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0711 Assistant suivi sous-traitants | 1061 | 100 € | 251 € | 70 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0712 Assistant documents chantier | 2110 | 225 € | 561 € | 94 € | 45 € | 49 € | 2.4× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0713 Assistant conformité chantier | 1907 | 185 € | 464 € | 87 € | 37 € | 49 € | 2.1× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0714 Assistant qualité chantier | 497 | 56 € | 138 € | 72 € | 11 € | 61 € | 0.8× ✗ | 0.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0715 Assistant sécurité documentaire | 2383 | 231 € | 577 € | 83 € | 46 € | 37 € | 2.8× ✗ | 2.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0716 Assistant relation client BTP | 2974 | 279 € | 696 € | 105 € | 56 € | 49 € | 2.6× ✗ | 1.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0717 Assistant SAV BTP | 2731 | 255 € | 636 € | 112 € | 51 € | 61 € | 2.3× ✗ | 0.6× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0718 Assistant maintenance bâtiment | 2058 | 226 € | 565 € | 95 € | 45 € | 49 € | 2.4× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0719 Assistant patrimoine bâtiment | 1454 | 136 € | 340 € | 77 € | 27 € | 49 € | 1.8× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0720 Assistant services généraux et maintenance | 1358 | 128 € | 321 € | 75 € | 26 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0721 Assistant métreur | 902 | 112 € | 280 € | 100 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0722 Analyste des coûts de construction | 8 | 1 € | 3 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0723 Assistant chef de projet construction | 1371 | 163 € | 408 € | 82 € | 33 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0724 Spécialiste exploitation chantiers | 60 | 8 € | 20 € | 51 € | 2 € | 49 € | 0.2× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0725 Directeur des opérations travaux | 164 | 16 € | 40 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0726 Assistant plombier | 8310 | 986 € | 2 148 € | 258 € | 197 € | 61 € | **3.8×** | 1.6× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0727 Assistant électricien | 8550 | 1 049 € | 2 305 € | 271 € | 210 € | 61 € | **3.9×** | 1.7× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0728 Assistant peintre | 5820 | 782 € | 1 638 € | 218 € | 156 € | 61 € | **3.6×** | 1.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0729 Assistant maçon | 909 | 85 € | 212 € | 66 € | 17 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0730 Assistant menuisier | 2220 | 221 € | 552 € | 94 € | 44 € | 49 € | 2.4× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0731 Assistant couvreur | 1594 | 149 € | 372 € | 79 € | 30 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0732 Assistant chauffagiste | 5531 | 516 € | 1 289 € | 153 € | 103 € | 49 € | **3.4×** | 1.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0733 Assistant climatisation | 3516 | 540 € | 1 032 € | 169 € | 108 € | 61 € | **3.2×** | 1.0× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0734 Assistant serrurier | 10470 | 1 110 € | 2 774 € | 283 € | 222 € | 61 € | **3.9×** | 1.7× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0735 Assistant vitrier | 6300 | 587 € | 1 468 € | 179 € | 117 € | 61 € | **3.3×** | 1.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0736 Assistant carreleur | 909 | 92 € | 230 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0737 Assistant plaquiste | 1384 | 153 € | 349 € | 92 € | 31 € | 61 € | 1.7× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0738 Assistant façadier | 694 | 88 € | 187 € | 79 € | 18 € | 61 € | 1.1× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0739 Assistant isolation | 665 | 70 € | 176 € | 91 € | 14 € | 77 € | 0.8× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0740 Assistant multiservice | 1536 | 150 € | 376 € | 80 € | 30 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0741 Agent devis artisan | 1261 | 154 € | 385 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0742 Agent planning artisan | 1595 | 149 € | 372 € | 79 € | 30 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0743 Agent SAV artisan | 1501 | 140 € | 350 € | 89 € | 28 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0744 Agent relance artisan | 425 | 41 € | 103 € | 58 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0745 Agent acquisition artisan | 2077 | 244 € | 576 € | 98 € | 49 € | 49 € | 2.5× ✗ | 0.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0746 Agent qualification chantier | 1530 | 165 € | 378 € | 94 € | 33 € | 61 € | 1.8× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0747 Agent suivi intervention | 334 | 40 € | 93 € | 69 € | 8 € | 61 € | 0.6× ✗ | 0.1× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0748 Agent facturation artisan | 811 | 92 € | 231 € | 68 € | 18 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0749 Agent avis clients artisan | 940 | 89 € | 222 € | 67 € | 18 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0750 Gérant d'entreprise artisanale | 160 | 15 € | 38 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0751 Assistant jardinier | 309 | 32 € | 79 € | 56 € | 6 € | 49 € | 0.6× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0752 Assistant paysagiste | 1200 | 133 € | 332 € | 88 € | 27 € | 61 € | 1.5× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0753 Agent devis jardinage | 1080 | 123 € | 307 € | 74 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0754 Agent planning jardinage | 846 | 79 € | 198 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0755 Agent qualification jardinage | 1530 | 172 € | 396 € | 96 € | 34 € | 61 € | 1.8× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0756 Agent suivi chantier paysager | 811 | 88 € | 214 € | 79 € | 18 € | 61 € | 1.1× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0757 Agent relation client jardinage | 1471 | 137 € | 343 € | 89 € | 27 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0758 Agent relance jardinage | 251 | 24 € | 59 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0759 Agent acquisition clients jardinage | 1358 | 127 € | 317 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0760 Agent réservation jardinier | 1831 | 172 € | 430 € | 84 € | 34 € | 49 € | 2.0× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0761 Agent calcul durée intervention | 782 | 95 € | 238 € | 69 € | 19 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0762 Agent calcul matériel jardinage | 189 | 22 € | 55 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0763 Agent facturation jardinage | 215 | 23 € | 57 € | 82 € | 5 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0764 Agent suivi saisonnier | 164 | 15 € | 38 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0765 Agent entretien contrats | 157 | 22 € | 55 € | 81 € | 4 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0766 Agent gestion tournées jardinage | 1565 | 181 € | 452 € | 86 € | 36 € | 49 € | 2.1× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0767 Agent météo chantier jardinage | 127 | 12 € | 30 € | 52 € | 2 € | 49 € | 0.2× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0768 Agent catalogue végétaux | 157 | 15 € | 37 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0769 Agent conseil plantation administratif | 1200 | 119 € | 297 € | 101 € | 24 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0770 Agent SAV jardinage | 1501 | 162 € | 372 € | 94 € | 32 € | 61 € | 1.7× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0771 Agent avis clients jardinage | 1354 | 177 € | 377 € | 97 € | 35 € | 61 € | 1.8× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0772 Agent recrutement jardiniers | 636 | 61 € | 152 € | 62 € | 12 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0773 Agent matching jardiniers | 247 | 23 € | 58 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0774 Agent opérations paysagisme | 1290 | 129 € | 321 € | 87 € | 26 € | 61 € | 1.5× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0775 Responsable d'exploitation paysagiste | 11 | 1 € | 4 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0776 Assistant entreprise nettoyage | 1050 | 99 € | 248 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0777 Agent devis nettoyage | 1200 | 154 € | 384 € | 108 € | 31 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0778 Agent planning nettoyage | 21 | 3 € | 6 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0779 Agent qualification nettoyage | 1054 | 105 € | 263 € | 82 € | 21 € | 61 € | 1.3× ✗ | 0.2× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0780 Agent affectation intervenants | 1808 | 169 € | 422 € | 83 € | 34 € | 49 € | 2.0× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0781 Agent suivi intervention | 4540 | 499 € | 1 247 € | 137 € | 100 € | 37 € | **3.6×** | **3.5×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0782 Agent relation client nettoyage | 1660 | 155 € | 387 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0783 Agent relance nettoyage | 105 | 12 € | 29 € | 40 € | 2 € | 37 € | 0.3× ✗ | 0.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0784 Agent acquisition nettoyage | 348 | 48 € | 121 € | 59 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0785 Agent réservation nettoyage | 5254 | 557 € | 1 392 € | 149 € | 111 € | 37 € | **3.8×** | **3.6×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0786 Agent facturation nettoyage | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0787 Agent contrats nettoyage | 1802 | 217 € | 542 € | 120 € | 43 € | 77 € | 1.8× ✗ | 0.5× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0788 Agent renouvellement nettoyage | 1206 | 126 € | 316 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0789 Agent contrôle qualité administratif | 2404 | 280 € | 700 € | 117 € | 56 € | 61 € | 2.4× ✗ | 0.6× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0790 Agent gestion consommables | 15 | 2 € | 5 € | 38 € | 0 € | 37 € | 0.1× ✗ | 0.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0791 Agent gestion tournées | 912 | 120 € | 301 € | 74 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0792 Agent recrutement agents nettoyage | 1090 | 131 € | 328 € | 76 € | 26 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0793 Agent matching nettoyeurs | 326 | 38 € | 95 € | 57 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0794 Agent SAV nettoyage | 1656 | 161 € | 403 € | 82 € | 32 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0795 Agent avis clients nettoyage | 1504 | 140 € | 351 € | 65 € | 28 € | 37 € | 2.1× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0796 Agent B2B nettoyage | 785 | 103 € | 257 € | 98 € | 21 € | 77 € | 1.1× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0797 Agent B2C nettoyage | 1656 | 190 € | 474 € | 87 € | 38 € | 49 € | 2.2× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0798 Agent planning récurrent | 8563 | 800 € | 1 999 € | 197 € | 160 € | 37 € | **4.1×** | **3.9×** | 34 € | S (1/bundle) | 2 800 € |
| AG-0799 Chargé d'exploitation propreté | 15 | 2 € | 5 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0800 Responsable d'exploitation propreté | 18 | 2 € | 5 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0801 Assistant garage | 7174 | 670 € | 1 675 € | 183 € | 134 € | 49 € | **3.6×** | 1.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0802 Agent prise de rendez-vous garage | 2469 | 230 € | 576 € | 83 € | 46 € | 37 € | 2.8× ✗ | 2.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0803 Agent qualification panne | 3450 | 321 € | 804 € | 114 € | 64 € | 49 € | 2.8× ✗ | 1.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0804 Agent collecte photos véhicule | 3450 | 321 € | 804 € | 125 € | 64 € | 61 € | 2.6× ✗ | 0.7× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0805 Agent devis automobile | 1355 | 147 € | 368 € | 107 € | 29 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0806 Agent planning atelier | 904 | 122 € | 305 € | 74 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0807 Agent commande pièces | 3305 | 339 € | 847 € | 117 € | 68 € | 49 € | 2.9× ✗ | 1.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0808 Agent suivi réparation | 1951 | 217 € | 542 € | 81 € | 43 € | 37 € | 2.7× ✗ | 2.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0809 Agent relation client garage | 1235 | 122 € | 306 € | 74 € | 24 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0810 Agent relance entretien | 18 | 2 € | 5 € | 38 € | 0 € | 37 € | 0.1× ✗ | 0.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0811 Agent rappel contrôle technique | 792 | 110 € | 275 € | 59 € | 22 € | 37 € | 1.9× ✗ | 1.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0812 Agent facturation garage | 901 | 90 € | 224 € | 67 € | 18 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0813 Agent SAV automobile | 1206 | 112 € | 281 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0814 Agent garantie automobile | 1206 | 134 € | 334 € | 104 € | 27 € | 77 € | 1.3× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0815 Agent recherche pièces | 909 | 92 € | 230 € | 95 € | 18 € | 77 € | 1.0× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0816 Agent comparaison fournisseurs pièces | 21 | 3 € | 7 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0817 Agent gestion flotte garage | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0818 Agent suivi maintenance flotte | 11 | 2 € | 4 € | 37 € | 0 € | 37 € | 0.0× ✗ | 0.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0819 Agent acquisition garage | 610 | 57 € | 143 € | 61 € | 11 € | 49 € | 0.9× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0820 Agent avis clients garage | 632 | 60 € | 151 € | 49 € | 12 € | 37 € | 1.2× ✗ | 1.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0821 Agent support atelier | 6124 | 579 € | 1 448 € | 165 € | 116 € | 49 € | **3.5×** | 1.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0822 Agent estimation réparation assistant | 2553 | 273 € | 682 € | 104 € | 55 € | 49 € | 2.6× ✗ | 1.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0823 Agent documentation technique automobile | 44 | 4 € | 11 € | 78 € | 1 € | 77 € | 0.1× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0824 Chargé d'exploitation après-vente automobile | 21 | 3 € | 7 € | 78 € | 1 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0825 Directeur après-vente automobile | 15 | 2 € | 4 € | 77 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0826 Agent état des lieux | 1500 | 196 € | 489 € | 100 € | 39 € | 61 € | 1.9× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0827 Agent collecte documents immobiliers | 1564 | 161 € | 403 € | 82 € | 32 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0828 Agent dossier location | 1950 | 203 € | 507 € | 90 € | 41 € | 49 € | 2.3× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0829 Agent dossier vente | 1089 | 117 € | 292 € | 73 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0830 Agent suivi notaire | 823 | 84 € | 210 € | 66 € | 17 € | 49 € | 1.3× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0831 Agent relance documents | 515 | 55 € | 138 € | 48 € | 11 € | 37 € | 1.1× ✗ | 1.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0832 Agent qualification locataire | 1234 | 115 € | 288 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0833 Agent qualification acheteur | 755 | 78 € | 194 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0834 Agent qualification vendeur | 901 | 98 € | 245 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0835 Agent préparation compromis assistant | 1050 | 112 € | 280 € | 99 € | 22 € | 77 € | 1.1× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0836 Agent suivi signature | 810 | 82 € | 206 € | 66 € | 16 € | 49 € | 1.3× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0837 Agent gestion diagnostics | 2105 | 231 € | 578 € | 96 € | 46 € | 49 € | 2.4× ✗ | 0.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0838 Agent suivi travaux immobilier | 1380 | 136 € | 339 € | 88 € | 27 € | 61 € | 1.5× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0839 Agent gestion sinistres immobilier | 1209 | 148 € | 369 € | 91 € | 30 € | 61 € | 1.6× ✗ | 0.3× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-0840 Agent relation syndic | 1085 | 103 € | 256 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0841 Agent relation copropriété | 936 | 89 € | 222 € | 95 € | 18 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0842 Agent convocations | 1050 | 119 € | 297 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0843 Agent comptes rendus copropriété | 1500 | 154 € | 384 € | 108 € | 31 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0844 Agent appels de charges assistant | 454 | 56 € | 141 € | 61 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0845 Agent suivi prestataires immobilier | 904 | 98 € | 246 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0846 Agent maintenance locative | 1205 | 119 € | 299 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0847 Agent réclamation locataire | 1234 | 115 € | 288 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0848 Agent reporting patrimoine | 7 | 1 € | 2 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0849 Assistant juridique immobilier | 610 | 64 € | 160 € | 90 € | 13 € | 77 € | 0.7× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0850 Responsable de gestion immobilière | 159 | 22 € | 56 € | 82 € | 4 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0851 Agent support SaaS | 1089 | 103 € | 258 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0852 Agent support e-commerce | 1085 | 101 € | 253 € | 70 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0853 Agent support marketplace | 1231 | 116 € | 290 € | 73 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0854 Agent support logiciel | 1500 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0855 Agent support télécom | 1234 | 115 € | 288 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0856 Agent support énergie | 1652 | 189 € | 472 € | 87 € | 38 € | 49 € | 2.2× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0857 Agent support banque | 1500 | 140 € | 349 € | 105 € | 28 € | 77 € | 1.3× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0858 Agent support assurance | 1804 | 168 € | 421 € | 111 € | 34 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0859 Agent support voyage | 4924 | 459 € | 1 148 € | 141 € | 92 € | 49 € | **3.3×** | 1.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0860 Agent support immobilier | 1830 | 172 € | 430 € | 84 € | 34 € | 49 € | 2.0× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0861 Agent support automobile | 1351 | 133 € | 332 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0862 Agent support santé administratif | 1234 | 122 € | 305 € | 74 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0863 Agent support formation | 1234 | 117 € | 292 € | 73 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0864 Agent support B2B | 2492 | 232 € | 581 € | 96 € | 46 € | 49 € | 2.4× ✗ | 0.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0865 Agent support abonnement | 1380 | 136 € | 339 € | 77 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0866 Agent support facturation | 1202 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0867 Agent support livraison | 1114 | 105 € | 263 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0868 Agent support retours | 1681 | 157 € | 392 € | 81 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0869 Agent support technique niveau 1 | 2070 | 226 € | 566 € | 82 € | 45 € | 37 € | 2.8× ✗ | 2.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-0870 Agent support technique niveau 2 | 1050 | 98 € | 245 € | 97 € | 20 € | 77 € | 1.0× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0871 Agent réclamation | 1231 | 116 € | 290 € | 100 € | 23 € | 77 € | 1.2× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0872 Agent fidélisation | 1202 | 112 € | 280 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0873 Agent renouvellement | 755 | 84 € | 211 € | 66 € | 17 € | 49 € | 1.3× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-0874 Responsable réussite client | 312 | 29 € | 73 € | 83 € | 6 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0875 Responsable du service client | 43 | 6 € | 14 € | 78 € | 1 € | 77 € | 0.1× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-0876 Assistant du dirigeant | 103 | 10 € | 24 € | 48 € | 2 € | 46 € | 0.2× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0877 Assistant du directeur des opérations | 51 | 7 € | 17 € | 45 € | 1 € | 44 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0878 Assistant du directeur administratif et financier | 38 | 4 € | 10 € | 47 € | 1 € | 46 € | 0.1× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0879 Assistant du directeur technique | 38 | 5 € | 13 € | 47 € | 1 € | 46 € | 0.1× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0880 Assistant du directeur marketing | 608 | 85 € | 212 € | 61 € | 17 € | 44 € | 1.4× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0881 Assistant de direction générale | 695 | 65 € | 162 € | 57 € | 13 € | 44 € | 1.1× ✗ | 1.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0882 Assistant préparation des réunions | 3600 | 363 € | 908 € | 117 € | 73 € | 44 € | **3.1×** | 3.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0883 Assistant documentaliste | 900 | 98 € | 245 € | 72 € | 20 € | 52 € | 1.4× ✗ | 0.2× ✗ | 52 € | XL (11/bundle) | 2 800 € |
| AG-0884 Assistant aide à la décision | 900 | 105 € | 262 € | 63 € | 21 € | 42 € | 1.7× ✗ | 0.2× ✗ | 42 € | XL (15/bundle) | 2 800 € |
| AG-0885 Assistant suivi des objectifs | 13 | 1 € | 4 € | 36 € | 0 € | 35 € | 0.0× ✗ | 0.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0886 Assistant chef de projet | 77 | 10 € | 26 € | 46 € | 2 € | 44 € | 0.2× ✗ | 0.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0887 Assistant bureau des projets | 19 | 2 € | 5 € | 39 € | 0 € | 39 € | 0.1× ✗ | 0.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0888 Task management agent | 9000 | 839 € | 2 097 € | 202 € | 168 € | 35 € | **4.1×** | **4.0×** | 26 € | S (1/bundle) | 2 800 € |
| AG-0889 Documentation agent | 634 | 59 € | 148 € | 51 € | 12 € | 39 € | 1.2× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0890 Knowledge management agent | 162 | 15 € | 38 € | 42 € | 3 € | 39 € | 0.4× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0891 Agent recherche documentaire interne | 900 | 84 € | 210 € | 66 € | 17 € | 49 € | 1.3× ✗ | 1.2× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-0892 Company wiki agent | 13 | 2 € | 4 € | 35 € | 0 € | 35 € | 0.0× ✗ | 0.0× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0893 Assistant procédures internes | 641 | 60 € | 150 € | 48 € | 12 € | 35 € | 1.3× ✗ | 1.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0894 Process automation agent | 511 | 49 € | 123 € | 54 € | 10 € | 44 € | 0.9× ✗ | 0.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0895 Analyste des flux de travail | 900 | 112 € | 280 € | 61 € | 22 € | 39 € | 1.8× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0896 Assistant organisation de l'entreprise | 38 | 5 € | 13 € | 40 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0897 Assistant reporting de direction | 6 | 1 € | 2 € | 39 € | 0 € | 39 € | 0.0× ✗ | 0.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0898 Management reporting agent | 6 | 1 € | 2 € | 39 € | 0 € | 39 € | 0.0× ✗ | 0.0× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0899 Analyste organisation et méthodes | 13 | 2 € | 4 € | 44 € | 0 € | 44 € | 0.0× ✗ | 0.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0900 Responsable des opérations IA | 223 | 31 € | 78 € | 45 € | 6 € | 39 € | 0.7× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0901 Assistant événementiel | 750 | 99 € | 248 € | 55 € | 20 € | 35 € | 1.8× ✗ | 1.6× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0902 Assistant organisateur d'événements | 300 | 29 € | 73 € | 36 € | 6 € | 30 € | 0.8× ✗ | 0.6× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0903 Agent réservation salle | 1230 | 150 € | 374 € | 65 € | 30 € | 35 € | 2.3× ✗ | 2.0× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0904 Agent inscription participants | 1560 | 180 € | 451 € | 71 € | 36 € | 35 € | 2.5× ✗ | 2.3× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0905 Agent invitations | 1230 | 115 € | 287 € | 58 € | 23 € | 35 € | 2.0× ✗ | 1.7× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0906 Agent relance participants | 750 | 71 € | 178 € | 45 € | 14 € | 30 € | 1.6× ✗ | 1.2× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0907 Agent gestion intervenants | 420 | 41 € | 101 € | 43 € | 8 € | 35 € | 0.9× ✗ | 0.8× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0908 Agent gestion fournisseurs | 1680 | 219 € | 549 € | 79 € | 44 € | 35 € | 2.8× ✗ | 2.5× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0909 Agent planning événement | 630 | 74 € | 185 € | 45 € | 15 € | 30 € | 1.6× ✗ | 1.3× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0910 Agent budget événement | 1560 | 217 € | 542 € | 74 € | 43 € | 30 € | 2.9× ✗ | 2.3× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0911 Agent devis événement | 1230 | 137 € | 342 € | 63 € | 27 € | 35 € | 2.2× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0912 Agent communication événement | 540 | 64 € | 161 € | 52 € | 13 € | 39 € | 1.2× ✗ | 1.1× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0913 Agent emailing événement | 660 | 63 € | 157 € | 47 € | 13 € | 35 € | 1.3× ✗ | 1.1× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0914 Agent d'accueil numérique | 4740 | 442 € | 1 104 € | 128 € | 88 € | 39 € | **3.5×** | **3.4×** | 28 € | S (1/bundle) | 2 800 € |
| AG-0915 Agent FAQ événement | 870 | 82 € | 206 € | 47 € | 16 € | 30 € | 1.8× ✗ | 1.4× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0916 Agent support billetterie | 1800 | 176 € | 440 € | 74 € | 35 € | 39 € | 2.4× ✗ | 2.2× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0917 Agent sponsors | 540 | 73 € | 182 € | 53 € | 15 € | 39 € | 1.4× ✗ | 1.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0918 Agent partenaires | 390 | 45 € | 112 € | 39 € | 9 € | 30 € | 1.1× ✗ | 0.8× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0919 Agent reporting événement | 750 | 91 € | 227 € | 49 € | 18 € | 30 € | 1.9× ✗ | 1.3× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0920 Agent post-event survey | 900 | 91 € | 227 € | 49 € | 18 € | 30 € | 1.9× ✗ | 1.3× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0921 Agent gestion hôtels participants | 1680 | 212 € | 531 € | 77 € | 42 € | 35 € | 2.8× ✗ | 2.5× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0922 Agent transport participants | 900 | 98 € | 245 € | 54 € | 20 € | 35 € | 1.8× ✗ | 1.6× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0923 Assistant régie événementielle | 540 | 59 € | 147 € | 47 € | 12 € | 35 € | 1.3× ✗ | 1.1× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0924 Chargé de promotion d'événements | 660 | 75 € | 189 € | 54 € | 15 € | 39 € | 1.4× ✗ | 1.3× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0925 Directeur de production événementielle | 784 | 89 € | 222 € | 68 € | 18 € | 51 € | 1.3× ✗ | 1.3× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0926 Assistant association | 514 | 69 € | 172 € | 49 € | 14 € | 35 € | 1.4× ✗ | 1.2× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0927 Agent adhésions | 365 | 41 € | 103 € | 43 € | 8 € | 35 € | 1.0× ✗ | 0.8× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0928 Agent dons | 220 | 28 € | 69 € | 40 € | 6 € | 35 € | 0.7× ✗ | 0.6× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0929 Agent bénévoles | 77 | 8 € | 19 € | 36 € | 2 € | 35 € | 0.2× ✗ | 0.2× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0930 Agent événements | 489 | 60 € | 150 € | 47 € | 12 € | 35 € | 1.3× ✗ | 1.1× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0931 Agent newsletter | 456 | 43 € | 106 € | 43 € | 9 € | 35 € | 1.0× ✗ | 0.8× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0932 Agent relation adhérents | 103 | 10 € | 24 € | 37 € | 2 € | 35 € | 0.3× ✗ | 0.2× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0933 Agent support membres | 154 | 14 € | 36 € | 42 € | 3 € | 39 € | 0.3× ✗ | 0.3× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0934 Agent collecte de documents | 223 | 22 € | 55 € | 43 € | 4 € | 39 € | 0.5× ✗ | 0.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0935 Agent facturation association | 340 | 46 € | 115 € | 44 € | 9 € | 35 € | 1.0× ✗ | 0.9× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0936 Agent comptabilité association assistant | 191 | 25 € | 62 € | 49 € | 5 € | 44 € | 0.5× ✗ | 0.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0937 Agent subventions | 460 | 57 € | 142 € | 50 € | 11 € | 39 € | 1.1× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0938 Agent recherche financements | 340 | 39 € | 97 € | 47 € | 8 € | 39 € | 0.8× ✗ | 0.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0939 Agent reporting association | 453 | 56 € | 141 € | 42 € | 11 € | 30 € | 1.4× ✗ | 1.0× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0940 Agent communication association | 605 | 70 € | 176 € | 49 € | 14 € | 35 € | 1.4× ✗ | 1.2× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0941 Agent réseaux sociaux association | 71 | 7 € | 17 € | 63 € | 1 € | 62 € | 0.1× ✗ | 0.1× ✗ | 45 € | M (2/bundle) | 2 800 € |
| AG-0942 Agent CRM association | 48 | 4 € | 11 € | 36 € | 1 € | 35 € | 0.1× ✗ | 0.1× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0943 Agent gestion campagnes | 780 | 87 € | 217 € | 57 € | 17 € | 39 € | 1.5× ✗ | 1.4× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0944 Agent inscription activités | 129 | 12 € | 30 € | 37 € | 2 € | 35 € | 0.3× ✗ | 0.3× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0945 Agent réservation activités | 151 | 16 € | 39 € | 38 € | 3 € | 35 € | 0.4× ✗ | 0.3× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0946 Agent suivi bénévoles | 307 | 36 € | 89 € | 37 € | 7 € | 30 € | 0.9× ✗ | 0.7× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0947 Agent recrutement bénévoles | 511 | 48 € | 119 € | 44 € | 10 € | 35 € | 1.1× ✗ | 0.9× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0948 Agent gestion partenaires | 460 | 57 € | 143 € | 42 € | 11 € | 30 € | 1.4× ✗ | 1.0× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0949 Chargé de gestion associative | 194 | 19 € | 49 € | 39 € | 4 € | 35 € | 0.5× ✗ | 0.4× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0950 Directeur d'association | 305 | 36 € | 89 € | 43 € | 7 € | 35 € | 0.8× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0951 Assistant visa | 514 | 55 € | 137 € | 55 € | 11 € | 44 € | 1.0× ✗ | 0.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0952 Agent collecte documents visa | 394 | 37 € | 92 € | 46 € | 7 € | 39 € | 0.8× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0953 Agent suivi dossier visa | 249 | 23 € | 58 € | 39 € | 5 € | 35 € | 0.6× ✗ | 0.5× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0954 Agent formulaire administratif | 900 | 98 € | 245 € | 64 € | 20 € | 44 € | 1.5× ✗ | 1.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0955 Agent traduction dossier | 754 | 77 € | 193 € | 66 € | 15 € | 51 € | 1.2× ✗ | 1.2× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0956 Agent prise de rendez-vous consulaire | 394 | 44 € | 109 € | 44 € | 9 € | 35 € | 1.0× ✗ | 0.8× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0957 Agent checklist immigration | 751 | 84 € | 210 € | 56 € | 17 € | 39 € | 1.5× ✗ | 1.2× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0958 Agent suivi échéances | 51 | 5 € | 12 € | 31 € | 1 € | 30 € | 0.1× ✗ | 0.1× ✗ | 24 € | S (2/bundle) | 2 800 € |
| AG-0959 Agent notification dossier | 154 | 14 € | 36 € | 38 € | 3 € | 35 € | 0.4× ✗ | 0.3× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0960 Agent recherche informations réglementaires | 463 | 43 € | 108 € | 55 € | 9 € | 46 € | 0.8× ✗ | 0.1× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0961 Agent dossier expatriation | 754 | 91 € | 228 € | 57 € | 18 € | 39 € | 1.6× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0962 Agent dossier relocation | 754 | 91 € | 228 € | 57 € | 18 € | 39 € | 1.6× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0963 Agent logement expatrié | 780 | 80 € | 199 € | 67 € | 16 € | 51 € | 1.2× ✗ | 1.2× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0964 Agent services expatrié | 754 | 84 € | 211 € | 52 € | 17 € | 35 € | 1.6× ✗ | 1.4× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0965 Agent assurance expatrié | 751 | 91 € | 227 € | 54 € | 18 € | 35 € | 1.7× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0966 Agent voyage administratif | 754 | 91 € | 228 € | 57 € | 18 € | 39 € | 1.6× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0967 Agent support expatriation | 274 | 26 € | 64 € | 44 € | 5 € | 39 € | 0.6× ✗ | 0.5× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0968 Chargé d'installation des expatriés | 369 | 41 € | 103 € | 43 € | 8 € | 35 € | 1.0× ✗ | 0.8× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0969 Agent onboarding expatrié | 317 | 37 € | 91 € | 42 € | 7 € | 35 € | 0.9× ✗ | 0.7× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0970 Agent renouvellement documents | 609 | 57 € | 142 € | 46 € | 11 € | 35 € | 1.2× ✗ | 1.0× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0971 Assistant conformité immigration | 165 | 23 € | 56 € | 48 € | 5 € | 44 € | 0.5× ✗ | 0.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0972 Agent mobilité internationale | 336 | 32 € | 79 € | 42 € | 6 € | 35 € | 0.8× ✗ | 0.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0973 Agent documents de voyage | 314 | 29 € | 73 € | 38 € | 6 € | 32 € | 0.8× ✗ | 0.5× ✗ | 37 € | S (2/bundle) | 2 800 € |
| AG-0974 Spécialiste mobilité internationale | 220 | 22 € | 55 € | 39 € | 4 € | 35 € | 0.6× ✗ | 0.5× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0975 Responsable mobilité internationale | 155 | 15 € | 37 € | 38 € | 3 € | 35 € | 0.4× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0976 Assistant énergie | 197 | 19 € | 46 € | 43 € | 4 € | 39 € | 0.4× ✗ | 0.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0977 Agent suivi consommation | 125 | 13 € | 33 € | 44 € | 3 € | 41 € | 0.3× ✗ | 0.3× ✗ | 29 € | S (1/bundle) | 2 800 € |
| AG-0978 Agent analyse factures énergie | 197 | 26 € | 64 € | 56 € | 5 € | 51 € | 0.5× ✗ | 0.5× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0979 Agent comparaison fournisseurs énergie | 900 | 105 € | 262 € | 60 € | 21 € | 39 € | 1.8× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0980 Agent devis énergie | 900 | 91 € | 227 € | 69 € | 18 € | 51 € | 1.3× ✗ | 1.3× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0981 Agent planification intervention | 724 | 70 € | 176 € | 53 € | 14 € | 39 € | 1.3× ✗ | 1.2× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0982 Agent maintenance énergie | 194 | 25 € | 63 € | 44 € | 5 € | 39 € | 0.6× ✗ | 0.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0983 Agent relation client énergie | 151 | 14 € | 35 € | 44 € | 3 € | 41 € | 0.3× ✗ | 0.3× ✗ | 29 € | S (1/bundle) | 2 800 € |
| AG-0984 Agent qualification travaux énergie | 754 | 70 € | 176 € | 65 € | 14 € | 51 € | 1.1× ✗ | 1.1× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-0985 Agent suivi contrats énergie | 162 | 22 € | 56 € | 40 € | 4 € | 35 € | 0.6× ✗ | 0.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0986 Agent reporting carbone | 751 | 84 € | 210 € | 63 € | 17 € | 46 € | 1.3× ✗ | 0.2× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0987 Agent collecte données ESG | 343 | 32 € | 80 € | 46 € | 6 € | 39 € | 0.7× ✗ | 0.6× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0988 Agent reporting ESG | 900 | 112 € | 280 € | 69 € | 22 € | 46 € | 1.6× ✗ | 0.3× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-0989 Agent documentation environnement | 165 | 22 € | 56 € | 48 € | 4 € | 44 € | 0.5× ✗ | 0.4× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0990 Agent veille réglementaire environnement | 18 | 2 € | 5 € | 43 € | 0 € | 43 € | 0.1× ✗ | 0.0× ✗ | 43 € | XL (15/bundle) | 2 800 € |
| AG-0991 Agent analyse consommation bâtiment | 38 | 5 € | 13 € | 45 € | 1 € | 44 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0992 Agent optimisation énergétique assistant | 6 | 1 € | 2 € | 39 € | 0 € | 39 € | 0.0× ✗ | 0.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0993 Agent conformité environnementale assistant | 44 | 4 € | 11 € | 36 € | 1 € | 35 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0994 Agent reporting déchets | 42 | 6 € | 14 € | 40 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-0995 Agent suivi recyclage | 16 | 2 € | 5 € | 35 € | 0 € | 35 € | 0.1× ✗ | 0.0× ✗ | 26 € | S (1/bundle) | 2 800 € |
| AG-0996 Agent gestion fournisseurs énergie | 42 | 5 € | 13 € | 40 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-0997 Agent opérations énergie | 150 | 18 € | 45 € | 38 € | 4 € | 34 € | 0.5× ✗ | 0.4× ✗ | 31 € | S (1/bundle) | 2 800 € |
| AG-0998 Analyste données énergétiques | 154 | 17 € | 43 € | 45 € | 3 € | 41 € | 0.4× ✗ | 0.4× ✗ | 29 € | S (1/bundle) | 2 800 € |
| AG-0999 Chargé d'exploitation énergie | 45 | 6 € | 14 € | 45 € | 1 € | 44 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1000 Responsable d'exploitation énergie | 19 | 2 € | 5 € | 47 € | 0 € | 46 € | 0.0× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-1001 Assistant production | 390 | 48 € | 119 € | 59 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1002 Assistant maintenance | 674 | 66 € | 165 € | 63 € | 13 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1003 Agent planning production | 253 | 27 € | 67 € | 82 € | 5 € | 77 € | 0.3× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1004 Agent ordonnancement | 845 | 83 € | 208 € | 94 € | 17 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1005 Agent achats industriels | 512 | 65 € | 161 € | 90 € | 13 € | 77 € | 0.7× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1006 Agent fournisseurs industriels | 616 | 58 € | 145 € | 61 € | 12 € | 49 € | 0.9× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1007 Agent qualité documentaire | 645 | 62 € | 155 € | 89 € | 12 € | 77 € | 0.7× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1008 Agent traçabilité | 281 | 39 € | 97 € | 85 € | 8 € | 77 € | 0.5× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1009 Agent documentation technique | 2134 | 263 € | 658 € | 102 € | 53 € | 49 € | 2.6× ✗ | 1.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1010 Agent reporting production | 72 | 9 € | 21 € | 51 € | 2 € | 49 € | 0.2× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1011 Agent stocks industriels | 616 | 58 € | 145 € | 61 € | 12 € | 49 € | 0.9× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1012 Agent approvisionnement | 126 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1013 Agent planification maintenance | 23 | 3 € | 7 € | 50 € | 1 € | 49 € | 0.1× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1014 Agent suivi incidents | 820 | 114 € | 286 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1015 Agent gestion ordres de travail | 725 | 101 € | 253 € | 70 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1016 Agent conformité documentaire | 616 | 86 € | 215 € | 94 € | 17 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1017 Agent qualité fournisseur | 1357 | 190 € | 474 € | 99 € | 38 € | 61 € | 1.9× ✗ | 0.4× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-1018 Agent gestion pièces détachées | 642 | 88 € | 221 € | 67 € | 18 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1019 Agent relation clients industriels | 1295 | 124 € | 309 € | 74 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1020 Agent devis industriel | 1804 | 182 € | 456 € | 114 € | 36 € | 77 € | 1.6× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1021 Agent commande industrielle | 2490 | 291 € | 727 € | 108 € | 58 € | 49 € | 2.7× ✗ | 1.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1022 Agent support SAV industriel | 2461 | 287 € | 717 € | 107 € | 57 € | 49 € | 2.7× ✗ | 1.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1023 Agent analyse performance industrielle | 163 | 16 € | 39 € | 80 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1024 Responsable amélioration continue | 308 | 43 € | 107 € | 86 € | 9 € | 77 € | 0.5× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1025 Directeur des opérations industrielles | 17 | 2 € | 6 € | 78 € | 0 € | 77 € | 0.0× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1026 Assistant éditeur | 279 | 36 € | 90 € | 59 € | 7 € | 52 € | 0.6× ✗ | 0.2× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1027 Correcteur | 1050 | 126 € | 314 € | 112 € | 25 € | 87 € | 1.1× ✗ | 0.3× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1028 Relecteur | 1050 | 126 € | 314 € | 112 € | 25 € | 87 € | 1.1× ✗ | 0.3× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1029 Rédacteur technique | 1209 | 127 € | 317 € | 77 € | 25 € | 52 € | 1.6× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1030 Rédacteur documentation | 315 | 37 € | 91 € | 59 € | 7 € | 52 € | 0.6× ✗ | 0.2× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1031 Assistant recherche | 1050 | 105 € | 262 € | 108 € | 21 € | 87 € | 1.0× ✗ | 0.2× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1032 Assistant de recherche documentaire | 169 | 23 € | 59 € | 57 € | 5 € | 52 € | 0.4× ✗ | 0.1× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1033 Vérificateur de faits | 1050 | 126 € | 314 € | 112 € | 25 € | 87 € | 1.1× ✗ | 0.3× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1034 Assistant bibliographie | 901 | 105 € | 262 € | 73 € | 21 € | 52 € | 1.4× ✗ | 0.4× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1035 Indexeur | 762 | 71 € | 178 € | 66 € | 14 € | 52 € | 1.1× ✗ | 0.3× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1036 Gestionnaire de métadonnées | 1082 | 109 € | 273 € | 109 € | 22 € | 87 € | 1.0× ✗ | 0.3× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1037 Éditeur de contenus | 930 | 102 € | 255 € | 108 € | 20 € | 87 € | 0.9× ✗ | 0.2× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1038 Veilleur de contenus | 246 | 33 € | 82 € | 58 € | 7 € | 52 € | 0.6× ✗ | 0.1× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1039 Newsletter editor | 52 | 5 € | 13 € | 53 € | 1 € | 52 € | 0.1× ✗ | 0.0× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1040 Knowledge base editor | 914 | 86 € | 214 € | 69 € | 17 € | 52 € | 1.2× ✗ | 0.4× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1041 Responsable documentation | 14 | 1 € | 4 € | 52 € | 0 € | 52 € | 0.0× ✗ | 0.0× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1042 Rédacteur de documentation technique | 312 | 36 € | 91 € | 95 € | 7 € | 87 € | 0.4× ✗ | 0.1× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1043 Spécialiste adaptation de contenus | 464 | 57 € | 144 € | 63 € | 11 € | 52 € | 0.9× ✗ | 0.3× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1044 Assistant édition numérique | 1050 | 119 € | 297 € | 76 € | 24 € | 52 € | 1.6× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1045 Assistant de fabrication éditoriale | 969 | 128 € | 320 € | 78 € | 26 € | 52 € | 1.6× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1046 Assistant données de recherche | 1060 | 113 € | 282 € | 74 € | 23 € | 52 € | 1.5× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1047 Assistant revue de littérature | 1050 | 112 € | 280 € | 110 € | 22 € | 87 € | 1.0× ✗ | 0.3× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1048 Secrétaire de rédaction | 221 | 29 € | 73 € | 93 € | 6 € | 87 € | 0.3× ✗ | 0.1× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1049 Directeur de production éditoriale | 10 | 1 € | 3 € | 88 € | 0 € | 87 € | 0.0× ✗ | 0.0× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1050 Responsable gestion des connaissances | 10 | 1 € | 3 € | 88 € | 0 € | 87 € | 0.0× ✗ | 0.0× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1051 Assistant gestion patrimoine | 849 | 116 € | 289 € | 75 € | 23 € | 52 € | 1.5× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1052 Agent collecte documents patrimoine | 2584 | 305 € | 763 € | 122 € | 61 € | 61 € | 2.5× ✗ | 0.6× ✗ | 61 € | XL (8/bundle) | 2 800 € |
| AG-1053 Agent reporting patrimoine | 7 | 1 € | 2 € | 52 € | 0 € | 52 € | 0.0× ✗ | 0.0× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1054 Agent suivi investissements | 765 | 107 € | 267 € | 73 € | 21 € | 52 € | 1.5× ✗ | 0.4× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1055 Agent suivi portefeuille | 1840 | 228 € | 569 € | 97 € | 46 € | 52 € | 2.3× ✗ | 0.8× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1056 Agent rendez-vous conseiller | 1920 | 210 € | 524 € | 79 € | 42 € | 37 € | 2.6× ✗ | 2.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1057 Agent reporting client | 7 | 1 € | 2 € | 52 € | 0 € | 52 € | 0.0× ✗ | 0.0× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1058 Agent documentation fiscale | 454 | 63 € | 159 € | 100 € | 13 € | 87 € | 0.6× ✗ | 0.1× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1059 Agent suivi contrats | 1811 | 225 € | 563 € | 97 € | 45 € | 52 € | 2.3× ✗ | 0.8× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1060 Agent suivi assurance | 1956 | 245 € | 614 € | 101 € | 49 € | 52 € | 2.4× ✗ | 0.9× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1061 Agent suivi immobilier | 1208 | 169 € | 422 € | 86 € | 34 € | 52 € | 2.0× ✗ | 0.7× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1062 Agent suivi crédit | 907 | 127 € | 317 € | 77 € | 25 € | 52 € | 1.6× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1063 Agent relation client patrimoine | 1985 | 243 € | 606 € | 100 € | 49 € | 52 € | 2.4× ✗ | 0.9× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1064 Agent relance documents | 133 | 17 € | 42 € | 41 € | 3 € | 37 € | 0.4× ✗ | 0.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1065 Agent onboarding client patrimoine | 930 | 123 € | 307 € | 76 € | 25 € | 52 € | 1.6× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1066 Agent KYC patrimoine | 901 | 119 € | 297 € | 111 € | 24 € | 87 € | 1.1× ✗ | 0.3× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1067 Agent conformité patrimoine | 758 | 106 € | 264 € | 108 € | 21 € | 87 € | 1.0× ✗ | 0.2× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1068 Agent préparation réunion | 1354 | 168 € | 421 € | 86 € | 34 € | 52 € | 2.0× ✗ | 0.7× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1069 Agent synthèse portefeuille | 7 | 1 € | 2 € | 52 € | 0 € | 52 € | 0.0× ✗ | 0.0× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1070 Analyste patrimonial | 1050 | 133 € | 332 € | 114 € | 27 € | 87 € | 1.2× ✗ | 0.3× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1071 Agent suivi échéances | 969 | 134 € | 335 € | 64 € | 27 € | 37 € | 2.1× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1072 Assistant reporting fiscal patrimonial | 606 | 85 € | 212 € | 104 € | 17 € | 87 € | 0.8× ✗ | 0.2× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1073 Assistant back-office patrimonial | 965 | 134 € | 334 € | 79 € | 27 € | 52 € | 1.7× ✗ | 0.5× ✗ | 50 € | L (5/bundle) | 2 800 € |
| AG-1074 Gestionnaire back-office patrimonial | 10 | 1 € | 3 € | 88 € | 0 € | 87 € | 0.0× ✗ | 0.0× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1075 Responsable du back-office patrimonial | 17 | 2 € | 5 € | 88 € | 0 € | 87 € | 0.0× ✗ | 0.0× ✗ | 87 € | XL (5/bundle) | 2 800 € |
| AG-1083 Auditeur interne | 51 | 7 € | 16 € | 40 € | 1 € | 39 € | 0.2× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1084 Superviseur audit interne | 77 | 8 € | 19 € | 43 € | 2 € | 42 € | 0.2× ✗ | 0.0× ✗ | 42 € | XL (15/bundle) | 2 800 € |
| AG-1085 Auditeur conformité interne | 22 | 3 € | 7 € | 39 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1086 Auditeur opérationnel | 22 | 3 € | 7 € | 39 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1087 Auditeur financier interne | 6 | 1 € | 2 € | 47 € | 0 € | 46 € | 0.0× ✗ | 0.0× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-1088 Coordinateur audit qualité | 19 | 2 € | 6 € | 36 € | 0 € | 35 € | 0.1× ✗ | 0.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1089 Assistant vérification conformité | 100 | 11 € | 27 € | 44 € | 2 € | 41 € | 0.3× ✗ | 0.2× ✗ | 29 € | S (1/bundle) | 2 800 € |
| AG-1090 Analyste risques audit | 6 | 1 € | 2 € | 42 € | 0 € | 42 € | 0.0× ✗ | 0.0× ✗ | 42 € | XL (15/bundle) | 2 800 € |
| AG-1091 Auditeur système d'information | 6 | 1 € | 2 € | 42 € | 0 € | 42 € | 0.0× ✗ | 0.0× ✗ | 42 € | XL (15/bundle) | 2 800 € |
| AG-1092 Gestionnaire documentation audit | 96 | 11 € | 27 € | 41 € | 2 € | 39 € | 0.3× ✗ | 0.2× ✗ | 28 € | S (1/bundle) | 2 800 € |
| AG-1093 Specialiste recommandations audit | 26 | 3 € | 7 € | 42 € | 1 € | 42 € | 0.1× ✗ | 0.0× ✗ | 42 € | XL (15/bundle) | 2 800 € |
| AG-1094 Coordinateur suivi correction | 45 | 5 € | 12 € | 40 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1095 Analyste fiscal | 487 | 54 € | 135 € | 60 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1096 Specialiste impot revenu | 1054 | 126 € | 315 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1097 Assistant planification fiscale | 309 | 36 € | 91 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1098 Coordinateur fiscalité international | 309 | 36 € | 91 € | 84 € | 7 € | 77 € | 0.4× ✗ | 0.1× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1099 Agent gestion TVA | 313 | 44 € | 109 € | 46 € | 9 € | 37 € | 0.9× ✗ | 0.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1100 Analyste conformité fiscale | 11 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1101 Gestionnaire dossiers contentieux fiscal | 1980 | 247 € | 618 € | 127 € | 49 € | 77 € | 1.9× ✗ | 0.5× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1102 Assistant reporting fiscal | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1103 Coordinateur impots régionaux | 1384 | 186 € | 466 € | 74 € | 37 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1104 Specialiste optimisation fiscale | 753 | 84 € | 211 € | 94 € | 17 € | 77 € | 0.9× ✗ | 0.2× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1105 Agent declarations impots | 643 | 88 € | 221 € | 55 € | 18 € | 37 € | 1.6× ✗ | 1.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1106 Analyste droits d'auteur | 8 | 1 € | 3 € | 37 € | 0 € | 37 € | 0.0× ✗ | 0.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1107 Assistant audit fiscal | 1682 | 221 € | 553 € | 94 € | 44 € | 49 € | 2.4× ✗ | 0.8× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1108 Gestionnaire amendes fiscales | 1682 | 193 € | 483 € | 76 € | 39 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1109 Coordinateur verifications fiscales | 1264 | 156 € | 389 € | 81 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1110 Assistant contrôle budgétaire | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1111 Coordinateur prévisions financières | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1112 Analyste ecarts budgetaires | 8 | 1 € | 2 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1113 Gestionnaire allocations budgétaires | 756 | 106 € | 264 € | 58 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1114 Agent suivi budget opérationnel | 86 | 12 € | 29 € | 40 € | 2 € | 37 € | 0.3× ✗ | 0.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1115 Coordinateur reporting budgetaire | 335 | 40 € | 99 € | 45 € | 8 € | 37 € | 0.9× ✗ | 0.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1116 Assistant planification annuelle | 633 | 67 € | 169 € | 51 € | 13 € | 37 € | 1.3× ✗ | 1.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1117 Specialiste scenarios budgetaires | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1118 Analyste tendances prévisions | 8 | 1 € | 2 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1119 Agent consolidation données budget | 157 | 22 € | 55 € | 42 € | 4 € | 37 € | 0.5× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1120 Gestionnaire demandes investissements | 1206 | 169 € | 422 € | 83 € | 34 € | 49 € | 2.0× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1121 Coordinateur budget départements | 753 | 77 € | 193 € | 53 € | 15 € | 37 € | 1.5× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1122 Assistant analyses flux trésorerie | 8 | 1 € | 3 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1123 Analyste impact budgetaire | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1124 Gestionnaire justifications budget | 306 | 43 € | 107 € | 46 € | 9 € | 37 € | 0.9× ✗ | 0.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1125 Gestionnaire opérations bancaires | 970 | 129 € | 321 € | 63 € | 26 € | 37 € | 2.0× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1126 Analyste liquidités banque | 400 | 49 € | 122 € | 59 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1127 Assistant relation banquiers | 455 | 50 € | 124 € | 47 € | 10 € | 37 € | 1.1× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1128 Coordinateur flux bancaires | 251 | 35 € | 87 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1129 Agent suivi crédits bancaires | 306 | 36 € | 89 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1130 Analyste taux bancaires | 186 | 19 € | 48 € | 53 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1131 Specialiste swaps couverture | 604 | 77 € | 194 € | 65 € | 15 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1132 Coordinateur emprunts obligations | 763 | 100 € | 249 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1133 Assistant trésorerie banque | 189 | 24 € | 59 € | 42 € | 5 € | 37 € | 0.6× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1134 Analyste conditions financement | 1355 | 182 € | 456 € | 86 € | 36 € | 49 € | 2.1× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1135 Agent suivi facilities | 218 | 30 € | 76 € | 43 € | 6 € | 37 € | 0.7× ✗ | 0.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1136 Gestionnaire lettres crédit | 1384 | 180 € | 449 € | 85 € | 36 € | 49 € | 2.1× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1137 Assistant syndication prêts | 1067 | 114 € | 286 € | 72 € | 23 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1138 Analyste benchmarking bancaire | 604 | 70 € | 176 € | 64 € | 14 € | 49 € | 1.1× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1139 Coordinateur conventions bancaires | 604 | 77 € | 194 € | 65 € | 15 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1140 Agent suivi covenants prêts | 306 | 29 € | 72 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1141 Analyste coûts services bancaires | 157 | 22 € | 55 € | 42 € | 4 € | 37 € | 0.5× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1142 Gestionnaire comptes bancaires | 756 | 106 € | 264 € | 58 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1143 Assistant gestion valeurs | 766 | 107 € | 268 € | 59 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1144 Coordinateur rapprochements banque | 396 | 47 € | 117 € | 47 € | 9 € | 37 € | 1.0× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1145 Specialiste confirmation échanges | 1384 | 180 € | 449 € | 73 € | 36 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1146 Agent versements impôts | 607 | 78 € | 195 € | 53 € | 16 € | 37 € | 1.5× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1147 Analyste concurrence bancaire | 1054 | 133 € | 333 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1148 Gestionnaire paiements multis | 1384 | 180 € | 449 € | 73 € | 36 € | 37 € | 2.5× ✗ | 2.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1149 Assistant gestion cash pool | 98 | 14 € | 34 € | 40 € | 3 € | 37 € | 0.3× ✗ | 0.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1150 Agent souscription assurance | 1384 | 180 € | 449 € | 85 € | 36 € | 49 € | 2.1× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1151 Analyste actuariel | 306 | 29 € | 72 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1152 Coordinateur sinistres assurance | 905 | 135 € | 303 € | 64 € | 27 € | 37 € | 2.1× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1153 Assistant gestion portefeuille assurance | 610 | 85 € | 213 € | 54 € | 17 € | 37 € | 1.6× ✗ | 1.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1154 Specialiste garanties assurance | 1051 | 133 € | 332 € | 76 € | 27 € | 49 € | 1.8× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1155 Gestionnaire primes assurance | 908 | 127 € | 317 € | 63 € | 25 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1156 Cartographe des risques d'entreprise | 306 | 29 € | 72 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1157 Agent relation assureurs | 753 | 105 € | 263 € | 58 € | 21 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1158 Coordinateur appels offre assurance | 1650 | 231 € | 577 € | 96 € | 46 € | 49 € | 2.4× ✗ | 0.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1159 Assistant couvertures assurance | 607 | 78 € | 194 € | 53 € | 16 € | 37 € | 1.5× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1160 Analyste conditions contrats | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1161 Gestionnaire franchises assurance | 306 | 36 € | 89 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1162 Agent suivi renovations contrats | 902 | 119 € | 298 € | 61 € | 24 € | 37 € | 1.9× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1163 Specialiste assurance cyber | 753 | 98 € | 246 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1164 Coordinateur déclarations assurance | 1083 | 151 € | 378 € | 67 € | 30 € | 37 € | 2.2× ✗ | 2.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1165 Agent indemnisation sinistres | 465 | 65 € | 162 € | 50 € | 13 € | 37 € | 1.3× ✗ | 1.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1166 Analyste provisions techniques | 306 | 43 € | 107 € | 58 € | 9 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1167 Gestionnaire dossiers contentieux assurance | 760 | 99 € | 248 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1168 Assistant gestion des risques résiduels | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1169 Coordinateur assurance conformité | 309 | 36 € | 91 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1170 Agent suivi expiration contrats | 338 | 46 € | 114 € | 46 € | 9 € | 37 € | 1.0× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1171 Analyste benchmarking assurance | 455 | 50 € | 124 € | 59 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1172 Gestionnaire preferences fournisseurs | 306 | 36 € | 89 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1173 Assistant gestion documents assurance | 1054 | 133 € | 333 € | 64 € | 27 € | 37 € | 2.1× ✗ | 1.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1174 Specialiste assurance multirisque | 306 | 36 € | 89 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1175 Gestionnaire portefeuille actions | 302 | 41 € | 102 € | 58 € | 8 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1176 Analyste sélection valeurs | 1650 | 196 € | 489 € | 116 € | 39 € | 77 € | 1.7× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1177 Coordinateur rebalancing portefeuille | 614 | 79 € | 197 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1178 Assistant gestion OPCVM | 182 | 24 € | 60 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1179 Specialiste allocation d'actifs | 1200 | 161 € | 402 € | 109 € | 32 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1180 Agent suivi performance portefeuille | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1181 Analyste risques portefeuille | 173 | 17 € | 43 € | 81 € | 3 € | 77 € | 0.2× ✗ | 0.0× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1182 Gestionnaire diversification | 164 | 23 € | 57 € | 54 € | 5 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1183 Assistant gestion obligations | 225 | 24 € | 61 € | 54 € | 5 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1184 Coordinateur reporting portefeuille | 335 | 47 € | 117 € | 47 € | 9 € | 37 € | 1.0× ✗ | 0.9× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1185 Analyste benchmark portefeuille | 306 | 36 € | 89 € | 57 € | 7 € | 49 € | 0.6× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1186 Assistant gestion dividendes | 970 | 108 € | 269 € | 59 € | 22 € | 37 € | 1.8× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1187 Assistant rencontres investisseurs | 2255 | 238 € | 596 € | 97 € | 48 € | 49 € | 2.5× ✗ | 0.9× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1188 Coordinateur roadshow financiers | 1504 | 175 € | 438 € | 72 € | 35 € | 37 € | 2.4× ✗ | 2.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1189 Agent suivi ratings crédit | 309 | 43 € | 107 € | 58 € | 9 € | 49 € | 0.7× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1190 Analyste sensibilité investisseurs | 15 | 2 € | 4 € | 50 € | 0 € | 49 € | 0.0× ✗ | 0.0× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1191 Specialiste communication financière | 604 | 77 € | 193 € | 65 € | 15 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1192 Gestionnaire calendrier événements investisseurs | 1355 | 175 € | 438 € | 72 € | 35 € | 37 € | 2.4× ✗ | 2.2× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1193 Coordinateur conférences analysts | 2550 | 273 € | 681 € | 92 € | 55 € | 37 € | 3.0× ✗ | 2.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1194 Agent réponses actionnaires | 2284 | 249 € | 623 € | 87 € | 50 € | 37 € | 2.9× ✗ | 2.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1195 Analyste structure actionnariat | 484 | 54 € | 134 € | 60 € | 11 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1196 Assistant gestion demandes informations | 2585 | 325 € | 812 € | 102 € | 65 € | 37 € | **3.2×** | 3.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1197 Analyste recherche de cibles M&A | 902 | 105 € | 263 € | 70 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1198 Assistant due diligence financière | 1200 | 154 € | 384 € | 108 € | 31 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1199 Coordinateur transactions | 694 | 82 € | 204 € | 66 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1200 Agent suivi intégration post-fusion | 196 | 20 € | 51 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1201 Specialiste structure transactions | 1200 | 161 € | 402 € | 109 € | 32 € | 77 € | 1.5× ✗ | 0.4× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1202 Gestionnaire documentation M&A | 1530 | 200 € | 500 € | 77 € | 40 € | 37 € | 2.6× ✗ | 2.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1203 Assistant évaluation cibles | 1200 | 154 € | 384 € | 108 € | 31 € | 77 € | 1.4× ✗ | 0.3× ✗ | 77 € | XL (6/bundle) | 2 800 € |
| AG-1204 Analyste synergies | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1205 Coordinateur closing M&A | 1080 | 130 € | 325 € | 75 € | 26 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1206 Agent suivi conditions suspensives | 763 | 92 € | 231 € | 56 € | 18 € | 37 € | 1.7× ✗ | 1.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1207 Assistant compléments de prix | 1210 | 127 € | 318 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1208 Analyste comparables M&A | 1200 | 154 € | 384 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1209 Gestionnaire communications M&A | 1200 | 154 € | 384 € | 68 € | 31 € | 37 € | 2.3× ✗ | 2.1× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1210 Assistant gestion réactions marchés | 571 | 64 € | 161 € | 62 € | 13 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1211 Coordinateur approbations réglementaires | 763 | 106 € | 266 € | 71 € | 21 € | 49 € | 1.5× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1212 Commercial BtoB | 720 | 67 € | 168 € | 56 € | 13 € | 43 € | 1.2× ✗ | 1.2× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1213 Coordinateur prospection commerciale | 202 | 21 € | 52 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1214 Agent suivi pipeline ventes | 111 | 14 € | 34 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1215 Analyste conversion prospects | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1216 Specialiste négociation contrats | 1200 | 119 € | 297 € | 73 € | 24 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1217 Gestionnaire contrats clients | 1808 | 169 € | 421 € | 83 € | 34 € | 49 € | 2.0× ✗ | 0.7× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1218 Assistant gestion comptes clés | 821 | 84 € | 210 € | 59 € | 17 € | 43 € | 1.4× ✗ | 1.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1219 Agent suivi délais livraison | 189 | 23 € | 58 € | 41 € | 5 € | 36 € | 0.6× ✗ | 0.5× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1220 Coordinateur appels offres | 691 | 80 € | 200 € | 65 € | 16 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1221 Analyste stratégie tarifaire | 455 | 50 € | 124 € | 59 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1222 Agent gestion objections ventes | 170 | 16 € | 41 € | 53 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1223 Specialiste démonstrations produits | 1504 | 140 € | 350 € | 71 € | 28 € | 43 € | 2.0× ✗ | 1.9× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1224 Gestionnaire conditions commerciales | 759 | 99 € | 247 € | 69 € | 20 € | 49 € | 1.4× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1225 Assistant préparation visites | 189 | 19 € | 48 € | 40 € | 4 € | 36 € | 0.5× ✗ | 0.4× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1226 Coordinateur ventes régionales | 313 | 29 € | 74 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1227 Agent suivi satisfactions clients | 672 | 63 € | 158 € | 62 € | 13 € | 49 € | 1.0× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1228 Analyste besoins clients | 164 | 16 € | 39 € | 53 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1229 Gestionnaire crédits clients | 875 | 84 € | 211 € | 66 € | 17 € | 49 € | 1.3× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1230 Assistant documentation commerciale | 908 | 85 € | 212 € | 60 € | 17 € | 43 € | 1.4× ✗ | 1.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1231 Coordinateur formations équipes ventes | 759 | 78 € | 195 € | 58 € | 16 € | 43 € | 1.3× ✗ | 1.3× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1232 Agent suivi contrats en cours | 646 | 90 € | 225 € | 67 € | 18 € | 49 € | 1.3× ✗ | 0.4× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1233 Analyste risques commerciaux | 157 | 15 € | 37 € | 52 € | 3 € | 49 € | 0.3× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1234 Specialiste solutions personnalisées | 1504 | 154 € | 386 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1235 Coordinateur promotion produits | 1080 | 123 € | 307 € | 74 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1236 Assistant gestion objectifs ventes | 316 | 44 € | 109 € | 58 € | 9 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1237 Consultant en développement commercial | 462 | 50 € | 126 € | 60 € | 10 € | 49 € | 0.8× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1238 Analyste opportunités marché | 465 | 58 € | 144 € | 61 € | 12 € | 49 € | 0.9× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1239 Coordinateur prospection stratégique | 640 | 75 € | 189 € | 52 € | 15 € | 37 € | 1.4× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1240 Agent identification partenaires | 1051 | 126 € | 315 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1241 Specialiste évaluation nouveaux marchés | 1200 | 161 € | 402 € | 82 € | 32 € | 49 € | 2.0× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1242 Gestionnaire pipeline partenariats | 199 | 21 € | 52 € | 41 € | 4 € | 37 € | 0.5× ✗ | 0.4× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1243 Assistant études faisabilité | 1200 | 154 € | 384 € | 80 € | 31 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1244 Analyste positionnement stratégique | 902 | 112 € | 280 € | 72 € | 22 € | 49 € | 1.6× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1245 Agent suivi alliances | 160 | 22 € | 56 € | 42 € | 4 € | 37 € | 0.5× ✗ | 0.5× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1246 Coordinateur réunions développement | 1054 | 126 € | 316 € | 62 € | 25 € | 37 € | 2.0× ✗ | 1.8× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1247 Specialiste structuration deals | 1200 | 147 € | 367 € | 79 € | 29 € | 49 € | 1.9× ✗ | 0.6× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1248 Gestionnaire relationnel partenaires | 491 | 53 € | 133 € | 48 € | 11 € | 37 € | 1.1× ✗ | 1.0× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1249 Assistant analyses concurrentielles | 468 | 51 € | 129 € | 60 € | 10 € | 49 € | 0.9× ✗ | 0.2× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1250 Coordinateur intégration partenaires | 760 | 78 € | 196 € | 53 € | 16 € | 37 € | 1.5× ✗ | 1.3× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1251 Agent suivi KPIs partenariats | 306 | 36 € | 89 € | 44 € | 7 € | 37 € | 0.8× ✗ | 0.7× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1252 Analyste ROI partenariats | 157 | 22 € | 55 € | 54 € | 4 € | 49 € | 0.4× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1253 Assistant prospection internationale | 1051 | 126 € | 315 € | 75 € | 25 € | 49 € | 1.7× ✗ | 0.5× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1254 Coordinateur approbation nouveaux projets | 756 | 99 € | 247 € | 57 € | 20 € | 37 € | 1.7× ✗ | 1.6× ✗ | 34 € | S (1/bundle) | 2 800 € |
| AG-1255 Specialiste innovation produits | 753 | 77 € | 193 € | 65 € | 15 € | 49 € | 1.2× ✗ | 0.3× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1256 Agent suivi tendances marchés | 306 | 29 € | 72 € | 55 € | 6 € | 49 € | 0.5× ✗ | 0.1× ✗ | 48 € | L (6/bundle) | 2 800 € |
| AG-1300 Deviseur en industrie graphique | 1655 | 175 € | 439 € | 105 € | 35 € | 70 € | 1.7× ✗ | 0.4× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1301 Opérateur prépresse | 1230 | 123 € | 307 € | 106 € | 25 € | 82 € | 1.2× ✗ | 0.8× ✗ | 58 € | M (1/bundle) | 2 800 € |
| AG-1302 Technicien CTP et flux RIP | 939 | 89 € | 223 € | 89 € | 18 € | 71 € | 1.0× ✗ | 0.7× ✗ | 51 € | M (1/bundle) | 2 800 € |
| AG-1303 Correcteur-lecteur d'imprimerie | 1200 | 147 € | 367 € | 74 € | 29 € | 45 € | 2.0× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1304 Chef de fabrication en industrie graphique | 1084 | 110 € | 274 € | 73 € | 22 € | 51 € | 1.5× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1305 Chef d'atelier d'imprimerie | 274 | 31 € | 78 € | 59 € | 6 € | 53 € | 0.5× ✗ | 0.1× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1310 Technicien méthodes et industrialisation | 755 | 92 € | 229 € | 78 € | 18 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1311 Programmeur en commande numérique et CFAO | 1655 | 168 € | 421 € | 120 € | 34 € | 86 € | 1.4× ✗ | 0.4× ✗ | 86 € | XL (5/bundle) | 2 800 € |
| AG-1312 Dessinateur-projeteur en mécanique | 1830 | 191 € | 479 € | 98 € | 38 € | 60 € | 1.9× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1313 Technicien qualité en industrie | 1205 | 154 € | 386 € | 94 € | 31 € | 63 € | 1.6× ✗ | 0.3× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1314 Chargé d'affaires réglementaires | 2254 | 252 € | 630 € | 130 € | 50 € | 79 € | 1.9× ✗ | 0.5× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1315 Modéliste industriel textile, chaussure et cuir | 1354 | 175 € | 438 € | 91 € | 35 € | 56 € | 1.9× ✗ | 0.4× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1316 Technicien hygiène sécurité environnement | 1506 | 183 € | 456 € | 100 € | 37 € | 63 € | 1.8× ✗ | 0.4× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1317 Responsable sécurité sanitaire des aliments | 1082 | 115 € | 287 € | 86 € | 23 € | 63 € | 1.3× ✗ | 0.3× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1320 Chargé d'affaires du bâtiment | 1535 | 185 € | 463 € | 90 € | 37 € | 53 € | 2.1× ✗ | 0.7× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1321 Technicien de bureau d'études en électricité | 1950 | 245 € | 611 € | 128 € | 49 € | 79 € | 1.9× ✗ | 0.5× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1322 Technicien d'études en génie climatique | 1950 | 245 € | 611 € | 128 € | 49 € | 79 € | 1.9× ✗ | 0.5× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1323 Dessinateur-projeteur du bâtiment | 1830 | 193 € | 482 € | 99 € | 39 € | 60 € | 2.0× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1324 Économiste de la construction | 1801 | 224 € | 559 € | 131 € | 45 € | 86 € | 1.7× ✗ | 0.5× ✗ | 86 € | XL (5/bundle) | 2 800 € |
| AG-1325 Chargé d'études photovoltaïques | 1354 | 161 € | 403 € | 92 € | 32 € | 60 € | 1.8× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1326 Gestionnaire de dossiers d'aides à la rénovation énergétique | 1680 | 193 € | 482 € | 89 € | 39 € | 51 € | 2.2× ✗ | 0.7× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1327 Chargé d'études amiante et démolition | 1234 | 138 € | 344 € | 107 € | 28 € | 79 € | 1.3× ✗ | 0.3× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1328 Technicien géomètre-topographe | 1804 | 189 € | 473 € | 98 € | 38 € | 60 € | 1.9× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1330 Chef de fabrication en boulangerie-pâtisserie | 815 | 114 € | 284 € | 73 € | 23 € | 51 € | 1.6× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1331 Chef de laboratoire en boucherie-charcuterie-traiteur | 1419 | 198 € | 495 € | 103 € | 40 € | 63 € | 1.9× ✗ | 0.4× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1332 Chef de laboratoire en chocolaterie, confiserie et glacerie | 1060 | 148 € | 370 € | 77 € | 30 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1340 Responsable de magasin | 194 | 26 € | 64 € | 56 € | 5 € | 51 € | 0.5× ✗ | 0.1× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1341 Préparateur en pharmacie, gestion et tiers payant | 100 | 13 € | 31 € | 50 € | 3 € | 47 € | 0.3× ✗ | 0.1× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1342 Opticien-lunetier, devis et tiers payant | 460 | 64 € | 160 € | 73 € | 13 € | 60 € | 0.9× ✗ | 0.1× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1343 Caviste | 910 | 127 € | 317 € | 70 € | 25 € | 45 € | 1.8× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1344 Responsable de salon de coiffure et d'institut de beauté | 790 | 74 € | 185 € | 55 € | 15 € | 40 € | 1.3× ✗ | 0.6× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1350 Secrétaire-comptable d'exploitation agricole | 762 | 99 € | 249 € | 66 € | 20 € | 46 € | 1.5× ✗ | 0.2× ✗ | 46 € | XL (13/bundle) | 2 800 € |
| AG-1351 Technicien d'élevage | 1385 | 164 € | 411 € | 80 € | 33 € | 47 € | 2.0× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1352 Responsable de vente directe en exploitation agricole | 940 | 131 € | 328 € | 65 € | 26 € | 39 € | 2.0× ✗ | 1.9× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1353 Maître de chai | 1531 | 186 € | 465 € | 79 € | 37 € | 42 € | 2.3× ✗ | 2.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1354 Directeur de centre équestre | 764 | 79 € | 197 € | 52 € | 16 € | 36 € | 1.5× ✗ | 1.3× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1355 Conducteur de travaux en entreprise de travaux agricoles | 969 | 128 € | 321 € | 64 € | 26 € | 39 € | 2.0× ✗ | 1.8× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1356 Technicien forestier | 1055 | 147 € | 369 € | 71 € | 29 € | 42 € | 2.1× ✗ | 0.3× ✗ | 42 € | XL (15/bundle) | 2 800 € |
| AG-1357 Chargé d'armement à la pêche et en conchyliculture | 790 | 109 € | 272 € | 65 € | 22 € | 44 € | 1.7× ✗ | 1.7× ✗ | 30 € | S (1/bundle) | 2 800 € |
| AG-1358 Chef de culture | 794 | 110 € | 274 € | 73 € | 22 € | 51 € | 1.5× ✗ | 1.5× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1360 Attaché d'exploitation déchets | 301 | 38 € | 95 € | 58 € | 8 € | 51 € | 0.7× ✗ | 0.2× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1361 Technicien de supervision de centrales d'énergie renouvelable | 3067 | 287 € | 719 € | 111 € | 58 € | 53 € | 2.6× ✗ | 1.0× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1362 Chargé d'études environnement | 1354 | 154 € | 386 € | 110 € | 31 € | 79 € | 1.4× ✗ | 0.3× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1363 Technicien autosurveillance des systèmes d'assainissement | 907 | 120 € | 299 € | 71 € | 24 € | 47 € | 1.7× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1370 Déclarant en douane | 1804 | 189 € | 473 € | 108 € | 38 € | 70 € | 1.8× ✗ | 0.4× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1371 Technico-commercial sédentaire en négoce | 1234 | 158 € | 396 € | 104 € | 32 € | 73 € | 1.5× ✗ | 0.3× ✗ | 73 € | XL (7/bundle) | 2 800 € |
| AG-1380 Régulateur en transport sanitaire | 1419 | 135 € | 338 € | 84 € | 27 € | 57 € | 1.6× ✗ | 0.5× ✗ | 54 € | L (5/bundle) | 2 800 € |
| AG-1381 Auxiliaire spécialisé vétérinaire | 819 | 85 € | 212 € | 57 € | 17 € | 40 € | 1.5× ✗ | 0.6× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1382 Responsable de secteur d'aide à domicile | 1386 | 138 € | 345 € | 81 € | 28 € | 53 € | 1.7× ✗ | 0.6× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1383 Chargé des admissions et de la facturation en établissement médico-social | 936 | 103 € | 257 € | 68 € | 21 € | 47 € | 1.5× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1384 Directeur adjoint de crèche | 906 | 127 € | 317 € | 72 € | 25 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1390 Clerc de notaire | 1085 | 122 € | 306 € | 95 € | 24 € | 70 € | 1.3× ✗ | 0.3× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1391 Clerc de commissaire de justice | 1294 | 152 € | 379 € | 116 € | 30 € | 86 € | 1.3× ✗ | 0.3× ✗ | 86 € | XL (5/bundle) | 2 800 € |
| AG-1392 Assistant d'exploitation en sécurité privée | 786 | 81 € | 201 € | 69 € | 16 € | 53 € | 1.2× ✗ | 0.3× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1393 Secrétaire général de mairie | 2105 | 266 € | 666 € | 100 € | 53 € | 47 € | 2.7× ✗ | 1.0× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1394 Assistant de programme immobilier | 1389 | 194 € | 485 € | 86 € | 39 € | 47 € | 2.3× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1395 Secrétaire commercial automobile | 1084 | 117 € | 292 € | 70 € | 23 € | 47 € | 1.7× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1400 Chargé de conception raccordement | 1830 | 193 € | 482 € | 125 € | 39 € | 86 € | 1.6× ✗ | 0.4× ✗ | 86 € | XL (5/bundle) | 2 800 € |
| AG-1401 Chargé d'affaires raccordement électricité | 1655 | 196 € | 491 € | 90 € | 39 € | 51 € | 2.2× ✗ | 0.8× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1402 Programmateur des interventions électriques | 514 | 58 € | 145 € | 52 € | 12 € | 40 € | 1.1× ✗ | 0.5× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1403 Chargé d'exploitation réseau électrique | 1534 | 186 € | 466 € | 117 € | 37 € | 79 € | 1.6× ✗ | 0.4× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1404 Technicien de conduite réseau électrique | 812 | 105 € | 263 € | 68 € | 21 € | 47 € | 1.5× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1405 Conseiller clientèle gestion des contrats d'accès au réseau | 1082 | 116 € | 291 € | 76 € | 23 € | 53 € | 1.5× ✗ | 0.5× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1406 Chargé d'études réseau électrique haute tension | 1204 | 140 € | 351 € | 88 € | 28 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1407 Chargé de préparation en centrale nucléaire | 1204 | 140 € | 351 € | 94 € | 28 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1408 Chargé de consignation en centrale nucléaire | 1110 | 127 € | 318 € | 105 € | 25 € | 79 € | 1.2× ✗ | 0.3× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1409 Chargé de conduite hydraulique | 2371 | 317 € | 794 € | 111 € | 63 € | 47 € | 2.9× ✗ | 1.1× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1410 Géomaticien réseaux d'eau et d'assainissement | 1356 | 190 € | 474 € | 98 € | 38 € | 60 € | 1.9× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1411 Gestionnaire relève et facturation de l'eau | 1353 | 182 € | 455 € | 87 € | 36 € | 51 € | 2.1× ✗ | 0.7× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1412 Conseiller clientèle eau | 2405 | 252 € | 631 € | 93 € | 50 € | 43 € | 2.7× ✗ | 1.5× ✗ | 43 € | M (3/bundle) | 2 800 € |
| AG-1413 Chargé de qualité et conformité de l'eau potable | 932 | 122 € | 305 € | 90 € | 24 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1414 Hydraulicien modélisateur des réseaux d'eau | 751 | 98 € | 245 € | 93 € | 20 € | 74 € | 1.1× ✗ | 0.2× ✗ | 74 € | XL (7/bundle) | 2 800 € |
| AG-1415 Responsable d'usine de production d'eau potable | 220 | 29 € | 73 € | 57 € | 6 € | 51 € | 0.5× ✗ | 0.1× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1416 Technicien performance réseau et recherche de fuites | 790 | 110 € | 275 € | 69 € | 22 € | 47 € | 1.6× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1417 Technicien suivi contractuel et reporting eau et assainissement | 307 | 43 € | 107 € | 53 € | 9 € | 45 € | 0.8× ✗ | 0.2× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1418 Chargé du suivi des contrats de délégation eau et assainissement | 1052 | 147 € | 368 € | 85 € | 29 € | 56 € | 1.7× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1419 Chargé d'affaires travaux eau et assainissement | 1204 | 140 € | 351 € | 92 € | 28 € | 63 € | 1.5× ✗ | 0.3× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1420 Chef de projet éolien | 1205 | 168 € | 421 € | 113 € | 34 € | 79 € | 1.5× ✗ | 0.4× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1421 Chef de projet développement photovoltaïque | 754 | 91 € | 229 € | 98 € | 18 € | 79 € | 0.9× ✗ | 0.2× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1422 Ingénieur d'études de gisement éolien et solaire | 1204 | 168 € | 421 € | 94 € | 34 € | 60 € | 1.8× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1423 Prospecteur foncier en énergies renouvelables | 1055 | 120 € | 299 € | 65 € | 24 € | 41 € | 1.8× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1424 Ingénieur raccordement en énergies renouvelables | 1055 | 147 € | 369 € | 85 € | 29 € | 56 € | 1.7× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1425 Gestionnaire d'actifs en énergies renouvelables | 608 | 57 € | 143 € | 77 € | 11 € | 66 € | 0.7× ✗ | 0.1× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1426 Chef de projet méthanisation | 1204 | 168 € | 421 € | 81 € | 34 € | 47 € | 2.1× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1427 Gestionnaire d'appels d'offres en énergies renouvelables | 1654 | 196 € | 491 € | 99 € | 39 € | 60 € | 2.0× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1428 Développeur territorial en énergies renouvelables | 2104 | 287 € | 718 € | 104 € | 57 € | 47 € | 2.8× ✗ | 1.0× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1430 Négociant en matières premières de recyclage | 964 | 107 € | 267 € | 96 € | 21 € | 75 € | 1.1× ✗ | 0.3× ✗ | 75 € | XL (6/bundle) | 2 800 € |
| AG-1431 Chargé d'affaires déchets d'entreprises | 606 | 78 € | 194 € | 66 € | 16 € | 51 € | 1.2× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1432 Responsable des déchets en entreprise industrielle | 188 | 25 € | 62 € | 52 € | 5 € | 47 € | 0.5× ✗ | 0.1× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1433 Responsable de centre de tri | 78 | 11 € | 26 € | 53 € | 2 € | 51 € | 0.2× ✗ | 0.1× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1434 Chargé de comptes collectivités en éco-organisme | 1651 | 196 € | 490 € | 84 € | 39 € | 45 € | 2.3× ✗ | 0.8× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1435 Chargé de comptes opérateurs en éco-organisme | 304 | 42 € | 106 € | 53 € | 9 € | 45 € | 0.8× ✗ | 0.2× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1436 Chargé de mission REP chez un opérateur de déchets | 158 | 22 € | 55 € | 51 € | 4 € | 47 € | 0.4× ✗ | 0.1× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1437 Chargé de conformité REP des produits mis sur le marché | 907 | 99 € | 247 € | 64 € | 20 € | 45 € | 1.5× ✗ | 0.4× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1438 Chef de projet économie circulaire | 1052 | 147 € | 368 € | 80 € | 29 € | 51 € | 1.8× ✗ | 1.8× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1439 Responsable de ressourcerie | 191 | 25 € | 63 € | 44 € | 5 € | 39 € | 0.6× ✗ | 0.5× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1440 Responsable RSE | 911 | 127 € | 318 € | 91 € | 25 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1441 Chargé de mission décarbonation | 602 | 77 € | 193 € | 75 € | 15 € | 60 € | 1.0× ✗ | 0.2× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1442 Contrôleur de gestion RSE | 1055 | 147 € | 369 € | 80 € | 30 € | 51 € | 1.8× ✗ | 0.6× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1443 Acheteur responsable | 606 | 85 € | 211 € | 64 € | 17 € | 47 € | 1.3× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1444 Chargé de mission biodiversité | 602 | 84 € | 210 € | 68 € | 17 € | 51 € | 1.2× ✗ | 0.2× ✗ | 51 € | XL (11/bundle) | 2 800 € |
| AG-1445 Gestionnaire de l'énergie des bâtiments | 307 | 36 € | 89 € | 52 € | 7 € | 45 € | 0.7× ✗ | 0.2× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1446 Chef de projet mobilité durable | 602 | 77 € | 193 € | 51 € | 15 € | 36 € | 1.5× ✗ | 1.3× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1447 Chargé de mission devoir de vigilance | 906 | 126 € | 316 € | 81 € | 25 € | 56 € | 1.6× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1448 Analyste ISR en gestion d'actifs | 485 | 66 € | 166 € | 79 € | 13 € | 66 € | 0.8× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1450 Responsable qualité, sécurité, environnement | 1506 | 211 € | 526 € | 89 € | 42 € | 47 € | 2.4× ✗ | 0.8× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1451 Ingénieur qualité fournisseurs | 1801 | 217 € | 542 € | 90 € | 43 € | 47 € | 2.4× ✗ | 0.8× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1452 Technicien en métrologie | 1060 | 148 € | 370 € | 95 € | 30 € | 65 € | 1.6× ✗ | 1.0× ✗ | 48 € | M (2/bundle) | 2 800 € |
| AG-1453 Responsable assurance qualité de laboratoire | 1655 | 231 € | 578 € | 93 € | 46 € | 47 € | 2.5× ✗ | 0.9× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1454 Technicien de laboratoire d'analyse industrielle | 1440 | 200 € | 500 € | 83 € | 40 € | 43 € | 2.4× ✗ | 2.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1455 Auditeur de certification de systèmes de management | 1800 | 189 € | 472 € | 85 € | 38 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1456 Chargé de clientèle en certification | 1655 | 168 € | 421 € | 76 € | 34 € | 43 € | 2.2× ✗ | 2.2× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1457 Technicien chargé d'inspection en vérifications réglementaires | 761 | 99 € | 247 € | 96 € | 20 € | 76 € | 1.0× ✗ | 0.7× ✗ | 54 € | M (1/bundle) | 2 800 € |
| AG-1458 Ingénieur contrôle technique construction | 1654 | 231 € | 578 € | 126 € | 46 € | 79 € | 1.8× ✗ | 0.5× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1459 Chargé de relation clients en laboratoire d'essais | 2280 | 249 € | 622 € | 90 € | 50 € | 40 € | 2.8× ✗ | 1.5× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1460 Contrôleur de gestion industriel | 308 | 43 € | 108 € | 79 € | 9 € | 70 € | 0.6× ✗ | 0.1× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1461 Architecte des systèmes d'information | 911 | 127 € | 317 € | 91 € | 25 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1462 Administrateur systèmes et réseaux | 667 | 64 € | 159 € | 53 € | 13 € | 40 € | 1.2× ✗ | 0.5× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1463 Chef de projet maîtrise d'ouvrage des systèmes d'information | 1085 | 124 € | 309 € | 75 € | 25 € | 51 € | 1.6× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1464 Chef de projet R&D | 315 | 44 € | 109 € | 74 € | 9 € | 66 € | 0.6× ✗ | 0.1× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1465 Ingénieur d'essais | 1205 | 168 € | 421 € | 84 € | 34 € | 51 € | 2.0× ✗ | 0.7× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1466 Ingénieur brevets | 1205 | 134 € | 334 € | 87 € | 27 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1467 Chargé de mission crédit d'impôt recherche | 606 | 85 € | 212 € | 77 € | 17 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1468 Gestionnaire de l'administration des ventes export | 1655 | 196 € | 491 € | 92 € | 39 € | 53 € | 2.1× ✗ | 0.8× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1470 Contrôleur des opérations aériennes | 3694 | 347 € | 868 € | 149 € | 69 € | 79 € | 2.3× ✗ | 0.7× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1471 Planificateur des équipages aériens | 642 | 60 € | 150 € | 63 € | 12 € | 51 € | 1.0× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1472 Technicien de gestion de navigabilité (CAMO) | 1415 | 170 € | 425 € | 100 € | 34 € | 66 € | 1.7× ✗ | 0.4× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1473 Agent maritime consignataire | 1294 | 152 € | 379 € | 83 € | 30 € | 53 € | 1.8× ✗ | 0.6× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1474 Coordinateur d'opérations navires | 844 | 82 € | 204 € | 67 € | 16 € | 51 € | 1.2× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1475 Planificateur de navires | 1204 | 126 € | 316 € | 76 € | 25 € | 51 € | 1.7× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1476 Chargé d'exploitation de terminal portuaire | 1414 | 163 € | 407 € | 86 € | 33 € | 53 € | 1.9× ✗ | 0.6× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1477 Horairiste ferroviaire | 1654 | 203 € | 508 € | 106 € | 41 € | 66 € | 1.9× ✗ | 0.5× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1478 Technicien méthodes de maintenance du matériel roulant | 340 | 47 € | 119 € | 57 € | 9 € | 47 € | 0.8× ✗ | 0.2× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1479 Gestionnaire de moyens en transport ferroviaire | 786 | 75 € | 187 € | 68 € | 15 € | 53 € | 1.1× ✗ | 0.3× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1480 Chargé d'études FTTH | 1354 | 182 € | 456 € | 100 € | 36 € | 63 € | 1.8× ✗ | 0.4× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1481 Conducteur de travaux FTTH | 1085 | 138 € | 344 € | 96 € | 28 € | 68 € | 1.4× ✗ | 0.3× ✗ | 68 € | XL (7/bundle) | 2 800 € |
| AG-1482 Négociateur site radio | 755 | 99 € | 246 € | 80 € | 20 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1483 Ingénieur planification radio | 1804 | 189 € | 473 € | 117 € | 38 € | 79 € | 1.6× ✗ | 0.4× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1484 Chargé de production audiovisuelle | 639 | 82 € | 206 € | 67 € | 16 € | 51 € | 1.2× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1485 Directeur de production cinéma et audiovisuel | 610 | 85 € | 213 € | 83 € | 17 € | 66 € | 1.0× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1486 Gestionnaire d'antenne | 721 | 98 € | 245 € | 73 € | 20 € | 53 € | 1.4× ✗ | 0.4× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1487 Administrateur de production du spectacle vivant | 1202 | 168 € | 420 € | 84 € | 34 € | 51 € | 2.0× ✗ | 0.7× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1488 Régisseur général | 1056 | 120 € | 299 € | 87 € | 24 € | 63 € | 1.4× ✗ | 0.3× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1489 Chargé de diffusion de spectacles | 610 | 78 € | 196 € | 63 € | 16 € | 47 € | 1.3× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1490 Chef de carrière | 791 | 83 € | 206 € | 67 € | 17 € | 51 € | 1.2× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1491 Responsable foncier et environnement de carrières | 907 | 127 € | 317 € | 99 € | 25 € | 74 € | 1.3× ✗ | 0.3× ✗ | 74 € | XL (7/bundle) | 2 800 € |
| AG-1492 Géologue d'exploitation en carrière | 1356 | 162 € | 404 € | 99 € | 32 € | 67 € | 1.6× ✗ | 0.4× ✗ | 67 € | XL (7/bundle) | 2 800 € |
| AG-1493 Agent de bascule de carrière | 1539 | 154 € | 384 € | 71 € | 31 € | 40 € | 2.2× ✗ | 1.0× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1494 Technicien d'exploitation et de surveillance de réseau de gaz | 1390 | 166 € | 416 € | 97 € | 33 € | 63 € | 1.7× ✗ | 0.4× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1495 Dispatcheur commercial gaz | 1441 | 140 € | 350 € | 85 € | 28 € | 57 € | 1.6× ✗ | 0.6× ✗ | 54 € | L (5/bundle) | 2 800 € |
| AG-1496 Chef de dépôt pétrolier | 97 | 14 € | 34 € | 56 € | 3 € | 53 € | 0.2× ✗ | 0.1× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1497 Conseiller funéraire | 1204 | 140 € | 351 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1498 Assistant funéraire | 1414 | 170 € | 424 € | 77 € | 34 € | 43 € | 2.2× ✗ | 2.2× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1499 Secrétaire d'auto-école | 823 | 86 € | 214 € | 99 € | 17 € | 82 € | 0.9× ✗ | 0.6× ✗ | 58 € | M (1/bundle) | 2 800 € |
| AG-1500 Régisseur des collections | 1505 | 203 € | 509 € | 101 € | 41 € | 60 € | 2.0× ✗ | 0.5× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1501 Chargé de l'inventaire et du récolement des collections | 1055 | 147 € | 369 € | 85 € | 30 € | 56 € | 1.7× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1502 Chargé de production d'expositions | 764 | 107 € | 266 € | 72 € | 21 € | 51 € | 1.5× ✗ | 0.4× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1503 Chargé des publics et de la médiation culturelle | 932 | 95 € | 238 € | 59 € | 19 € | 40 € | 1.6× ✗ | 0.7× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1504 Assistant de galerie d'art | 1055 | 147 € | 368 € | 76 € | 29 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1505 Clerc de commissaire-priseur | 1414 | 196 € | 491 € | 92 € | 39 € | 53 € | 2.1× ✗ | 0.8× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1506 Catalogueur en maison de ventes | 1650 | 196 € | 489 € | 118 € | 39 € | 79 € | 1.6× ✗ | 0.4× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1507 Assistant d'atelier de conservation-restauration | 1204 | 168 € | 421 € | 89 € | 34 € | 56 € | 1.9× ✗ | 0.4× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1508 Assistant du responsable d'opération archéologique | 910 | 127 € | 317 € | 105 € | 25 € | 79 € | 1.2× ✗ | 0.3× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1509 Adjoint au responsable de l'activité archéologique | 1055 | 147 € | 369 € | 77 € | 30 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1510 Gestionnaire des archives de fouilles | 1230 | 165 € | 412 € | 69 € | 33 € | 36 € | 2.4× ✗ | 2.1× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1511 Régisseur général d'orchestre | 485 | 61 € | 152 € | 65 € | 12 € | 53 € | 0.9× ✗ | 0.3× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1512 Bibliothécaire d'orchestre | 906 | 92 € | 229 € | 84 € | 18 € | 65 € | 1.1× ✗ | 0.7× ✗ | 48 € | M (2/bundle) | 2 800 € |
| AG-1513 Chargé de l'administration artistique d'opéra | 1055 | 113 € | 281 € | 73 € | 23 € | 51 € | 1.5× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1514 Conseiller aux études en conservatoire et école d'arts | 1505 | 182 € | 456 € | 77 € | 36 € | 40 € | 2.4× ✗ | 1.2× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1515 Gestionnaire de copyright en édition musicale | 1352 | 189 € | 472 € | 82 € | 38 € | 45 € | 2.3× ✗ | 0.7× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1516 Chargé de cession de droits et de synchronisation | 1204 | 126 € | 316 € | 72 € | 25 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1517 Chargé du matériel d'orchestre | 932 | 102 € | 256 € | 59 € | 20 € | 39 € | 1.7× ✗ | 1.6× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1520 Membre du comité de direction de casino | 365 | 51 € | 128 € | 57 € | 10 € | 47 € | 0.9× ✗ | 0.2× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1521 Caissier central de casino | 271 | 38 € | 95 € | 49 € | 8 € | 41 € | 0.8× ✗ | 0.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1522 Responsable conformité et jeu responsable en casino | 311 | 43 € | 109 € | 69 € | 9 € | 60 € | 0.6× ✗ | 0.1× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1523 Responsable de centre de loisirs indoor | 1240 | 173 € | 433 € | 77 € | 35 € | 43 € | 2.2× ✗ | 2.2× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1524 Concepteur de jeux d'évasion | 1204 | 168 € | 420 € | 78 € | 34 € | 45 € | 2.1× ✗ | 0.7× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1525 Régisseur des collections animales | 157 | 22 € | 55 € | 55 € | 4 € | 51 € | 0.4× ✗ | 0.4× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1526 Responsable de la médiation en parc zoologique | 760 | 106 € | 265 € | 66 € | 21 € | 45 € | 1.6× ✗ | 0.4× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1527 Chef du service des pistes | 100 | 13 € | 31 € | 53 € | 3 € | 51 € | 0.2× ✗ | 0.1× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1528 Chef d'exploitation des remontées mécaniques | 220 | 31 € | 77 € | 53 € | 6 € | 47 € | 0.6× ✗ | 0.1× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1529 Maître de port de plaisance | 637 | 61 € | 153 € | 55 € | 12 € | 43 € | 1.1× ✗ | 1.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1530 Chef de base nautique | 669 | 92 € | 230 € | 61 € | 18 € | 43 € | 1.5× ✗ | 1.5× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1531 Responsable de centre de plongée | 1265 | 149 € | 372 € | 72 € | 30 € | 43 € | 2.1× ✗ | 2.0× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1532 Responsable des admissions et du planning des curistes | 1294 | 180 € | 449 € | 76 € | 36 € | 40 € | 2.4× ✗ | 1.2× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1533 Responsable qualité des eaux thermales | 782 | 109 € | 273 € | 66 € | 22 € | 45 € | 1.6× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1534 Directeur hôtelier de bateau de croisière fluviale | 489 | 67 € | 167 € | 54 € | 13 € | 40 € | 1.2× ✗ | 0.5× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1535 Chargé des opérations de croisière fluviale | 634 | 73 € | 183 € | 65 € | 15 € | 51 € | 1.1× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1536 Chef de bassin | 641 | 88 € | 220 € | 60 € | 18 € | 43 € | 1.5× ✗ | 1.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1537 Responsable technique de centre aquatique | 662 | 91 € | 228 € | 57 € | 18 € | 39 € | 1.6× ✗ | 1.5× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1540 Chargé de production effets visuels et animation | 1684 | 200 € | 501 € | 87 € | 40 € | 47 € | 2.3× ✗ | 0.8× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1541 Technicien contrôle qualité et livraisons de postproduction | 1534 | 180 € | 449 € | 81 € | 36 € | 45 € | 2.2× ✗ | 0.7× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1542 Programmateur de salles de cinéma | 764 | 72 € | 179 € | 59 € | 14 € | 45 € | 1.2× ✗ | 0.3× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1543 Gestionnaire des recettes et déclarations d'exploitation cinématographique | 45 | 6 € | 15 € | 40 € | 1 € | 39 € | 0.1× ✗ | 0.1× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1544 Programmateur de distribution cinématographique | 639 | 68 € | 170 € | 61 € | 14 € | 47 € | 1.1× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1545 Gestionnaire de droits audiovisuels | 1056 | 134 € | 334 € | 87 € | 27 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1546 Programmateur musical de radio | 790 | 109 € | 272 € | 69 € | 22 € | 47 € | 1.6× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1547 Chargé de trafic publicitaire radio | 1265 | 147 € | 369 € | 71 € | 30 € | 41 € | 2.1× ✗ | 2.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1548 Contrôleur de facturation média | 762 | 106 € | 266 € | 68 € | 21 € | 47 € | 1.6× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1549 Chef de projet événement en parc des expositions et centre de congrès | 1234 | 137 € | 343 € | 78 € | 27 € | 51 € | 1.8× ✗ | 0.6× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1550 Chargé de sécurité des salons et manifestations | 1084 | 143 € | 357 € | 84 € | 29 € | 56 € | 1.7× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1551 Responsable billetterie de stade et d'aréna | 1260 | 141 € | 353 € | 79 € | 28 € | 51 € | 1.8× ✗ | 0.6× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1552 Chargé des hospitalités et des loges | 1204 | 161 € | 403 € | 74 € | 32 € | 41 € | 2.2× ✗ | 2.1× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1553 Responsable sûreté et sécurité de stade | 755 | 92 € | 229 € | 65 € | 18 € | 47 € | 1.4× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1554 Coordinateur d'écurie de course | 1056 | 113 € | 282 € | 64 € | 23 € | 41 € | 1.8× ✗ | 1.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1555 Ingénieur d'exploitation en sport automobile | 1500 | 196 € | 489 € | 109 € | 39 € | 70 € | 1.8× ✗ | 0.4× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1556 Gestionnaire des pièces et du kilométrage de course | 935 | 122 € | 306 € | 63 € | 24 € | 39 € | 1.9× ✗ | 1.8× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1557 Agent sportif | 1056 | 113 € | 282 € | 83 € | 23 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1558 Chargé de détection et de recrutement de joueurs | 759 | 85 € | 213 € | 64 € | 17 € | 47 € | 1.3× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1559 Directeur d'exploitation cinématographique | 761 | 78 € | 196 € | 63 € | 16 € | 47 € | 1.3× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1560 Coordinateur des ressources aéroportuaires | 844 | 87 € | 218 € | 68 € | 17 € | 51 € | 1.3× ✗ | 0.4× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1561 Chargé de mission sûreté aéroportuaire | 906 | 127 € | 317 € | 70 € | 25 € | 45 € | 1.8× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1562 Responsable du développement des lignes aériennes | 460 | 64 € | 160 € | 79 € | 13 € | 66 € | 0.8× ✗ | 0.1× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1563 Gestionnaire de l'information aéronautique | 1081 | 137 € | 343 € | 74 € | 27 € | 47 € | 1.8× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1564 Concepteur de procédures de vol aux instruments | 1051 | 119 € | 297 € | 91 € | 24 € | 67 € | 1.3× ✗ | 0.3× ✗ | 67 € | XL (7/bundle) | 2 800 € |
| AG-1565 Planificateur des vols d'instruction | 673 | 65 € | 162 € | 56 € | 13 € | 43 € | 1.2× ✗ | 1.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1566 Coordinateur de la formation en école de pilotage | 764 | 79 € | 197 € | 57 € | 16 € | 41 € | 1.4× ✗ | 1.3× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1567 Agent de méthodes en transport urbain | 1201 | 168 € | 420 € | 81 € | 34 € | 47 € | 2.1× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1568 Régulateur de réseau bus et tramway | 4144 | 550 € | 1 374 € | 153 € | 110 € | 43 € | **3.6×** | 2.4× ✗ | 43 € | M (3/bundle) | 2 800 € |
| AG-1569 Chargé d'études offre et performance en transport urbain | 906 | 126 € | 316 € | 72 € | 25 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1570 Programmateur des navigants | 641 | 62 € | 154 € | 63 € | 12 € | 51 € | 1.0× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1571 Affréteur fluvial | 1230 | 137 € | 342 € | 78 € | 27 € | 51 € | 1.8× ✗ | 0.6× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1572 Opérateur PC sécurité et trafic autoroutier | 4985 | 667 € | 1 669 € | 176 € | 133 € | 43 € | **3.8×** | 2.7× ✗ | 43 € | M (3/bundle) | 2 800 € |
| AG-1573 Technicien patrimoine ouvrages d'art | 1503 | 203 € | 508 € | 96 € | 41 € | 56 € | 2.1× ✗ | 0.5× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1574 Gestionnaire du recouvrement des péages en flux libre | 695 | 68 € | 170 € | 54 € | 14 € | 40 € | 1.3× ✗ | 0.5× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1575 Chargé d'exploitation de réseau de bornes de recharge | 2225 | 209 € | 522 € | 82 € | 42 € | 40 € | 2.5× ✗ | 1.3× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1576 Responsable d'exploitation de stationnement | 191 | 27 € | 67 € | 47 € | 5 € | 41 € | 0.6× ✗ | 0.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1577 Responsable des opérations d'exploitant de drones | 1654 | 196 € | 491 € | 84 € | 39 € | 45 € | 2.3× ✗ | 0.8× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1578 Chargé d'organisation et des process en distribution du courrier | 460 | 64 € | 161 € | 60 € | 13 € | 47 € | 1.1× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1580 Responsable du contrôle des exportations de défense | 1535 | 159 € | 397 € | 97 € | 32 € | 66 € | 1.6× ✗ | 0.4× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1581 Officier de sécurité en entreprise de défense | 1386 | 138 € | 345 € | 72 € | 28 € | 45 € | 1.9× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1582 Ingénieur soutien logistique intégré | 1063 | 148 € | 371 € | 95 € | 30 € | 66 € | 1.6× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1583 Ingénieur homologation véhicule | 913 | 99 € | 249 € | 86 € | 20 € | 66 € | 1.2× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1584 Chargé de programmation de production automobile | 249 | 33 € | 83 € | 60 € | 7 € | 53 € | 0.6× ✗ | 0.1× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1585 Ingénieur RAMS ferroviaire | 910 | 127 € | 317 € | 91 € | 25 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1586 Ingénieur certification et autorisation ferroviaire | 1363 | 163 € | 406 € | 98 € | 33 € | 66 € | 1.6× ✗ | 0.4× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1587 Ingénieur procédés en microélectronique | 935 | 103 € | 257 € | 95 € | 21 € | 75 € | 1.1× ✗ | 0.2× ✗ | 75 € | XL (6/bundle) | 2 800 € |
| AG-1588 Ingénieur rendement en fabrication de semi-conducteurs | 932 | 95 € | 238 € | 94 € | 19 € | 75 € | 1.0× ✗ | 0.2× ✗ | 75 € | XL (6/bundle) | 2 800 € |
| AG-1589 Attaché de recherche clinique | 910 | 92 € | 230 € | 65 € | 18 € | 47 € | 1.4× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1590 Technicien de bioproduction | 815 | 86 € | 215 € | 68 € | 17 € | 51 € | 1.3× ✗ | 0.4× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1591 Ingénieur programmation et optimisation de raffinerie | 333 | 47 € | 116 € | 75 € | 9 € | 66 € | 0.6× ✗ | 0.1× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1592 Inspecteur d'équipements en raffinerie | 1509 | 183 € | 457 € | 102 € | 37 € | 66 € | 1.8× ✗ | 0.4× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1593 Chef de projet démantèlement nucléaire | 764 | 107 € | 266 € | 87 € | 21 € | 66 € | 1.2× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1594 Ingénieur filière déchets radioactifs | 1055 | 147 € | 369 € | 95 € | 30 € | 66 € | 1.6× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1595 Géologue d'exploration minière | 1801 | 224 € | 559 € | 110 € | 45 € | 66 € | 2.0× ✗ | 0.5× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1596 Ingénieur planification minière | 187 | 26 € | 65 € | 76 € | 5 € | 70 € | 0.3× ✗ | 0.1× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1597 Essayeur en métaux précieux | 1411 | 197 € | 493 € | 86 € | 39 € | 47 € | 2.3× ✗ | 0.8× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1598 Gestionnaire de comptes-poids en affinage | 2405 | 308 € | 771 € | 112 € | 62 € | 51 € | 2.7× ✗ | 1.1× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1600 Technico-commercial en productions végétales | 460 | 64 € | 160 € | 60 € | 13 € | 47 € | 1.1× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1601 Chef de silo | 935 | 131 € | 327 € | 77 € | 26 € | 51 € | 1.7× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1602 Chargé de la vie coopérative et des adhérents | 1052 | 147 € | 368 € | 80 € | 29 € | 51 € | 1.8× ✗ | 1.8× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1603 Analyste marché céréales | 71 | 8 € | 21 € | 72 € | 2 € | 70 € | 0.1× ✗ | 0.0× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1604 Chef meunier | 394 | 55 € | 138 € | 58 € | 11 € | 47 € | 0.9× ✗ | 0.2× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1605 Formulateur en nutrition animale | 911 | 127 € | 318 € | 91 € | 25 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1606 Technico-commercial en nutrition animale | 910 | 99 € | 248 € | 67 € | 20 € | 47 € | 1.5× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1607 Responsable de fabrication en usine d'aliments | 695 | 97 € | 242 € | 66 € | 19 € | 47 € | 1.5× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1608 Responsable de production en microbrasserie | 220 | 31 € | 77 € | 51 € | 6 € | 45 € | 0.6× ✗ | 0.1× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1609 Maître distillateur | 336 | 47 € | 118 € | 60 € | 9 € | 51 € | 0.8× ✗ | 0.8× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1610 Gestionnaire douane et accises | 215 | 30 € | 75 € | 51 € | 6 € | 45 € | 0.6× ✗ | 0.1× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1611 Responsable d'exploitation de criée | 279 | 32 € | 80 € | 57 € | 6 € | 51 € | 0.6× ✗ | 0.1× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1612 Gestionnaire des ventes et règlements de criée | 129 | 16 € | 41 € | 50 € | 3 € | 47 € | 0.3× ✗ | 0.1× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1613 Conservateur de réserve naturelle | 761 | 106 € | 266 € | 72 € | 21 € | 51 € | 1.5× ✗ | 1.5× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1614 Animateur de site Natura 2000 | 1201 | 140 € | 350 € | 79 € | 28 € | 51 € | 1.8× ✗ | 1.8× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1615 Technicien de fédération départementale des chasseurs | 906 | 127 € | 317 € | 70 € | 25 € | 45 € | 1.8× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1616 Gestionnaire des dégâts de grand gibier | 1081 | 151 € | 378 € | 75 € | 30 € | 45 € | 2.0× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1617 Gestionnaire de domaine de chasse | 1505 | 210 € | 526 € | 78 € | 42 € | 36 € | 2.7× ✗ | 2.5× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1620 Responsable de site multitechnique | 786 | 103 € | 257 € | 74 € | 21 € | 53 € | 1.4× ✗ | 0.4× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1621 Chargé d'affaires en maintenance multitechnique | 911 | 99 € | 248 € | 90 € | 20 € | 70 € | 1.1× ✗ | 0.2× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1622 Chargé d'études acoustiques | 1204 | 140 € | 351 € | 107 € | 28 € | 79 € | 1.3× ✗ | 0.3× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1623 Technicien de mesures acoustiques et vibratoires | 1055 | 141 € | 351 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1624 Ingénieur géotechnicien | 1654 | 203 € | 508 € | 120 € | 41 € | 79 € | 1.7× ✗ | 0.5× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1625 Technicien géotechnicien | 910 | 120 € | 300 € | 71 € | 24 € | 47 € | 1.7× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1626 Ingénieur en sécurité incendie | 1800 | 189 € | 472 € | 117 € | 38 € | 79 € | 1.6× ✗ | 0.4× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1627 Coordonnateur SSI | 1354 | 161 € | 403 € | 112 € | 32 € | 79 € | 1.4× ✗ | 0.4× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1628 Chargé d'affaires en travaux sur cordes | 1060 | 120 € | 300 € | 87 € | 24 € | 63 € | 1.4× ✗ | 0.3× ✗ | 63 € | XL (8/bundle) | 2 800 € |
| AG-1629 Ingénieur études et méthodes en travaux souterrains | 780 | 102 € | 255 € | 100 € | 20 € | 79 € | 1.0× ✗ | 0.2× ✗ | 79 € | XL (6/bundle) | 2 800 € |
| AG-1630 Ingénieur instrumentation et auscultation | 939 | 103 € | 258 € | 113 € | 21 € | 92 € | 0.9× ✗ | 0.2× ✗ | 92 € | XL (5/bundle) | 2 800 € |
| AG-1631 Chargé d'études en urbanisme | 1804 | 245 € | 613 € | 123 € | 49 € | 74 € | 2.0× ✗ | 0.5× ✗ | 74 € | XL (7/bundle) | 2 800 € |
| AG-1632 Paysagiste concepteur | 754 | 98 € | 246 € | 75 € | 20 € | 56 € | 1.3× ✗ | 0.2× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1633 Architecte naval | 1204 | 161 € | 403 € | 106 € | 32 € | 74 € | 1.5× ✗ | 0.4× ✗ | 74 € | XL (7/bundle) | 2 800 € |
| AG-1634 Technicien d'études en éclairage public | 900 | 126 € | 314 € | 85 € | 25 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1635 Responsable d'affaires en éclairage public et signalisation lumineuse | 783 | 81 € | 204 € | 91 € | 16 € | 75 € | 0.9× ✗ | 0.2× ✗ | 75 € | XL (6/bundle) | 2 800 € |
| AG-1640 Analyste en financement de projets | 1055 | 120 € | 299 € | 90 € | 24 € | 66 € | 1.3× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1641 Gestionnaire d'agence de crédits syndiqués | 1531 | 186 € | 465 € | 84 € | 37 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1642 Gestionnaire middle office des marchés de capitaux | 125 | 16 € | 40 € | 56 € | 3 € | 53 € | 0.3× ✗ | 0.1× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1643 Analyste crédit en financement participatif | 1350 | 147 € | 367 € | 95 € | 29 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1644 Gestionnaire des investisseurs et des remboursements | 336 | 33 € | 83 € | 57 € | 7 € | 51 € | 0.6× ✗ | 0.1× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1645 Programmateur gaz et électricité | 812 | 79 € | 196 € | 72 € | 16 € | 57 € | 1.1× ✗ | 0.3× ✗ | 54 € | L (5/bundle) | 2 800 € |
| AG-1646 Analyste risques de marché en négoce d'énergie | 844 | 90 € | 225 € | 93 € | 18 € | 75 € | 1.0× ✗ | 0.2× ✗ | 75 € | XL (6/bundle) | 2 800 € |
| AG-1647 Opérateur de négoce de matières premières | 1800 | 189 € | 472 € | 88 € | 38 € | 51 € | 2.1× ✗ | 0.7× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1648 Chasseur de têtes | 1059 | 120 € | 300 € | 90 € | 24 € | 66 € | 1.3× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1649 Généalogiste successoral | 1054 | 119 € | 299 € | 69 € | 24 € | 45 € | 1.7× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1650 Généalogiste régleur | 1059 | 148 € | 369 € | 77 € | 30 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1651 Commissaire d'avaries | 1800 | 189 € | 472 € | 85 € | 38 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1652 Expert en sinistres aéronautiques | 1204 | 133 € | 333 € | 87 € | 27 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1653 Dispacheur | 1230 | 144 € | 360 € | 89 € | 29 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1654 Ergonome consultant | 1651 | 203 € | 507 € | 101 € | 41 € | 60 € | 2.0× ✗ | 0.5× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1655 Intervenant en prévention des risques professionnels | 1052 | 147 € | 368 € | 74 € | 29 € | 45 € | 2.0× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1656 Opérateur de télésurveillance | 9450 | 882 € | 2 205 € | 220 € | 176 € | 44 € | **4.0×** | **3.0×** | 44 € | M (3/bundle) | 2 800 € |
| AG-1657 Chef de poste de télésurveillance | 1211 | 169 € | 423 € | 81 € | 34 € | 47 € | 2.1× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1658 Responsable qualité RABC en blanchisserie industrielle | 1389 | 138 € | 345 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1659 Gestionnaire de clientèle en location-entretien de linge | 1356 | 162 € | 404 € | 75 € | 32 € | 43 € | 2.2× ✗ | 2.1× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1660 Chargé de relation donneurs en établissement de transfusion sanguine | 1415 | 134 € | 334 € | 67 € | 27 € | 40 € | 2.0× ✗ | 0.9× ✗ | 40 € | M (4/bundle) | 2 800 € |
| AG-1661 Chargé de promotion du don et de développement territorial | 1060 | 106 € | 265 € | 62 € | 21 € | 41 € | 1.7× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1662 Coordinateur patient en chirurgie et médecine esthétique | 1414 | 140 € | 351 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1663 Conseiller pédagogique en soutien scolaire | 940 | 96 € | 240 € | 62 € | 19 € | 43 € | 1.6× ✗ | 1.5× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1664 Coordinateur pédagogique d'école de langues | 910 | 127 € | 318 € | 67 € | 25 € | 41 € | 1.9× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1665 Chargé de relations entreprises en centre de formation d'apprentis | 940 | 89 € | 223 € | 60 € | 18 € | 43 € | 1.5× ✗ | 1.4× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1666 Gestionnaire administratif des contrats d'apprentissage | 1236 | 117 € | 292 € | 65 € | 23 € | 41 € | 1.8× ✗ | 1.7× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1667 Coordinateur de programme humanitaire | 311 | 43 € | 108 € | 74 € | 9 € | 66 € | 0.6× ✗ | 0.1× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1668 Logisticien de l'action humanitaire | 761 | 78 € | 196 € | 58 € | 16 € | 43 € | 1.3× ✗ | 1.3× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1669 Économe diocésain | 907 | 127 € | 317 € | 70 € | 25 € | 45 € | 1.8× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1670 Secrétaire de paroisse | 1814 | 226 € | 564 € | 86 € | 45 € | 41 € | 2.6× ✗ | 2.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1671 Agent de greffe pénitentiaire | 1414 | 142 € | 354 € | 94 € | 28 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1672 Responsable de site en gestion déléguée pénitentiaire | 762 | 106 € | 266 € | 72 € | 21 € | 51 € | 1.5× ✗ | 0.4× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1673 Gestionnaire indemnisation et carrière des sapeurs-pompiers volontaires | 612 | 57 € | 143 € | 53 € | 11 € | 41 € | 1.1× ✗ | 1.0× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1674 Assistant prévision et défense extérieure contre l'incendie | 1356 | 161 € | 404 € | 98 € | 32 € | 65 € | 1.6× ✗ | 1.1× ✗ | 48 € | M (2/bundle) | 2 800 € |
| AG-1675 Conservateur de cimetière | 1385 | 194 € | 484 € | 77 € | 39 € | 39 € | 2.5× ✗ | 2.3× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1676 Responsable de crématorium | 667 | 92 € | 230 € | 60 € | 18 € | 41 € | 1.5× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1677 Conseiller funéraire animalier | 1262 | 120 € | 301 € | 65 € | 24 € | 41 € | 1.8× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1678 Première d'atelier en haute couture | 1509 | 183 € | 457 € | 102 € | 37 € | 65 € | 1.8× ✗ | 1.2× ✗ | 48 € | M (2/bundle) | 2 800 € |
| AG-1679 Secrétaire du service prévention en SDIS | 935 | 129 € | 323 € | 67 € | 26 € | 41 € | 1.9× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1680 Ingénieur procédé fusion verrière | 816 | 113 € | 282 € | 93 € | 23 € | 70 € | 1.2× ✗ | 0.3× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1681 Responsable qualité bout froid en verrerie | 1411 | 196 € | 490 € | 114 € | 39 € | 75 € | 1.7× ✗ | 0.4× ✗ | 75 € | XL (6/bundle) | 2 800 € |
| AG-1682 Ingénieur procédés en cimenterie | 365 | 50 € | 124 € | 80 € | 10 € | 70 € | 0.6× ✗ | 0.1× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1683 Responsable des combustibles de substitution en cimenterie | 670 | 93 € | 233 € | 84 € | 19 € | 66 € | 1.1× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1684 Chargé d'homologation des produits phytopharmaceutiques | 1955 | 273 € | 683 € | 120 € | 55 € | 66 € | 2.3× ✗ | 0.6× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1685 Responsable d'expérimentation agronomique sous BPE | 1084 | 124 € | 309 € | 90 € | 25 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1686 Acheteur de graines oléagineuses | 819 | 107 € | 269 € | 92 € | 21 € | 70 € | 1.2× ✗ | 0.3× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1687 Ingénieur procédés en huilerie | 812 | 112 € | 280 € | 88 € | 22 € | 66 € | 1.3× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1688 Chargé de conformité réglementaire des produits du tabac | 1385 | 194 € | 484 € | 99 € | 39 € | 60 € | 2.0× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1689 Responsable des mélanges de tabacs | 1385 | 166 € | 414 € | 93 € | 33 € | 60 € | 1.8× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1691 Responsable de production en distillerie | 695 | 96 € | 239 € | 85 € | 19 € | 66 € | 1.1× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1692 Évaluateur en parfumerie | 1654 | 224 € | 561 € | 111 € | 45 € | 66 € | 2.0× ✗ | 0.5× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1693 Chargé d'affaires réglementaires en parfumerie et arômes | 1955 | 273 € | 683 € | 125 € | 55 € | 70 € | 2.2× ✗ | 0.6× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1694 Ingénieur d'offres en câbles d'énergie | 1230 | 172 € | 430 € | 105 € | 34 € | 70 € | 1.6× ✗ | 0.4× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1695 Contrôleur de gestion métal en câblerie | 125 | 16 € | 40 € | 69 € | 3 € | 66 € | 0.2× ✗ | 0.0× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1696 Conseiller technique en laboratoire de prescription de verres | 1981 | 220 € | 549 € | 114 € | 44 € | 70 € | 1.9× ✗ | 0.5× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1697 Responsable de la comptabilité matières en impression fiduciaire | 1265 | 149 € | 372 € | 96 € | 30 € | 66 € | 1.6× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1698 Chef de projet documents sécurisés | 1984 | 277 € | 693 € | 121 € | 55 € | 66 € | 2.3× ✗ | 0.6× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1699 Responsable moulerie en verrerie | 220 | 29 € | 73 € | 72 € | 6 € | 66 € | 0.4× ✗ | 0.1× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1700 Gestionnaire de configuration aéronautique | 940 | 103 € | 258 € | 86 € | 21 € | 66 € | 1.2× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1701 Ingénieur certification et navigabilité | 1360 | 134 € | 335 € | 87 € | 27 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1702 Ingénieur assurance produit spatial | 1059 | 120 € | 300 € | 84 € | 24 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1703 Ingénieur AIT de satellites | 1085 | 124 € | 309 € | 72 € | 25 € | 47 € | 1.7× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1704 Contrôleur satellites | 2281 | 214 € | 535 € | 96 € | 43 € | 53 € | 2.2× ✗ | 0.8× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1705 Ingénieur dynamique du vol | 790 | 81 € | 202 € | 82 € | 16 € | 66 € | 1.0× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1706 Ingénieur coordination des fréquences satellitaires | 1056 | 113 € | 282 € | 83 € | 23 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1707 Technicien méthodes composites | 1110 | 127 € | 318 € | 76 € | 25 € | 51 € | 1.7× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1708 Technicien en contrôle non destructif des composites | 1356 | 162 € | 404 € | 79 € | 32 € | 47 € | 2.0× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1709 Ingénieur d'essais en soufflerie | 1055 | 120 € | 299 € | 90 € | 24 € | 66 € | 1.3× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1710 Ingénieur essais de choc et sécurité passive | 935 | 103 € | 257 € | 86 € | 21 € | 66 € | 1.2× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1711 Chargé du bureau des utilisateurs d'une grande infrastructure de recherche | 1655 | 196 € | 491 € | 90 € | 39 € | 51 € | 2.2× ✗ | 0.8× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1712 Conseiller en radioprotection | 907 | 99 € | 247 € | 80 € | 20 € | 60 € | 1.2× ✗ | 0.2× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1713 Gestionnaire de biobanque | 1382 | 186 € | 465 € | 84 € | 37 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1714 Chargé de conservation des ressources génétiques végétales | 1357 | 190 € | 474 € | 83 € | 38 € | 45 € | 2.3× ✗ | 0.7× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1715 Gestionnaire des saisines et des scellés en police scientifique | 1560 | 183 € | 458 € | 84 € | 37 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1716 Ingénieur de police technique et scientifique | 1201 | 126 € | 315 € | 85 € | 25 € | 60 € | 1.5× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1720 Secrétaire-gestionnaire d'association syndicale d'irrigation | 2254 | 287 € | 718 € | 96 € | 57 € | 39 € | 3.0× ✗ | 2.8× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1721 Chargé de mission gestion quantitative de l'eau | 1532 | 185 € | 462 € | 84 € | 37 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1722 Chargé d'études risque inondation | 1354 | 154 € | 386 € | 101 € | 31 € | 70 € | 1.5× ✗ | 0.3× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1723 Hydrogéologue | 1350 | 189 € | 472 € | 103 € | 38 € | 66 € | 1.8× ✗ | 0.4× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1724 Ingénieur risques naturels | 901 | 119 € | 297 € | 84 € | 24 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1725 Hydrographe | 1500 | 203 € | 507 € | 88 € | 41 € | 47 € | 2.3× ✗ | 0.8× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1726 Chef de projet SIG | 610 | 85 € | 213 € | 64 € | 17 € | 47 € | 1.3× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1727 Chargé de gestion hydraulique des voies navigables | 696 | 74 € | 184 € | 62 € | 15 € | 47 € | 1.2× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1728 Chargé de gestion du domaine public fluvial | 1956 | 218 € | 544 € | 82 € | 44 € | 39 € | 2.6× ✗ | 2.5× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1729 Gestionnaire de station de pilotage | 671 | 94 € | 234 € | 60 € | 19 € | 41 € | 1.6× ✗ | 1.5× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1730 Capitaine d'exploitation en remorquage portuaire | 820 | 115 € | 286 € | 66 € | 23 € | 43 € | 1.8× ✗ | 1.7× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1731 Courtier d'affrètement maritime | 635 | 82 € | 205 € | 91 € | 16 € | 75 € | 0.9× ✗ | 0.2× ✗ | 75 € | XL (6/bundle) | 2 800 € |
| AG-1732 Analyste surestaries | 1535 | 180 € | 449 € | 83 € | 36 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1733 Gestionnaire back-office péage et télépéage | 700 | 68 € | 171 € | 64 € | 14 € | 51 € | 1.1× ✗ | 0.3× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1734 Ingénieur réservoirs | 632 | 81 € | 203 € | 82 € | 16 € | 66 € | 1.0× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1735 Ingénieur forage | 664 | 93 € | 232 € | 84 € | 19 € | 66 € | 1.1× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1736 Responsable de conduite d'unité de valorisation énergétique | 2341 | 323 € | 808 € | 118 € | 65 € | 53 € | 2.8× ✗ | 1.1× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1737 Ingénieur unité de valorisation énergétique | 305 | 43 € | 107 € | 74 € | 9 € | 66 € | 0.6× ✗ | 0.1× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1740 Secrétaire médicale en anatomie et cytologie pathologiques | 1273 | 150 € | 374 € | 81 € | 30 € | 51 € | 1.9× ✗ | 0.6× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1741 Qualiticien en anatomie et cytologie pathologiques | 758 | 106 € | 265 € | 66 € | 21 € | 45 € | 1.6× ✗ | 0.4× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1742 Dosimétriste | 1415 | 142 € | 355 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1743 Physicien médical | 1412 | 197 € | 493 € | 100 € | 39 € | 60 € | 2.0× ✗ | 0.4× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1744 Secrétaire médicale en radiothérapie | 844 | 117 € | 292 € | 76 € | 23 € | 53 € | 1.5× ✗ | 0.5× ✗ | 51 € | L (5/bundle) | 2 800 € |
| AG-1745 Juriste en droit des marques | 784 | 109 € | 274 € | 88 € | 22 € | 66 € | 1.3× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1746 Ingénieur patrimonial en banque privée | 755 | 91 € | 228 € | 84 € | 18 € | 66 € | 1.1× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1747 Family officer | 758 | 106 € | 265 € | 87 € | 21 € | 66 € | 1.2× ✗ | 0.2× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1748 Juriste contentieux d'entreprise | 932 | 130 € | 326 € | 92 € | 26 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1749 Chef de projet élections | 2370 | 296 € | 741 € | 106 € | 59 € | 47 € | 2.8× ✗ | 1.1× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1750 Chargé de projet élections professionnelles | 751 | 105 € | 262 € | 66 € | 21 € | 45 € | 1.6× ✗ | 0.4× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1751 Coordinateur transport d'œuvres d'art | 2250 | 252 € | 629 € | 101 € | 50 € | 51 € | 2.5× ✗ | 0.9× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1752 Chargé d'affaires en transport d'œuvres d'art | 1509 | 155 € | 387 € | 78 € | 31 € | 47 € | 2.0× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1753 Responsable des études et des formations en école maritime | 461 | 64 € | 161 € | 60 € | 13 € | 47 € | 1.1× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1754 Chargé de formation continue maritime | 1055 | 147 € | 369 € | 77 € | 29 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1755 Responsable pédagogique de formation à la conduite des trains | 757 | 106 € | 265 € | 81 € | 21 € | 60 € | 1.3× ✗ | 0.2× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1756 Gestionnaire des parcours de formation des conducteurs de train | 1059 | 141 € | 352 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1757 Responsable de centre de formation sécurité incendie et secourisme | 757 | 106 € | 265 € | 68 € | 21 € | 47 € | 1.6× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1758 Assistant de formation en sécurité et secourisme | 932 | 130 € | 326 € | 69 € | 26 € | 43 € | 1.9× ✗ | 1.9× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1760 Attaché commercial CHR en torréfaction, cotations cafés | 906 | 99 € | 246 € | 64 € | 20 € | 45 € | 1.5× ✗ | 0.4× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1761 Vendeur en bijouterie-joaillerie, devis de création et de réparation | 1059 | 148 € | 369 € | 74 € | 30 € | 45 € | 2.0× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1762 Conseiller de vente projet en bricolage, métrés et devis | 1204 | 140 € | 350 € | 73 € | 28 € | 45 € | 1.9× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1763 Conseiller en aménagement de jardin, devis de plantation | 1204 | 140 € | 350 € | 84 € | 28 € | 56 € | 1.7× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1764 Libraire chargé des collectivités, devis et marchés publics | 460 | 64 € | 160 € | 57 € | 13 € | 45 € | 1.1× ✗ | 0.3× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1765 Chargé des devis CSE et collectivités en magasin de jouets | 1201 | 140 € | 350 € | 73 € | 28 € | 45 € | 1.9× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1766 Chargé de clientèle clubs et collectivités, devis d'équipement sportif | 1055 | 119 € | 299 € | 69 € | 24 € | 45 € | 1.7× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1767 Concepteur-vendeur en cuisine et ameublement, plans et devis | 1059 | 120 € | 300 € | 79 € | 24 € | 56 € | 1.5× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1768 Préparateur en pharmacie référent maintien à domicile, devis de matériel médical | 910 | 99 € | 247 € | 64 € | 20 € | 45 € | 1.5× ✗ | 0.4× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1769 Vendeur de fruits et légumes aux professionnels, mercuriale et cotations | 785 | 82 € | 205 € | 61 € | 16 € | 45 € | 1.3× ✗ | 0.3× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1770 Chargé de clientèle entreprises en alimentation, devis de coffrets | 1201 | 140 € | 350 € | 73 € | 28 € | 45 € | 1.9× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1771 Conseiller entreprises en boutique opérateur, devis de flotte mobile | 1055 | 147 € | 368 € | 85 € | 29 € | 56 € | 1.7× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1772 Commercial sédentaire B2B en vente en ligne, devis professionnels | 1081 | 115 € | 287 € | 68 € | 23 € | 45 € | 1.7× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1773 Conseiller de vente aux professionnels en électroménager, devis d'équipement | 1055 | 119 € | 298 € | 68 € | 24 € | 45 € | 1.7× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1790 Chargé d'appels d'offres et de cotations en matériel médical | 1234 | 166 € | 414 € | 103 € | 33 € | 70 € | 1.6× ✗ | 0.4× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1791 Technico-commercial sédentaire en hygiène professionnelle | 1205 | 141 € | 351 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1792 Chargé de tarification en distribution alimentaire | 906 | 127 € | 317 € | 72 € | 25 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1793 Chargé de tarification CHR en distribution de boissons | 1056 | 120 € | 299 € | 69 € | 24 € | 45 € | 1.8× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1794 Technico-commercial sédentaire en emballages | 1205 | 127 € | 316 € | 72 € | 25 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1795 Chargé d'appels d'offres et de cotations en fournitures de bureau | 635 | 82 € | 205 € | 63 € | 16 € | 47 € | 1.3× ✗ | 0.3× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1796 Chargé de cotation en négoce textile et habillement | 1351 | 182 € | 455 € | 83 € | 36 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1797 Chargé de cotation import-export | 1204 | 133 € | 333 € | 74 € | 27 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1798 Technico-commercial sédentaire en négoce de bois et panneaux | 1084 | 145 € | 361 € | 76 € | 29 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1799 Technico-commercial sédentaire en négoce de matériaux | 1084 | 145 € | 361 € | 80 € | 29 € | 51 € | 1.8× ✗ | 0.6× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1800 Technico-commercial sédentaire en négoce de métaux | 1084 | 124 € | 309 € | 75 € | 25 € | 51 € | 1.6× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1801 Vendeur conseil sédentaire en pièces automobiles | 1230 | 144 € | 360 € | 79 € | 29 € | 51 € | 1.8× ✗ | 0.6× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1802 Assistant commercial export en négoce de vins et spiritueux | 1654 | 203 € | 508 € | 85 € | 41 € | 45 € | 2.4× ✗ | 0.8× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1803 Technico-commercial sédentaire en sanitaire et chauffage | 1804 | 189 € | 473 € | 85 € | 38 € | 47 € | 2.2× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1804 Technico-commercial sédentaire en matériel électrique | 1354 | 175 € | 438 € | 86 € | 35 € | 51 € | 2.0× ✗ | 0.7× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1805 Technico-commercial sédentaire en quincaillerie et fournitures industrielles | 1056 | 148 € | 369 € | 77 € | 30 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1806 Analyste tarification des offres d'énergie | 1231 | 144 € | 360 € | 99 € | 29 € | 70 € | 1.4× ✗ | 0.3× ✗ | 70 € | XL (7/bundle) | 2 800 € |
| AG-1820 Chargé de devis groupes en transport de voyageurs par autocar | 1659 | 176 € | 439 € | 82 € | 35 € | 47 € | 2.1× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1821 Chargé de cotation en location longue durée de véhicules | 1655 | 175 € | 438 € | 101 € | 35 € | 66 € | 1.7× ✗ | 0.4× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1822 Chargé de devis entreprises en location de véhicules | 1231 | 136 € | 339 € | 74 € | 27 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1823 Chargé de devis en location de matériel et d'engins | 1231 | 136 € | 339 € | 78 € | 27 € | 51 € | 1.7× ✗ | 0.5× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1824 Chargé de réservations et de devis en transport de personnes avec chauffeur | 1681 | 171 € | 427 € | 85 € | 34 € | 51 € | 2.0× ✗ | 0.7× ✗ | 49 € | L (6/bundle) | 2 800 € |
| AG-1825 Chargé de devis de pollinisation et de ventes de miel aux professionnels | 1059 | 120 € | 300 € | 68 € | 24 € | 44 € | 1.8× ✗ | 1.8× ✗ | 30 € | S (1/bundle) | 2 800 € |
| AG-1826 Chargé de cotations en conchyliculture et aquaculture | 1059 | 120 € | 300 € | 69 € | 24 € | 45 € | 1.8× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1827 Chargé d'accueil et de devis en centre équestre | 1055 | 112 € | 281 € | 58 € | 22 € | 36 € | 1.9× ✗ | 1.7× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1828 Chargé de devis en pépinière et horticulture | 1659 | 204 € | 509 € | 101 € | 41 € | 60 € | 2.0× ✗ | 0.5× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1829 Chargé des tarifs et devis professionnels en domaine viticole | 1205 | 140 € | 351 € | 73 € | 28 € | 45 € | 1.9× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1850 Chargé d'affaires en bureau d'études environnement, chiffrage des offres | 1234 | 136 € | 340 € | 93 € | 27 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1851 Chargé d'affaires en sites et sols pollués, chiffrage des offres | 1204 | 133 € | 333 € | 92 € | 27 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1852 Chargé de clientèle en aide à domicile, devis et contrats | 1204 | 133 € | 333 € | 68 € | 27 € | 41 € | 2.0× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1853 Auxiliaire spécialisé vétérinaire, devis de soins et de chirurgie | 485 | 68 € | 169 € | 52 € | 14 € | 39 € | 1.3× ✗ | 1.2× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1854 Chargé de partenariats de club sportif, propositions commerciales | 761 | 106 € | 265 € | 60 € | 21 € | 39 € | 1.8× ✗ | 1.6× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1855 Conseiller commercial en salle de sport, abonnements et devis entreprises | 935 | 101 € | 253 € | 61 € | 20 € | 41 € | 1.6× ✗ | 1.6× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1856 Chef de projet en agence de communication, devis et budgets | 1055 | 113 € | 281 € | 70 € | 23 € | 47 € | 1.6× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1857 Chef de publicité en régie, propositions commerciales et ordres d'insertion | 1204 | 133 € | 333 € | 74 € | 27 € | 47 € | 1.8× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1858 Consultant en relations presse, propositions et honoraires | 1055 | 120 € | 299 € | 69 € | 24 € | 45 € | 1.7× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1859 Chargé d'avant-vente en relation client externalisée, chiffrage des offres | 1204 | 133 € | 333 € | 92 € | 27 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1860 Chef de mission en commissariat aux comptes, lettre de mission | 1052 | 119 € | 298 € | 84 € | 24 € | 60 € | 1.4× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1861 Chef de mission comptable, lettre de mission et honoraires | 1055 | 119 € | 298 € | 68 € | 24 € | 45 € | 1.7× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1862 Chargé de propositions commerciales en cabinet de conseil | 1055 | 120 € | 299 € | 90 € | 24 € | 66 € | 1.3× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1863 Conseiller commercial en centre d'affaires, devis de bureaux et domiciliation | 1204 | 126 € | 315 € | 64 € | 25 € | 39 € | 2.0× ✗ | 1.8× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1864 Clerc de commissaire de justice, devis de constats et honoraires | 1055 | 119 € | 299 € | 75 € | 24 € | 51 € | 1.6× ✗ | 1.6× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1865 Comptable taxateur, estimation des frais d'actes | 1651 | 203 € | 507 € | 85 € | 41 € | 45 € | 2.4× ✗ | 0.8× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1866 Conseiller en formation, propositions et devis de formation | 1084 | 122 € | 305 € | 66 € | 24 € | 41 € | 1.9× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1867 Conseiller en portage salarial, simulations et propositions commerciales | 1201 | 133 € | 332 € | 65 € | 27 € | 39 € | 2.0× ✗ | 1.9× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1868 Chargé d'affaires en recouvrement de créances, mandats et tarification | 1055 | 141 € | 351 € | 73 € | 28 € | 45 € | 1.9× ✗ | 0.6× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1869 Chargé d'affaires en sécurité privée, chiffrage des prestations | 1055 | 119 € | 299 € | 71 € | 24 € | 47 € | 1.7× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1870 Chef de projet en traduction, devis et analyses de volumes | 1230 | 136 € | 339 € | 68 € | 27 € | 41 € | 2.0× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1871 Chargé d'affaires en intérim, coefficients et propositions commerciales | 1055 | 120 € | 299 € | 67 € | 24 € | 43 € | 1.8× ✗ | 1.8× ✗ | 38 € | S (1/bundle) | 2 800 € |
| AG-1880 Chef de projet web en agence digitale, devis et chiffrage des projets | 1055 | 113 € | 281 € | 70 € | 23 € | 47 € | 1.6× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1881 Ingénieur avant-vente en ESN, chiffrage des propositions | 1234 | 136 € | 340 € | 93 € | 27 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1882 Consultant avant-vente data et IA, chiffrage des projets | 1055 | 113 € | 281 € | 88 € | 23 € | 66 € | 1.3× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1883 Ingénieur avant-vente en infogérance, chiffrage des propositions de service | 1055 | 120 € | 299 € | 71 € | 24 € | 47 € | 1.7× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1884 Ingénieur avant-vente en cybersécurité, chiffrage des audits et services | 1084 | 122 € | 305 € | 90 € | 24 € | 66 € | 1.4× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1885 Technico-commercial en maintenance informatique, devis et contrats | 1655 | 203 € | 509 € | 88 € | 41 € | 47 € | 2.3× ✗ | 0.8× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1886 Producteur en studio de jeu vidéo, chiffrage des projets en prestation | 1055 | 113 € | 281 € | 70 € | 23 € | 47 € | 1.6× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1887 Responsable de studio d'enregistrement, devis et réservations de séances | 1531 | 186 € | 465 € | 88 € | 37 € | 51 € | 2.1× ✗ | 2.1× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1888 Consultant en agence d'acquisition, propositions commerciales et honoraires | 1055 | 113 € | 281 € | 70 € | 23 € | 47 € | 1.6× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1889 Ingénieur avant-vente en édition de logiciels, chiffrage des offres | 1205 | 141 € | 351 € | 94 € | 28 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1890 Assistant de conseiller en gestion de patrimoine, lettre de mission | 1055 | 147 € | 369 € | 85 € | 30 € | 56 € | 1.7× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1891 Chargé de propositions et de tarification en banque privée et family office | 1084 | 124 € | 309 € | 80 € | 25 € | 56 € | 1.5× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1892 Chargé de propositions commerciales en conseil RSE et climat | 1085 | 115 € | 288 € | 70 € | 23 € | 47 € | 1.6× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1893 Chargé d'affaires en financement participatif, propositions commerciales | 1055 | 113 € | 281 € | 78 € | 23 € | 56 € | 1.4× ✗ | 0.3× ✗ | 56 € | XL (10/bundle) | 2 800 € |
| AG-1894 Chargé d'affaires en vote électronique, propositions commerciales de scrutin | 1084 | 115 € | 288 € | 74 € | 23 € | 51 € | 1.6× ✗ | 1.6× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1910 Chargé de cotation en manutention portuaire | 1055 | 120 € | 299 € | 71 € | 24 € | 47 € | 1.7× ✗ | 0.5× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1911 Ingénieur d'offres en matériel ferroviaire, chiffrage des appels d'offres | 1230 | 144 € | 360 € | 95 € | 29 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1912 Chargé d'offres en démantèlement nucléaire, chiffrage des prestations | 1204 | 140 € | 351 € | 94 € | 28 € | 66 € | 1.5× ✗ | 0.3× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1913 Commissaire-priseur, estimations et inventaires | 1204 | 140 € | 351 € | 88 € | 28 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1914 Chargé d'affaires en bureau d'études naval, chiffrage des études | 1204 | 133 € | 333 € | 77 € | 27 € | 51 € | 1.7× ✗ | 1.7× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1915 Conseiller en formation aéronautique, devis et plans de financement | 1204 | 140 € | 351 € | 69 € | 28 € | 41 € | 2.0× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1916 Chargé d'offres en transport public urbain, chiffrage des délégations | 1804 | 224 € | 560 € | 111 € | 45 € | 66 € | 2.0× ✗ | 0.5× ✗ | 66 € | XL (8/bundle) | 2 800 € |
| AG-1917 Chargé d'affaires IRVE et stationnement, chiffrage des offres | 1204 | 140 € | 351 € | 88 € | 28 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1918 Chargé d'affaires en prestations par drone, devis de missions | 1204 | 126 € | 316 € | 96 € | 25 € | 71 € | 1.3× ✗ | 0.9× ✗ | 51 € | M (1/bundle) | 2 800 € |
| AG-1919 Ingénieur d'affaires courrier et colis, propositions commerciales | 1201 | 168 € | 420 € | 81 € | 34 € | 47 € | 2.1× ✗ | 0.7× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1920 Chargé de commercialisation groupes en domaine skiable, devis de forfaits | 1084 | 122 € | 305 € | 66 € | 24 € | 41 € | 1.9× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1921 Responsable des ventes séminaires en thalassothérapie, devis de groupes | 1084 | 122 € | 305 € | 66 € | 24 € | 41 € | 1.9× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1922 Responsable des ventes groupes en croisière fluviale, cotations | 1084 | 122 € | 305 € | 66 € | 24 € | 41 € | 1.9× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1940 Chargé de commercialisation en centre aquatique, devis groupes et entreprises | 1060 | 120 € | 300 € | 63 € | 24 € | 39 € | 1.9× ✗ | 1.8× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1941 Chargé des ventes groupes en cinéma, devis de privatisations et scolaires | 1060 | 113 € | 282 € | 61 € | 23 € | 39 € | 1.9× ✗ | 1.7× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1942 Chargé des ventes de droits audiovisuels, propositions commerciales de licences | 1055 | 112 € | 281 € | 67 € | 22 € | 45 € | 1.7× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1943 Média-planneur, chiffrage des recommandations et plans médias | 1201 | 140 € | 350 € | 75 € | 28 € | 47 € | 1.9× ✗ | 0.6× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1944 Chargé de partenariats en écurie de course, propositions commerciales | 1654 | 203 € | 508 € | 79 € | 41 € | 39 € | 2.6× ✗ | 2.4× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1945 Technico-commercial sédentaire en coopérative, cotations des appros | 1059 | 120 € | 300 € | 65 € | 24 € | 41 € | 1.8× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1946 Technico-commercial en meunerie, cotations des farines et contrats clients | 913 | 99 € | 249 € | 67 € | 20 € | 47 € | 1.5× ✗ | 0.4× ✗ | 45 € | L (6/bundle) | 2 800 € |
| AG-1947 Chargé de clientèle en microbrasserie, devis d'événements et cuvées | 1059 | 120 € | 300 € | 60 € | 24 € | 36 € | 2.0× ✗ | 1.8× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1948 Chargé de développement de l'apprentissage en CFA, devis et prise en charge | 1205 | 140 € | 351 € | 69 € | 28 € | 41 € | 2.0× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1949 Assistant d'expertise maritime et aéronautique, devis de missions et honoraires | 1204 | 133 € | 333 € | 71 € | 27 € | 45 € | 1.9× ✗ | 0.5× ✗ | 43 € | L (7/bundle) | 2 800 € |
| AG-1950 Chargé d'affaires en télésurveillance, devis d'abonnement et de raccordement | 1205 | 133 € | 333 € | 65 € | 27 € | 39 € | 2.0× ✗ | 1.9× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1951 Chargé d'affaires en location-entretien de linge, chiffrage des contrats | 1205 | 140 € | 351 € | 67 € | 28 € | 39 € | 2.1× ✗ | 1.9× ✗ | 35 € | S (1/bundle) | 2 800 € |
| AG-1952 Ingénieur avant-vente satellites, chiffrage des propositions commerciales | 1354 | 147 € | 368 € | 89 € | 29 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1953 Chargé des accès industriels en grande infrastructure de recherche, devis | 1205 | 126 € | 316 € | 76 € | 25 € | 51 € | 1.7× ✗ | 1.7× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1954 Chargé de valorisation de biobanque, tarification des cessions | 1056 | 112 € | 281 € | 73 € | 23 € | 51 € | 1.5× ✗ | 1.5× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1955 Gestionnaire des frais de justice en laboratoire d'expertise, devis | 1205 | 134 € | 334 € | 77 € | 27 € | 51 € | 1.7× ✗ | 1.7× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1956 Chargé d'offres en impression fiduciaire, chiffrage des appels d'offres | 1354 | 154 € | 386 € | 91 € | 31 € | 60 € | 1.7× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1970 Chargé de développement en formation maritime, devis et conventions STCW | 1056 | 120 € | 299 € | 60 € | 24 € | 36 € | 2.0× ✗ | 1.8× ✗ | 33 € | S (1/bundle) | 2 800 € |
| AG-1971 Chargé d'affaires en formation ferroviaire, chiffrage des parcours | 1234 | 143 € | 358 € | 79 € | 29 € | 51 € | 1.8× ✗ | 1.8× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1972 Chargé de développement commercial en formation sécurité, devis SSIAP et SST | 1055 | 119 € | 299 € | 65 € | 24 € | 41 € | 1.8× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1973 Chargé d'affaires en hydraulique et risques naturels, chiffrage des offres | 635 | 80 € | 201 € | 76 € | 16 € | 60 € | 1.1× ✗ | 0.2× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1974 Chargé d'affaires en topographie, hydrographie et SIG, chiffrage des levés | 1231 | 136 € | 339 € | 87 € | 27 € | 60 € | 1.6× ✗ | 0.3× ✗ | 60 € | XL (9/bundle) | 2 800 € |
| AG-1975 Chargé d'affaires en remorquage portuaire, cotation des remorquages | 1056 | 120 € | 299 € | 65 € | 24 € | 41 € | 1.8× ✗ | 1.8× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1976 Chargé d'affaires flottes en télépéage, propositions commerciales | 1201 | 133 € | 332 € | 68 € | 27 € | 41 € | 2.0× ✗ | 1.9× ✗ | 37 € | S (1/bundle) | 2 800 € |
| AG-1977 Responsable commercial et des contrats de vente en exploitation agricole | 307 | 36 € | 90 € | 58 € | 7 € | 51 € | 0.6× ✗ | 0.6× ✗ | 40 € | S (1/bundle) | 2 800 € |
| AG-1978 Responsable de la commercialisation des captures en armement de pêche | 670 | 64 € | 161 € | 54 € | 13 € | 41 € | 1.2× ✗ | 1.1× ✗ | 37 € | S (1/bundle) | 2 800 € |

**60 fiches sur 1761 tiennent la règle des 3× en bundle partagé, 22 avec un agent seul sur son bundle.** Un agent seul sur un bundle à carte dédiée (image, vidéo) ne la tient pas : le bundle doit être partagé ou l'agent vendu en mode API.

Lecture : un employé au coût employeur médian revient à 2 800 € par mois, un SMIC chargé à 2 100 €. L'abonnement à l'agent (prix cible du catalogue) s'ajoute aux colonnes Local-Agent et n'entre pas dans la règle des 3×.
