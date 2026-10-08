// A local platform for the captures: the REAL server of plateforme/serveur.ts
// (same admin authentication, same JSON, same refusals), loaded with the bench
// data of donnees-de-banc.mjs.
//
// Each route of back-office/src/routes.json is served by the module that owns
// it when that module has written it (plateforme/<module>/routes.ts), and
// otherwise by a small stand-in below. The stand-ins are a bench, not an
// implementation: they keep the bench data in memory and refuse in French
// what needs a key, like the real modules must (an AI engine, an operator).
//
//   node --experimental-strip-types back-office/banc/plateforme-de-banc.ts
//   PORT=8787 by default; the admin token is JETON_DE_BANC.
import { creerPlateforme, toutesLesRoutes, ok, refus, type Route, type Contexte } from '../../plateforme/serveur.ts';
import { Stockage } from '../../plateforme/stockage.ts';
import * as banc from './donnees-de-banc.mjs';
import table from '../src/routes.json' with { type: 'json' };

type Doc = Record<string, any>;
const etat = {
  tenants: structuredClone(banc.tenants) as Doc[],
  boxes: structuredClone(banc.boxes) as Doc[],
  plans: structuredClone(banc.plans) as Doc[],
  entitlements: structuredClone(banc.entitlements) as Doc[],
  numeros: structuredClone(banc.numeros) as Doc[],
  appels: structuredClone(banc.appels) as Doc[],
  skills: structuredClone(banc.skills) as Doc[],
  opportunites: structuredClone(banc.opportunites) as Doc[],
  etudes: [structuredClone(banc.etude)] as Doc[],
  audit: structuredClone(banc.audit) as Doc[],
};
let compte = 100;
const id = (prefixe: string) => `${prefixe}-${++compte}`;
const corps = (c: Contexte) => (c.corps && typeof c.corps === 'object' ? (c.corps as Doc) : {});
const parTenant = (c: Contexte, liste: Doc[]) => {
  const t = c.query.get('tenant_id');
  return t ? liste.filter((d) => d.tenant_id === t) : liste;
};
const tracer = (tenant_id: string | null, action: string, cible: string, detail: string) =>
  etat.audit.push({ id: id('aud'), tenant_id, quand: new Date().toISOString(), acteur: 'back-office', action, cible, detail });

const TRANSITIONS: Record<string, string[]> = { candidat: ['en-revue', 'rejete'], 'en-revue': ['valide', 'rejete'], valide: ['retire'], rejete: ['en-revue'], retire: [] };

