# LocalAgent Frontend

Interface web React pour explorer les 129 fiches d'agents métier LocalAgent.

## Installation

```bash
cd /home/user/iagents/frontend
npm install
```

## Développement

```bash
npm run dev
```

Ouvre automatiquement http://localhost:3000

## Fonctionnalités

### 📋 Vue Liste
- **129 fiches** chargées depuis JSON
- **Cartes 4-colonnes** : ID, nom, accroche, coût/mois
- **Filtre temps-réel** : recherche par ID/nom/accroche
- **Tri par coût** (prix mensuel)
- **Badge "3x"** : agents passant le test 3×

### 🔍 Filtres Sidebar
- **Secteurs** : 13 secteurs (Comptabilité, Finance, etc.)
- **Familles** : 5 familles (métier, plateforme, etc.)
- **Stats** : nombre d'agents affichés

### 📖 Vue Détails (Modal)
4 onglets :
1. **Aperçu** : Persona, consignes, connaissances, modèles, matériel
2. **✓ Tâches** : 6 tâches typiques (planification, validation)
3. **🔌 Connecteurs** : Voix, email, WhatsApp, calendrier, fichiers
4. **💰 Économie** : Coûts (API, matériel), marge 3×, risque

### 🚀 Simulation
- **Bouton "Simuler l'exécution"**
- Input texte (consigne utilisateur)
- Simulation 2s → Résultats mock
- Affiche : tokens, coût, durée, journal d'exécution

## Structure

```
frontend/
├── package.json           # Dépendances React + Vite + Tailwind
├── vite.config.js         # Config build Vite
├── tailwind.config.js     # Thème Tailwind
├── index.html             # Page HTML
└── src/
    ├── main.jsx           # Point d'entrée React
    ├── index.css          # Styles globaux + Tailwind
    ├── App.jsx            # Composant principal (500 lignes)
    ├── components/
    │   ├── Navbar.jsx     # Barre top + recherche
    │   ├── FicheList.jsx  # Grille 4-colonnes (filtrable)
    │   ├── FicheDetail.jsx # Modal 4-onglets
    │   └── AgentSimulator.jsx # Simulation mock
    └── data/
        └── loader.js      # Charge 129 JSON + utilitaires
```

## API des données

### `loader.js`
- `agents` : Tableau des 129 fiches
- `filterAgents(list, search, sector, famille)` : Filtrer
- `estimateMonthlyPrice(agent)` : Calcul prix moyen
- `passes3xTest(agent)` : Test 3×
- `getSectors()` : Liste des secteurs
- `getFamilles()` : Liste des familles

## Build

```bash
npm run build  # → dist/
npm run preview  # Serveur statique
```

## Tech Stack

- **React 18** : UI
- **Vite 5** : Build ultra-rapide
- **Tailwind CSS 3** : Styling
- **Glob import** : Charge 129 JSON dynamiquement

## Notes

- **Pas de backend** : données statiques JSON côté client
- **Pas d'authentification** : MVP démo
- **Responsive** : mobile-friendly (4 colonnes → 2 → 1)
- **Dark mode** : Tailwind v3 Slate palette

## Développement futur

- [ ] Tri/pagination avancée
- [ ] Export CSV/JSON
- [ ] Comparaison 2-3 agents
- [ ] Backend API réel (vs mock)
- [ ] Historique exécutions
- [ ] Graphiques d'économies
