# iAgent — prise en main en 5 minutes

Lu en premier par toute nouvelle session (humain ou Claude). `CLAUDE.md` garde
les règles durables, `README.md` le contenu du dépôt et les commandes. Ce
fichier dit **ce qu'on vend, où on en est, et quoi faire ensuite**.

## Ce qu'on vend

Des **employés virtuels** : 1249 fiches d'agents IA, un métier par fiche
(secrétaire administratif, designer publicitaire, gestionnaire de courrier…),
chacun préconfiguré avec son persona d'expert, ses tâches quotidiennes, ses
connecteurs (email, WhatsApp, navigateur), et ce qu'il lui faut comme machine.

Trois noms, trois choses distinctes :

| Nom | C'est quoi | Où |
|---|---|---|
| **iAgent** | La marque et l'application desktop qui exécute les agents sur le PC du client, **en local sans tokens facturés**, ou par API avec la clé du client. | `desktop/` (Tauri + Rust + React) |
| **iagent.agency** | La boutique en ligne où l'on achète les agents à la carte. | `frontend/` (React + Vite), déployé sur Vercel |
| **LocalAgent** | Le matériel : mini-PC « poste » (~170 €) et « bundle » de calcul (mini-PC S à carte NVIDIA XL), livrés avec les agents préinstallés. | `dimensionnement/` (catalogue, placement, coût) |

Argument de vente : **matériel + API résiduelle au moins 3× moins cher que
l'API seule** sur un an, et sans commune mesure avec un employé (2 800 €/mois
chargé). `npm run economie` le calcule fiche par fiche.

## Comment ça marche

- **Un agent = un fichier JSON** dans `agents/` (`AG-0001-secretaire-administratif.json`),
  conforme à `contrat/paquet-agent.schema.json`. Boutique, application et
  dimensionnement lisent le même fichier.
- Tout ce qui est **dérivé** (`materiel`, `commercial`, `execution.appelsParJourEstimes`)
  est recalculé par `npm run verifier -- --corriger`. On ne le retouche jamais à la main.
- Local par défaut ; bascule API annoncée au client ; ses clés restent sur sa machine.

## État réel au 19/09/2026

### En ligne et vérifié
- **Boutique** : https://iagents-beta.vercel.app — 1249 fiches, filtres par secteur et famille, recherche.
  Projet Vercel `iagents` lié au dépôt GitHub : **chaque push sur `main` redéploie**.
- **Fiches** : 1249 paquets, `npm run controle` → 0 faute (dimensionnement 15/15, économie 7/7).

### Configuré, en attente d'une action de Max
- **iagent.agency** : le domaine est attaché au projet Vercel (`iagent.agency` + redirection `www`),
  mais le DNS chez OVH pointe encore vers l'hébergement OVH (51.91.236.255). À faire dans
  l'espace client OVH → zone DNS de `iagent.agency` :
  - enregistrement `A` de `iagent.agency` → `76.76.21.21` (remplacer l'A actuel, supprimer l'AAAA `2001:41d0:301::29`)
  - enregistrement `CNAME` de `www` → `cname.vercel-dns.com`
  Vercel émet le certificat tout seul dans l'heure qui suit.

### Pas encore fait
- **Application desktop iAgent (MSI Windows)** : le code Rust/Tauri existe (voix, routage,
  base SQLite, Telegram) mais **n'a jamais compilé sur GitHub Actions** : config Tauri
  invalide, icônes absentes, dépendance Vosk non liable. Voir `desktop/README.md` pour l'état
  du workflow « Build Windows MSI ». L'application n'exécute pas encore les 1249 fiches :
  elle embarque 5 agents d'exemple codés en dur.
- **E-commerce** : pas de panier, pas de paiement. La vitrine `drop-shipper.fr/b/iagent-agency`
  reste le point de vente en attendant.
- **Catalogue LocalAgent définitif** : `dimensionnement/machines.json` est un relevé AliExpress
  indicatif, pas des références négociées.

## Ce qui a cassé la veille (pour ne pas recommencer)

- `vercel.json` contenait une clé `projectSettings` que Vercel refuse : dix déploiements en
  erreur d'affilée **avant même de builder**. Toujours lire `errorMessage` du déploiement
  (API ou tableau de bord) plutôt que relancer.
- Trois cibles de déploiement en parallèle (Vercel, Netlify, GitHub Pages) avec trois configs :
  une seule reste, Vercel.
- Un serveur local sur le port 5000 d'une machine distante n'est joignable par personne.
- La page « Économie » du front inventait ses chiffres (`prix × 0,3` = matériel) au lieu de
  lire `dimensionnement/economie.ts`. Remplacé par les vrais calculs, générés au build.

## Commandes

```bash
npm install && npm run controle            # tout valider (obligatoire avant de pousser)
npm run verifier -- --corriger             # recalculer les champs dérivés
npm run economie                           # docs/economie.md : coût API seule vs Local-Agent
npm --prefix frontend ci && npm --prefix frontend run build   # exactement ce que fait Vercel
npm --prefix frontend run dev              # boutique en local (http://localhost:3000)
```

## Prochaines étapes, dans l'ordre

1. Max : DNS OVH → Vercel (ci-dessus). Ensuite `https://iagent.agency` répond.
2. Obtenir un premier MSI qui s'installe (workflow « Build Windows MSI », artefact `iagent-desktop-msi`),
   puis brancher l'application sur les fiches `agents/` au lieu des 5 agents codés en dur.
3. Boutique : bouton « Acheter » vers la vitrine existante, puis panier + Stripe.
4. Catalogue LocalAgent réel (références, prix négociés) à la place du relevé AliExpress.
