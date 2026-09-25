# Le relais WhatsApp

Choix de max, 24/09/2026 : **relais hébergé**, pour que l'agent reçoive et
réponde, et pas seulement qu'il envoie.

Ce document dit ce que le relais fait. Les deux moitiés sont écrites : le poste
(`desktop/src-tauri/src/whatsapp.rs`, 13 bancs Rust) et le relais lui-même
(`relais/serveur.ts`, 39 contrôles). C'est le poste qui fixe le contrat ci-dessous,
parce que c'est lui le client.

**Reste à mettre en ligne et à éprouver avec un vrai message** : les gestes à
faire chez Railway et chez Meta sont dans `relais/README.md`, et le compte Meta
Business de max est nécessaire pour le dernier.

## Pourquoi il existe

Telegram laisse la machine du client appeler et attendre, donc rien à héberger.
Meta, non. Sa page de mise en place des webhooks, lue le 24/09/2026 :

> your server must have a valid TLS or SSL certificate correctly configured and
> installed. Self-signed certificates are not supported.

et un entrant n'arrive que poussé vers cette adresse. **Aucune API de relève
n'existe** — vérifié le même jour, ce n'est pas une supposition. La machine du
client n'a pas d'adresse publique, donc il faut quelqu'un entre les deux.

## Ce qu'il ne fait pas

- **Il n'envoie rien.** Le poste appelle `graph.facebook.com` directement. Le
  jeton Meta du client ne quitte jamais sa machine et le relais ne le voit
  jamais.
- **Il n'archive rien.** Un message est effacé dès qu'il a été relevé, et de
  toute façon au bout d'un délai court. Ce qui passe par nous, ce sont les
  messages que des clients écrivent à l'entreprise ; les garder ferait de nous
  un dépôt de la correspondance de nos clients, ce que personne n'a demandé.
- **Il ne sert pas de connecteur.** Il ne parle qu'au poste et à Meta.

## Les trois routes

### `GET /webhook` — la poignée de vérification de Meta

Meta appelle cette adresse une fois, à l'enregistrement, et attend qu'on lui
renvoie le défi qu'il donne. **Relevé chez lui le 24/09/2026**, il envoie trois
paramètres :

```
GET {relais}/webhook?hub.mode=subscribe
                    &hub.verify_token=<le mot que nous avons posé chez Meta>
                    &hub.challenge=<son défi>

200 <la valeur de hub.challenge, telle quelle>
```

`hub.mode` « will always be set to subscribe ». Le relais compare
`hub.verify_token` au mot posé dans la configuration de l'application chez Meta,
et **ne renvoie le défi que s'il correspond** : sans cette comparaison,
n'importe qui pourrait faire enregistrer notre adresse sous son propre compte.

### `POST /webhook` — ce que Meta pousse

La charge d'un message texte, recopiée verbatim de la page de référence de Meta
le 24/09/2026, est dans le banc `charge_de_meta()` de `whatsapp.rs`. Le
dépouillement est déjà écrit et éprouvé : `whatsapp::depouiller_entrant` vit
côté poste mais sert au relais, pour que la forme ne soit écrite qu'une fois.

**Deux pièges déjà tenus par un banc :**

- `contacts` et `messages` sont deux tableaux séparés et rien ne promet le même
  ordre. Le nom se prend par le numéro (`contacts[].wa_id` contre
  `messages[].from`), jamais par la position — sinon le nom d'une personne se
  colle au message d'une autre dès qu'une notification en porte plusieurs.
- Une notification qui n'est pas un texte (accusé de lecture, statut, image) ne
  remonte rien. La remonter ferait répondre l'agent à du vide.

**Vérifier que la charge vient bien de Meta, et qui n'est pas un détail.** Sans
ça, quiconque trouve l'adresse du relais peut faire croire à l'agent d'un client
qu'un de ses clients a écrit quelque chose. **Relevé chez Meta le 24/09/2026 :**

```
X-Hub-Signature-256: sha256=<HMAC-SHA256 du corps, en hexadécimal minuscule>
```

La clé est le **secret de l'application** (App Secret) posé chez Meta, et non le
jeton du numéro. On recalcule, et on compare à « everything after sha256= ».

**Le piège, et c'est celui qui décide :** Meta dit signer « an escaped unicode
version of the payload, with lowercase hex digits ». Le corps qu'il envoie porte
donc déjà ses caractères accentués échappés (`\u00e9` et non `é`), et c'est
cette forme-là qui est signée. **Il faut donc hacher les octets reçus tels
quels, jamais un JSON réécrit** : une bibliothèque qui relit puis réémet la
charge rend `é`, donc d'autres octets, donc une signature qui ne tombe jamais
juste. Et comme les messages qui nous intéressent sont écrits en français, ce
n'est pas un cas rare — c'est le cas courant. Un relais écrit sans y penser
refuserait tout message accentué et laisserait passer le reste.

**Meta attend « a 200 OK HTTPS response » « within 5 or less seconds ».** Le
relais range donc le message et répond tout de suite ; c'est `GET /messages`,
plus bas, qui fait le travail quand le poste vient chercher. Traiter avant de
répondre ferait rejouer la notification par Meta.

