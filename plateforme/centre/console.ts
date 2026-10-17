// The call centre's console: one page served by the platform, without data.
// It asks for the back-office secret, keeps it for the tab only
// (sessionStorage), and reads /centre/etat with it. Everything it shows is
// escaped: a WhatsApp message is text written by a stranger.

export const CONSOLE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Centre d'appels iAgent</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--nuit:#150041;--fond:#0b0624;--verre:rgba(255,255,255,.06);--trait:rgba(255,255,255,.14);--texte:#f3f1ff;--doux:#b9b3d6;--cyan:#03F3FF;--rose:#E65090;--orange:#F28E44;--vert:#7be3a0;
--degrade:linear-gradient(90deg,#E5007E 0%,#E6216D 22.63%,#DE6970 29.33%,#BCCE00 37.71%,#76CAE9 57.26%,#B61180 71.23%,#ED744B 84.08%,#FDC802 97.49%)}
*{box-sizing:border-box}
body{margin:0;font-family:Montserrat,system-ui,sans-serif;background:radial-gradient(1200px 600px at 80% -10%,#2a0b5c 0%,transparent 60%),var(--fond);color:var(--texte);min-height:100vh}
header{display:flex;align-items:center;gap:16px;padding:18px 24px;border-bottom:1px solid var(--trait)}
header h1{font-size:18px;margin:0;font-weight:700;letter-spacing:.02em}
header .barre{height:4px;flex:1;background:var(--degrade);border-radius:2px;opacity:.8}
main{max-width:1200px;margin:0 auto;padding:20px 16px 60px;display:grid;gap:18px}
.carte{background:var(--verre);border:1px solid var(--trait);border-radius:14px;padding:16px 18px;backdrop-filter:blur(8px)}
.carte h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:var(--cyan);margin:0 0 12px}
.grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.canal{padding:10px 12px;border-radius:10px;border:1px solid var(--trait);font-size:13px}
.canal b{display:block;margin-bottom:4px}
.on{border-color:rgba(123,227,160,.6)} .on b{color:var(--vert)}
.off{border-color:rgba(242,142,68,.6)} .off b{color:var(--orange)}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{text-align:left;padding:8px 6px;border-bottom:1px solid var(--trait);vertical-align:top}
th{color:var(--doux);font-weight:500}
.pastille{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;border:1px solid var(--trait)}
.p-agent{color:var(--cyan)} .p-humain{color:var(--orange)} .p-terminee{color:var(--doux)} .p-urgent{color:#fff;background:var(--rose);border-color:var(--rose)}
details{border-bottom:1px solid var(--trait);padding:8px 0}
summary{cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px}
.fil{margin:10px 0 4px;display:grid;gap:6px}
.bulle{max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.45;white-space:pre-wrap}
.contact{background:rgba(255,255,255,.08);justify-self:start}
.agent{background:rgba(3,243,255,.12);justify-self:end}
.humain{background:rgba(242,142,68,.18);justify-self:end}
.systeme{font-size:11px;color:var(--doux);justify-self:center;font-family:ui-monospace,monospace;white-space:normal}
.meta{font-size:11px;color:var(--doux)}
.qualif{font-size:12px;color:var(--doux);margin:6px 0}
input,textarea{font:inherit;color:var(--texte);background:rgba(0,0,0,.3);border:1px solid var(--trait);border-radius:8px;padding:8px 10px;width:100%}
form{display:grid;gap:8px}
.ligne{display:flex;gap:8px;flex-wrap:wrap}
.ligne>*{flex:1;min-width:160px}
button{justify-self:start;font:inherit;font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.06em;color:#fff;background:var(--degrade);border:0;padding:10px 16px;border-radius:0 18px 0 18px;cursor:pointer}
button.discret{background:transparent;border:1px solid var(--trait);border-radius:8px;text-transform:none;letter-spacing:0;font-weight:500}
.message{font-size:13px;min-height:1em}
.erreur{color:var(--orange)} .bon{color:var(--vert)}
#porte{max-width:420px;margin:80px auto}
.vide{color:var(--doux);font-size:13px}
</style>
</head>
<body>
<header><h1>Centre d'appels iAgent</h1><div class="barre"></div><button class="discret" id="sortir" hidden>Fermer la session</button></header>
<main id="app">
  <section class="carte" id="porte">
    <h2>Accès réservé</h2>
    <form id="f-porte"><input type="password" id="secret" placeholder="Secret du back-office" autocomplete="current-password"><button>Entrer</button><div class="message" id="m-porte"></div></form>
  </section>
</main>
<script>
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let secret = ''; try { secret = sessionStorage.getItem('centre-secret') || ''; } catch {}
const quand = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
async function api(chemin, corps) {
  const r = await fetch(chemin, { method: corps ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + secret, ...(corps ? { 'content-type': 'application/json' } : {}) }, body: corps ? JSON.stringify(corps) : undefined });
  const v = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(v.erreur || v.message || ('Refus ' + r.status));
  return v;
}
const NOMS = { cerveau: 'Assistante (modèle de langage)', whatsapp: 'WhatsApp', telephone: 'Appels entrants', appels_sortants: 'Appels sortants', transfert: 'Transfert vers un conseiller' };
function canaux(c) {
  return '<div class="grille">' + Object.entries(NOMS).map(([k, nom]) => c[k] === null
    ? '<div class="canal on"><b>' + esc(nom) + ' : branché</b></div>'
    : '<div class="canal off"><b>' + esc(nom) + ' : pas encore branché</b>' + esc(c[k]) + '</div>').join('') + '</div>';
}
function conversation(c, urgent) {
  const q = Object.entries(c.qualification || {}).map(([k, v]) => esc(k) + ' : ' + esc(v)).join(' · ');
  const fil = c.tours.map((t) => '<div class="bulle ' + esc(t.qui) + '">' + esc(t.texte) + (t.qui !== 'systeme' ? '<div class="meta">' + esc(t.qui === 'contact' ? (c.nom || c.contact) : t.qui === 'agent' ? 'Assistante' : 'Conseiller') + ' · ' + esc(quand(t.le)) + '</div>' : '') + '</div>').join('');
  const actions = (c.canal === 'whatsapp'
    ? '<form data-rep="' + esc(c.id) + '"><textarea rows="2" placeholder="Répondre en tant que conseiller"></textarea><div class="ligne"><button>Envoyer sur WhatsApp</button></div></form>' : '')
    + '<div class="ligne" style="margin-top:8px">' + (c.etat === 'humain' ? '<button class="discret" data-agent="' + esc(c.id) + '">Rendre à l’assistante</button>' : '')
    + (c.transfert && c.transfert.statut === 'a-traiter' ? '<button class="discret" data-traite="' + esc(c.id) + '">Marquer comme traité</button>' : '') + '</div><div class="message"></div>';
  return '<details' + (urgent ? ' open' : '') + '><summary>'
    + (urgent ? '<span class="pastille p-urgent">À traiter</span>' : '')
    + '<span class="pastille">' + (c.canal === 'whatsapp' ? 'WhatsApp' : c.sens === 'sortant' ? 'Appel sortant' : 'Appel entrant') + '</span>'
    + '<b>' + esc(c.nom || c.contact) + '</b><span class="meta">' + esc(c.contact) + ' · ' + esc(quand(c.maj_le)) + '</span>'
    + '<span class="pastille p-' + esc(c.etat) + '">' + ({ agent: 'assistante', humain: 'conseiller', terminee: 'terminée' }[c.etat] || esc(c.etat)) + '</span></summary>'
    + (c.transfert ? '<div class="qualif">Transfert : ' + esc(c.transfert.motif) + (c.transfert.resume ? ' — ' + esc(c.transfert.resume) : '') + '</div>' : '')
    + (q ? '<div class="qualif">Qualification : ' + q + '</div>' : '')
    + '<div class="fil">' + fil + '</div>' + actions + '</details>';
}
async function charger() {
  let e;
  try { e = await api('/centre/etat'); } catch (err) { secret = ''; try { sessionStorage.removeItem('centre-secret'); } catch {} location.reload(); return; }
  $('#sortir').hidden = false;
  const urgents = new Set(e.a_traiter);
  const convs = [...e.conversations].sort((a, b) => (urgents.has(b.id) - urgents.has(a.id)));
  $('#app').innerHTML =
    (e.demonstration ? '<section class="carte" style="border-color:var(--orange)"><b style="color:var(--orange)">Démonstration</b> — Meta, Twilio et le modèle de langage sont simulés sur cette machine ; les parcours, le journal, les rendez-vous et les refus sont ceux du vrai code.</section>' : '')
    + '<section class="carte"><h2>Canaux</h2>' + canaux(e.canaux) + '</section>'
    + '<section class="carte"><h2>Rendez-vous à venir (' + e.rendez_vous.length + ')</h2>' + (e.rendez_vous.length
      ? '<table><tr><th>Quand</th><th>Qui</th><th>Entreprise</th><th>Objet</th><th>Numéro</th></tr>' + e.rendez_vous.map((r) => '<tr><td>' + esc(quand(r.debut)) + '</td><td>' + esc(r.nom) + '</td><td>' + esc(r.entreprise || '') + '</td><td>' + esc(r.objet) + '</td><td>' + esc(r.contact) + '</td></tr>').join('') + '</table>'
      : '<div class="vide">Aucun rendez-vous réservé.</div>') + '</section>'
    + '<section class="carte"><h2>Conversations (' + convs.length + (urgents.size ? ', dont ' + urgents.size + ' à traiter' : '') + ')</h2>' + (convs.length ? convs.map((c) => conversation(c, urgents.has(c.id))).join('') : '<div class="vide">Aucune conversation pour l’instant.</div>') + '</section>'
    + '<section class="carte"><h2>Appeler une personne qui l’a accepté</h2><form id="f-appel"><div class="ligne"><input name="e164" placeholder="+33612345678"><input name="objet" placeholder="Objet annoncé, ex. votre demande de devis"></div><button>Lancer l’appel</button><div class="message"></div></form>'
    + '<h2 style="margin-top:18px">Enregistrer un consentement</h2><form id="f-consent"><div class="ligne"><input name="e164" placeholder="+33612345678"><input name="nom" placeholder="Nom"></div><div class="ligne"><input name="source" placeholder="Source : formulaire du site, demande écrite…"><input name="preuve" placeholder="Preuve : texte accepté, référence"></div><button>Enregistrer</button><div class="message"></div></form>'
    + '<table style="margin-top:12px"><tr><th>Numéro</th><th>Nom</th><th>Consentement</th><th>Appels</th></tr>' + e.contacts.map((c) => '<tr><td>' + esc(c.e164) + '</td><td>' + esc(c.nom) + '</td><td>' + (c.retire_le ? '<span class="erreur">retiré le ' + esc(quand(c.retire_le)) + '</span>' : c.consentement ? esc(c.consentement.source) + ' · ' + esc(quand(c.consentement.date)) : '<span class="meta">aucun</span>') + '</td><td>' + c.appels.length + '</td></tr>').join('') + '</table></section>'
    + '<p class="meta">Les conversations de plus de ' + e.reglages.conservation_jours + ' jours sont effacées automatiquement.</p>';
  brancher();
}
function message(el, texte, bon) { el.textContent = texte; el.className = 'message ' + (bon ? 'bon' : 'erreur'); }
function brancher() {
  document.querySelectorAll('form[data-rep]').forEach((f) => f.addEventListener('submit', async (ev) => {
    ev.preventDefault(); const m = f.parentElement.querySelector('.message');
    try { await api('/centre/conversations/' + encodeURIComponent(f.dataset.rep) + '/reponse', { texte: f.querySelector('textarea').value }); charger(); } catch (err) { message(m, err.message); }
  }));
  document.querySelectorAll('[data-agent]').forEach((b) => b.addEventListener('click', async () => { await api('/centre/conversations/' + encodeURIComponent(b.dataset.agent) + '/agent', {}); charger(); }));
  document.querySelectorAll('[data-traite]').forEach((b) => b.addEventListener('click', async () => { await api('/centre/conversations/' + encodeURIComponent(b.dataset.traite) + '/traite', {}); charger(); }));
  for (const [id, chemin, fin] of [['#f-appel', '/centre/appels', 'Appel lancé.'], ['#f-consent', '/centre/contacts', 'Consentement enregistré.']]) {
    const f = $(id); f.addEventListener('submit', async (ev) => {
      ev.preventDefault(); const m = f.querySelector('.message');
      try { await api(chemin, Object.fromEntries(new FormData(f))); message(m, fin, true); setTimeout(charger, 800); } catch (err) { message(m, err.message); }
    });
  }
}
$('#f-porte').addEventListener('submit', async (ev) => {
  ev.preventDefault(); secret = $('#secret').value.trim();
  try { await api('/centre/etat'); try { sessionStorage.setItem('centre-secret', secret); } catch {} charger(); } catch (err) { message($('#m-porte'), 'Secret refusé.'); }
});
$('#sortir').addEventListener('click', () => { try { sessionStorage.removeItem('centre-secret'); } catch {} location.reload(); });
if (secret) charger();
setInterval(() => { if (secret && !document.querySelector('textarea:focus, input:focus')) charger(); }, 15000);
</script>
</body>
</html>`;
