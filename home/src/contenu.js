// Words of the Home site, written once (MASTER §13). No price here: prices
// live in src/tarifs.js only, and the bench refuses an amount anywhere else.

export const PROMESSE = 'Vous gérez votre vie ; votre Home Agent gère ce qui l’encombre.';
export const SITE = 'https://home.iagent.agency';
export const BUSINESS = 'https://iagent.agency';

/** Navigation Home (MASTER §3): Home · Ce qu'il fait · Box Home · Tarifs · Sécurité · Aide. */
export const NAVIGATION = [
  { chemin: '/', libelle: 'Home' },
  { chemin: '/ce-qu-il-fait', libelle: 'Ce qu’il fait' },
  { chemin: '/box-home', libelle: 'Box Home' },
  { chemin: '/tarifs', libelle: 'Tarifs' },
  { chemin: '/securite', libelle: 'Sécurité' },
  { chemin: '/aide', libelle: 'Aide' },
];

/** The eleven Home functions of MASTER §13, each with what it means at home. */
export const FONCTIONS = [
  { id: 'courriers', titre: 'Courriers et e-mails', texte: 'Il lit ce qui arrive, le trie et le résume. Vous savez en une phrase ce qui demande une réponse et ce qui peut attendre.' },
  { id: 'agenda', titre: 'Agenda familial', texte: 'Les rendez-vous de chacun réunis au même endroit. Les chevauchements sont repérés avant de devenir un problème.' },
  { id: 'rendez-vous', titre: 'Rendez-vous', texte: 'Il cherche un créneau qui convient à tout le monde et prépare la prise de rendez-vous, selon la règle que vous avez choisie.' },
  { id: 'factures', titre: 'Factures et abonnements', texte: 'Chaque facture est lue et classée. Une hausse, un doublon ou un abonnement oublié vous est signalé.' },
  { id: 'energie', titre: 'Énergie, eau, télécoms', texte: 'Contrats, relevés et échéances suivis pour vous, avec un rappel quand quelque chose change.' },
  { id: 'ecole', titre: 'École, cantine, inscriptions', texte: 'Les dates d’inscription, les papiers à rendre et les réponses aux messages de l’école, préparés à temps.' },
  { id: 'assurances', titre: 'Assurances', texte: 'Vos contrats et leurs échéances au même endroit, les attestations retrouvées quand on vous les demande.' },
  { id: 'classement', titre: 'Classement', texte: 'Vos documents rangés au bon endroit, et retrouvés quand vous les demandez.' },
  { id: 'rappels', titre: 'Rappels et échéances', texte: 'Ce qui expire, ce qui se renouvelle, ce qui se paie : rappelé avant, pas après.' },
  { id: 'reservations', titre: 'Réservations simples', texte: 'Une table, un créneau, une activité : il prépare la réservation et vous la soumet.' },
  { id: 'demarches', titre: 'Réponses et démarches', texte: 'Il prépare le courrier, le formulaire ou la réponse. Vous relisez ; rien d’important ne part sans vous.' },
];

/** Levels of the action policy, from the most free to the most guarded. */
export const NIVEAUX = {
  autonome: { libelle: 'Autonome', explication: 'L’agent le fait seul, et vous le voyez dans ce qu’il a fait.' },
  regle: { libelle: 'Selon votre règle', explication: 'Vous décidez une fois pour toutes ce qu’il peut faire seul, et ce qu’il doit vous demander.' },
  confirmation: { libelle: 'Confirmation', explication: 'L’agent prépare tout ; rien ne part tant que vous n’avez pas dit oui.' },
  forte: { libelle: 'Confirmation forte', explication: 'Le montant ou le contrat sous les yeux, une validation explicite que vous seul pouvez donner.' },
};

/** Action policy table (MASTER §13). */
export const POLITIQUE = [
  { action: 'Lire et classer une facture', niveau: 'autonome' },
  { action: 'Préparer une réponse', niveau: 'autonome' },
  { action: 'Envoyer un courrier important', niveau: 'confirmation' },
  { action: 'Prendre un rendez-vous', niveau: 'regle' },
  { action: 'Payer une facture', niveau: 'forte' },
  { action: 'Modifier ou résilier un contrat', niveau: 'forte' },
];

/** What each offer contains (MASTER §13, "Contenu"), worded for a household. */
export const CONTENU_OFFRES = {
  'home-digital': {
    accroche: 'L’administratif du foyer, sans matériel.',
    points: ['Courriers, e-mails et factures lus et classés', 'Rappels et échéances', 'Réponses et démarches préparées'],
  },
  'home-agent': {
    accroche: 'Votre agent, à qui l’on parle.',
    points: ['Tout Home Digital', 'La voix : vous lui parlez, il vous répond', 'Automatisations et connexions à vos comptes'],
  },
  'home-box': {
    accroche: 'L’agent, sa Box et l’entretien.',
    points: ['Tout Home Agent', 'La Box Home blanche, louée', 'Maintenance comprise'],
  },
  'home-family': {
    accroche: 'Pour tout le foyer.',
    points: ['Plusieurs profils dans la maison', 'Un calendrier par personne, réunis', 'Pensé pour la vie de famille'],
  },
};

export const QUESTIONS = [
  { q: 'Qu’est-ce qu’un Home Agent ?', r: 'Un agent numérique qui s’occupe de l’administratif du foyer : courriers, factures, rendez-vous, rappels, démarches. Il prépare, classe et vous prévient ; les décisions importantes restent les vôtres.' },
  { q: 'Peut-il payer ou résilier à ma place ?', r: 'Pas sans vous. Payer une facture, modifier ou résilier un contrat demandent une confirmation forte : le montant ou le contrat sous les yeux, une validation explicite que vous seul pouvez donner.' },
  { q: 'Faut-il une Box Home ?', r: 'Non. Home Digital et Home Agent fonctionnent sans Box. La Box Home est comprise dans l’offre Home Box, pour qui veut un agent installé à la maison, avec la voix et l’entretien.' },
  { q: 'La Box Home m’appartient-elle ?', r: 'Non, elle est louée. Elle reste la propriété d’iAgent, qui l’entretient, la met à jour et la remplace selon votre offre. En fin de contrat, elle est restituée.' },
  { q: 'Les prix sont-ils TTC ?', r: 'Oui. Tous les prix affichés sur ce site sont toutes taxes comprises, par mois.' },
  { q: 'Et pour mon entreprise ?', r: 'iAgent Home est fait pour le foyer. Pour une entreprise, c’est iAgent Business, sur iagent.agency.' },
];
