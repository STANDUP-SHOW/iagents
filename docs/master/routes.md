# Contrat des routes de la plateforme (à tenir par tous les chantiers)

Accès : `public`, `admin` (Bearer du back-office), `box` (requête signée par la
Box, voir `plateforme/serveur.ts`), `acteur` (jeton de session d'un acteur du
noyau, ou la clé de secours `PLATEFORME_ADMIN_SECRET` qui vaut le fondateur ;
voir `docs/admin/noyau.md`). Pour une route `box`, le tenant est
`ctx.box.tenant_id` : une Box ne voit jamais que son client. Toutes les réponses
sont du JSON ; une erreur est `{ "erreur": "<phrase en français>" }`.

## controle (Control Plane, §6, §7, §8)
| Méthode | Chemin | Accès | Rôle |
|---|---|---|---|
| POST | /controle/tenants | admin | créer un client `{nom, segment, pays, opt_in_skills}` |
| GET | /controle/tenants | admin | lister |
| POST | /controle/boxes | admin | provisionner à la main `{serial, gamme, identite_publique, cle_chiffrement_publique?, os, version_desktop}` → statut `stock`, `reference` attribuée (`IA-FR-HOME-…`, `IA-FR-PRO-…`, `IA-FR-BUS-00000127`, un compteur par gamme `home | pro | business`) ; `cle_chiffrement_publique` = clé X25519 brute de 32 octets en base64url, sans elle la Box ne reçoit aucun contenu de Skill |
| GET | /controle/boxes | admin | inventaire |
| GET | /controle/boxes/:id | admin | une Box |
| POST | /controle/boxes/:id/attribuer | admin | `{tenant_id, plan_id}` → `provisionnee` (depuis `stock` ou `qualifiee`) |
| POST | /controle/boxes/:id/statut | admin | `{statut, motif}` (stock, expediee, active, suspendue, restituee, remplacee) ; cycle : `usine → qualifiee → stock → provisionnee → expediee → active → suspendue | restituee | remplacee`, transitions dans `plateforme/controle/regles.ts` |
| POST | /controle/usine/jetons | admin | jeton d'usine `{operateur, lot?, tenant_id?, plan_id?, duree_h? (≤ 72), utilisations_max? (≤ 100)}` → `{jeton, expire_le, …}` ; le jeton n'est rendu qu'ici, la plateforme n'en garde que l'empreinte |
| GET | /controle/usine/jetons | admin | jetons émis, sans leur valeur |
| POST | /controle/usine/enroler | public | en-tête `x-jeton-usine` ; `{serial, gamme, identite_publique, cle_chiffrement_publique?, os, version_desktop, profil_materiel, inventaire, installateur}` → Box `usine` avec sa `reference` ; refusé si jeton inconnu, expiré ou épuisé (401), profil matériel inconnu de `box/materiel/` (400) ou ne servant pas la gamme (409), série ou clé déjà vues (409) ; la même demande renvoyée (même jeton, même série, même clé) rend la Box existante en 200, sans nouvelle référence ni utilisation du jeton |
| POST | /controle/box/usine/rapport | box | rapport d'usine `{serial, gamme, profil_materiel, inventaire?, installateur, operateur, commence_le, termine_le, tests:[{id, libelle, verdict: passe|echec|non_constate, duree_ms, detail}]}` ; la plateforme recalcule le verdict (aucun `echec`, tous les `tests_obligatoires` du profil `passe`) ; `passe` → `qualifiee`, puis `provisionnee` si le jeton d'usine portait client et plan ; `echec` laisse `usine` ; 409 hors `usine` ; 422 si un détail porte un secret ou une donnée client |
| GET | /controle/boxes/:id/rapports | admin | rapports d'usine de la Box |
| GET | /controle/boxes/:id/etiquette | admin | `{reference, device_id, gamme, serial, qr}` — ce qui va sur l'étiquette, rien d'autre (`qr` = la référence) |
| POST | /controle/entitlements | admin | `{tenant_id, device_id, agent_template_id, specialisation_id, licence, debut, fin}` |
| GET | /controle/entitlements | admin | `?tenant_id=` |
| POST | /controle/entitlements/:id/revoquer | admin | `{motif}` |
| GET | /controle/box/droits | box | droits actifs + `jeton` v2 signé par la plateforme : `expire_le` (24 h) et `grace_jusqu_au` (72 h, plateforme injoignable seulement) ; chaque droit porte `empreinte_fiche` (SHA-256 des octets exacts de la fiche) |
| POST | /controle/box/telemetrie | box | `{cpu, memoire, disque, temperature, version_desktop, versions?: {service: semver}}` ; une Box `expediee` passe `active` à sa première télémétrie |
| GET | /controle/box/mises-a-jour | box | versions visées pour cette Box, chacune avec `url`, `empreinte` et `signature` |
| POST | /controle/mises-a-jour | admin | publier `{composant: desktop|os|skills|device, version, canal, url, empreinte}` ; signée par la plateforme (503 sans `PLATEFORME_CLE_SIGNATURE`) |
| POST | /controle/skills | admin | déposer un Skill Pack (statut `candidat`) |
| POST | /controle/skills/:id/revue | admin | `{decision: en-revue|valide|rejete|retire, motif}` ; `valide` signe le pack (refusé sans `PLATEFORME_CLE_SIGNATURE`) |
| GET | /controle/skills | admin | tous |
| GET | /controle/box/skills | box | Skill Packs `valide` compatibles avec les agents de la Box : métadonnées, empreinte et signature, jamais le contenu en clair |
| GET | /controle/box/skills/:id/contenu | box | contenu chiffré pour CETTE Box : `{skill_pack_id, version, empreinte, signature, ephemere_publique, nonce, chiffre}` ; refusé si le pack n'est pas `valide`, si aucun droit actif de la Box n'y est compatible, ou si la Box n'a pas de clé de chiffrement |
| POST | /controle/box/skills/candidats | box | proposition terrain : refusée sans `opt_in_skills`, refusée si une donnée client est détectée |
| GET | /controle/compteur | public | `{metiers, profils, calcule_le}` calculé depuis le catalogue |
| GET | /controle/audit | admin | `?tenant_id=` |

