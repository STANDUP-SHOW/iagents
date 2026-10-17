// A small QR code encoder (ISO/IEC 18004), byte mode, error correction L,
// versions 1 to 5 (up to 108 bytes), mask pattern 0, written after the public
// reference implementation of Nayuki. It encodes the ONE thing the brief lets a
// label carry (§42): the commercial reference `IA-FR-STN-00000127`, never a key,
// never a client. Shared by the factory screen (box/usine/ui) and the back-office
// label view: one encoder, no dependency.

const CAPACITE_L = [19, 34, 55, 80, 108]; // data codewords, versions 1..5, EC level L
const EC_L = [7, 10, 15, 20, 26]; // EC codewords, one block

// GF(256) with the QR primitive polynomial 0x11D.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function generateur(degre) {
  let g = [1];
  for (let i = 0; i < degre; i++) {
    const suivant = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      suivant[j] ^= g[j];
      suivant[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = suivant;
  }
  return g;
}

function correction(donnees, degre) {
  const g = generateur(degre);
  const reste = new Array(degre).fill(0);
  for (const d of donnees) {
    const facteur = d ^ reste.shift();
    reste.push(0);
    for (let j = 0; j < degre; j++) reste[j] ^= mul(g[j + 1], facteur);
  }
  return reste;
}

/** The bit stream of byte-mode data for the chosen version, padded as the standard asks. */
function motsDeDonnees(octets, version) {
  const capacite = CAPACITE_L[version - 1];
  const bits = [];
  const pousser = (valeur, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valeur >>> i) & 1); };
  pousser(0b0100, 4);
  pousser(octets.length, 8);
  for (const o of octets) pousser(o, 8);
  pousser(0, Math.min(4, capacite * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const mots = [];
  for (let i = 0; i < bits.length; i += 8) mots.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let i = 0; mots.length < capacite; i++) mots.push(i % 2 === 0 ? 0xec : 0x11);
  return mots;
}

/** Modules of the QR code for `texte` (UTF-8): `{ taille, modules }`, modules[y][x] true = dark. */
export function qr(texte) {
  const octets = Array.from(new TextEncoder().encode(texte));
  const version = CAPACITE_L.findIndex((c) => c >= octets.length + 3) + 1; // 4 bits mode + 8 bits length + terminator fit in 3 bytes
  if (version === 0) throw new Error(`Texte trop long pour un QR de version 5 (${octets.length} octets, 105 au plus).`);
  const taille = 17 + 4 * version;
  const modules = Array.from({ length: taille }, () => new Array(taille).fill(false));
  const fonction = Array.from({ length: taille }, () => new Array(taille).fill(false));
  const poser = (x, y, sombre) => { modules[y][x] = sombre; fonction[y][x] = true; };

  // Timing patterns, finders, separators, alignment (one, versions 2..6), dark module, format areas.
  for (let i = 0; i < taille; i++) { poser(6, i, i % 2 === 0); poser(i, 6, i % 2 === 0); }
  const viseur = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx; const y = cy + dy;
      if (x < 0 || y < 0 || x >= taille || y >= taille) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      poser(x, y, d !== 2 && d !== 4);
    }
  };
  viseur(3, 3); viseur(taille - 4, 3); viseur(3, taille - 4);
  if (version >= 2) {
    const c = taille - 7;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poser(c + dx, c + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const format = (bits) => {
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) poser(8, i, bit(i));
    poser(8, 7, bit(6)); poser(8, 8, bit(7)); poser(7, 8, bit(8));
    for (let i = 9; i < 15; i++) poser(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) poser(taille - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) poser(8, taille - 15 + i, bit(i));
    poser(8, taille - 8, true);
  };
  format(0); // reserve the area; real bits below

  // Data: codewords + EC, zigzag placement from the bottom right, skipping the vertical timing column.
  const donnees = motsDeDonnees(octets, version);
  const mots = donnees.concat(correction(donnees, EC_L[version - 1]));
  let i = 0;
  for (let droite = taille - 1; droite >= 1; droite -= 2) {
    if (droite === 6) droite = 5;
    for (let vert = 0; vert < taille; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = droite - j;
        const monte = ((droite + 1) & 2) === 0;
        const y = monte ? taille - 1 - vert : vert;
        if (!fonction[y][x] && i < mots.length * 8) {
          modules[y][x] = ((mots[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }
  // Mask 0 on data modules, then the format information for (EC L, mask 0): BCH(15,5) with 0x537, XOR 0x5412.
  for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) if (!fonction[y][x] && (x + y) % 2 === 0) modules[y][x] = !modules[y][x];
  const data = (0b01 << 3) | 0;
  let reste = data;
  for (let k = 0; k < 10; k++) reste = (reste << 1) ^ ((reste >>> 9) * 0x537);
  format(((data << 10) | reste) ^ 0x5412);
  return { taille, modules };
}

/** An SVG string of the QR code, with the quiet zone of four modules the standard asks for. */
export function qrSvg(texte, pixels = 160) {
  const { taille, modules } = qr(texte);
  const total = taille + 8;
  let chemin = '';
  for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) if (modules[y][x]) chemin += `M${x + 4} ${y + 4}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${pixels}" height="${pixels}" shape-rendering="crispEdges" role="img" aria-label="QR ${texte}"><rect width="${total}" height="${total}" fill="#fff"/><path d="${chemin}" fill="#000"/></svg>`;
}
