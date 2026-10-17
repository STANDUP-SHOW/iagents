// Banc du pilote : le code que l'application exécute dans la page
// (src-tauri/src/pilote.js), joué dans un vrai Chromium — le moteur de
// WebView2 — sur un formulaire d'inscription écrit pour l'occasion.
//
// Les tests Rust vérifient l'enchaînement des gestes avec une fausse page ;
// seul un vrai moteur dit si un champ rempli l'est pour le site (un setter
// natif que React voit), si une liste choisit la bonne option, si un fichier
// arrive dans le champ, et si un numéro périmé est refusé au lieu de cliquer
// ailleurs.
//
// Lancement : npm i --no-save playwright@1.56.1 && npx playwright install chromium
//             node desktop/check-pilote.mjs
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const SCRIPT = readFileSync(new URL('./src-tauri/src/pilote.js', import.meta.url), 'utf8').trim().replace(/;$/, '')

// Même enveloppe que `code_de` dans pilote.rs.
const code = (action, args) =>
  `(function(){try{return JSON.stringify({ok:(${SCRIPT})(${JSON.stringify(action)},${JSON.stringify(args)})})}catch(e){return JSON.stringify({erreur:String(e&&e.message||e)})}})()`

const PAGE = `<!doctype html><html><head><title>Inscription</title></head><body>
<h1>Créer votre compte</h1>
<form id="f">
  <label for="nom">Nom de l'entreprise</label><input id="nom" required>
  <label>Adresse e-mail <input id="mel" type="email" required></label>
  <label for="mdp">Mot de passe</label><input id="mdp" type="password">
  <label for="cat">Catégorie</label>
  <select id="cat"><option value="">Choisir</option><option value="ai">Intelligence artificielle</option><option value="saas">Logiciel</option></select>
  <label><input id="cgu" type="checkbox"> J'accepte les conditions</label>
  <label for="logo">Logo</label><input id="logo" type="file" accept="image/*">
  <input type="hidden" name="jeton" value="x">
  <button type="submit">Créer mon compte</button>
</form>
<div id="err" role="alert"></div>
<script>
  // Comme React : la valeur n'est retenue que si l'événement input passe.
  let vu = {}
  document.querySelectorAll('input,select').forEach(el => el.addEventListener('input', () => vu[el.id] = el.value))
  document.getElementById('f').addEventListener('submit', e => {
    e.preventDefault()
    const logo = document.getElementById('logo').files[0]
    if (!document.getElementById('cgu').checked) { document.getElementById('err').textContent = 'Acceptez les conditions'; return }
    document.body.innerHTML = '<h1>Bienvenue</h1><p id="res">' + [vu.nom, vu.mel, document.getElementById('cat').value,
      logo ? logo.name + ':' + logo.size + ':' + logo.type : 'sans logo', vu.mdp ? 'mdp' : 'sans mdp'].join('|') + '</p>'
  })
</script></body></html>`

let fautes = 0
const verifier = (vrai, message) => {
  if (!vrai) {
    fautes++
    console.error('ÉCHEC :', message)
  } else console.log('ok :', message)
}

const navigateur = await chromium.launch()
const page = await navigateur.newPage()
await page.setContent(PAGE)
const agir = async (action, args = {}) => JSON.parse(await page.evaluate(code(action, args)))

let lu = (await agir('lire')).ok
const el = (debut) => lu.elements.find((e) => e.libelle.startsWith(debut))
verifier(lu.titre === 'Inscription', 'le titre est lu')
verifier(!lu.elements.some((e) => e.type === 'hidden'), 'un champ caché n’est pas proposé à l’agent')
verifier(el('Nom de l').requis === true && el('Nom de l').genre === 'champ', 'le champ requis est signalé')
verifier(el('Mot de passe').secret === true && el('Mot de passe').valeur === undefined, 'le mot de passe est signalé et jamais lu')
verifier(JSON.stringify(el('Catégorie').options) === JSON.stringify(['Choisir', 'Intelligence artificielle', 'Logiciel']), 'les options de la liste sont lues')
verifier(el('J\'accepte').genre === 'case' && el('J\'accepte').coche === false, 'la case est lue décochée')
verifier(el('Logo').genre === 'fichier' && el('Logo').accepte === 'image/*', 'le champ de fichier est lu')
verifier(el('Créer mon compte').genre === 'bouton', 'le bouton est lu')
verifier(lu.captcha === false, 'pas de captcha')

