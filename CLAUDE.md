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
  du 18/09/2026, bloc `execution`). L'application prévient avant de basculer :
  `modele::choisir` écrit toujours son `motif`, même quand rien ne bascule ; sans
  clé d'API pour la capacité manquante, l'agent s'arrête avec le motif écrit. Les
  clés du client restent sur sa machine, jamais dans un paquet ni chez nous.
- **La jauge de la machine est calculée dans l'application** depuis le
  23/09/2026 (`desktop/src-tauri/src/jauge.rs`), et plus seulement dans la
  boutique : elle dit, avant qu'un agent ne parle, ce que les agents de
  `installation.json` demandent à CETTE machine. **La mémoire se mesure, la
  puissance non.** La mémoire totale se lit sur le système (`/proc/meminfo` sous
  Linux, `GlobalMemoryStatusEx` sous Windows) ; ce que vaut une carte face à une
  RTX 4070 ne se lit nulle part, et n'est connu que si `installation.json` porte
  `machine: "<id de machines.json>"`. Sans ça la jauge rend `memoire-seule`, qui
  n'est **pas** un `confortable` prudent : la mémoire passe, la charge n'a pas
  été jugée, et l'écran l'affiche en ambre et non en vert. Une jauge qui
  devinerait une capacité annoncerait « confortable » à un client dont les tâches
  prennent du retard. **La jauge ferme aussi la route locale** : un modèle
  installé n'est pas un modèle qui tient, et `modele::choisir` refuse le local
  quand la mémoire manque pour ce poste, en nommant les deux chiffres et en
  proposant une machine plus grande plutôt qu'un modèle de plus à installer.
  Avant, ça se découvrait au bout des 120 secondes d'attente du moteur local, et
  l'écran n'en disait qu'une supposition. Le chemin Windows **compile et
  s'empaquette** : MSI de
  9 580 138 octets produit sur `271bcaa` par `build-windows-msi.yml` — mais il
  n'a **jamais tourné sur une vraie machine Windows**, même réserve que pour
  l'installeur lui-même.
- **La règle de mémoire vit dans `dimensionnement/paliers-modeles.json`**, pas
  dans le code (23/09/2026) : `resident` par palier, `memoireTravailParPalier`,
  `reserveMemoireUnifiee`. `calculer.ts` (boutique) et `jauge.rs` (application)
  la lisent tous les deux et les deux bancs rejouent les mêmes fiches témoins.
  Écrite deux fois, en TypeScript et en Rust, elle aurait fini par dire deux
  choses. Vérifié en retournant `resident` sur `texte-standard` : le banc du
  dimensionnement l'attrape aussitôt (la carte nécessaire tombe de 16 à 12 Go). **Tenu par le code depuis
  le 23/09/2026 seulement** : jusque-là l'application ne savait parler qu'à
  l'API d'Anthropic, les 1 249 fiches disaient `defaut: "local"` et rien ne les
  lisait. `desktop/src-tauri/src/modele.rs` est maintenant le seul endroit où la
  voie se choisit, et `choisir()` est une fonction pure qu'on éprouve sans rien
  joindre.
- **La clé d'API du client vit dans le coffre du système, jamais ailleurs**
  (23/09/2026). Elle ne venait que de la variable d'environnement
  `ANTHROPIC_API_KEY` : après une installation par MSI, un client n'avait aucun
  moyen d'en poser une, donc aucun moyen de faire travailler un agent si aucun
  moteur local n'était installé. `llm::cle_api()` lit le trousseau
  (`iagent-api` / `anthropic`) d'abord, l'environnement ensuite — l'environnement
  ne reste lu que pour le développement et les bancs. Les trois endroits qui
  décidaient de la voie sur la seule variable (`repondre`, `executer_tache`,
  `modele_etat`) passent tous par là : en oublier un ferait dire à l'écran
  « aucune clé n'est enregistrée » alors qu'elle l'est. L'écran la prend dans
  l'onglet « Vos connexions » et ne la réaffiche jamais.
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
  mémoire des modèles, c'est la RAM moins 6 Go de réserve — `vram` est écrit à
  la main dans `machines.json` mais **`check-dimensionnement` refuse depuis le
  23/09 toute machine unifiée qui s'en écarte** (et 0 pour un poste, qui ne
  porte aucun agent) : une référence entrée avec un chiffre faux rendrait faux
  tous les placements sans une seule erreur. La réserve est
  `reserveMemoireUnifiee` du fichier des paliers, jamais un 6 recopié ; un Radeon 780M vaut
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
  donne la table pour toutes les fiches, et `check-economie.ts` **refuse une
  table périmée** : il la regénère en mémoire et compare. Elle avait pourri
  quatre jours sans que rien ne bronche (générée sur 126 fiches quand le dépôt
  en portait 1 249). **Toutes les hypothèses sont dans `tarifs-api.json` et
  doivent être remplacées par la mesure** dès qu'un agent tourne (tours et
  jetons consignés) ; les forfaits `declencheur` (20/jour) et `a-la-demande`
  (5/jour) sont dans `calculer.ts` et sont des hypothèses aussi : 36 % des
  appels des fiches qui passent la règle viennent du forfait declencheur.
  **Résultat au 23/09, sur le compte corrigé : 136 fiches sur 1 249 tiennent la
  règle en bundle partagé (45 seules), 57 si l'on compte un poste N150 par
  agent.** C'était 215 avant correction, et le chiffre était faux. La règle est
  en réalité une règle de charge : au-dessous de 26 appels/jour aucune fiche ne
  passe, au-dessus de 150 toutes passent, et la fiche médiane est à 26. Un agent
  peu sollicité se vend en mode API, pas avec du matériel. Un designer seul sur
  un bundle XL ne passe pas non plus (ratio 0,5) : les agents image et vidéo se
  vendent en bundle partagé ou en mode API, jamais seuls sur une carte dédiée.
- **La boutique (`frontend/`) calculait ses chiffres au lieu de les lire.** Son
  badge vert « 3x ✓ » comparait la moyenne de la fourchette de prix d'abonnement
  à 33 % du haut de cette **même** fourchette : mathématiquement incapable de
  rendre vrai, donc **jamais allumé sur aucune des 1 249 cartes**. Le panneau
  « Analyse économique (ratio 3×) » posait le coût du matériel à 30 % du **prix
  d'abonnement** et l'API à 0,00015 € l'appel (un nombre qui n'est nulle part),
  d'où une « marge » de ~70 % identique pour tout le catalogue, et aucun ratio.
  Depuis le 23/09 la boutique appelle `economiePour` — `dimensionnement/` ne lit
  aucun fichier, donc tourne aussi dans le navigateur — et affiche le vrai
  chiffre : **136 badges, comme `docs/economie.md`**.
