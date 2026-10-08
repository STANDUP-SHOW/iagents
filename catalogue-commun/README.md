# Le catalogue commun

Là où remontent les fiches que les clients composent à l'embauche (choix de max
du 03/10/2026 : « Automatique », sans rien demander au client).

```
serveur.ts   reçoit une recette, refait la fiche, la range une fois
banc.ts      refus et envoi réel sur la boucle locale (npm run controle-catalogue-commun)
```

## Ce qui arrive ici, et ce qui n'y arrive jamais

Le poste n'envoie pas la fiche mais sa **recette** : la fiche mère, l'activité,
les logiciels ajoutés et ce qu'ils remplacent, en identifiants seulement
(`{"format":1,"mere":"AG-1257","activite":"ACT-0243","logicielsAjoutes":["LOG-0565","LOG-0659"],"remplacements":{"LOG-0565":"LOG-0568"}}`).
Le service refait la fiche avec `ficheDepuisRecette`, la fonction même dont
l'écran s'est servi. Prénom, voix et phrase du client n'ont aucune case dans ce
format : une clé de plus fait refuser la recette, côté poste
(`desktop/src-tauri/src/partage.rs`) comme ici.

Côté poste, la recette entre dans une file (`config/fiches-a-partager.json`)
et part à l'embauche puis à chaque lancement. Elle ne sort de la file que
rangée (2xx) ou refusée pour de bon (400, 422). **Tant que
`ADRESSE_CATALOGUE_COMMUN` vaut `None` dans `partage.rs`, rien ne part** : la
file attend.

## Ce qu'il faut pour le mettre en ligne (décision de max)

1. Un hébergement Node 22 lancé **depuis la racine du dépôt** : le service lit
   `agents/` et `catalogue/`. Commande : `node --experimental-strip-types catalogue-commun/serveur.ts`.
2. Un disque qui survit aux redéploiements, monté sur `FICHES_DOSSIER`.
3. `CATALOGUE_SECRET` : une chaîne au hasard, tapée par max dans l'hébergeur.
   Elle protège la liste (`GET /fiches`), qui n'est pas publique.
4. L'adresse https obtenue, écrite dans `ADRESSE_CATALOGUE_COMMUN`, puis une
   version de l'application.

## Ce qui n'est pas fait

Les fiches rangées ne vont nulle part d'elles-mêmes : les faire entrer dans
`agents/`, la boutique ou les mises à jour reste à écrire. Le service est
ouvert en écriture à tout poste, sans compte : il borne à 500 fiches nouvelles
par heure et ne range que des fiches qu'il sait refaire.
