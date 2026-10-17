# iAgent — E-mail Studio Enterprise / Version 4

## Livraison

Prototype **fonctionnel en HTML/CSS/JavaScript natif**, sans framework, sans dépendance npm. Il comprend **10 templates distincts**, un logo officiel extrait du visuel iAgent fourni par le fondateur, une bibliothèque de cartes métiers et les références visuelles approuvées.

Ouvrir `index.html` dans un navigateur récent pour tester l'éditeur. Idéalement, servir tout le dossier via le serveur local du développeur (par exemple `python -m http.server 8080`, puis `http://localhost:8080`). Conserver les chemins et les fichiers `index.html`, `studio.css`, `data.js`, `studio.js` et `assets/`.

**Aucun envoi d'e-mail n'est effectué.** Le navigateur prépare le HTML, le texte brut et la configuration JSON. L'envoi exige un raccordement du CRM et du service de messagerie, avec vérification humaine.

## 1. Les modèles disponibles

| Code | Famille | Contenu principal |
|---|---|---|
| investisseur-prestige | Investisseurs | Entreprise, trois scénarios de levée, liens documentaires |
| investisseur-vision | Investisseurs | Recrutement de collaborateurs IA, architecture locale/cloud/hybride |
| prospection-metier | Acquisition B2B | Message par métier + 3 portraits/fiches métiers |
| cercle-50 | Acquisition B2B | Programme d'entreprises pilotes + sélection agents |
| marketing-decouverte | Marketing | Catalogue, trois agents, bénéfices métiers |
| marketing-campagne | Marketing | Annonce/campagne éditable, argumentaires, agents |
| bienvenue | Client | Welcome, étapes, agents suggérés |
| activation | Client | Activation, logiciels, Box/Desktop, étapes |
| relance-demo | Relance | Suivi d'un premier contact / invitation démo |
| a-propos | Institutionnel | Vision de collaborateurs numériques et déploiement hybride |

Les directions validées par l'utilisateur sont conservées sous `refs/`. Les e-mails ne sont pas des captures de ces maquettes : ils en réinterprètent la hiérarchie dans une structure de tableaux HTML compatibles e-mail. Le contenu reste entièrement modifiable.

## 2. Parcours utilisateur

1. Choisir le template depuis la bibliothèque à gauche.
2. Onglet **Message** : éditer l'objet, le pré-en-tête, le titre, l'introduction, et surtout le **bloc "Message personnel"**, qui apparaît après le bandeau d'introduction dans chaque template. Le message accepte les sauts de ligne.
3. Onglet **Destinataire** : prénom, entreprise, activité et e-mail pour référence CRM. Champs dynamiques disponibles : `{{prenom}}`, `{{entreprise}}`, `{{secteur}}`, `{{signature}}`.
4. Onglet **Agents & liens** : sélectionner ou non les agents officiels du secteur, ajouter jusqu'à cinq liens de documents investisseurs.
5. Onglet **Signature & marque** : email réponse, signature, URL de logo, URL de symbole, pied légal, désinscription.
6. Prévisualisation responsive Desktop/Mobile ; exporter HTML, TXT ou sauvegarder JSON.
7. Relire le message et vérifier tous les liens **avant** validation CRM.

Le bouton **Charger le texte du modèle** réinsère des textes préécrits : aucune API LLM n'est appelée dans cette version. Un moteur IA pourra préparer les champs éditables à partir de la fiche prospect sous supervision.

## 3. Assets et compatibilité e-mail

`assets/iagent-logo-officiel.png` = **vrai logo multicolore fourni par l'utilisateur**, horizontal et transparent, à placer sur fond bleu nuit.

`assets/iagent-embleme.png` = déclinaison emblème.

`assets/portrait-maquette-{1,2,3}.jpg` = images de **simulation de maquette uniquement**, issues du visuel validé, utilisées comme secours en prévisualisation hors ligne. **Ne pas les diffuser comme photos des agents réels.**

Les fiches métiers ont des URLs de portrait provenant du domaine public iagent.agency (`/portraits/agents/...webp`). Pour un envoi professionnel, prévoir une galerie media/CDN convertissant les portraits en JPEG/PNG (WebP pas universel en messagerie), avec URL absolue publique HTTPS. Prévoir également un alt text et une variante sans images.

