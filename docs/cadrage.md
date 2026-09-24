# iAgent / e-Agent — cadrage complet du projet

Écrit le 22/09/2026 à partir des **dix documents** fournis par Max. Il dit
**ce que le projet promet, ce qui existe vraiment, où les documents se
contredisent entre eux, et dans quel ordre combler l'écart**.

`CLAUDE.md` garde les règles durables, `ONBOARDING.md` l'état courant du dépôt,
`README.md` son contenu. Ce fichier-ci est le cadrage produit.

> Document vivant : tout nouveau document se range ici plutôt que dans un
> second cadrage.

---

## 1. Les dix documents, et lequel fait foi

Ils ne disent pas la même chose, et c'est normal : ils ont été écrits à des
moments différents d'une réflexion qui a évolué. Le risque n'est pas la
contradiction, c'est de ne pas savoir laquelle gagne. Voici l'arbitrage, par
sujet, **par la date et par le niveau de détail** :

| Sujet | Document qui fait foi | Date | Ce qu'il remplace |
|---|---|---|---|
| **Architecture de l'application** | Prompt maître e-Agent Desktop/Mobile/Remote v1.2 | — | Les scripts Electron du cahier des charges |
| **Connecteurs, MCP, moteurs IA** | Référentiel MCP/API/moteurs + catalogue V6 | 21/09 | Les listes indicatives du cahier |
| **Catalogue métiers, packs, ERP/CRM** | Catalogue V6 (connecteurs MCP) | 21/09 | V3 et V4 |
| **Prix** | Business plan V2, § « étude tarifaire obligatoire » | 20/09 | V4 (**archivée par V6 elle-même**), cahier, étude de marché |
| **Levée et financiers** | Business plan V2 — 3,5 M€ | 20/09 | Le cahier (600 k€–1 M€) |
| **Vision, récit, rubriques produit** | Cahier des charges + roadmap 4 rubriques | — | — |
| **Ciblage investisseurs** | Note intelligence agent + BP V2 §12 | — | — |

**Le prompt maître v1.2 est le meilleur document technique du lot.** Il est
rigoureux, sécurisé, et il décrit presque exactement ce que le desktop fait
déjà — mêmes coffres OS, même SQLite, même validation humaine, même appel par
prénom. C'est lui la spécification de référence, pas le cahier des charges.

**Le business plan V2 est le meilleur document commercial.** Il est sobre, il
cite ses sources, il liste ses propres risques — dont *« produit final non
démontré → perte de confiance investisseur »*. Il ne promet pas ce qu'il ne
peut pas montrer.

---

## 2. État réel au 22/09/2026 — promesse contre code

Le cahier des charges affirme « la technologie est entièrement finalisée, codée,
développée et testée » et pose le risque R&D à 0 €. Le business plan V2, plus
récent, nuance déjà : *« produit présenté par le porteur comme finalisé »*, et
exige en §15 une **data room avec démonstration reproductible Desktop, Mobile,
Remote, MCP et navigateur sécurisé**. Voici ce qui est réellement livrable
aujourd'hui pour cette data room.

| Attendu | Réel dans le dépôt | |
|---|---|---|
| Application desktop qui exécute des agents | MSI Windows installé et fonctionnel chez Max (voix, fiches, conversation, courriel, journal) | ✅ |
| Catalogue de métiers | 1 249 fiches valides, `npm run controle` 0 faute | ✅ |
| Appel de l'agent par son prénom, réponse vocale | Whisper + Piper, détection par prénom avec silence en cas d'ambiguïté | ✅ |
| Autonomie + validation humaine par tâche | Mode auto par défaut, contrôle avec motif obligatoire | ✅ |
| Apprentissage persistant | Journal par agent, relu à chaque démarrage, prioritaire dans le prompt | ✅ |
| Secrets au coffre du système | Windows Credential Manager (`keyring`) | ✅ |
| Lecture de boîte mail | IMAP en lecture seule | ✅ |
| **MCP (client, gestionnaire, allowlist, sandbox)** | **Aucune ligne** | ❌ |
| **Navigateur sécurisé à sessions persistantes** | **Aucune ligne** | ❌ |
| **Mobile et Remote** | **Aucune ligne** | ❌ |
| Connecteurs ERP/CRM/bureautique | Aucun. 20 noms génériques dans les fiches (`excel`, `crm`) | ❌ |
| Moteur proactif (plan, relance, replanification, escalade) | Planification existe, pas la poursuite de mission | ❌ |
| Packs d'entreprise / AI Offices | Le format n'existe pas au contrat | ❌ |
| Budgets, quotas, coûts par agent | Aucun | ❌ |
| Licence, achat, location | Aucun | ❌ |
| Avatars / Movie Creator / Web Compagnons | Aucun | ❌ |