Clé de signature des jetons et des Skill Packs : `PLATEFORME_CLE_SIGNATURE` (PEM
Ed25519) ; la clé publique se lit en `GET /controle/cle-publique` (public).

Formats (`plateforme/controle/jeton.ts`, `scellement.ts`, vecteurs figés dans
`plateforme/controle/temoins-signature.json`, rejoués par le Rust du desktop) :
- jeton = `<charge>.<signature>` en base64url sans remplissage, signature Ed25519
  sur les octets de la charge ; charge `{v: 2, device_id, tenant_id, cle_box,
  emis_le, expire_le, grace_jusqu_au, droits:[{id, agent_template_id,
  specialisation_id, licence, fin, empreinte_fiche}]}`. Un v1 est refusé.
  `verifierJetonLicence(jeton, clePubliquePem, deviceId, maintenant, injoignable)` :
  `injoignable` vrai seulement quand la plateforme n'a pas répondu du tout ; une
  réponse « suspendue », « restituée » ou « révoqué » (403, droits vides) ne
  relève jamais de la grâce.
- signature d'un Skill Pack : Ed25519 sur `iagent-skill-v1\n<skill_pack_id>\n<version>\n<empreinte>`.
- signature d'une mise à jour : Ed25519 sur `iagent-maj-v1\n<composant>\n<version>\n<empreinte>` ;
  la Box vérifie l'empreinte ET la signature avant de ranger le paquet (`box/services/`).
- chiffrement : X25519 éphémère à chaque appel × clé de la Box, HKDF-SHA256 (sel
  vide, info `iagent-skill-v1|<device_id>|<skill_pack_id>|<version>`, 32 octets),
  AES-256-GCM, nonce 12 octets, étiquette de 16 octets à la fin du chiffré,
  données associées = l'info.

