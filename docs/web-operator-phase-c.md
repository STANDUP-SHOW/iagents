# iAgent Web Operator — Phase C, fondations (audit du 16 octobre 2026)

## Etat constate, branche main
- `desktop/src-tauri/src/navigateur.rs` : Tauri 2 WebviewWindowBuilder, profil persistant, ouverture/fermeture/declara­tion de sites ; aucune action DOM, aucun clic ni publication.
- `desktop/src/components/Navigateur.tsx` : UI des sessions declarees ; pas d'operateur.
- `desktop/src-tauri/capabilities/default.json` : seule la vue `main` a les permissions Tauri ; conserver l'isolement de la webview externe.
- `desktop/src-tauri/src/mcp.rs` : liste blanche d'outils par fiche, confirmation pour les outils qui ecrivent, quota, delai et arret. Il est appele depuis `repondre` et `executer_tache` de `main.rs`.
- `desktop/src-tauri/src/tache.rs` : `validationHumaine` suivant les reglages du client ; sortie generee sans publication. Ne pas confondre ce drapeau avec une approbation ponctuelle d'une action Web.
- `desktop/src-tauri/src/plateforme.rs` : licence et handoffs (contexte distinct des reprises d'actions web).

## Ce que contient cette PR
`desktop/src-tauri/src/web_operator.rs` : contrat strict, **sans action reelle**, pour une future execution.
- gestes types plutot que scripts arbitraires : observer, cliquer, renseigner, televerser, soumettre, publier, supprimer ;
- autorisations par origine exacte HTTPS et geste, sans sous-domaines implicites ;
- soumission/publication/suppression : empreinte SHA-256 hex du contenu et accord humain correspondant a l'operation, l'origine et le geste, non expire ;
- etats `Autorisee`, `AttenteHumaine`, `Refusee`, a transmettre au gestionnaire proactif existant ;
- tests de non-regression contre confusion de domaine, port different, schemas non web, mauvaise permission et accord reutilise.

Ce fichier **ne pilote pas** le navigateur. Aucun clic automatique ni extraction DOM en production ne decoule de cette PR. Ne pas pretendre que le probleme des inscriptions web est resolu.

## Suite technique, sans reconstruire l'existant
1. **Capacites reelles du moteur WebView** : confirmer Windows WebView2, macOS WKWebView, Linux WebKitGTK et ce qui est exposable de maniere sure en Rust. Le maintien du profil et des sessions est obligatoire.
2. **Pilote de lecture** : naviguer, observer URL/titre/DOM accessible/elements etiquetes/captures si compatibles, detecter les redirections et changements d'origine. Le contenu web est non fiable (prompt injection).
3. **Pilote d'actions** : element cible par identifiant ephemere emis par le pilote et limite au document/onglet actuel, pas de script arbitraire du modele, verification apres toute action, classification semantique des boutons submit/publish/delete.
4. **Permissions** : liste blanche par agent, profil et site. Aucune commande Tauri exposee aux pages visitees. La validation d'un envoi doit porter sur un contenu effectivement revu par l'humain et une intention precise. Les formulaires contenant des secrets et les moyens de paiement exigent une gestion specifique.
5. **Taches et persistence** : etats `en_cours`, `attente_humaine`, `reprise`, `fait_verifie`, `echec` ; checkpoint sur disque chiffre ou securise, idempotence pour ne pas inscrire/publier en double, expiration des references DOM, reprise apres fermeture navigateur.
6. **Supervision** : quotas, limites de temps, erreurs classees, trace redactee (sans cookies/passwords/tokens), bouton d'arret, notification d'intervention et rapport du soir via la mecanique proactive deja developpee.
7. **Conformite** : API officielles quand possibles, verifier les CGU de chaque plateforme, jamais contournement CAPTCHA/2FA/anti-bot. Un navigateur qui ressemble a un humain n'est pas une autorisation d'automatiser.
8. **Banc d'essai** : faux sites locaux consentis couvrant login simulé, multi-etapes, navigation, upload, redirection, 2FA simulée, echec reseau, popup et duplication, 100 executions repetables. Evaluer taux de succes et temps d'intervention avant pilotes tiers.

## Critere de livraison
Ne promouvoir la promesse commerciale « travaille dans votre navigateur » au sens d'actions autonomes que lorsque les tests d'integration et un pilote sur des services autorises ont demontre navigation + action + preuve de resultat + reprise.

## Remarques importantes pour revue
- La premiere version du contrat exige HTTPS pour les sites distants. Environnements de test localhost HTTP : declarer une exception explicite et limitee au contexte de tests, jamais en production.
- L'empreinte est fournie en entree ; le futur orchestrateur de confiance doit la calculer sur l'operation reelle, et **ne jamais accepter comme preuve une simple empreinte fournie par le modele**.
- La decision `Autorisee` ne prouve PAS que l'action a reussi. Le pilote devra verifier l'etat du site apres l'action.
- Le projet n'a pas ete compile dans cette session ; executer `cargo test web_operator` sur une machine preparee avec les dependances Tauri, et `npm run type-check` selon le workflow du depot.
