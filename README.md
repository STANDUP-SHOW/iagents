# iagents — agents IA en local avec machines dédiées


Bibliothèque d'agents IA « employés » qui tournent **en local** (ou par API au
choix du client) dans l'application desktop iAgent, vendus sur iagent.agency et
livrés préinstallés sur les machines LocalAgent.

Ce dossier est le **premier jalon** : le contrat qui décrit un agent, le
catalogue normalisé des 1075 postes, cinq agents témoins complets, le moteur de
dimensionnement (pack d'agents ↔ machines) et le générateur de fiches en lot.
L'application desktop et la boutique viennent ensuite et lisent tout ça.

```
contrat/          paquet-agent.md (le pourquoi) + paquet-agent.schema.json (le quoi)
catalogue/        catalogue.json : 1075 agents, 43 secteurs, 12 profils commerciaux (issu du classeur V2)
agents/           un JSON par agent, nommé <ID>-<slug>.json — 5 témoins écrits à la main
dimensionnement/  paliers-modeles.json (modèles locaux → matériel), machines.json (catalogue LocalAgent, EXEMPLES à remplacer),
                  calculer.ts (matériel d'un agent, pack → machines, machine → agents, appels/jour, jauge), son banc
outils/           verifier-paquets.ts (contrat + cohérence), generer-fiches.ts (Batch API Anthropic), lots/ (suivi des lots)
```

## Commandes

```bash
npm install
npm run controle                         # banc du dimensionnement + validation de tous les paquets
npm run verifier -- --corriger           # recalcule materiel / commercial / appels depuis les sources de vérité
npm run generer -- --sec --ids AG-0002   # prépare les requêtes sans rien envoyer
npm run generer -- soumettre --secteur comptabilite         # un lot Anthropic (ANTHROPIC_API_KEY requis)
npm run generer -- relever <batchId>     # écrit agents/*.json, liste les échecs à relancer
```

Le générateur écrit avec `claude-sonnet-5` par défaut (`--modele claude-opus-5`
pour comparer sur quelques fiches). Le modèle ne produit que la partie
éditoriale ; matériel, commercial, exécution et version sont **assemblés depuis
les sources de vérité** puis le paquet entier est validé — un paquet non
conforme n'est jamais écrit.

## Décisions prises

- **Un seul fichier décrit un agent** et sert à la boutique, à l'application, au dimensionnement et aux mises à jour. Rien n'est écrit deux fois : `materiel`, `commercial` et `appelsParJourEstimes` sont dérivés et le validateur refuse toute divergence.
- **Le classeur des 1075 postes ne porte que trois informations propres** (id, secteur, métier) ; ses 13 colonnes commerciales font 12 profils. Les fiches (tâches, connaissances, matériel) sont générées.
- **Local par défaut, API au choix du client** (bloc `execution`, voir le contrat) : bascule automatique avec avertissement, clés du client sur sa machine, jauge de charge dans l'application.
- **Poste + bundle** : le PC du client affiche, un bundle Linux invisible calcule pour toute la flotte (`kitClient`, `role` dans `machines.json`). Un poste ne porte jamais d'agent.
- **Un agent hors local dit pourquoi et ce qu'il faudrait** : `materiel.gpu` (classe de carte minimale) sur la fiche, `diagnosticLocal()` pour la raison ressource par ressource, affichés par `outils/packs.ts`.
- **Deux agents sur le même palier partagent le modèle**, pas la charge : c'est ce qui rend un mini-PC viable pour un pack de bureau (13 postes de bureau sur la machine « studio » d'exemple).
- **Les chiffres de `paliers-modeles.json` sont indicatifs** (quantification 4 bits, GPU de référence classe RTX 4070). À confirmer sur les vraies machines LocalAgent avant toute promesse commerciale. `machines.json` est un jeu d'exemples à remplacer par leur catalogue.

## Ce que l'installeur ne livre pas encore

Le MSI (9,6 Mo) porte l'application, les 1 249 fiches et les catalogues. Il ne
porte **pas** la voix : le modèle d'écoute pèse à lui seul bien plus que tout
le reste réuni, et rien ne le télécharge. Tant qu'elle n'est pas là,
l'agent travaille et écrit ses fichiers, mais il ne parle ni n'écoute, et
l'application le dit en clair au lieu d'échouer sans raison.

Les quatre pièces vont **à côté de l'exécutable installé** (leurs chemins et
leurs rôles sont dans `desktop/src-tauri/src/ressources.rs`, que deux bancs
comparent à ce que l'installeur pose) :

| Pièce | Où la poser | D'où elle vient |
| --- | --- | --- |
| Le moteur de voix Piper | `piper/piper.exe` (Windows), `piper/piper` | les versions publiées de [rhasspy/piper](https://github.com/rhasspy/piper) |
| La voix française | `modeles/fr_FR-siwis-medium.onnx` | [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices), dossier `fr/fr_FR/siwis/medium/` |
| Ses réglages | `modeles/fr_FR-siwis-medium.onnx.json` | le même dossier ; Piper le lit tout seul à côté du modèle |
| Le modèle d'écoute | `modeles/ggml-medium-fr.bin` | [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) |

Deux points restent à trancher :

- **Le nom du modèle d'écoute.** Le code attend `ggml-medium-fr.bin` ; le dépôt
  officiel de whisper.cpp publie `ggml-medium.bin` (multilingue, il transcrit le
  français) et n'a pas de variante `-fr`. Des modèles affinés sur le français
  existent chez des tiers, sous d'autres noms. Soit on renomme le fichier après
  téléchargement, soit on change le chemin attendu : personne n'a encore choisi.
- **Qui les pose.** Aujourd'hui, personne : ni l'installeur, ni un
  téléchargement au premier lancement. Ajouter ce téléchargement demande de
  savoir d'où et à quel poids, ce qui n'est pas décidé.

En développement, trois variables d'environnement déplacent ces fichiers sans
rien installer : `IAGENT_PIPER`, `IAGENT_VOIX`, `IAGENT_MODELE_ECOUTE`.

## État de réalisation (2026-09-19)

Le détail, ce qui reste à faire et ce qui a cassé sont dans `ONBOARDING.md`.

- **Boutique en ligne** : https://iagents-beta.vercel.app (projet Vercel `iagents`,
  redéployé à chaque push sur `main`). Domaine `iagent.agency` attaché, DNS OVH à
  basculer.
- **Fiches** : 1249 paquets valides, `npm run controle` passe (dimensionnement
  15/15, économie 7/7, paquets 0 faute).
- **Dimensionnement et économie** : placement poste + bundle, diagnostic en clair,
  coût API seule contre Local-Agent par fiche (`npm run economie`).
- **Application desktop** (`desktop/`, Tauri 2 + Rust + React) — mise à jour le
  2026-09-23 : elle lit les vraies fiches (`config/installation.json` +
  `agents/`), embauche, exécute les tâches du jour et pose le résultat dans le
  dossier du client ; elle tourne en local par défaut et prévient avant de
  basculer sur l'API ; la jauge dit si la machine tient les agents installés.
  Le workflow « Build Windows MSI » produit un MSI à chaque PR touchant
  `desktop/`. **Personne ne l'a encore installé sur une vraie machine**, et la
  voix demande les quatre pièces ci-dessus.
- **Pas fait** : panier et paiement sur la boutique ; catalogue LocalAgent
  définitif (`machines.json` reste un relevé AliExpress indicatif).
