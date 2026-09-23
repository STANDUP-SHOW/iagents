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
- **Architecture poste + bundle (Max, 19/09/2026).** Le client garde un PC
  Windows (le sien ou un mini-PC N150 à ~170 €, un par personne ou par agent)
  qui porte l'application, le navigateur, la voix, les fichiers. Le calcul est
  dans un **bundle Linux invisible** à adresse fixe sur le réseau, préchargé,
  qui sert toute la flotte. `machines.json` distingue `role: poste` et
  `role: bundle` (gammes S mini-PC intégré, M/L/XL/Flotte carte NVIDIA) ;
  `kitClient()` = bundles + postes. **Un poste ne porte jamais d'agent.**
  Placement : plusieurs plans comparés, prime de 15 % au boîtier unique
  (`PRIME_BOITIER_UNIQUE`) — sans elle, vingt agents s'émiettaient sur quatre
  boîtiers pour le prix d'un seul bundle L. Résultat au 19/09 : 3 agents sur un
  Firebat AM02 (271 €), 10 sur un eGPU RTX 3070 (~930 €), 20 sur un bundle L
  5070 Ti (~1 900 €), 50 sur un XL 5090 (~3 800 €).
- **Le Jetson de l'étude est cher pour ce qu'il débite.** Orin NX 16 Go à
  ~1 008 € : 100 TOPS en entier 8 bits mais 102 Go/s de bande passante, soit le
  MÊME débit qu'un mini-PC Radeon 780M à 271 € sur un modèle de langage ; AGX
  Orin 64 Go à ~4 500 € : un quart d'une 5070 Ti à 1 900 €. Le banc vérifie
  qu'il n'est jamais retenu sur le prix. À réserver à qui exige une appliance
  silencieuse basse consommation. `capaciteGpu` = bande passante / 504 Go/s.
- **Les mini-PC du comparatif n'ont aucun GPU dédié.** Mémoire unifiée : la
  mémoire des modèles, c'est la RAM moins 6 Go de réserve ; un Radeon 780M vaut
  ~0,20 d'une carte de bureau (bande passante mémoire). Conséquence mesurée par
  `outils/packs.ts` : **3 postes de bureau par Firebat AM02 Ryzen 7 (~271 €)**,
  un poste d'analyse (14B) exige 24 Go ou plus, et **les agents image, vidéo,
  musique ne tournent en local sur aucune de ces machines** : ils passent par
  l'API ou par une station à GPU dédié, absente du relevé.
- **Un agent qui ne tourne pas en local dit toujours pourquoi, et quelle
  configuration il faudrait** (demande de Max, 18/09/2026). `materiel.gpu`
  porte la classe de carte minimale (intégré, dédiée 8/12/16/24 Go, serveur),
  dérivée de la charge et de la mémoire des modèles ; `diagnosticLocal()`
  compare aux machines ressource par ressource et rend la raison en clair.
  Règle de mémoire qui va avec : texte, audio et embeddings restent chargés ;
  image, vidéo, vision et musique se chargent un à la fois. Sur le comparatif
  AliExpress, un community manager (image rapide) réclame une carte 16 Go et
  un designer (image qualité) une 24 Go : c'est la puissance qui manque, pas
  la mémoire.
- **L'argument de vente est le coût sur un an : matériel + API résiduelle au
  moins 3× moins cher que l'API seule** (Max, 19/09/2026). `economie.ts` le
  calcule par agent depuis sa fiche : exécutions par mois (planification),
  tours par exécution (navigateur, document lourd), prix Sonnet 5 et Opus 5 du
  jour, 20 % d'API résiduelle, bundle amorti sur 12 mois plus électricité,
  employé médian et SMIC chargé en face. `docs/economie.md` (npm run economie)
  donne la table pour toutes les fiches. **Toutes les hypothèses sont dans
  `tarifs-api.json` et doivent être remplacées par la mesure** dès qu'un agent
  tourne (tours et jetons consignés). Résultat au 19/09 : un poste de bureau
  passe la règle en bundle partagé (≈ 290 € d'API seule contre ≈ 90 €), un
  designer seul sur un bundle XL ne la passe pas (ratio 0,5) : les agents
  image et vidéo se vendent en bundle partagé ou en mode API, jamais seuls
  sur une carte dédiée. Le banc `check-economie.ts` tient ces deux vérités.
- **Les fiches sont écrites par Claude Code sur l'abonnement de Max, pas par
  l'API** (19/09/2026). Le workflow Batch reste dans le dépôt (il a servi au
  lot Administration, 24 fiches pour 0,60 $) mais ne se relance plus : les
  secteurs suivants sont écrits en session, validés par `npm run verifier`,
  poussés secteur par secteur.
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
  vit ni sur une machine ni dans le dépôt. **Une clé créée au niveau de
  l'organisation (hors espace de travail) est refusée en 400** « not scoped to
  a workspace » : soit créer la clé DANS un espace de travail de la console,
  soit poser aussi le secret `ANTHROPIC_WORKSPACE_ID` (en-tête
  `anthropic-workspace-id`). Vu au run n°2 du 18/09/2026.
