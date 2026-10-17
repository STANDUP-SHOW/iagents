# Sécurité « Quantum-Ready » et Station Gen 1 (documents de max, 16/10/2026)

Deux documents remis par max le 16/10/2026, recopiés en texte :
`QUANTUM-READY-2026-10.txt` (« iAgent Quantum-Ready Security Architecture ») et
`STATION-GEN1-2026-10.txt` (« iAgent Station Gen 1 — Prototype propriétaire
complet »). Ce fichier dit ce qu'ils changent pour le code ; rien n'est encore
codé.

## 1. Quantum-Ready : ce qui touche le code

Le document ne met pas d'ordinateur quantique dans la Box. Il demande une flotte
**crypto-agile** : changer d'algorithme (vers ML-KEM, ML-DSA, SLH-DSA, normes
FIPS 203, 204 et 205) par une politique poussée par le Control Plane, sans
racheter le matériel ni réinstaller les Box.

**Où le dépôt est en défaut aujourd'hui.**

| Exigence | Dépôt | Écart |
|---|---|---|
| Aucun service ne code un algorithme en dur ; une seule couche « Crypto Provider » | Ed25519, X25519, HKDF-SHA256, AES-256-GCM et SHA-256 sont appelés directement dans `plateforme/controle/jeton.ts`, `scellement.ts`, `http.ts`, `box/services/identite-box`, `agent-device`, `updater`, `desktop/src-tauri/src/plateforme.rs` | à regrouper derrière une API (`signer`, `verifier`, `etablir_session`, `sceller`, `inventaire_crypto`) côté TypeScript et côté Rust |
| Chaque format signé dit son algorithme et son profil | `iagent-maj-v1` est versionné mais ne nomme pas l'algorithme ; la signature des requêtes de Box (`x-signature`) non plus | ajouter l'algorithme ou le profil dans chaque format signé, **avant** la première Box livrée |
| Signature de code séparée de l'identité ; PKI à racine hors ligne, AC intermédiaires (Device, Service, Code Signing, Agent) | **une seule clé**, `PLATEFORME_CLE_SIGNATURE`, signe les licences, les mises à jour et les Skill Packs | séparer au moins la clé de signature de code (mises à jour, Skills) de la clé des licences. **Ça ne coûte rien maintenant** : la plateforme n'a jamais été mise en ligne, la clé n'est pas encore tirée ; après, il faudrait migrer chaque Box |
| Double signature OTA classique + ML-DSA | une signature Ed25519 par mise à jour | passer `MiseAJour.signature` à une liste de signatures `{alg, valeur}` ; la Box exige celles que son profil impose |
| Profils CRYPTO-1 à 4 dans l'état voulu (`desired_state.security.crypto_profile`) ; Box non conforme → `NON_COMPLIANT` avec plan de remédiation, pas mise hors service | pas d'état voulu (voir `admin.md` §3 C) | la conformité est une dimension à part, comme la connexion, pas un état du cycle de vie |
| Hash SHA-384/SHA-512 | SHA-256 partout (empreintes de paquets, de fiches, `device_id`) | garder SHA-256 où il n'est qu'un identifiant ; ouvrir l'empreinte des artefacts signés à l'algorithme choisi par profil |
| Usine : qualifier aussi IOMMU, RNG, mise à jour du firmware ; test de poignée de main hybride ; rapport avec inventaire crypto et empreintes des composants ; la Box n'avance que si tout passe | inventaire sans crypto, ni IOMMU ni RNG ; le verdict recalculé tient déjà la dernière règle | nouveaux tests d'usine et champ `crypto` dans l'inventaire et le rapport |
| Sauvegardes chiffrées par des clés de données séparées des clés de device, chiffrement d'enveloppe, re-chiffrement des clés sans recopier les volumes | pas de sauvegarde (Phase 1) | à concevoir ainsi d'emblée |
| Écran « Cryptography » de l'Admin Box : profil, TLS, KEM, signature OTA, disque, identité, dernière rotation, conformité | — | quand l'Admin Box existe |
| SBOM par version, bibliothèques crypto épinglées, tests de rétrogradation, de révocation, de rotation massive, de flotte mixte | `Cargo.lock`, `package-lock.json` épinglent ; rien d'autre | à ajouter aux bancs |

**Ordre proposé.** P0 du document, dans l'ordre où ça coûte le moins tard :
1. Avant la première mise en ligne : clés séparées (licences ≠ signature de
   code), algorithme nommé dans chaque format signé, liste de signatures dans
   `MiseAJour`.
2. Avec le Control Plane v1 : profil crypto dans l'état voulu, inventaire crypto
   dans le battement, `correlation_id`.
3. Ensuite : la couche Crypto Provider, le pilote ML-KEM hybride, la double
   signature ML-DSA, l'écran Cryptography.

Non vérifié : quelles versions de Node, de workerd (Cloudflare) et des
bibliothèques Rust savent faire ML-KEM et ML-DSA ; à relever avant de promettre
le profil CRYPTO-2.

## 2. Station Gen 1 : ce que c'est, ce qui touche le code