**Formulation honnête et vendable, pour l'investisseur :** *« Le socle est en
production : 1 249 experts métier livrés, application desktop qui les exécute
en local, voix, autonomie, apprentissage. La levée finance l'industrialisation,
le matériel et l'acquisition — pas l'invention du produit. »* C'est vrai, c'est
démontrable sur ta machine, et c'est déjà un positionnement rare. « Zéro R&D
restante » ne l'est pas, et le premier audit technique de due diligence le
verra — le business plan V2 le dit lui-même.

---

## 3. Les contradictions à trancher

### 3.1 Le nom : iAgent ou e-Agent ? — **décision de Max**

Les documents les plus récents (BP V2, catalogue V6, prompt maître) disent
**e-Agent Agency** et **Local Agent**. Le dépôt, la boutique en ligne et le
domaine acheté chez OVH disent **iAgent**, **iagent.agency** et **LocalAgent**.

Ce n'est pas un détail : c'est le nom sur le MSI, dans le coffre Windows
(`iagent-desktop`), dans les chemins de fichiers, sur la boutique et dans le
DNS. Plus on tarde, plus la migration coûte.

C'est ta décision, pas la mienne. Mon avis : **garder iAgent**, parce que le
domaine est déjà acheté et que `e-agent` est très générique, donc faible en
marque comme en référencement. Mais c'est un avis de technicien sur un sujet
qui ne l'est pas.

### 3.2 Le prix : quatre modèles incompatibles

| Source | Modèle | MRR pour 20 agents |
|---|---|---|
| Cahier des charges | 7 499 € matériel + 799 €/mois | 799 € |
| Roadmap model preview | 3 999 € matériel + 799 €/mois | 799 € |
| Étude de marché | 3 500–12 000 € + 190–1 490 €/mois | ~790 € |
| Catalogue V4 | Solo 79 € … Business 1 990 €/mois | ~699 € |
| **Catalogue V6 (21/09)** | **49,90 € achat ou 9,90 €/mois par agent, API payée par le client** | **198 €** |

V6 **archive explicitement V4** (« ancien scénario SaaS tout compris, non retenu »).
Et le business plan V2, écrit la veille, dit que 9,90 € *« risque de ne pas
financer la maintenance d'un agent proactif connecté »* et propose cinq
niveaux, de 9,90 € à 999 €/mois.

Conséquence concrète : **le pitch investisseur du cahier des charges annonce
79 900 €/mois de MRR pour 100 clients, alors que le tarif V6 en donne 19 800 €.**
Un facteur 4. Aucun investisseur ne signe sur deux documents qui se contredisent
d'un facteur 4 sur la seule ligne qui compte.

À faire : **un seul prix**, celui du BP V2 (grille à cinq niveaux), et
`dimensionnement/economie.ts` doit le valider fiche par fiche avant publication.

### 3.3 « Local sans tokens facturés » — le chiffre de V6 contredit l'argument

La synthèse Local Agent de ton propre catalogue V6 dit : **10 agents sur 1 075
sont éligibles à ≥ 80 % d'exécution locale seuls**, et l'économie haute moyenne
est de **47 %**.

La règle durable du dépôt dit : *matériel + API résiduelle au moins **3× moins
cher** que l'API seule*, et `economie.ts` la vérifie fiche par fiche.

Les deux ne peuvent pas être vraies. Les méthodes diffèrent : V6 compte **un
agent seul sur sa machine**, `economie.ts` compte **les agents qui se partagent
un bundle** — et c'est justement le partage qui fait passer le ratio de 0,5 à 3.
Le dépôt a mesuré la même chose côté designer : seul sur une carte dédiée, il ne
passe pas la règle.

