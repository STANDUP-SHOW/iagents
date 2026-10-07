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
  chaque agent (prix en débat, voir plus bas), consommation d'IA.

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

**Écart à trancher par max** : le prix d'un agent. Sa décision du 22/09 est 9,90 €/mois
(49,90 € à l'achat) ; le plan dit 149 à 399 €/mois. Les deux ne peuvent pas être affichés.
Le Task Commander n'existait nulle part avant ce plan.

Consommation « au réel ou par crédits » veut dire que la clé d'IA est fournie et
refacturée par iAgent, ce qui est aussi le verrou le plus fort.

**Clé incluse = une règle durable change.** Aujourd'hui la clé d'API est celle du client
et ne quitte jamais sa machine (`llm::cle_api()`, trousseau). Une clé iAgent demande un
relais qui compte la consommation par box et la refacture ; elle ne se pose pas dans le
paquet, sinon elle se recopie avec lui.

## Verrouiller : ce qui existe, ce qui reste à construire

Aucun moyen ne suffit seul ; ensemble, ils rendent la copie plus chère que la location.

| Verrou | État au 07/10 | Dépend d'une réponse de max ? |
|---|---|---|
| Contrat : propriété, dépôt, restitution, interdiction d'extraire | à rédiger | non |
| Machine fermée en usine : compte sans droits d'administration, mode kiosque, BitLocker avec TPM, BIOS sous mot de passe, démarrage sécurisé, pas de démarrage USB | `usine/` (PR #24) installe, ne verrouille rien | non |
| **Agents signés** : l'application refuse une fiche que iAgent n'a pas signée | **n'existe pas** : `tauri.conf.json` livre `agents/` et `socle/` en clair et `fiches::lire_fiche` lit ce qu'il trouve | non |
| Agents chiffrés pour une box donnée (clé liée au TPM) | n'existe pas | non |
| Licence courte par agent, renouvelée en ligne, avec quelques jours de grâce hors ligne | n'existe pas ; demande un service hébergé | non (durée et loyer donnés par le plan) |
| Gestion à distance : inventaire, coupure d'une box impayée | mises à jour automatiques en place (`mise_a_jour.rs`), RustDesk en option dans `usine/` | non |

**Ordre de construction proposé :** la signature des fiches d'abord, parce qu'elle seule
empêche « ses propres agents » sur nos box et qu'elle ne dépend de rien. Le mécanisme
existe déjà pour les mises à jour (`mise_a_jour.rs` vérifie une signature avant
d'installer un octet) : la même clé publique, embarquée dans le binaire, vérifie chaque
fiche. La clé privée reste chez max ou dans un secret de l'intégration continue, jamais
dans le dépôt. Puis le chiffrement par box, puis la licence, qui demande un hébergement.

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
