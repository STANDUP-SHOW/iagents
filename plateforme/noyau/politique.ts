// Le moteur de règles (Policy Engine) du noyau iAgent (ADMIN MASTER §3.2, §3.3,
// §10). Une fonction pure : même acteur, même action, mêmes paramètres → même
// décision. La passerelle d'actions l'appelle avant toute exécution ; aucun écran
// ni aucun agent ne décide à sa place.
//
// Decision ladder:
//  1. unknown or inactive actor, missing permission on the resource → DENY;
//  2. risk is computed here from the action and its parameters, never sent by the caller;
//  3. R4 → two-person rule (a human requester + one other human; an agent or a
//     service requester + two humans), whoever asks;
//  4. a human needs a second factor (or the break-glass key) from R2 up;
//  5. an agent is bounded by its autonomy level and its budgets; a service by R2 and its budgets.

import { aLaPermission, type Permission, type Ressource } from './permissions.ts';
import type { Appelant, Budgets } from './acteurs.ts';

export type Risque = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export const RANG: Record<Risque, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4 };

export type Verdict = 'ALLOW' | 'DENY' | 'APPROVAL' | 'DUAL_APPROVAL';
export type Decision = {
  verdict: Verdict;
  risque: Risque;
  /** Distinct human approvals still needed before execution (0 when ALLOW or DENY). */
  approbations_requises: 0 | 1 | 2;
  motif: string;
};

/** The core's default ceilings, used when an actor carries none (§3.2 examples: discount cap 10 %). */
export const BUDGETS_PAR_DEFAUT: Required<Budgets> = { remise_max_pct: 10, credit_max_eur: 50, remboursement_max_eur: 0 };

/** What the policy needs to know about an action, as declared in the catalogue. */
export type ProfilAction = {
  verbe: string;
  permission: Permission;
  risque: (p: Record<string, unknown>) => Risque;
  /** Amount or rate to compare with the actor's budget, when the action spends something. */
  plafond?: { budget: keyof Budgets; valeur: (p: Record<string, unknown>) => number };
};

const deny = (risque: Risque, motif: string): Decision => ({ verdict: 'DENY', risque, approbations_requises: 0, motif });
const allow = (risque: Risque, motif: string): Decision => ({ verdict: 'ALLOW', risque, approbations_requises: 0, motif });
const approval = (risque: Risque, motif: string): Decision => ({ verdict: 'APPROVAL', risque, approbations_requises: 1, motif });

function dansLeBudget(appelant: Appelant, a: ProfilAction, p: Record<string, unknown>): { ok: boolean; texte: string } {
  if (!a.plafond) return { ok: true, texte: '' };
  const plafond = appelant.acteur.budgets[a.plafond.budget] ?? BUDGETS_PAR_DEFAUT[a.plafond.budget];
  const valeur = a.plafond.valeur(p);
  const unite = a.plafond.budget === 'remise_max_pct' ? ' %' : ' €';
  return { ok: valeur <= plafond, texte: `${valeur}${unite} pour un plafond de ${plafond}${unite}` };
}

export function decider(appelant: Appelant, a: ProfilAction, p: Record<string, unknown>, r: Ressource): Decision {
  const { acteur } = appelant;
  const risque = a.risque(p);
  if (acteur.statut !== 'actif') return deny(risque, `${acteur.nom_affiche} n'est pas actif.`);
  if (!aLaPermission(acteur.roles, a.permission, r)) return deny(risque, `${acteur.nom_affiche} n'a pas la permission ${a.permission} sur ce périmètre.`);

  if (risque === 'R4') {
    const requises = acteur.type === 'HUMAN' ? 1 : 2;
    return { verdict: 'DUAL_APPROVAL', risque, approbations_requises: requises, motif: `Action critique (R4) : règle des deux personnes, ${requises} approbation${requises > 1 ? 's' : ''} humaine${requises > 1 ? 's' : ''} distincte${requises > 1 ? 's' : ''} du demandeur.` };
  }

  const budget = dansLeBudget(appelant, a, p);
  switch (acteur.type) {
    case 'HUMAN': {
      if (RANG[risque] >= 2 && !appelant.mfa && !appelant.secours) return deny(risque, 'Cette action demande une session ouverte avec votre second facteur (code à 6 chiffres).');
      return allow(risque, `Autorisé : ${a.permission} sur ce périmètre.`);
    }
    case 'SERVICE': {
      if (RANG[risque] <= 1) return allow(risque, 'Service autorisé (risque faible).');
      if (risque === 'R2' && budget.ok) return allow(risque, `Service autorisé dans ses limites${budget.texte ? ` (${budget.texte})` : ''}.`);
      return approval(risque, `Un service ne fait pas seul une action ${risque}${budget.texte ? ` (${budget.texte})` : ''} : approbation humaine.`);
    }
    case 'AGENT': {
      const n = acteur.autonomie ?? 0;
      if (risque === 'R0') return allow(risque, 'Lecture autorisée.');
      if (n === 0) return deny(risque, `${acteur.nom_affiche} est en autonomie 0 (observation) : il ne fait que lire.`);
      if (n === 1) return approval(risque, `${acteur.nom_affiche} est en autonomie 1 (suggestion) : un humain valide avant exécution.`);
      if (risque === 'R1') return allow(risque, 'Action à faible risque autorisée et tracée.');
      const seuil = n >= 4 ? 'R3' : n === 3 ? 'R2' : 'R1';
      if (RANG[risque] <= RANG[seuil] && budget.ok) return allow(risque, `Dans l'autonomie ${n} de ${acteur.nom_affiche}${budget.texte ? ` (${budget.texte})` : ''}.`);
      return approval(risque, `Hors de l'autonomie ${n} de ${acteur.nom_affiche}${budget.ok ? '' : ` : ${budget.texte}`} — approbation humaine.`);
    }
    case 'DEVICE':
      return deny(risque, 'Une Box ne demande pas d’action : elle rend des résultats.');
  }
}