- **Une qualification logicielle se déclare par identifiant, jamais en texte libre**
  (Max, 22/09/2026). `catalogue/logiciels.json` est le référentiel des outils métier
  du marché européen (611 entrées au 22/09 : ERP, CRM, compta, paie, SIRH, ATS,
  e-commerce, caisse, WMS/TMS, BTP, immobilier, santé, juridique, assurance,
  hôtellerie, automobile, terrain, industrie, bureautique). Le bloc
  `qualifications` d'une fiche ne cite que des `LOG-XXXX` existants ;
  `npm run verifier` refuse le reste. **Savoir tenir un outil et y être branché sont
  deux choses** : le niveau d'accès réel (`acces.api`, `acces.mcp`,
  `acces.navigateur`) vit dans le référentiel et nulle part ailleurs, pour que la
  boutique ne promette pas un connecteur qui n'existe pas. Les données du
  référentiel sont indicatives et à confirmer sur un compte réel. Le relevé V6 de
  Max (`catalogue/reference/connecteurs-erp-crm.json`) reste couvert nom par nom :
  `npm run verifier-logiciels` échoue si l'un de ses produits disparaît.
- **Le client règle ses logiciels à l'oral, pendant l'entretien d'embauche**
  (Max, 22/09/2026). L'agent ouvre la conversation, demande ce que tourne
  l'entreprise, reconnaît la réponse dans le référentiel (nom ou alias) et écrit sa
  propre configuration. C'est la première impression du produit.
- **Une fiche dit de quel poste elle reçoit et à quel poste elle transmet**
  (bloc `relais`). Un groupe d'agents doit pouvoir faire tourner une entreprise sans
  humain intermédiaire ; sans ce bloc, chaque fiche est un îlot. Quand le relais
  nomme un agent du catalogue, le libellé du poste vient du catalogue, pas de la fiche.
- **Trois fiches sont citées par le banc de l'application** (`desktop/src/config/installation.json` : AG-0179, AG-0196, AG-0028, et
  `check-agents.ts` nomme leurs tâches). Réécrire une de ces fiches change ses
  identifiants de tâches et casse `check-agents` — qui s'arrête sur une exception,
  pas sur un message de banc. Toujours lancer `npm run controle` en entier après
  une réécriture, jamais `npm run verifier` seul.
- **Un connecteur ne s'allume qu'après identification de son éditeur, de son
  authentification, de ses permissions, de son coût et de son risque** (règle que
  le référentiel V6 pose lui-même, `docs/cadrage.md` §4.3). Elle vit une seule
  fois, dans `outils/activation.ts` ; l'import l'applique pour écrire le bloc
  `activation`, `npm run controle` refuse toute divergence (`--corriger` répare),
  et `demanderActivation()` la rejoue dans l'application au lieu de croire le
  fichier — un catalogue truqué portant `activable: true` est refusé quand même.
  Au 23/09/2026 : **4 connecteurs activables sur 137**. Il manque un coût à 133 et
  un risque à 117. Aucun bouton « Se connecter » ne s'affiche sans passer par là.
- **Un prix ne se devine pas.** `connecteurs/couts.json` est le seul endroit du
  dépôt où un coût s'écrit à la main, une ligne par connecteur, chacune avec la
  page de l'éditeur qui le dit et la date où elle a été lue. Absent du fichier =
  `null` = refusé. Vérifié au 23/09 : Microsoft Graph (appels standards couverts
  par la licence M365, les API « à compteur » ne le sont pas) et les API Google
  Workspace (sans frais sous 80 M d'unités/jour pour Gmail, 400 M pour Drive —
  **Google annonce une facturation au-delà « plus tard en 2026 », à relire**).
- **Les fiches déclarent leurs besoins en huit mots, pas en noms de produits** :
  voix, conversation, email, whatsapp, calendrier, fichiers, navigateur,
  telephone. `outils/capacites.ts` fait la jointure vers le catalogue, dérivée
  des mots du relevé et jamais de ce qu'un produit est réputé faire ; le banc
  refuse un besoin qu'il ne connaît pas ou que personne ne sert. `voix` et
  `navigateur` ne passent par aucun connecteur : l'application les tient
  elle-même, et c'est écrit dans `SERVI_PAR_L_APPLICATION` pour qu'on cesse de
  chercher. Les cinq matchs faux écartés à la relecture (Brevo en téléphonie,
  Telegram en espace de fichiers, Zoom en canal de conversation) valaient chacun
  une ligne de commentaire.
