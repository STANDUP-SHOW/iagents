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
npm run generer -- --sec --refaire --ids AG-0002   # prépare les requêtes sans rien envoyer
                                                  # --refaire est obligatoire : la fiche existe déjà
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

## La voix : ce que l'application va chercher, et ce qui reste à poser

Le MSI (9,6 Mo) porte l'application, les 1 249 fiches et les catalogues, jamais
la voix : ses pièces pèsent à elles seules plus de vingt fois le reste. Sur
décision de max le 24/09/2026, **l'application va les chercher elle-même** au
lieu de demander au client de les poser à la main. L'onglet « Installer la
voix » dit ce qui manque et ce que ça pèse avant qu'il ne clique.

Les sources sont déclarées dans `desktop/src-tauri/sources-ressources.json` et
le téléchargement vit dans `telechargement.rs`. Trois refus sont dans le code :
**https seul et hôte d'une liste blanche** (une adresse en clair laisserait lire
ce qui descend), **taille et empreinte SHA-256 relues avant de poser le
fichier** (un téléchargement coupé vaut un modèle qui ne se charge pas, et le
motif serait incompréhensible), et **écriture en `.partiel` puis renommage**,
pour qu'un contenu refusé ne laisse rien derrière lui.

| Pièce | Où elle va | D'où elle vient | Qui la pose |
| --- | --- | --- | --- |
| Le modèle d'écoute | `modeles/ggml-small-q5_1.bin` (190 Mo) | [ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp) | l'application |
| La voix française | `modeles/fr_FR-siwis-medium.onnx` (63 Mo) | [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices), `fr/fr_FR/siwis/medium/` | l'application |
| Ses réglages | `modeles/fr_FR-siwis-medium.onnx.json` | le même dossier ; Piper le lit à côté du modèle | l'application |
| Le moteur de voix Piper | `piper/` (l'archive s'y ouvre) | la version 2023.11.14-2 de [rhasspy/piper](https://github.com/rhasspy/piper) | l'application **sous Windows**, à la main ailleurs |

**Le moteur Piper est une archive, et l'application l'ouvre.** C'est le seul
des quatre morceaux qui ne soit pas un fichier : `piper_windows_amd64.zip`
(22 477 236 o) porte `piper.exe`, ses DLL et les données d'espeak-ng, dont le
moteur ne se passe pas. `chemin` est donc un **dossier**, et l'ouverture ajoute
ses propres refus à ceux du téléchargement : une entrée qui écrirait hors du
dossier (`../`, chemin absolu) fait tout refuser sans rien poser, le nombre
d'entrées et la taille dépliée sont bornés avant la première écriture, et le
dossier se remplit en `.partiel` avant d'être renommé — un moteur à demi extrait
serait vu comme présent par `ressources.rs`, ce qui est pire qu'absent. Quand
toute l'archive tient dans un seul dossier, ce dossier est retiré : le résultat
est le même que l'éditeur range son archive d'une façon ou de l'autre, ce qui
évite d'avoir à relever sa forme.

**Windows seulement**, et c'est écrit dans la déclaration (`"pour": "windows"`) :
l'archive Linux est un `.tar.gz`, et le binaire n'embarque ni tar ni gzip — le
lecteur ZIP, lui, y est déjà pour les `.xlsx` et les `.docx`. Sur les autres
systèmes `ressources.rs` continue de dire où prendre le moteur à la main. Son
empreinte a été **calculée** par l'intégration continue sur le fichier de
l'éditeur (`desktop/relever-piper.ts`, qui tourne chez GitHub là où la session
qui a écrit ce code ne joint pas github.com), parce que GitHub ne publie aucun
digest pour une version antérieure au champ ; le flux la recompare à chaque
passage.

**Non constaté** : cette archive n'a jamais été ouverte ici, et `piper.exe` n'a
jamais tourné sur une vraie machine Windows. Ce qui est éprouvé, ce sont les
refus, sur des archives écrites pour le banc.

Le choix du modèle d'écoute est tranché : `small` quantifié (190 Mo) plutôt que
`medium` (1,5 Go), parce que c'est le premier contact du client avec le produit
et que `reconnaitre()` rapproche les noms de produits après coup. whisper.cpp ne
publie aucune variante `-fr` : le chemin attendu suit désormais le nom réel du
fichier.

**Non constaté :** ce téléchargement n'a jamais tourné sur une machine Windows,
comme le reste de l'installeur. Les bancs éprouvent la vérification et l'écriture
sans réseau ; ce qu'ils ne disent pas, c'est ce que fait un vrai poste.

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
  `desktop/`. **Personne ne l'a encore installé sur une vraie machine** ; la voix
  se télécharge au premier lancement, moteur Piper compris sous Windows
  (ci-dessus).
- **Pas fait** : panier et paiement sur la boutique ; catalogue LocalAgent
  définitif (`machines.json` reste un relevé AliExpress indicatif).
