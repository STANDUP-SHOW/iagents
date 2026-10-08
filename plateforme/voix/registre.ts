// Voice registry (MASTER §10): the client chooses the voice IDENTITY of a
// persona, iAgent chooses the engine. A persona keeps the same identity on the
// Desktop, the phone and support because the voice used on an engine always
// comes from `VoiceProfile.voix_par_moteur` — an engine for which the persona has
// no voice is never chosen, rather than lending it a stranger's voice.
//
// `choisirMoteur` is pure: what is available is passed in, the reason is always
// written (`motif`), even when the first choice wins.
import type { ModeVoix, VoiceProfile } from '../modele.ts';
import tableMoteurs from './moteurs.json' with { type: 'json' };
import taux from './taux.json' with { type: 'json' };
import type { Canal, MoteurVoix } from './types.ts';
import { MOTEURS } from './types.ts';

type FicheMoteur = {
  libelle: string; qualite: number; temps_reel: boolean; local: boolean;
  langues: string[]; canaux: string[]; besoin_cerveau: boolean;
};
export const FICHES: Record<MoteurVoix, FicheMoteur> = tableMoteurs.moteurs as Record<MoteurVoix, FicheMoteur>;
export const MODES: ModeVoix[] = ['quality_first', 'cost_first', 'balanced', 'local_first'];
const LIBELLE_MODE: Record<ModeVoix, string> = {
  quality_first: 'qualité d’abord',
  cost_first: 'coût d’abord',
  balanced: 'équilibre',
  local_first: 'local d’abord',
};

/** Estimated USD per minute, only to ORDER engines. null = a rate was not read. */
export function coutMinuteEstime(m: MoteurVoix): number | null {
  const v = taux.voix as Record<string, Record<string, { valeur: number } | null | string>>;
  const val = (moteur: string, k: string) => {
    const t = v[moteur]?.[k];
    return t && typeof t === 'object' ? t.valeur : null;
  };
  switch (m) {
    case 'local': return 0;
    case 'gemini': {
      const a = val('gemini', 'audio_entree_minute'); const b = val('gemini', 'audio_sortie_minute');
      return a === null || b === null ? null : a + b;
    }
    case 'elevenlabs': {
      const tts = val('elevenlabs', 'tts_1000_caracteres'); const stt = val('elevenlabs', 'stt_heure');
      if (tts === null || stt === null) return null;
      return (tts * taux.estimation_registre.caracteres_par_minute_agent) / 1000 + stt / 60;
    }
    case 'mistral': {
      const tts = val('mistral', 'tts_1000_caracteres'); const stt = val('mistral', 'stt_minute');
      if (tts === null || stt === null) return null;
      return (tts * taux.estimation_registre.caracteres_par_minute_agent) / 1000 + stt;
    }
  }
}

export type DemandeVoix = {
  profil: VoiceProfile;
  mode: ModeVoix;
  langue: string;
  canal: Canal;
  /** null = available; otherwise the French reason it is not (missing key…). */
  disponibilite: Record<MoteurVoix, string | null>;
};

export type ChoixVoix = {
  moteur: MoteurVoix | null;
  voix: string | null;
  repli: { moteur: MoteurVoix; voix: string }[];
  ecartes: { moteur: MoteurVoix; raison: string }[];
  motif: string;
};

function langueDe(l: string): string {
  return l.toLowerCase().split(/[-_]/)[0];
}

