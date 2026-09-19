# 🚀 Démarrage Rapide — LocalAgent Frontend

## 30 secondes pour explorer les 129 agents

### 1. Installation
```bash
cd /home/user/iagents/frontend
npm install
```

### 2. Lancer le serveur de développement
```bash
npm run dev
```

Ouvre automatiquement **http://localhost:3000** 🎉

### 3. Que faire ?

#### 🔍 Explorez les fiches
- **Barre recherche** : tapez un ID (`AG-0001`), nom, ou concept
- **Sidebar gauche** : filtrez par secteur (Comptabilité, Finance, etc.) ou famille (métier, plateforme, etc.)
- **Cartes** : cliquez sur une carte pour voir les détails complets

#### 📖 Consultez les détails
Une fiche ouvre une modale avec **4 onglets** :
1. **Aperçu** : persona, consignes, connaissances, matériel requis
2. **✓ Tâches** : 6 tâches typiques (planification, validation humaine)
3. **🔌 Connecteurs** : voix, email, WhatsApp, calendrier, fichiers, accès logiciels
4. **💰 Économie** : coûts API, matériel, marge 3×, risque régulementaire

#### 🚀 Simulez une exécution
- Onglet **Économie** → bouton **"Simuler l'exécution"**
- Entrez une consigne utilisateur
- Cliquez **"Exécuter l'agent"**
- Obtenez un résultat mock : tokens, coût, durée, journal d'audit complet

### 4. Données

Les 129 fiches JSON sont chargées **statiquement** depuis `/home/user/iagents/agents/`.

Pas de backend requis pour explorer. 👍

### Troubleshooting

**Port 3000 déjà utilisé ?**
```bash
npm run dev -- --port 3001
```

**Build échoue ?**
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run build
```

**Données vides ?**
Les JSON doivent être accessibles au build-time :
```bash
ls /home/user/iagents/agents/ | wc -l  # Doit afficher 129
```

---

**Questions ?** Consultez `README.md` pour la structure complète.
