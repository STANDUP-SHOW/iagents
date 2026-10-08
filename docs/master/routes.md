# Contrat des routes de la plateforme (à tenir par tous les chantiers)

Accès : `public`, `admin` (Bearer du back-office), `box` (requête signée par la
Box, voir `plateforme/serveur.ts`). Pour une route `box`, le tenant est
`ctx.box.tenant_id` : une Box ne voit jamais que son client. Toutes les réponses
sont du JSON ; une erreur est `{ "erreur": "<phrase en français>" }`.

## controle (Control Plane, §6, §7, §8)
| Méthode | Chemin | Accès | Rôle |
|---|---|---|---|
| POST | /controle/tenants | admin | créer un client `{nom, segment, pays, opt_in_skills}` |
| GET | /controle/tenants | admin | lister |
| POST | /controle/boxes | admin | provisionner `{serial, gamme, identite_publique, cle_chiffrement_publique?, os, version_desktop}` → statut `stock` ; `cle_chiffrement_publique` = clé X25519 brute de 32 octets en base64url, sans elle la Box ne reçoit aucun contenu de Skill |
| GET | /controle/boxes | admin | inventaire |
| GET | /controle/boxes/:id | admin | une Box |
| POST | /controle/boxes/:id/attribuer | admin | `{tenant_id, plan_id}` → `provisionnee` |
| POST | /controle/boxes/:id/statut | admin | `{statut, motif}` (active, suspendue, restituee, remplacee) |
| POST | /controle/entitlements | admin | `{tenant_id, device_id, agent_template_id, specialisation_id, licence, debut, fin}` |
| GET | /controle/entitlements | admin | `?tenant_id=` |
| POST | /controle/entitlements/:id/revoquer | admin | `{motif}` |
| GET | /controle/box/droits | box | droits actifs + `jeton` v2 signé par la plateforme : `expire_le` (24 h) et `grace_jusqu_au` (72 h, plateforme injoignable seulement) ; chaque droit porte `empreinte_fiche` (SHA-256 des octets exacts de la fiche) |
| POST | /controle/box/telemetrie | box | `{cpu, memoire, disque, temperature, version_desktop}` |
| GET | /controle/box/mises-a-jour | box | versions visées pour cette Box |
| POST | /controle/mises-a-jour | admin | publier `{composant, version, canal, url, empreinte}` |
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