- **`npm run controle-boutique` : une construction verte ne prouve pas qu'une
  page s'affiche.** `frontend/` n'a ni typage ni banc, et `vite build` ne voit
  pas une variable qui n'existe pas : quatre références restées après une
  correction ont passé la construction sans un mot, et la fiche détaillée aurait
  planté à l'ouverture chez le client. Le banc (`frontend/banc/rendu.jsx`) rend
  vraiment les composants en SSR, avec React et react-dom déjà présents, **sans
  rien installer de plus**. Il parcourt **les quatre onglets** : l'onglet est un
  état interne, donc un rendu par défaut ne montre que « overview » — c'est
  précisément là que les quatre variables se cachaient, et le banc ne les a
  vues qu'une fois `ongletInitial` ajouté pour lui. Vérifié en remettant le
  bogue : `vite build` sort 0, le banc sort 1 en nommant la variable.
- **`profil_risque` n'est pas `commercial.profil`, et les deux s'écrivent
  « PR-NN ».** C'est cette collision de noms qui a laissé passer l'erreur :
  `commercial.profil` vient de `catalogue.profils` (PR-01 à PR-12 :
  automatisation, présence physique, complexité d'intégration) et sert au prix ;
  `profil_risque` dit si un humain doit approuver. Le générateur écrivait le
  second sans jamais regarder les tâches : **1 243 fiches sur 1 249 se disaient
  « PR-00 (autonome) », dont 245 dont CHAQUE tâche attend un accord humain.**
  Personne ne lisait le champ, donc personne ne le voyait mentir. Dérivé le
  23/09 des tâches, il mettait 1 219 fiches sur 1 249 en PR-03 (« approbation
  obligatoire ») ; **max l'a refusé le 24/09** — « l'agent peut fonctionner de
  manière autonome si l'utilisateur le souhaite » — et il a raison : c'était
  écrire sur la carte du client une contrainte que le produit n'applique pas et
  qu'il peut de toute façon lever. **PR-00 sur les 1 249 depuis**, parce que
  l'étiquette décrit l'agent tel qu'il est vendu, avant tout réglage, et que ce
  que l'application applique alors est l'autonomie. Conséquence à assumer : le
  champ dit désormais la même chose partout, donc il ne porte plus rien, et il
  n'est **affiché nulle part** (ni boutique ni application — vérifié). Ce qui
  porte l'information, et qui varie vraiment, c'est `validationHumaine` tâche
  par tâche : **30 fiches sans aucune tâche à relire, 973 avec une partie, 246
  avec toutes**. C'est ce compte-là qu'une carte afficherait honnêtement, le
  jour où la boutique aura où le dire.
- **L'agent va seul, sauf si le client met une tâche sous contrôle** (règle de
  max, tenue par `accord_attendu` dans `tache.rs` et `planningDuClient` dans
  `src/agents/fiche.ts`). Le `validationHumaine` de la fiche n'est donc **pas**
  appliqué : c'est la proposition de l'expert, celle que l'agent énonce à
  l'entretien d'embauche (« il y en a N où j'attends votre accord, je garde ça
  ou vous voulez en relâcher ? »), et c'est la réponse du client qui devient un
  réglage de son planning. Écrite deux fois, la règle disait déjà deux choses le
  24/09 : l'écran forçait l'autonomie sur toutes les tâches pendant que
  `lire_tache` appliquait la fiche, donc l'onglet du travail annonçait « part
  seule » et l'agent recevait la consigne « votre travail sera relu ». Pire,
  Rust ne lisait **pas du tout** le `planning` du client : une tâche qu'il avait
  éteinte restait exécutable et une tâche qu'il avait ajoutée était introuvable,
  alors que `installation.json` livré avec l'application porte les deux cas.
  `desktop/temoins-planning.json` est maintenant rejoué des deux côtés (un test
  Rust par `include_str!`, `check-travail.ts` en TypeScript) pour qu'ils ne
  puissent plus se séparer. **Ce que `validationHumaine` fait vraiment est
  étroit** : il ajoute une phrase à la consigne du modèle et lève un drapeau sur
  le résultat. Il n'autorise rien et ne retient rien — de toute façon rien ne
  part du poste, et le courriel a sa propre empreinte de relecture.
- **Les bancs tournent en intégration continue depuis le 23/09**
  (`.github/workflows/controles.yml`). Avant, le seul flux construisait le MSI
  et rien d'autre : `npm run controle`, `npm run controle-application`,
  `npx tsc --noEmit` et la boutique ne tournaient que sur la machine de qui
  pensait à les lancer. **Un garde que personne ne lance ne protège de rien** —
  c'est la même faute que les champs obligatoires que rien ne lit, au niveau du
  processus. Sans filtre de chemins, délibérément : les fautes trouvées ce
  jour-là vivaient toutes hors de `desktop/`, seul chemin que l'autre flux
  surveille. **Les dépendances système de Tauri vivent dans
  `desktop/dependances-systeme.txt`**, que le flux lit : recopiées dans le
  `.yml`, elles y ont perdu `libasound2-dev` et `libjavascriptcoregtk-4.1-dev`,
  et `apt` réussissait — c'est `cargo` qui s'arrêtait plus loin sur
  `alsa-sys`, parce que l'écoute du microphone est dans le même binaire que les
  bancs. **Une étape verte ne prouve que ce qu'elle regarde** : celle-ci
  n'installait rien de faux, il lui manquait deux lignes sur sept. `patchelf`
  ne sert qu'à l'AppImage et n'y est pas.
- **Un champ obligatoire que personne ne lit ne protège de rien : il attend.**
  `miseAJour.appMinimum` est exigé par le schéma sur les 1 249 fiches, valait
  **« 1.0.0 » partout alors que l'application est en 0.1.0**, et aucun code ne
  le lisait — ni Rust, ni l'écran, ni un banc. Branché tel quel, il aurait
  refusé **le catalogue entier** ; le banc le montre (casser une seule fiche à
  0.2.0 fait tomber les deux côtés). Depuis le 23/09 : `lire_fiche` compare
  vraiment, avec un message en français qui nomme les deux versions et dit quoi
  faire, et `verifier-paquets` refuse toute fiche qui exige plus que
  `desktop/package.json`. Les 1 249 sont passées à 0.1.0, la valeur vraie.
  **La comparaison se fait par nombres, jamais par texte** : en texte
  « 0.10.0 » est plus ancien que « 0.9.0 », le banc l'affirme d'abord puis
  vérifie que le code ne s'y trompe pas. Deux implémentations
  (`comparer_versions` en Rust, `plusRecenteQue` en TS) parce que les deux
  côtés doivent trancher pareil.
