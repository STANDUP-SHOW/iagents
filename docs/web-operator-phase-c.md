# iAgent Web Operator — Phase C, fondations (audit du 16 octobre 2026)

## Etat constate, branche main
- `desktop/src-tauri/src/navigateur.rs` : Tauri 2 WebviewWindowBuilder, profil persistant, ouverture/fermeture/declara­tion de sites ; aucune action DOM, aucun clic ni publication.
- `desktop/src/components/Navigateur.tsx` : UI des sessions declarees sur main ; analyse structurelle ajoutee par cette PR.
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

Le contrat d'autorisations lui-meme **ne pilote pas** le navigateur. La lecture structurelle est apportee par l'etape 2 ci-dessous ; aucune action de formulaire n'est encore activee.

## Etape 2 ajoutee — Lecture structurelle de la WebView existante

Fichiers :
- `desktop/src-tauri/src/web_operator_snapshot.js` : script **constant**, execute par le backend, extraction limitee des titres et elements interactifs (50 maximum), sans valeurs, mots de passe, cookies, HTML brut ou contenu des e-mails.
- `desktop/src-tauri/src/web_operator_observation.rs` : `navigateur_observer` utilise `WebviewWindow::eval_with_callback`, disponible sur Tauri 2.11.5 (version verrouillee par Cargo.lock). L'execution est limitee a huit secondes et 32 Kio de reponse. Controle de l'origine avant et apres lecture, site HTTPS declare, port standard, limites sur les champs retournes. Tests unitaires de la logique pure.
- `desktop/src-tauri/src/main.rs` : declare le module et la commande Rust accessible seulement depuis l'interface Tauri autorisee.
- `desktop/src/components/Navigateur.tsx` : bouton d'analyse de la page ouverte et affichage du resultat dans « Vos comptes ».

**Ce que cela ne fait pas** :
- aucune connexion automatique, aucun clic, aucun remplissage, aucun televersement, aucune publication ;
- aucune exposition directe d'IPC Tauri aux sites externes ;
- pas encore de connexion de `navigateur_observer` au moteur d'outils MCP des agents (controle d'acces par agent a brancher) ;
- pas de lecture des iframes cross-origin, du Shadow DOM ferme, des formulaires rendus dans des canvas, des pages refusant l'evaluation JS ;
- pas de validation terrain Windows/WebView2 : l'API Tauri est disponible, mais le comportement reel doit etre eprouve par compilation et essai.

**Mode operatoire pour revue** :
1. Compiler `desktop` sur Windows puis lancer l'application.
2. Ouvrir le navigateur et se connecter a un compte de test avec un formulaire non sensible.
3. Declarer exactement ce site depuis « Vos comptes ».
4. Cliquer « Analyser la page ouverte » ; verifier titres, boutons et champs, sans leurs valeurs.
5. Aller sur un autre domaine non declare, puis refaire la lecture : elle doit etre refusee.
6. Reessayer avec une page ayant un champ mot de passe et des valeurs saisies : aucun de ces contenus ne doit etre renvoye.
7. Tester les changements de page rapides, pages lentes, erreurs de lecture et fermeture de la WebView pendant la demande.

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
- Valider le resultat CI sur la PR, puis tester sur une vraie machine Windows : les tests de logique pure ne prouvent pas la capacite effective de WebView2 a extraire la structure.
