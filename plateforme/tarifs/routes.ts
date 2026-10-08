// Routes of the « tarifs » module (docs/master/routes.md). The seed versions
// come from plans.json; versions posted later live in the platform store
// (collection `tarifs_versions`) and are never overwritten.
import { randomUUID } from 'node:crypto';
import { ok, refus, type Contexte, type Route } from '../serveur.ts';
import type { Audit } from '../modele.ts';
import { COLLECTION_VERSIONS, tarifs, toutesLesVersions } from './donnees.ts';
import {
  aujourdHui, avecPrix, coutAppel, devis, exportSite, fautesDeVersion, fautesDuPlan,
  planALaDate, plansVisibles, versionsFermees, type PlanTarif,
} from './moteur.ts';

const versions = (ctx: Contexte): PlanTarif[] => toutesLesVersions(ctx.stockage);
const dateDe = (ctx: Contexte) => ctx.query.get('date') || aujourdHui(ctx.maintenant());

export const routes: Route[] = [
  {
    methode: 'GET', chemin: '/tarifs/plans', acces: 'public',
    traiter: (ctx) => {
      const region = ctx.query.get('region') || 'FR';
      const t = tarifs();
      if (!t.fiscalite.pays[region]) return refus(404, `Aucun tarif pour la région ${region}.`);
      const plans = plansVisibles(versions(ctx), { date: dateDe(ctx), region, segment: ctx.query.get('segment') });
      return ok({ date: dateDe(ctx), region, hypotheses_de_lancement: plans.some((p) => p.hypothese_de_lancement), plans: plans.map((p) => avecPrix(p, t.fiscalite)) });
    },
  },
  {
    methode: 'GET', chemin: '/tarifs/plans/tous', acces: 'admin',
    traiter: (ctx) => ok({ versions: versionsFermees(versions(ctx)) }),
  },
  {
    methode: 'POST', chemin: '/tarifs/plans', acces: 'admin',
    traiter: (ctx) => {
      const t = tarifs();
      const corps = (ctx.corps ?? {}) as PlanTarif;
      if ('prix_depuis' in corps) return refus(400, "prix_depuis est réservé aux plans de départ : une nouvelle version porte son prix et sa source.");
      const nouvelle: PlanTarif = { ...corps, effective_to: corps.effective_to ?? null };
      const existantes = versions(ctx);
      const fautes = [...fautesDuPlan(nouvelle, t.fiscalite)];
      if (!fautes.length) fautes.push(...fautesDeVersion(nouvelle, existantes));
      if (fautes.length) return refus(400, `Version refusée : ${fautes.join(' ; ')}`);
      const precedente = planALaDate(existantes, nouvelle.plan_id, nouvelle.effective_from, nouvelle.region);
      const id = `${nouvelle.plan_id}|${nouvelle.region}|${nouvelle.effective_from}`;
      ctx.stockage.poser(COLLECTION_VERSIONS, id, nouvelle);
      const audit: Audit = {
        id: randomUUID(), tenant_id: null, quand: ctx.maintenant().toISOString(), acteur: 'back-office',
        action: 'tarifs.nouvelle-version', cible: id,
        detail: `${nouvelle.plan_id} : ${nouvelle.base_price ?? 'sur devis'} ${nouvelle.currency} ${nouvelle.tax_mode} à partir du ${nouvelle.effective_from} (source : ${nouvelle.source}).`,
      };
      ctx.stockage.poser('audit', audit.id, audit);
      const toutes = versionsFermees([...existantes, nouvelle]);
      const fermee = precedente ? toutes.find((v) => v.plan_id === precedente.plan_id && v.region === precedente.region && v.effective_from === precedente.effective_from) ?? null : null;
      return ok({ version: nouvelle, precedente_fermee: fermee }, 201);
    },
  },
  {
    methode: 'POST', chemin: '/tarifs/devis', acces: 'public',
    traiter: (ctx) => {
      const t = tarifs();
      return ok(devis(ctx.corps as never, { versions: versions(ctx), fiscalite: t.fiscalite, maintenant: ctx.maintenant() }));
    },
  },
  {
    methode: 'POST', chemin: '/tarifs/cout-appel', acces: 'admin',
    traiter: (ctx) => {
      const t = tarifs();
      const r = coutAppel(ctx.corps as never, t.couts, t.tarifsApi);
      if (!r.complet) {
        return { statut: 422, corps: { erreur: `Coût de l'appel non calculable : il manque ${r.manque.join(' ; ')}.`, manque: r.manque, detail: r.detail } };
      }
      return ok(r);
    },
  },
  {
    methode: 'GET', chemin: '/tarifs/export-site', acces: 'public',
    traiter: (ctx) => {
      const t = tarifs();
      return ok(exportSite(versions(ctx), t.fichier, t.fiscalite, dateDe(ctx)));
    },
  },
];