**C'est écrit, et le banc le prouve dans les deux sens** (`relais/banc.ts`) : une
signature calculée sur les octets reçus est acceptée, et une signature calculée
sur le JSON réécrit est refusée. Vérifié en remettant le bogue — en faisant hacher
au relais la forme réécrite, le banc tombe sur ces deux lignes-là et sort 1.
`signatureValide()` prend un `Buffer` et non un objet, pour que le type interdise
de se tromper : la signature se vérifie avant tout `JSON.parse`.

La comparaison passe par `timingSafeEqual`, comme celle du secret du relais et
celle du mot de la poignée : un secret qui se compare caractère par caractère se
devine essai par essai.

### `GET /messages` — ce que le poste vient chercher

C'est le contrat que `whatsapp.rs` implémente déjà et que ses bancs éprouvent :

```
GET {relais}/messages?depuis=<n>&attente=<s>
    Authorization: Bearer <secret du relais>

200 {"messages":[{"de","nom","texte","recu_le"}], "suite":<n>}
401 si le secret ne va pas
```

- `attente` est une **demande, pas une exigence**. Le relais peut garder la ligne
  ouverte jusqu'à `attente` secondes quand il n'a rien, comme `getUpdates` chez
  Telegram ; il peut aussi répondre tout de suite avec une liste vide. Le poste
  traite les deux de la même façon — une relève vide est un succès ordinaire, pas
  une erreur — et il redemande. Vérifié dans `relever()` : rien n'y échoue sur une
  liste vide. **Le choix ne change donc pas une ligne du poste**, seulement le
  délai avant qu'un agent voie un message et la facture de l'hébergeur. Le poste
  attend 25 secondes et coupe à 35 : sa marge est dans `ATTENTE_SECONDES` et
  `DELAI_RESEAU`.
- `suite` est le point de reprise à redonner au coup d'après. **Le poste ne
  recule jamais** : si le relais rend un `suite` plus bas que le `depuis`
  demandé, le poste garde le sien, sinon l'agent répondrait deux fois au même
  message.
- Le secret est porté en en-tête, donc l'adresse doit être en `https://` — le
  poste refuse toute autre adresse, sauf la boucle locale où tourne le banc.

## Où il vit : Railway

**Choix du 25/09/2026**, déduit de ce que max a ouvert dans son navigateur et non
écrit par lui en toutes lettres : Railway, c'est-à-dire la première des deux
formes ci-dessous. S'il voulait l'autre, le code ne change pas.

Ce qui avait été proposé le 24/09 — le compte Vercel de la boutique — était une
mauvaise idée, pour deux raisons relevées depuis :

- Le compte est au forfait gratuit et **il en a atteint la limite le 24/09** : le
  robot de Vercel a refusé un déploiement d'aperçu sur la PR #19 en disant
  « Resource is limited - try again in 24 hours (more than 100, code:
  "api-deployments-free-per-day") ».
- Surtout, **une fonction serverless est facturée au temps passé**, et une ligne
  gardée ouverte 25 secondes le passe entièrement. Un seul agent qui relève sans
  cesse tiendrait une fonction ouverte à peu près en permanence.

**Les deux formes qui marchent**, et le poste accepte les deux sans changer une
ligne — vérifié dans `relever()` : une relève vide est un succès ordinaire, pas
une erreur :

1. **Un processus qui tourne en permanence** (Railway, ou un VPS à quelques euros
   par mois). Garder une ligne ouverte 25 secondes n'y coûte rien de plus, donc la
   vraie longue attente est possible et un message arrive à l'agent en moins d'une
   seconde. C'est ce qui est retenu, et ce que `relais/serveur.ts` fait.
2. **Une fonction serverless qui répond tout de suite**, le poste redemandant
   toutes les quelques secondes. Le prix devient négligeable ; le coût est la
   latence. `serveur.ts` marcherait aussi ainsi, mais il lui faudrait une base
   externe : ses messages vivent en mémoire, ce qu'une fonction sans état perd
   entre deux appels.

**Ce que le relais garde, et pour combien de temps.** En mémoire, dix minutes au
plus, mille messages au plus, et rien sur disque. Le contrat plus haut disait
« effacé dès qu'il a été relevé » ; c'est une durée de vie courte à la place, et
c'est délibéré : avec un point de reprise, c'est le curseur du poste qui empêche
de resservir un message, pas l'effacement. Effacer à la lecture perdrait le
message si la ligne tombait entre l'envoi et sa prise en compte, et le poste n'a
alors aucun moyen de le redemander.

**Ce qui n'est pas journalisé, et pourquoi c'est dans cette liste.** Aucun contenu
de message, aucun numéro, aucun secret. Le relais promet de ne rien archiver ; un
texte recopié dans les journaux de l'hébergeur serait archivé quand même, et
lisible par qui a accès au tableau de bord.

## Ce qui reste

- **Mettre en ligne** : les gestes du tableau de bord Railway sont dans
  `relais/README.md`. Ils sont à faire par max ou par la session qui pilote son
  navigateur, pas d'ici.
- **Le compte Meta Business de max**, pour déclarer l'adresse du relais et
  éprouver un vrai message de bout en bout. Rien de ce qui est écrit n'a encore
  parlé au vrai Meta : le banc parle à un serveur écrit à la main sur la boucle
  locale, et la charge qu'il rejoue est recopiée de la page de Meta.
- **L'écran** n'appelle encore aucune des cinq commandes WhatsApp du poste, donc
  un client ne peut pas brancher WhatsApp par l'interface même une fois le relais
  en ligne.
