// What the AI engine must return, written ONCE: the same JSON Schema is sent to
// the API as the structured-output format and replayed here with ajv before
// anything is stored. A malformed output is refused with the reason, never
// "repaired" (no default filled in, no field dropped, no number clamped).
//
// Structured outputs accept only a subset of JSON Schema, so `pourApi()` strips
// the numeric and length bounds before sending; the local check keeps them.

import { Ajv2020 } from 'ajv/dist/2020.js';
import type { Estimation } from '../modele.ts';
import { BESOINS } from './equipes.ts';

type Schema = Record<string, unknown>;

const texte = (maxLength = 2000): Schema => ({ type: 'string', minLength: 1, maxLength });
const textes = (min = 1, max = 12): Schema => ({ type: 'array', items: texte(600), minItems: min, maxItems: max });
const objet = (proprietes: Record<string, Schema>): Schema => ({
  type: 'object',
  properties: proprietes,
  required: Object.keys(proprietes),
  additionalProperties: false,
});
const estimation = (unite: string): Schema => objet({
  min: { type: 'number', minimum: 0 },
  max: { type: 'number', minimum: 0 },
  unite: { type: 'string', enum: [unite] },
  hypotheses: textes(1, 8),
});
const besoins: Schema = { type: 'array', items: { type: 'string', enum: [...BESOINS] }, minItems: 0, maxItems: BESOINS.length };

export const MAX_OPPORTUNITES_PAR_JOUR = 20;

export function schemaOpportunites(nombre: number): Schema {
  return objet({
    opportunites: {
      type: 'array',
      minItems: 1,
      maxItems: nombre,
      items: objet({
        titre: texte(140),
        marche: texte(300),
        score: { type: 'integer', minimum: 0, maximum: 100 },
        pourquoi_maintenant: texte(),
        demande: texte(),
        concurrence: texte(),
        contraintes: texte(),
        capital_estime: estimation('EUR'),
        complexite: { type: 'string', enum: ['faible', 'moyenne', 'elevee'] },
        delai_mois: estimation('mois'),
        recurrence: { type: 'string', enum: ['ponctuelle', 'recurrente', 'abonnement'] },
        risques: textes(1, 8),
        besoins,
      }),
    },
  });
}

const scenario = objet({
  chiffre_affaires_annee1: estimation('EUR'),
  couts_annee1: estimation('EUR'),
  capital_necessaire: estimation('EUR'),
  hypotheses: textes(1, 10),
});

export const SCHEMA_ETUDE: Schema = objet({
  titre: texte(140),
  resume: texte(1500),
  besoins,
  scenarios: objet({ prudent: scenario, central: scenario, ambitieux: scenario }),
  couts: { type: 'array', minItems: 1, maxItems: 20, items: objet({ poste: texte(200), montant: estimation('EUR') }) },
  canaux: { type: 'array', minItems: 1, maxItems: 12, items: objet({ canal: texte(200), pourquoi: texte(600) }) },
  reglementation: {
    type: 'array', minItems: 1, maxItems: 15,
    items: objet({ sujet: texte(200), obligation: texte(800), a_verifier_aupres: texte(300) }),
  },
  plan_execution: {
    type: 'array', minItems: 5, maxItems: 5,
    items: objet({
      phase: { type: 'string', enum: ['01', '02', '03', '04', '05'] },
      duree_mois: estimation('mois'),
      actions: textes(1, 10),
    }),
  },
});

const BORNES = new Set(['minimum', 'maximum', 'minLength', 'maxLength', 'maxItems']);
/** The API-side copy of a schema: same shape, bounds the structured-output grammar does not take removed. */
export function pourApi(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(pourApi);
  if (!s || typeof s !== 'object') return s;
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (BORNES.has(k)) continue;
    if (k === 'minItems' && typeof v === 'number' && v > 1) continue;
    r[k] = pourApi(v);
  }
  return r;
}

