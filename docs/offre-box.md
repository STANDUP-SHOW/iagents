# Offre machines : le prix d'un agent selon la machine choisie

Demande de max du 25/09/2026. Le client choisit d'abord son installation ; c'est elle
qui dit, sur chaque fiche d'agent, ce que l'agent coûte en local contre ce qu'il coûte en
API, et quelle machine conseiller pour son équipe.

Prix, machines et financement viennent du **catalogue matériel de max du 25/09/2026**
(`Catalogue_Materiel_IA_iAgent.xlsx`, copie dans
`/mnt/project-files/recherche/Catalogue_Materiel_IA_iAgent_2026-09-25.xlsx`), onglet
« Offre iAgent » pour les prix, « Hypothèses » pour le financement. Le prix retenu est son
prix de vente HT ; son coût, son prix TTC, sa mensualité et son abonnement sont recopiés à
côté dans `dimensionnement/offre-box.json` pour la boutique.

## Les six installations

Réponses de max du 25/09 à 18h19 : **24 mois**, **toujours séparer les prix**,
l'abonnement de la box **en plus de l'agent**, **58 Go** utilisables sur la Box Max.

| Installation | Lignes de prix (catalogue) | Fait tourner des agents | Prix HT | Mensualité 24 mois | Abonnement |
|---|---|---|---|---|---|
| Sans machine | — | non | 0 € | — | — |
| Box Commandeur | S1 Minisforum MS-01, i9-12900H, 32 Go | **non** | 1 586,25 € | 71,02 € | 49 € |
| Box Max | M1 GMKtec EVO-X2, Ryzen AI Max+ 395, 64 Go unifiés | oui | 2 828,11 € | 126,62 € | 129 € |
| Power N1 | B2 MS-02 Ultra + RTX PRO 4000 SFF 24 Go | oui | 5 983 € | 267,87 € | 199 € |
| | + Box Commandeur livrée avec | | 1 586,25 € | 71,02 € | 49 € |
| Power N2 | N2a MSI EdgeXpert GB10, 128 Go unifiés | oui | 7 196,08 € | 322,19 € | 299 € |
| | + Box Commandeur livrée avec | | 1 586,25 € | 71,02 € | 49 € |
| Power N3 | B4 Ryzen 9 9950X + RTX PRO 6000 Max-Q 96 Go | oui | 19 618,54 € | 878,37 € | 499 € |
| | + Box Commandeur livrée avec | | 1 586,25 € | 71,02 € | 49 € |

`coutInstallation(offre).lignes` rend une ligne par box, chacune avec son prix, sa
mensualité et son abonnement : la boutique affiche les lignes, jamais un total fondu.
Les totaux servent seulement à la comparaison avec l'API. Le prix des agents (9,90 €/mois
chacun) s'ajoute par-dessus et ne change pas la comparaison : il est le même sur toutes
les installations.

Financement : **24 mois** (max). Le catalogue ne donne un taux que pour 36 mois (7 %) ;
7 % est repris pour 24 mois, marqué `aConfirmer` jusqu'au taux de l'organisme retenu. Le
banc retrouve au centime, à 36 mois, les sept mensualités de la colonne « Leasing HT/mois »
du catalogue ; ce n'est **pas** la mensualité affichée.

Deux lignes du catalogue n'entrent dans aucune des six installations et ne servent pas au
calcul (`autresLignesDuCatalogue`) : la BOX Ryzen AI 9 64 Go (A2, 1 946,96 € HT) et la Box
Max 128 Go PRO (M7, 5 198,83 € HT).

La machine de chaque offre est décrite dans `offre-box.json` et **ne rejoint pas
`machines.json`** : y ajouter ces machines change le placement de tout le relevé, donc
`docs/economie.md` et la règle des 3× (essayé : l'assistant juridique AG-0021 passait d'un
bundle XL partagé à 15 agents à une Box Max partagée à 2). Remplacer le relevé par le
catalogue de max est une décision à part.

Capacité de calcul = bande passante mémoire / 504 Go/s, comme dans le relevé : Box Max
256 Go/s (catalogue), Power N3 1,8 To/s (catalogue) ; Power N1 432 Go/s et Power N2
273 Go/s viennent des fiches de NVIDIA, le catalogue ne les donne pas.

## Ce que le calcul rend

- **Sur la fiche d'un agent** (`devisParBox`) : une ligne par installation. L'agent
  tient-il en local dessus ; ce qu'il se paie en jetons chaque mois (la part API choisie
  à l'entretien s'il tourne en local, tout sinon) ; son prix en API seule ; la mensualité
  et l'électricité de la machine ; et si **cet agent seul** rembourse la machine.
- **Pour une équipe** (`devisPack`) : les agents se placent sur la machine par économie
  décroissante tant qu'elle les tient ; les autres restent en API, et le devis le dit agent
  par agent. Total par mois pendant le financement, total une fois la machine payée,
  facture de la même équipe tout par API, et nombre de mois pour que les économies paient
  la machine.
- **Le conseil** (`conseillerBox`) : l'installation la moins chère sur deux fois la durée
  du financement (24 mois de mensualités, 24 après, abonnements compris). « Sans machine » est une réponse
  possible, et c'est la bonne pour une équipe peu sollicitée (décision de max du 24/09).
  La Box Commandeur seule n'est jamais la moins chère : elle n'ajoute que du coût, c'est un
  confort de travail.

