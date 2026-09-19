# 🏗️ Architecture Frontend LocalAgent

## Vue d'ensemble

Frontend React + Vite + Tailwind pour explorer les **129 fiches d'agents métier**.

```
┌─────────────────────────────────────────────────────┐
│           LocalAgent Frontend (React)               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  App.jsx ─────────────────────────────────────┐    │
│   │                                           │    │
│   ├─ Navbar.jsx ──────── Recherche globale   │    │
│   │                                           │    │
│   ├─ Sidebar Filters ─── Secteur + Famille    │    │
│   │                                           │    │
│   └─ Main Content                             │    │
│       ├─ FicheList.jsx ─ Grille 4-colonnes   │    │
│       └─ FicheDetail.jsx ─ Modal 4-onglets   │    │
│           └─ AgentSimulator.jsx ─ Exécution  │    │
│                                               │    │
│  Data Layer ─────────────────────────────────┘    │
│   └─ loader.js ────── Charge 129 JSON             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Composants

### 1. **App.jsx** (~500 lignes)
Orchestrateur principal :
- État: `search`, `selectedSector`, `selectedFamille`, `selectedAgent`
- Filtre dynamique en temps-réel
- Gère l'ouverture/fermeture de la modale de détails

**Props exportées :**
```jsx
<Navbar search={search} onSearchChange={setSearch} />
<Sidebar sectors={sectors} familles={familles} />
<FicheList agents={filteredAgents} onSelectAgent={setSelectedAgent} />
{selectedAgent && <FicheDetail agent={selectedAgent} onClose={() => ...} />}
```

### 2. **Navbar.jsx**
Barre sticky en haut :
- Logo + titre
- Champ de recherche temps-réel
- Filtrage par ID/nom/accroche

### 3. **FicheList.jsx** (~150 lignes)
Grille de cartes (`grid-cols-4` → `grid-cols-1` responsive) :
- Chaque carte : ID, nom, accroche (80 chars max), badges (secteur/famille), coût/mois
- Badge spécial "3x ✓" si agent passerait test 3×
- Click → ouvre modale détails

**Données affichées :**
```
┌─────────────────────────┐
│ AG-0001 🏷️ 3x          │
│ Secrétaire admin        │
│ Trier courrier, classe… │
│ admin | metier          │
│ 649€/mois  76 appels/j  │
└─────────────────────────┘
```

### 4. **FicheDetail.jsx** (~400 lignes)
Modale plein écran avec 4 onglets :

#### Onglet 1 : **Aperçu** (Overview)
- **Persona** : 25 ans de secrétariat, biographie
- **Consigne** : instructions d'exécution
- **Connaissances** : 4 domaines clés (correspondance, délais, classement, relances)
- **Modèles** : texte, audio, embeddings, activité %
- **Matériel requis** : RAM, VRAM, CPU cores, disque, GPU

#### Onglet 2 : **✓ Tâches**
- Affiche les 6 tâches typiques de l'agent
- Pour chaque : nom, description, planification (intervalle/déclenche/quotidienne/à-demande)
- Validation humaine ? (badge jaune/vert)
- Entrées/sorties/logiciels

#### Onglet 3 : **🔌 Connecteurs**
- Connecteurs disponibles (voix, email, WhatsApp, calendrier, fichiers, conversation)
- Accès dossiers (choisis/complets)
- Internet ? (oui/non)
- Logiciels requis

#### Onglet 4 : **💰 Économie**
- **Prix mensuel** : gamme min-max (ex: 49€-299€)
- **Profil commercial** : PR-01, PR-02, etc.
- **API Calls/jour** : 76 estimés
- **Coût API mensuel** : calculé (appels × 0,00015€)
- **Coût matériel** : estimation (30% du prix)
- **Marge brute** : prix - API - matériel
- **Ratio 3×** : marge / prix (objectif > 33%)
- **Risque régulementaire** : Faible/Moyenne/Haute

**Bouton action** : "🚀 Simuler l'exécution"

### 5. **AgentSimulator.jsx** (~250 lignes)
Modale de simulation (modale dans modale) :

**Workflow :**
1. Input texte : consigne utilisateur ("Relever la boîte mail de ce matin")
2. Click "Exécuter"
3. Spinner 2 secondes (simule traitement)
4. Résultats mock :
   ```json
   {
     "status": "success",
     "output": "Tâche complétée…",
     "metrics": {
       "tokensUsed": 5432,
       "cost": "0.018€",
       "duration": "3.2s"
     },
     "auditLog": {
       "step_1": { "action": "parse_input", "duration_ms": 340, "tokens": 816 },
       "step_2": { "action": "process_context", "duration_ms": 720, "tokens": 1358 },
       "step_3": { "action": "call_llm", "duration_ms": 1200, "model": "claude-3-haiku", "tokens": 3259 },
       "step_4": { "action": "format_output", "duration_ms": 150, "tokens": 543 }
     }
   }
   ```

5. Affichage : résumé + audit log complet + JSON brut (détail)

### 6. **loader.js** (~120 lignes)
Utilitaires d'accès aux données :

**Imports dynamiques Vite :**
```javascript
const agentModules = import.meta.glob('../../../agents/*.json', { eager: true });
const agents = Object.values(agentModules); // 129 fiches
```

**Fonctions exportées :**
- `filterAgents(list, search, sector, famille)` → Tableau filtré
- `groupBySetor(list)` → `{ admin: [...], comptabilite: [...], ... }`
- `getSectors()` → `['admin', 'comptabilite', ...]`
- `getFamilles()` → `['metier', 'fonction', ...]`
- `estimateMonthlyPrice(agent)` → Moyenne min-max
- `passes3xTest(agent)` → Boolean (marge > 33%)

## Flux de données

### 1. Chargement initial
```
Vite build
  ↓
