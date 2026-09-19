import { QUANTIEME_MAX, type JourSemaine, type Planification } from './fiche.ts';

const JOURS: readonly JourSemaine[] = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

/** L'heure dite explicitement, ou celle que porte un moment de la journée. */
function lireHeure(texte: string): string | null {
  const explicite = texte.match(/\ba\s+(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
  if (explicite) {
    const heure = normaliserHeure(explicite[1], explicite[2]);
    if (heure) return heure;
  }
  const moment = Object.keys(MOMENTS).find((m) => new RegExp(`\\b${m}s?\\b`).test(texte));
  return moment ? MOMENTS[moment] : null;
}

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

  const heure = lireHeure(texte);

  // Mensuel et hebdomadaire passent avant le quotidien : « tous les lundis à 9h »
  // porte une heure, et serait sinon pris pour une tâche de tous les jours.
  const quantieme = texte.match(/\ble\s+(\d{1,2})\b[^.]*\bmois\b|\bmois\b[^.]*\ble\s+(\d{1,2})\b/);
  if (quantieme && heure) {
    const jour = Number(quantieme[1] ?? quantieme[2]);
    // Au-delà du 28, la tâche sauterait les mois courts : on préfère redemander.
    if (jour >= 1 && jour <= QUANTIEME_MAX) {
      return { type: 'mensuelle', jour, heure };
    }
    return null;
  }

  const jourSemaine = JOURS.find((j) => new RegExp(`\\b${j}s?\\b`).test(texte));
  if (jourSemaine && heure) {
    return { type: 'hebdomadaire', jour: jourSemaine, heure };
  }

  const explicite = texte.match(/\ba\s+(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
  if (explicite) {
    const h = normaliserHeure(explicite[1], explicite[2]);
    if (h) return { type: 'quotidienne', heure: h };
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
