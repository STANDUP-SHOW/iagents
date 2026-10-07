# MASTER développeur global (07/10/2026) : où en est chaque section

Texte de max recopié dans `MASTER-2026-10-07.txt` (document remis le 07/10 au
soir, « référence unique pour les prochaines implémentations »). Ce fichier dit,
section par section, ce qui existe déjà, ce que la branche `plan-global` ajoute
et ce qui ne peut se faire qu'avec max (un compte, un secret, un achat).

| § | Sujet | Déjà là avant le 07/10 au soir | Ajouté par `plan-global` | Reste à max |
|---|---|---|---|---|
| 1 | Principes | catalogue, fiches, filtres conservés ; prix lus dans `frontend/src/data/tarifs.json` (PR #38) | séparation données / logique / interface / Control Plane (`plateforme/`) | — |
| 2-3 | Offre et site Business | 11 pages du plan site (PR #38) | pages manquantes confiées au fil du site | fusion de #38 |
| 4 | Box | offre louée 69/89 € (PR #36, #38) | identité, santé, licences de la Box (`plateforme/controle`) | matériel, achat |
| 5 | Moteur de tarifs | `tarifs.json` (une version, un pays) | plans versionnés par pays, devise, fiscalité, dates (`plateforme/tarifs`) | prix définitifs |
| 6 | Protection, Control Plane | rien | Control Plane : provisioning, entitlements, révocation, mises à jour, télémétrie, audit ; fiches signées par le jeton de licence v2 (empreinte de chaque fiche) ; Skill Packs signés à la validation et chiffrés pour une seule Box (X25519, HKDF, AES-256-GCM) ; jeton à renouveler toutes les 24 h, grâce hors ligne de 72 h (plateforme injoignable seulement), révocation effective au renouvellement suivant (voir « §6 : fait et reste ») | hébergement, `PLATEFORME_CLE_SIGNATURE`, choix de l'OS de la Box, matériel (TPM, Secure Boot, disque chiffré, mTLS) |
| 7 | Skill Packs | rien | registre versionné, signé, circuit de revue, opt-in d'anonymisation | — |
| 8 | 180 000 profils | 182 490 postes comptés (PR #35) | compteur servi par la plateforme | — |
| 9 | iAgent Create | équipe levée de fonds (PR #32) | opportunités du jour, étude à trois scénarios, entreprise composée en 5 phases (`plateforme/create`) | — |
| 10 | Voice multi-moteur | voix locale Piper/whisper | abstraction VoiceProvider + registre de voix (Gemini Live, ElevenLabs, local) | clés des moteurs |
| 11-12 | Téléphonie, standard, centre d'appels | rien | PhoneProvider (Telnyx, Twilio, SIP), standard, extensions, transferts, prise en main humaine, files, campagnes avec consentement (`plateforme/voix`) | compte opérateur, numéros |
| 13 | iAgent Home | rien | site `home/` séparé, charte claire | domaine home.iagent.agency |
| 14 | Modules du Desktop | tableau de bord, embauche, équipe, machine | Workforce, Voice, Create, Box, Validations, Consommation, Sécurité | — |
| 15 | Back-office | rien | `back-office/` sur les routes `admin` de la plateforme | — |
| 17 | Modèle de données | éparpillé | `plateforme/modele.ts`, seul endroit | — |
| 18 | Sécurité | coffre du système, refus en français | isolation par tenant, signature des Box, audit, aucun secret journalisé | — |

## §6 : fait et reste

Fait par la plateforme (`plateforme/controle/`, banc dans `npm run controle`) :
- identité de la Box : clé Ed25519 enregistrée au provisioning, chaque requête signée ;
- droit d'exécution = client + Box + agent + spécialisation + licence, révocable ;
- fiches signées : le jeton de licence (Ed25519, v2) porte pour chaque droit le
  SHA-256 des octets exacts de la fiche ; une fiche modifiée d'un octet ne
  correspond plus ;
- Skill Packs signés à la validation, et chiffrés pour UNE Box (X25519 éphémère à
  chaque livraison, HKDF-SHA256, AES-256-GCM lié au device_id, au pack et à la
  version) : une autre Box ne déchiffre pas, un octet changé fait échouer GCM ;
- licence : renouvellement attendu toutes les 24 h (`expire_le`), grâce hors
  ligne de 72 h (`grace_jusqu_au`) seulement si la plateforme ne répond pas du
  tout ; une révocation ou une suspension joue au renouvellement suivant, donc
  dans les 24 h pour une Box en ligne, et au plus tard à 72 h pour une Box
  coupée du réseau.
- édition « Box » de l'application, fixée à la construction : avec
  `IAGENT_EDITION=box`, une machine non reliée ne fait travailler aucun agent
  (l'édition libre, elle, redevient un poste ordinaire si l'on efface
  `config/plateforme.json`). `IAGENT_PLATEFORME_URL` et `IAGENT_CLE_PLATEFORME`
  (PEM, `\n` accepté) y compilent l'adresse et la clé de la plateforme : un
  fichier effacé ou réécrit vers un autre serveur les retrouve telles qu'en
  usine. Ça ne protège pas d'un utilisateur qui remplace l'exécutable ; c'est
  le rôle du verrouillage en usine ci-dessous.

Reste au matériel et à l'hébergement (rien de ceci n'est fait ni simulé) :
- TPM 2.0 : la clé privée Ed25519 et la clé X25519 de la Box doivent y naître et
  ne jamais en sortir (« clés non exportables ») ; aujourd'hui rien ne le
  garantit côté Box ;
- Secure Boot et OS signé ;
- disque chiffré (lié au TPM) ;
- mTLS vers le Control Plane, posé chez l'hébergeur devant le serveur ;
- la clé `PLATEFORME_CLE_SIGNATURE`, à générer et garder hors du dépôt (un HSM
  ou le coffre de l'hébergeur la rendrait non exportable côté plateforme aussi).

## Règles du socle

- Une entité se définit dans `plateforme/modele.ts` et nulle part ailleurs.
- Chaque module déclare ses routes dans `plateforme/<module>/routes.ts` et son
  banc dans `plateforme/<module>/banc.ts` (exporte `lancer(): Promise<number>`,
  le nombre de fautes). `npm run controle` les rejoue tous.
- Trois accès : `public`, `admin` (back-office), `box` (requête signée Ed25519
  par la Box). Un fournisseur extérieur (téléphonie, voix) qui n'a pas de clé
  posée refuse en disant ce qui manque, il ne fait jamais semblant d'avoir agi.
