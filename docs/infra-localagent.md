# LocalAgent — Architecture infrastructure

**Statut:** Spécification MVP (validée Phase 0)  
**Date:** 2026-09-19  
**Révision:** 1.1 — corrigée le 2026-09-23 sur trois points que le code du dépôt
contredisait : la capacité d'un poste, les coûts, et une référence juridique
inexistante. Les sections marquées « Correction du 23/09/2026 » n'ont pas été
revalidées en Phase 0. **Tout ce qui est chiffré (machines, agents par boîtier,
coûts) se calcule et ne s'écrit pas ici** : voir `dimensionnement/` et
`docs/economie.md`.

---

## 1. Vue d'ensemble

LocalAgent = client Windows (Poste) + serveur Linux (Bundle) sur même réseau d'entreprise.

```
┌─ POSTE (Windows) ────────────────────┐
│                                       │
│  • Affichage (UI web / desktop app)  │
│  • Voix (micro/speaker)              │
│  • Authentification utilisateur       │
│  • Stockage : logs locaux seulement   │
│                                       │
│  ↓ TCP/WebSocket chiffré TLS         │
│  ↓ 192.168.x.x ou 10.x.x.x           │
│  ↓ Requêtes JSON                     │
│                                       │
└───────────────────────────────────────┘
        ↓
┌─ BUNDLE (Mini-PC Linux) ────────────┐
│                                      │
│  • Runtime agents (Python/Node)      │
│  • Moteur d'inférence local          │
│  • Base données locale (SQLite)      │
│  • Orateur logs (audit trail)        │
│  • Cache conversationnel              │
│  • Résilience (queue persistante)    │
│                                      │
│  ↑ Appels API Anthropic optionnels  │
│  ↑ (20% executions + API fallback)  │
│                                      │
└──────────────────────────────────────┘
```

---

## 2. Réseau

### Topologie
- **Poste** : machine Windows 10/11 de l'utilisateur (portable ou bureau)
- **Bundle** : mini-PC Linux (Firebat AM02, Radeon 780M, 16 Go RAM) sur même sous-réseau
- **Connexion** : Ethernet ou Wi-Fi LAN, NOT Internet public

### Protocole
- **Transport** : WebSocket over TLS 1.2+
- **Authentification** : Certificat autosigné (MVP) + clé symétrique stockée sur Poste au 1er démarrage
  - Poste génère clé 256-bit AES → l'écrit chiffré avec mot de passe local → l'envoie une fois au Bundle (HTTPS POST, timeout 30s)
  - Bundle la chiffre avec sa clé matérielle → l'écrit en `/etc/localagent/client.key` (lecture seule root)
  - Poste oublie la clé en mémoire (volatility)
  - Réappairage demande accès physique à la Poste (GUI confirmation) — anti-theft

### Redondance & résilience
- **Poste ↔ Bundle offline** : Poste met en queue les requêtes (localStorage IndexedDB), rejeu au retour
  - Queue max 1 Go (soit ~50 conversations × 20 Mo)
  - Si queue pleine, les plus anciennes tombent
  - Timestamp et hash (SHA-256) de chaque msg pour dédupliquer rejeu
- **Bundle offline** : impossible localement. Redémarrage Bundle = recapture depuis queue Poste
- **Bundle disk full** : agents refusent nouvelles conversations, logs écrivent en circular (4 derniers jours gardés)
- **Bundle saturé (CPU/GPU)** : file d'attente agent, exécutions retardées jusqu'à 1h, refus après 1h
- **API Anthropic down** : agents en mode "local only" (Haiku/Sonnet via inférence si modèle disponible, sinon refuse)

### Bande passante estimée
- 1 conversation = ~20 Ko (input + output logs)
- 1 poste × 5 agents × 10 conv/jour = 1 Mo/jour
- Plusieurs postes sur même Bundle : multiplier par nombre postes (réseau LAN ≤ 100 Mbps suffit)

---

## 3. Données

### Stockage Poste
- **Authentification** : mot de passe hash bcrypt, salt local
- **Clé réseau** : chiffré avec mot de passe
- **Cache conversations** : IndexedDB (non chiffré, accès local seulement)
- **Zéro données métier** en local (tout passe par Bundle → logs centralisés)

