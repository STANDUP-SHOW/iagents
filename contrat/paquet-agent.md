# Contrat du paquet d'agent iAgent — format `iagent-paquet/1`

Un agent iAgent est **un fichier JSON** (le paquet) accompagné, s'il en a, de
ses documents de connaissances. Ce seul fichier sert à quatre consommateurs
qui ne doivent jamais diverger :

| Consommateur | Ce qu'il lit |
|---|---|
| La boutique (iagent.agency) | `nom`, `accroche`, `description`, `taches`, `commercial`, `materiel` → fiche produit |
| L'application desktop iAgent | `expert`, `taches`, `connecteurs`, `acces`, `modeles` → installation et exécution |
| Le dimensionnement (LocalAgent) | `modeles`, `materiel` → pack d'agents ↔ machines |
| Les mises à jour | `id`, `version`, `miseAJour` → « toujours une part chez nous » |

Le schéma machine est `paquet-agent.schema.json` (JSON Schema, draft 2020-12).
Ce document dit **pourquoi** chaque champ existe ; le schéma dit **quoi**.

## Identité

- `format` : toujours `"iagent-paquet/1"`. Un changement incompatible incrémente le chiffre.
- `id` : l'identifiant du catalogue (`AG-0001`). Stable pour toujours : c'est la clé d'achat et de mise à jour.
- `slug` : adresse lisible (`secretaire-administratif`). Unique dans le catalogue.
- `version` : semver du paquet. Toute modification du contenu l'incrémente.
- `famille` : `metier` (un poste), `fonction` (une capacité : images, vidéos, rapports…), `ecommerce`, `reseaux-sociaux`, `configurable` (gabarit à remplir par le client).
- `secteur` : identifiant de secteur du catalogue (43 valeurs, `catalogue.json`).
- `nom`, `accroche` (une phrase), `description` (ce qu'il fait tous les jours, en clair).

## L'expert (`expert`)

Le vendeur achète « un employé qui sait ». Ce savoir vit ici :

- `persona` : qui il est — 25 ans d'expérience, renommé dans son domaine, incollable.
- `consigne` : la consigne système complète, écrite pour un modèle **local** (elle ne suppose ni outil serveur ni recherche web Anthropic). C'est le texte le plus long du paquet.
- `connaissances[]` : documents de référence chargés dans la mémoire locale (RAG). Chaque entrée a `titre`, `resume` et, s'il existe, `fichier` (chemin relatif au paquet). Sans fichier, `resume` suffit : il est injecté tel quel.
- `regles[]` : ce qu'il ne fait jamais sans validation humaine. Une règle est **appliquée par l'application**, pas seulement lue par le modèle — le modèle cède quand l'utilisateur insiste, le code non (leçon des tickets DropShipper).

## Les tâches (`taches[]`)

Une tâche est ce que l'utilisateur peut **activer, désactiver, ajuster** depuis
l'application. C'est l'unité de réglage, d'où sa structure fixe :

- `id` : stable dans le paquet (`relever-courrier`).
- `nom`, `description`.
- `planification` : `{ "type": "quotidienne", "heure": "08:00" }`, `{ "type": "intervalle", "minutes": 30 }`, `{ "type": "declencheur", "evenement": "email.recu" }` ou `{ "type": "a-la-demande" }`.
- `entrees[]` : d'où vient la matière (`email`, `dossier:entrant`, `calendrier`, `navigateur:<url>`, `conversation`).
- `sorties[]` : où va le résultat — `{ "dossier": "courrier/reponses", "format": "docx" }`. **Toujours un dossier** : c'est là que l'utilisateur consulte le travail.
- `logiciels[]` : ce qu'elle a le droit d'utiliser (`libreoffice`, `outlook`, `navigateur`, `excel`). L'utilisateur peut restreindre.
- `validationHumaine` : `true` si le résultat attend un accord avant d'être envoyé ou publié. Le niveau d'autonomie du profil commercial fixe le défaut.
- `active` : état par défaut à l'installation.

## Connexion au monde

- `connecteurs[]` : parmi `email`, `whatsapp`, `voix`, `conversation`, `navigateur`, `calendrier`, `fichiers`, `telephone`. La voix est **toujours** présente : c'est l'échange privilégié.
- `acces` : `{ "dossiers": "choisis" | "total", "internet": true, "logiciels": [] }`. Le défaut est `choisis` : l'utilisateur ouvre ce qu'il veut. `total` ne se coche que par lui.

## Modèles et matériel — ce qui parle à LocalAgent

- `modeles` : par capacité, le **palier** requis (voir `dimensionnement/paliers-modeles.json`) :
  `texte` (obligatoire), et selon l'agent `vision`, `image`, `video`, `audio`, `musique`, `embeddings`.
  Exemple : `{ "texte": "texte-standard", "audio": "audio-parole", "embeddings": "embeddings" }`.
- `materiel` : **dérivé** des paliers par `dimensionnement/calculer.ts`, jamais écrit à la main dans la fiche produit (il y serait faux dès que la table change). Le paquet le porte quand même, recalculé à chaque publication, pour que la boutique l'affiche sans calcul : `ram`, `vram` (mémoire des modèles : les paliers texte, audio et embeddings restent chargés, les paliers image, vidéo, vision, musique se chargent un à la fois), `cpuCoeurs`, `disque` (Go), `chargeContinue` (part de la capacité d'une carte de référence occupée en moyenne sur 24 h, entre 0 et 1) et **`gpu`** : la classe de carte minimale (`integre`, `dediee-entree` 8 Go, `dediee-milieu` 12 Go, `dediee-16`, `dediee-haut` 24 Go, `serveur`) avec son libellé lisible. C'est **la configuration nécessaire** : elle s'affiche sur la fiche produit, et l'application la répète quand la machine du client ne suffit pas.

