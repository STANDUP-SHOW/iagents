// The iAgent budget of a composed company, phase by phase (MASTER §9): licences
// of the phase's team, Task Commander when the team is under five agents (§5:
// « inclus à partir de 5 agents »), the Box(es) that carry the team, and the AI
// consumption estimated from each agent's own package by `dimensionnement/`.
//
// Prices are never written here. They come from the tarifs engine
// (`plateforme/tarifs/donnees.ts`, `prixDuPlan`) when it is present; until that
// module is merged, from PRIX_PROVISOIRES below, and the project says so
// (`prix_provisoires: true`).

import { existsSync } from 'node:fs';
import type { Estimation, MembreEquipe } from '../modele.ts';
import type { Stockage } from '../stockage.ts';
import { coutApiMensuel, type PaquetEco } from '../../dimensionnement/economie.ts';
import { REPARTITIONS, REPARTITION_DEFAUT, INTENSITES, INTENSITE_DEFAUT } from '../../dimensionnement/intensite.ts';
import { ficheDe } from './equipes.ts';

/** §4/§20: a Box carries at most this many agents; beyond, several Boxes. */
export const AGENTS_PAR_BOX_MAX = 20;
/** §5: Task Commander is included from this many agents on. */
export const COMMANDER_INCLUS_A_PARTIR_DE = 5;

export const PLAN_BOX = 'box-commander-36';
export const PLAN_COMMANDER = 'task-commander';
export const PLAN_LICENCE: Record<MembreEquipe['licence'], string> = {
  essential: 'agent-essential',
  professional: 'agent-professional',
  expert: 'agent-expert',
};

/**
 * PROVISIONAL — MASTER du 07/10/2026 §5, « tarifs indicatifs de test », EUR HT par mois.
 * Read only when `plateforme/tarifs/donnees.ts` does not exist. Remove once the
 * tarifs engine is merged: it is then the only source of a price.
 */
export const PRIX_PROVISOIRES: Readonly<Record<string, number>> = {
  'box-commander-36': 69,
  'agent-essential': 149,
  'agent-professional': 249,
  'agent-expert': 399,
  'task-commander': 249, // « 249–349 » : bas de fourchette
};

export type SourcePrix = { prix: (planId: string) => number; provisoire: boolean };

const MOTEUR_TARIFS = new URL('../tarifs/donnees.ts', import.meta.url);

/** Prices at a date: the tarifs engine when present, the provisional constant otherwise. */
export async function sourcePrix(stockage: Stockage, date: string): Promise<SourcePrix> {
  if (!existsSync(MOTEUR_TARIFS)) {
    return {
      provisoire: true,
      prix: (id) => {
        const p = PRIX_PROVISOIRES[id];
        if (p === undefined) throw new Error(`Aucun prix provisoire pour le plan ${id}.`);
        return p;
      },
    };
  }
  const mod = (await import(MOTEUR_TARIFS.href)) as {
    prixDuPlan?: (s: Stockage, planId: string, date: string, region?: string) => { base_price: number | null } | null;
  };
  if (typeof mod.prixDuPlan !== 'function') {
    throw new Error("Le moteur de tarifs est présent mais n'expose pas prixDuPlan : le budget ne peut pas être calculé.");
  }
  const prixDuPlan = mod.prixDuPlan;
  return {
    provisoire: false,
    prix: (id) => {
      const plan = prixDuPlan(stockage, id, date, 'FR');
      if (!plan || typeof plan.base_price !== 'number') {
        throw new Error(`Le moteur de tarifs n'a pas de prix en vigueur pour le plan ${id} au ${date.slice(0, 10)}.`);
      }
      return plan.base_price;
    },
  };
}

export function boxPour(nombreAgents: number): number {
  return Math.max(1, Math.ceil(nombreAgents / AGENTS_PAR_BOX_MAX));
}

const arrondi = (x: number) => Math.round(x);

/** Monthly AI consumption of a team, from each package (all-API high end, hybrid low end). */
export function consommationMensuelle(equipe: MembreEquipe[]): { min: number; max: number } {
  let toutApi = 0;
  for (const m of equipe) toutApi += coutApiMensuel(ficheDe(m.agent_id) as unknown as PaquetEco).total;
  return { min: toutApi * REPARTITIONS[REPARTITION_DEFAUT].partApi, max: toutApi };
}

export function budgetPhase(equipe: MembreEquipe[], duree: Estimation, prix: SourcePrix) {
  const nbBox = boxPour(equipe.length);
  const detail: string[] = [];
  let mensuel = 0;
  const parLicence = new Map<string, number>();
  for (const m of equipe) parLicence.set(m.licence, (parLicence.get(m.licence) ?? 0) + 1);
  for (const [licence, n] of parLicence) {
    const planId = PLAN_LICENCE[licence as MembreEquipe['licence']];
    const p = prix.prix(planId);
    mensuel += n * p;
    detail.push(`${n} × ${planId} à ${p} € HT/mois`);
  }
  if (equipe.length < COMMANDER_INCLUS_A_PARTIR_DE) {
    const p = prix.prix(PLAN_COMMANDER);
    mensuel += p;
    detail.push(`${PLAN_COMMANDER} à ${p} € HT/mois (inclus à partir de ${COMMANDER_INCLUS_A_PARTIR_DE} agents)`);
  } else {
    detail.push(`${PLAN_COMMANDER} inclus (${equipe.length} agents)`);
  }
  const pBox = prix.prix(PLAN_BOX);
  mensuel += nbBox * pBox;
  detail.push(`${nbBox} × ${PLAN_BOX} à ${pBox} € HT/mois`);

  const sourceHyp = prix.provisoire
    ? 'prix indicatifs de test du MASTER du 07/10/2026, provisoires tant que le moteur de tarifs n\'est pas branché'
    : 'prix en vigueur du moteur de tarifs, région FR';
  const conso = consommationMensuelle(equipe);
  const total_ht: Estimation = {
    nature: 'estimation',
    min: arrondi(mensuel * duree.min),
    max: arrondi(mensuel * duree.max),
    unite: 'EUR HT',
    hypotheses: [`${mensuel} € HT par mois sur ${duree.min} à ${duree.max} mois`, sourceHyp, ...duree.hypotheses],
  };
  const consommation_ia: Estimation = {
    nature: 'estimation',
    min: arrondi(conso.min * duree.min),
    max: arrondi(conso.max * duree.max),
    unite: 'EUR',
    hypotheses: [
      `bas : ${Math.round(REPARTITIONS[REPARTITION_DEFAUT].partApi * 100)} % des appels par API, le reste sur la Box ; haut : tout par API`,
      `intensité « ${INTENSITES[INTENSITE_DEFAUT].libelle} », tâches des fiches à leur planification`,
      'prix et volumes d\'appel de dimensionnement/tarifs-api.json, hypothèses à remplacer par la mesure',
    ],
  };
  return { mensuel_ht: mensuel, detail, total_ht, consommation_ia, nbBox };
}