glob('agents/*.json') importés (eager)
  ↓
129 fiches en mémoire côté client
  ↓
Aucune requête réseau, données statiques
```

### 2. Interaction utilisateur
```
User tape "AG-001" dans la recherche
  ↓ onChange event
  ↓ App.jsx setState(search)
  ↓ useMemo(filterAgents(...))
  ↓ FicheList re-render (cartes filtrées)
  ↓ Instantané
```

### 3. Ouverture détails
```
Click sur carte
  ↓ onSelectAgent(agent)
  ↓ App.jsx setState(selectedAgent)
  ↓ FicheDetail modale affichée
  ↓ 4 onglets avec données complètes de l'agent
```

### 4. Simulation
```
Click "Simuler"
  ↓ AgentSimulator modale ouverte
  ↓ User tape consigne
  ↓ Click "Exécuter"
  ↓ setExecuting(true)
  ↓ await sleep(2000)
  ↓ Générer résultats mock (tokens, coûts, audit)
  ↓ setResult(...), setExecuting(false)
  ↓ Afficher résultats
```

## Styling

### Tailwind v3 + Custom

**Thème :**
- Fond : `bg-slate-900` (noir bleuté)
- Cartes : `bg-slate-800`
- Accent : `indigo-600` (bleu)
- Accent 2 : `purple-600` (violet)

**Classes réutilisables (index.css) :**
```css
.card { @apply bg-slate-800 rounded-lg shadow-lg p-4; }
.btn-primary { @apply px-4 py-2 bg-indigo-600 hover:bg-indigo-700 ...; }
.btn-secondary { @apply px-4 py-2 bg-slate-700 hover:bg-slate-600 ...; }
.badge { @apply inline-block px-2 py-1 text-xs font-semibold rounded; }
```

**Responsive :**
```
4 colonnes (lg)
2 colonnes (md)
1 colonne (sm)
```

## Performance

### Bundle size
```
dist/index.html                     0.57 kB
dist/assets/index-*.css            17.42 kB (gzip: 3.89 kB)
dist/assets/index-*.js           1,589.68 kB (gzip: 376.88 kB) ⚠️
```

⚠️ Les 129 JSON (embed statique) gonflent le JS. À améliorer :
- [ ] Code-split avec `import.meta.glob()` lazy
- [ ] Charger JSON côté serveur
- [ ] Compresser JSON (minify ou format binaire)

### Rendering
- **Chargement initial** : < 1s (Vite optimisé)
- **Filtre recherche** : instantané (useMemo)
- **Ouverture modale** : instantané
- **Simulation** : délibérément 2s (UX)

## État (React Hooks)

**App.jsx :**
```javascript
const [search, setSearch] = useState('');
const [selectedSector, setSelectedSector] = useState('');
const [selectedFamille, setSelectedFamille] = useState('');
const [selectedAgent, setSelectedAgent] = useState(null);
const [sidebarOpen, setSidebarOpen] = useState(true);

