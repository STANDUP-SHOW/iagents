# box/ — iAgent Box Factory Installer

La chaîne de fabrication logicielle des Box (brief de max du 11/10/2026) : une
clé USB qui transforme un mini-PC neuf en appliance iAgent sécurisée, identifiée,
administrable à distance, testée, et prête à attribuer à un client — sans que la
personne de l'atelier ait à connaître Linux. La spécification complète, les
décisions et les contradictions avec le reste du dépôt sont dans
[`docs/box-usine.md`](../docs/box-usine.md).

```
Mini-PC neuf → clé Factory (ISO) → autoinstall Ubuntu 24.04 (EFI/SYSTEM_A/SYSTEM_B/RECOVERY/DATA chiffrée)
→ services iAgent (.deb) → durcissement → TPM → premier démarrage en MODE USINE
→ enrôlement (jeton d'usine) → tests Python → rapport signé → plateforme : qualifiee
→ stock → attribuée → expédiée → active à la première télémétrie chez le client
```

## Ce qu'il y a ici

| Dossier | Contenu | Banc |
|---|---|---|
| `materiel/` | profils matériel (JSON) : `bosgame-m4-neo-v1`, `exr1-home-v1`, `vm-qemu` ; `index.ts` les sert à la plateforme | `check-materiel.ts` |
| `profils/` | les deux profils d'OS, `business` et `home` (la gamme de `plateforme/modele.ts`) | `check-profils.ts` |
| `os/base/paquets.txt` | LA liste apt d'iAgent OS | `check-autoinstall.ts` |
| `os/systemd/` | 11 unités `iagent-*` + timer ; `SERVICES.json` dit lesquelles sont réelles | `check-systemd.ts` |
| `os/durcissement/`, `os/kiosque/` | nftables sortant seul, sysctl, journald, aucun compte ; cage + cog / cage + iagent-desktop | `check-systemd.ts` |
| `services/` | Rust : `identite-box` (signature partagée), `iagent-device`, `iagent-updater`, `iagent-watchdog` ; `absent/` le refus des services non livrés | `cargo test` (job `box`) |
| `usine/autoinstall/` | `user-data` (subiquity), `tard/*.sh` (services, durcissement, TPM, mode usine) | `check-autoinstall.ts` |
| `usine/tests/` | tests d'usine Python (stdlib), `lancer.py`, `rapport.py`, schéma et témoins du rapport | `test_usine.py`, `check-rapport-usine.ts` |
| `usine/ui/` | l'écran opérateur (React, statique), servi par `iagent-device usine` | `npm run banc` (SSR) |
| `usine/iso/` | `construire-iso.sh`, `essayer-qemu.sh`, `grub.cfg`, `source.json` (ISO Ubuntu épinglée), `manifeste.ts` | `check-manifeste.ts`, `--verifier` en CI |
| `usine/rodage/` | rodage 24 h / 72 h, procédure de coupure de courant | — |
| `securite/` | LUKS + TPM, RMA, PKI : conçu, écrit, non constaté | — |

Côté plateforme : `plateforme/controle/routes.ts` (jetons d'usine, enrôlement,
rapport, étiquette, télémétrie étendue, mises à jour signées),
`plateforme/modele.ts` (`StatutBox`, `InventaireBox`, `JetonUsine`,
`RapportUsine`, `MiseAJour`), contrat dans `docs/master/routes.md`. Côté
back-office : écran « Usine », rapports et étiquette sur la fiche d'une Box.

## Commandes

```bash
npm run controle-box                                  # les six bancs TypeScript de box/
python3 -m unittest discover -s box/usine/tests -v    # règles pures des tests d'usine (Linux/mac : python3)
cargo test --manifest-path box/services/Cargo.toml    # les services Rust
npm --prefix box/usine/ui install && npm --prefix box/usine/ui run banc   # l'écran opérateur en SSR
box/usine/iso/construire-iso.sh --profil business --sortie dist --verifier   # l'arbre de l'ISO sans télécharger Ubuntu
```

