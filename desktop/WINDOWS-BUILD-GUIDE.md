# iAgent Desktop — Windows Build & Test Guide

**Phase 1 Complete**: Ready for Windows MSI installer generation and testing

## Pre-Build Checklist

- [ ] Windows machine with Rust installed (1.70+)
- [ ] Node.js and npm installed
- [ ] Visual Studio Build Tools or full Visual Studio with C++ support
- [ ] Git installed
- [ ] ANTHROPIC_API_KEY environment variable set

## Build Steps

### 1. Clone Repository

```bash
git clone https://github.com/STANDUP-SHOW/iagents.git
cd iagents/desktop
```

### 2. Install Dependencies

```bash
npm install
cd src-tauri && cargo fetch
cd ..
```

### 3. Set Environment Variables

```bash
# PowerShell
$env:ANTHROPIC_API_KEY="your-api-key-here"

# Command Prompt
set ANTHROPIC_API_KEY=your-api-key-here
```

### 4. Build Development Version (Debug)

```bash
npm run dev
```

This launches:
- Frontend dev server on http://localhost:5173
- Tauri debug window for testing

Test features before building release version.

### 5. Build Production MSI Installer

```bash
npm run build
```

**Output**: `src-tauri/target/release/bundle/msi/iAgent Desktop_0.1.0_x64_en-US.msi`

**Installer size**: ~80-100 MB (includes Rust runtime, Node dependencies bundled)

### 6. Install from MSI

1. Run the generated `.msi` installer
2. Follow Windows installation wizard
3. Installer places app in `C:\Program Files\iAgent Desktop\`
4. Desktop shortcut created automatically
5. App available in Start Menu

## Functional Testing Checklist

### Startup & Initialization

- [ ] App launches without error
- [ ] No console errors in system logs
- [ ] "Ready" status shown in header
- [ ] All 5 sample agents listed (Albert, Justine, Audrey, Marcus, Olivia)
- [ ] Four navigation tabs visible (Dashboard, Agents, Voice Training, Connectors)

### Voice Recognition (Microphone Required)

- [ ] Click "Activate" on an agent (e.g., Albert)
- [ ] Status changes to "🎤 Listening..."
- [ ] Speak clearly: "Albert, what time is it?"
- [ ] Live transcription appears in real-time in transcription bar
- [ ] After 1 second of silence, "Thinking..." indicator appears
- [ ] LLM processes command (watch for "Thinking..." animation)
- [ ] Agent responds with spoken text via text-to-speech
- [ ] Response text displayed in Response display
- [ ] No console errors

**Troubleshooting**:
- No transcription? Check microphone permissions in Windows Settings → Privacy & Security → Microphone
- No TTS output? Verify pyttsx3 installed: `pip install pyttsx3`
- API error? Check ANTHROPIC_API_KEY environment variable

### Agent Management

- [ ] Click different agents → "Activate" button changes each
- [ ] Activate agent → listening starts, button becomes "Deactivate"
- [ ] Deactivate agent → listening stops, transcription clears
- [ ] Multiple activation/deactivation cycles work smoothly
- [ ] No memory leaks (app stays responsive after 20+ cycles)

### Voice Training (Biometric Enrollment)

- [ ] Navigate to "Voice Training" tab
- [ ] Click "Start Voice Enrollment"
- [ ] Read phrase 1: "My voice is my password"
- [ ] Progress bar shows 33%
- [ ] Continue through phrases 2 and 3
- [ ] After 3 recordings, success screen appears
- [ ] Benefits list shown (Speaker verification, Secure authentication, Personalized responses)
- [ ] Click "Enroll Again" → resets to intro screen
- [ ] Voice print stored in database (`iagent.db`)

**Verification**:
```bash
# Check database was created
ls -la desktop/iagent.db