const refus = await agir('saisir', { ref: el('Mot de passe').ref, libelle: 'Mot de passe', texte: 'x' })
verifier(/saisir_mot_de_passe/.test(refus.erreur || ''), 'saisir refuse un champ de mot de passe')
const perime = await agir('cliquer', { ref: el('Nom de l').ref, libelle: 'Créer mon compte' })
verifier(/la page a changé/.test(perime.erreur || ''), 'un numéro qui ne porte plus le bon libellé est refusé')

await agir('saisir', { ref: el('Nom de l').ref, libelle: el('Nom de l').libelle, texte: 'iAgent Tech "});alert(1);//' })
await agir('saisir', { ref: el('Adresse e-mail').ref, libelle: 'Adresse e-mail', texte: 'contact@iagent.agency' })
await agir('saisir', { ref: el('Mot de passe').ref, libelle: 'Mot de passe', texte: 'Secret-123', secret: true })
const choix = await agir('choisir', { ref: el('Catégorie').ref, libelle: 'Catégorie', option: 'intelligence' })
verifier(choix.ok && choix.ok.choisi === 'Intelligence artificielle', 'une option se choisit par une partie de son texte')
const absente = await agir('choisir', { ref: el('Catégorie').ref, libelle: 'Catégorie', option: 'Jardinage' })
verifier(/option introuvable/.test(absente.erreur || '') && /Logiciel/.test(absente.erreur), 'une option absente est refusée en listant les options')
const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64')
const tel = await agir('televerser', { ref: el('Logo').ref, libelle: 'Logo', fichiers: [{ nom: 'logo.png', type: 'image/png', base64: png }] })
verifier(tel.ok && tel.ok.fichiers[0] === 'logo.png', 'le logo arrive dans le champ de fichier')

// Envoi sans cocher : l'erreur du site doit se lire.
await agir('cliquer', { ref: el('Créer mon compte').ref, libelle: 'Créer mon compte' })
lu = (await agir('lire')).ok
verifier(lu.alertes.includes('Acceptez les conditions'), 'le message d’erreur du site est lu')
await agir('cocher', { ref: el('J\'accepte').ref, libelle: el('J\'accepte').libelle, coche: true })
const cible = (await agir('cible', { ref: el('Créer mon compte').ref, libelle: 'Créer mon compte' })).ok
verifier(cible.x > 0 && cible.y > 0, 'le bouton a une position pour un vrai clic')
// Le vrai clic de souris, comme le fait le protocole DevTools sous Windows.
await page.mouse.click(cible.x, cible.y)
await page.waitForSelector('#res')
const res = await page.textContent('#res')
verifier(
  res === 'iAgent Tech "});alert(1);//|contact@iagent.agency|ai|logo.png:8:image/png|mdp',
  `le site a reçu chaque valeur (${res})`,
)
// La vraie frappe du protocole DevTools (Input.insertText), après focaliser.
await page.setContent(PAGE)
lu = (await agir('lire')).ok
const cdp = await page.context().newCDPSession(page)
const foc = await agir('focaliser', { ref: el('Nom de l').ref, libelle: el('Nom de l').libelle })
verifier(foc.ok && foc.ok.fait, 'le champ prend le curseur')
await cdp.send('Input.insertText', { text: 'Frappé au clavier' })
await agir('confirmer', { ref: el('Nom de l').ref, libelle: el('Nom de l').libelle })
verifier((await page.inputValue('#nom')) === 'Frappé au clavier', 'la frappe réelle remplit le champ')
const etat = (await agir('etat')).ok
verifier(etat.pret === 'complete' && etat.titre === 'Inscription', 'l’état de la page se lit')

await navigateur.close()
if (fautes) {
  console.error(`${fautes} faute(s)`)
  process.exit(1)
}
console.log('pilote : tout est bon')
