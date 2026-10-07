# Box e-Agent : la box louée qui porte les agents

Décision de max du 07/10/2026 (carte du chat du projet, 18h42 : « Louer la box »), sur
son message du même jour à 18h33. Elle recadre `docs/offre-box.md` sans l'effacer : le
calcul des six installations reste dans le dépôt tant que max n'a pas dit ce que
deviennent la Box Max et les Power.

## Ce qui est décidé

- **Une box e-Agent pour tous les agents**, sur le modèle d'un fournisseur d'accès
  (Freebox) : un mini-PC de commande préparé en usine, qui porte le Desktop Commander,
  la voix, le navigateur et les applications des agents.
- Équipement : écran **tactile** (toutes les commandes sont pensées pour le doigt),
  micro, enceintes, pavé numérique, clavier et souris d'intervention. Reliée au réseau
  de l'entreprise, équipée pour le téléphone et la voix.
- **20 agents au plus par box** ; au-delà, une box de plus.
- Les agents tournent **surtout par API** ; le Commandeur est sur la box.
- **La box est louée, jamais vendue ni donnée.** Elle reste propriété d'iAgent, pour la
  maintenance et pour que personne n'y installe ses propres agents.
- **Prix toujours séparés** (règle du 25/09, inchangée) : loyer de la box, abonnement de
  chaque agent (149, 249 ou 399 €/mois), consommation d'IA.

## Prix : le plan du site de max fait foi

Le plan du site envoyé par max le 07/10 à 19h13 (`iAgent_Plan_Site_Developpeur.docx`)
répond aux questions que ce fil lui avait posées, et ses chiffres remplacent ceux que le
fil proposait (49 €/mois, 24 mois). Il les donne comme « base de travail », dans une
configuration tarifaire administrable :

| Ligne | Plan du 07/10 |
|---|---|
| Box Commander (louée, « 0 € d'achat matériel ») | 69 €/mois sur 36 mois, ou 89 €/mois sur 24 mois |
| Consommation (API, voix, téléphonie, services tiers) | au réel ou par crédits, à part de la location des agents |
| Box Max, Power, multibox | retirées de l'affichage public, gardées archivées ; forte puissance locale « sur devis » |
| Agent Essential / Professional / Expert | 149 / 249 / 399 €/mois |
| Task Commander | 249-349 €/mois, ou inclus à partir de 5 agents |

**Prix d'un agent tranché le 07/10 à 20h22** : max a choisi les prix du plan (carte du fil
« Site iagent.agency ») — 149, 249 ou 399 €/mois selon le niveau. Ils remplacent les
9,90 €/mois et 49,90 € à l'achat du 22/09. Le Task Commander n'existait nulle part avant ce
plan.

Consommation « au réel ou par crédits » veut dire que la clé d'IA est fournie et
refacturée par iAgent, ce qui est aussi le verrou le plus fort.

**Clé incluse = une règle durable change.** Aujourd'hui la clé d'API est celle du client
et ne quitte jamais sa machine (`llm::cle_api()`, trousseau). Une clé iAgent demande un
relais qui compte la consommation par box et la refacture ; elle ne se pose pas dans le
paquet, sinon elle se recopie avec lui.

## Le document global de max (07/10, 21h53) confirme et précise

`iAgent_MASTER_Developpeur_Global` (copie texte dans
`/mnt/project-files/master/`) reprend les mêmes prix de test et la même location, et
ajoute :

- §4 : la Box reste propriété d'iAgent, avec **restitution, renouvellement ou rachat
  éventuel** en fin de contrat ; elle porte aussi un pavé ou une tablette de signature ;
  Box Business graphite, Box Home claire.
- §6 : système verrouillé (Linux/Ubuntu Core si possible, sinon Windows IoT/Enterprise
  restreint), TPM 2.0, Secure Boot, disque chiffré, identité cryptographique par Box et
  mTLS vers un « Control Plane », un droit d'exécution par client, Box et agent, paquets
  signés et chiffrés, révocation à distance. C'est le plan de verrouillage ci-dessous,
  écrit par max lui-même.
- §12 : la petite Box ne porte pas un gros centre d'appels ; un « Voice Hub » hébergé le
  fera.
- Une gamme Home (49 à 169 € TTC/mois) et une gamme Voice (49 € à sur devis), hors de ce
  fil : le moteur tarifaire versionné est construit par le fil « Plan global jusqu'au
  produit fini ».

**Starter : 218 € HT/mois** (décision de max du 07/10 à 22h56). Le MASTER annonçait « à
partir de 219 € » ; le prix d'une formule se calcule désormais à partir de ses composants,
ici un agent Essential (149 €) et la Box sur 36 mois (69 €).

