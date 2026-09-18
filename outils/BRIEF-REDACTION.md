# Brief de rédaction d'un paquet d'agent (pour une session Claude qui écrit les fiches)

Tu écris des paquets d'agents pour iAgent : une application desktop qui fait tourner des agents IA
« employés » en local (sans jetons facturés) ou par API au choix du client. Chaque agent est un
expert de 25 ans d'expérience, renommé, incollable dans son domaine, préconfiguré avec ses tâches
quotidiennes. **Client type : un indépendant, une TPE ou une PME** qui achète l'agent pour son
propre usage. « Administration » désigne les fonctions administratives d'une entreprise, jamais
l'administration publique (mairie, préfecture, usagers) sauf si le nom du métier le dit.

## Ce que tu lis avant d'écrire

1. `contrat/paquet-agent.md` : le pourquoi de chaque champ. `contrat/paquet-agent.schema.json` : le quoi.
2. `agents/AG-0001-secretaire-administratif.json` et `agents/AG-0002-assistant-administratif.json` : deux paquets complets à imiter dans la forme.
3. `catalogue/catalogue.json` : les entrées à écrire (`id`, `secteur`, `metier`, `slug`, `profil`) et le profil commercial (`profils[]` : autonomie, besoin humain, risque réglementaire, workflow, outils cibles) qui fixe le niveau de validation humaine.
4. `dimensionnement/paliers-modeles.json` : les paliers de modèles locaux, clé = valeur à écrire dans `modeles`.

## Ce que tu écris toi-même (la partie éditoriale)

`famille`, `nom`, `accroche`, `description`, `expert` (persona, consigne, connaissances, regles),
`taches`, `connecteurs`, `acces`, `modeles`. Tu écris aussi les champs fixes : `format`, `id`,
`slug` (celui du catalogue), `version` `"1.0.0"`, `secteur`, `execution` (`modes` `["local","api"]`,
`defaut` `"local"`, `bascule` `"automatique"`, `api.capacites` = une entrée par capacité de `modeles`
avec `texte→llm`, `vision→llm-vision`, `image→image`, `video→video`, `audio→parole`,
`musique→musique`, `embeddings→embeddings`, `appelsParJourEstimes` `1`), `miseAJour`
(`stable`, `"1.0.0"`, `"Première version."`), et des blocs `materiel` et `commercial` **provisoires**
recopiés de AG-0001 : ils sont recalculés par `npm run verifier -- --corriger` depuis les sources de
vérité, tu ne les écris jamais à la main pour de vrai.

## Règles d'écriture

- Français soigné pour tout ce que lit le client ; commentaires ou jargon anglais : jamais.
- La `consigne` (≥ 800 caractères, en pratique 1 800 à 3 000) est écrite pour un modèle LOCAL : elle
  ne suppose ni recherche web, ni outil serveur, ni compte que l'utilisateur n'a pas ouvert. Elle dit
  le travail quotidien, ce que l'agent ne fait jamais, comment il parle à l'utilisateur, comment il
  rend compte (trois lignes le soir), comment il rédige.
- 4 à 7 tâches concrètes, chacune avec un vrai dossier de sortie (`sorties[].dossier` en
  minuscules-et-tirets, ex. `comptabilite/factures`). `validationHumaine` vrai pour tout ce qui part
  vers l'extérieur ou engage l'entreprise. Les `planification` possibles : `quotidienne` (`heure`
  `"08:00"`), `intervalle` (`minutes` ≥ 5), `declencheur` (`evenement` parmi `email.recu`,
  `whatsapp.recu`, `fichier.depose`, `calendrier.evenement`, `appel.recu`), `a-la-demande`.
  Formats de sortie autorisés : md, txt, docx, xlsx, pdf, csv, json, png, jpg, mp4, mp3, wav, html, eml.
- `connaissances` : 3 à 5 domaines réels du métier, résumés avec précision (≥ 80 caractères chacun,
  pas de généralités). `regles` : 2 à 4 phrases, ce que le code empêche, pas des vœux.
- `connecteurs` contient toujours `voix` et `conversation` ; parmi `email`, `whatsapp`, `voix`,
  `conversation`, `navigateur`, `calendrier`, `fichiers`, `telephone`.
- `acces` : `dossiers` `"choisis"` (jamais `total` par défaut), `internet` vrai ou faux, `logiciels` en
  identifiants minuscules (`client-email`, `libreoffice`, `tableur`, `navigateur`, `crm`, `whatsapp`,
  `calendrier`, `generateur-image-local`, `retouche-image`, `montage-video`…).
- `modeles` : le palier le plus léger qui fait le travail. `texte-standard` pour la plupart des postes,
  `texte-avance` quand il faut raisonner (juridique, financier, analyse), `texte-expert` presque jamais.
  `vision` seulement si l'agent lit des documents scannés, des photos ou des captures. `image`,
  `video`, `musique` seulement si le métier les produit. `audio` (`audio-parole`) et `embeddings`
  presque toujours (voix et mémoire). `activite` = part du temps sur 24 h où l'agent sollicite ses
  modèles : 0,1 poste de bureau calme, 0,15 à 0,25 poste actif, 0,3 poste qui navigue beaucoup,
  0,6 et plus pour un générateur en série.
- `famille` : `metier` par défaut ; `ecommerce` pour le secteur e-commerce ; `reseaux-sociaux` pour
  les postes social media / community ; `fonction` pour un poste de production (design, photo,
  vidéo, audio, rédaction en série, reporting) ; `configurable` jamais.
- N'invente aucune obligation légale précise que tu ne connais pas : reste au niveau des usages du
  métier. Pas de chiffres inventés présentés comme des faits.
- Chaque fiche doit être DIFFÉRENTE : deux métiers voisins (assistant comptable, opérateur de saisie
  comptable) ont des tâches, des connaissances et des règles qui leur sont propres. Pas de
  copier-coller entre fiches, pas de tâche générique « traiter les demandes ».

## Comment tu travailles

1. Écris chaque fichier `agents/<ID>-<slug>.json` (le slug est celui du catalogue).
2. Lance `npm run verifier -- --corriger` (recalcule materiel, commercial, appels) puis `npm run verifier`
   et corrige jusqu'à `0 faute(s)`. Le validateur refuse un champ manquant, un format inconnu, une
   consigne trop courte, une capacité API qui ne couvre pas `modeles`.
3. Ne touche à rien d'autre dans le dépôt. Ne commite pas, ne pousse pas : la session principale le fait.
4. Rends compte en dix lignes : fichiers écrits, résultat du validateur, doutes sur un métier.
