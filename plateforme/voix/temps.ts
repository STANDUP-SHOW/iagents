// Local time in a time zone, and the French public holidays. Shared by the
// standard (opening hours) and the outbound campaigns (legal windows).
import type { Plage } from './types.ts';

export type HeureLocale = { date: string; jour: number; minutes: number }; // jour 1 = Monday

export function heureLocale(d: Date, fuseau: string): HeureLocale {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)!.value;
  const jours: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { date: `${p('year')}-${p('month')}-${p('day')}`, jour: jours[p('weekday')], minutes: Number(p('hour')) * 60 + Number(p('minute')) };
}

export function minutesDe(hhmm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m || Number(m[1]) > 24 || Number(m[2]) > 59) throw new Error(`Heure illisible : « ${hhmm} » (attendu HH:MM).`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Start included, end excluded. */
export function dansPlages(h: HeureLocale, plages: Plage[]): boolean {
  return plages.some((p) => p.jours.includes(h.jour) && h.minutes >= minutesDe(p.debut) && h.minutes < minutesDe(p.fin));
}

export function plagesInvalides(plages: unknown): string | null {
  if (!Array.isArray(plages)) return 'Les horaires doivent être une liste de plages.';
  for (const p of plages as Plage[]) {
    if (!Array.isArray(p.jours) || p.jours.some((j) => !Number.isInteger(j) || j < 1 || j > 7)) return 'Une plage doit nommer ses jours de 1 (lundi) à 7 (dimanche).';
    try { if (minutesDe(p.debut) >= minutesDe(p.fin)) return `Plage ${p.debut}-${p.fin} : la fin doit suivre le début.`; } catch (e) { return (e as Error).message; }
  }
  return null;
}

/** Easter Sunday (Gregorian, Meeus/Jones/Butcher), as YYYY-MM-DD. */
function paques(annee: number): Date {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(annee, mois - 1, jour));
}

/**
 * The eleven French public holidays (Code du travail, art. L3133-1, Légifrance).
 * Not handled: the two extra days of Alsace-Moselle (Good Friday, 26 December)
 * and the overseas departments' own days.
 */
export function joursFeriesFrance(annee: number): string[] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
  const p = paques(annee);
  return [
    `${annee}-01-01`, iso(plus(p, 1)), `${annee}-05-01`, `${annee}-05-08`, iso(plus(p, 39)), iso(plus(p, 50)),
    `${annee}-07-14`, `${annee}-08-15`, `${annee}-11-01`, `${annee}-11-11`, `${annee}-12-25`,
  ].sort();
}