- **La cadence d'une tâche et le champ de la fiche sont deux fonctions**
  (`appelsParJour` fractionnaire, `appelsParJourEstimes` entier planché à 1,
  dans `calculer.ts`). Les confondre a coûté deux fois le même jour. D'abord
  `hebdomadaire` et `mensuelle` n'étaient pas listées du tout et tombaient dans
  le fourre-tout `a-la-demande` : **3 407 tâches comptées à 5 appels par JOUR**
  au lieu d'un par semaine ou par mois, sur 967 fiches des 1 249. Rien n'échouait,
  le chiffre sortait seulement trop haut, ce qui gonflait la facture « API seule »
  et donc flattait le ratio commercial. Puis, la correction faite, le plancher
  `Math.max(1, …)` — juste pour le champ entier de la fiche — écrasait encore la
  différence, parce que `economie.ts` pèse les tâches **une par une** : pesée
  seule, une tâche hebdomadaire redonnait 1. Le banc ne l'a vu que parce qu'on a
  changé une tâche exprès pour vérifier qu'il criait. **Un défaut silencieux sur
  une énumération, et un plancher qui voyage hors de son usage, se paient pareil :
  en chiffres justes en apparence.** Le banc lit maintenant les six planifications
  dans le schéma et refuse qu'une seule ne soit pas comptée ; une inconnue lève.
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
  Au 24/09/2026 : **9 connecteurs activables sur 137** (4 la veille). Il manque un
  coût à 128 et un risque à 117. Les cinq ouverts le 24/09 après lecture de la
  page de l'éditeur : Microsoft Teams (la plupart des API Teams ne sont plus
  facturées à l'usage depuis le 25/08/2025 ; restent payants les insights de
  réunion, les PATCH DLP et le contenu des enregistrements au-delà de 600
  min/mois), HubSpot (compris dans l'abonnement, option payante pour élargir le
  quota), WooCommerce (auto-hébergé, rien en plus), GitHub et GitLab (API
  ouverte à tous les paliers, bornée par un quota). **Twilio est resté dehors
  exprès, sa page lue** : son coût est réel mais c'est du paiement à l'usage
  (0,0083 $ le message aux États-Unis, ≥ 1,15 $/mois le numéro), et `couts.json`
  ne sait exprimer qu'un montant mensuel fixe — y écrire 1,15 sous-estimerait la
  facture du client dès le premier envoi. Le champ manquant se décide avant
  d'ouvrir COM010. **Ce qui bloque les neuf autres n'est pas l'accès au web mais
  la page** : leurs pages de quotas s'ouvrent et aucune n'énonce le coût ; c'est
  la page tarifaire qu'il faut, et elle vit sur un autre hôte. Aucun bouton « Se connecter » ne s'affiche sans passer par là.
- **`desktop/src-tauri/src/mcp.rs` est le seul endroit où un outil extérieur
  peut être appelé**, et quatre refus y sont dans le code, pas dans une consigne
  au modèle : liste blanche par agent (un outil que le serveur ajoute entre deux
  lancements n'élargit rien), validation explicite pour tout outil que le serveur
  ne déclare pas en lecture seule (**annotation absente = on suppose qu'il
  modifie**), quota par exécution, délai, et arrêt immédiat qui coupe le
  processus. Tout appel est journalisé, abouti ou refusé, avec un motif en
  français sans jargon — un banc vérifie qu'aucun refus ne contient « error »,
  « null » ni « MCP ». **Le tuyau d'un processus local n'est constaté que sous
  Unix** (test avec un vrai `sh`) ; sous Windows, cible du produit, il ne l'est
  pas encore.
- **Le moteur local, c'est Ollama, et son format a été relevé chez lui.**
  `POST /api/chat` avec `stream: false`, `GET /api/tags`, hôte
  `http://127.0.0.1:11434` — lu le 23/09/2026 dans la bibliothèque cliente que
  publie Ollama (`npm pack ollama`, `ChatRequest` / `ChatResponse` /
  `ListResponse` dans ses types), pas recopié de mémoire. Le banc parle à un
  moteur de banc écrit à la main sur la boucle locale.
- **Le modèle à lancer se déduit du palier de la fiche, pas d'un réglage.**
  `modeles.texte` de la fiche donne le palier, `paliers-modeles.json` donne ses
  exemples (« Llama 3.1 8B »), et `meme_modele()` les reconnaît sous l'écriture
  du moteur local (« llama3.1:8b », « llama3.1:latest ») en comparant la BASE du
  nom. **La taille n'entre pas dans la comparaison** : le palier dit ce qu'il
  faut au moins, et qui a installé plus gros l'a fait exprès ; à base égale on
  préfère quand même la taille du palier, c'est sur elle que le dimensionnement
  a été calculé. Quand rien ne convient, le motif nomme les modèles à installer,
  et il distingue les trois manques — pas de moteur, moteur vide, mauvais modèle
  — parce qu'ils ne se soignent pas pareil.
- **Un serveur MCP se lance OU se joint, jamais les deux.** `ServeurDeclare`
  porte une `commande` (processus local, tuyaux) ou une `url` (serveur distant,
  « Streamable HTTP »), et `ouvrir_transport()` est le seul endroit qui choisit.
  C'est le transport de la grande majorité du catalogue : **109 connecteurs sur
  137 sont distants, 9 seulement sont locaux** — sans lui le client ne joint
  presque rien. Trois pièges tenus par des bancs qui échouent si on les défait :
  l'en-tête `Accept` doit porter `application/json` **et** `text/event-stream`
  (un seul des deux vaut 406 avant le premier outil), l'identifiant de session
  rendu à la poignée de main doit repartir sur **tout** le reste y compris la
  notification, et une notification n'attend pas de réponse — en attendre une
  décale toutes les suivantes. Le banc parle à un vrai serveur HTTP écrit à la
  main sur la boucle locale, donc il tourne aussi sous Windows. **Ce qui n'est
  pas fait : l'authentification OAuth du protocole** (le jeton vient du
  trousseau, rangé à la main) et **aucun serveur distant d'éditeur n'a encore
  été joint**.
