# 🚀 iAgents - Quick Start Guide

## Website Deployment Status

### ✅ Frontend Ready for Deployment

The website frontend is built and configured for deployment. It includes:
- 1,249 agent profiles fully loaded
- Search and filter functionality
- Download button for Windows app
- Responsive dark-themed design

### 🔄 Current Deployment Path

**Automatic GitHub Pages Deployment:**
- Triggered by: Last push to main branch (2026-09-19)
- Workflow: `.github/workflows/deploy-frontend.yml`
- Destination: GitHub Pages (gh-pages branch)
- Custom Domain: iagent.agency

**Check deployment status:**
1. Go to: https://github.com/STANDUP-SHOW/iagents/actions
2. Look for: "Deploy Frontend" workflow
3. Latest run should show ✅ if successful

**Access the website:**
- Temporary GitHub Pages URL: `https://standup-show.github.io/iagents`
- Custom domain (once DNS configured): `https://iagent.agency`

---

## Windows Desktop App

### 📦 Build Status: Ready

The desktop app (Tauri-based) is ready to build. Build automation is set up in GitHub Actions.

### 🎯 Build Options

**Option 1: GitHub Actions (Recommended)**
- No local setup required
- Runs on GitHub's Windows servers
- Creates MSI installer automatically
- Release downloadable from GitHub

**Steps:**
1. Go to: https://github.com/STANDUP-SHOW/iagents/actions
2. Select: "Build Windows MSI" workflow
3. Click: "Run workflow" button
4. Select branch: `main`
5. Wait for build to complete (~10-15 minutes)
6. MSI file appears in: Releases → Latest

**Option 2: Local Build (Advanced)**
- Requirements: Windows 10/11, Rust, Node.js 18+, VS Build Tools
- Run from `desktop/` directory:
  ```bash
  npm install
  npm run build
  # MSI file: src-tauri/target/release/bundle/msi/iagent-x.x.x.msi
  ```

---

## Current Status Checklist

| Component | Status | Action |
|-----------|--------|--------|
| Frontend Build | ✅ Complete | - |
| Frontend Deployment | 🔄 In Progress | Monitor GitHub Actions |
| Website URL | ⏳ Pending | Configure DNS for iagent.agency |
| Download Button | ✅ Added | Links to GitHub Releases |
| Windows MSI Build | ⏳ Pending | Trigger in GitHub Actions |
| MSI Download | ⏳ Pending | After MSI build completes |

---

## Next Actions

### Immediate (Next 5 minutes)

1. **Monitor Frontend Deployment**
   ```
   GitHub → Actions → "Deploy Frontend" → Latest run
   ```
   ✅ When green: Website is live on GitHub Pages
   
2. **Trigger Windows Build**
   ```
   GitHub → Actions → "Build Windows MSI" → Run workflow
   ```
   ✅ When complete: MSI ready in Releases

### Short-term (Next 30 minutes)

3. **Test Website**
   - Temporary: https://standup-show.github.io/iagents
   - Click "Télécharger App" button
   - Should link to GitHub Releases

4. **Configure Custom Domain** (if using iagent.agency)
   - Update DNS CNAME to: `standup-show.github.io`
   - Repository Settings → Pages → Custom domain: `iagent.agency`
   - Wait for DNS propagation (5-48 hours)

5. **Download and Test MSI**
   - Once build completes
   - Download from GitHub Releases
   - Install on Windows 10/11
   - Test agent loading and functionality

---

## Direct Links

| Purpose | Link |
|---------|------|
| Repository | https://github.com/STANDUP-SHOW/iagents |
| GitHub Actions | https://github.com/STANDUP-SHOW/iagents/actions |
| Releases (MSI) | https://github.com/STANDUP-SHOW/iagents/releases |
| Repository Settings | https://github.com/STANDUP-SHOW/iagents/settings |
| Pages Config | https://github.com/STANDUP-SHOW/iagents/settings/pages |

---

## Troubleshooting

### "Deploy Frontend" workflow failed
- Check: Node.js version (should be 22)
- Check: npm dependencies installed correctly
- Re-run: Click workflow → "Re-run failed jobs"

### "Build Windows MSI" workflow failed
- Check: Rust toolchain available
- Check: ANTHROPIC_API_KEY set in secrets
- Check: Node.js 18+ available
- Re-run: Click workflow → "Re-run failed jobs"

### Website not visible at iagent.agency
- Check: DNS CNAME record configured
- Check: Repository Pages enabled
- Check: Deployment completed successfully
- DNS changes can take 5-48 hours to propagate

---

**Last Updated:** 2026-09-19
**Backend**: Express + Prisma (ready)
**Frontend**: React + Vite (deployed)
**Desktop**: Tauri (build pending)
