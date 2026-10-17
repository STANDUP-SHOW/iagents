# Le noyau de l'admin iAgent

Source : les deux documents de max du 14/10/2026, rangés dans
`/mnt/project-files/admin-plateforme/` (`iAgent_ADMIN_MASTER_Architecture_Developpeur.docx`
et `iAgent_MASTER_Admin_ControlPlane_Team_Infrastructure.docx`). Leur ordre
critique est tenu : **pas d'écran Team avant les acteurs, les permissions et la
passerelle d'actions ; pas d'écran Fleet avant l'enrôlement, le battement,
l'état voulu et le protocole de commandes.** Ce lot-ci est ce socle ; les
consoles viennent ensuite dans l'application admin (`back-office/`).

Code : `plateforme/noyau/`, servi par les deux portes (Node et Cloudflare) sous
`/v1`. Routes : `docs/master/routes.md`. Banc : `npm run controle-noyau` (dans
`npm run controle`) ; charge : `npm run charge-noyau` (10 000 Box simulées).

## Ce qui est fait

| Document | Où |
|---|---|
| Acteurs humain / agent / service / Box, clés personnelles, sessions, second facteur | `acteurs.ts` |
| Rôles, permissions, périmètres (global, client, Box, agent, département) | `permissions.ts` |
| Moteur de règles : risque R0 à R4, autonomie 0 à 5, budgets | `politique.ts` |
| Passerelle d'actions, idempotence, approbations, règle des deux personnes, expiration | `passerelle.ts` |
| Bus d'événements, consommateurs idempotents, lettres mortes, incidents | `evenements.ts` |
| Cycle de vie d'un agent, état voulu / état réel, battement, hors ligne | `etat.ts` |
| Commandes signées côté Box : durée de vie, liste fermée, caviardage | `commandes.ts` |
| Simulateur de Box et essai de charge | `simulateur.ts` |

Mesuré dans la session (in-process, même fonction que les deux portes) :
10 000 Box font un tour complet (5 requêtes signées chacune) en ~12 s, soit
~4 000 requêtes/s ; 10 000 battements en ~3 s. Le MASTER demande 200/s.

## Choix faits là où les documents laissaient ouvert

- **Une seule application admin, trois consoles** (Fleet, Plateforme, Équipe)
  sous un lanceur, au lieu de quatre installeurs : un seul binaire à signer et
  à mettre à jour.
- **Le bus d'événements est le magasin de la plateforme** (publication puis
  livraison, rejouable) ; NATS pourra devenir le transport sans changer les
  consommateurs.
- **Second facteur = TOTP** (application d'authentification), clé scellée en
  AES-256-GCM sous une clé dérivée du secret de la plateforme. Pas de SSO
  externe : aucun compte payant ouvert au nom de max.
- **`PLATEFORME_ADMIN_SECRET` est la clé de secours du fondateur** : elle vaut
  l'acteur `ACT-FONDATEUR`, rôle FONDATEUR, second facteur réputé fait. Le rôle
  FONDATEUR ne se donne à personne d'autre.
- **R4 = deux personnes** : un humain qui demande + un autre humain ; un agent
  ou un service qui demande + deux humains.
- **L'argent n'est jamais déplacé par le noyau** : avoir, remboursement et
  remise sont des décisions tracées (`versement: "non_effectue"`) ; Stripe reste
  le seul chemin d'un paiement.
- **Redémarrer un service absent d'iAgent OS est refusé en français** (même
  liste que `box/os/systemd/SERVICES.json`).

## Ce qui n'est pas fait (ne pas l'annoncer)

- **L'agent de la Box (`box/services/agent-device`) ne parle pas encore `/v1`** :
  sur une vraie Box, une commande reste en file puis expire. Seul le simulateur
  fait le tour complet.
- Déploiement progressif (canari, retour arrière automatique), file de travail
  et tickets de l'équipe, connecteurs, limites de débit, NATS.
- Le balayage (`POST /v1/balayage`) n'est pas encore appelé par une tâche à
  heure fixe chez Cloudflare.

## Les consoles (`back-office/`)

L'application admin range ses écrans en trois consoles et un contrôle commun :
**Fleet Commander** (vue de la flotte avec la fiche de chaque Box, ses agents et
ses commandes ; incidents ; Boxes ; usine), **Platform Commander** (plans,
licences, voix, catalogue, Skills, opportunités, études, devis), **iAgent Team**
(acteurs, rôles, plafonds, second facteur, actions de l'équipe) et **Contrôle**
(approbations, journal du noyau avec suivi d'une corrélation, audit).
On s'y connecte avec la clé du fondateur ou avec un compte personnel
(identifiant, clé, code à 6 chiffres) ; la session est rangée dans le trousseau
de l'ordinateur comme le jeton. Les écrans du banc sont rendus sur des réponses
du vrai noyau (`back-office/banc/noyau-de-banc.ts`), pas sur des données écrites
à la main. Une action retenue pour approbation s'affiche « Pas encore faite ».
Avec un compte personnel, les écrans de l'ancien contrôle (`/controle/…`)
répondent par le refus de la plateforme : ils demandent encore la clé du
fondateur.
