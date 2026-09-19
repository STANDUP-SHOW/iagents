# iAgent Desktop — Phase 1 MVP

Local multi-agent orchestration with voice control for Windows.

## Architecture

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Tauri + Rust (IPC bridge)
- **Database**: SQLite + Prisma (encrypted at rest)
- **Voice**: Vosk STT (local) + TTS + Claude Haiku LLM
- **Agents**: 1,249 agent catalogue (lazy-loaded)

## Phase 1 Features

✅ **Dashboard**: Agent status, voice status, quick stats
✅ **Agent Manager**: Activate/deactivate 5 sample agents
✅ **Voice Training**: 3-utterance voice print enrollment
✅ **Connector Setup**: UI for Telegram (Phase 1) + placeholders for 8 more
✅ **Voice Control**: Route voice commands to agents by name

## Project Structure

```
desktop/
├── src/                    # React UI
│   ├── components/        # Dashboard, AgentManager, VoiceTraining, ConnectorSetup
│   ├── App.tsx            # Main app component
│   └── main.tsx           # Entry point
├── src-tauri/             # Tauri backend
│   ├── src/
│   │   ├── main.rs        # Tauri main + IPC handlers
│   │   ├── voice.rs       # Vosk STT/TTS pipeline
│   │   ├── agents.rs      # Agent routing
│   │   ├── connectors.rs  # Connector management
│   │   └── database.rs    # SQLite initialization
│   └── Cargo.toml
├── prisma/
│   └── schema.prisma      # Database schema (User, Agent, VoicePrint, Connector)
├── vite.config.ts
├── tauri.conf.json
├── package.json
└── README.md
```

## Development Setup

```bash
cd desktop

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Database Schema

**User**: username, email, voice print
**Agent**: id, name, description, status, persona (per user)
**VoicePrint**: MFCC features (encrypted)
**Connector**: Telegram, WhatsApp, Email, Calendar, etc. (credentials encrypted)
**AgentConnector**: Maps agents to connectors (per-agent assignment)
**ConnectorEvent**: Message queue for async events
**Log**: Audit trail

## Voice Pipeline (Phase 1)

1. Mic input → Vosk STT (local, offline)
2. Speech text → Agent router (regex name match)
3. Route to agent → Claude Haiku LLM
4. LLM response → Text-to-speech (pyttsx3 local or ElevenLabs)
5. Audio output → Speakers

## Security

- Master key stored in OS keychain
- Per-connector encrypted credentials (XChaCha20-Poly1305)
- Voice prints encrypted locally (never sent to cloud)
- LLM context sanitized (no credentials passed)

## Cost Model

| Component | Cost |
|-----------|------|
| Vosk STT (local) | $0 |
| pyttsx3 TTS (local) | $0 |
| Claude Haiku LLM | $10-20/mo |
| ElevenLabs TTS (optional) | $10-20/mo |
| **Total** | **$20-40/mo** |

## Next Phases

**Phase 2**: Full 1,249 catalogue, 4 more connectors, multi-agent concurrency, audio mixing, Linux support
**Phase 3**: All 9 connectors, speaker identification, offline cache, scheduling, agent marketplace

## Contributing

All work on this branch should follow the iagents monorepo standards.

```bash
# Before commit
npm run type-check
npm run build
```