## tarifs (§5, §12, §13)
| GET | /tarifs/plans | public | plans visibles `?segment=&region=FR&date=` |
| GET | /tarifs/plans/tous | admin | y compris masqués et anciens |
| POST | /tarifs/plans | admin | nouvelle version d'un plan (ferme la précédente, n'écrase jamais) |
| POST | /tarifs/devis | public | `{lignes:[{plan_id, quantite}], region, date}` → HT, TVA, TTC, détail |
| POST | /tarifs/cout-appel | admin | `{duree_s, provider_tel, provider_voix, jetons_llm, outils}` → téléphonie + voix + LLM + outils + marge |
| GET | /tarifs/export-site | public | même forme que `frontend/src/data/tarifs.json` |

Plans de départ (`plateforme/tarifs/plans.json`), identifiants fixes :
box-commander-36, box-commander-24, agent-essential, agent-professional,
agent-expert, task-commander, pack-starter, pack-team, pack-department,
pack-enterprise, voice-reception, voice-reception-pro, voice-support-center,
voice-sales-center, voice-enterprise, home-digital, home-agent, home-box,
home-family ; masqués `legacy_flag` : box-max, puissance-1, puissance-2,
puissance-3, agent-unique (9,90 €).

## voix (§10, §11, §12)
| PUT | /voix/profils/:id | admin | VoiceProfile |
| GET | /voix/box/session | box | `?persona=&mode=&langue=` → moteur choisi, voix, repli, motif |
| POST | /voix/numeros | admin | `{tenant_id, provider, e164?}` |
| GET | /voix/numeros | admin | `?tenant_id=` |
| PUT | /voix/standards/:id | admin | politique de routage (accueil, horaires, extensions, humains, règles) |
| POST | /voix/fournisseurs/:provider/entrant | public | webhook signé de l'opérateur |
| GET | /voix/appels | admin | `?tenant_id=` |
| GET | /voix/box/appels | box | historique, résumés, coûts |
| GET | /voix/box/handoffs | box | demandes de prise en main en attente |
| POST | /voix/box/handoffs/:appel | box | `{decision: prendre|refuser|rappeler|laisser}` |
| PUT | /voix/files/:id | admin | file d'attente (priorité, débordement, rappel) |
| POST | /voix/campagnes | admin | `{tenant_id, contacts, fenetres, pays, source_consentement}` |
| POST | /voix/campagnes/:id/lancer | admin | refuse tout contact sans consentement, sur liste d'opposition ou hors horaires |
| GET | /voix/box/consommation | box | minutes et coûts du mois |