Tout ceci tourne dans `controles.yml` (jobs « Contrôle des données » et « Box »).
Les `.deb` sortent de `build-linux-deb.yml`, l'ISO de `build-factory-iso.yml`
(à la main ou sur une étiquette `box-v*`).

## Fabriquer une Box (atelier)

1. Dans le back-office, écran **Usine** : émettre un jeton d'usine (opérateur,
   lot, client et plan si la Box est déjà vendue). Le jeton n'est montré qu'une
   fois : le coller dans un fichier.
2. Construire l'ISO du profil voulu avec ce jeton et l'adresse de la plateforme :
   `construire-iso.sh --profil business --paquets dist/ --plateforme https://… --jeton-fichier jeton.txt --sortie dist/`
   (ou lancer `build-factory-iso.yml` puis ajouter le jeton : à outiller).
3. Graver l'ISO sur une clé, brancher la Box, Ethernet, démarrer sur la clé :
   l'installation part seule en 3 secondes et **efface le disque**.
4. Au redémarrage, l'écran d'usine : vérifier l'appareil détecté, choisir la
   machine, saisir son prénom, **INSTALLER**. Attendre **PRÊTE À EXPÉDIER**.
5. Exporter le rapport (USB), imprimer l'étiquette depuis la fiche de la Box
   au back-office (QR = la référence `IA-FR-BUS-00000127`), mettre en carton.
   Imprimer la clé de secours (`securite/luks-tpm.md`) et l'effacer de la Box.

Au back-office la Box est `qualifiee` (ou `provisionnee` si le jeton portait un
client) ; `stock` après le rodage, `expediee` au départ, `active` quand elle
parle depuis chez le client.

## Essayer sans Box (VM)

```bash
sudo apt-get install qemu-system-x86 ovmf swtpm swtpm-tools xorriso
PLATEFORME_ADMIN_SECRET=… PLATEFORME_CLE_SIGNATURE=… npm run plateforme    # la plateforme sur l'hôte (port 8787)
box/usine/iso/construire-iso.sh --profil business --paquets dist/ --plateforme http://10.0.2.2:8787 --jeton-fichier jeton.txt --sortie dist/
box/usine/iso/essayer-qemu.sh dist/iagent-factory-installer-v0.1.0-business.iso
```

`10.0.2.2` est l'hôte vu de QEMU ; l'agent accepte `http://` pour cette adresse
et la boucle locale seulement. Le profil matériel à choisir à l'écran est
`vm-qemu`.

## Non constaté (à lire avant de promettre quoi que ce soit)

Au 11/10/2026, **rien de ce dossier n'a tourné sur une machine** : il a été écrit
sur un poste Windows sans Node, Rust ni Python, et n'est vérifié que par les
bancs de l'intégration continue. En particulier :

- l'ISO n'a jamais démarré (ni QEMU ni Box) ; `construire-iso.sh` rejoue les
  enregistrements d'amorçage de l'ISO Ubuntu, ce qui est la méthode documentée
  de xorriso, pas une méthode éprouvée ici ;
- le scellement LUKS au TPM, la clé de secours, Secure Boot : scripts écrits,
  jamais exécutés (`securite/luks-tpm.md`) ;
- cage + iagent-desktop sur un Radeon 780M, le trousseau sans gestionnaire de
  session, le son, le Wi-Fi, le Bluetooth : rien d'observé ;
- la pose réelle d'un `.deb` par `iagent-updater` et le retour arrière ;
- le moteur Piper sur Linux n'est pas posé par l'image : `iagent-voice` est
  déclaré absent ;
- les trois runtimes (agents, navigateur, voix) sont **absents** d'iAgent OS 0.1
  (`SERVICES.json`) : la Box exécute Desktop Commander, pas encore des services
  séparés ;
- le rodage (`rodage.sh`), la coupure de courant (`coupure.md`), le test de 8
  espaces de navigateur (brief §49) : procédures et scripts, pas de résultats ;
- la sauvegarde/restauration, la réinitialisation d'usine depuis le Control
  Plane, le séquestre de la clé de secours, le mTLS : Phase 1.
