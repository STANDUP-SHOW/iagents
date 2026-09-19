import type { Planification } from './fiche';

const MOMENTS: Record<string, string> = {
  matin: '08:00',
  'midi': '12:00',
  'apres-midi': '14:00',
  soir: '19:00',
  soiree: '19:00',
  nuit: '22:00',
};

const EVENEMENTS: Array<[RegExp, Planification]> = [
  [/\b(email|mail|courriel)\b/, { type: 'declencheur', evenement: 'email.recu' }],
  [/\bwhatsapp\b/, { type: 'declencheur', evenement: 'whatsapp.recu' }],
  [/\b(fichier|document)\b/, { type: 'declencheur', evenement: 'fichier.depose' }],
  [/\b(rendez-?vous|agenda|calendrier)\b/, { type: 'declencheur', evenement: 'calendrier.evenement' }],
  [/\bappel\b/, { type: 'declencheur', evenement: 'appel.recu' }],
];

function sansAccents(phrase: string): string {
  return phrase
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function normaliserHeure(heures: string, minutes: string | undefined): string | null {
  const h = Number(heures);
  const m = minutes === undefined || minutes === '' ? 0 : Number(minutes);
  if (!Number.isInteger(h) || h < 0 || h > 23) return null;
  if (!Number.isInteger(m) || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Lit une consigne parlée et en tire un rythme d'exécution.
 * « tous les soirs à 19h » → { type: 'quotidienne', heure: '19:00' }
 *
 * Rend null dès que la phrase est ambiguë : c'est à l'agent de redemander,
 * jamais de deviner un horaire que l'employeur n'a pas donné.
 */
export function lirePlanification(phrase: string): Planification | null {
  const texte = sansAccents(phrase);

  if (/\b(a la demande|quand je te le dis|quand je te demande|sur demande)\b/.test(texte)) {
    return { type: 'a-la-demande' };
  }

  const intervalle = texte.match(
    /\btoutes? les\s+(\d{1,3})\s*(minutes?|min\b|heures?|h\b)/
  );
  if (intervalle) {
    const valeur = Number(intervalle[1]);
    const enHeures = /^h|^heure/.test(intervalle[2]);
    const minutes = enHeures ? valeur * 60 : valeur;
    // En dessous de cinq minutes, le contrat de paquet refuse l'intervalle.
    return minutes >= 5 ? { type: 'intervalle', minutes } : null;
  }

  const heureExplicite = texte.match(/\ba\s+(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
  if (heureExplicite) {
    const heure = normaliserHeure(heureExplicite[1], heureExplicite[2]);
    if (heure) return { type: 'quotidienne', heure };
  }

  for (const [motif, planification] of EVENEMENTS) {
    if (/\b(quand|des que|a chaque fois que|lorsque)\b/.test(texte) && motif.test(texte)) {
      return planification;
    }
  }

  const moment = Object.keys(MOMENTS).find((m) =>
    new RegExp(`\\b(tous les|toutes les|chaque)\\s+${m}s?\\b`).test(texte)
  );
  if (moment) return { type: 'quotidienne', heure: MOMENTS[moment] };

  return null;
}

export type Intention =
  | { verbe: 'planifier'; planification: Planification }
  | { verbe: 'desactiver' }
  | { verbe: 'activer' };

/**
 * Ce que l'employeur demande de faire au planning. Une consigne qui ne dit ni
 * quoi faire ni quand rend null : l'agent redemande plutôt que de supposer.
 */
export function lireIntention(phrase: string): Intention | null {
  const texte = sansAccents(phrase);

  if (/\b(arrete|arreter|ne fais plus|ne fait plus|desactive|supprime|annule)\b/.test(texte)) {
    return { verbe: 'desactiver' };
  }

  const planification = lirePlanification(phrase);
  if (planification) return { verbe: 'planifier', planification };

  if (/\b(reprends|reactive|remets|active)\b/.test(texte)) {
    return { verbe: 'activer' };
  }

  return null;
}
