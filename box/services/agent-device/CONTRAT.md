# iagent-device — le contrat de l'agent de la Box

Ce que `iagent-device` lit, écrit et dit, pour que l'usine (Python), le kiosque
(cage, cog), l'updater, le watchdog et la plateforme parlent du même objet. Un
chemin ou un champ écrit ailleurs qu'ici finirait faux.

## Fichiers

| Chemin | Qui écrit | Contenu |
|---|---|---|
| `/etc/iagent/device.json` | `iagent-device enroler` | `{plateforme, cle_plateforme (PEM), device_id, reference, serial, gamme, profil_materiel, lot, enrolee_le}` — rien de secret |
| `/etc/iagent/profil` | `tard/10-services.sh` | `business` ou `home` |
| `/etc/iagent/usine.json` | `tard/40-usine.sh` (depuis l'ISO) | `{operateur, lot, plateforme, jeton}` ; le `jeton` est effacé après l'enrôlement |
| `/var/lib/iagent/identite/ed25519.pkcs8` | `iagent-device identite` (0600, root) | la clé privée de la Box ; ne quitte jamais la machine |
| `/var/lib/iagent/identite/x25519.secret` | idem | la clé de chiffrement des Skill Packs (32 octets) |
| `/var/lib/iagent/usine/inventaire.json` | `iagent-device inventaire` | l'`InventaireBox` du dernier relevé |
| `/var/lib/iagent/usine/<reference>.json` | `lancer.py` (Python) | le rapport d'usine |
| `/var/lib/iagent/usine/qualifiee` | `iagent-device rapport` quand la plateforme répond `qualifiee` ou `provisionnee` | marqueur : `iagent-commander` prend tty1, `iagent-usine` ne démarre plus |
| `/var/lib/iagent/usine/journal.ndjson` | `iagent-device usine` | une ligne JSON par événement de l'écran opérateur |
| `/var/lib/iagent/alertes.json` | `iagent-watchdog` | alertes en attente, lues et vidées par la télémétrie |
| `/var/lib/iagent/paquets/` | `tard/10-services.sh`, `iagent-updater` | chaque `.deb` posé, pour revenir en arrière |

`IAGENT_ETAT` déplace `/var/lib/iagent`, `IAGENT_CONF` déplace `/etc/iagent` (bancs).

## Sous-commandes

| Commande | Fait | Sort |
|---|---|---|
| `identite` | crée les clés si absentes | `{device_id, identite_publique, cle_chiffrement_publique}` sur stdout |
| `inventaire [--sortie f]` | relève la machine (dmidecode, /proc, lsblk, ip, /sys) | l'`InventaireBox` JSON |
| `enroler --profil-materiel <id> [--jeton <t>]` | `POST /controle/usine/enroler` (jeton lu dans usine.json sinon), puis relit `GET /controle/cle-publique` | écrit `device.json`, imprime la Box |
| `telemetrie [--une-fois]` | `POST /controle/box/telemetrie` signée (cpu, mémoire, disque, température, versions dpkg) | 0 si 200 |
| `rapport <fichier>` | `POST /controle/box/usine/rapport` signée | pose le marqueur si qualifiée ; imprime le verdict de la plateforme |
| `mises-a-jour` | `GET /controle/box/mises-a-jour` signée | la liste JSON (pour `iagent-updater` et le test `ota`) |
| `servir` | boucle : `READY=1`, télémétrie toutes les 5 min, `WATCHDOG=1` | ne sort pas |
| `usine --ecouter 127.0.0.1:8787` | sert `/opt/iagent/usine/ui` et l'API de l'écran opérateur | ne sort pas |

Codes de sortie : 0 fait ; 1 refus de la plateforme (son message en français est
imprimé tel quel) ; 2 argument ou fichier manquant ; 3 réseau injoignable.

## API locale du mode usine (127.0.0.1 seulement)

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/etat` | `{profil, device, inventaire, profil_materiel, etape, verdict, tests:[…], qualifiee}` |
| POST | `/api/installer` | `{operateur, profil_materiel}` : enrôle si besoin, lance `lancer.py`, les lignes arrivent dans `/api/etat.tests` |
| POST | `/api/rapport` | dépose le rapport écrit par `lancer.py` ; rend la réponse de la plateforme |
| GET | `/api/rapport` | le rapport JSON (export USB : l'écran le propose au téléchargement) |
| POST | `/api/eteindre` | `systemctl poweroff` |

Tout ce que l'API rend est aussi écrit dans `journal.ndjson` ; jamais un jeton,
jamais une clé.

## Journal

`SyslogIdentifier=device` (`journalctl -t device`), `factory` en mode usine.
Les jetons d'usine, signatures et clés sont masqués avant écriture
(`masquer()`), comme dans `commun.py`.
