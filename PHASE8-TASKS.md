# Phase 8+ Tasks — iAgents Build & Deploy

**Last updated**: 2026-09-19  
**Status**: Phase 7 complete, Phase 8 ready for Windows build

---

## Phase 8: Windows Build & Testing

### Prerequisites
- [ ] Windows 10/11 machine
- [ ] Rust 1.70+ installed
- [ ] Node.js 18+ with npm
- [ ] Visual Studio Build Tools with C++ support
- [ ] ANTHROPIC_API_KEY environment variable

### Build Steps
```bash
cd iagents/desktop
npm install
npm run build  # Generates MSI installer (~80-100 MB)
```

### Testing Checklist (from WINDOWS-BUILD-GUIDE.md)
- [ ] App startup < 3 seconds
- [ ] Voice recognition (mic → transcription → LLM → TTS)
- [ ] Agent management (activate/deactivate, cycling)
- [ ] Voice training (3-phrase enrollment, database verification)
- [ ] Telegram connector (token validation, connection toggle)
- [ ] Error handling (graceful errors, no crashes)
- [ ] Full end-to-end flow (voice command → LLM response)
- [ ] Performance benchmarks (startup, recognition, routing, LLM, TTS)

### Success Criteria
- ✅ MSI installer builds without errors
- ✅ App launches on Windows 10/11
- ✅ All 8 test categories pass
- ✅ No memory leaks after 20+ activation cycles
- ✅ Database persists across restarts

---

## Phase 9: LocalAgent Catalogue Finalization

### Machine Specifications (machines.json)
- [ ] Replace placeholder AliExpress entries with LocalAgent partner specs
- [ ] Add negotiated prices from suppliers:
  - Minisforum (EU distributor)
  - PC Specialist (UK)
  - Materiel.net (FR)
  - Reichelt (DE)
- [ ] Verify actual RAM/VRAM/CPU with photos/datasheets
- [ ] Document GPU capacity for each machine
- [ ] Add thermal/power/size specs for deployment

### Hardware Testing
- [ ] Test Firebat AM02 (Ryzen 5/7) with 2-3 agents running
- [ ] Test mini-PC with Radeon 780M (memoire unifiee)
- [ ] Test eGPU RTX 3070 setup
- [ ] Measure actual memory usage per agent tier
- [ ] Benchmark inference speed (tokens/second)

### Example Configurations
- [ ] 2-agent team (Secrétaire + Comptable): cheapest bundle option
- [ ] 5-agent team (mixed profiles): Firebat L example
- [ ] 10-agent fleet: Bundle M with cost breakdown
- [ ] SME package: 3 postes + 1 bundle example

### Output
- [ ] Updated `dimensionnement/machines.json`
- [ ] Test report: `docs/test-hardware.md`
- [ ] Example kits: `docs/example-kits.md`

---

## Phase 10: iagent.agency Storefront

### Domain & Hosting
- [ ] Register iagent.agency on OVH
- [ ] DNS setup (A record → frontend hosting)
- [ ] SSL certificate (auto-renewed)

### Frontend Deployment
- [ ] Deploy `frontend/dist` to OVH/Vercel
- [ ] Verify all 1249 agents load correctly
- [ ] Test filters (sector, family, search)
- [ ] Test detail modal and simulator

### Product Pages
- [ ] Agent detail → product card (name, description, price range)
- [ ] Commercial profile tags (PR-00 to PR-04)
- [ ] Hardware requirements (GPU class, RAM)
- [ ] Pricing slider (min-max range by profile)

### Shopping Flow
- [ ] "Add to Cart" button (agent + bundle selection)
- [ ] Bundle selector (which hardware fits this agent)
- [ ] Checkout page (email, payment)
- [ ] Payment integration (Stripe or PayPal)

### Account & Delivery
- [ ] User registration (email verification)
- [ ] License key generation after payment
- [ ] Agent package download (JSON files)
- [ ] Documentation auto-sent (setup guide, agent manual)

### Analytics
- [ ] Popular agents (top 10, top 20)
- [ ] Sector trends (most viewed, most purchased)
- [ ] Conversion metrics (views → cart → purchase)

---

## Phase 11: GitHub Actions Automation

### Batch Generation Workflow
- [ ] Create `.github/workflows/generer-fiches.yml`
- [ ] Add secret `ANTHROPIC_API_KEY` (workspace-scoped)
- [ ] Manual trigger: sector selection + model choice
- [ ] Auto-trigger: on calendar (weekly?) for P1 sectors

### Workflow Steps
1. User selects sector (or all P1s)
2. Workflow calls `npm run generer -- soumettre --secteur X`
3. Anthropic Batch API queues fiches
4. Workflow polls for completion
5. On success: writes `agents/*.json`, creates PR
6. PR includes validation pass/fail + human review notes

### PR Template
```markdown
## Batch fiches — [Secteur]

- Batch ID: `{{batchId}}`
- Status: {{status}}
- Validation: {{validation}}
- Review checklist: TODO
```

### Failure Handling
- [ ] Partial success (some fiches fail): PR shows failures, lists retry commands
- [ ] Full failure (API down, quota exceeded): Notification to team, manual retry instructions
- [ ] Timeout (> 24h): Auto-cancel, requeue next window

---

## Phase 12: Runtime & Bundle Integration

### Python Runtime (Bundle Linux)
- [ ] FastAPI server for agent execution
- [ ] SQLite database (agents, conversations, audit log)
- [ ] Model inference engine (Ollama or similar)
- [ ] WebSocket listener (Poste ↔ Bundle communication)

### Agent Isolation
- [ ] Container per agent execution (Docker or systemd-nspawn)
- [ ] Filesystem sandbox (read-only agent code, writable outputs)
- [ ] Network restriction (no internet except via proxy)
- [ ] Resource limits (CPU, memory, timeout)

### Communication Protocol
- [ ] TLS 1.2+ WebSocket (Poste ↔ Bundle)
- [ ] Message format (JSON, versioned)
- [ ] Heartbeat / liveness check
- [ ] Queue persistence (offline resilience)

### Monitoring & Logging
- [ ] Audit trail (all actions, decisions, costs)
- [ ] Performance metrics (latency, tokens/sec, errors)
- [ ] Health checks (Bundle status → Poste warning)
- [ ] Log rotation (4-day circular on Bundle)

---

## Current Status Summary

### ✅ Complete
- Desktop app (Phases 1-7): Tauri + React, voice pipeline, database
- Agent catalogue: 1249 packages, fully validated
- Frontend boutique: React UI, dynamic loading
- Documentation: Architecture, build guide, infrastructure spec

### ⏳ Next Priority
1. **Phase 8 (Windows Build)** — Execute on Windows machine
2. **Phase 9 (Hardware Specs)** — Finalize LocalAgent catalogue
3. **Phase 10 (Storefront)** — Deploy iagent.agency
4. **Phase 11 (Automation)** — GitHub Actions for batch generation
5. **Phase 12 (Runtime)** — Python runtime + Bundle integration

### Parallel Work
- While Phase 8 Windows build runs (2-4 hours), can work on:
  - Phase 9 hardware testing (if machines available)
  - Phase 10 domain/hosting setup (OVH)
  - Phase 11 workflow scaffolding
  - Phase 12 prototype runtime

---

## Notes for Next Session

1. **Windows build outputs** to track: MSI path, installer size, build time
2. **QA results** to save: Test checklist completion, performance benchmarks
3. **Hardware data** to collect: Actual RAM/CPU usage per agent tier
4. **Cost updates** to integrate: Supplier quotes → machines.json
5. **Payment plan** to finalize: Pricing tiers, discount structure for LocalAgent bundles