- **Aucun agent n'a jamais employé un outil : la porte est murée** (constaté le
  23/09/2026, chaîne vérifiée maillon par maillon). `mcp.rs` fait 2 387 lignes
  et 38 bancs, et rien ne le traverse :
  1. `llm.rs` n'envoie **aucun `tools`** dans sa requête (le corps ne porte que
     `model`, `max_tokens`, `output_config`, `system`, `messages`) — le modèle
     n'apprend donc jamais qu'un outil existe ;
  2. **aucun `tool_use` ni `tool_result` n'est lu** nulle part (`llm.rs`,
     `tache.rs`, `agents.rs` : zéro occurrence) ;
  3. `mcp_appeler` et `mcp_outils_permis` sont des commandes Tauri enregistrées
     que **l'écran n'appelle jamais** — elles n'apparaissent que dans
     l'enregistrement de `main.rs`.
  Le portier est complet et éprouvé ; c'est le passage qui manque. **Écrire la
  boucle est petit** (`mcp_appeler` est une fonction ordinaire, sans état Tauri,
  donc appelable depuis le crate) — ce qui n'est pas petit est la validation
  humaine (`valide: bool`), que max exige et qu'on ne peut pas éprouver ici
  faute d'un vrai serveur et d'un vrai compte client.
  **Et ça n'ouvrirait presque rien aujourd'hui** : un seul serveur est à portée
  d'un agent (`fichiers`, 13 outils, connecteur OFF029) ; `web` a
  `connecteur: null`, donc hors de portée par construction, et ces 13 outils
  doublent ce que l'application écrit déjà elle-même. **À faire quand les 133
  connecteurs bloqués sur un coût seront ouverts, pas avant** : c'est cette
  décision de max qui commande l'ordre des travaux.
- **La liste blanche d'un agent se dérive de sa fiche, jamais de l'écran.**
  `mcp_appeler` est le seul chemin vers un outil, et rien de ce qui décide ne
  vient de l'interface : la fiche déclare un besoin, le catalogue dit quels
  connecteurs le servent, `serveurs-mcp.json` dit quel serveur met en œuvre quel
  connecteur, et ce serveur dit quels outils le dépôt a retenus. Un serveur sans
  `connecteur` n'est à la portée d'aucun agent. **L'écran ne peut passer que le
  clic de validation** — et encore doit-il nommer un agent réellement embauché
  sur SA fiche (`est_embauche`), sinon il suffirait de présenter la fiche du
  catalogue qui déclare le plus de besoins. Le quota
  (`APPELS_PAR_CONVERSATION`) est un coupe-circuit, **pas** le volume attendu du
  poste, qui est `execution.appelsParJourEstimes` : deux nombres, deux sens.
- **Les outils d'un serveur se relèvent, ils ne se devinent pas.** La liste
  vit dans `serveurs-mcp.json`, pas chez le serveur, pour qu'un serveur qui
  grandit n'élargisse rien ; `declaration_recevable` refuse une liste vide,
  parce que vide veut dire « personne ne l'a lancé », pas « tous ». Relevé le
  23/09/2026 en lançant les deux serveurs : le serveur fichiers annonce 13
  outils retenus (`read_file` écarté, il se dit lui-même DEPRECATED au profit de
  `read_text_file`). **Trouvé du même coup :** la commande déclarée pour le
  serveur web, `npx -y @modelcontextprotocol/server-fetch`, **n'existe pas au
  registre npm** (404) — le serveur de référence est un paquet Python, `uvx
  mcp-server-fetch`. Corrigé. Chaque appel, abouti ou refusé, s'inscrit dans
  `config/outils-<prénom>.json` et se relit par `mcp_journal`.
- **Affirmer qu'un outil ne modifie rien affaiblit une règle de sûreté**, donc
  ça s'écrit avec sa raison. Sans annotation du serveur, un outil exige un clic
  du client à chaque appel ; `lectureSeule: true` dans la déclaration l'en
  dispense, et le banc refuse cette ligne sans un `pourquoi` qui dit ce qu'on a
  lu de l'outil. Un seul cas aujourd'hui : `fetch`, qui n'annonce rien.
- **Une adresse de serveur distant est chiffrée et ne porte rien.**
  `adresse_recevable()` refuse `http://` hors boucle locale (le jeton porteur
  part à chaque appel et se lirait sur le chemin), refuse un `?cle=…` et un
  `https://jeton@hote` (ce serait un secret dans le dépôt). Les messages
  d'erreur du réseau ne recopient jamais l'adresse, seulement son hôte, pour la
  même raison que `stderr` du processus fils part au néant.
- **Les champs d'une structure Rust traversent vers l'écran avec LEURS noms**
  (`declare_le`, pas `declareLe`) : le dépôt n'emploie pas `rename_all`. Écrire le
  champ en camelCase côté React ne fait échouer ni le compilateur ni l'exécution,
  ça rend `undefined` — un panneau vide que personne ne comprend. **En revanche
  les ARGUMENTS d'une commande sont bien convertis par Tauri** : `nomDeVariable`
  en JavaScript arrive en `nom_de_variable` en Rust. `check-connecteurs.ts` relit
  les deux fichiers et compare les noms de champs.
- **Les secrets des serveurs MCP vivent au trousseau du système**, jamais dans
  `connecteurs/serveurs-mcp.json`, qui ne porte que des NOMS de variables
  (`secrets`, et `jeton` pour un serveur distant — même règle, même banc).
  `declaration_recevable()` refuse le fichier entier si une ligne ressemble à une
  clé, et l'application ne démarre pas plutôt que de laisser circuler un secret.
- **Un prix ne se devine pas.** `connecteurs/couts.json` est le seul endroit du
  dépôt où un coût s'écrit à la main, une ligne par connecteur, chacune avec la
  page de l'éditeur qui le dit et la date où elle a été lue. Absent du fichier =
  `null` = refusé. Vérifié au 23/09 : Microsoft Graph (appels standards couverts
  par la licence M365, les API « à compteur » ne le sont pas) et les API Google
  Workspace (sans frais sous 80 M d'unités/jour pour Gmail, 400 M pour Drive —
  **Google annonce une facturation au-delà « plus tard en 2026 », à relire**).
