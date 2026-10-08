import { useEffect, useRef } from 'react';

/**
 * A light canvas globe: points on a sphere turning slowly, and a few arcs
 * where a pulse of light travels — the international horizon of the hero.
 * It draws only while visible, at most 2× pixel density, and once (still)
 * for a visitor who asked for less motion.
 */
export default function Globe({ className = '' }) {
  const toile = useRef(null);

  useEffect(() => {
    const c = toile.current;
    const ctx = c.getContext('2d');
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = window.innerWidth < 900 ? 700 : 1500;
    const points = [];
    const dore = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = dore * i;
      points.push([Math.cos(t) * r, y, Math.sin(t) * r]);
    }
    const arcs = Array.from({ length: 9 }, (_, k) => {
      const a = points[(k * 977 + 131) % N];
      const b = points[(k * 613 + 421) % N];
      return { a, b, phase: k / 9 };
    });

    let l = 0; let h = 0; let dpr = 1;
    const taille = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      l = c.clientWidth; h = c.clientHeight;
      c.width = l * dpr; c.height = h * dpr;
    };
    taille();
    const ro = new ResizeObserver(() => { taille(); if (calme) dessiner(); });
    ro.observe(c);

    const lerp = (p, q, s) => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s];
    const norme = (p) => { const m = Math.hypot(...p) || 1; return [p[0] / m, p[1] / m, p[2] / m]; };

    let angle = 0.6; let visible = true; let rafId = 0; let temps = 0;
    const dessiner = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, l, h);
      const R = Math.min(l, h) * 0.46;
      const cx = l * 0.5; const cy = h * 0.52;
      const cos = Math.cos(angle); const sin = Math.sin(angle);
      const incl = 0.32; const ci = Math.cos(incl); const si = Math.sin(incl);
      const projeter = (p) => {
        const x = p[0] * cos - p[2] * sin;
        const z0 = p[0] * sin + p[2] * cos;
        const y = p[1] * ci - z0 * si;
        const z = p[1] * si + z0 * ci;
        return [cx + x * R, cy + y * R, z];
      };
      // atmosphere
      const g = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.25);
      g.addColorStop(0, 'rgba(3,243,255,0.0)');
      g.addColorStop(0.75, 'rgba(3,243,255,0.06)');
      g.addColorStop(1, 'rgba(3,243,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2); ctx.fill();
      // rim
      ctx.strokeStyle = 'rgba(3,243,255,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      for (const p of points) {
        const [x, y, z] = projeter(p);
        if (z < -0.05) continue;
        const a = 0.12 + z * 0.55;
        ctx.fillStyle = `rgba(150,220,255,${a})`;
        const s = 0.6 + z * 0.9;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      for (const arc of arcs) {
        ctx.beginPath();
        let premier = true;
        for (let s = 0; s <= 1.0001; s += 0.04) {
          const p = norme(lerp(arc.a, arc.b, s));
          const lev = 1 + Math.sin(Math.PI * s) * 0.18;
          const [x, y, z] = projeter([p[0] * lev, p[1] * lev, p[2] * lev]);
          if (z < -0.1) { premier = true; continue; }
          premier ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          premier = false;
        }
        ctx.strokeStyle = 'rgba(3,243,255,0.18)'; ctx.stroke();
        const s = (temps * 0.12 + arc.phase) % 1;
        const p = norme(lerp(arc.a, arc.b, s));
        const lev = 1 + Math.sin(Math.PI * s) * 0.18;
        const [x, y, z] = projeter([p[0] * lev, p[1] * lev, p[2] * lev]);
        if (z > -0.1) {
          ctx.fillStyle = 'rgba(3,243,255,0.95)';
          ctx.shadowColor = '#03f3ff'; ctx.shadowBlur = 12;
          ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    };
    let avant = performance.now();
    const boucle = (t) => {
      const dt = Math.min(0.05, (t - avant) / 1000); avant = t;
      temps += dt; angle += dt * 0.05;
      dessiner();
      if (visible) rafId = requestAnimationFrame(boucle);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(rafId);
      if (visible && !calme) { avant = performance.now(); rafId = requestAnimationFrame(boucle); }
    });
    if (calme) dessiner(); else io.observe(c);
    return () => { cancelAnimationFrame(rafId); io.disconnect(); ro.disconnect(); };
  }, []);

  return <canvas ref={toile} className={className} aria-hidden="true" />;
}