Avant tout envoi, héberger les deux PNG officiels, puis renseigner `logoUrl` et `emblemUrl`. **Les chemins locaux `assets/...` inclus dans les brouillons HTML téléchargés ne sont pas adaptés à un envoi Gmail/Outlook tant que les URLs publiques ne sont pas configurées.**

Définir une largeur e-mail cible de 650px. Le HTML utilise des tableaux de présentation, des styles inline, un pré-en-tête masqué et une version TXT alternative. Tester sur Gmail Web/Mobile, Outlook Desktop/365, Apple Mail et smartphones : un client e-mail peut simplifier les gradients/espacements. Pour une compatibilité Outlook strictement pixel-perfect, intégrer les adaptations VML/ESP côté backend.

**Ne pas envoyer les images de maquettes `refs/` comme e-mails** : elles représentent des pistes créatives et ne contiennent pas de liens HTML fonctionnels.

## 4. Contrat d'intégration à l'agence commerciale

Le studio expose :

```javascript
window.IAGENT_EMAIL_STUDIO.getDraft() // {template, sector, agents, fields}
window.IAGENT_EMAIL_STUDIO.getHtml()  // HTML généré, sans JavaScript
window.IAGENT_EMAIL_STUDIO.getText()  // version texte de secours
```

Il est recommandé de transférer le JSON de campagne côté API serveur :

```http
POST /api/sales/email-drafts
Content-Type: application/json

{
  "template":"prospection-metier",
  "sector":"immobilier",
  "recipientId":"crm_12345",
  "fields":{"subject":"...","customMessage":"..."},
  "agents":["estimation","transaction","dossier"]
}
```

Le serveur doit **recalculer** les valeurs de fusion et les liens depuis ses données de confiance, puis générer une version HTML et une version text/plain (multipart/alternative). Les données fournies dans le navigateur ne doivent jamais autoriser un envoi sans règles serveur.

### Option génération IA (phase suivante)

- Un agent rédacteur prépare un **brouillon JSON strict** avec `subject`, `preheader`, `headline`, `intro`, `customMessage`, `ctaText`.
- Ajouter des champs CRM tels que métier, poste, outils utilisés, pain points *effectivement vérifiés*, contexte commercial et historique de contact autorisé.
- Interdire les faits inventés sur l'entreprise, les remises non approuvées, les promesses d'autonomie non démontrées, et les témoignages fictifs.
- Restreindre la sélection des agents à l'API catalogue métier et aux modules réellement disponibles.
- Réviser, prévisualiser et approuver avant envoi.

## 5. Mise en production indispensable

1. Déployer l'application dans le back-office Sales Center d'iAgent, avec authentification et rôles.
2. Connecter un endpoint `/agents?sector=...` pour remplacer les profils de démonstration par **les enregistrements catalogue réels** : id, nom, rôle, compétences, image JPG/PNG, fiche URL, statut opérationnel.
3. Lier les fiches CRM et les variables de personnalisation, avec journal d'audit et contrôles d'accès.
4. Connecter l'hébergement sécurisé des documents et les droits d'accès de data room pour les investisseurs. Préférer un lien unique sécurisé et temporaire aux documents sensibles.
5. Ajouter un vrai circuit d'approbation et une file d'envoi avec SPF, DKIM, DMARC, gestion des erreurs/bounces, fréquence limitée et désabonnement.
6. Vérifier les règles RGPD de prospection, les éventuelles bases légales de B2B, l'opposition, la gestion des consentements lorsqu'ils sont requis et les informations légales.
7. Tester les e-mails complets dans les messageries destinataires avant mise en service.

Les captures d'écran des tests sont fournies pour validation graphique, mais **la délivrabilité réelle et la compatibilité sur les différents fournisseurs ne sont pas encore auditées**.

## 6. Exactitude commerciale

Les fonctionnalités présentées (appel, réseaux sociaux, contrôle vocal, fonctionnement local/cloud, connexion logicielle) doivent être configurées et vérifiées selon le client et le module. Ne pas envoyer d'affirmations globales comme si chaque fonctionnalité était déjà opérationnelle pour tout le catalogue. Les 500 K€, 3,5 M€ et 12 M€ sont **trois scénarios de levée alternatifs**, et non trois tours simultanés acquis. Aucun taux de conversion ou chiffre d'affaires du pilote n'est présenté comme réalisé.

**Ce package est un prototype de génération testable, prêt pour adaptation par un développeur — ce n'est pas un système de routage e-mail déjà installé dans iAgent.**