export function choisirMoteur(d: DemandeVoix): ChoixVoix {
  const ecartes: ChoixVoix['ecartes'] = [];
  const langue = langueDe(d.langue || d.profil.locale);
  const retenus: MoteurVoix[] = [];
  for (const m of MOTEURS) {
    const f = FICHES[m];
    const voix = d.profil.voix_par_moteur[m];
    if (!voix) ecartes.push({ moteur: m, raison: `la persona n’a pas de voix chez ${f.libelle} (elle changerait d’identité)` });
    else if (!f.langues.includes(langue)) ecartes.push({ moteur: m, raison: `${f.libelle} ne parle pas « ${langue} » dans notre relevé` });
    else if (!f.canaux.includes(d.canal)) ecartes.push({ moteur: m, raison: `${f.libelle} ne sert pas le canal ${d.canal}` });
    else if (d.disponibilite[m]) ecartes.push({ moteur: m, raison: d.disponibilite[m]! });
    else retenus.push(m);
  }
  const rangRepli = (m: MoteurVoix) => {
    const i = d.profil.ordre_de_repli.indexOf(m);
    return i < 0 ? 99 : i;
  };
  const cout = (m: MoteurVoix) => coutMinuteEstime(m) ?? Number.POSITIVE_INFINITY;
  const parCout = [...retenus].sort((a, b) => cout(a) - cout(b));
  const parQualite = [...retenus].sort((a, b) => FICHES[a].qualite - FICHES[b].qualite);
  const score = (m: MoteurVoix) => parCout.indexOf(m) + parQualite.indexOf(m);
  const cle: Record<ModeVoix, (m: MoteurVoix) => number> = {
    quality_first: (m) => FICHES[m].qualite,
    cost_first: cout,
    balanced: score,
    local_first: (m) => (FICHES[m].local ? -1000 : 0) + score(m),
  };
  const ordre = [...retenus].sort((a, b) => cle[d.mode](a) - cle[d.mode](b) || rangRepli(a) - rangRepli(b));
  const ecart = ecartes.length
    ? ` Écartés : ${ecartes.map((e) => `${FICHES[e.moteur].libelle} (${e.raison})`).join(' ; ')}.`
    : '';
  if (ordre.length === 0) {
    return { moteur: null, voix: null, repli: [], ecartes, motif: `Aucun moteur ne peut faire parler cette persona en « ${langue} » sur le canal ${d.canal}.${ecart}` };
  }
  const [premier, ...reste] = ordre;
  const inconnus = ordre.filter((m) => coutMinuteEstime(m) === null).map((m) => FICHES[m].libelle);
  const motif =
    `Mode « ${LIBELLE_MODE[d.mode]} » : ${FICHES[premier].libelle} retenu, voix « ${d.profil.voix_par_moteur[premier]} » de la persona.` +
    (reste.length ? ` En repli : ${reste.map((m) => FICHES[m].libelle).join(', ')}.` : ' Aucun repli possible.') +
    (inconnus.length && d.mode !== 'quality_first' ? ` Prix non relevé pour ${inconnus.join(', ')} : classé en dernier sur le coût.` : '') +
    ecart;
  return {
    moteur: premier,
    voix: d.profil.voix_par_moteur[premier]!,
    repli: reste.map((m) => ({ moteur: m, voix: d.profil.voix_par_moteur[m]! })),
    ecartes,
    motif,
  };
}

/** Validates a VoiceProfile sent by the back-office; returns a French reason or null. */
export function profilInvalide(p: VoiceProfile): string | null {
  if (!p || typeof p !== 'object') return 'Le profil vocal est vide.';
  if (!p.locale) return 'Le profil vocal doit dire sa langue (locale).';
  if (!p.voix_par_moteur || typeof p.voix_par_moteur !== 'object') return 'Le profil vocal doit donner une voix par moteur.';
  for (const k of Object.keys(p.voix_par_moteur)) {
    if (!MOTEURS.includes(k as MoteurVoix)) return `Moteur inconnu dans le profil : « ${k} ». Connus : ${MOTEURS.join(', ')}.`;
    if (!String(p.voix_par_moteur[k]).trim()) return `La voix pour ${k} est vide.`;
  }
  if (Object.keys(p.voix_par_moteur).length === 0) return 'Le profil vocal ne donne aucune voix.';
  if (!Array.isArray(p.ordre_de_repli)) return 'L’ordre de repli doit être une liste.';
  for (const m of p.ordre_de_repli) if (!(m in p.voix_par_moteur)) return `L’ordre de repli cite ${m}, pour lequel la persona n’a pas de voix.`;
  if (p.palier !== 'standard' && p.palier !== 'premium') return 'Le palier doit être standard ou premium.';
  return null;
}
