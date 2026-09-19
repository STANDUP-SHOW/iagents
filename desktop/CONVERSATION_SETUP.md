# iAgent Desktop - Conversation Setup

## 🎯 Overview

Configuration complète pour le système conversationnel multi-agents iAgent avec :
- Reconnaissance de prénom (wake word detection)
- STT haute qualité (Whisper)
- LLM conversationnel (Claude)
- TTS naturelle (ElevenLabs)
- Mémoire conversationnelle avec Redis

## 📁 Structure des Fichiers

```
src/
├── config/
│   ├── agents-config.json              # Config de 3 agents (Carla, Robert, Marie)
│   └── conversation-settings.json      # STT, TTS, LLM, performance
├── engines/
│   ├── ConversationEngine.ts           # Orchestration moteur conversationnel
│   └── index.ts
└── services/
    ├── audio-service.ts                # STT/TTS, gestion audio
    └── index.ts
```

## 🔧 Configuration

### 1. Environnement Variables

Créez un `.env.local` à la racine `desktop/` :

```env
# OpenAI (Whisper API fallback)
REACT_APP_OPENAI_API_KEY=sk-...

# ElevenLabs (TTS)
REACT_APP_ELEVENLABS_API_KEY=sk_...

# Anthropic (Claude API)
REACT_APP_ANTHROPIC_API_KEY=sk-ant-...

# Redis (optionnel, pour production)
REDIS_URL=redis://localhost:6379

# Google Cloud (TTS fallback)
GOOGLE_PROJECT_ID=your-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

### 2. Agents Configuration

Trois agents préconfigurés dans `src/config/agents-config.json` :

- **Carla** (AG-0001) : Ventes, devis, relation client
- **Robert** (AG-0002) : Support technique, problèmes complexes
- **Marie** (AG-0003) : Facturation, comptes, conformité

Chaque agent a :
- Prénom d'invocation ("carla", "robert", "marie")
- Voix ElevenLabs unique
- Système prompt personnalisé
- Regles strictes à respecter
- Disponibilité calendrier

Pour ajouter un agent :

```json
{
  "id": "AG-0004",
  "nom": "Marc",
  "prenom": "marc",
  "titre": "Manager",
  "tts": {
    "provider": "elevenlabs",
    "voice_id": "NEW_VOICE_ID"
  },
  "llm": {
    "system_prompt": "Tu es Marc..."
  },
  "regles": [...]
}
```

### 3. Paramètres Performance

Dans `src/config/conversation-settings.json` :

```json
{
  "stt": {
    "model": "base",           // Qualité vs latence
    "vad_threshold": 0.5       // Sensibilité silence/voix
  },
  "tts": {
    "stability": 0.75,         // 0=varié, 1=identique
    "similarity_boost": 0.75   // Voix clonée accuracy
  },
  "llm": {
    "temperature": 0.7,        // Naturel
    "max_tokens": 500          // ~5-30 sec parole
  }
}
```

## 🚀 Utilisation

### 1. Initialiser le Moteur

```typescript
import { ConversationEngine } from './engines';

const engine = new ConversationEngine();
const sessionId = `session_${Date.now()}`;
```

### 2. Détecter l'Agent par Prénom

```typescript
const transcription = "Carla, j'ai une question sur les tarifs";
const result = engine.detectAgent(transcription);

if (result) {
  console.log(`Agent: ${result.agent.nom}`);
  console.log(`Utterance: ${result.utterance}`);
  
  // Créer session avec cet agent
  engine.createSession(sessionId, result.agent.id);
}
```

### 3. Flux Conversationnel Complet

```typescript
import { AudioService } from './services';

const audioService = new AudioService();
const engine = new ConversationEngine();