# Verify voice_prints table has data (using SQLite CLI)
sqlite3 desktop/iagent.db "SELECT COUNT(*) FROM voice_prints;"
```

### Telegram Connector

- [ ] Navigate to "Connectors" tab
- [ ] Telegram card shows "disconnected" status
- [ ] Click "Connect" on Telegram card
- [ ] Modal appears with:
  - Connection instructions (BotFather setup flow)
  - Bot Token input field
  - Chat ID input field
- [ ] Paste invalid token → error message appears
- [ ] Paste valid format token + chat ID → "Connected" status shown
- [ ] Click "Disconnect" → status reverts to "disconnected"
- [ ] Modal closes on successful connection
- [ ] Telegram credentials stored in database

**Database Verification**:
```bash
sqlite3 desktop/iagent.db "SELECT name, type, status FROM connectors;"
```

### Error Handling

- [ ] Speak without agent active → error message shown
- [ ] Invalid Telegram credentials → error displayed with reason
- [ ] Network error (API unavailable) → graceful error message
- [ ] Error banner clears on next successful operation
- [ ] App doesn't crash on any error condition

### Complete Voice-to-LLM Flow

**Scenario**: Full end-to-end test with all components

1. Launch app → Dashboard loads
2. Navigate to Agents tab
3. Activate "Justine" agent
4. Speak: "Justine, tell me a short joke"
5. Watch live transcription
6. Wait for "Thinking..." indicator
7. Listen to response and read it in Response display
8. No errors throughout flow

**Expected**: 5-8 seconds total latency (speech + model + TTS)

### Performance Benchmarks

| Metric | Target | Notes |
|--------|--------|-------|
| App startup | < 3 seconds | From desktop click to ready |
| Voice recognition latency | < 500ms | Vosk local processing |
| Agent routing | < 50ms | Regex pattern matching |
| LLM response time | 2-5 seconds | Claude Haiku with streaming |
| TTS generation | 1-3 seconds | pyttsx3 local synthesis |
| Memory footprint | < 300 MB | Rust + React runtime |

### Crash Testing

Run these scenarios to verify stability:

```
1. Rapid agent activation/deactivation (10 cycles)
2. Voice enrollment → agent activation in sequence
3. Telegram connection → voice command in sequence  
4. Close/reopen app with data persisted
5. Kill Vosk model during listening
6. Disconnect microphone mid-recording
7. Network unavailable during LLM call
```

All should handle gracefully without crash.

## Post-Installation Verification

### Check Installation

```bash
# Verify files installed
ls "C:\Program Files\iAgent Desktop\"

# Check database created
ls %APPDATA%\iagent-desktop\iagent.db
```

### Database Location

- **Windows**: `%APPDATA%\iagent-desktop\iagent.db` (or app directory)
- Contains persisted voice prints and Telegram credentials
- Survives app restarts

## Uninstall

1. Windows Settings → Apps → Apps & Features
2. Search for "iAgent Desktop"
3. Click "Uninstall"
4. Follow uninstaller prompts

## Troubleshooting Build Issues

### Issue: "Could not find `rustc`"

**Solution**: Reinstall Rust
```bash
rustup update
rustup toolchain install stable-x86_64-pc-windows-msvc
```

### Issue: "Could not compile Vosk"

**Solution**: Install Visual Studio Build Tools with C++ support
- Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Install "Desktop development with C++"

### Issue: "npm ERR! code ELIFECYCLE"

**Solution**: Clear npm cache and rebuild
```bash
npm cache clean --force
rm -r node_modules package-lock.json
npm install
npm run build
```

### Issue: "pyttsx3 not found" at runtime

**Solution**: Install pyttsx3 on target machine
```bash
pip install pyttsx3
```

### Issue: "No such file or directory: iagent.db"

**Solution**: This is normal - database auto-creates on first run
- App will create `iagent.db` in application directory
- Check `C:\Program Files\iAgent Desktop\` or `%APPDATA%\iagent-desktop\`

## Release Checklist

Before shipping:

- [ ] TypeScript strict mode passes: `npx tsc --noEmit`
- [ ] Rust code compiles: `cargo build --release` (no warnings)
- [ ] All 11 functional tests pass
- [ ] Performance benchmarks met
- [ ] Database persistence verified
- [ ] Error messages user-friendly
- [ ] Extension check passes: `node check.cjs` (if applicable)
- [ ] Installer size reasonable (~80-100 MB)
- [ ] Version bumped in `Cargo.toml` and `package.json`
- [ ] CHANGELOG.md updated with new features

## Next Phase: Distribution

1. **GitHub Releases**: Upload `.msi` file to https://github.com/STANDUP-SHOW/iagents/releases
2. **Update Check**: Add version endpoint so app can notify of updates
3. **Digital Signing**: Sign `.msi` with code certificate (optional but recommended)
4. **Auto-Update**: Implement update checking in app (Phase 2)

## Contact & Support

For build issues or questions:
- Check logs in `%APPDATA%\iagent-desktop\logs\`
- Review GitHub issues: https://github.com/STANDUP-SHOW/iagents/issues
- Test on multiple Windows versions (10, 11) if possible
