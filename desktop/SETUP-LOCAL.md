# Démarrer l'app desktop et exécuter un agent en local

Vérifié le 19/09/2026 sur Ubuntu 24.04. `README.md` décrit l'architecture ;
ce fichier ne donne que les étapes qui font démarrer l'application et tourner
un agent **en local, sans token facturé**.

## 1. Le moteur local : Ollama

L'application n'embarque pas de modèle. Elle parle à Ollama sur
`http://127.0.0.1:11434`, qui doit tourner avant elle.

```bash
# Windows : installateur sur ollama.com. Linux/macOS :
curl -fsSL https://ollama.com/install.sh | sh

ollama serve &            # laisse le moteur écouter sur 11434
ollama pull llama3.1:8b   # palier « texte-standard » : la plupart des postes
```

Le paquet d'un agent ne nomme jamais un modèle, il nomme un **palier**
(`modeles.texte` dans la fiche). L'application traduit le palier en poids
installé — table dans `src-tauri/src/llm.rs`, alignée sur
`dimensionnement/paliers-modeles.json` :

| Palier | Modèle tiré par défaut | Commande |
|---|---|---|
| `texte-leger` | `qwen2.5:3b` | `ollama pull qwen2.5:3b` |
| `texte-standard` | `llama3.1:8b` | `ollama pull llama3.1:8b` |
| `texte-avance` | `qwen2.5:14b` | `ollama pull qwen2.5:14b` |
| `texte-expert` | `qwen2.5:32b` | `ollama pull qwen2.5:32b` |

Tirez les paliers dont vos agents actifs ont besoin : les cinq agents
d'exemple demandent `texte-standard`, sauf Marcus (analyste) en `texte-avance`.

## 2. Réglages

Aucun réglage n'est obligatoire : sans variable d'environnement, l'application
démarre en **local** (règle projet du 18/09/2026, « local par défaut, API au
choix du client »).

| Variable | Défaut | Rôle |
|---|---|---|
| `IAGENT_LLM_MODE` | `local` | `local` (Ollama) ou `api` (Anthropic, facturé) |
| `IAGENT_OLLAMA_URL` | `http://127.0.0.1:11434` | Adresse du bundle de calcul sur le réseau |
| `IAGENT_OLLAMA_MODEL` | *(vide)* | Force un modèle pour tous les agents, court-circuite le palier |
| `ANTHROPIC_API_KEY` | — | Requis **seulement** si `IAGENT_LLM_MODE=api` |

`IAGENT_OLLAMA_URL` est le point d'entrée de l'architecture poste + bundle :
le poste Windows porte l'application, le bundle Linux porte le calcul. Pointez
la variable sur l'adresse fixe du bundle et le poste n'a aucun modèle à charger.

## 3. Dépendances et lancement

```bash
cd desktop
npm install
npm run dev        # tauri dev : lance Vite puis la fenêtre
```

Build Windows (MSI + NSIS) :

```bash
npm run build
```

### Dépendances système Linux (dev uniquement)

La cible du produit est Windows ; pour développer sous Linux, Tauri v1 exige
GTK et WebKitGTK :

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev build-essential libssl-dev libasound2-dev pkg-config
```

Sur Ubuntu 24.04, Tauri v1 réclame `webkit2gtk-4.0` et `libsoup-2.4`, dont la
distribution ne garde que `webkit2gtk-4.1`. Il faut donc le vrai paquet
libsoup2 **et** des fichiers `.pc` de compatibilité, plus des liens `.so` que
l'éditeur de liens puisse trouver : les crates Tauri écrivent
`-lwebkit2gtk-4.0` en dur, le `.pc` seul ne suffit pas.

```bash
sudo apt-get install -y libsoup2.4-dev

SHIM=/tmp/pkgshim
mkdir -p "$SHIM"
for n in webkit2gtk javascriptcoregtk; do
  sed -e "s/-4\.1/-4.0/g" /usr/lib/x86_64-linux-gnu/pkgconfig/${n}-4.1.pc > "$SHIM/${n}-4.0.pc"
  ln -sf /usr/lib/x86_64-linux-gnu/lib${n}-4.1.so "$SHIM/lib${n}-4.0.so"
done
sed -i "s|^Libs: -L\${libdir}|Libs: -L$SHIM -L\${libdir}|; \
        s/-lwebkit2gtk-4\.0/-lwebkit2gtk-4.1/; \
        s/-ljavascriptcoregtk-4\.0/-ljavascriptcoregtk-4.1/; \
        s|webkitgtk-4\.0|webkitgtk-4.1|g" "$SHIM"/*.pc

export PKG_CONFIG_PATH="$SHIM:$PKG_CONFIG_PATH"
export RUSTFLAGS="-L $SHIM"
```

WebKitGTK 4.1 est lié à libsoup3 tandis que Tauri v1 tire libsoup2 : les deux
cohabitent dans le même processus. Le binaire se construit et l'application
démarre, mais c'est un montage de développement, pas une cible de livraison.
La vraie sortie de ce contournement est Tauri v2, qui parle nativement
webkit2gtk-4.1.

Windows et macOS n'ont pas besoin de ce contournement.

## 4. Vérifier que ça tourne

L'application interroge Ollama au démarrage et affiche un bandeau quand le
moteur local manque, avec le motif et la commande à taper — un agent qui ne
tourne pas en local dit toujours pourquoi.

Contrôle en ligne de commande :

```bash
curl -s http://127.0.0.1:11434/api/tags               # modèles installés
cd desktop/src-tauri && cargo test                    # chemin d'exécution local
```

## 5. Ce qui n'est pas encore branché

- **Voix — éteinte par défaut.** `src-tauri/src/voice.rs` a été écrit contre
  des API `vosk` / `cpal` qui n'existent pas (12 erreurs de compilation) et
  réclame la bibliothèque native `libvosk`, absente du dépôt. Le module est
  derrière une option Cargo : `cargo build --features voice` une fois réécrit.
  Sans elle, `src/voice_absent.rs` garde la même surface et renvoie le motif
  en clair ; la synthèse vocale (pyttsx3), qui ne dépend pas de vosk, reste
  disponible. Les agents se pilotent au clavier en attendant.
- **Modèle Vosk** : chemin codé en dur (`model/vosk-model-en-us-0.22`), et
  c'est un modèle anglais alors que les agents répondent en français.
- **Icônes** : `src-tauri/icons/` contient un jeu de remplacement généré
  (rond sombre, monogramme « iA »). À remplacer par le vrai logo avant toute
  livraison — c'est l'icône que porteront le MSI et la fenêtre.
- **Base SQLite** : `Database::new("iagent.db")` ouvre le fichier dans le
  répertoire courant. Après une installation MSI sous `Program Files`, le
  dossier est en lecture seule : la base échoue à s'ouvrir, l'application
  démarre quand même mais ne garde rien. À déplacer vers le dossier de
  données de l'application avant de livrer un MSI.
- **Routage vocal** : `AgentRouter::route_voice_command` écrase son meilleur
  candidat à chaque tour de boucle sur la correspondance partielle, donc le
  dernier agent parcouru gagne au lieu du mieux noté.
