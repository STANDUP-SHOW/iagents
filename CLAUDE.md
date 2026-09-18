# iAgent — mémo projet

Ce fichier est lu au début de chaque session. Il garde les règles durables et
les pièges vérifiés ; `README.md` dit ce que contient le dépôt et comment le
lancer. Projet distinct de DropShipPro : rien ne se partage entre les deux
dépôts, sauf la vitrine `drop-shipper.fr/b/iagent-agency` qui sert de boutique
en attendant iagent.agency.

## Ce que fait le projet

Une bibliothèque d'agents IA « employés » (1075 postes, 43 secteurs), vendus
sur iagent.agency, exécutés par l'application desktop iAgent **en local sans
tokens facturés** ou **par API au choix du client**, et livrés préinstallés sur
les mini-PC de LocalAgent. Chaque agent est un expert de 25 ans d'expérience,
préconfiguré avec ses tâches quotidiennes, parlé de préférence (voix), joignable
par WhatsApp et email.

## Règles durables

- **Un seul fichier décrit un agent** (`contrat/paquet-agent.md`, schéma dans
  `paquet-agent.schema.json`). Boutique, application, dimensionnement et mises
  à jour lisent le même fichier. Un champ qui existe à deux endroits finira faux
  à l'un des deux.
- **Rien de dérivé n'est écrit à la main.** `materiel`, `commercial`,
  `execution.appelsParJourEstimes` sont recalculés depuis
  `dimensionnement/calculer.ts` et `catalogue/catalogue.json` ;
  `npm run verifier` refuse toute divergence, `--corriger` la répare. Le
  validateur a attrapé dès son premier passage un profil commercial et un
  matériel recopiés faux dans un agent témoin.
- **Local par défaut, API au choix du client, pour tous les agents** (décision
  du 18/09/2026, bloc `execution`). L'application calcule la jauge de la machine
  (`jaugeMachine`) et prévient avant de basculer ; sans clé d'API pour la
  capacité manquante, l'agent s'arrête avec le motif écrit. Les clés du client
  restent sur sa machine, jamais dans un paquet ni chez nous.
- **Les agents d'une machine se relaient sur un modèle chargé une fois.** Deux
  agents sur le même palier partagent les poids, pas la charge : la mémoire se
  compte par palier distinct, la charge par agent. Le banc l'a imposé : compté
  par agent, un seul poste de bureau ne tenait plus sur un mini-PC.
- **Les mini-PC du comparatif n'ont aucun GPU dédié.** Mémoire unifiée : la
  mémoire des modèles, c'est la RAM moins 6 Go de réserve ; un Radeon 780M vaut
  ~0,20 d'une carte de bureau (bande passante mémoire). Conséquence mesurée par
  `outils/packs.ts` : **3 postes de bureau par Firebat AM02 Ryzen 7 (~271 €)**,
  un poste d'analyse (14B) exige 24 Go ou plus, et **les agents image, vidéo,
  musique ne tournent en local sur aucune de ces machines** : ils passent par
  l'API ou par une station à GPU dédié, absente du relevé.
- **Les chiffres de `paliers-modeles.json` et `machines.json` sont indicatifs**
  (quantification 4 bits, GPU de référence classe RTX 4070, prix bas de
  fourchette AliExpress, barebones chiffrés avec RAM et SSD à ajouter). À
  confirmer sur les vraies machines avant toute promesse commerciale. Le NPU
  n'est pas compté : llama.cpp / Ollama ne l'utilisent pas.
- **Le générateur de fiches ne produit que l'éditorial.** Le modèle écrit nom,
  description, expert, tâches, connecteurs, accès, paliers ; tout le reste est
  assemblé depuis les sources de vérité, et un paquet non conforme n'est jamais
  écrit (`outils/lots/<id>-echecs.json`, à relancer avec `--ids`). Batch API
  Anthropic (moitié prix), Sonnet 5 par défaut, `--sec` pour préparer sans
  envoyer. **Les lots tournent dans GitHub Actions** (`generer-fiches.yml`) avec
  la clé en secret du dépôt et livrent une PR `fiches/…` à relire : la clé ne
  vit ni sur une machine ni dans le dépôt.
- **Pas de connexion automatique aux comptes du client, pas de clic « Publier »
  sans validation, pas de contournement anti-robot.** Mêmes règles que
  DropShipPro : l'agent navigue avec les sessions ouvertes du client, remplit,
  le client valide. Les règles qui comptent sont appliquées par le code
  (`expert.regles` → l'application), pas seulement lues par le modèle.

## Commandes

```bash
npm install
npm run controle              # banc du dimensionnement + validation des paquets
npm run verifier -- --corriger
npm run generer -- --sec --ids AG-0002
node --experimental-strip-types outils/packs.ts   # quel agent sur quelle machine
npx tsc --noEmit
```

## Conventions

- Interface, fiches et messages en français ; commentaires de code en anglais.
- Vérifier avant d'affirmer ; ne jamais annoncer qu'une chose fonctionne sans
  l'avoir constatée.
- Les secrets vont dans `.env` (exclu de git), jamais dans le dépôt.

## Chantier

1. Application desktop iAgent (Electron + TypeScript, moteur de modèles locaux
   type Ollama, Playwright pour le navigateur) : parcours minimal installer →
   se connecter → télécharger un agent → une tâche s'exécute → résultat dans le
   dossier → conversation vocale.
2. Premier lot de fiches : un secteur de 25, relu, puis les 544 P1.
3. Boutique : `drop-shipper.fr/b/iagent-agency` reste la vitrine ; les paquets
   deviennent des produits par le flux ; `iagent.agency` (OVH) à pointer dessus.
4. Catalogue LocalAgent définitif (références retenues, prix négociés) à la
   place du relevé AliExpress.
