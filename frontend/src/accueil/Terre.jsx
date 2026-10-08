import { useEffect, useRef } from 'react';

// A tiny deterministic 3D value noise, enough to draw continents and the
// clusters of their cities. No library, no image to download.
const hash = (x, y, z) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const lisse = (t) => t * t * (3 - 2 * t);
function bruit(x, y, z) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
  const xf = lisse(x - xi); const yf = lisse(y - yi); const zf = lisse(z - zi);
  const m = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
  return m(
    m(m(c(0, 0, 0), c(1, 0, 0), xf), m(c(0, 1, 0), c(1, 1, 0), xf), yf),
    m(m(c(0, 0, 1), c(1, 0, 1), xf), m(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}
const fbm = (x, y, z) => bruit(x, y, z) * 0.55 + bruit(x * 2.1, y * 2.1, z * 2.1) * 0.28 + bruit(x * 4.3, y * 4.3, z * 4.3) * 0.17;

/**
 * The Earth seen from space at night, as on max's mockups: a dark planet, a
 * cyan atmosphere on its rim and the golden lights of its cities. Drawn on a
 * canvas from noise, so the hero weighs nothing and no photo is downloaded.
 * `cx`, `cy`, `r` place the planet as fractions of the canvas.
 */
export default function Terre({ className = '', cx = 0.62, cy = 1.02, r = 0.78 }) {
  const toile = useRef(null);

  useEffect(() => {
    const c = toile.current;
    const ctx = c.getContext('2d');
    const petit = window.innerWidth < 900;
    // Random points on the sphere (no grid: a grid shows), kept where the
    // noise says « land », and the cities where a finer noise is dense.
    const N = petit ? 26000 : 60000;
    const terres = [];
    const villes = [];
    for (let i = 0; i < N; i++) {
      const u = hash(i, 11, 5) * 2 - 1;
      const t = hash(i, 3, 17) * Math.PI * 2;
      const rr = Math.sqrt(1 - u * u);
      const p = [Math.cos(t) * rr, u, Math.sin(t) * rr];
      const v = fbm(p[0] * 1.6 + 3, p[1] * 1.6 + 7, p[2] * 1.6 + 11);
      if (v < 0.565) continue;
      terres.push([...p, v]);
      const dens = fbm(p[0] * 9 + 1, p[1] * 9 + 2, p[2] * 9 + 3) + (v - 0.565) * 0.8;
      if (dens > 0.56 && hash(i, 7, 3) < (dens - 0.5) * 3.2) villes.push([...p, 0.35 + hash(i, 1, 9) * 0.65, hash(i, 2, 4) < 0.08]);
    }

    let l = 0; let h = 0; let dpr = 1;
    const angle = 2.35;
    const incl = 0.5;
    const dessiner = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      l = c.clientWidth; h = c.clientHeight;
      c.width = Math.max(1, l * dpr); c.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, l, h);
      const R = Math.max(l, h) * r * 0.62;
      const X = l * cx; const Y = h * cy;
      // the atmosphere, a cyan halo hugging the planet
      const halo = ctx.createRadialGradient(X, Y, R * 0.96, X, Y, R * 1.16);
      halo.addColorStop(0, 'rgba(3,243,255,0.65)');
      halo.addColorStop(0.12, 'rgba(30,170,255,0.35)');
      halo.addColorStop(0.45, 'rgba(20,90,200,0.10)');
      halo.addColorStop(1, 'rgba(3,60,160,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(X, Y, R * 1.16, 0, Math.PI * 2); ctx.fill();
      // the ocean, lit from the upper left
      const mer = ctx.createRadialGradient(X - R * 0.3, Y - R * 0.7, R * 0.05, X, Y, R);
      mer.addColorStop(0, '#0d3358');
      mer.addColorStop(0.5, '#061a33');
      mer.addColorStop(1, '#020a17');
      ctx.fillStyle = mer; ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.clip();

      const ca = Math.cos(angle); const sa = Math.sin(angle);
      const ci = Math.cos(incl); const si = Math.sin(incl);
      const proj = (p) => {
        const x = p[0] * ca - p[2] * sa;
        const z0 = p[0] * sa + p[2] * ca;
        const y = p[1] * ci - z0 * si;
        const z = p[1] * si + z0 * ci;
        return [X + x * R, Y - y * R, z];
      };
      // land: soft overlapping blobs that melt into continents
      const tache = R * (petit ? 0.014 : 0.0095);
      for (const p of terres) {
        const [x, y, z] = proj(p);
        if (z < 0 || y > h + 10 || y < -10 || x < -10 || x > l + 10) continue;
        const relief = (p[3] - 0.565) * 3;
        ctx.fillStyle = `rgba(${34 + relief * 30},${66 + relief * 30},${96 + relief * 20},${0.10 + z * 0.16})`;
        ctx.beginPath(); ctx.ellipse(x, y, tache * (0.4 + z * 0.8), tache * (0.4 + z * 0.8) * Math.max(0.35, z), 0, 0, Math.PI * 2); ctx.fill();
      }
      // the cities at night
      ctx.globalCompositeOperation = 'lighter';
      for (const p of villes) {
        const [x, y, z] = proj(p);
        if (z < 0.05 || y > h + 6 || y < -6 || x < -6 || x > l + 6) continue;
        const a = Math.min(1, z * 1.5) * p[3];
        const g = p[4] ? 9 : 4.5;
        const lueur = ctx.createRadialGradient(x, y, 0, x, y, g);
        lueur.addColorStop(0, `rgba(255,196,110,${a * 0.5})`);
        lueur.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = lueur; ctx.fillRect(x - g, y - g, g * 2, g * 2);
        ctx.fillStyle = `rgba(255,228,170,${a})`;
        ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      }
      ctx.globalCompositeOperation = 'source-over';
      // night falls towards the lower right
      const nuit = ctx.createLinearGradient(X - R * 0.6, Y - R, X + R * 0.7, Y + R * 0.2);
      nuit.addColorStop(0, 'rgba(2,8,23,0)');
      nuit.addColorStop(1, 'rgba(2,8,23,0.55)');
      ctx.fillStyle = nuit; ctx.fillRect(0, 0, l, h);
      ctx.restore();
      // the bright limb
      ctx.strokeStyle = 'rgba(120,250,255,0.9)'; ctx.lineWidth = 1.6;
      ctx.shadowColor = '#03f3ff'; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(X, Y, R, Math.PI * 1.0, Math.PI * 2.0); ctx.stroke();
      ctx.shadowBlur = 0;
    };

    // Drawn once, and again when the frame changes size: a still planet
    // costs nothing while the visitor reads.
    let attente = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(attente); attente = requestAnimationFrame(dessiner); });
    ro.observe(c);
    dessiner();
    return () => { cancelAnimationFrame(attente); ro.disconnect(); };
  }, [cx, cy, r]);

  return <canvas ref={toile} className={className} aria-hidden="true" />;
}
