# iAgent Box Factory Installer — spécification (brief de max du 11/10/2026)

> « Le iAgent Box Factory Installer n'est pas un script d'installation Ubuntu.
> C'est notre chaîne de fabrication logicielle : il doit transformer
> automatiquement un mini-PC neuf compatible en appliance iAgent sécurisée,
> identifiée, administrable à distance, testée et prête à être attribuée à un
> client. »

Ce document rend le brief dans les mots et les règles du dépôt, dit ce qui est
fait en Phase 0 (avant réception des Box), ce qui est décidé, et où le brief
contredit ce que le dépôt disait avant lui. Le code est dans [`box/`](../box/README.md).

## 1. Objectif et KPI

Une Box se réinstalle dix fois et revient au même état ; aucune installation
manuelle, tout vient du code versionné, des profils, de l'image et des paquets
signés. **KPI : temps humain par Box < 5 minutes** (l'ordinateur peut en
prendre 30). Horizon : 10 Box branchées, « INSTALL BATCH », 10/10 READY.

Ce que fait l'opérateur : brancher, Ethernet, clé d'usine, démarrer ; à l'écran
d'usine : vérifier l'appareil, choisir la machine, prénom, INSTALLER, attendre
PRÊTE À EXPÉDIER, carton. Une seule clé pour toutes les Stations : le profil
(Home, Business, Enterprise) se pose à l'attribution (§3).

## 2. Langages (décision de max, 11/10/2026)

**Rust fait tourner la machine, TypeScript fait tourner le produit, Python fait
tourner l'IA et les tests.** Rust : `iagent-device`, `iagent-updater`,
`iagent-watchdog`, identité et signature (`box/services/`). TypeScript/React :
Desktop Commander (Tauri), l'écran d'usine, le back-office, le Control Plane.
Python (bibliothèque standard) : les tests d'usine, le rapport, le rodage. Bash
et cloud-init : l'autoinstall. Playwright + TypeScript pour le futur gestionnaire
d'espaces de navigateur.

## 3. Une machine, l'iAgent Station ; trois profils posés au provisioning

**Décision de max du 17/10/2026** (documents « iAgent Station Gen 1 —
Intégration simplifiée », « Supplier Technical Pack A et B », visuel des
finitions) : une seule machine, l'**iAgent Station** (écran tactile 27", base
avec carte Ryzen, 4 micros champ lointain, deux haut-parleurs, anneau de LED),
en trois SKU, et **une seule image d'usine** ; le **profil** se pose au
provisioning, pas par la clé.

| SKU (`box/materiel/`) | mémoire | disque | profils qu'il sert |
|---|---|---|---|
| `station-32-v1` | 32 Go DDR5 | 1 To NVMe | home, business (petite entreprise) |
| `station-64-v1` | 64 Go DDR5 | 1 To NVMe | business, enterprise |
| `station-64-plus-v1` | 64 Go DDR5 | 2 To NVMe | business, enterprise |

| Profil (`box/profils/`, `Box.gamme`) | agents / espaces de navigateur | voix |
|---|---|---|
| `home` | 1 / 1 | démarre seule |
| `business` | 8 / 8 | activable |
| `enterprise` | 10 / 10 (« une dizaine », site ; à confirmer) | activable |

