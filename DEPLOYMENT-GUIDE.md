# iAgents Deployment Guide

## Phase 10: iagent.agency Storefront + Phase 8: Windows Build

---

## 1. Frontend Web Deployment (iagent.agency)

### Prerequisites
- Vercel account
- GitHub repo connected to Vercel
- Domain `iagent.agency` (or similar)

### Steps

#### 1.1 Connect to Vercel
```bash
# Vercel will auto-detect the iagents repo
# Configuration in vercel.json is already set up:
# - Build: cd frontend && npm run build
# - Output: frontend/dist
```

#### 1.2 Deploy
```bash
# Option A: Push to main branch
git push origin main
# Vercel auto-deploys on push

# Option B: Manual deploy via Vercel CLI
npm i -g vercel
vercel
```

#### 1.3 Connect Custom Domain
1. In Vercel Dashboard → Project Settings → Domains
2. Add `iagent.agency`
3. Update DNS records (A record or CNAME)

#### 1.4 Verify Deployment
```bash
# Check that all 1249 agents load:
curl https://iagent.agency/ | grep -c "AG-"
# Should return 1249+
```

**Status**: Frontend build: ✅ Ready
**Status**: Frontend deploy: ⏳ Requires Vercel setup

---

## 2. Desktop App Build (Windows MSI)

### Prerequisites on Windows Machine
- Windows 10 or 11
- Rust 1.70+ : https://rustup.rs/
- Node.js 18+ : https://nodejs.org/
- Visual Studio Build Tools with C++ support
- ANTHROPIC_API_KEY environment variable

### Steps

#### 2.1 Clone & Install
```bash
git clone https://github.com/STANDUP-SHOW/iagents.git
cd iagents
cd desktop
npm install
```

#### 2.2 Dev Build (Test First)
```bash
npm run dev
# Opens local dev window at http://localhost:5173
# Test:
# - Agent list loads (1249 agents visible)
# - Can search/filter agents
# - Can click agent cards
# - Voice control works (if microphone connected)
# - Database persists (agents saved locally)
```

#### 2.3 Production Build (MSI Installer)
```bash
npm run build
# Generates: src-tauri/target/release/bundle/msi/
# Output file: iAgent Desktop_0.1.0_x64_en-US.msi (~80-100 MB)
```

#### 2.4 Manual Testing
Install the MSI and test:

**App Startup**
- [ ] App launches in < 3 seconds
- [ ] Main window shows agent grid
- [ ] No console errors

**Agent Management**
- [ ] List shows 1249 agents
- [ ] Search filters work
- [ ] Can click agents to view details
- [ ] Details modal shows all 4 tabs

**Voice Pipeline** (if microphone available)
- [ ] Voice input captured via CPAL
- [ ] Transcript recognized (Vosk STT)
- [ ] Agent routed by name
- [ ] Response generated (Claude Haiku)
- [ ] Audio output played (pyttsx3)
- [ ] Result saved to database

**Voice Training**
- [ ] Can enroll 3-phrase voice print
- [ ] Speaker verification works
- [ ] Database stores encrypted voice data

**Connectors**
- [ ] Telegram connection form visible
- [ ] Can test Telegram token validation
- [ ] Can save connector credentials

**Database Persistence**
- [ ] Close and reopen app
- [ ] Previously saved data still present
- [ ] No data corruption

**Performance**
- [ ] Memory usage stable after 20+ voice interactions
- [ ] No memory leaks
- [ ] Database queries < 100ms

#### 2.5 Release
After testing, sign and distribute MSI:

```bash
# Sign the installer (if code signing cert available)
signtool.exe sign /f cert.pfx /p password \
  src-tauri/target/release/bundle/msi/iAgent\ Desktop_0.1.0_x64_en-US.msi

# Upload to release server or S3
aws s3 cp src-tauri/target/release/bundle/msi/iAgent\ Desktop_0.1.0_x64_en-US.msi \
  s3://downloads.iagents.io/v0.1.0/
```

**Status**: Desktop build: ⏳ Requires Windows machine
**Status**: Desktop test: ⏳ Requires Windows machine

---

## 3. End-to-End Test Flow

Once both are deployed:

1. **User visits iagent.agency**
   - ✅ Sees 1249 agents in grid
   - ✅ Can search and filter
   - ✅ Can view agent details
   - ✅ Sees pricing and requirements

2. **User downloads desktop app**
   - ✅ MSI installer available
   - ✅ ~100 MB file size
   - ✅ Installs on Windows 10/11

3. **User installs and launches**
   - ✅ App starts in < 3 seconds
   - ✅ 1249 agents loaded locally
   - ✅ Can control by voice
   - ✅ Can create voice print
   - ✅ Can test agents

4. **User tests an agent**
   - ✅ Voice command → LLM → Response
   - ✅ Logs stored locally
   - ✅ Can export results

5. **Full integration test**
   - Website → Download → Install → Launch → Use Agent
   - All steps working end-to-end

---

## 4. Known Issues & Workarounds

### Bundle Size Warning
- JS file is 10 MB (uncompressed) because all 1249 agent JSONs are embedded
- Gzip: ~726 KB (acceptable for web)
- ✅ No user-facing issue, just a build warning

### Linux Build Limitation
- Tauri requires GTK3 on Linux (gdk-sys error)
- ✅ Solution: Build on Windows only
- ✅ Frontend can be tested on any OS

### Windows Machine Required
- Phase 8 MSI build needs Windows
- Cross-compilation not recommended for desktop apps
- **Next step**: Get Windows machine or use CI/CD (GitHub Actions)

---

## 5. CI/CD with GitHub Actions (Future)

To automate Windows builds:

```yaml
# .github/workflows/build-desktop.yml
name: Build Desktop App
on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: x86_64-pc-windows-msvc
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd desktop && npm install
      - run: cd desktop && npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: iagent-desktop-msi
          path: desktop/src-tauri/target/release/bundle/msi/
```

---

## 6. Checklist Summary

### Frontend (Can do now)
- [x] Frontend React build passes
- [x] 1249 agents load correctly
- [x] vercel.json configured
- [ ] Deploy to iagent.agency
- [ ] Custom domain configured
- [ ] Test live site in browser

### Desktop (Needs Windows)
- [x] Tauri config valid
- [x] TypeScript compiles
- [ ] Rust compiles (Windows only)
- [ ] MSI builds successfully
- [ ] App launches on Windows 10/11
- [ ] All 8 test categories pass
- [ ] Performance benchmarks met
- [ ] Installer signed
- [ ] Available for download

---

## 7. Next Actions

1. **NOW (Can do on Linux)**:
   - Deploy frontend to Vercel
   - Test website loads all 1249 agents
   - Verify responsive design on mobile

2. **NEEDS WINDOWS**:
   - Build MSI installer
   - Run full QA checklist
   - Sign installer
   - Set up download server

3. **AFTER BOTH WORKING**:
   - Phase 9: Hardware specs & LocalAgent pricing
   - Phase 11: GitHub Actions automation
   - Phase 12: Python runtime for Bundle

---

**Last updated**: 2026-09-19
**Frontend build**: ✅ OK
**Desktop config**: ✅ OK (needs Windows to compile)
**Deployment status**: ⏳ In progress