- **Pas de connexion automatique aux comptes du client, pas de clic « Publier »
  sans validation, pas de contournement anti-robot.** Mêmes règles que
  DropShipPro : l'agent navigue avec les sessions ouvertes du client, remplit,
  le client valide. Les règles qui comptent sont appliquées par le code
  (`expert.regles` → l'application), pas seulement lues par le modèle.
- **Le parcours d'embauche ne fait remplir que ce que l'agent ne peut pas
  demander** : quelle fiche, quel prénom, quel genre, quel visage. Tout le
  reste, c'est l'agent qui le demande, avec une proposition tirée de sa fiche
  que le client confirme ou corrige (décision de Max, 22/09/2026 : pas
  l'impression de paramétrer). Le cadrage parlait de neuf écrans à remplir ;
  quatre suffisent, l'entretien fait les cinq autres.
  `desktop/check-embauche.ts` vérifie la forme des données que l'écran lit :
  un champ du catalogue renommé viderait la liste des postes sans rien casser
  de visible.
- **Rien ne part par courriel sans que le client ait relu le texte exact.**
  L'interface calcule une empreinte du brouillon affiché
  (`desktop/src/agents/courriel.ts`), `courriel_envoyer` la recalcule et refuse
  si elle a changé : un brouillon régénéré entre la relecture et le clic ne
  peut pas partir à la place de celui qui a été lu. Les deux implémentations
  doivent rester identiques — `desktop/check-courriel.ts`, lancé par
  `npm run controle`, s'arrête sur la moindre divergence. Ce n'est pas une
  signature (tout tourne dans le même processus), c'est un contrôle de
  cohérence. Chaque envoi est consigné dans `config/courriels-envoyes.json`.
- **Le navigateur intégré (`desktop/src-tauri/src/navigateur.rs`) ouvre, il
  n'agit pas.** Le client se connecte lui-même à ses comptes dans une fenêtre
  au profil persistant (`data_directory`), posé dans `app_local_data_dir` et
  non à côté de l'exécutable, qui n'est pas inscriptible après un MSI. Seuls
  `http` et `https` s'ouvrent ; la fenêtre n'est pas listée dans
  `capabilities/default.json`, donc aucun site visité n'atteint une commande.
  **Aucune commande n'injecte de script dans la page et aucune permission n'est
  accordée d'office** : les deux motifs du cahier des charges
  (`setPermissionRequestHandler` → `callback(true)`, sélecteur non échappé dans
  `executeJavaScript`) sont refusés par construction. Cliquer et remplir vient
  en phase C, avec validation humaine avant tout envoi.

## Commandes

```bash
npm install
npm run controle              # banc du dimensionnement + validation des paquets
npm run verifier -- --corriger
npm run generer -- --sec --ids AG-0002
node --experimental-strip-types outils/packs.ts   # quel agent sur quelle machine
npm run importer-connecteurs  # relit les relevés V6 -> connecteurs/catalogue.json
npm run verifier-connecteurs  # règle d'activation, seule ou dans npm run controle
npx tsc --noEmit
npm run controle-application  # typage React + tests Rust de l'application
```

`controle-application` ne rejoint pas `controle` : il demande les modules de
`desktop/` et les bibliothèques système de Tauri. Sur une machine neuve, les
poser d'abord, sinon `cargo` s'arrête sur `gdk-3.0` introuvable :

```bash
apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev libasound2-dev
```

## Conventions

- Interface, fiches et messages en français ; commentaires de code en anglais.
- Vérifier avant d'affirmer ; ne jamais annoncer qu'une chose fonctionne sans
  l'avoir constatée.
- Les secrets vont dans `.env` (exclu de git), jamais dans le dépôt.

## Chantier

1. Application desktop iAgent (Tauri v2 + React + TypeScript, moteur de modèles locaux
   type Ollama, Playwright pour le navigateur) : parcours minimal installer →
   se connecter → télécharger un agent → une tâche s'exécute → résultat dans le
   dossier → conversation vocale.
   Fiches, catalogues et configuration partent avec l'installeur
   (`bundle.resources` de `tauri.conf.json`) et se lisent à la même place à
   l'exécution ; un test le vérifie plutôt que d'attendre une installation
   Windows pour découvrir une faute de frappe. `IAGENT_RESSOURCES` déplace
   cette racine en développement, où l'installeur n'a rien copié.
   **Pas encore constaté : aucun MSI n'a été produit ici** (pas de Windows en
   session), seuls les chemins et la lecture le sont.
2. Premier lot de fiches : un secteur de 25, relu, puis les 544 P1.
3. Boutique : `drop-shipper.fr/b/iagent-agency` reste la vitrine ; les paquets
   deviennent des produits par le flux ; `iagent.agency` (OVH) à pointer dessus.
4. Catalogue LocalAgent définitif (références retenues, prix négociés) à la
   place du relevé AliExpress.
