# Préparer un poste en usine

Ce dossier installe, sur un PC Windows neuf, l'application iAgent et tous les
logiciels dont le poste a besoin. Chaque logiciel est téléchargé chez son
éditeur au moment de l'installation, par winget (le gestionnaire de paquets de
Windows) ou par le Microsoft Store quand l'éditeur ne publie que là. Rien n'est
embarqué dans le dépôt : la redistribution des installeurs d'autres éditeurs
n'est pas toujours permise, et on installe ainsi toujours leur dernière version.

| fichier | rôle |
|---|---|
| `logiciels.json` | la liste. Ajouter un logiciel, c'est ajouter une ligne ici. |
| `preparer-poste.ps1` | le script. Il lit la liste et rien d'autre. |
| `preparer-poste.cmd` | le lanceur, pour un clic droit « Exécuter en tant qu'administrateur ». |
| `banc.ts` | le contrôle, lancé par `npm run controle`. |

## Ce qui est installé

**Sur chaque poste** (liste validée par max le 25/09/2026) : Ollama (le moteur
local des agents), LibreOffice, ONLYOFFICE, Thunderbird, Firefox, Telegram,
WhatsApp, Signal, SumatraPDF, PDFsam, NAPS2 (scanner vers PDF lisible),
KeePassXC, draw.io, ShareX, Notepad++, 7-Zip, VLC, puis iAgent.

**En option** (`-Avec <id>`) :
- **RustDesk, la maintenance à distance** : il nous permet de dépanner le poste.
  Le client choisit de l'installer ou non ; il ne s'installe jamais d'office
  (le banc le refuse).
- Linphone, pour un client qui a une ligne téléphonique par internet (SIP).
- Outlook, pour un client qui vit dans Microsoft 365. Il n'est pas libre.

**Selon le métier des agents** (`-Agents AG-0123,AG-0456`) : chaque fiche porte
sous `acces.logicielsPoste` les logiciels libres que son métier demande au
poste, dérivés de ses tâches (`npm run verifier -- --corriger`). Un graphiste
reçoit GIMP, Inkscape et Scribus, un traducteur OmegaT, un chef de projet
ProjectLibre ; une secrétaire, rien de plus. 222 fiches sur 1 250 en demandent
au moins un. `-TousMetiers` installe tout le groupe.

Les logiciels propres à une activité (gestion immobilière, logiciel
d'imprimerie, caisse…) ne sont pas ici : ce sont les qualifications de la fiche
(`qualifications.logiciels`, référentiel `catalogue/logiciels.json`), presque
toujours en ligne et payants, sur l'abonnement du client. L'agent s'en sert par
le navigateur intégré ou leur API.

**Avec `-Developpeur`**, pour nos machines de préparation : Git, Node.js,
Rust, les outils C++ de Microsoft (sans eux Rust ne compile pas sous Windows)
et VSCodium.

**Avec `-Modeles`** : les modèles `qwen2.5:3b` et `llama3.1:8b` dans Ollama,
un par palier courant. Les paliers plus lourds dépendent de la machine et se
tirent à la main (`ollama pull <nom>`).

Tout est libre sauf WhatsApp (aucun équivalent), Outlook (option) et les outils
C++ de Microsoft (aucun autre éditeur de liens ne sert à Rust sous Windows).

**Box et sans box.** Sur une Box, tout est posé en atelier. Pour un client sans
Box, ce même pack est ce qu'on lui donne en lien : c'est à lui de le lancer, et
c'est un des avantages de la Box de ne pas avoir à le faire.

## Les gestes

1. Ouvrir une session Windows avec **le compte qui sera livré au client** :
   iAgent s'installe dans ce compte, pas pour toute la machine. C'est voulu :
   avec l'installeur par machine (MSI), Windows demanderait l'administrateur à
   chaque mise à jour silencieuse.
2. Copier le dossier `usine/` sur le poste.
3. Clic droit sur `preparer-poste.cmd`, « Exécuter en tant qu'administrateur ».

Pour vérifier une machine sans rien installer, lancer d'abord l'essai :

```bat
preparer-poste.cmd -Essai
```

Il demande à winget si chaque logiciel existe toujours sous son identifiant et
dit ce qu'il ferait. Les autres options se combinent :

```bat
preparer-poste.cmd -Modeles
preparer-poste.cmd -Developpeur
preparer-poste.cmd -Avec RustDesk.RustDesk
preparer-poste.cmd -Agents AG-0201,AG-0322
preparer-poste.cmd -EmpreinteIAgent <SHA-256 attendu>
```

Le script peut être relancé autant de fois qu'on veut : ce qui est déjà
installé est sauté. Il finit par un bilan logiciel par logiciel (`installe`,
`deja la`, `echec`) et le garde dans
`C:\ProgramData\iAgent\usine\journal-<date>.txt`. Il sort en 1 dès qu'un
logiciel a échoué : un poste dont une ligne est rouge n'est pas prêt.

## WhatsApp et Telegram : installés pour la personne, pas pour l'agent

WhatsApp Desktop est installé pour que la personne qui utilise le poste s'en
serve. L'agent, lui, ne pilote pas cette fenêtre. Les conditions de Meta
interdisent l'envoi automatisé et tout usage non personnel sans autorisation,
et c'est le numéro de l'entreprise du client qui serait fermé. L'agent passe par
l'API WhatsApp Business et le relais (`desktop/src-tauri/src/whatsapp.rs`,
`relais/`).

Telegram, c'est pareil pour une autre raison : l'agent passe par l'API de bots
de Telegram (`telegram.rs`), gratuite, qui ne casse pas à chaque mise à jour de
l'application comme le ferait un pilotage par clics.

Thunderbird et LibreOffice, eux, servent tels quels : les brouillons `.eml`
des agents s'ouvrent en rédaction dans Thunderbird, et leurs `.xlsx` et `.docx`
dans LibreOffice.

## Ce qui n'est pas encore constaté

- **Le script n'a jamais tourné sous Windows.** Il a été éprouvé avec
  PowerShell 7 sous Linux et un faux winget : lecture de la liste, logiciel
  déjà présent sauté, identifiant inconnu signalé, échec d'installation
  compté, empreinte fausse refusée, code de sortie. Pas avec Windows
  PowerShell 5.1, ni avec le vrai winget.
- **Deux identifiants sont relevés par recherche et pas chez winget** :
  WhatsApp (`9NKSQGP7F2NH`, Microsoft Store) et Thunderbird en français
  (`Mozilla.Thunderbird.fr`). L'essai (`-Essai`) les confirme ou les signale,
  sans rien deviner.
- **iAgent n'est pas signé** : le journal l'écrit (`NotSigned`). Que SmartScreen
  intervienne ou non sur un installeur lancé par ce script, ce n'est pas
  constaté.
- **Où `-Agents` trouve les fiches** : `-Fiches <dossier>` s'il est donné,
  sinon `agents/` et `socle/` à côté du dossier `usine` (le dépôt), sinon
  l'application installée (`%LOCALAPPDATA%\iAgent Desktop\agents`). Ce dernier
  chemin est celui que l'installeur NSIS de Tauri devrait choisir ; il n'est pas
  constaté sur une vraie installation.
- **Une vingtaine d'identifiants ajoutés le 25/09 sont écrits de mémoire**
  (ONLYOFFICE, GIMP, OmegaT…). L'essai les confirme ou les signale.