// Memoïzés
const filteredAgents = useMemo(() => filterAgents(...), [search, selectedSector, selectedFamille]);
```

**FicheDetail.jsx :**
```javascript
const [activeTab, setActiveTab] = useState('overview');
const [showSimulator, setShowSimulator] = useState(false);
```

**AgentSimulator.jsx :**
```javascript
const [input, setInput] = useState('');
const [executing, setExecuting] = useState(false);
const [result, setResult] = useState(null);
```

## Pas de backend

**Intentionnel pour MVP :**
- Données statiques JSON
- Pas de base de données
- Pas de API serveur
- Simulation locale (mock)

**Pour la production :**
- Connecter API réelle
- Remplacer `AgentSimulator` par vrai backend
- Ajouter authentification Stripe
- Tracker exécutions réelles en BDD

## Structure des dossiers

```
frontend/
├── package.json           # Dépendances (React, Vite, Tailwind)
├── vite.config.js         # Config Vite (port 3000)
├── tailwind.config.js     # Thème Tailwind
├── postcss.config.js      # Tailwind processing
├── index.html             # Point d'entrée HTML
│
├── src/
│   ├── main.jsx           # ReactDOM.render(App)
│   ├── index.css          # Styles globaux + Tailwind
│   ├── App.jsx            # Composant root (500 lignes)
│   │
│   ├── components/
│   │   ├── Navbar.jsx     # Barre top (50 lignes)
│   │   ├── FicheList.jsx  # Grille cartes (150 lignes)
│   │   ├── FicheDetail.jsx # Modale 4-onglets (400 lignes)
│   │   └── AgentSimulator.jsx # Modale simulation (250 lignes)
│   │
│   └── data/
│       └── loader.js      # Imports JSON + utilitaires (120 lignes)
│
├── dist/                  # Build output (npm run build)
├── node_modules/          # Dépendances (129 packages)
│
├── README.md              # Documentation complète
├── QUICKSTART.md          # Démarrage 30s
└── ARCHITECTURE.md        # Ce fichier
```

## Points clés

1. **Glob import** : 129 fiches chargées à la compilation Vite (eager)
2. **Memoization** : Filtre/groupement fast (useMemo)
3. **Modales imbriquées** : FicheDetail peut ouvrir AgentSimulator
4. **Responsive** : 4 colonnes → 1 colonne (Tailwind)
5. **Accessible** : boutons bien marqués, focus rings, couleurs contrastées
6. **Pas de backend** : MVP purement client-side

## Prochaines étapes

- [ ] Connecter une vraie API backend
- [ ] Ajouter paiement Stripe (maquette du commercial)
- [ ] Importer authentification Google/Email
- [ ] Tracker exécutions dans BDD
- [ ] Graphiques coûts/économies
- [ ] Comparaison 2-3 agents côte-à-côte
- [ ] Export CSV/JSON
- [ ] Pagination > 500 agents
