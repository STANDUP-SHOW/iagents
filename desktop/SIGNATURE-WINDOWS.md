# Signer les installeurs Windows (Azure Artifact Signing)

Sans signature, Windows affiche « Windows a protégé votre ordinateur » et le
client doit cliquer « Informations complémentaires » puis « Exécuter quand
même ». La construction sait signer (`signature-windows.mjs`,
`build-windows-msi.yml`) ; elle ne le fait que lorsque les réglages ci-dessous
sont posés, et seulement sur une étiquette `v*`, pour ne pas consommer le quota
de signatures sur chaque PR. Tant qu'aucun réglage n'est posé, rien ne change.
S'il manque une partie des réglages, la construction échoue et nomme ce qui
manque, pour qu'on ne publie jamais une version non signée en la croyant signée.

**Ce que la signature ne fait pas :** elle ne supprime pas l'avertissement dès
le premier jour. Windows donne sa confiance au fil des téléchargements d'un
éditeur identifié. Depuis 2024, même un certificat EV n'y échappe plus
(Microsoft le dit dans sa réponse publique n° 5929307).

Coût : offre Basic, 9,99 $ par mois pour 5 000 signatures. Chaque version en
consomme quelques-unes.

## Ce que max remplit, dans l'ordre

1. **Un compte Azure** (portal.azure.com) avec un abonnement payant, à la
   carte. C'est sur lui que tombera la facture.
2. **Enregistrer le fournisseur** `Microsoft.CodeSigning` dans l'abonnement
   (Abonnements → Fournisseurs de ressources).
3. **Créer un compte Artifact Signing**, région Europe de l'Ouest, offre
   Basic. Noter son nom et son point de terminaison
   (`https://weu.codesigning.azure.net` pour cette région).
4. **Vérifier son identité** : sur ce compte, se donner le rôle « Identity
   Verifier » (ancien nom : Trusted Signing Identity Verifier), puis déposer
   une demande de validation **publique** en tant qu'**organisation** (société,
   avec SIRET et Kbis) ou en tant qu'**indépendant**. Le nom validé est celui
   que Windows affichera comme éditeur. Délai : de quelques heures à quelques
   jours.
5. **Créer un profil de certificat « Public Trust »** relié à cette identité
   validée. Noter son nom.
6. **Créer une inscription d'application** (Microsoft Entra ID → Inscriptions
   d'applications) avec un **secret client**. Sur le compte Artifact Signing,
   donner à cette application le rôle « Certificate Profile Signer » (ancien
   nom : Trusted Signing Certificate Profile Signer). C'est elle, et non max,
   qui signera depuis GitHub.
7. **Dans GitHub** (dépôt → Settings → Secrets and variables → Actions) :
   - secrets : `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
     (identifiants de l'application, et identifiant de l'annuaire) ;
   - variables : `IAGENT_SIGNATURE_POINT` (étape 3),
     `IAGENT_SIGNATURE_COMPTE` (étape 3), `IAGENT_SIGNATURE_PROFIL` (étape 5).
     Les deux noms ne contiennent que des lettres, des chiffres et des tirets.
8. **Publier une nouvelle version** (étiquette `v0.2.1` ou suivante). La
   construction installe `artifact-signing-cli` et signe l'application et les
   deux installeurs.

Le secret client ne se colle jamais dans une conversation ni dans le dépôt :
seulement dans les secrets GitHub.

## Ce qui n'est pas vérifié

- **Aucune signature n'a encore été faite.** La commande suit la documentation
  de Tauri (`v2.tauri.app/distribute/sign/windows`, lue le 25/09/2026) et le
  banc `check-mise-a-jour.ts` en vérifie la forme. Qu'elle fonctionne sur
  `windows-latest` (signtool, .NET) ne se saura qu'à la première version
  signée.
- Les libellés exacts des écrans d'Azure changent souvent : les étapes 3 à 6
  sont décrites d'après la documentation, pas relevées écran par écran.
