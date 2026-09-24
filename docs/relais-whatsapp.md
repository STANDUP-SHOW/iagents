# Le relais WhatsApp

Choix de max, 24/09/2026 : **relais hébergé**, pour que l'agent reçoive et
réponde, et pas seulement qu'il envoie.

Ce document dit ce que le relais doit faire. La moitié poste est déjà écrite et
éprouvée (`desktop/src-tauri/src/whatsapp.rs`) ; c'est elle qui fixe le contrat
ci-dessous.

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
renvoie le défi qu'il donne. **Les noms exacts de ses paramètres restent à
relever** sur sa page de vérification : ils ne sont pas dans la page de mise en
place qui a été lue, et les écrire de mémoire est exactement la faute que ce
dépôt se garde de faire.

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

**Ce qu'il reste à faire, et qui n'est pas un détail : vérifier que la charge
vient bien de Meta.** Sans ça, quiconque trouve l'adresse du relais peut faire
croire à l'agent d'un client qu'un de ses clients a écrit quelque chose. Meta
signe ses appels ; **le nom exact de l'en-tête et la façon de recalculer la
signature restent à relever chez lui** avant d'écrire une ligne. Tant que ce
n'est pas fait, le relais ne doit pas être ouvert au public.

### `GET /messages` — ce que le poste vient chercher

C'est le contrat que `whatsapp.rs` implémente déjà et que ses bancs éprouvent :

```
GET {relais}/messages?depuis=<n>&attente=<s>
    Authorization: Bearer <secret du relais>

200 {"messages":[{"de","nom","texte","recu_le"}], "suite":<n>}
401 si le secret ne va pas
```

- Le relais **garde la ligne ouverte** jusqu'à `attente` secondes quand il n'a
  rien, comme `getUpdates` chez Telegram. Le poste attend 25 secondes et coupe à
  35 : sa marge est dans `ATTENTE_SECONDES` et `DELAI_RESEAU`.
- `suite` est le point de reprise à redonner au coup d'après. **Le poste ne
  recule jamais** : si le relais rend un `suite` plus bas que le `depuis`
  demandé, le poste garde le sien, sinon l'agent répondrait deux fois au même
  message.
- Le secret est porté en en-tête, donc l'adresse doit être en `https://` — le
  poste refuse toute autre adresse, sauf la boucle locale où tourne le banc.

## Ce qui reste à décider

**Où il est hébergé, et sous quel compte.** Le dépôt a déjà un projet Vercel
pour la boutique ; y poser une fonction serait le chemin le plus court et sans
frais nouveaux, mais ça mêlerait la vitrine et la correspondance des clients
dans le même projet. C'est un choix qui appartient à max, pas au code.

Tant qu'il n'est pas fait, la moitié poste ne sert à rien toute seule — et c'est
voulu : elle refuse proprement plutôt que de faire semblant.