## Verrouiller : ce que fait la PR #41, ce que le MASTER demande encore

Le centre de contrôle est construit par le fil « Plan global jusqu'au produit fini »
(PR #41, branche `plan-global`, en brouillon au 07/10). Ce document reste la référence de
l'offre louée ; ce qui suit sépare ce que le code fait aujourd'hui de ce que le MASTER §6
exige et qui n'est pas fait. **Les exigences du §6 restent toutes dues.**

### Ce que la PR #41 fait (relevé du 07/10, 22h49)

| Verrou | Ce que fait #41 |
|---|---|
| Identité de la box | une clé Ed25519 par box, gardée au trousseau du système, qui signe chaque requête au centre de contrôle |
| Droit d'exécution | **un seul jeton par box**, qui liste tous ses agents avec la date de fin de chacun |
| Durée du jeton | **24 h**, sans grâce hors ligne au-delà |
| Révocation | prend effet au prochain renouvellement, donc au plus 24 h après |
| Box impayée | coupée par le statut « suspendue » |
| Skill Packs | une empreinte SHA-256, sans signature |
| Fiches d'agent | **ni signées ni chiffrées** : `fiches::lire_fiche` lit toujours ce qu'il trouve |

### Ce que le MASTER §6 demande et qui reste à faire

| Exigence | État |
|---|---|
| **Fiches signées** (l'application refuse une fiche qu'iAgent n'a pas signée) | à faire ; c'était le premier verrou proposé ici, parce qu'il est le seul à empêcher « ses propres agents » sur nos box, et il ne dépend de rien |
| Paquets chiffrés pour une box donnée | à faire |
| Skill Packs signés, et pas seulement hachés (une empreinte se recalcule, une signature non) | à faire |
| mTLS vers le centre de contrôle | à faire ; la signature Ed25519 des requêtes en tient lieu pour l'instant |
| TPM 2.0 (clé de la box liée à la puce, pas au trousseau, qui se recopie avec le disque) | à faire |
| Secure Boot, disque chiffré, système verrouillé | à faire en usine (`usine/`, PR #24, installe et ne verrouille rien) |
| Contrat : propriété, dépôt, restitution, interdiction d'extraire | à rédiger |

Pour la signature des fiches, le mécanisme existe déjà pour les mises à jour
(`mise_a_jour.rs` vérifie une signature avant d'installer un octet) : la même approche,
une clé publique dans le binaire et la clé privée hors du dépôt.

### Avis de ce fil sur les choix de #41

- **Un jeton de 24 h sans grâce arrête toute la flotte si notre serveur tombe un jour.**
  Le risque n'est pas la coupure Internet du client (ses agents passent surtout par
  l'API, ils s'arrêtent de toute façon), c'est la panne du centre de contrôle : au bout
  de 24 h, toutes les box louées s'arrêtent ensemble. Proposition : distinguer « le
  serveur ne répond pas » (le dernier jeton reste valable quelques jours, par exemple
  72 h) de « le serveur répond que la box est suspendue ou l'agent révoqué » (effet
  immédiat). La révocation garde alors son délai de 24 h quand le serveur répond.
- Un jeton par box listant les agents : bon choix, une seule requête par jour.
- Box suspendue par statut : bon choix.

## Ce qu'on ne peut pas verrouiller

- Ce que l'agent dit part chez le fournisseur d'IA : ses consignes ne sont pas un secret
  absolu.
- Une autre IA peut écrire une fiche ressemblante. La protection, c'est la box préparée,
  les branchements aux logiciels du client, la maintenance, les mises à jour et le
  catalogue qui grandit — pas le secret du texte.

## Matériel à revoir

- **Le MS-01 de la Box Commandeur n'a ni écran tactile, ni micro, ni enceintes.** Il faut
  un autre modèle, ou ces pièces chiffrées en plus, pour tenir le loyer de 69 €.
- **Le téléphone n'existe pas dans l'application** : aucun code n'appelle ni ne décroche
  (besoin `telephone` de 210 fiches, non servi). L'équipement n'y suffit pas.

## Robots d'IA et site

Avis seulement ; le site appartient au fil « Site iagent.agency ». Bloquer dans
`robots.txt` les robots d'entraînement (GPTBot, ClaudeBot, CCBot, Google-Extended) ne
coûte rien au référencement Google ; bloquer les robots de moteurs de réponse
(PerplexityBot, OAI-SearchBot) coûte de la visibilité. Rien n'oblige un robot à respecter
`robots.txt` : la vraie règle est que le site montre une vitrine (métier, missions, prix)
et jamais les consignes complètes d'un agent.
