// Outbound campaigns (Sales Center, MASTER §12 and §18). `verifierContact` is
// the ONE place that decides whether a contact may be called: no proven
// consent (source and date), an opposition list, an expired or withdrawn
// consent, too many calls in thirty days, a public holiday or a time outside
// the country's window — each is a refusal with its reason in French. Recording
// only happens when the campaign asks for it AND the contact consented to it.
import regles from './regles-demarchage.json' with { type: 'json' };
import { normaliserE164 } from './telephonie.ts';
import { dansPlages, heureLocale, joursFeriesFrance, plagesInvalides } from './temps.ts';
import type { ContactCampagne, Plage } from './types.ts';

export type RegleDemarchage = (typeof regles.pays)['FR'];
export const REGLES: Record<string, RegleDemarchage> = regles.pays;

export type Verdict =
  | { autorise: true; enregistrer: boolean; note: string }
  | { autorise: false; motif: string };

export type EntreeVerification = {
  contact: ContactCampagne;
  pays: string;
  fenetres: Plage[];
  enregistrement_demande: boolean;
  maintenant: Date;
  /** Numbers (E.164) on an opposition list of the tenant, with the list name. */
  opposition: Map<string, string>;
  /** Outbound calls already placed to this number by the tenant in the last 30 days. */
  appels_30_jours: number;
};

const JOUR_MS = 86_400_000;
const NOMS_JOURS = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

function feries(regle: RegleDemarchage, annee: number): string[] {
  return regle.jours_feries === 'france' ? joursFeriesFrance(annee) : [];
}

export function verifierContact(e: EntreeVerification): Verdict {
  const regle = REGLES[e.pays];
  if (!regle) return { autorise: false, motif: `Aucune règle de démarchage relevée pour le pays « ${e.pays} » : on n’appelle pas.` };
  const numero = normaliserE164(e.contact.e164);
  if (!numero) return { autorise: false, motif: `« ${e.contact.e164} » n’est pas un numéro E.164.` };
  const liste = e.opposition.get(numero);
  if (liste) return { autorise: false, motif: `Le numéro est sur la liste d’opposition « ${liste} ».` };
  const c = e.contact.consentement;
  if (!c) return { autorise: false, motif: 'Aucun consentement prouvé pour ce contact.' };
  if (!c.source?.trim()) return { autorise: false, motif: 'Le consentement ne dit pas sa source : il ne prouve rien.' };
  const quand = Date.parse(c.date);
  if (!Number.isFinite(quand)) return { autorise: false, motif: 'Le consentement n’a pas de date lisible.' };
  if (quand > e.maintenant.getTime()) return { autorise: false, motif: 'Le consentement est daté du futur.' };
  if (c.retire_le) return { autorise: false, motif: 'Le contact a retiré son consentement.' };
  const age = (e.maintenant.getTime() - quand) / JOUR_MS;
  if (age > regle.validite_consentement_jours) {
    return { autorise: false, motif: `Le consentement date de ${Math.floor(age)} jours : il n’est valable que ${regle.validite_consentement_jours} jours.` };
  }
  if (e.appels_30_jours >= regle.max_appels_30_jours) {
    return { autorise: false, motif: `Déjà ${e.appels_30_jours} appels en trente jours : la limite est de ${regle.max_appels_30_jours}.` };
  }
  const h = heureLocale(e.maintenant, regle.fuseau);
  if (feries(regle, Number(h.date.slice(0, 4))).includes(h.date)) return { autorise: false, motif: `Le ${h.date} est un jour férié : démarchage interdit.` };
  if (!regle.jours.includes(h.jour)) return { autorise: false, motif: `Démarchage interdit le ${NOMS_JOURS[h.jour]}.` };
  const legal: Plage[] = regle.plages.map((p) => ({ jours: regle.jours, debut: p.debut, fin: p.fin }));
  const hhmm = `${String(Math.floor(h.minutes / 60)).padStart(2, '0')}:${String(h.minutes % 60).padStart(2, '0')}`;
  if (!dansPlages(h, legal)) {
    return { autorise: false, motif: `Il est ${hhmm} (${regle.fuseau}) : hors des horaires autorisés (${regle.plages.map((p) => `${p.debut}-${p.fin}`).join(', ')}).` };
  }
  if (e.fenetres.length && !dansPlages(h, e.fenetres)) return { autorise: false, motif: `Il est ${hhmm} : hors des fenêtres choisies pour cette campagne.` };
  const enregistrer = e.enregistrement_demande && e.contact.consentement_enregistrement === true && regle.enregistrement === 'consentement-requis';
  const note = e.enregistrement_demande && !enregistrer ? 'Appel autorisé, sans enregistrement : le contact n’y a pas consenti.' : 'Appel autorisé.';
  return { autorise: true, enregistrer, note };
}

export function campagneInvalide(c: { tenant_id?: string; pays?: string; contacts?: unknown; fenetres?: unknown; source_consentement?: string; numero_appelant?: string; provider?: string }): string | null {
  if (!c.tenant_id) return 'La campagne doit nommer son client (tenant_id).';
  if (!c.pays || !REGLES[c.pays]) return `Pays « ${c.pays ?? ''} » sans règles de démarchage relevées : campagne refusée.`;
  if (!Array.isArray(c.contacts) || c.contacts.length === 0) return 'La campagne n’a aucun contact.';
  if (!c.source_consentement?.trim()) return 'La campagne doit dire d’où viennent les consentements (source_consentement).';
  if (!normaliserE164(c.numero_appelant)) return 'Le numéro appelant doit être un numéro E.164.';
  if (!['telnyx', 'twilio', 'sip'].includes(String(c.provider))) return 'L’opérateur est telnyx, twilio ou sip.';
  return plagesInvalides(c.fenetres ?? []);
}