Un **nouveau produit matériel** : un écran tactile 27" sur un bras, posé sur une
base qui contient le calculateur (carte du marché), un réseau de micros en champ
lointain avec DSP voix, deux haut-parleurs, et en option une carte iAgent
(alimentation, LED d'état, boutons marche / micro coupé / action iAgent,
ventilateurs, capteurs, connecteur de diagnostic d'usine). Le document décrit la
voie « propriétaire complète » pour la comparer à une « intégration simplifiée »
(document non reçu) et recommande : d'abord un EVT avec des modules du marché
dans une coque iAgent, puis décider quoi rendre propriétaire. **Aucune décision
de code n'est demandée maintenant.**

Ce que le logiciel devra porter le jour où la Station existe :
- un **type de machine** de plus dans le modèle (Box, Station, serveur de
  puissance, App Node), et un profil matériel qui sait décrire un écran, un
  réseau de micros, des boutons et des LED ;
- l'agent de la Box (`iagent-device`) lit le bouton « micro coupé » et pilote
  l'anneau de LED (états iAgent) ; la coupure du micro doit être matérielle ou,
  à défaut, constatée et remontée, jamais simulée ;
- des tests d'usine : micros en champ lointain, AEC, haut-parleurs, écran
  tactile, ventilateurs et températures, connecteur de diagnostic ;
- le numéro de série et l'étiquette suivent le même chemin que la Box.

## 3. Station : intégration simplifiée et dossiers fournisseurs (17/10/2026)

Trois documents de plus, recopiés en texte : `STATION-GEN1-INTEGRATION-2026-10.txt`
(« Intégration simplifiée »), `STATION-PACK-A-2026-10.txt` et
`STATION-PACK-B-2026-10.txt` (dossiers de consultation fournisseurs, en anglais),
plus le visuel des trois finitions. La voie retenue pour la V1 est l'**intégration
de modules du marché** dans une coque iAgent : carte compute Ryzen, SO-DIMM DDR5,
NVMe, module 4 micros champ lointain avec DSP (AEC, beamforming, AGC, réduction de
bruit, full duplex), ampli et deux haut-parleurs, écran 27" tactile capacitif,
bras OEM. Phases : EVT-0 (1), EVT-1 (2-3), pilote (10), PVT (50-100).

**Tranché par max le 17/10/2026 : la Station fait foi (SKU 32 / 64 / 64+), et
le profil se pose au provisioning sur une image commune.** Fait dans le code de
la branche `admin-master` : profils matériel `station-*`, profils `home`,
`business`, `enterprise`, une seule ISO, référence `IA-FR-STN-…`
(`docs/box-usine.md` §3). Le tableau ci-dessous garde l'état d'avant.

**Ce qui contredisait le dépôt.**

| Sujet | Documents Station | Dépôt (décision du 14/10) |
|---|---|---|
| Gammes | une seule machine pour tous ; SKU **Station 32** (32 Go, 1 To, Home / petite entreprise), **Station 64** (64 Go, 1 To, Business), **Station 64+** (64 Go, 2 To, Business intensif) ; profils HOME / BUSINESS / ENTERPRISE | Home Box 16 Go (EXR1), Pro Box 32 Go et Business Box 64 Go (BOSGAME M4 Neo) ; pas d'Enterprise, pas de 16 Go dans la Station |
| Profil de la machine | **même image d'usine pour tous**, le profil injecté au provisioning | une ISO par gamme (`construire-iso.sh --profil`) |
| Matériel | carte Ryzen d'un fournisseur à choisir (lot 1), pas encore nommée | profils `bosgame-m4-neo-v1`, `bosgame-m4-neo-pro-v1`, `exr1-home-v1` |
| Site (`main`) | « iAgent Station », « une dizaine d'agents par Box » | 1 / 4 / 8 agents selon la gamme |

**Ce que la Station demande au logiciel, quelle que soit la décision.**
- Tests d'usine nouveaux, dans l'ordre de l'écran du §13 : écran tactile 27",
  réseau de micros et DSP, AEC avec lecture, haut-parleurs gauche et droite,
  LED et bouton micro coupé, Ethernet et Wi-Fi, caméra (optionnelle) ; et les
  tests V1 du §14 (thermique 4 h, voix à 1/3/5 m et 360°, coupure USB, veille).
- L'anneau de LED dit l'état de l'agent : écoute (bleu/cyan), traitement
  (violet), réponse (vert), **rouge réservé au micro coupé**, ambre pour une
  erreur. `iagent-device` doit le piloter et lire le bouton micro coupé ; un
  micro coupé doit l'être vraiment, et l'être constaté.
- Un profil matériel `station-…` qui décrit écran, micros, haut-parleurs,
  boutons, LED, caméra, et le choix de la RAM et du SSD par SKU.
- Le provisioning qui pose le profil (HOME / BUSINESS / ENTERPRISE) sur une
  image commune, si max retient ce point : l'usine actuelle sait déjà enrôler,
  il faudrait déplacer le choix du profil de l'ISO vers le jeton d'usine ou
  l'attribution.