- **La liste par métier vient des 43 packs sectoriels**, pas d'une saisie.
  `catalogue/reference/packs-erp-crm.json` dit, pour chaque secteur, ses ERP/CRM
  cœur, ses optionnels, ses canaux et sa bureautique par défaut ;
  `outils/packs-secteurs.ts` les convertit (l'import les écrit, le banc rejoue
  et refuse la divergence, comme pour `activation`), et `packDuMetier()` les
  rend rangés par rôle à l'écran. Un comptable voit Pennylane, Xero, Sage et
  QuickBooks, pas les onze connecteurs de fichiers du catalogue. 43 packs, 261
  liens ERP/CRM, 996 liens en tout. **Piège vérifié :** les identifiants du
  catalogue font 2 à 4 lettres (`HR001`, `ACC001`, `AUTO001`) ; un filtre qui
  en exigeait 3 jetait les six connecteurs RH en silence et laissait le pack
  ressources-humaines sans aucun ERP/CRM cœur. D'où le banc qui compte les
  paniers vides. **Trou connu du relevé :** le secteur `audit` (12 fiches) n'a
  pas de pack ; `packDuMetier` rend `null` et l'écran retombe sur la
  proposition par besoin, plus large et moins juste.
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
- **Un logiciel nommé par une tâche est une famille du référentiel, jamais un mot.**
  Chaque entrée de `taches[].logiciels` doit être une `categorie` de
  `catalogue/logiciels.json` : c'est ce qui permet à la boutique et à l'entretien
  de nommer les vrais produits derrière (« bureautique » → Microsoft 365,
  LibreOffice, Google Workspace). Au 23/09/2026, 23 des 146 mots employés par les
  1 249 fiches ne renvoyaient à rien — `tableur` 855 fois, `libreoffice` 449,
  `client-email` 332, `logiciel-cabinet` — et rien ne le signalait.
  `outils/logiciels-metier.ts` garde par quoi chacun a été remplacé et le banc
  refuse leur retour en disant quoi écrire. Le courrier, l'agenda, WhatsApp, le
  téléphone et les fichiers **ne sont pas des logiciels métier** : ils sont
  déclarés dans `connecteurs`, et le navigateur, la voix et le modèle image
  appartiennent à l'application.
- **`acces.logiciels` est dérivé des tâches.** Ce que l'agent a le droit d'ouvrir
  se lit dans ce que ses tâches ouvrent. Écrit à part, il débordait de mots
  absents de toute tâche sur 459 fiches et en oubliait sur 202 autres : l'agent
  manipulait un outil qu'il n'avait pas le droit d'ouvrir. `--corriger` le
  recalcule ; `appliquer-editorial` et `generer-fiches` ne le recopient plus.
- **Ouvrir une famille sans y être qualifié, c'est ne jamais être interrogé
  dessus.** `questionsEntretien()` part de `qualifications` : une famille qu'une
  tâche ouvre mais que la fiche ne déclare pas n'est jamais demandée au client, et
  le jour de l'embauche l'agent ne sait pas dans quel outil aller. 463 fiches
  étaient dans ce cas ; **le compte est à zéro depuis le 23/09/2026 et c'est
  maintenant une faute du banc**, avec celle d'une fiche qui ne déclare aucun
  logiciel. Méthode de reprise, si un lot de fiches arrive : la moitié des
  manques n'en sont pas, c'est le mot de la tâche qui désigne autre chose
  (`bi` pour un calcul au tableur, `ged` pour une note qu'on remet, `crm` pour
  prévenir le client depuis l'outil métier). Le reste est un vrai produit
  manquant, et on le choisit en relisant ce que les fiches déjà qualifiées du
  même secteur déclarent, jamais de mémoire : un nom de logiciel inventé passe
  le banc sans être détecté.
- **Une tâche s'exécute et pose un fichier dans le dossier du client**
  (`desktop/src-tauri/src/tache.rs`, 23/09/2026). C'était le trou du parcours
  minimal : les fiches décrivent 9 233 tâches et aucune commande n'en exécutait
  une. Quatre refus tenus par le code, pas par une consigne au modèle : l'agent
  doit être embauché sur cette fiche d'après `installation.json` ; la tâche doit
  être allumée par le client ; le dossier de sortie est celui qu'il a choisi (un
  dossier non choisi ne s'écrit pas « en attendant » à côté de l'exécutable, et
  un chemin relatif est refusé) ; le nom du fichier est construit ici, jamais
  proposé par le modèle. Rien ne part du poste : `validationHumaine` écrit le
  résultat et le dit, sans rien envoyer.