// A scenario is never a promise (§9). Narrow on purpose: « garantie décennale »
// is a legal obligation an étude must be able to name.
const PROMESSES = [
  /rentabilit[ée]\s+(garantie|assur[ée]e|certaine)/i,
  /(b[ée]n[ée]fices?|profits?|revenus?|gains?|succ[èe]s)\s+(garantis?|assur[ée]s?|certains?)/i,
  /sans\s+(aucun\s+)?risques?/i,
  /[àa]\s+coup\s+s[ûu]r/i,
  /100\s?%\s+(s[ûu]r|rentable|garanti)/i,
];

function textesDe(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => textesDe(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => textesDe(x, out));
  return out;
}

function estimationsDe(v: unknown, chemin: string, out: { chemin: string; e: { min: number; max: number; hypotheses: string[] } }[] = []) {
  if (Array.isArray(v)) v.forEach((x, i) => estimationsDe(x, `${chemin}[${i}]`, out));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('min' in o && 'max' in o && 'hypotheses' in o) out.push({ chemin, e: o as never });
    else for (const [k, x] of Object.entries(o)) estimationsDe(x, chemin ? `${chemin}.${k}` : k, out);
  }
  return out;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });

/**
 * Checks an engine output against its schema, then the rules a schema cannot say.
 * Returns the faults in French; an empty list means the output is accepted as is.
 */
export function controler(schema: Schema, sortie: unknown): string[] {
  const valider = ajv.compile(schema);
  if (!valider(sortie)) {
    return (valider.errors ?? []).slice(0, 8).map((e) => `champ ${e.instancePath || '(racine)'} : ${e.message ?? 'non conforme'}`);
  }
  const fautes: string[] = [];
  for (const { chemin, e } of estimationsDe(sortie, '')) {
    if (!Number.isFinite(e.min) || !Number.isFinite(e.max) || e.min > e.max) fautes.push(`${chemin} : le minimum dépasse le maximum`);
    if (e.hypotheses.some((h) => !h.trim())) fautes.push(`${chemin} : une hypothèse est vide`);
  }
  for (const t of textesDe(sortie)) {
    if (!t.trim()) { fautes.push('un texte est vide'); break; }
    const p = PROMESSES.find((re) => re.test(t));
    if (p) { fautes.push(`promesse de résultat interdite : « ${t.match(p)![0]} »`); break; }
  }
  return fautes;
}

/** Faults specific to an étude: the five phases exactly once, scenarios in order. */
export function controlerEtude(sortie: unknown): string[] {
  const fautes = controler(SCHEMA_ETUDE, sortie);
  if (fautes.length) return fautes;
  const e = sortie as { plan_execution: { phase: string }[]; scenarios: Record<string, { chiffre_affaires_annee1: { min: number; max: number } }> };
  const phases = e.plan_execution.map((p) => p.phase).join(',');
  if (phases !== '01,02,03,04,05') fautes.push(`le plan d'exécution doit suivre les phases 01 à 05 une fois chacune, reçu ${phases}`);
  const ca = (k: string) => e.scenarios[k].chiffre_affaires_annee1;
  if (!(ca('prudent').min <= ca('central').min && ca('central').min <= ca('ambitieux').min
    && ca('prudent').max <= ca('central').max && ca('central').max <= ca('ambitieux').max)) {
    fautes.push("les scénarios ne sont pas ordonnés : le chiffre d'affaires prudent doit rester sous le central, le central sous l'ambitieux");
  }
  return fautes;
}

/** Marks an engine figure as what it is. Done here, never left to the engine. */
export function estimationDe(x: { min: number; max: number; unite: string; hypotheses: string[] }): Estimation {
  return { nature: 'estimation', min: x.min, max: x.max, unite: x.unite, hypotheses: [...x.hypotheses] };
}

export const AVERTISSEMENT =
  "Estimations et scénarios uniquement : aucun de ces chiffres n'est une promesse de chiffre d'affaires ni de rentabilité. Chaque chiffre repose sur les hypothèses écrites à côté de lui ; vérifiez-les avant toute décision, et faites valider la réglementation par un professionnel.";
