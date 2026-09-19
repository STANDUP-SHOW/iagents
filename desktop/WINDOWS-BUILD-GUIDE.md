# iAgent Desktop — Windows Build & Test Guide

The desktop app is a **Tauri 1.5** project: a React/Vite frontend in `desktop/src`
and a Rust backend in `desktop/src-tauri`. The MSI is produced by WiX, which runs
on Windows only — there is no way to bundle an `.msi` from Linux or macOS. Either
build on a Windows machine, or let the `Build Windows MSI` GitHub Actions workflow
do it (`workflow_dispatch`, or a `v*` tag).

## Prerequisites

| Requirement | Why | How |
|---|---|---|
| Windows 10 or 11 (x64) | WiX, and therefore the MSI target, is Windows-only | — |
| Rust 1.70+, `x86_64-pc-windows-msvc` | Builds the backend | `rustup toolchain install stable-x86_64-pc-windows-msvc` |
| Visual Studio Build Tools, "Desktop development with C++" | MSVC linker, and the C compiler `rusqlite`'s bundled SQLite needs | https://visualstudio.microsoft.com/visual-cpp-build-tools/ |
| Node.js 20+ and npm | Builds the frontend and runs the Tauri CLI | https://nodejs.org |
| **Vosk native library (`libvosk`)** | `vosk-sys` declares `#[link(name = "libvosk")]` and ships **no build script**, so nothing fetches it for you — without it the build fails at link time, not at compile time | See "Vosk native library" below |
| WebView2 runtime | Tauri renders the UI in it | Preinstalled on Windows 11 and on up-to-date Windows 10 |

WiX itself does **not** need to be installed: the Tauri CLI downloads it on first
build.

`ANTHROPIC_API_KEY` is **not** a build-time requirement. `LLMService::new()` reads
it from the environment at runtime, so it only has to be set on the machine that
runs the app.

### Vosk native library

1. Download `vosk-win64-<version>.zip` from
   https://github.com/alphacep/vosk-api/releases
2. Unzip it anywhere, e.g. `C:\vosk`.
3. Make `libvosk.lib` visible to the linker, either by adding that folder to the
   `LIB` environment variable, or with `RUSTFLAGS`:

   ```powershell
   $env:LIB = "C:\vosk;$env:LIB"
   # or
   $env:RUSTFLAGS = "-L C:\vosk"
   ```

4. `libvosk.dll` is also needed **at runtime**, next to `iagent-desktop.exe`.
   The MSI does not carry it yet — see "Known gaps" below.

### Speech model

`init_voice` loads the model from the relative path `model/vosk-model-en-us-0.22`.
That model is ~1.8 GB and is not in the repository; the small English model
(~40 MB) is enough to smoke-test. Download from https://alphacephei.com/vosk/models
and unzip next to the executable so that `model/<model-name>` resolves.

## Build Steps

### 1. Clone Repository

```bash
git clone https://github.com/STANDUP-SHOW/iagents.git
cd iagents/desktop
```

### 2. Install Dependencies

```bash
npm ci
cd src-tauri && cargo fetch
cd ..
```

### 3. Build Development Version (Debug)

```bash
npm run dev
```

This launches:
- Frontend dev server on http://localhost:5173
- Tauri debug window for testing

Test features before building release version.

### 4. Build Production MSI Installer

```bash
npm run build
```

**Output**: `desktop/src-tauri/target/release/bundle/msi/iAgent Desktop_0.1.0_x64_fr-FR.msi`

Measured at 4.15 MB on the 19/09/2026 CI build. The NSIS installer is built
alongside it, in `desktop/src-tauri/target/release/bundle/nsis/`.

The GitHub Actions workflow publishes both as the `iagent-desktop-installers`
artifact, kept 30 days.

### Script layout

`npm run build` is `tauri build`. The frontend half is `npm run build:web`
(`tsc --noEmit && vite build`), which Tauri runs itself through
`beforeBuildCommand`; run it on its own to check the frontend without paying for
a Rust release build. Do not point `beforeBuildCommand` back at `npm run build`:
that makes the build call itself.

### 5. Install from MSI

1. Run the generated `.msi` installer
2. Follow Windows installation wizard
3. Installer places app in `C:\Program Files\iAgent Desktop\`
4. Desktop shortcut created automatically
5. App available in Start Menu

## Known gaps

- **`libvosk.dll` is not bundled.** The MSI installs the app, but voice
  recognition cannot start until the DLL sits next to the installed
  `iagent-desktop.exe`. Bundling it means adding it to `tauri.bundle.resources`.
- **The speech model is not bundled either**, for the same reason, and it is far
  too large to ship inside the installer. It has to be downloaded on first run or
  installed alongside.
- **Capture runs at 44.1 kHz.** Vosk models are trained at 16 kHz; `rubato` is
  already a dependency but nothing resamples yet, so transcription quality will
  be poor until it does.
- **`database.rs` hardcodes the date** in its `chrono` stand-in: every
  `created_at` reads `2026-09-19` whatever the real date.

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

### Issue: `LINK : fatal error LNK1181: cannot open input file 'libvosk.lib'`

**Cause**: the Vosk native library is missing. `vosk-sys` has no build script, so
cargo never fetches it.

**Solution**: follow "Vosk native library" in the Prerequisites above — the error
is a linker error, not a compiler error, and installing more of Visual Studio
will not fix it.

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
