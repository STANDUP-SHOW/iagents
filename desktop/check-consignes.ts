import { lireIntention, lirePlanification } from './src/agents/consigne-planning.ts';
import type { Planification } from './src/agents/fiche.ts';

let echecs = 0;
function verifier(intitule: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok  ${intitule}`);
  } else {
    echecs++;
    console.log(`  ÉCHEC  ${intitule}${detail ? ` — ${detail}` : ''}`);
  }
}

const cas: Array<[string, Planification | null]> = [
  ['Je veux que tu fasses ça tous les soirs à 19h', { type: 'quotidienne', heure: '19:00' }],
  ['fais-le tous les jours à 9h', { type: 'quotidienne', heure: '09:00' }],
  ['tous les matins à 8h30', { type: 'quotidienne', heure: '08:30' }],
  ['à 17:45 chaque jour', { type: 'quotidienne', heure: '17:45' }],
  ['tous les soirs', { type: 'quotidienne', heure: '19:00' }],
  ['chaque matin', { type: 'quotidienne', heure: '08:00' }],
  ['toutes les 30 minutes', { type: 'intervalle', minutes: 30 }],
  ['toutes les 2 heures', { type: 'intervalle', minutes: 120 }],
  ['quand je reçois un email', { type: 'declencheur', evenement: 'email.recu' }],
  ['dès que quelqu un dépose un fichier', { type: 'declencheur', evenement: 'fichier.depose' }],
  ['à chaque fois que je reçois un whatsapp', { type: 'declencheur', evenement: 'whatsapp.recu' }],
  ['seulement à la demande', { type: 'a-la-demande' }],
  ['quand je te le dis', { type: 'a-la-demande' }],
  ['tous les lundis à 9h', { type: 'hebdomadaire', jour: 'lundi', heure: '09:00' }],
  ['chaque vendredi à 17h30', { type: 'hebdomadaire', jour: 'vendredi', heure: '17:30' }],
  ['tous les lundis matin', { type: 'hebdomadaire', jour: 'lundi', heure: '08:00' }],
  ['tous les mois le 5 à 10h', { type: 'mensuelle', jour: 5, heure: '10:00' }],
  ['le 15 de chaque mois à 8h', { type: 'mensuelle', jour: 15, heure: '08:00' }],
  // Ambigu : l'agent doit redemander, pas inventer un horaire.
  ['tous les lundis', null],
  ['tous les mois le 31 à 9h', null],
  ['fais-le plus souvent', null],
  ['occupe-toi de la facturation', null],
  ['toutes les 2 minutes', null],
  ['à 25h', null],
];

for (const [phrase, attendu] of cas) {
  const obtenu = lirePlanification(phrase);
  const ok = JSON.stringify(obtenu) === JSON.stringify(attendu);
  verifier(
    `« ${phrase} »`,
    ok,
    ok ? '' : `obtenu ${JSON.stringify(obtenu)} au lieu de ${JSON.stringify(attendu)}`
  );
}

verifier(
  '« arrête de faire ça » désactive la tâche',
  lireIntention('arrête de faire ça')?.verbe === 'desactiver'
);

verifier(
  '« ne fais plus les avoirs » désactive la tâche',
  lireIntention('ne fais plus les avoirs')?.verbe === 'desactiver'
);

const planifie = lireIntention('tu me fais le compte rendu tous les soirs à 19h');
verifier(
  'une consigne horaire donne une intention de planification',
  planifie?.verbe === 'planifier' &&
    planifie.planification.type === 'quotidienne' &&
    planifie.planification.heure === '19:00'
);

verifier(
  "une consigne qui ne dit ni quoi ni quand ne produit aucune intention",
  lireIntention('bon, très bien') === null
);

console.log();
if (echecs > 0) {
  console.log(`${echecs} échec(s) — consignes de planning`);
  process.exit(1);
}
console.log(`${cas.length + 4} attentes tenues — consignes de planning ok`);