Donc les deux disent le même fait sous deux angles, mais un seul chiffre peut
partir en clientèle. À faire : **une seule méthode de calcul**, celle du dépôt,
et le catalogue V7 reprend ses chiffres. L'argument devient : *« les agents se
partagent une machine ; seuls sur une carte dédiée, ils ne sont pas rentables »*
— ce qui est vrai, vérifiable, et vend le bundle plutôt que la machine unitaire.

### 3.4 Deux catalogues de machines

`dimensionnement/machines.json` : mini-PC poste ~170 €, Firebat AM02 271 €,
bundle L 5070 Ti ~1 900 €, XL 5090 ~3 800 €.
Catalogue V6 : LA-S 999 €, LA-M 1 490 €, LA-L 3 190 €.
Cahier des charges : Box ~600 €, Centrale ~3 200 €.

Trois relevés, aucun devis. `npm run verifier` refuse déjà toute divergence
interne ; il faut la même discipline ici. À faire : les tiers LA-S/M/L/XL
entrent dans `machines.json`, le banc les place, et **les documents commerciaux
citent le dépôt**. V6 marque déjà ses prix « indication commerciale à confirmer
par devis » — c'est la bonne mention, il faut la garder partout.

### 3.5 91 fiches portent le mauvais métier — défaut réel, corrigeable

En comparant les 1 075 identifiants du catalogue officiel aux fiches du dépôt :
**984 correspondent exactement, 91 ont dérivé.**

| Identifiant | Métier au catalogue | Métier dans la fiche |
|---|---|---|
| AG-0901 | Assistant événementiel | Agent Traitement Donnees |
| AG-0902 | Event planner assistant | Gestionnaire Archives |
| AG-0903 | Agent réservation salle | Coordinateur Administratif |
| AG-0904 | Agent inscription participants | Agent Conformite Interne |

Le générateur a perdu les vrais intitulés sur certains secteurs et les a
remplacés par des noms génériques. **C'est la cause du problème déjà repéré :**
les secteurs `evenementiel`, `immigration-voyage-administratif` et
`associations-administration` sont à 100 % d'accroches génériques — parce que le
modèle écrivait sur un métier qui n'existait pas. Le catalogue V6 porte les bons
intitulés : la correction est mécanique.

Par ailleurs le dépôt contient **174 fiches (AG-1076 et suivantes) absentes du
catalogue officiel**. À trancher : elles entrent au catalogue V7, ou elles
sortent. Deux catalogues de tailles différentes, c'est deux vérités.

### 3.6 Electron contre Tauri — tranché : on garde Tauri

Le cahier prescrit Electron ; le desktop est en Tauri v2. Ce qui compte n'est pas
le cadre mais les deux besoins derrière : **un navigateur qui garde les sessions**
et **un agent qui clique dedans**. Tauri v2 embarque une WebView persistante et
pilote Chrome par CDP. Refaire en Electron coûterait des semaines pour la même
fonction, avec trois fois l'empreinte mémoire sur un mini-PC — exactement la
machine qu'on vend. Le prompt maître v1.2, lui, ne prescrit aucun cadre : il
demande « un shell desktop multiplateforme et un service local séparé ». Tauri
le fait.

### 3.7 « Invasion réseau » : 50 agents publiant chaque jour — impossible tel quel

Créer et animer en masse des comptes TikTok / Instagram / Facebook pilotés par
des avatars viole les conditions des trois plateformes (comptes non
authentiques, automatisation non autorisée). Le résultat n'est pas théorique :
bannissement en vague, et c'est **le client** qui perd ses comptes.

Ce qui est légal et fait l'essentiel de la valeur promise :
- **génération** des contenus en masse par les avatars — c'est là qu'est le travail ;
- **publication par les API officielles** (TikTok Content Posting, Instagram Graph,
  Facebook Graph, YouTube Data, LinkedIn), toutes en P0 dans ton propre référentiel ;
- **file d'attente + un clic** pour ce qu'aucune API ne couvre.

C'est la règle `CLAUDE.md` déjà en vigueur, et c'est aussi ce que dit ton prompt
maître : *« la proactivité reste bornée par les règles des plateformes »*.

De même, l'argument « anti-détection / empreinte humaine parfaite » du cahier
est à retirer : c'est du contournement anti-robot, interdit par la règle durable,
et invendable en due diligence. Le remplaçant est meilleur : **sessions
persistantes sur le vrai navigateur du client** — pas de reconnexion, pas de
captcha permanent, parce que c'est réellement son navigateur.

