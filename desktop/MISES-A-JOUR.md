# Mises à jour automatiques des postes

Quand une nouvelle version est publiée, chaque poste la trouve, la télécharge,
vérifie qu'elle est bien signée par nous, puis l'installe **sans rien demander
au client**. Une barre de progression s'affiche quelques secondes, puis
l'application redémarre sur la nouvelle version.

**Un agent n'est jamais coupé en plein travail.** La version téléchargée attend
qu'aucune tâche ni réponse ne tourne, et qu'aucune n'ait tourné depuis deux
minutes. Pendant les quelques secondes de l'installation, un nouveau travail
est refusé avec un motif lisible (« recommencez dans une minute ») plutôt que
perdu. Le code : `src-tauri/src/mise_a_jour.rs`.

Le poste regarde une minute après le démarrage, puis toutes les quatre heures.

## Installer un poste

Avec l'installeur **NSIS** (`iagent-desktop-setup`, artefact du flux
« Build Windows MSI »), pas avec le MSI. Le NSIS s'installe pour l'utilisateur
et ses mises à jour ne demandent pas d'administrateur ; le MSI s'installe pour
toute la machine, et Windows demanderait une autorisation à chaque mise à jour.

## Préparer une fois (max)

1. Créer la paire de clés sur votre poste :
   `npx tauri signer generate -w ~/.tauri/iagent.key` (depuis `desktop/`).
   Choisir un mot de passe. **Garder le fichier et le mot de passe en lieu sûr :
   perdus, plus aucun poste ne pourra être mis à jour.**
2. Sur GitHub, dépôt `iagents` → Settings → Secrets and variables → Actions :
   - onglet **Secrets** : `TAURI_SIGNING_PRIVATE_KEY` (le contenu du fichier
     `iagent.key`) et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (le mot de passe) ;
   - onglet **Variables** : `IAGENT_MAJ_CLE_PUBLIQUE` (le contenu de
     `iagent.key.pub`) et `IAGENT_MAJ_ADRESSE` (l'adresse https du fichier
     `latest.json`, là où les mises à jour seront hébergées).

La clé privée ne va jamais dans le dépôt ni dans une conversation. La clé
publique et l'adresse ne sont pas secrètes.

## Publier une version

1. Étiqueter : `git tag v0.2.0 && git push origin v0.2.0`. Le numéro de
   l'étiquette devient celui de l'application.
2. Le flux construit l'installeur signé et dépose l'artefact
   `iagent-desktop-mise-a-jour` : `latest.json` et `iagent-desktop-0.2.0-setup.exe`.
3. Déposer ces deux fichiers à côté l'un de l'autre, à l'adresse de
   `IAGENT_MAJ_ADRESSE`. Les postes les trouvent à leur prochain regard.

## Ce qui est vérifié, et ce qui ne l'est pas

- Vérifié sous Linux le 24/09/2026 avec une clé d'essai : le poste trouve la
  version, la télécharge, la vérifie et la pose ; un paquet modifié d'un octet
  est refusé et l'application reste intacte.
- **Jamais essayé sous Windows** : l'enchaînement installeur NSIS, fermeture et
  relance n'a pas tourné sur une vraie machine.
- La signature ne couvre pas le numéro de version annoncé par `latest.json`
  (option `requireSignedVersion` du greffon) : la version 2.11 de l'outil Tauri
  ne l'écrit pas encore dans la signature. À allumer quand il le fera.