const doublures: Record<string, Route['traiter']> = {
  'GET /controle/tenants': () => ok(etat.tenants),
  'POST /controle/tenants': (c) => {
    const b = corps(c);
    if (!b.nom) return refus(400, 'Le nom du client manque.');
    const t = { tenant_id: id('tn'), nom: b.nom, segment: b.segment ?? 'business', pays: b.pays ?? 'FR', opt_in_skills: b.opt_in_skills === true, cree_le: new Date().toISOString() };
    etat.tenants.push(t);
    return ok(t, 201);
  },
  'GET /controle/boxes': () => ok(etat.boxes),
  'GET /controle/boxes/:id': (c) => ok(etat.boxes.find((b) => b.device_id === c.params.id) ?? null),
  'POST /controle/boxes/:id/statut': (c) => {
    const b = etat.boxes.find((x) => x.device_id === c.params.id);
    if (!b) return refus(404, "Cette Box n'existe pas.");
    const { statut, motif } = corps(c);
    if (!['active', 'suspendue', 'restituee', 'remplacee'].includes(statut)) return refus(400, `Le statut « ${statut} » n'existe pas : active, suspendue, restituee ou remplacee.`);
    if (!motif) return refus(400, 'Le motif manque : il entre au journal d’audit.');
    b.statut = statut;
    tracer(b.tenant_id, 'box.statut', b.device_id, `${statut} : ${motif}`);
    return ok(b);
  },
  'GET /controle/entitlements': (c) => ok(parTenant(c, etat.entitlements)),
  'POST /controle/entitlements/:id/revoquer': (c) => {
    const e = etat.entitlements.find((x) => x.id === c.params.id);
    if (!e) return refus(404, "Cette licence n'existe pas.");
    if (e.statut === 'revoquee') return refus(409, 'Cette licence est déjà révoquée.');
    e.statut = 'revoquee';
    e.fin = new Date().toISOString().slice(0, 10);
    tracer(e.tenant_id, 'entitlement.revoquer', e.id, String(corps(c).motif ?? ''));
    return ok(e);
  },
  'GET /controle/skills': () => ok(etat.skills),
  'POST /controle/skills/:id/revue': (c) => {
    const s = etat.skills.find((x) => x.skill_pack_id === c.params.id);
    if (!s) return refus(404, "Ce Skill Pack n'existe pas.");
    const { decision, motif } = corps(c);
    if (!(TRANSITIONS[s.validation_status] ?? []).includes(decision)) return refus(409, `Un Skill Pack « ${s.validation_status} » ne peut pas passer « ${decision} ».`);
    if (decision === 'valide' && !s.empreinte) return refus(409, "Ce Skill Pack n'est pas signé (aucune empreinte) : il ne peut pas être validé.");
    s.validation_status = decision;
    tracer(null, 'skill.revue', s.skill_pack_id, `${decision} : ${motif ?? ''}`);
    return ok(s);
  },
  'GET /controle/compteur': () => ok(banc.compteur),
  'GET /controle/audit': (c) => ok(parTenant(c, etat.audit)),
  'GET /tarifs/plans/tous': () => ok(etat.plans),
  'GET /tarifs/plans': () => ok(etat.plans.filter((p) => p.public_visibility && !p.legacy_flag && !p.effective_to)),
  'POST /tarifs/plans': (c) => {
    const p = corps(c);
    if (!p.plan_id || !p.effective_from) return refus(400, "Une version de plan demande plan_id et effective_from.");
    const ouverte = etat.plans.find((x) => x.plan_id === p.plan_id && x.region === p.region && !x.effective_to);
    if (ouverte && String(ouverte.effective_from) >= String(p.effective_from)) return refus(409, `La version en cours de ${p.plan_id} commence le ${ouverte.effective_from} : la nouvelle doit commencer après.`);
    if (ouverte) ouverte.effective_to = p.effective_from;
    const v = { ...p, effective_to: null };
    etat.plans.push(v);
    tracer(null, 'plan.version', p.plan_id, `nouvelle version au ${p.effective_from}`);
    return ok(v, 201);
  },
  'POST /tarifs/devis': (c) => {
    const { lignes, region } = corps(c);
    if (!Array.isArray(lignes) || !lignes.length) return refus(400, 'Le devis ne porte aucune ligne.');
    const detail = [];
    for (const l of lignes) {
      const p = etat.plans.find((x) => x.plan_id === l.plan_id && x.region === (region ?? 'FR') && !x.effective_to && x.public_visibility);
      if (!p) return refus(400, `Le plan ${l.plan_id} n'est pas vendu en ${region ?? 'FR'} à cette date.`);
      if (p.base_price === null) return refus(400, `Le plan ${l.plan_id} est sur devis : il ne se chiffre pas automatiquement.`);
      detail.push({ plan_id: p.plan_id, quantite: l.quantite, unitaire_ht: p.base_price, total_ht: Math.round(p.base_price * l.quantite * 100) / 100 });
    }
    const ht = Math.round(detail.reduce((s, d) => s + d.total_ht, 0) * 100) / 100;
    const tva = Math.round(ht * 0.2 * 100) / 100;
    return ok({ ht, tva, ttc: Math.round((ht + tva) * 100) / 100, devise: 'EUR', taux_tva: 0.2, detail, source: 'plateforme de banc' });
  },
  'POST /tarifs/cout-appel': () => refus(400, "Les tarifs des fournisseurs de téléphonie et de voix ne sont pas posés sur cette plateforme : aucun coût n'est calculé."),
  'GET /voix/numeros': (c) => ok(parTenant(c, etat.numeros)),
  'POST /voix/numeros': (c) => refus(400, `Aucune clé ${String(corps(c).provider ?? 'telnyx').toUpperCase()} n'est posée sur la plateforme (${String(corps(c).provider ?? 'telnyx').toUpperCase()}_API_KEY) : aucun numéro n'a été demandé.`),
  'GET /voix/appels': (c) => ok(parTenant(c, etat.appels)),
  'GET /create/opportunites/toutes': () => ok(etat.opportunites),
  'GET /create/opportunites': () => ok(etat.opportunites.filter((o) => o.statut === 'publiee')),
  'POST /create/opportunites/generer': () => refus(400, "Aucune clé de moteur d'IA n'est posée sur la plateforme (ANTHROPIC_API_KEY) : aucun brouillon n'a été généré."),
  'POST /create/opportunites/:id/publier': (c) => {
    const o = etat.opportunites.find((x) => x.id === c.params.id);
    if (!o) return refus(404, "Cette opportunité n'existe pas.");
    o.statut = 'publiee';
    tracer(null, 'opportunite.publier', o.id, o.titre);
    return ok(o);
  },
  'GET /create/etudes/:id': (c) => {
    const e = etat.etudes.find((x) => x.id === c.params.id);
    return e ? ok(e) : refus(404, "Aucune étude ne porte cet identifiant.");
  },
  'POST /create/etudes': () => refus(400, "Aucune clé de moteur d'IA n'est posée sur la plateforme (ANTHROPIC_API_KEY) : l'étude n'a pas été lancée."),
};

/** Routes of routes.json the owning module has not written yet, served by the stand-ins. */
export function routesDeBanc(): Route[] {
  const reelles = new Set(toutesLesRoutes.map((r) => `${r.methode} ${r.chemin}`));
  const lignes = Object.values(table.routes as Record<string, { methode: Route['methode']; chemin: string }>);
  return lignes
    .filter((r) => !reelles.has(`${r.methode} ${r.chemin}`))
    .map((r) => {
      const ici = doublures[`${r.methode} ${r.chemin}`];
      const acces = r.chemin === '/controle/compteur' || (r.methode === 'GET' && r.chemin === '/tarifs/plans') || r.chemin === '/tarifs/devis'
        || r.chemin.startsWith('/create/etudes') || (r.methode === 'GET' && r.chemin === '/create/opportunites') ? 'public' : 'admin';
      return {
        methode: r.methode, chemin: r.chemin, acces,
        traiter: ici ?? (() => refus(501, "Plateforme de banc : cette route n'est pas simulée et son module ne l'a pas encore écrite.")),
      } satisfies Route;
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const routes = [...toutesLesRoutes, ...routesDeBanc()];
  const { serveur } = creerPlateforme({ secretAdmin: banc.JETON_DE_BANC, fichierDonnees: null }, { stockage: new Stockage(null), routes });
  const port = Number(process.env.PORT ?? 8787);
  serveur.listen(port, '127.0.0.1', () => {
    console.log(`plateforme de banc sur http://127.0.0.1:${port} — ${toutesLesRoutes.length} route(s) réelle(s), ${routes.length - toutesLesRoutes.length} doublure(s)`);
  });
}
