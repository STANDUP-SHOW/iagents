# Référentiel — données extraites des documents de cadrage

Extraits le 22/09/2026 des deux tableurs de Max, vérifiés au 21/09/2026 :
`catalogue_1075_agents_IA_V6_connecteurs_MCP.xlsx` et
`Referentiel_iAgent_MCP_API_Moteurs_IA_2026-09-21.xlsx`.

Ils sont versionnés ici parce qu'un fichier joint à une conversation disparaît,
et que c'est la matière la plus précieuse du cadrage. **Ce sont des données de
référence, pas des champs dérivés** : rien ici n'est recalculé par
`npm run verifier`, et rien n'est encore lu par l'application. L'entrée dans le
code se fait aux jalons A et B de `docs/cadrage.md`.

| Fichier | Contenu | Sert à |
|---|---|---|
| `metiers-officiels.json` | 1 075 métiers : identifiant, secteur, intitulé, pack, ERP/CRM cœur | Corriger les intitulés des fiches, dériver la liste par métier |
| `ecarts.json` | 91 fiches au mauvais métier + 174 fiches hors catalogue | Le travail du jalon A |
| `packs-secteurs.json` | 43 AI Offices de 25 agents | Format des packs d'entreprise |
| `packs-erp-crm.json` | Par secteur : ERP/CRM cœur, optionnels, canaux, bureautique | **La liste déroulante CRM/ERP par métier** |
| `connecteurs-erp-crm.json` | 77 ERP/CRM | Fiches connecteur |
| `connecteurs-communication.json` | 28 canaux | Fiches connecteur |
| `connecteurs-bureautique.json` | 32 outils | Fiches connecteur |
| `guide-connexion-mcp.json` | Par profil : secret, test, révocation | Parcours de connexion |
| `mcp-serveurs.json` | 74 serveurs MCP, statut d'audit et risque | Client MCP du jalon B |
| `api-metiers.json` | 131 API officielles | Connecteurs sans MCP fiable |
| `moteurs-cloud.json` / `moteurs-locaux.json` / `moteurs-media.json` | 36 / 43 / 66 moteurs | Choix du modèle et routage |
| `machines-local-agent.json` | Tiers LA-S à LA-Flotte | À réconcilier avec `dimensionnement/machines.json` |

Les prix des machines portent la mention « indication commerciale à confirmer
par devis » : elle vaut toujours. Les chiffres qui partent en clientèle sortent
de `dimensionnement/`, jamais d'ici.