**Un agent qui ne tourne pas en local le dit toujours pourquoi.** `diagnosticLocal()` compare ses besoins au catalogue de machines ressource par ressource (mémoire des modèles, puissance, disque) et rend la raison en clair plus la configuration nécessaire. La boutique, le configurateur de packs et l'application affichent les deux ; « impossible » sans raison n'existe pas.

**Règle de calcul qui change tout** : deux agents qui utilisent le même palier
partagent **les poids du modèle** (une seule copie en mémoire) mais pas la
charge de calcul. Trois agents « texte-standard » sur une machine coûtent 8 Go
de VRAM une fois, et trois charges. C'est ce qui rend un mini-PC viable pour un
pack de bureau entier.

## Commercial (`commercial`)

Recopié du profil du catalogue (`catalogue/catalogue.json` → `profils`), jamais
inventé par le générateur : `profil`, `priorite`, `pack`, `prixMensuel`,
`autonomie`, `besoinHumain`, `risqueReglementaire`. Le prix affiché en boutique
vient d'ici.

## Mise à jour (`miseAJour`)

- `canal` : `stable` ou `beta`.
- `appMinimum` : version minimale de l'application desktop.
- `notes` : ce qui a changé depuis la version précédente (affiché à l'utilisateur avant d'accepter).

## Ce que le paquet ne contient jamais

- Aucun secret (identifiants email, clés, jetons) : ils sont saisis dans l'application et restent sur la machine.
- Aucune adresse de serveur : l'application connaît la sienne.
- Aucune logique exécutable : le paquet décrit, l'application exécute. Un paquet est donc inoffensif à télécharger.

## Exécution : local ou API, au choix du client (`execution`)

Décision du 18/09/2026 : **tout agent sait tourner en local et par API**, et
c'est le client qui choisit dans l'application, jamais le paquet.

- `modes` : toujours `["local", "api"]`.
- `defaut` : `local`. L'argument commercial est le local (aucun token facturé) ; l'API est le secours et le confort.
- `bascule` : `automatique` (l'application passe par l'API quand le local ne peut pas, en avertissant) ou `manuelle` (elle s'arrête et demande). Le client peut changer ce réglage agent par agent.
- `api.capacites` : pour chaque capacité de `modeles`, la famille d'API qui la remplace (`llm`, `llm-vision`, `image`, `video`, `parole`, `musique`, `embeddings`). Le client renseigne **ses** clés (Anthropic, OpenAI, Google, Mistral, ElevenLabs…) dans l'application ; elles restent sur sa machine, dans le trousseau du système, jamais dans un paquet ni chez nous.
- `appelsParJourEstimes` : dérivé de la planification des tâches (`calculer.ts`), sert à l'avertissement de coût avant de passer un agent en API. Remplacé par la mesure réelle après une semaine.

Ce que l'application fait avec ça :

1. À l'installation d'un agent, elle calcule la **jauge** de la machine avec tous les agents actifs en local (`jaugeMachine`) : confortable, chargée, saturée, impossible. Chaque état a son message et sa proposition (retirer un agent, passer le plus lourd en API).
2. Quand le local ne peut pas (mémoire insuffisante, machine saturée, modèle non installé, panne) et que `bascule` est automatique, elle **prévient** (« l'agent X passe par l'API Y, ~N appels/jour, coût estimé ») et bascule. Sans clé d'API renseignée pour la capacité manquante, l'agent s'arrête avec le motif écrit : jamais de tâche exécutée à moitié en silence.
3. Le client peut à tout moment forcer un agent en `local`, en `api` ou en `auto`, et voir pour chacun ce qu'il consomme (charge locale ou appels/jour).
