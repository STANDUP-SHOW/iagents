# Paiement de la liste de recrutement (Stripe)

La liste de recrutement du site est un panier : des agents (une fiche, un
palier) et la Box Commander. « Valider » ouvre la page de paiement **hébergée par
Stripe** : aucun numéro de carte ne passe par nos pages.

## Ce qui est facturé

- Un **abonnement mensuel unique** par commande, montants **hors taxes**, TVA
  française de 20 % ajoutée (taux créé une fois dans le compte Stripe).
- Chaque prix est **lu dans `frontend/src/data/tarifs.json`**, chaque nom dans la
  fiche de l'agent. La page n'envoie que des identifiants ; un prix qu'elle
  enverrait n'est pas lu (le banc le vérifie).
- La Box porte son engagement (36 ou 24 mois), écrit au-dessus du bouton de
  paiement et gardé dans les métadonnées de l'abonnement.
- Le catalogue Stripe se crée tout seul au premier paiement de chaque ligne
  (prix retrouvé par sa clé `iagent_agent_<fiche>_<palier>_<centimes>` ou
  `iagent_box_<offre>_<centimes>`). Un prix changé dans `tarifs.json` donne un
  nouveau prix Stripe ; les abonnements déjà signés gardent le leur.
- Restent en demande de devis : plus de 20 postes différents (limite Stripe d'un
  abonnement), plus de 20 exemplaires d'un poste, une formule `devis`, une Box
  masquée ou « bientôt ».

## Routes (contrat pour le site)

| Route | Rôle |
|---|---|
| `GET /api/paiement/etat` | `{ paiement: true\|false, mode: "test"\|"reel"\|null }`. `false` : garder « Demander un devis ». |
| `POST /api/paiement/session` | Corps `{ lignes: [ { type: "agent", fiche: "AG-0001" ou "secretaire-administratif", palier: "essential"\|"professional"\|"expert", quantite: 1 }, { type: "box", offre: "box-commander-36"\|"box-commander-24", quantite: 1 } ] }`. Réponse `{ url, totalHT }` : envoyer le navigateur sur `url`. Refus : `{ erreur, devis: true }`, phrase en français à afficher telle quelle. |
| `GET /api/paiement/session?id=cs_…` | Pour la page de retour : `{ statut, paye, totalHT, totalTTC }` (centimes). |
| `POST /api/paiement/webhook` | Appelé par Stripe seulement. |

Retour de Stripe : `/recrutement?paiement=reussi&session=cs_…` ou
`/recrutement?paiement=annule`. Ces adresses sont à servir par le site.

## Mise en marche

Rien ne s'ouvre sans clé. Une seule variable à poser dans Vercel (projet
`iagents`, Settings → Environment Variables), tapée par max lui-même :

- `STRIPE_SECRET_KEY` : `sk_test_…` pour essayer (cartes de test Stripe),
  `sk_live_…` pour encaisser. Le mode se lit sur la clé.

En production, l'adresse du webhook s'enregistre seule chez Stripe au premier
paiement. Sans `STRIPE_WEBHOOK_SECRET`, chaque événement reçu est relu chez
Stripe avec la clé secrète et seule cette copie est crue ; la variable peut être
ajoutée plus tard pour vérifier la signature à la place.

Encaisser pour de vrai demande un compte Stripe activé, donc le SIRET.

## Vérifier

`npm run controle-paiement` (aussi dans `npm run controle`) : règles du panier,
prix lus dans `tarifs.json`, appels envoyés à un faux Stripe, signature du
webhook, routes sans clé et avec clé de test. Aucun appel au vrai Stripe n'a été
fait depuis le dépôt.
