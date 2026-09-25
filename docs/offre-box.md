# Offre machines : le prix d'un agent selon la machine choisie

Demande de max du 25/09/2026. Le client choisit d'abord son installation ; c'est elle
qui dit, sur chaque fiche d'agent, ce que l'agent coûte en local contre ce qu'il coûte en
API, et quelle machine conseiller pour son équipe.

**Tous les prix, toutes les spécifications et le taux de financement sont provisoires**
(`aConfirmer: true` dans `dimensionnement/offre-box.json`). max n'a donné que le
processeur de la Box Max (Ryzen 9). Le prix provisoire d'une machine est le prix
indicatif de la machine du relevé dont elle emprunte la capacité : un coût d'achat, pas
un prix de vente.

## Les six installations

| Installation | Rôle | Fait tourner des agents | Capacité empruntée à (provisoire) | Prix provisoire |
|---|---|---|---|---|
| Sans machine | tout par API | non | — | 0 € |
| Box Commandeur | poste de commande, rallonge du bureau | **non** | — | 268 € |
| Box Max (Ryzen 9) | commande + première puissance | oui | mini-PC 64 Go, Radeon 780M | 491 € |
| Machine de puissance 1 | puissance, livrée avec une Box Commandeur | oui | RTX 5070 Ti 16 Go | 1 900 € + 268 € |
| Machine de puissance 2 | puissance, livrée avec une Box Commandeur | oui | RTX 5090 32 Go | 3 800 € + 268 € |
| Machine de puissance 3 | puissance, livrée avec une Box Commandeur | oui | RTX PRO 6000 96 Go | 26 000 € + 268 € |

Financement : 24 mois, taux provisoire 0 % (mensualité = prix / 24).

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
- **Le conseil** (`conseillerBox`) : l'installation la moins chère sur 48 mois (24 de
  mensualités, 24 après). « Sans machine » est une réponse possible, et c'est la bonne
  pour une équipe peu sollicitée (décision de max du 24/09). La Box Commandeur seule
  n'est jamais la moins chère : elle n'ajoute que du coût, c'est un confort de travail.

Exemple, avec les prix provisoires : la secrétaire administrative (AG-0001) coûte
287,92 €/mois en API seule et 57,58 €/mois de jetons sur la Box Max, dont la mensualité
provisoire est de 20,46 €. Cinq agents très sollicités : 6 920 €/mois tout par API contre
1 524 €/mois sur la machine de puissance 1.

`dimensionnement/check-offre-box.ts` (dans `npm run controle`) tient ces règles : aucun
agent ne tourne sans machine ni sur la Box Commandeur, un prix confirmé porte sa source
et sa date, les machines de puissance montent en capacité de l'une à l'autre, un
placement ne dépasse jamais la machine, une équipe peu sollicitée n'est conseillée sur
aucune machine.

## Trouvé en construisant

**Une carte graphique de 16 Go tient moins d'agents d'analyse que la Box Max à 64 Go.**
26 fiches (ex. AG-0018, AG-0042, AG-0066) demandent 19 Go de mémoire pour leurs
modèles : elles tiennent sur un mini-PC à 64 Go de mémoire unifiée et pas sur une RTX
5070 Ti de 16 Go, pourtant 8 fois plus rapide. Si la machine de puissance 1 a moins de
24 Go de mémoire graphique, un client qui monte de la Box Max à la puissance 1 perd ces
agents en local. Le banc le signale en « attention » tant que les spécifications sont
provisoires.

## Ce que la boutique doit changer (pour le fil « Charte néon et tableau de bord »)

1. La section iAgent Box passe de cinq gammes (S à Flotte) à **six installations** :
   Sans machine, Box Commandeur, Box Max, machines de puissance 1, 2 et 3. Chaque
   machine de puissance s'affiche **avec** sa Box Commandeur et le prix des deux.
2. Chaque machine affiche son prix d'achat **et** sa mensualité sur 24 mois
   (`coutInstallation(offre).mensualite`), avec la mention « prix provisoire » tant que
   `aConfirmer` est vrai.
3. Le choix de l'installation vient **avant** le catalogue d'agents et se garde pendant
   la navigation.
4. Sur la fiche détaillée d'un agent, un tableau lu dans `devisParBox(fiche)` : une
   ligne par installation, avec « en local » ou « par API », le coût mensuel de l'agent,
   son prix en API seule, l'économie, et le motif en clair. Rien ne se recalcule dans
   `frontend/` : la boutique lit `dimensionnement/`, comme pour `economiePour`.
5. Un panier d'agents affiche `conseillerBox(fiches)` : l'installation conseillée pour
   cette équipe, son total mensuel pendant et après le financement, et le total tout par
   API en face.