### 3.8 Passerelle mobile par services d'accessibilité

Faisable sur Android, **impossible sur iOS**, et refusée au Play Store hors cas
d'usage handicap. Le prompt maître v1.2 a déjà tranché autrement, et mieux :
**Mobile compagnon + Remote à commandes métier**, appairage par QR code,
*« ne jamais ouvrir un port entrant sur la box de l'utilisateur »*, prise en main
d'écran en module optionnel à consentement visible et durée limitée. C'est cette
version-là qu'on construit.

### 3.9 Le script de licence du cahier est cassé

Trois défauts dans un composant présenté comme la sécurisation du produit :

1. `verifyLicenseOnDesktop(licenseKey, publicKey)` utilise la **même clé** pour
   le HMAC et le déchiffrement AES. Il n'y a pas de clé publique : c'est un
   secret symétrique livré sur chaque poste. **N'importe quel client peut se
   forger une licence MASTER à 999 agents.**
2. IV fixe à zéro : deux licences identiques donnent le même chiffré.
3. `licenseKey.split('-')` casse dès que le chiffré contient un tiret.

Réécriture : signature **Ed25519**, clé privée côté serveur, clé publique dans
l'application. Le poste vérifie, il ne déchiffre rien.

*(Le script WebView Electron du même document a les mêmes défauts :
`setPermissionRequestHandler` accorde micro, caméra et position à n'importe
quelle page, et `agent-dom-click` injecte un sélecteur non échappé dans
`executeJavaScript`. Ils ne seront pas repris.)*

---

## 4. Le référentiel connecteurs entre dans le dépôt

C'est le chantier le plus rentable de tous les documents, et le plus proche du
code. Le catalogue V6 contient **déjà écrit** ce que Max demande depuis des
semaines :

- **77 ERP/CRM** (`CRM001` Salesforce, `ERP001`…) avec authentification,
  administrateur requis, lecture/écriture, webhooks, **transport MCP conseillé**,
  statut, étapes utilisateur et étapes intégrateur ;
- **28 canaux de communication** (`COM001` WhatsApp Business…) ;
- **32 outils bureautiques** (`OFF001` Microsoft Graph, `OFF003` LibreOffice…) ;
- **43 packs sectoriels** qui associent chaque secteur à ses ERP/CRM cœur,
  ses optionnels, ses canaux et sa bureautique par défaut ;
- un **guide de connexion** par profil (OAuth utilisateur, OAuth admin, clé API)
  avec stockage du secret, test automatique et révocation.

**C'est exactement la « liste déroulante CRM/ERP pré-établie par métier » que tu
demandais.** Elle est écrite. Il reste à la faire entrer dans le code.

Ce que ça débloque, dans l'ordre :

1. La **matrice à cocher** : le client coche Odoo, Shopify, Pennylane —
   l'application sait quoi lui demander, parce que c'est dans le catalogue.
2. La **liste par métier** : la fiche déclare son pack sectoriel, l'application
   propose les connecteurs de ce pack. Rien à saisir.
3. La **règle d'activation** que ton référentiel pose lui-même — *un connecteur
   n'est activé qu'après identification de son éditeur, de son authentification,
   de ses permissions, de ses coûts et de son risque* — appliquée par le code.
4. Les 20 noms génériques des fiches remplacés par des connecteurs réels.

Ordre d'implémentation, tiré des P0 du référentiel croisés avec ce que les
1 249 fiches réclament (email 1 226, WhatsApp 1 145, calendrier 1 168,
fichiers 1 249, navigateur 24, téléphone 6) :

| Rang | Connecteur | Pourquoi d'abord |
|---|---|---|
| 1 | `OFF001` Microsoft Graph + `OFF002` Google Workspace | Mail, agenda, fichiers : couvre presque toutes les fiches d'un coup |
| 2 | Filesystem + Fetch + Playwright (MCP de référence) | Le socle d'exécution de tout agent |
| 3 | `COM001` WhatsApp Business Platform | 1 145 fiches l'annoncent |
| 4 | Odoo, HubSpot, Shopify, Stripe | Les quatre métiers les plus vendus |
| 5 | Meta / Google / TikTok Ads | Rubrique Web Compagnons |

---

## 5. Les étapes

