/**
 * Banc de rendu de l'écran opérateur, sans réseau et sans Box.
 *
 * Même règle que frontend/banc et back-office/banc (23/09/2026) : « vite build »
 * ne voit pas une variable qui n'existe pas, et l'écran final d'une Box ne doit
 * pas planter devant l'opérateur. On rend les quatre moments en SSR sur les
 * rapports témoins de box/usine/tests/temoins (les mêmes que la plateforme et
 * Python rejouent), et on vérifie ce que l'écran doit dire : la référence, le
 * verdict, chaque test, le QR, et jamais « undefined ».
 *   npm --prefix box/usine/ui run banc
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Ecran } from '../src/App.jsx';
import { qr, qrSvg } from '../src/qr.js';

const ici = (p) => fileURLToPath(new URL(p, import.meta.url));
// The bench runs from banc/dist/, three levels under box/usine/.
const TEMOINS = ici('../../../tests/temoins/');
let n = 0;
let fautes = 0;
const verifier = (vrai, m, sinon) => { n++; if (vrai) console.log('  ok  ' + m); else { fautes++; console.error('  ✗   ' + (sinon ?? m)); } };
const texteDe = (html) => html.replace(/<svg[\s\S]*?<\/svg>/g, ' [QR] ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
function rendre(quoi, element) {
  try {
    const texte = texteDe(renderToString(element));
    for (const poison of ['undefined', 'NaN', '[object Object]']) if (texte.includes(poison)) { verifier(false, '', `${quoi} : « ${poison} » à l'écran`); return null; }
    return texte;
  } catch (e) { verifier(false, '', `${quoi} ne se rend pas : ${e && e.message}`); return null; }
}
const rien = () => {};

const temoins = readdirSync(TEMOINS).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(TEMOINS, f), 'utf8')));
verifier(temoins.length >= 3, `${temoins.length} rapports témoins lus`);
const profilsMateriel = [
  { id: 'station-32-v1', nom: 'iAgent Station 32 (32 Go, 1 To)', gammes: ['home', 'business'], a_confirmer: true },
  { id: 'station-64-v1', nom: 'iAgent Station 64 (64 Go, 1 To)', gammes: ['business', 'enterprise'], a_confirmer: true },
  { id: 'station-64-plus-v1', nom: 'iAgent Station 64+ (64 Go, 2 To)', gammes: ['business', 'enterprise'], a_confirmer: true },
  { id: 'vm-qemu', nom: 'Machine virtuelle QEMU', gammes: ['home', 'business', 'enterprise'], a_confirmer: false },
];

console.log('Attente (appareil détecté)');
for (const r of temoins) {
  const etat = { etape: 'attente', inventaire: r.inventaire, profils_materiel: profilsMateriel, jeton_present: true, operateur: r.operateur };
  const t = rendre(`attente ${r.reference}`, <Ecran etat={etat} operateur={r.operateur} setOperateur={rien} profilMateriel={r.profil_materiel} setProfilMateriel={rien} installer={rien} eteindre={rien} />);
  if (!t) continue;
  verifier(t.includes(r.inventaire.cpu) && t.includes(`${r.inventaire.memoire_go} Go`) && t.includes('INSTALLER'), `${r.reference} : l'inventaire et le bouton INSTALLER sont à l'écran`);
  verifier(t.includes('Posé à l'), `${r.reference} : le profil se pose à l'attribution, pas à l'usine (max, 17/10/2026)`);
  verifier(t.includes(r.inventaire.tpm.present ? 'présent' : 'absent'), `${r.reference} : le TPM est dit ${r.inventaire.tpm.present ? 'présent' : 'absent'}`);
}
{
  const sans = rendre('attente sans jeton', <Ecran etat={{ etape: 'attente', inventaire: temoins[0].inventaire, profils_materiel: profilsMateriel, jeton_present: false }} operateur="Léa" setOperateur={rien} profilMateriel="station-64-v1" setProfilMateriel={rien} installer={rien} eteindre={rien} />);
  verifier(sans && sans.includes('aucun jeton d’usine'), "sans jeton d'usine sur la clé, l'écran le dit avant de laisser cliquer");
}

console.log('\nEn cours (contrôles)');
{
  const r = temoins[0];
  const t = rendre('tests en cours', <Ecran etat={{ etape: 'tests', tests: r.tests.slice(0, 4) }} />);
  verifier(t && t.includes('Contrôles en cours') && t.includes(r.tests[0].libelle) && t.includes('PASS'), 'les premiers contrôles s’affichent avec leur verdict pendant que les autres tournent');
  const e = rendre('enrôlement', <Ecran etat={{ etape: 'enrolement', tests: [] }} />);
  verifier(e && e.includes('Enrôlement de la Box') && e.includes('Aucun contrôle encore passé'), "l'enrôlement a son écran");
}

console.log('\nTerminé (rapport déposé)');
for (const r of temoins) {
  const reussi = r.verdict === 'passe';
  const etat = {
    etape: reussi ? 'qualifiee' : 'echec', device: { reference: r.reference, serial: r.serial }, tests: r.tests,
    verdict: { verdict: r.verdict, manquants: r.manquants, echoues: r.echoues },
    reponse_plateforme: { rapport: r, box: { reference: r.reference, serial: r.serial, statut: reussi ? 'qualifiee' : 'usine' } },
  };
  const t = rendre(`terminé ${r.reference}`, <Ecran etat={etat} eteindre={rien} />);
  if (!t) continue;
  verifier(t.includes(`BOX : ${r.reference}`), `${r.reference} : la référence est en gros`);
  verifier(reussi ? t.includes('PRÊTE À EXPÉDIER') && t.includes('[QR]') : t.includes('NE PAS EXPÉDIER') && !t.includes('[QR]'), `${r.reference} : ${reussi ? 'PRÊTE À EXPÉDIER avec son QR' : 'NON CONFORME, sans QR'}`);
  verifier(r.tests.every((x) => t.includes(x.libelle)), `${r.reference} : chaque test du rapport est listé`);
  verifier(t.includes('EXPORTER LE RAPPORT') && t.includes('ÉTEINDRE'), `${r.reference} : exporter et éteindre sont proposés`);
  if (!reussi) verifier(r.echoues.every((id) => t.includes(id)), `${r.reference} : les tests échoués (${r.echoues.join(', ')}) sont nommés`);
  verifier(!t.includes('BEGIN PUBLIC KEY') && !t.includes('a8:b1:c2'), `${r.reference} : ni clé ni adresse MAC sur l'écran final`);
}

console.log('\nQR');
{
  const ref = temoins[0].reference;
  const { taille, modules } = qr(ref);
  verifier(taille === 25, `« ${ref} » (${ref.length} caractères) tient dans un QR de version 2 (25 modules)`);
  const noirs = modules.flat().filter(Boolean).length;
  verifier(noirs > 200 && noirs < 425, `densité plausible (${noirs} modules sombres sur ${taille * taille})`);
  const viseur = (x0, y0) => [0, 6].every((d) => modules[y0 + d][x0] && modules[y0][x0 + d]) && modules[y0 + 3][x0 + 3];
  verifier(viseur(0, 0) && viseur(taille - 7, 0) && viseur(0, taille - 7), 'les trois viseurs sont aux coins');
  verifier(modules[taille - 8][8] === true, 'le module sombre fixe est posé');
  // Timing patterns run between the separators (ISO/IEC 18004 §6.3.5): modules 8 to size-9;
  // the rest of row and column 6 belongs to the finders.
  const synchro = [...Array(taille - 16).keys()].map((k) => k + 8);
  verifier(synchro.every((i) => modules[6][i] === (i % 2 === 0) && modules[i][6] === (i % 2 === 0)), 'les motifs de synchronisation alternent');
  const svg = qrSvg(ref);
  verifier(svg.startsWith('<svg') && svg.includes(`aria-label="QR ${ref}"`) && !svg.includes('undefined'), 'le SVG se produit et nomme la référence');
  let refuse = false;
  try { qr('x'.repeat(120)); } catch { refuse = true; }
  verifier(refuse, 'un texte trop long est refusé plutôt que tronqué');
  verifier(qr('IA-FR-STN-00000001').taille === 25 && qr('A').taille === 21, 'la référence tient en version 2 ; un caractère en version 1');
}

console.log(`\n${n} contrôles, ${fautes} faute(s)`);
process.exit(fautes ? 1 : 0);
