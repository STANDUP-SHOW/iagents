# iAgent — Onboarding (5 min)

## Qu'est-ce qu'on fait?

On vend **1249 fiches d'agents IA** — des employés virtuels préconfi gurés pour des métiers spécifiques (secrétaire, designer, vendeur, etc.). Chaque agent est un expert avec 25 ans d'expérience.

## À qui on vend?

- **PME**: Pour automatiser les tâches quotidiennes (email, docs, images, vidéos).
- **LocalAgent** (partenaire): Mini-PCs préconfigurés avec les agents dedans, sans frais API.
- **iagent.agency** (boutique): Site pour acheter des agents à la carte.

## Comment ça marche?

**1 agent = 1 fichier JSON** (`agents/AG-XXXX-nom.json`) avec:
- **Qui**: Persona, expérience, règles
- **Quoi**: Tâches quotidiennes (email, rapports, images, etc.)
- **Avec quoi**: Modèles IA (texte, image, vision, audio)
- **Coût**: Matériel GPU + API résiduelle vs API seule

**Exécution**: 
- Local (mini-PC du client) → pas de frais API
- API (cloud) → fallback si le local n'a pas la puissance

## État du projet (19/09/2026, 13h)

### ✅ Fait
- **1249 fiches JSON validées** (`npm run controle` → 0 erreur)
- **Frontend compilé** (Vue.js + Vite, prêt à déployer)
- **Schéma agent finalisé** (`paquet-agent.schema.json`)
- **Dimensionnement matériel** (GPU, RAM, prix pour chaque agent)

### ❌ Manque (urgent)
- **Site en ligne** (Vercel deployment jamais fait)
- **Features e-commerce** (panier, achat, paiement)
- **Business plan** (doc d'économie, tarifs, ROI)
- **Application desktop** (iAgent.exe, Tauri + Rust)

## Structure du dépôt

```
iagents/
├── agents/                    # 1249 fiches JSON (validated ✅)
├── frontend/                  # Vue.js/Vite app (compiled ✅)
│   └── dist/                 # Build ready to ship
├── desktop/                   # Tauri app (untouched)
├── contrat/                   # JSON schema + doc
├── dimensionnement/           # GPU/CPU/Price calculator
└── outils/                    # Validators, batch generator
```

## Commandes clés

```bash
npm run controle              # Validate all 1249 packages
npm run verifier -- --corriger # Auto-fix schema errors
npm run generer -- --sec --ids AG-0002  # Generate new agents (Batch API)
node outils/packs.ts          # Which agent runs on which PC?
npm run economie              # Price vs API-only comparison table
```

## Prochaines étapes (dans l'ordre)

1. **Déployer sur Vercel** ← Blocké (besoin credentials)
2. Ajouter panier + checkout (Stripe)
3. Créer business plan doc
4. Build desktop app MSI
5. Connecter localagent.fr

## Notes importantes

- **Schema est la source de vérité** — tout dériv é (materiel, commercial, pricing) est recalculé auto
- **Pas de hand-copy** — si un chiffre existe à deux endroits, l'un sera faux
- **Local par défaut, API au choix** — agents tournent sur PC client sans coûts, sauf fallback
- **Économie 3× : matériel + API locale vs API seule**

## Questions?

Voir CLAUDE.md pour règles durables du projet.