### Stockage Bundle
- **SQLite** : `/var/lib/localagent/data.db`
  - Table `users` : id, nom, poste_ip, clé_publique, créé_le, last_seen
  - Table `conversations` : id, user_id, agent_id, messages (JSON), tokens, coût_api, créé_le, fermé_le
  - Table `audit` : id, user_id, agent_id, action, input, output, décision_human, timestamp
  - Table `jobs` : id, user_id, agent_id, status (queued/running/done/failed), entrée, sortie, tentatives, créé_le, fini_le
  - Index sur user_id, agent_id, timestamp pour requêtes rapides
- **Fichiers** : `/var/lib/localagent/output/`
  - Sortie agents (PDF, XLSX, MP3, etc.) triées par user_id/agent_id/date
  - Nettoyage automatique : garde les 180 derniers jours (RGPD)
- **Logs** : `/var/log/localagent/`
  - syslog format, rotation quotidienne, compressé après 7 jours, supprimé après 180 jours
  - Contient : erreurs, appels API, tokens consommés, authentifications échouées, rejets validation

### Chiffrement données au repos
- **SQLite** : chiffré avec SQLCipher, clé = hash(mot_de_passe_admin + salt_hardware)
  - Bundle redemande le mot de passe admin au boot (timeout 5 min sans, services arrêtés)
- **Fichiers sortie** : pas de chiffrement (confiance LAN)
- **Logs** : pas de chiffrement

### RGPD / Durée de rétention
- Conversations = 3 ans (légalement requis pour audit comptable)
- Logs = 180 jours (sécurité) + 3 ans pour audit comptable = 3 ans
- Sortie agent (PDF, factures) = 5 ans (comptabilité) défaut, paramétrable par agent
- **Droit d'oubli** : `DELETE FROM conversations WHERE user_id = ? AND created_le < NOW() - '3 years'`
  - Fichiers sortie correspondants supprimés aussi
  - Logs anonymisés (replace user_id avec UUID aléatoire)

---

## 4. Authentification & Accès

### 1er boot
1. Poste affiche QR code (chaîne Base64 : `{poste_uuid, poste_hostname, version}`)
2. Admin Bundle scanne QR ou rentre les paramètres via CLI SSH
3. Bundle crée entrée `users[0]` (admin), génère clé publique RSA 2048
4. Bundle affiche clé publique en base64
5. Poste stocke clé publique, génère sa clé AES, l'envoie chiffrée avec clé publique
6. Bundle enregistre clé AES en base de données, marque Poste « validée »

### Authentification utilisateur (login Poste)
- Poste : username + mot de passe local Windows (intégration NTLM/SSO optionnelle)
- Hash du mot de passe = salt client-side
- Envoyé au Bundle pour log (pas pour auth — auth est locale)
- Bundle regarde si `users[user_id].poste_ip == IP_requête` → autorisation

### Contrôle d'accès agent
- `User.agents_allowed` = liste des agent IDs permis (ex. `[AG-0026, AG-0036, AG-0046]`)
- Avant chaque exécution : vérifier user_id dans agent_id's ACL
- Refus → log audit + notification

### Multi-utilisateur
- Plusieurs users locaux sur même Poste : chacun isolé par Windows
- Partage Poste entre deux personnes : créer deux users separés, authentification SSO (Kerberos) si réseau AD, sinon mot de passe local
- Base de données Bundle isole par user_id (requêtes AND user_id = ?)

---

## 5. Validation humaine & Audit

