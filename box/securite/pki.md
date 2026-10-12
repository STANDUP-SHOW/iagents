# Identité, certificats, mTLS (brief §12-§14)

## Ce qui existe

La Box a **sa propre clé Ed25519** et **chaque requête vers le Control Plane
est signée** (`x-box-id`, `x-horodatage`, `x-signature` ; `plateforme/http.ts`
vérifie, `box/services/identite-box` signe). Jamais de couple identifiant / mot
de passe (brief §14). Le `device_id` dérive de la clé publique : un disque
copié sur une autre machine avec une nouvelle clé est une autre Box, et avec la
même clé ce serait un vol de clé, pas une copie innocente. La plateforme signe
ce qu'elle rend (jetons de licence, Skill Packs, mises à jour) avec
`PLATEFORME_CLE_SIGNATURE`, dont la Box garde la clé publique dans
`/etc/iagent/device.json` depuis l'enrôlement.

## Ce que le brief demande en plus, et qui n'est pas fait

| Brief | État |
|---|---|
| Clé privée **dans le TPM** (non exportable) | Non : la clé est un fichier root 0600 sur `DATA` (chiffrée au repos par LUKS, donc liée au TPM indirectement). Les clés TPM-résidentes passent par tpm2-pkcs11 ou tpm2-openssl ; ring ne sait pas signer avec. À regarder quand une machine est là. |
| **CSR → PKI iAgent → certificat machine**, puis **mTLS** | Non : la signature de requête remplace le certificat pour l'instant (même garantie : la plateforme sait quelle Box parle). Le mTLS au niveau TLS demanderait une autorité de certification iAgent et des certificats serveur côté Cloudflare (mTLS Cloudflare Access) ; c'est un chantier d'infrastructure, séparé du code de la Box. |
| **Rotation de certificat** depuis le Control Plane | Non ; la rotation de la clé Ed25519 n'a pas de route (elle changerait le `device_id`, donc il faudrait une route « nouvelle clé signée par l'ancienne »). |

## Ce que l'usine fait quand même aujourd'hui

`iagent-device identite` crée la paire une fois ; `enroler` envoie la clé
publique avec le jeton d'usine ; la plateforme refuse une clé déjà vue (409) et
une clé privée envoyée par erreur (400, « ne doit jamais quitter la Box »). La
clé publique de la plateforme est relue à l'enrôlement ; l'updater refuse un
paquet dont la signature ne tombe pas juste.