async function handleCall() {
  // 1. Enregistrer l'audio (5 secondes)
  const audioData = await audioService.recordAudio(5000);

  // 2. Transcrire (STT)
  const transcription = await audioService.transcribeAudio(audioData);
  console.log("Utilisateur:", transcription);

  // 3. Détecter agent + créer session
  const result = engine.detectAgent(transcription);
  if (!result) {
    console.log("Agent non reconnu");
    return;
  }

  const sessionId = `session_${Date.now()}`;
  engine.createSession(sessionId, result.agent.id);

  // 4. Ajouter message utilisateur
  engine.addMessage(sessionId, 'user', result.utterance, 3.0);

  // 5. Construire contexte pour LLM
  const llmContext = engine.buildLLMContext(sessionId);

  // 6. Appeler Claude (ou Ollama)
  const response = await callLLM(llmContext);
  engine.addMessage(sessionId, 'agent', response);

  // 7. Synthétiser la voix (TTS)
  const agentConfig = engine.getAgentConfig(result.agent.id);
  const ttsConfig = engine.getTTSConfig(result.agent.id);
  const audioBuffer = await audioService.synthesizeAudio(
    response,
    ttsConfig.voice_id,
    ttsConfig
  );

  // 8. Jouer la réponse
  await audioService.playAudio(audioBuffer);

  // 9. Exporter pour audit
  const transcript = engine.exportConversation(sessionId);
  console.log("Transcript saved:", transcript);
}
```

### 4. Changer d'Agent Pendant l'Appel

```typescript
// Utilisateur: "Passe-moi Robert"
const newAgent = engine.detectAgent("Robert");
if (newAgent) {
  engine.switchAgent(sessionId, newAgent.agent.id);
  // Robert reprend la conversation
}
```

### 5. Mémoire et Contexte

```typescript
// Récupérer l'historique
const history = engine.getConversationHistory(sessionId);

// Référencer un message précédent
engine.addMessage(
  sessionId,
  'agent',
  `Comme je vous le disais: ${history[0].content}`
);

// Stats de la session
const stats = engine.getSessionStats(sessionId);
console.log(`Durée: ${stats.duration_seconds}s`);
console.log(`Messages: ${stats.message_count}`);
```

## 📊 Métriques

Chaque session track :

- **Durée** : temps total interaction
- **Messages** : nombre de tours
- **Agent** : qui a traité l'appel
- **Satisfaction** : rating post-appel (optionnel)
- **Escalades** : vers support humain?

## 🔐 Sécurité

- Conversations chiffrées en transit
- API keys dans variables d'environnement
- GDPR compliance activé
- Consent message à chaque appel
- Audit logs de tous les appels

## 🎧 Tests Locaux

```bash
cd desktop

# Installer dépendances
npm install

# Mode dev avec hot reload
npm run dev

# Compiler pour Windows/Mac
npm run build
```

## 📦 Déploiement Production

1. Build l'app :
   ```bash
   npm run build
   ```

2. Installer sur mini-PC client
3. Configurer les variables d'environnement
4. Tester avec quelques appels
5. Mesurer les KPIs (latence, satisfaction)

## 🎯 KPIs à Mesurer

| Métrique | Target | Mesure |
|----------|--------|--------|
| Latence STT | < 2.5s | timer automation |
| Latence LLM | < 2s | API metrics |
| Latence TTS | < 1.5s | service logs |
| Tube-à-tube | < 3s | client-side timer |
| Naturalité | 4.5/5 | A/B test |
| CSAT | > 0.9 | post-call survey |

## 🐛 Troubleshooting

**Microphone ne marche pas**
```typescript
const hasMic = await audioService.checkMicrophoneAccess();
if (!hasMic) console.log("Autorisez le micro dans les permissions");
```

**Agent non détecté**
- Vérifier les `wake_word` dans agents-config.json
- Augmenter `fuzzy_ratio_threshold` (0.85 par défaut)
- Ajouter des variantes de prénom

**Latence élevée**
- Réduire `whisper_model` de "base" à "tiny" (+ rapide)
- Réduire `llm.max_tokens` (300 au lieu de 500)
- Vérifier la bande passante internet

## 📚 Ressources

- [Whisper API Docs](https://platform.openai.com/docs/guides/speech-to-text)
- [ElevenLabs API](https://elevenlabs.io/docs/api)
- [Claude API](https://console.anthropic.com/docs/api)
- [ConversationEngine Code](src/engines/ConversationEngine.ts)

---

**Version** : 1.0.0 | **Updated** : 2025-09-19 | **Status** : Production Ready
