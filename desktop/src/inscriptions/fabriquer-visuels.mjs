// Fabrique l'avatar et les bannières que les agents joignent aux comptes
// d'iAgent, depuis le logo officiel (charte du 07/10) et la police Montserrat
// du site, rendus par un vrai Chromium. Les fichiers produits sont gardés au
// dépôt et compilés dans l'application (inscriptions.rs) : ce script sert à
// les refaire si la charte change.
//
// Lancement : npm i --no-save playwright@1.56.1 && npx playwright install chromium
//             node desktop/src/inscriptions/fabriquer-visuels.mjs
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const ici = new URL('./', import.meta.url)
const racine = new URL('../../../', import.meta.url)
const lire64 = (chemin) => readFileSync(new URL(chemin, racine)).toString('base64')

const LOGO = `data:image/svg+xml;base64,${lire64('frontend/public/accueil/logo-iagent.svg')}`
const ICONE = `data:image/png;base64,${lire64('frontend/public/accueil/icone-iagent.png')}`
const police = (poids) =>
  `@font-face{font-family:Montserrat;font-weight:${poids};src:url(data:font/woff2;base64,${lire64(`frontend/public/polices/montserrat-latin-${poids}-normal.woff2`)}) format('woff2')}`

// Dégradé et bleu nuit de la charte e-agent (07/10).
const DEGRADE =
  'linear-gradient(90deg,#E5007E 0%,#E6216D 22.63%,#DE6970 29.33%,#BCCE00 37.71%,#76CAE9 57.26%,#B61180 71.23%,#ED744B 84.08%,#FDC802 97.49%)'
const NUIT = '#150041'

const style = `${police(400)}${police(600)}${police(800)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:${NUIT};font-family:Montserrat,sans-serif;color:#fff;overflow:hidden}
.fond{position:absolute;inset:0;background:
  radial-gradient(ellipse 60% 90% at 85% 50%,rgba(118,202,233,.20),transparent 70%),
  radial-gradient(ellipse 50% 80% at 10% 100%,rgba(229,0,126,.22),transparent 70%),
  linear-gradient(135deg,#11042E 0%,${NUIT} 55%,#211044 100%)}
.trait{position:absolute;left:0;right:0;bottom:0;background:${DEGRADE}}
.zone{position:absolute;display:flex;align-items:center;justify-content:center}
.bloc{display:flex;align-items:center}
.texte{display:flex;flex-direction:column}
.titre{font-weight:800;letter-spacing:-.01em;line-height:1.05}
.sous{font-weight:600;color:#CFC8F0;margin-top:.5em}
.sous b{background:${DEGRADE};-webkit-background-clip:text;background-clip:text;color:transparent}`

// largeur, hauteur, zone sûre (là où chaque réseau ne rogne pas), tailles.
const BANNIERES = [
  { nom: 'banniere-iagent-1500x500.jpg', l: 1500, h: 500, sur: [1500, 360], logo: 300, titre: 58, sous: 26, trait: 10 },
  { nom: 'banniere-iagent-facebook-1640x624.jpg', l: 1640, h: 624, sur: [1400, 420], logo: 330, titre: 62, sous: 28, trait: 12 },
  { nom: 'banniere-iagent-linkedin-1128x191.jpg', l: 1128, h: 191, sur: [1000, 150], logo: 190, titre: 36, sous: 16, trait: 6 },
  { nom: 'banniere-iagent-youtube-2560x1440.jpg', l: 2560, h: 1440, sur: [1546, 423], logo: 390, titre: 64, sous: 28, trait: 16 },
]

const navigateur = await chromium.launch()

for (const b of BANNIERES) {
  const page = await navigateur.newPage({ viewport: { width: b.l, height: b.h } })
  await page.setContent(`<!doctype html><html><head><style>${style}</style></head><body>
<div class="fond"></div>
<div class="zone" style="left:${(b.l - b.sur[0]) / 2}px;top:${(b.h - b.sur[1]) / 2}px;width:${b.sur[0]}px;height:${b.sur[1]}px">
  <div class="bloc" style="gap:${Math.round(b.logo * 0.18)}px">
    <img src="${LOGO}" style="width:${b.logo}px">
    <div style="width:2px;align-self:stretch;background:rgba(255,255,255,.18)"></div>
    <div class="texte">
      <div class="titre" style="font-size:${b.titre}px">Vos collaborateurs IA<br>par métier</div>
      <div class="sous" style="font-size:${b.sous}px">Voix · logiciels métier · <b>cloud, local ou hybride</b></div>
    </div>
  </div>
</div>
<div class="trait" style="height:${b.trait}px"></div>
</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: new URL(`visuels/${b.nom}`, ici).pathname, type: 'jpeg', quality: 92 })
  await page.close()
  console.log('écrit :', b.nom)
}

// Avatar carré : l'icône sur son propre bleu nuit, avec la marge qu'il faut
// pour qu'un rognage en cercle ne coupe ni le nuage ni les connexions ; le
// bord arrondi de l'icône est rogné, sinon son liseré se voit sur le fond.
const page = await navigateur.newPage({ viewport: { width: 800, height: 800 } })
await page.setContent(`<!doctype html><html><head><style>${style}</style></head><body>
<div class="zone" style="inset:0"><div style="width:600px;height:600px;overflow:hidden;display:flex;align-items:center;justify-content:center"><img src="${ICONE}" style="width:700px;flex:none"></div></div></body></html>`)
await page.screenshot({ path: new URL('visuels/avatar-iagent-800.png', ici).pathname })
console.log('écrit : avatar-iagent-800.png')
await navigateur.close()
