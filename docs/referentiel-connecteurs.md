# Le catalogue des connecteurs

Le référentiel de max (`Referentiel_iAgent_MCP_API_Moteurs_IA_2026-09-21.xlsx`,
350 références) est la base du catalogue que le client parcourt dans le Desktop
Commander, onglet « Vos connexions » → « Catalogue des connecteurs ».

## D'où vient chaque chose

| Ce qui s'affiche | Où ça vit | Écrit par |
| --- | --- | --- |
| Les 350 lignes, colonne pour colonne | `catalogue/reference/{mcp-serveurs,api-metiers,moteurs-cloud,moteurs-locaux,moteurs-media}.json` | le relevé de max (comparé cellule par cellule le 10/10/2026 : zéro écart) |
| La confiance (officiel, référence, à auditer, connecteur iAgent à écrire) | dérivée de la colonne « Statut » par `confianceDuStatut()` | `outils/referentiel.ts` |
| « Branché » | `connecteurs/serveurs-mcp.json` + règle d'activation du catalogue, ou un moteur que le code joint (marque cherchée dans son fichier source) | `outils/referentiel.ts` |
| Le fichier lu par l'écran | `connecteurs/referentiel.json` | `npm run importer-connecteurs` |

`npm run controle` regénère le fichier en mémoire et refuse tout écart, tout
statut inconnu, et un catalogue où aucun serveur MCP ne serait branché.

## Ce que veut dire « branché »

Un serveur MCP n'est à la portée d'un agent que si les quatre conditions tiennent :
il est déclaré dans `serveurs-mcp.json` avec ses outils relevés, il met en œuvre un
connecteur du catalogue, ce connecteur passe la règle d'activation (éditeur,
authentification, permissions, coût, risque) et la fiche de l'agent déclare un
besoin que ce connecteur sert. Être inscrit au registre MCP ne compte pour rien.

Au 10/10/2026 : **Filesystem** (connecteur OFF029, 13 outils, limité aux dossiers
de l'agent) est le seul serveur MCP branché ; Anthropic API, Ollama, whisper.cpp et
Piper sont joints par l'application elle-même.

Les outils qui modifient (tout outil que le serveur ne déclare pas en lecture
seule) sont **refusés** pendant une conversation ou une tâche : l'agent reçoit un
refus en français et le dit. La validation par le client au fil de la conversation
n'est pas encore écrite.

## Resynchroniser tarifs, licences et disponibilités

Les prix, licences et disponibilités des modèles changent vite. Ils se
resynchronisent par une tâche planifiée, jamais de mémoire :

1. Pour chaque entrée P0 puis P1, ouvrir la page citée dans sa colonne
   « Source officielle » / « Documentation ».
2. Ne corriger une cellule de `catalogue/reference/*.json` que si la page de
   l'éditeur le dit, et porter la nouvelle date dans `verifie`. Une page qui ne
   s'ouvre pas ou se contredit laisse la cellule telle quelle et se signale.
3. Un coût qui ouvre un connecteur va dans `connecteurs/couts.json` avec sa page
   et sa date, comme les autres.
4. `npm run importer-connecteurs`, puis `npm run controle`.
5. Une seule PR « Resynchronisation du référentiel », avec la liste des cellules
   changées et la page qui le dit pour chacune. max seul la fusionne.

Le fichier Excel d'origine est gardé dans `/mnt/project-files/connecteurs/`.