### Profils de risque (PR-XX)
- **PR-00** (exécution libre) : génération texte, consultation données (pas d'action externe)
- **PR-01** (relecture post) : envoyer email, générer document (action non-irréversible)
- **PR-02** (approbation pré) : créer fiche client, débloquer crédit (action engagement)
- **PR-03** (multi-signature) : autoriser virement ≥ 50 k€, résilier contrat (action légale)
- **PR-04** (audit trail + admin review) : décisions C-level, changements politiques (audit obligatoire)

### Workflow validation
1. Agent génère sortie → test règles métier (ex. montant virement ≤ limite)
2. Si PR-00 → publier directement
3. Si PR-01+ → créer task d'approbation
   - Notification humain : email + dashboard
   - Humain consulte la Poste, lit la sortie → Approuver / Rejeter / Demander modification
   - Si Approuver → agent exécute (ex. envoyer email)
   - Si Rejeter → agent log + propose alternatives
   - Timeout approbation : 24h, alors refuse automatiquement (sauf PR-04 → demande escalade)
4. Audit trail stocke : qui, quand, quelle action, result

### Journal d'audit
```json
{
  "timestamp": "2026-09-19T14:32:15Z",
  "user_id": "alice_finance",
  "agent_id": "AG-0050-assistant-directeur-financier",
  "action": "genere_rapport_mensuel",
  "input": {"mois": "09", "devise": "EUR"},
  "output": {"fichier": "/var/lib/localagent/output/alice/report_09_2026.pdf", "pages": 42},
  "profil_risque": "PR-01",
  "approbation": {
    "demandé_le": "2026-09-19T14:32:15Z",
    "approuvé_par": "bob_cfo",
    "approuvé_le": "2026-09-19T15:00:00Z"
  },
  "tokens_sonnet": 12500,
  "tokens_haiku": 2300,
  "coût_api": 0.18,
  "erreur": null
}
```

---

## 6. Sécurité

### Menaces & mitigations

| Menace | Scenario | Mitigation |
|--------|----------|-----------|
| **Poste compromis (malware)** | Attaquant accède à clé AES locale | Clé chiffrée avec mot de passe, timeout Bundle 5 min |
| **Bundle compromis (hacker réseau)** | Attaquant lit base de données SQLite | SQLite chiffré SQLCipher, mot de passe admin au boot |
| **Interception réseau** | MITM capture WebSocket | TLS 1.2, certificat pinning Poste ↔ Bundle |
| **Replay attack** | Attaquant renvoie vieille requête | Nonce + timestamp, rejet si > 60s ou duplicata |
| **Injection SQL** | Agent écrit SQL malveillant | Parameterized queries, ORM (SQLAlchemy/TypeORM) |
| **Prompt injection** | Utilisateur pirate l'agent via entrée | Séparation champs structurés / texte libre, validation avant modèle |
| **Data exfiltration via agent** | Agent confiné, comment le limiter ? | Chaque agent tourne dans conteneur distinct (Docker/systemd-nspawn), no network access sauf Bundle |
| **API key leak (Anthropic)** | Clé API sur Poste ou Bundle | Clé gardée seulement sur Bundle, Poste appelle Bundle qui appelle API |
| **Réaction timing** | Attaquant déduit actions via latence | Normalisation temps réponse (+ bruit aléatoire ±500ms) |

### Policies

- **Pas d'accès sudo pour agents** : processus agent tourne en uid `localagent` (non-root)
- **Pas de shell interactif pour agents** : aucun `/bin/sh`, aucune exécution code utilisateur
- **Isolation filesystem** : chaque agent a read-only access à `/var/lib/localagent/agents/{agent_id}` et read-write à `/var/lib/localagent/output/{user_id}/{agent_id}/`
- **Pas de DNS external** : agents ne peuvent résoudre que `localhost` et Bundle hostname
- **Pas de sortie réseau** : sauf Bundle (sur port 7890) et optionnellement Anthropic API
- **Quotas ressource** : CPU (1 core), RAM (512 Mo), disk write (10 GB/jour par user), timeout 30 min/exécution

---

## 7. Infrastructure logicielle

### Stack Bundle
- **OS** : Linux Debian 12 (minimal)
- **Runtime agents** : Python 3.11 (FastAPI) ou Node.js 20 (Express)
- **BD** : SQLite 3 + SQLCipher extension
- **Inférence locale** : Ollama (Llama 2, Mistral) optionnel
- **Logs** : syslog + Prometheus (métriques optionnel)
- **Isolation** : Docker ou systemd-nspawn
- **Boot** : systemd, démarrage auto après reboot

### Stack Poste
- **OS** : Windows 10/11 ou macOS 12+
- **Runtime client** : Electron (desktop app) ou navigateur web (localhost:3000)
- **UI** : React.js
- **Stockage** : IndexedDB + localStorage
- **Requêtes réseau** : fetch/axios + retry logic

### Déploiement
- **Bundle** : Ansible playbook (provision mini-PC depuis clé USB)
- **Poste** : Installeur EXE/MSI (téléchargé depuis Bundle page setup)

---

## 8. Performance & Limits

### Scalabilité
- **1 Bundle** : jusqu'à 10 Postes (réseau LAN < 100 Mbps)
- **1 Poste : aucun agent.** Le poste porte l'application, le navigateur, la
  voix et les fichiers ; tout le calcul est dans le bundle (décision de Max du
  19/09/2026, appliquée par `kitClient()` et tenue par `check-dimensionnement`).
  Ce document disait « jusqu'à 5 agents par poste » : c'était faux deux fois,
  un poste n'en porte aucun et le bundle AM02 cité plus haut en porte **3**
  (postes de bureau, mesuré par `agentsParMachine`).
- **Combien d'agents par boîtier ne s'écrit pas à la main** : `npm run controle`
  le calcule depuis `dimensionnement/machines.json`, et
  `node --experimental-strip-types outils/packs.ts` le montre machine par machine.
- **Throughput** : 10 exécutions/sec si API local, 0.1 exec/sec si Anthropic API (quota)

### Latences
- **Poste ↔ Bundle** : < 50 ms (LAN)
- **Agent startup** : 1-2 sec (modèle chargé en RAM, cache chaud)
- **Tour IA** (Sonnet via API) : 5-15 sec (incluant latence réseau Anthropic)
- **Tour IA local** (Ollama Mistral) : 20-60 sec (faible qualité acceptée pour filtrage)

### Coûts

**Les coûts ne se calculent pas ici.** `dimensionnement/economie.ts` les calcule
par fiche et `docs/economie.md` publie la table des 1 249 ; `check-economie.ts`
refuse une table périmée. Les chiffres qui étaient écrits ici à la main étaient
faux, et la façon dont ils l'étaient est instructive : ils annonçaient **~5 €
contre ~50 € en API seule**, soit 10×, pour n'importe quel agent.

Ce que la mesure donne au 23/09/2026 :

- **Matériel** : bundle AM02 **271 €**, poste N150 **170 €** (et non 150),
  amorti sur 12 mois — prix indicatifs AliExpress, à confirmer sur les vraies
  machines avant toute promesse commerciale.
- **API résiduelle** : elle dépend des exécutions par mois de la fiche, que le
  calcul tire de la planification de ses tâches. La formule écrite ici
  (`20 % × 12 000 jetons × 0,000002 €`) ne comptait pas les exécutions du tout,
  donc ne pouvait donner qu'un ordre de grandeur sans rapport.
- **Électricité** : bundle 25 W × 24 h × 30 j = 18 kWh/mois × 0,25 € ≈ **4,50 €/mois**.
- **Le rapport réel** : le meilleur poste de bureau (secrétaire administratif,
  2 280 exéc./mois) fait **288 € en API seule contre 71 €** chez Local-Agent,
  soit **4,1×**. La règle des 3× de Max n'est tenue que par **136 fiches sur
  1 249** en bundle partagé (57 en comptant un poste par agent) : c'est une
  règle de charge, rien ne passe sous 26 appels/jour. Un agent peu sollicité se
  vend en mode API, pas avec du matériel.

---

## 9. Roadmap déploiement

### MVP (Phase 0 — 2-4 semaines)
- [ ] Runtime AG-0026 en Python (FastAPI)
- [ ] Bundle sur mini-PC test
- [ ] WebSocket TLS Poste ↔ Bundle
- [ ] Sqlite audit trail
- [ ] Frontend local pour visualiser
- **Test** : AG-0026 tourne 24h, logs audit, 0 erreur

### Phase 1 (4-8 semaines après)
- [ ] 5 agents tournant sur 1 Bundle
- [ ] Multi-Poste (2-3 clients)
- [ ] Load balancing intra-Bundle
- [ ] API Anthropic fallback (hybride local + API)
- **Test** : 5 agents × 5 Postes, coûts réels vs estimé

### Phase 2 (3-6 mois)
- [ ] 50+ agents testés en production
- [ ] Marketplace fiches (tiers vend fiches)
- [ ] SSO + Active Directory
- [ ] Backup/restore base données
- **Scaling** : 10 Bundles, 100+ Postes

---

## 10. Contrôle de conformité

### RGPD
- ✓ Audit trail par user_id
- ✓ Droit d'oubli (purge 3 ans)
- ✓ Portabilité (export JSON conversations)
- ✓ Minimisation données (Poste ne stocke rien)
- ⚠ Responsable données = Admin Bundle (configure durée rétention)

### Comptable (France)
- ✓ Traçabilité : audit trail signé timestamp
- ✓ Immuabilité : logs append-only (jamais overwrite, circularité garantie)
- ✓ Archive : 6 ans conservation (défaut 3 ans + 3 ans sur demande audit)

### Bancaire (si agent finance)
- ⚠ KYC : Agent peut demander pièces, jamais valider seul (PR-02 : validation humaine)
- ⚠ Conformité AML : agent signale seulement, humain décide blocage
- ✓ Chiffrement données en transit + repos

### Cybersécurité (ISO 27001 optionnel)
- ✓ Authentification (certificat + clé symétrique)
- ✓ Audit trail (complet, immutable)
- ✓ Isolation réseau (LAN only, no Internet)
- ⚠ Backup : non spécifié (à implémenter : chiffré, external, 3-2-1 rule)

---

## 11. FAQ / Doutes

**Q: Poste offline 1 jour, puis reconnecter — que se passe-t-il ?**  
A: Queue locale rejoue jusqu'à 1 Go de messages, rejeu dédupliqué par hash.

**Q: Bundle panne disque (full) — que se passe-t-il ?**  
A: Agents refusent nouvelles exécutions, logs en mode circular (4 derniers jours). Admin doit effacer anciennes conversations et logs avant redémarrage.

**Q: Multi-Poste sur 1 Bundle — une fuite de clé AES d'une Poste compromet les autres ?**  
A: Non. Chaque Poste a clé AES distincte, stockée en Bundle isolée par user_id. Compromission 1 Poste = une seule session liée tombe.

**Q: Données conversations = confidentiel, sur Bundle chez nous. Et les traces chez Anthropic ?**  
A: Anthropic logging = fait (Privacy Policy). Pour MVP, API Anthropic optionnel (20% appels seulement). Phase 1+ : option "no API" = inférence locale Ollama (qualité faible).

**Q: Plusieurs agents tournent, partagent 1 GPU Radeon 780M. Faut-il paralleliser ou faire du queuing ?**  
A: Queue + exécution séquentielle (safeguard). Scheduler déterministe : agent urgent (PR-04) saute la file.

**Q: La réglementation européenne sur les virements instantanés — agents locaux OK ?**  
A: Oui, et pour une raison qui ne dépend pas du texte : **les agents ne font pas
de paiements** (PR-03 : multi-signature humaine). Ils préparent les fichiers,
l'humain valide et exécute depuis sa banque. La conformité vient de l'humain.

*Correction du 23/09/2026 :* cette question citait « Loi RIF (Directive UE
914/2022 paiements d'ici fin 2026) ». Aucun texte ne correspond. Le texte réel
est le **règlement (UE) 2024/886** sur les virements instantanés — un règlement,
pas une directive, et la vérification du bénéficiaire (*Verification of Payee*)
s'applique **depuis le 9 octobre 2025**, pas « fin 2026 ». Seule la référence a
été vérifiée ici ; **son application à notre cas reste à faire confirmer par un
juriste** avant d'entrer dans un document remis à un investisseur ou à un
client.

---

## Conclusion

Architecture simple, sécurisée pour TPE/PME.  
**Condition GO Phase 0** : test 1 agent réel 24h sans erreur.