Cinq jalons. Chacun se termine par quelque chose d'installable et de vérifiable
sur ta machine Windows — pas par un document.

### Jalon A — Solidifier ce qui existe *(le plus court chemin vers vendable)*
- Corriger les **91 fiches au mauvais métier** depuis le catalogue V6, et
  trancher le sort des 174 fiches hors catalogue.
- Réécrire les **385 accroches génériques**, avec un validateur qui refuse les
  suivantes au `npm run controle`.
- Embarquer fiches + configuration dans le MSI (supprime 2 des 5 étapes
  d'installation manuelle) ; modèles Whisper et Piper téléchargés au premier
  lancement.
- Le parcours de configuration en 9 écrans : sexe → prénom → voix → photo →
  compétences → logiciels → planning → dossiers source → dossiers destination.
- Envoi SMTP (la lecture est faite).
- Empreinte vocale : `verify_voice` renvoie aujourd'hui 0,85 en dur et accepte
  n'importe qui. Soit on la branche, soit on la retire de l'interface.

### Jalon B — Connecteurs et MCP *(le cœur du produit)*
- `connecteurs/catalogue.json` + schéma + validateur, importé de V6.
- Client MCP dans le desktop : `stdio` local et Streamable HTTP distant,
  allowlist par agent, délais, quotas, journal, arrêt immédiat.
- Écran « matrice à cocher », OAuth, secrets au coffre système.
- Les cinq rangs du §4, dans l'ordre.
- À partir de là, **un nouveau connecteur est une ligne de catalogue**, plus du
  code Rust. C'est ce qui rend 1 249 agents tenables.

### Jalon C — Navigateur, omnicanalité, proactivité
- Pilotage du Chrome du client (Playwright / CDP), profils de session isolés.
- Blocage 2FA → notification → reprise (le flux de contrôle existe déjà).
- **Moteur proactif** : une mission validée devient un objectif persistant —
  plan, action, surveillance, relance, voie alternative, escalade, reprise.
  C'est la différenciation n°1 du business plan, et elle n'existe pas encore.
- Telegram (code partiel), téléphonie (Twilio), Mobile compagnon + Remote.

### Jalon D — Les quatre rubriques de la roadmap
- **Web Compagnons** : par les API officielles (§3.7). Le plus proche du socle.
- **Packs d'entreprise / AI Offices** : les 43 packs de V6 entrent au contrat
  (équipe d'agents + jalons + matériel chiffré depuis `dimensionnement/`), puis
  3 packs écrits à la main avant d'en industrialiser 2 000.
- **Creators Agents** : bibliothèque d'avatars, exclusivité à l'achat, génération
  par les moteurs du référentiel (HeyGen, Veo, Runway, Seedance).
- **Movie Creator** : le plus lourd, le plus loin. À ne lancer qu'après B et C.

### Jalon E — Commerce et flotte
- Panier + Stripe, licences **Ed25519** (§3.9), mises à jour signées et réversibles.
- Budgets et quotas par agent, relevé de consommation (exigé par le prompt maître
  et par les indicateurs investisseurs du BP).
- Catalogue LocalAgent réel, sur devis, à la place des trois relevés indicatifs.

**Ordre : A → B → C, puis D et E en parallèle.** A et B rendent le produit
vendable ; C livre la différenciation du business plan ; D contient les rubriques
les plus spectaculaires, mais un avatar qui ne sait pas publier ne vaut rien
sans B.

Et la data room du §15 du business plan tombe presque d'elle-même : A+B+C
produisent la démonstration reproductible qu'elle exige.

---

## 6. Ce qui reste à décider — par Max, pas par moi

1. **Le nom** : iAgent (domaine acheté) ou e-Agent (documents récents) ? §3.1
2. **Le prix** : la grille à cinq niveaux du business plan V2, ou le 49,90 €/9,90 €
   de V6 ? §3.2
3. **Les 174 fiches hors catalogue** : au catalogue V7, ou retirées ? §3.5
4. **Le cahier des charges investisseur** : le réaligner sur le business plan V2
   (prix, MRR, « risque R&D 0 »), ou le retirer du dossier ? §2 et §3.2

Les quatre autres sujets — Electron, invasion réseau, passerelle mobile,
licence — sont tranchés dans ce document et n'appellent pas d'arbitrage :
la loi, les conditions des plateformes et la cryptographie ne se négocient pas.