- **L'application écrit `md`, `txt`, `csv`, `json`, `html`, `xlsx`, `eml`,
  `docx` et `pdf`** : 9 158 sorties sur 9 265. Ne manquent plus que les formats
  d'image, de son et de vidéo (107 sorties) — ceux-là demandent un agent
  d'image ou de son, pas un écrivain. Trois familles ne se demandent pas au
  modèle, qui rendrait une description plausible et mal formée : le classeur
  (il rend des lignes en points-virgules), le courriel (il rend une ligne
  `Objet :` et une lettre, l'application écrit les en-têtes) et le document
  (il rend `#`, `-` et `**`).
  **Un document est un document, quelle que soit sa boîte** : `docx` et `pdf`
  partagent la consigne et la lecture des marques (`lignes_du_document` dans
  `document.rs`), et seul l'écrivain change. Les dédoubler, c'est se garantir
  qu'un jour un titre sera un titre dans l'un et un paragraphe dans l'autre. Le brouillon `.eml` part **sans
  destinataire ni expéditeur**, avec `X-Unsent: 1` pour qu'Outlook et
  Thunderbird l'ouvrent en rédaction : une adresse inventée serait pire
  qu'absente, le client l'enverrait sans relire. Vérifié au 23/09/2026 en
  relisant le fichier produit avec un analyseur RFC 5322 indépendant (objet
  accentué, ligne de 200 caractères, espace de fin de ligne : zéro défaut).
  **Un `.docx` est une archive ZIP de trois pièces XML au minimum, et de cinq
  pour que ce soit un vrai document.** Première version sans `styles.xml` : le
  fichier s'ouvrait, et une bibliothèque OOXML indépendante relisait chaque
  paragraphe en « Normal » — un style nommé dans `document.xml` mais défini
  nulle part est ignoré en silence, donc pas un seul titre. Un banc vérifie
  maintenant que tout style employé est défini, et que la puce renvoie à une
  numérotation existante. Le ZIP était déjà compilé dans le binaire par
  `rust_xlsxwriter` : ce qui manquait n'était pas une bibliothèque, c'était la
  conversion.
  **Le PDF n'a demandé aucune bibliothèque non plus** (23/09/2026) : c'est une
  suite d'objets numérotés et une table de leurs positions, et les quatre
  Helvetica employées sont celles que tout lecteur porte déjà, donc rien n'est
  embarqué — un rapport d'une page pèse 3,4 ko, sept pages 30 ko. Les deux
  pièges : la table des positions, où un octet de décalage fait refuser le
  fichier en bloc (un banc rejoue ce que fait le lecteur, va à chaque position
  annoncée et vérifie que l'objet s'y trouve) ; et les largeurs de caractères,
  **engendrées depuis la table WinAnsi de la spécification et les métriques AFM
  publiées par Adobe**, jamais saisies à la main — une largeur fausse ne casse
  rien, elle coupe les lignes au mauvais endroit et personne ne le voit avant
  d'ouvrir le document. Vérifié en relisant le fichier produit avec `qpdf
  --check` (aucune faute de syntaxe) et avec Poppler, qui rend les accents,
  l'euro, les guillemets et les puces, et mesure le texte à 533,6 points pour
  une marge à 538,6 — donc les largeurs sont bonnes. `pdftotext -bbox` est le
  moyen de le revérifier après coup.
  `format_ecrivable()` dit en clair ce qu'il ne sait pas écrire plutôt que
  d'écrire un `.docx` qui n'en serait pas un, et l'écran n'offre pas de bouton
  pour ces tâches. La liste vit des deux côtés de la frontière (`tache.rs` et
  `src/agents/travail.ts`) et `check-travail.ts` compare les deux fichiers.
- **L'agent relit exactement ce qu'il écrit** (23/09/2026) : `xlsx`, `docx` et
  `eml`, en plus du texte simple. Ce n'est pas une ouverture sur le monde, c'est
  un trou fermé — les fiches disent de quel poste chacune reçoit et à quel poste
  elle transmet, donc ce qu'un agent écrit est la matière du suivant, et écrire
  un classeur que le suivant ne peut pas relire cassait le relais à chaque
  passage. Aucune bibliothèque n'entre : le `.xlsx` et le `.docx` sont des
  archives ZIP de pièces XML (le ZIP est déjà là), le `.eml` se relit avec
  `mailparse` que le relevé du courrier emploie déjà. **Le PDF n'est pas relu**,
  et c'est délibéré : celui qu'on écrit se relirait, mais ceux qui arrivent du
  monde portent des polices découpées, des flux comprimés ou du texte scanné qui
  n'en est pas. Le banc qui compte est l'aller-retour : écrire puis relire rend
  le même texte. Trois pièges tenus par un banc — une cellule absente laisse son
  champ vide au lieu de décaler la colonne suivante sous la mauvaise en-tête ;
  une date est un nombre de jours que seule la feuille de styles signale, et le
  format compte un 29 février 1900 qui n'a jamais existé ; `<w:p>` ne doit pas
  ramasser `<w:pPr>`. Seule la première feuille d'un classeur est lue, et
  l'agent apprend le nom des autres.
  **Un aller-retour ne prouve que la cohérence avec soi-même** : il passerait
  même si l'écrivain et le lecteur se trompaient de la même façon. D'où
  `desktop/src-tauri/temoins/`, des fichiers écrits par d'autres outils et
  gardés au dépôt, avec de quoi les refaire. Le premier, un classeur d'openpyxl,
  porte exprès ce qui se lit mal : accents, esperluette échappée, date et
  date-heure en numéros de jour, booléens, guillemets, point-virgule dans un
  champ, cellule vide en début de ligne, deuxième feuille.
- **Une cellule de nombre sans format s'affiche brute** : « 4 250,00 » devenait
  « 4250 » et le client lisait une facture sans ses centimes. La valeur était
  juste, la lecture non. `format_du_champ()` reporte ce que le modèle a montré
  — des décimales, une séparation des milliers — et rien d'autre : un
  identifiant ou une année ne prennent pas de séparateur. L'écriture du format
  est celle du tableur, indépendante du pays (`#,##0.00`), c'est le lecteur qui
  y met les séparateurs de sa langue. Vérifié le 23/09/2026 en relisant le
  fichier avec openpyxl : valeur 4250, format `#,##0.00`, en-tête en gras.
- **Un modèle ne rend pas un classeur, il rend des lignes.** Le tableur est le
  format le plus réclamé des fiches (4 100 sorties sur 9 265) : la consigne
  demande donc un tableau en lignes séparées par des points-virgules, et
  `poser_tableur()` en fait un vrai `.xlsx` (`rust_xlsxwriter`, ajouté le
  23/09/2026). Demander « un fichier xlsx » au modèle rendrait la description
  d'un tableau. Le découpage suit les règles CSV usuelles — **un champ entre
  guillemets garde ses points-virgules**, sans quoi une phrase casse la ligne en
  deux colonnes et décale tout le tableau, ce qui ne se voit qu'en ouvrant le
  fichier. Un nombre est écrit comme un nombre pour qu'Excel l'additionne, mais
  **« 0012 » reste du texte** : c'est une référence, pas douze. **Non constaté :
  aucun classeur produit ici n'a été ouvert dans un vrai tableur** ; le banc
  vérifie l'archive ZIP et ses pièces, pas ce qu'Excel en fait.
- **Un agent sans matière réclame, il n'invente pas.** Une entrée de tâche
  désigne une source ouvrable (`dossier:<chemin logique>` ou un connecteur) ou
  rien : **4 547 tâches sur 9 233 n'ont ni l'un ni l'autre** au 23/09/2026,
  contre 8 398 le matin même. Leurs entrées sont des mots (« pièces de
  référence », « messagerie du dirigeant ») qui disent de quoi il s'agit, pas
  où le prendre. `check-travail` les compte à chaque passage.
  **Le reste ne se déduit de rien, mesuré le 23/09 pour ne pas y revenir** :
  sur les 4 587 tâches actives concernées, **aucune** — zéro — ne nomme dans son
  entrée un logiciel que sa fiche déclare (141 croisent un nom du référentiel,
  par coïncidence de mots courts). Ce sont 1 412 libellés distincts, dominés par
  des pluriels génériques : « demandes » (289 fois), « contrats » (119),
  « dossiers » (72), « chantiers » (69). **Aucune règle automatique ne peut les
  rattacher** : ils ne portent pas l'information. La réponse est l'entretien
  d'embauche — l'agent demande au client où vivent « les demandes » — ce que max
  veut de toute façon. En attendant, rien n'est cassé : sans dossier désigné,
  l'agent travaille chez lui et le banc le dit.
  **La moitié se déduisait de la fiche elle-même** : « écarts », « adaptations »,
  « bénéficiaires » nommaient le dossier qu'une autre tâche de la même fiche
  remplit — la chaîne de relais écrite en prose au lieu d'être désignée. 3 587
  tâches rattachées, sur une règle volontairement étroite : les mots de l'entrée
  doivent être **exactement** ceux du dernier segment d'un dossier de sortie (au
  singulier près), un seul dossier doit convenir, et la tâche ne doit pas déjà
  désigner un dossier. Assouplie, elle rattachait « fichiers non identifiés » à
  `classement/identifies`, c'est-à-dire l'inverse ; **une entrée fausse est pire
  qu'une entrée en prose**, l'agent lirait le mauvais dossier avec assurance.
  Un second passage, plus large, accepte que l'entrée en dise davantage que le
  dossier (« documents contrôlés » → `dataroom/controles`) à deux conditions :
  **aucun mot du dossier n'est jeté** — `par-poste` vaut « par » et « poste »,
  sans quoi toute entrée parlant de postes y tombait — et **aucun mot en trop ne
  renverse le sens** (non, sans, manquant, précédent, prévisionnel, incomplet…),
  comparés par préfixe pour que « précédente » n'échappe pas à « précédent ».
  283 tâches de plus, les 305 entrées relues une à une.
  Rien à faire côté client pour que ça marche : un dossier logique non choisi
  retombe dans le dossier de l'agent, là même où la tâche précédente a écrit.
  Le reste (« analyses », « suivis », « accords à obtenir ») demande un jugement
  au cas par cas, fiche par fiche. **Ce ne sont pas des connecteurs déguisés** :
  compté le 23/09, **39 tâches seulement** portent en entrée le nom d'un
  connecteur (`email`, `calendrier`, `fichiers`…) ; les 4 548 autres sont bien
  des mots. L'hypothèse inverse traînait dans le mémo, elle est fausse.
  Ce comptage a quand même trouvé quelque chose : **quatre fiches lisaient un
  calendrier sans déclarer le connecteur `calendrier`**, donc l'application ne
  leur aurait rien ouvert et la tâche serait partie les mains vides, entrée
  remplie. `verifier-paquets` en fait une faute (la liste des connecteurs est
  lue au schéma, pas recopiée).
  `verifier-paquets` refuse depuis un `dossier:` mal écrit ou déclaré deux
  fois : ignoré en silence par l'application, il ferait travailler l'agent sans
  matière sans que personne voie passer la faute de frappe. Tant que c'est le cas, la consigne le dit à
  l'agent : sans document, il écrit en une phrase ce qu'il lui faut. Sans cette
  phrase, un contrôle de pièces sans pièces rend un rapport vraisemblable et
  faux, que le client n'a aucun moyen de démentir. Un dossier logique que le
  client n'a pas choisi n'est jamais deviné ; la lecture s'arrête à un niveau,
  à 20 fichiers et 120 000 caractères, et l'agent sait ce qu'il n'a pas vu et
  quels fichiers l'application n'a pas su ouvrir.
