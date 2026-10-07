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
| 6 | Protection, Control Plane | rien | Control Plane : provisioning, entitlements, révocation, mises à jour, télémétrie, audit | hébergement, choix de l'OS de la Box |
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

## Règles du socle

- Une entité se définit dans `plateforme/modele.ts` et nulle part ailleurs.
- Chaque module déclare ses routes dans `plateforme/<module>/routes.ts` et son
  banc dans `plateforme/<module>/banc.ts` (exporte `lancer(): Promise<number>`,
  le nombre de fautes). `npm run controle` les rejoue tous.
- Trois accès : `public`, `admin` (back-office), `box` (requête signée Ed25519
  par la Box). Un fournisseur extérieur (téléphonie, voix) qui n'a pas de clé
  posée refuse en disant ce qui manque, il ne fait jamais semblant d'avoir agi.
