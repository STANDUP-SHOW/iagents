# Admin, Control Plane, Team (documents de max, octobre 2026) : ce que ça change

Deux documents remis par max le 14/10/2026, recopiés ici en texte :

- `ADMIN-MASTER-1.0-2026-10.txt` : « iAgent ADMIN • CONTROL PLANE • TEAM, Master
  architecture & developer specification », version 1.0 ;
- `ADMIN-MASTER-1.1-2026-10.txt` : « iAgent MASTER ARCHITECTURE, Admin • Control
  Plane • Fleet • Platform • Team • Factory • Infrastructure », version 1.1.

La 1.1 reprend la 1.0 et ajoute l'infrastructure (paliers 50 / 200 / 500 / 1 000
entreprises, charge, atelier). Les deux disent la même chose sur la Box ; quand
elles diffèrent, la 1.1 est citée.

Principe des deux documents : **un seul iAgent Core, trois consoles** (Fleet
Commander pour la flotte et l'usine, Platform Commander pour les clients, les
agents et la facturation, iAgent Team pour les équipes d'agents internes) plus
iAgent Master (lanceur SSO). Toute action, humaine ou d'agent, passe par les
mêmes API, politiques, audits et workflows. Instruction finale au développeur :
construire d'abord les contrats de données, l'identité des acteurs, le bus
d'événements, le moteur de politiques, l'Action Gateway, les automates d'état et
le Control Plane ; les consoles viennent ensuite. Et : « Ne pas coder Fleet UI
avant enrollment + heartbeat + desired state + command protocol ».

Ce fichier dit ce que le dépôt suit déjà, où il contredit ces documents, et ce
que la Box (Factory Installer, fusionné dans `main` par les PR #72 et #75) doit changer pour s'y raccorder.

## 1. Déjà conforme

| Exigence des documents | Dans le dépôt |
|---|---|
| Desktop Tauri + React + TypeScript ; backend Node + TypeScript ; cœur de la Box en Rust ; tests d'usine Python/Bash ; navigateur Playwright + TypeScript | décision de max du 11/10/2026 (`docs/box-usine.md` §2), même découpage |
| Usine : Ubuntu Autoinstall + Python/Bash + amorce Rust | `box/usine/autoinstall/`, `box/usine/tests/`, `box/services/` |
| Étapes d'usine Preflight, Install, Identity, Runtime, Qualify, Burn-in, Enroll, Label, Ready | toutes présentes sauf Receive (§3 G) ; rapport par Box, QR, référence |
| Temps humain < 5 min par Box ; rodage 24 h production, 72 h qualification | KPI de `docs/box-usine.md` §1 ; `box/usine/rodage/rodage.sh` |
| Box business 64 Go, profil `bosgame-m4-neo` | `box/materiel/bosgame-m4-neo.json` (décision du 11/10) |
| Box Home : micro et enceintes obligatoires | `exr1.json` : `audio.micro: true`, test `audio` obligatoire |
| La Box n'ouvre aucun port entrant, connexion sortante seulement | `box/os/durcissement/nftables.conf` |
| Artefacts et Skill Packs signés, empreinte + signature | `MiseAJour.signature`, `iagent-updater`, `controle/scellement.ts` |
| Droit d'exécution signé, séparé de la facture | jeton de licence v2 (`plateforme/controle`) |
| TPM + disque chiffré | LUKS2 + TPM2 PCR 7 (`box/securite/luks-tpm.md`), **non constaté** |
| Audit sans secret, isolation par tenant | `controle/audit.ts` refuse ce qui ressemble à un secret ; `Stockage.pourTenant()` |
| Remplacement RMA = nouvelle identité cryptographique | `box/securite/rma.md` |
| Profils matériels homologués avec tests d'usine | `box/materiel/*.json` + `tests_obligatoires` |

## 2. Contradictions à trancher par max

1. **Hébergement et socle serveur.** Les documents posent PostgreSQL, NATS,
   Redis, stockage S3, OpenTelemetry, OpenAPI 3.1, Terraform, des services sans
   état qui montent en largeur, une région EU, et des tests à 10 000 Box simulées
   (200 battements/s, reconnexion de 5 000 Box d'un coup). Le dépôt tourne sur
   **un Worker Cloudflare et un seul Durable Object** (choix de max du
   08/10/2026) : toutes les requêtes de toutes les Box passent par une seule
   instance, et `plateforme/stockage.ts` garde toutes les collections en mémoire.
   C'est l'inverse de « stateless, horizontal scale ». Le stockage est derrière
   une interface (`Support`) : un support PostgreSQL est un ajout, pas une
   réécriture des modules. **Recommandation** : ne pas choisir sur opinion ;
   écrire d'abord le simulateur de Box (DEV-005/006 des documents) et mesurer le
   Worker actuel contre les paliers 50 / 200 / 1 000 Box ; décider sur la mesure.
2. **Le mot de passe admin partagé.** Les documents l'interdisent en toutes
   lettres (« Un mot de passe admin partagé » est un anti-pattern) et demandent
   SSO + MFA pour les humains, une identité de charge pour les agents et les
   services. Le back-office entre aujourd'hui avec `PLATEFORME_ADMIN_SECRET`,
   un secret unique. Il faut un fournisseur d'identité (OIDC) : choix de max.
   Sur la Box, l'`operateur` du jeton d'usine (texte libre) deviendra un acteur.
3. **La mémoire de la Box Home.** Les deux documents disent « 16 ou 32 GB » ;
   max a tranché 32 Go le 11/10/2026. Le dépôt garde 32 Go tant que max ne dit
   pas autre chose.
4. **« Commander ».** Les documents appellent la Box business « Commander Box »
   et son profil « Commander Standard », et nomment Fleet Commander, Platform
   Commander, Task Commander, Sales Commander. Max a dit le 11/10 que Commander
   est le nom de l'application, pas une gamme. Le code garde
   `gamme: 'business' | 'home'` ; reste à max le nom affiché de la Box business.
5. **Le cycle de vie physique de la Box.** Voir §3 F : les documents ont des
   états que le dépôt n'a pas (reçue, maintenance, RMA, reconditionnement,
   retirée) et mêlent à l'enum deux états de santé (DEGRADED, OFFLINE).
6. **Les API.** Les documents écrivent `/v1/devices/{id}/commands` en anglais,
   versionné, avec `Idempotency-Key` et `Correlation-ID` ; le dépôt écrit
   `/controle/...` en français, sans version. **Recommandation** : versionner au
   moins le protocole Box ↔ plateforme maintenant, parce que ce sont les Box
   livrées qui le figent ; garder la langue du dépôt sauf avis contraire de max.
7. **Une console ou trois.** Le dépôt a un back-office (Tauri) qui mêle Boxes,
   Usine, Licences, Plans, Skills, Voix. **Recommandation** : regrouper ses
   écrans en trois espaces (Fleet, Platform, Team) sur le même client d'API ;
   les séparer en applications quand les acteurs et les rôles existent.
8. **Identité de la Box.** Les documents parlent de CSR, certificat device lié au
   TPM et mTLS. Le dépôt signe chaque requête en Ed25519, ce qui marche sur
   Cloudflare et est déjà éprouvé. **Recommandation** : garder la signature
   Ed25519 et ajouter le certificat et le mTLS quand l'hébergement est choisi ;
   la clé naît dans le TPM dans les deux cas.
9. **Disposition du dépôt.** Les documents proposent `apps/ services/ packages/
   device/ factory/ infra/`. Ne pas déplacer le dépôt maintenant : la
   correspondance est `box/services/` → `device/`, `box/usine/` → `factory/`,
   `plateforme/` → `services/`, `back-office/` → `apps/`.

## 2 bis. Décisions de max du 14/10/2026 (réponse à ce fichier)

- **Hébergement** : décider sur une mesure, avec le simulateur de Box, pas sur
  une opinion (§2.1, recommandation retenue).
- **Connexion des administrateurs** : Cloudflare ou Google, choix laissé au
  développeur. **Retenu : Cloudflare Access, avec Google comme fournisseur
  d'identité.** La plateforme tourne déjà chez Cloudflare ; Access arrête toute
  requête non authentifiée avant le Worker ; le Worker vérifie le jeton signé
  d'Access (`Cf-Access-Jwt-Assertion`) et prend l'adresse de l'administrateur
  comme acteur de l'audit, ce qui met fin au secret partagé. Les routes `box`
  (signées par la Box) et `public` restent hors d'Access. À poser par max chez
  Cloudflare : l'équipe Zero Trust, Google comme méthode de connexion, la liste
  des adresses admises ; la double authentification est celle du compte Google
  de chaque administrateur, à activer. Rien de ceci n'est codé.
- **Gammes et noms** : Home Box 16 Go, Pro Box 32 Go, Business Box 64 Go
  (§2.3 et §2.4 tranchés) ; Pro Box = BOSGAME M4 Neo en 32 Go, 4 agents ;
  références `IA-FR-HOME-…`, `IA-FR-PRO-…`, `IA-FR-BUS-…`. Fait dans le code.
- **Applications** : Web App, Desktop Commander (le client sur sa Box), et trois
  Desktop Admin : **Admin Global** (côté iAgent : clients, agents, facturation,
  ce que les documents appellent Platform Commander), **Admin Box** (la flotte et
  l'usine, Fleet Commander), **Admin Utilisateur** (la console du client, qui
  gère ses propres utilisateurs et agents). Séparées quand les rôles existent
  (§2.7 retenu) ; d'ici là, des espaces dans le back-office actuel.
- **Suspendre une Box à distance** : obligatoire. `suspendue` reste un état de
  la Box (§3 F tranché) ; aujourd'hui elle joue au renouvellement de licence
  (24 h au plus), avec l'état voulu (§3 C) elle jouera au battement suivant.
- **Langue des routes** : laissée au développeur. **Retenu** : les adresses
  restent en français (tout le dépôt l'est, `routes.md` est le contrat) ; le
  protocole de la Box porte sa version (en-tête `x-protocole-box: 1`, refus
  clair d'une version inconnue) ; une description OpenAPI 3.1 sera générée depuis
  `routes.md`. À faire avec le Control Plane v1.
- **Par entreprise** (message dicté, compris ainsi, à confirmer) : le nombre de
  Box nécessaires (le `boxes_per_customer` des documents) ; le **mode de
  fonctionnement** : par API (Claude) ou interne et local uniquement ; et des
  **serveurs de puissance** (calcul) qui viennent **toujours en plus** des Box
  de contrôle, jamais seuls — c'est déjà la règle des machines Power de
  `docs/offre-box.md`. Dans le modèle : un mode par client, un type de machine
  (`box` ou `serveur_puissance`) et la règle « pas de serveur de puissance sans
  Box ». Pas encore codé.

## 3. Ce que la Box doit changer (branche `admin-master` et suivantes)

Ordre des documents : le protocole d'abord, l'écran ensuite. Les lettres
marquées **sans décision** peuvent se faire tout de suite.

**A. Enrôlement idempotent — sans décision.** Critère d'acceptation : « 100 %
idempotent, cert unique ». Aujourd'hui une Box qui renvoie son enrôlement (coupure
réseau pendant la réponse) reçoit 409 « numéro de série déjà enregistré » et
reste bloquée. Changement : même numéro de série **et** même clé publique →
200 avec la Box existante, sans nouvelle référence ni utilisation de jeton en
plus ; même numéro avec une autre clé → 409. **Fait le 14/10** (`dejaEnrolee`
dans `plateforme/controle/routes.ts`, cas au banc), à confirmer par la CI.

**B. Battement séparé de la télémétrie — sans décision sur le principe.**
Documents : battement léger toutes les 30 à 60 s avec gigue, métriques détaillées
moins souvent, hors-ligne calculé par le serveur après plusieurs battements
manqués, ingestion des métriques séparée des transactions. Aujourd'hui :
télémétrie toutes les 5 min (`agent-device`, `INTERVALLE_TELEMETRIE`), aucun
calcul de hors-ligne. Proposé : battement 60 s ± 10 s (statut, versions,
`version_etat_reel`), métriques 5 min, hors-ligne après 3 battements manqués.
À mesurer avec le simulateur avant de le promettre sur le Durable Object (§2.1).

**C. État voulu / état réel.** La plateforme tient pour chaque Box un état voulu
versionné (versions par composant, agents et droits, Skills, politiques) ; la Box
renvoie la version qu'elle a atteinte ; `iagent-device` réconcilie. Aujourd'hui
ces choses arrivent par trois canaux séparés (jeton de licence renouvelé toutes
les 24 h, mises à jour relevées, Skill Packs). Le contrat est à écrire
(`box/services/agent-device/CONTRAT.md`) ; une suspension d'agent converge alors
au battement suivant au lieu de 24 h.

**D. Commandes.** File par Box, relevée par la Box (sortant seulement) : id,
clé d'idempotence, durée de vie, liste blanche par profil matériel, résultat
signé par la Box, sortie expurgée, audit des deux côtés. Commencer par les
risques R0-R1 des documents (diagnostic, redémarrer un service, journaux
expurgés). Redémarrer la Box, réinitialiser, écran à distance, shell contrôlé
attendent les acteurs et les approbations (R3-R4, double approbation, JIT).
`docs/box-usine.md` §8 le note déjà : « pas de route de commande ».

**E. Audit — sans décision.** Champs des documents : acteur, type d'acteur
(HUMAN, AGENT, SERVICE, DEVICE), action, ressource, tenant, motif, politique,
approbation, résultat, `correlation_id`. `Audit` n'a que `acteur`, `action`,
`cible`, `detail`. Ajouter `type_acteur`, `resultat`, `correlation_id` maintenant
(la Box envoie l'en-tête, la plateforme le propage) ; `politique` et
`approbation` arrivent avec le moteur de politiques.

**F. Cycle de vie.** Correspondance proposée :

| Documents | Dépôt aujourd'hui | Proposé |
|---|---|---|
| RECEIVED | — | `recue` (import de la liste fournisseur : série, MAC) |
| FACTORY | `usine` | `usine` |
| QUALIFIED | `qualifiee` | `qualifiee` |
| READY | `stock` | `stock` |
| ASSIGNED | `provisionnee` | `provisionnee` |
| SHIPPED | `expediee` | `expediee` |
| ACTIVE | `active` | `active` |
| MAINTENANCE | — | `maintenance` |
| RMA_REQUESTED | — | `rma` |
| RETURNED | `restituee` | `restituee` |
| REFURBISH | — | `reconditionnement` (repasse par `usine` avec une nouvelle identité) |
| RETIRED | `remplacee` (final) | `retiree` |
| DEGRADED, OFFLINE | — | **pas des états du cycle** : `connexion` (`en_ligne`, `degradee`, `hors_ligne`) calculée par le serveur à partir des battements |
| — | `suspendue` | les documents suspendent l'agent, l'abonnement ou le droit, jamais la machine : à trancher (garder `suspendue` ou la faire porter par les droits) |

**G. Usine.** Étape Receive (`recue` + import CSV fournisseur) ; **mode batch
obligatoire** : plusieurs Box en même temps, grille PASS/FAIL par lot dans
l'écran Usine du back-office ; rapport d'usine **signé** comme document (la
requête est signée aujourd'hui, pas le rapport gardé) ; tests de qualification
manquants : navigateur, voix, recovery.

**H. Versions et déploiements.** Canaux DEV → INTERNAL → PILOT → CANARY → STABLE
(le dépôt a `stable | beta`) ; entité Rollout : cible en %, par région, par
profil matériel, liste blanche ; pré-contrôle (espace, sauvegarde,
compatibilité), post-contrôle (battement, services, interface, navigateur, voix),
retour arrière automatique sous un seuil de santé, coupe-circuit par version.
`iagent-updater` sait revenir en arrière sur une Box ; il doit rapporter son
post-contrôle pour que la plateforme arrête une vague.

**I. Profils matériels versionnés — sans décision.** Les documents nomment
`bosgame-m4-neo-v1` et `exr1-home-v1` : un profil change quand la nomenclature
change, et une Box doit rester liée au profil contre lequel elle a été qualifiée.
Renommer maintenant ne coûte rien (aucune Box enrôlée). **Fait le 14/10** :
`box/materiel/bosgame-m4-neo-v1.json`, `exr1-home-v1.json` (`vm-qemu` reste tel
quel, ce n'est pas une machine homologuée).

**J. Type et région du device.** Les documents ont des Box Commander/Home, des App
Nodes (Windows/macOS) et des nœuds GPU, et une région. Ajouter `region` coûte
peu ; le type attend le premier App Node.

## 4. Hors Box, pour mémoire

Acteurs et RBAC/ABAC, niveaux d'autonomie 0-5, Action Gateway et classes de
risque R0-R4, approbations à deux personnes, bus d'événements et workflows,
Work Queue d'iAgent Team, Customer 360, automates Agent / Abonnement / Paiement
(ACTIVE → PAYMENT_FAILED → GRACE → RESTRICTED → SUSPENDED → TERMINATED),
registre des connecteurs, voix et téléphonie, Operations Center. Le dépôt a des
morceaux (`Entitlement.statut`, `SkillPack.validation_status`, `plateforme/voix`,
`plateforme/tarifs`) dont les états ne sont pas ceux des documents ; à aligner
lot par lot, pas en une fois.

Note de vocabulaire : la grâce de 72 h de la licence (plateforme injoignable) n'est
pas la grâce de paiement des documents (impayé avant suspension) ; ce sont deux
mécanismes.

## 5. Ordre proposé

1. Rendre `main` vert : seul « Données, fiches et boutique » y était rouge, par une course dans `plateforme/voix/banc-pont.ts` (corrigée sur `admin-master`).
2. Sur `admin-master` : A (enrôlement idempotent) et I (profils `-v1`) faits ; E (champs d'audit et `correlation_id`) ensuite.
3. Branche suivante, « Control Plane v1 » (lot 1 des documents) : B battement,
   C état voulu / réel, D commandes R0-R1, simulateur de Box et mesure du Worker.
4. Avec les choix de max : fournisseur d'identité et acteurs (fin du secret
   partagé), cycle de vie F, hébergement, puis trois espaces dans le back-office.

Décisions attendues de max : hébergement (§2.1), fournisseur SSO/MFA (§2.2),
mémoire Home (§2.3), nom affiché de la Box business (§2.4), cycle de vie et
sort de `suspendue` (§3 F), langue et version des routes (§2.6), moment de la
séparation des consoles (§2.7).
