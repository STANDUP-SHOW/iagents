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

## État de réalisation (2026-09-19)

### ✅ Complété

- **Dépôt Git** : https://github.com/STANDUP-SHOW/iagents
- **Catalogue agents** : 1249 paquets valides (tous secteurs)
- **Validation** : `npm run controle` passe (dimensionnement 15/15, économie 7/7, paquets 0 faute)
- **Dimensionnement** : placement sur machines (Firebat S/M/L, bundles), jauge de charge, diagnostique raison
- **Économie** : coût comparé API seule vs local, calcul par agent et en flotte
- **Application desktop** : Phase 1-7 complète (Tauri + React, audio/Vosk/LLM/TTS/database/Telegram)
  - Voice pipeline: Mic → Vosk → Agent Router → Claude Haiku 3.5 → pyttsx3 → Speaker
  - SQLite persistence pour voice prints et connecteurs
  - Prête pour Phase 8 (Windows build)
- **Tests** : tous les bancs passent (dimensionnement, économie, paquets)

### ⏳ À faire

1. **Windows build** (Phase 8) : `npm run build` sur machine Windows, résultat MSI installer
2. **Catalogue LocalAgent définitif** : remplacer `machines.json` par références réelles, prix, stock
3. **Boutique iagent.agency** : vitrine produits, panier, paiement (actuellement sur `drop-shipper.fr/b/iagent-agency`)
4. **Automate de génération** : GitHub Actions pour lots futurs (ANTHROPIC_API_KEY en secret du dépôt)
