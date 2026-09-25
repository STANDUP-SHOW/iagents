# Mettre le relais WhatsApp en ligne

Ce dossier est un petit serveur HTTP **sans aucune dépendance** : il n'y a rien à
installer, et `npm install` n'y a rien à faire. Pourquoi il existe et ce qu'il
promet : `../docs/relais-whatsapp.md`.

```
serveur.ts   les trois routes
banc.ts      39 contrôles, dont la signature de Meta dans les deux sens
```

Le banc tourne dans `npm run controle`, à la racine, et donc en intégration
continue. Seul, depuis la racine : `npm run controle-relais`.

## Les trois variables, et d'où vient chacune

Elles vivent dans le tableau de bord de l'hébergeur, **jamais dans le dépôt**.
Sans elles le relais refuse de démarrer, plutôt que de tourner en acceptant
n'importe quelle charge comme venant de Meta.

| Variable | D'où vient sa valeur |
| --- | --- |
| `META_APP_SECRET` | Le secret de l'application, chez Meta : tableau de bord de l'app → Settings → Basic → App Secret. C'est la clé de la signature, pas le jeton du numéro. |
| `META_VERIFY_TOKEN` | Une chaîne au hasard, choisie une fois. La même valeur est à recopier chez Meta dans le champ « Verify token » de l'abonnement. |
| `RELAIS_SECRET` | Une chaîne au hasard. C'est ce que le poste du client présente en `Authorization: Bearer` pour relever ; elle va aussi dans le trousseau de sa machine. |

`PORT` est posé par l'hébergeur ; ne pas l'écrire à la main.

## Les gestes, dans Railway

1. **New Project → Deploy from GitHub repo**, dépôt `STANDUP-SHOW/iagents`.
2. **Settings → Root Directory : `relais`.** Sans ça Railway construirait tout le
   dépôt, y compris l'application desktop, et échouerait.
3. **Variables** : ajouter les trois du tableau ci-dessus. Ne pas toucher à `PORT`.
4. **Settings → Networking → Generate Domain.** Railway rend une adresse en
   `https://…up.railway.app` avec un certificat valide, ce qu'exige Meta : sa page
   dit « Self-signed certificates are not supported ».
5. Vérifier que le processus est vivant : ouvrir l'adresse à la racine, elle doit
   répondre `relais whatsapp`. Elle ne dit rien de ce que le relais contient.

Railway lance `npm start`, c'est-à-dire `node --experimental-strip-types
serveur.ts`. Node 22.6 ou plus est demandé dans `package.json`.

## Puis, chez Meta — demande le compte Meta Business

À faire une fois l'adresse connue, et **pas depuis une session cloud** :

6. Tableau de bord de l'application → **WhatsApp → Configuration → Edit**.
7. **Callback URL** : `https://<adresse Railway>/webhook`.
8. **Verify token** : exactement la valeur de `META_VERIFY_TOKEN`.
9. **Verify and save.** Meta appelle l'adresse en `GET` avec son défi ; le relais
   ne le renvoie que si le mot correspond. Un refus ici veut dire que les deux
   valeurs diffèrent.
10. **Webhook fields → s'abonner à `messages`.** Sans cet abonnement, Meta ne
    pousse rien et le relais restera vide sans rien signaler d'anormal.

## Ce qui n'est pas vérifié

Le relais n'a jamais parlé au vrai Meta. Le banc parle à un serveur écrit à la
main sur la boucle locale, et la charge qu'il rejoue est recopiée de la page de
référence de Meta — c'est la bonne forme, ce n'est pas le même interlocuteur.
Le premier vrai message reste à voir passer.
