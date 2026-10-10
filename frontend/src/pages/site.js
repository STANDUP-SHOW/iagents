// The offer pages of max's site plan (07/10, §3), named once. The build makes
// one HTML page per entry (pages/html.mjs), prerenders it (accueil/prerendre.mjs)
// and the link check refuses a link to a page that is not here.
export const PAGES = [
  { nom: 'workforce', titre: 'iAgent Workforce : un collaborateur numérique managé', description: "Des agents par métier, une Box installée chez vous, Desktop Commander pour les diriger, la consommation d'IA à part : l'offre iAgent en une page." },
  { nom: 'box', titre: 'iAgent Box : votre équipe IA, installée dans votre entreprise', description: "Un poste tactile préparé pour vos agents, avec voix, micro et Desktop Commander, mis à disposition sous abonnement et maintenu par iAgent." },
  { nom: 'pricing', titre: 'Tarifs iAgent : abonnement fixe, consommation à part', description: "Le prix de la Box, des agents, du Task Commander et des packs, et ce qui se paie à l'usage : API d'IA, voix, téléphonie." },
  { nom: 'how-it-works', titre: 'Comment ça marche : du recrutement au travail', description: "Décrivez votre besoin, choisissez vos agents, faites passer l'entretien d'embauche : iAgent prépare la Box et met l'équipe au travail." },
  { nom: 'local-ai', titre: 'IA locale et hybride pour les entreprises', description: "Faire tourner vos agents chez vous, dans le cloud ou entre les deux : confidentialité, contrôle et coût à grande échelle. Infrastructure sur devis." },
  { nom: 'security', titre: 'Sécurité et contrôle : autonome ne signifie pas incontrôlé', description: "Ce que chaque agent peut ouvrir, ce qui attend votre accord, ce qui est consigné : comment iAgent garde le travail sous votre contrôle." },
  { nom: 'skills', titre: "Des agents qui évoluent : maintenance et Skill Packs", description: "Vous ne louez pas un logiciel figé : chaque agent est maintenu, mis à jour et enrichi de compétences métier, de procédures et de connecteurs." },
  { nom: 'iagent-inside-iagent', titre: 'iAgent inside iAgent : notre entreprise tourne avec nos agents', description: "La première entreprise que nous faisons fonctionner avec iAgent est la nôtre : l'organisation de notre équipe d'agents." },
  { nom: 'enterprise', titre: 'iAgent Enterprise : déploiements sur mesure', description: "Plusieurs Box, plusieurs sites, puissance locale et intégrations à vos logiciels : un déploiement iAgent conçu avec vous." },
  { nom: 'faq', titre: 'Questions fréquentes sur iAgent', description: "Données, prix, fin de contrat, autonomie des agents, nombre d'agents par Box : les réponses aux questions qu'on nous pose." },
  { nom: 'why-rent', titre: 'Pourquoi louer ses agents : le coût réel de reconstruction', description: "Décrire chaque métier, connaître les logiciels, faire tourner les modèles, construire l'application, tenir la machine : ce qu'il faudrait reconstruire soi-même." },
  { nom: 'voice', titre: 'iAgent Voice : une voix et bientôt un numéro pour vos agents', description: "Parlez à vos agents à voix haute dès aujourd'hui ; standard, support et campagnes d'appels arrivent bientôt." },
  { nom: 'standard-telephonique', titre: 'Standard téléphonique IA : un accueil qui comprend ce qu’on lui dit', description: "Un numéro, un accueil en conversation, une extension par agent et la main à l'humain : le standard iAgent arrive bientôt." },
  { nom: 'support-center', titre: 'iAgent Support Center : votre SAV au téléphone', description: "Plusieurs appels à la fois, des files, un ticket par appel et l'escalade vers un humain : le centre de support iAgent arrive bientôt." },
  { nom: 'sales-center', titre: "iAgent Sales Center : des campagnes d'appels dans les règles", description: "Relances, rendez-vous et suivi de devis par vos agents, avec consentement et plages horaires respectés : arrive bientôt." },
  { nom: 'create', titre: 'iAgent Create : de votre idée à une entreprise composée', description: "Décrivez votre projet : iAgent propose l'équipe d'agents qui l'étudie, le finance, le construit, le lance et le fait tourner." },
  { nom: 'opportunities', titre: 'Opportunités : des projets repérés sur le marché', description: "Des projets repérés, avec leurs scénarios, leurs coûts, leurs risques et l'équipe d'agents qu'il faudrait. Aucune promesse de rentabilité." },
  { nom: 'contact', titre: 'Contact et démonstration iAgent', description: "Une démonstration, une équipe à composer, une infrastructure à dimensionner : dites-nous ce que vous voulez accomplir." },
  { nom: 'mentions-legales', titre: 'Mentions légales iAgent', description: "L'éditeur du site iagent.agency, son directeur de la publication, son hébergeur et l'usage des données que vous nous confiez." },
];

export const page = (nom) => {
  const p = PAGES.find((x) => x.nom === nom);
  if (!p) throw new Error(`page inconnue : ${nom}`);
  return p;
};

// Where requests from the contact and quote forms go. Not set yet: max has to
// name the address that receives them; until then the form says so instead of
// pretending to send.
export const CONTACT = null;
