// Cost of one call (MASTER §12): telephony + voice + LLM + tools, as a pure
// function over rates read from `taux.json` (each with its page and date) and
// `dimensionnement/tarifs-api.json` for the LLM. A component whose rate was not
// read stays unknown: the total is then null and `manquants` says why — a
// guessed price would under-bill the client from the first call.
//
// TO MERGE: plateforme/tarifs computes a neighbouring cost (POST /tarifs/cout-appel,
// with margin). This function is written pure so the two can become one.
import tarifsApi from '../../dimensionnement/tarifs-api.json' with { type: 'json' };
import tauxFichier from './taux.json' with { type: 'json' };
import type { Metriques } from './fournisseurs-voix.ts';
import type { MoteurVoix, ProviderTel } from './types.ts';

type Taux = { valeur: number; source: string; lu_le: string } | null;
export type TableTaux = typeof tauxFichier;

export type EntreeCout = {
  duree_s: number;
  direction: 'entrant' | 'sortant';
  provider: ProviderTel;
  /** For an outbound call: the called number, to tell a mobile from a landline. */
  appele: string;
  voix: Metriques | null;
  outils: { nom: string; cout_usd: number | null }[];
};

export type CoutAppel = {
  telephonie: number | null; voix: number | null; llm: number | null; outils: number | null;
  total: number | null; devise: string; manquants: string[];
};

const arrondi = (x: number) => Math.round(x * 1e6) / 1e6;

function taux(t: unknown): Taux {
  return t && typeof t === 'object' && 'valeur' in (t as object) ? (t as Taux) : null;
}

/** French mobiles are +336 and +337 (ARCEP numbering plan); other countries are not classified. */
export function estMobile(e164: string): boolean | null {
  if (e164.startsWith('+33')) return /^\+33[67]/.test(e164);
  return null;
}

export function coutAppel(e: EntreeCout, table: TableTaux = tauxFichier): CoutAppel {
  const manquants: string[] = [];
  const minutes = e.duree_s / 60;

  // Telephony
  const tel = (table.telephonie as Record<string, Record<string, unknown>>)[e.provider] ?? {};
  let cle: string;
  if (e.direction === 'entrant') cle = 'entrant_minute';
  else {
    const mob = estMobile(e.appele);
    cle = mob === null ? '' : mob ? 'sortant_mobile_minute' : 'sortant_fixe_minute';
    if (mob === null) manquants.push(`téléphonie : destination ${e.appele.slice(0, 4)}… non classée (fixe ou mobile)`);
  }
  const tt = cle ? taux(tel[cle]) : null;
  if (cle && !tt) manquants.push(`téléphonie : taux ${e.provider} « ${cle} » non relevé`);
  const telephonie = tt ? arrondi(tt.valeur * minutes) : null;

  // Voice
  let voix: number | null = null;
  let llm: number | null = 0;
  if (e.voix) {
    const m = e.voix;
    const v = (table.voix as Record<string, Record<string, unknown>>)[m.moteur] ?? {};
    const val = (k: string) => taux(v[k])?.valeur ?? null;
    const calc: Record<MoteurVoix, () => number | null> = {
      gemini: () => { const a = val('audio_entree_minute'); const b = val('audio_sortie_minute'); return a === null || b === null ? null : a * m.secondes_audio_entree / 60 + b * m.secondes_audio_sortie / 60; },
      elevenlabs: () => { const a = val('tts_1000_caracteres'); const b = val('stt_heure'); return a === null || b === null ? null : a * m.caracteres_synthetises / 1000 + b * m.secondes_audio_entree / 3600; },
      mistral: () => { const a = val('tts_1000_caracteres'); const b = val('stt_minute'); return a === null || b === null ? null : a * m.caracteres_synthetises / 1000 + b * m.secondes_audio_entree / 60; },
      local: () => 0,
    };
    const c = calc[m.moteur]();
    if (c === null) manquants.push(`voix : taux ${m.moteur} non relevé`);
    voix = c === null ? null : arrondi(c);
    // Gemini Live bills its thinking in the audio rate above; the turn-by-turn engines
    // pay a separate language model, priced from dimensionnement/tarifs-api.json (USD per million).
    if (m.moteur !== 'gemini') {
      const ref = tarifsApi.modeles.reference;
      llm = arrondi((m.jetons_entree * ref.entree + m.jetons_sortie * ref.sortie) / 1e6);
    }
  } else voix = 0;

  // Tools
  let outils: number | null = 0;
  for (const o of e.outils) {
    if (o.cout_usd === null) { outils = null; manquants.push(`outil « ${o.nom} » : coût non relevé`); }
    else if (outils !== null) outils += o.cout_usd;
  }
  if (outils !== null) outils = arrondi(outils);

  const parts = [telephonie, voix, llm, outils];
  const total = parts.some((p) => p === null) ? null : arrondi(parts.reduce((a, b) => a! + b!, 0)!);
  return { telephonie, voix, llm, outils, total, devise: table.devise, manquants };
}