## create (§9)
| GET | /create/opportunites | public | publiées `?date=` |
| GET | /create/opportunites/toutes | admin | brouillons compris |
| POST | /create/opportunites/generer | admin | brouillons du jour (moteur d'IA, clé requise) |
| POST | /create/opportunites/:id/publier | admin | |
| POST | /create/etudes | public | `{idee}` ou `{opportunite_id}` → étude à trois scénarios |
| GET | /create/etudes/:id | public | (identifiant non devinable) |
| POST | /create/box/projets | box | `{etude_id}` → entreprise composée : 5 phases, équipes du catalogue, budget, jalons |
| GET | /create/box/projets | box | |

## v1 (noyau de l'admin : ADMIN MASTER §3 à §12, `plateforme/noyau/`)
Une route `acteur` portant une permission répond 403 si l'acteur ne l'a sur
aucun périmètre ; le périmètre exact est revérifié sur la ressource. Toute
action qui change quelque chose passe par la passerelle (`POST /v1/actions` ou
ses raccourcis) : 200 exécutée, 202 en attente d'approbation, 403 refusée par
les règles, 422 échouée. `idempotence` et `motif` sont obligatoires ; l'en-tête
`x-correlation-id` est repris jusque dans l'audit. Contrat lisible par une
machine : `GET /v1/openapi.json` (OpenAPI 3.1).

| Méthode | Chemin | Accès | Rôle |
|---|---|---|---|
| POST | /v1/sessions | public | `{acteur_id, cle, code?}` → jeton (humain 12 h, agent 15 min, service 1 h) ; `code` = second facteur une fois activé ; un seul message de refus |
| GET | /v1/moi | acteur | qui je suis, mes rôles, second facteur ouvert ou non |
| GET | /v1/registre | acteur | rôles, permissions, catalogue des actions avec leur risque |
| POST | /v1/acteurs | acteur | core.actor.manage : créer `{type, nom_affiche, roles, autonomie?, budgets?, departement?}` ; la clé n'est rendue qu'ici |
| GET | /v1/acteurs | acteur | core.actor.manage : lister, sans clés |
| POST | /v1/acteurs/:id/statut | acteur | core.actor.manage : `{statut: actif|suspendu|retire, motif}` ; suspendre révoque les jetons |
| POST | /v1/moi/mfa | acteur | ouvrir le second facteur (TOTP, application d'authentification) |
| POST | /v1/moi/mfa/confirmer | acteur | `{code}` : le confirmer |
| GET | /v1/vue-ensemble | acteur | fleet.device.read : compteurs de la flotte, approbations et incidents ouverts |
| GET | /v1/devices | acteur | fleet.device.read : `?q&tenant_id&statut&connexion&gamme&apres&limite` (réponse `{elements, suivant}`), limité au périmètre de l'acteur |
| GET | /v1/devices/:id | acteur | fleet.device.read : une Box, sa connexion, sa santé, ses écarts ; jamais de clé |
| GET | /v1/devices/:id/desired-state | acteur | fleet.device.read : état voulu (versions, agents RUN/HOLD/STOP, politiques) |
| PUT | /v1/devices/:id/desired-state | acteur | fleet.device.desired.update : changer l'état voulu, par la passerelle |
| POST | /v1/devices/:id/commands | acteur | `{type, parametres, motif, idempotence}` → action de la passerelle (`restart_service`, `restart_box`, `update`, `factory_reset`…) |
| POST | /v1/devices/:id/diagnostics | acteur | raccourci du diagnostic (R1) |
| POST | /v1/agents/:id/pause | acteur | platform.agent.pause (R2) |
| POST | /v1/agents/:id/resume | acteur | platform.agent.resume (R2) |
| POST | /v1/agents/:id/suspend | acteur | platform.agent.suspend (R3) |
| POST | /v1/agents/:id/terminate | acteur | platform.agent.terminate (R3) |
| POST | /v1/actions | acteur | `{verbe, parametres, motif, idempotence}` |
| GET | /v1/actions | acteur | actions visibles par l'acteur |
| GET | /v1/approbations | acteur | core.approval.decide : boîte des approbations |
| POST | /v1/approbations/:id/decision | acteur | core.approval.decide : `{decision: approuve|refuse|clarification, note}` ; le demandeur ne tranche pas sa propre demande ; R4 = deux personnes |
| GET | /v1/evenements | acteur | core.event.read : `?apres=<seq>&type=` |
| GET | /v1/incidents | acteur | fleet.device.read : incidents |
| POST | /v1/incidents/:id/etat | acteur | core.incident.manage : `{etat, note}` |
| GET | /v1/audit | acteur | security.audit.read : journal, avec politique, risque, approbation, résultat, corrélation |
| POST | /v1/balayage | acteur | core.sweep.run : Box sans battement → hors ligne, commandes et approbations expirées, lettres mortes rejouées |
| POST | /v1/box/battement | box | `{uptime_s, sante?}` → `{prochain_dans_s}` (60 s ± gigue) |
| GET | /v1/box/etat-voulu | box | état voulu et sa version |
| POST | /v1/box/etat-reel | box | `{version_appliquee, reel}` → écarts, `convergee` |
| GET | /v1/box/commandes | box | commandes à exécuter (expirées écartées) |
| POST | /v1/box/commandes/:id/resultat | box | `{reussie, code, duree_ms, sortie}` ; idempotent, sortie caviardée |
| GET | /v1/openapi.json | public | le contrat |