Exemples aux prix du catalogue, sur 24 mois, abonnement compris : la secrétaire
administrative (AG-0001) coûte 287,92 €/mois en API seule ; sur la Box Max, 57,58 € de
jetons, mais la box coûte 126,62 € de mensualité, 129 € d'abonnement et 23,40 €
d'électricité. **Seule, elle ne rembourse donc plus la Box Max** (elle la remboursait
avant l'abonnement). Trois agents pris au hasard : Box Max conseillée, 446 €/mois contre
526 € en API. Dix : Box Max, 1 016 € contre 1 343 €. Les cinq agents les plus sollicités :
2 020 €/mois sur la Power N1 contre 6 920 € tout par API.

`dimensionnement/check-offre-box.ts` (dans `npm run controle`) tient ces règles : aucun
agent ne tourne sans machine ni sur la Box Commandeur, un prix confirmé porte sa source
et sa date, les machines de puissance montent en capacité de l'une à l'autre, un
placement ne dépasse jamais la machine, une équipe peu sollicitée n'est conseillée sur
aucune machine.

## Trouvé en construisant

**Les machines de puissance ne forment pas une échelle.** Nombre de fiches qu'une machine
tient seule : Box Max 1 049, Power N1 1 052, Power N2 1 195, Power N3 1 249 (toutes).
Mais 23 fiches tiennent sur la Box Max et pas sur la Power N1 (ex. AG-0035) : 58 Go de
mémoire unifiée contre 24 Go sur la carte. Et 24 fiches tiennent sur la Power N1 et pas
sur la Power N2 (ex. AG-0276) : le GB10 a 128 Go mais une bande passante proche de celle
de la Box Max, trop lente pour les agents les plus sollicités. Le banc vérifie seulement
que la Power N3 tient tout ce que tiennent les autres, et affiche les deux écarts en
« attention ».

**La Box Max : 58 Go utilisables par l'IA** (max, 25/09 18h19), comme le dit la règle du
dépôt (RAM moins `reserveMemoireUnifiee`), et non les 48 Go de la colonne « Mémoire IA »
du catalogue.

**L'abonnement pèse plus que la machine sur la décision.** Pendant les 24 mois, la Box
Max coûte 279 €/mois tout compris (mensualité, abonnement, électricité), dont 129 €
d'abonnement qui continuent après. Un agent seul ne la rembourse plus ; il faut une
petite équipe.

## Ce que la boutique doit changer (pour le fil « Charte néon et tableau de bord »)

1. La section iAgent Box passe de cinq gammes (S à Flotte) à **six installations** :
   Sans machine, Box Commandeur, Box Max, machines de puissance 1, 2 et 3. Chaque
   machine de puissance s'affiche **avec** sa Box Commandeur et le prix des deux.
2. Chaque box est une ligne à part (`coutInstallation(offre).lignes`) : prix HT,
   mensualité sur 24 mois et abonnement mensuel. Une Power montre deux lignes, la sienne
   et celle de la Box Commandeur livrée avec. Jamais un total fondu. « Taux à confirmer »
   à côté de la mensualité tant que `mensualiteAConfirmer` est vrai.
3. Le choix de l'installation vient **avant** le catalogue d'agents et se garde pendant
   la navigation.
4. Sur la fiche détaillée d'un agent, un tableau lu dans `devisParBox(fiche)` : une
   ligne par installation, avec « en local » ou « par API », le coût mensuel de l'agent,
   son prix en API seule, l'économie, et le motif en clair. Rien ne se recalcule dans
   `frontend/` : la boutique lit `dimensionnement/`, comme pour `economiePour`.
5. Un panier d'agents affiche `conseillerBox(fiches)` : l'installation conseillée pour
   cette équipe, son total mensuel pendant et après le financement, et le total tout par
   API en face.

## Carte graphique : ce que le moteur local accélère vraiment

Relu le 25/09/2026 dans la page « Hardware support » d'Ollama
(`github.com/ollama/ollama`, `docs/gpu.mdx`, branche `main`). Rien de ceci n'a été
essayé sur une machine.

- **NVIDIA** : il faut seulement le pilote (version 550 ou plus récente) ; la page ne
  demande aucune installation de CUDA à part. Les RTX PRO Blackwell des Power N1 et N3 sont de
  cette famille ; le GB10 de la Power N2 tourne sous DGX OS, le système de NVIDIA.
- **AMD par ROCm** : sous Linux, les Radeon RX 6800 à 9070, et parmi les puces à
  graphique intégré **seulement les Ryzen AI 9 HX 370/375, Ryzen AI 9 365 et 465, et
  Ryzen AI Max 385/390/395**. **Sous Windows, aucune puce à graphique intégré**, seulement des
  Radeon RX 7600 à 7900 XTX et des Radeon PRO W7000.
- **Le Radeon 780M** (Ryzen 7 H255, Ryzen 9 8945HS)
  **n'est dans aucune des deux listes ROCm**. Il ne peut passer que par Vulkan, qu'Ollama
  décrit comme un soutien supplémentaire activé par défaut, sans dire à quelle vitesse.
  S'il n'est pas pris, le modèle tourne sur le processeur, beaucoup plus lentement que
  ce que suppose `capaciteGpu: 0.2`.

Le catalogue de max a retenu un Ryzen AI Max+ 395 pour la Box Max, qui est dans la liste
ROCm sous Linux. Conséquence pour les spécifications : pour que l'accélération graphique d'une Box Max
soit documentée, il faut un Ryzen AI 9 (HX 370, par exemple) ou un Ryzen AI Max+ 395,
qui monte à 128 Go de mémoire unifiée, sous Linux ; un Ryzen 9 à Radeon 780M ne l'est pas. Mais la Box Max porte aussi l'application desktop, qui est une
application Windows, et sous Windows ce graphique intégré ne passe que par Vulkan. Les
machines de puissance n'ont pas à être NVIDIA, mais NVIDIA est le cas le mieux
couvert, sous Windows comme sous Linux.
