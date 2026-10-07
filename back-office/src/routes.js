// The platform routes the back-office may call live in routes.json, read here
// by the screens and by the Rust side (admin/src/lib.rs), which refuses any
// other path before attaching the admin token. One table, two readers: a
// route added on one side only cannot be called.
import table from './routes.json';

export const ROUTES = Object.fromEntries(
  Object.entries(table.routes).map(([nom, r]) => [nom, [r.methode, r.chemin]]),
);

/** Builds the concrete path of a declared route; throws on an unknown name or a missing parameter. */
export function chemin(nom, params = {}, query = {}) {
  const route = ROUTES[nom];
  if (!route) throw new Error(`Route inconnue du back-office : ${nom}.`);
  const p = route[1].replace(/:([a-z_]+)/g, (_, cle) => {
    const v = params ? params[cle] : undefined;
    if (v === undefined || v === null || String(v).trim() === '') {
      throw new Error(`Il manque « ${cle} » pour appeler ${route[1]}.`);
    }
    return encodeURIComponent(String(v).trim());
  });
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.set(k, String(v).trim());
  }
  const s = q.toString();
  return { methode: route[0], chemin: s ? `${p}?${s}` : p };
}
