// Audit des actions sensibles du Control Plane (MASTER §6, §18) : provisioning,
// attribution, statut, entitlement, révocation, mise à jour, revue de Skill.
// One writer for every trace, so the "no secret inside" rule lives here: callers
// pass short, platform-written strings, and anything that looks like a key, a
// signature or a token is refused before it is stored.

import { randomUUID } from 'node:crypto';
import type { Audit } from '../modele.ts';
import type { Stockage } from '../stockage.ts';

const RESSEMBLE_A_UN_SECRET = /-----BEGIN|PRIVATE KEY|Bearer\s|[A-Za-z0-9_-]{60,}|\.[A-Za-z0-9_-]{40,}/;

export function auditer(
  stockage: Stockage,
  maintenant: Date,
  trace: { tenant_id: string | null; acteur: string; action: string; cible: string; detail: string },
): Audit {
  for (const v of Object.values(trace)) {
    if (typeof v === 'string' && RESSEMBLE_A_UN_SECRET.test(v)) {
      throw new Error("Trace d'audit refusée : elle porterait un secret.");
    }
  }
  const a: Audit = { id: randomUUID(), quand: maintenant.toISOString(), ...trace };
  return stockage.poser('audit', a.id, a);
}

export const ACTEUR_ADMIN = 'back-office';
export const acteurBox = (deviceId: string) => `box:${deviceId}`;