- **Les limites dures de la fiche suivent l'agent dans ce qu'il rend, pas
  seulement dans ce qu'il dit.** `expert.regles` allait au modèle par
  `ConversationEngine` et manquait à l'exécution d'une tâche, qui produit
  pourtant le document que le client utilisera : une fiche immigration interdit
  de se prononcer sur les droits d'une personne, et la tâche l'ignorait.
  `consigne_de_la_tache()` reprend le même ordre que la conversation — métier,
  ce que l'employeur a appris, ce qu'il a déjà repris (`journal-<prenom>.json`),
  puis les règles strictes en dernier. **Un savoir est `{titre, resume}`** : un
  premier jet cherchait un champ `texte` qui n'existe nulle part et perdait tout
  l'apprentissage de l'employeur sans rien signaler.
- **L'agent a son dossier de travail, et n'en sort que si le client le dit.**
  Les fiches nomment **8 724 dossiers de sortie distincts** pour 9 265 sorties,
  à peu près un par tâche : demander au client de les choisir avant que rien ne
  tourne, c'est l'impression de « paramétrer comme les agents du marché » que
  Max refuse. Chaque agent travaille donc dans
  `<personnel>/Documents/iAgent/<prénom>`, annoncé et pas demandé, et les
  dossiers logiques de la fiche en sont des sous-dossiers créés à la première
  écriture. `installation.json` peut porter `racine` (le dossier de l'agent) et
  `dossiers` (un dossier logique vers un vrai dossier du client) ; ce que le
  client désigne l'emporte. **Conséquence qui compte : par défaut l'agent ne
  lit et n'écrit que chez lui** ; atteindre un dossier du client demande qu'il
  l'ait désigné. Un chemin logique venu d'une fiche est revérifié (`..`, `/`,
  majuscules refusés) : le contrat l'impose déjà, mais il arrive du disque.
- **Ce que l'application attend du poste est écrit à un seul endroit**
  (`desktop/src-tauri/src/ressources.rs`, 23/09/2026) : rôle en clair, chemin
  cherché, variable qui le déplace, livrée ou non par l'installeur, et le remède
  quand elle manque. Deux bancs refusent l'écart **dans les deux sens** — une
  ressource déclarée livrée que `tauri.conf.json` ne pose pas, et une ressource
  déclarée absente qu'il pose quand même. Ce qui a fait écrire la règle :
  `voice.rs` affirmait « le binaire et la voix sont livrés avec l'application »
  et l'installeur ne livrait **ni l'un ni l'autre** ; sur un poste installé, la
  conversation vocale — la dernière étape du parcours minimal — ne pouvait pas
  démarrer, et l'écran n'en disait que « Failed to initialize voice », en
  anglais. La voix demande quatre pièces (moteur Piper, voix `.onnx`, ses
  réglages `.onnx.json`, modèle d'écoute) ; le README dit où les prendre.
  **Écouter et parler ne demandent pas les mêmes pièces** et se disent à part.
- **Une pièce que l'application va chercher se vérifie avant d'être posée**
  (`desktop/src-tauri/src/telechargement.rs`, décision de max du 24/09/2026 : le
  client ne pose plus rien à la main). Les adresses vivent dans
  `sources-ressources.json`, avec la taille et l'empreinte SHA-256 **relevées
  chez l'éditeur**, jamais écrites de mémoire. Trois refus tenus par le code :
  `https` seul et hôte d'une liste blanche (en clair, un modèle de 190 Mo se
  lirait et se remplacerait sur le chemin) ; taille **et** empreinte comparées
  avant de poser quoi que ce soit ; écriture en `.partiel` puis renommage, pour
  qu'un contenu refusé ne laisse rien derrière lui — un banc le vérifie, parce
  qu'un demi-fichier au bon nom ferait dire à l'application que la pièce est là.
  Un fichier sans empreinte publiée (les réglages `.onnx.json`, qui ne sont pas
  un objet LFS) se vérifie par sa lecture, déclarée en toutes lettres
  (`verification_autre`) : sans ça, `null` passerait pour « rien à vérifier ».
  **Le moteur Piper est déclaré depuis le 24/09/2026, pour Windows seulement**,
  et c'est le seul morceau qui soit une ARCHIVE : `chemin` est alors un dossier,
  et `poser()` l'ouvre — après l'empreinte, jamais avant, et une archive sans
  empreinte est refusée d'office (la lecture en JSON qui suffit à un fichier de
  réglages ne dit rien d'un ZIP). Trois refus de plus, tenus par des bancs : une
  entrée qui écrirait hors du dossier fait tout refuser **sans rien poser** ; le
  nombre d'entrées et la taille dépliée sont bornés avant la première écriture
  (22 Mo comprimés peuvent rendre des gigaoctets) ; le dossier se remplit en
  `.partiel` et le renommage est la dernière opération, parce qu'un moteur à
  demi extrait serait vu présent par `ressources.rs`. **Le dossier commun est
  retiré quand toute l'archive tient dedans** : le résultat ne dépend donc pas
  de la façon dont l'éditeur range son archive, et sa forme n'a pas eu à être
  relevée — ce qui compte, puisque la session ne joint pas github.com et n'a
  jamais ouvert cette archive. L'empreinte, elle, est CALCULÉE par
  l'intégration continue (`desktop/relever-piper.ts`), GitHub n'en publiant
  aucune pour une version antérieure au champ. **Windows seulement** parce que
  l'archive Linux est un `.tar.gz` et que le binaire n'embarque ni tar ni gzip ;
  ailleurs `ressources.rs` dit toujours où le prendre à la main, et son remède
  dépend du système. **Non constaté : personne n'a ouvert la vraie archive ni
  lancé `piper.exe`.** Le modèle d'écoute est
  `ggml-small-q5_1.bin` (190 Mo) et non `medium` (1,5 Go) : c'est le premier
  contact du client avec le produit. Aucune variante `-fr` n'existe chez
  whisper.cpp, vérifié à son API le 24/09.
- **Pas de connexion automatique aux comptes du client, pas de clic « Publier »
  sans validation, pas de contournement anti-robot.** Mêmes règles que
  DropShipPro : l'agent navigue avec les sessions ouvertes du client, remplit,
  le client valide. Les règles qui comptent sont appliquées par le code
  (`expert.regles` → l'application), pas seulement lues par le modèle.
- **Une question dont la réponse ne règle rien fait croire au client qu'il a
  décidé** (24/09/2026). L'entretien posait six questions de cadre — activité,
  horaires, intensité, répartition, autonomie, dossiers — l'écran affichait les
  réponses, et `embaucher()` n'écrivait dans `installation.json` que `prenom`,
  `ficheId`, `voix`, `sexe` et `photo`. Tout le reste tombait. Ça comptait
  d'autant plus que la règle de max réserve au client le droit de mettre une
  tâche sous contrôle : il n'avait **aucun moyen** de l'exercer. La question
  s'annonçait d'ailleurs à l'envers (« il y en a N où j'attends votre accord »)
  alors que rien n'attendait rien. Elle offre maintenant trois réponses écrites
  une seule fois (`AUTONOMIE_TOUT_SEUL`, `AUTONOMIE_CONSEILLEE`,
  `AUTONOMIE_TOUT_RELU`, dans `entretien.ts`), `planningDepuisAutonomie` en fait
  un planning, et `check-entretien` suit la chaîne jusqu'à `planningDuClient` —
  la même fonction que l'application lit. **Une réponse non reconnue ne pose
  aucun réglage** : on ne devine pas un choix que le client n'a pas fait. Les
  cinq autres sujets tombent toujours, et c'est le prochain maillon.
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
npm run controle-application  # typage React + tests Rust de l'application (176)
npm run controle-boutique     # la boutique : rend vraiment ses pages, tous onglets
npx tsc --noEmit
npm run verifier -- --corriger
npm run economie              # regénère docs/economie*.md (le banc refuse une table périmée)
npm run generer -- --sec --refaire --ids AG-0002   # --refaire : les 1 249 existent deja
node --experimental-strip-types outils/packs.ts   # quel agent sur quelle machine
npm run importer-connecteurs  # relit les relevés V6 -> connecteurs/catalogue.json
npm run verifier-connecteurs  # règle d'activation, seule ou dans npm run controle
```

`controle-application` ne rejoint pas `controle` : il demande les modules de
`desktop/` et les bibliothèques système de Tauri. Sur une machine neuve, les
poser d'abord, sinon `cargo` s'arrête sur `gdk-3.0` introuvable :

```bash
grep -v '^[[:space:]]*\(#\|$\)' desktop/dependances-systeme.txt \
  | xargs apt-get install -y
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
   **Le MSI se construit, et sur Windows** : `build-windows-msi.yml` tourne sur
   `windows-latest` à chaque poussée touchant `desktop/`, et dépose un artefact
   `iagent-desktop-msi` d'environ 9 Mo (constaté le 23/09/2026, run n°246 sur
   `phase-a`). La session, elle, n'a pas de Windows : les chemins de ressources
   sont tenus par un test plutôt que par une installation. **Reste non
   constaté : personne n'a encore installé ce MSI sur une machine.**
2. Premier lot de fiches : un secteur de 25, relu, puis les 544 P1.
3. Boutique : `drop-shipper.fr/b/iagent-agency` reste la vitrine ; les paquets
   deviennent des produits par le flux ; `iagent.agency` (OVH) à pointer dessus.
4. Catalogue LocalAgent définitif (références retenues, prix négociés) à la
   place du relevé AliExpress.