`Box.gamme` vaut `null` tant que la Station n'est pas attribuée ; `/attribuer`
(ou le jeton d'usine qui porte client, plan et profil) le pose, et la plateforme
refuse un profil que le matériel ne sert pas (une Station 32 n'est pas une
Enterprise). La référence est **une seule série**, `IA-FR-STN-00000127` :
l'étiquette s'imprime à l'usine, avant que le profil soit connu. Les services
actifs et le kiosque, communs à toutes, sont dans
`box/os/systemd/SERVICES.json` (`actifs`, `kiosque`). **Commander est le nom de
l'application** (Desktop Commander), pas une gamme.

Pas encore fait : porter le profil posé jusqu'à la Box (`/etc/iagent/profil`,
voix, nombre d'agents) ; ça viendra avec l'état voulu du noyau (`/v1`). La carte
compute n'est pas choisie (lot 1 des fournisseurs) : les seuils des profils
matériel sont provisoires.

Historique : 11/10 Business 64 Go et Home 32 Go (mini-PC BOSGAME M4 Neo, EXR1) ;
14/10 Home 16, Pro 32, Business 64 ; 17/10 la Station fait foi.

## 4. iAgent OS

Ubuntu Server **24.04.5 LTS** minimal (`box/usine/iso/source.json`, condensé
relevé chez Canonical), pas Ubuntu Core ni Windows IoT : les bibliothèques de
Tauri sont relevées sur 24.04 (`desktop/dependances-systeme.txt`), apt pose les
`.deb` qu'iagent-updater remplace, et rien n'oblige à passer par snap. systemd,
cage (compositeur à une application) devant `iagent-desktop` en édition Box ;
aucun bureau, aucun compte, aucun port entrant (nftables), consoles masquées.

Disque : `EFI` 1 Go, `SYSTEM_A` 32 Go (l'OS), `SYSTEM_B` 32 Go (réservée au
futur A/B d'image), `RECOVERY` 8 Go, `DATA` le reste en **LUKS2** montée sur
`/var/lib/iagent` (navigateurs, bases, mémoire des agents, cache, réglages,
identité). Clé scellée au **TPM 2.0** (PCR 7), clé de secours imprimée à
l'atelier, clé d'usine retirée : `securite/luks-tpm.md`.

## 5. Le cycle de vie, un seul

Le brief pose FACTORY → QUALIFIED → PROVISIONED → ASSIGNED → SHIPPED → ACTIVE ;
la plateforme avait `stock → provisionnee → active → suspendue | restituee |
remplacee`. **Un seul cycle**, dans `plateforme/controle/regles.ts` :

| brief | plateforme | qui fait passer |
|---|---|---|
| FACTORY | `usine` | `POST /controle/usine/enroler` (jeton d'usine) |
| QUALIFIED | `qualifiee` | `POST /controle/box/usine/rapport` dont le verdict recalculé est `passe` |
| PROVISIONED | `stock` | back-office (`/statut`), après rodage |
| ASSIGNED | `provisionnee` | `/attribuer`, qui pose le profil (ou le jeton d’usine qui portait client, plan et profil) |
| SHIPPED | `expediee` | back-office |
| ACTIVE | `active` | première télémétrie après expédition (`box.activee`) ; ou back-office |

Un échec d'usine n'est pas un état : la Box reste `usine`, le rapport `echec`
est gardé, on recommence. Une Box provisionnée à la main entre en `stock`.

## 6. Identité, enrôlement, rapport

Ed25519 par Box, `device_id` dérivé de la clé, requêtes signées (existant).
**Jeton d'usine** émis par le back-office (opérateur, lot, ≤ 72 h, ≤ 100 Box,
client et plan facultatifs), montré une fois, gardé haché ; il autorise
l'enrôlement sans accès admin dans l'atelier. L'enrôlement porte l'inventaire
(CPU, cœurs, mémoire, disque, MAC eth0/eth1/Wi-Fi, BIOS, TPM, UEFI, Secure
Boot), le profil matériel (`box/materiel/`, que la plateforme connaît) et la
version de l'installateur. Le **rapport d'usine** (une ligne par test,
`passe | echec | non_constate`) est recalculé par la plateforme contre les
`tests_obligatoires` du profil matériel : jamais cru sur parole ; un détail qui
porte un secret ou une donnée client est refusé (422).

## 7. Mises à jour, un seul updater

Les mises à jour publiées par `POST /controle/mises-a-jour` sont **signées**
(`iagent-maj-v1\n<composant>\n<version>\n<empreinte>`) ; composants `desktop`,
`os`, `skills`, `device`. Sur la Box, `iagent-updater` relève, vérifie
empreinte **et** signature, pose le `.deb`, contrôle la santé des services et
revient au `.deb` précédent sinon. L'updater Tauri se tait en édition Box sous
Linux (`mise_a_jour.rs`). Le A/B d'image (§32 du brief) attend `SYSTEM_B`.

## 8. Ce que le brief demande et qui n'est pas en Phase 0

| Brief | État |
|---|---|
| §17-§19 Agent Runtime, Browser Workspace Manager (8 profils, ACTIVE/IDLE/SUSPENDED) | absents (`SERVICES.json`) ; le desktop n'a qu'un profil de navigateur |
| §20 Vault | absent ; trousseau du système dans la session du kiosque |
| §21-§23 Connector Runtime, Application Router, App Bridge | hors Phase 0 |
| §24-§27 Voice Runtime, AI Router, Local AI Runtime | absents ; Piper Linux non posé |
| §34-§36 Backup, Restore, Factory reset sécurisé | procédure RMA seulement (`securite/rma.md`) |
| §37 Support distant (restart, logs, diagnostics…) | pas de route de commande ; télémétrie seule |
| §11 Secure Boot chaîne signée, §14 PKI/mTLS, §10 clés dans le TPM | non (`securite/pki.md`) |
| §47-§49 Burn-in, coupure, test navigateur | scripts/procédures, aucun résultat |

## 9. Contradictions avec le reste du dépôt (à trancher par max)

1. **La machine business.** `dimensionnement/offre-box.json` et
   `docs/offre-box.md` vendent une « Box Commandeur » Minisforum MS-01 (i9,
   32 Go) qui **ne fait tourner aucun agent** ; le brief nomme un BOSGAME M4 Neo
   (Ryzen 7 7840HS, 64 Go) qui fait tourner jusqu'à 8 agents. **Tranché par
   max le 11/10/2026 : la Box business de base a 64 Go** ; **depuis le 17/10, la
   Station fait foi** (SKU 32, 64, 64+, §3). Le brief fait foi pour
   `box/materiel/` ; `offre-box.json` n'est pas touché (il porte les prix de la
   boutique et `check-offre-box.ts` exige une source datée) et `docs/offre-box.md`
   le dit : sa ligne « Box Commandeur 32 Go » est dépassée sur la mémoire, à
   remplacer quand les Stations ont leur prix.
2. **« Commandeur » vs « Commander ».** Le dépôt dit les deux ; le brief et les
   plans tarifaires disent Commander. Ce document dit Commander.
3. **L'OS.** MASTER §6 : « Ubuntu Core si compatible, sinon Windows IoT » ;
   `docs/infra-localagent.md` : Debian 12 ; `offre-box.md` : « l'application
   desktop est une application Windows ». Décision : Ubuntu Server 24.04 (§4
   ci-dessus) ; `infra-localagent.md` est dépassé sur ce point.
4. **La Box exécute-t-elle des agents ?** `offre-box.md` dit non pour la
   Commandeur ; le brief dit 8 agents sur la Box business. En 0.1, elle exécute
   Desktop Commander (qui porte les agents) ; les runtimes séparés viendront.

## 10. Vérification

Tout ce qui est écrit ici est tenu par un banc ou dit « non constaté » :
`npm run controle` (dont `controle-box` et les cas usine de
`plateforme/controle/banc.ts`), le job `box` de `controles.yml` (shellcheck,
unittest, cargo test, SSR de l'écran, ISO à blanc), `build-linux-deb.yml`,
`build-factory-iso.yml`. La liste de ce qu'aucun banc ne voit est dans
[`box/README.md`](../box/README.md#non-constaté-à-lire-avant-de-promettre-quoi-que-ce-soit).
