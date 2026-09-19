#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentsDir = path.join(__dirname, 'agents');

const SECTEURS = [
  {
    secteur: 'secretariat-support',
    nom_secteur: 'Secrétariat & Support',
    start: 990,
    count: 20,
    roles: [
      { slug: 'assistant-secretaire-direction', nom: 'Assistant Secrétaire de Direction' },
      { slug: 'coordinateur-agenda-executif', nom: 'Coordinateur Agenda Exécutif' },
      { slug: 'gestionnaire-correspondances', nom: 'Gestionnaire Correspondances' },
      { slug: 'assistant-reception-accueil', nom: 'Assistant Réception Accueil' },
      { slug: 'coordinateur-voyages-seminaires', nom: 'Coordinateur Voyages Séminaires' },
      { slug: 'gestionnaire-bases-donnees-contacts', nom: 'Gestionnaire Bases Données Contacts' },
      { slug: 'assistant-gestion-reunion', nom: 'Assistant Gestion Réunion' },
      { slug: 'coordinateur-protocole-etiquette', nom: 'Coordinateur Protocole Étiquette' },
      { slug: 'agent-support-administratif', nom: 'Agent Support Administratif' },
      { slug: 'specialiste-archivage-classement', nom: 'Spécialiste Archivage Classement' },
      { slug: 'assistant-formalites-administratives', nom: 'Assistant Formalités Administratives' },
      { slug: 'coordinateur-demandes-conges', nom: 'Coordinateur Demandes Congés' },
      { slug: 'gestionnaire-fournitures-materiel', nom: 'Gestionnaire Fournitures Matériel' },
      { slug: 'assistant-facturation-devis', nom: 'Assistant Facturation Devis' },
      { slug: 'coordinateur-accreditations', nom: 'Coordinateur Accréditations' },
      { slug: 'agent-telemarketing-teletravail', nom: 'Agent Télémarketing Télétravail' },
      { slug: 'gestionnaire-documents-secrets', nom: 'Gestionnaire Documents Secrets' },
      { slug: 'assistant-planning-ressources', nom: 'Assistant Planning Ressources' },
      { slug: 'coordinateur-controle-presence', nom: 'Coordinateur Contrôle Présence' },
      { slug: 'specialiste-saisie-donnees', nom: 'Spécialiste Saisie Données' },
    ]
  },
  {
    secteur: 'comptabilite-analytique',
    nom_secteur: 'Comptabilité Analytique',
    start: 1010,
    count: 20,
    roles: [
      { slug: 'agent-comptabilite-analytique', nom: 'Agent Comptabilité Analytique' },
      { slug: 'analyste-couts-directs', nom: 'Analyste Coûts Directs' },
      { slug: 'gestionnaire-centres-couts', nom: 'Gestionnaire Centres de Coûts' },
      { slug: 'specialiste-imputations-comptables', nom: 'Spécialiste Imputations Comptables' },
      { slug: 'analyste-marge-contributive', nom: 'Analyste Marge Contributive' },
      { slug: 'assistant-ventilation-charges', nom: 'Assistant Ventilation Charges' },
      { slug: 'coordinateur-allocation-frais', nom: 'Coordinateur Allocation Frais' },
      { slug: 'agent-trace-couts', nom: 'Agent Traçabilité Coûts' },
      { slug: 'gestionnaire-budgets-analytiques', nom: 'Gestionnaire Budgets Analytiques' },
      { slug: 'analyste-marges-produits', nom: 'Analyste Marges Produits' },
      { slug: 'assistant-consolidation-analytique', nom: 'Assistant Consolidation Analytique' },
      { slug: 'specialiste-abonnements-services', nom: 'Spécialiste Abonnements Services' },
      { slug: 'agent-suivi-engagement-depenses', nom: 'Agent Suivi Engagement Dépenses' },
      { slug: 'analyste-profitabilite-client', nom: 'Analyste Profitabilité Client' },
      { slug: 'coordinateur-restructuration-comptable', nom: 'Coordinateur Restructuration Comptable' },
      { slug: 'gestionnaire-amortissements-analytiques', nom: 'Gestionnaire Amortissements Analytiques' },
      { slug: 'agent-rapprochement-comptabilites', nom: 'Agent Rapprochement Comptabilités' },
      { slug: 'analyste-cout-revient', nom: 'Analyste Coût de Revient' },
      { slug: 'assistant-audit-piste-couts', nom: 'Assistant Audit Piste Coûts' },
      { slug: 'specialiste-comptabilite-auxiliaire', nom: 'Spécialiste Comptabilité Auxiliaire' },
    ]
  },
  {
    secteur: 'tresorerie',
    nom_secteur: 'Trésorerie',
    start: 1030,
    count: 15,
    roles: [
      { slug: 'assistant-tresorier', nom: 'Assistant Trésorier' },
      { slug: 'gestionnaire-flux-tresorerie', nom: 'Gestionnaire Flux Trésorerie' },
      { slug: 'analyste-liquidites', nom: 'Analyste Liquidités' },
      { slug: 'coordinateur-paiements', nom: 'Coordinateur Paiements' },
      { slug: 'agent-suivi-encaissements', nom: 'Agent Suivi Encaissements' },
      { slug: 'specialiste-gestion-banques', nom: 'Spécialiste Gestion Banques' },
      { slug: 'gestionnaire-valeurs-mobilires', nom: 'Gestionnaire Valeurs Mobilières' },
      { slug: 'analyste-besoins-financement', nom: 'Analyste Besoins Financement' },
      { slug: 'agent-rapprochements-bancaires', nom: 'Agent Rapprochements Bancaires' },
      { slug: 'coordinateur-emprunts-dettes', nom: 'Coordinateur Emprunts Dettes' },
      { slug: 'gestionnaire-credits-fournisseurs', nom: 'Gestionnaire Crédits Fournisseurs' },
      { slug: 'assistant-placement-temporaire', nom: 'Assistant Placement Temporaire' },
      { slug: 'analyste-previsions-tresorerie', nom: 'Analyste Prévisions Trésorerie' },
      { slug: 'agent-gestion-garanties', nom: 'Agent Gestion Garanties' },
      { slug: 'specialiste-echange-devises', nom: 'Spécialiste Échange Devises' },
    ]
  },
  {
    secteur: 'controle-gestion',
    nom_secteur: 'Contrôle de Gestion',
    start: 1045,
    count: 18,
    roles: [
      { slug: 'controleur-gestion-junior', nom: 'Contrôleur de Gestion Junior' },
      { slug: 'analyste-ecarts-budgetaires', nom: 'Analyste Écarts Budgétaires' },
      { slug: 'assistant-elaboration-budgets', nom: 'Assistant Élaboration Budgets' },
      { slug: 'gestionnaire-indicateurs-kpi', nom: 'Gestionnaire Indicateurs KPI' },
      { slug: 'specialiste-reconciliation-donnees', nom: 'Spécialiste Réconciliation Données' },
      { slug: 'agent-suivi-performance-activites', nom: 'Agent Suivi Performance Activités' },
      { slug: 'analyste-tendances-previsions', nom: 'Analyste Tendances Prévisions' },
      { slug: 'coordinateur-reporting-operationnel', nom: 'Coordinateur Reporting Opérationnel' },
      { slug: 'assistant-analyses-scenarios', nom: 'Assistant Analyses Scénarios' },
      { slug: 'gestionnaire-tableaux-de-bord', nom: 'Gestionnaire Tableaux de Bord' },
      { slug: 'analyste-profitabilite-activites', nom: 'Analyste Profitabilité Activités' },
      { slug: 'agent-piloter-budgets-departements', nom: 'Agent Piloter Budgets Départements' },
      { slug: 'specialiste-consolidation-donnees', nom: 'Spécialiste Consolidation Données' },
      { slug: 'coordinateur-audit-interne-finances', nom: 'Coordinateur Audit Interne Finances' },
      { slug: 'assistant-ameliorations-processus', nom: 'Assistant Améliorations Processus' },
      { slug: 'analyste-cost-saving-opportunities', nom: 'Analyste Cost-Saving Opportunities' },
      { slug: 'gestionnaire-cycles-cloture', nom: 'Gestionnaire Cycles Clôture' },
      { slug: 'agent-dashboards-decisionnels', nom: 'Agent Dashboards Décisionnels' },
    ]
  },
  {
    secteur: 'paie-charges-sociales',
    nom_secteur: 'Paie & Charges Sociales',
    start: 1063,
    count: 20,
    roles: [
      { slug: 'agent-paie-junior', nom: 'Agent Paie Junior' },
      { slug: 'specialiste-calcul-remunerations', nom: 'Spécialiste Calcul Rémunérations' },
      { slug: 'gestionnaire-donnees-personnelles-paie', nom: 'Gestionnaire Données Personnelles Paie' },
      { slug: 'assistant-cotisations-sociales', nom: 'Assistant Cotisations Sociales' },
      { slug: 'coordinateur-bulletins-paie', nom: 'Coordinateur Bulletins Paie' },
      { slug: 'analyste-charges-patronales', nom: 'Analyste Charges Patronales' },
      { slug: 'agent-versement-organisme-social', nom: 'Agent Versement Organisme Social' },
      { slug: 'specialiste-declarations-urssaf', nom: 'Spécialiste Déclarations URSSAF' },
      { slug: 'gestionnaire-avantages-salaries', nom: 'Gestionnaire Avantages Salariés' },
      { slug: 'assistant-heures-supplementaires', nom: 'Assistant Heures Supplémentaires' },
      { slug: 'coordinateur-dsp-dsn', nom: 'Coordinateur DSP / DSN' },
      { slug: 'analyste-conformite-social', nom: 'Analyste Conformité Social' },
      { slug: 'agent-traitement-arretes-paie', nom: 'Agent Traitement Arrêtés Paie' },
      { slug: 'specialiste-anciennete-gratuites', nom: 'Spécialiste Ancienneté Gratuités' },
      { slug: 'gestionnaire-mutuelle-assurance', nom: 'Gestionnaire Mutuelle Assurance' },
      { slug: 'assistant-congestion-maternite', nom: 'Assistant Congés Maternité' },
      { slug: 'coordinateur-declarations-cnil', nom: 'Coordinateur Déclarations CNIL' },
      { slug: 'agent-suivi-contentieux-paie', nom: 'Agent Suivi Contentieux Paie' },
      { slug: 'analyste-variations-masses-salariales', nom: 'Analyste Variations Masses Salariales' },
      { slug: 'specialiste-reconversion-formation', nom: 'Spécialiste Reconversion Formation' },
    ]
  }
];

const CONNECTEURS_STANDARD = [
  'voix', 'conversation', 'email', 'whatsapp', 'calendrier', 'fichiers'
];

const LOGICIELS_PAR_SECTEUR = {
  'secretariat-support': ['client-email', 'calendrier', 'libreoffice', 'gestion-documents'],
  'comptabilite-analytique': ['excel', 'logiciel-comptabilite', 'client-email'],
  'tresorerie': ['excel', 'logiciel-comptabilite', 'logiciel-bancaire', 'client-email'],
  'controle-gestion': ['excel', 'logiciel-comptabilite', 'bi-tool', 'client-email'],
  'paie-charges-sociales': ['logiciel-paie', 'excel', 'client-email', 'gestion-rh'],
};

function genererFiche(num, slug, nom, secteur, nomSecteur) {
  const id = `AG-${String(num).padStart(4, '0')}`;

  const taches = genererTaches(slug, secteur, num);

  return {
    format: 'iagent-paquet/1',
    id,
    slug,
    version: '1.0.0',
    famille: 'metier',
    secteur,
    nom,
    accroche: genererAccroche(nom, nomSecteur),
    description: genererDescription(nom, nomSecteur, taches),
    expert: genererExpert(nom, nomSecteur),
    taches,
    connecteurs: CONNECTEURS_STANDARD,
    acces: {
      dossiers: 'choisis',
      internet: true,
      logiciels: LOGICIELS_PAR_SECTEUR[secteur] || ['client-email', 'excel']
    },
    modeles: {
      texte: 'texte-standard',
      audio: 'audio-parole',
      embeddings: 'embeddings',
      activite: 0.2
    },
    materiel: {
      ram: 16,
      vram: 6,
      cpuCoeurs: 6,
      disque: 20,
      chargeContinue: 0.12,
      gpu: {
        classe: 'integre',
        libelle: 'GPU intégré récent (classe Radeon 780M / Apple M), mémoire partagée avec la RAM'
      }
    },
    commercial: {
      profil: 'PR-00',
      priorite: 'P2',
      pack: 'Pro Agent / AI Team',
      prixMensuel: {
        min: 199,
        max: 999
      },
      autonomie: 'Copilote / autonome selon workflow',
      besoinHumain: 'Décision/expertise humaine',
      risqueReglementaire: 'Moyen'
    },
    miseAJour: {
      canal: 'stable',
      appMinimum: '1.0.0',
      notes: 'Première version.'
    },
    profil_risque: 'PR-00',
    resume_metier: genererResume(nom),
    execution: {
      modes: ['local', 'api'],
      defaut: 'local',
      bascule: 'automatique',
      api: {
        capacites: {
          texte: 'llm',
          audio: 'parole',
          embeddings: 'embeddings'
        }
      },
      appelsParJourEstimes: 15
    }
  };
}

function genererAccroche(nom, secteur) {
  const accroches = [
    `Un spécialiste en ${nom.toLowerCase()} qui gère vos workflows, jour et nuit, sur votre machine.`,
    `Votre expert ${nom.toLowerCase()} qui automatise et optimise vos processus quotidiens.`,
    `${nom} - Automatisez vos tâches et gagnez du temps avec cet assistant IA spécialisé.`,
    `Expert en ${nom.toLowerCase()}, il gère vos opérations sans interruption, jour et nuit.`,
  ];
  return accroches[Math.floor(Math.random() * accroches.length)];
}

function genererDescription(nom, secteur, taches) {
  const descriptions = [
    `${nom} automatise vos processus quotidiens dans le domaine de la ${secteur.toLowerCase()}. Il traite les documents, met à jour vos bases de données, prépare les rapports nécessaires, et escalade uniquement ce qui demande votre expertise. Chaque matin il examine votre calendrier, prépare les actions du jour et les soumet à votre accord avant exécution.`,
    `${nom} gère l'ensemble de vos workflows opérationnels en ${secteur.toLowerCase()}. Il classe les données, vérifie la conformité, prépare les documents, et vous signale en temps réel les écarts ou les actions requises. Avec une expertise complète du domaine, il anticipe vos besoins et prépare tout ce qui doit être fait.`,
    `Assistant spécialisé en ${secteur.toLowerCase()}, ${nom} prend en charge vos tâches récurrentes et complexes. Il maintient vos registres à jour, gère vos correspondances, prépare vos analyses, et vous laisse vous concentrer sur les décisions qui comptent vraiment. Tout son travail est consultable et vérifiable en temps réel.`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function genererExpert(nom, secteur) {
  return {
    persona: `Vingt ans d'expérience opérationnelle en ${secteur.toLowerCase()}. Réputé pour son organisation irréprochable, son attention au détail, sa maîtrise des procédures et sa capacité à communiquer clairement avec tous les niveaux. Connaît par cœur les usages professionnels français, les délais courants, les bonnes pratiques du secteur et la façon de traiter avec les administrations et partenaires commerciaux. Reconnu pour ne rien laisser traîner et pour l'exactitude de ses dossiers.`,
    consigne: `Tu es un spécialiste en ${nom.toLowerCase()} de l'entreprise de ton utilisateur. Tu travailles en local, sur sa machine, avec les seuls dossiers et comptes qu'il t'a ouverts. Tu t'exprimes en français, avec la correction d'une correspondance professionnelle : vouvoiement, formules d'usage sobres, aucune familiarité, aucune faute.

Ton travail quotidien consiste à examiner les documents et dossiers en attente, les traiter selon les règles en vigueur, extraire les informations clés, ranger les pièces jointes dans le bon dossier, et préparer les actions ou documents nécessaires pour le jour suivant. Une action préparée est toujours un brouillon : tu ne l'envoies jamais toi-même tant que la tâche exige une validation. Tu maintiens à jour les registres et bases de données de l'utilisateur, tu relances selon les calendriers définis, et tu rends compte chaque jour de ce qui a été fait.

Ce que tu ne fais jamais : inventer un fait, une date ou un engagement. Quand une information manque, tu poses la question à l'utilisateur. Tu ne signes jamais un document à sa place. Tu n'envoies jamais un document à un destinataire extérieur sans qu'il l'ait validé au préalable.

Quand l'utilisateur te parle, tu réponds comme un collègue de confiance : brièvement, avec ce qu'il faut savoir en premier, puis le détail s'il le demande. Tu consignes chaque erreur ou refus dans le journal du jour. Tu escalades immédiatement toute situation anormale qui t'empêche d'avancer.`,
    connaissances: [
      {
        titre: 'Procédures opérationnelles et bonnes pratiques',
        resume: 'Maîtrise complète des procédures clés du domaine, des flux de traitement standard, des modèles de documents, des niveaux d\'escalade et de la gestion des exceptions courantes dans le secteur.'
      },
      {
        titre: 'Outils bureautiques et systèmes collaboratifs',
        resume: 'Excellente maîtrise de Word, Excel, Outlook, Google Workspace, systèmes de gestion documentaire, signatures électroniques, et bases de données simples. Capacité à importer/exporter des données et à générer des rapports automatisés.'
      },
      {
        titre: 'Calendriers, délais et conformité',
        resume: 'Connaissance des délais légaux et réglementaires, calendriers de déclaration obligatoires, alertes saisonnières, conservation légale des documents, et suivi des obligations périodiques.'
      },
      {
        titre: 'Correspondance professionnelle et rédaction',
        resume: 'Maîtrise de la rédaction professionnelle française, formules d\'usage adaptées, structures de courriers officiels, et tons appropriés selon le contexte.'
      }
    ],
    regles: [
      'Aucun document ne quitte l\'entreprise sans validation préalable de l\'utilisateur.',
      'Toute date limite ou obligation légale est escaladée 48 heures avant l\'échéance.',
      'Chaque action effectuée est documentée avec références, horodatage et traçabilité.'
    ]
  };
}

function genererTaches(slug, secteur, num) {
  const baseTaches = [
    {
      id: 'traiter-entrees-quotidiennes',
      nom: 'Traiter les entrées quotidiennes',
      description: 'Examine chaque jour les documents et demandes reçus, les classe, extrait les informations clés et range les pièces jointes appropriées.',
      planification: { type: 'quotidienne', heure: '09:00' },
      entrees: ['email', 'fichiers'],
      sorties: [{ dossier: 'travail/traite', format: 'md' }],
      logiciels: ['client-email'],
      validationHumaine: false
    },
    {
      id: 'maintenir-registres-a-jour',
      nom: 'Maintenir les registres à jour',
      description: 'Met à jour quotidiennement les bases de données, les listes de suivi et les dossiers principaux avec les informations du jour.',
      planification: { type: 'quotidienne', heure: '14:00' },
      entrees: ['dossier:travail'],
      sorties: [{ dossier: 'travail/registres', format: 'json' }],
      logiciels: [],
      validationHumaine: false
    },
    {
      id: 'preparer-relances',
      nom: 'Préparer les relances',
      description: 'Compare la liste des actions à faire à l\'état réel, prépare les relances dues et les soumet à validation.',
      planification: { type: 'quotidienne', heure: '11:00' },
      entrees: ['dossier:travail/a-traiter'],
      sorties: [{ dossier: 'travail/relances', format: 'eml' }],
      logiciels: ['client-email'],
      validationHumaine: true
    },
    {
      id: 'generer-rapports',
      nom: 'Générer les rapports',
      description: 'Prépare les rapports, analyses et synthèses demandés, avec chiffres, graphiques et conclusions pertinentes.',
      planification: { type: 'quotidienne', heure: '16:00' },
      entrees: ['dossier:travail', 'fichiers'],
      sorties: [{ dossier: 'travail/rapports', format: 'pdf' }],
      logiciels: ['excel'],
      validationHumaine: true
    },
    {
      id: 'verifier-conformite',
      nom: 'Vérifier la conformité',
      description: 'Contrôle que tous les documents disposent des informations obligatoires, signatures et mentions légales requises.',
      planification: { type: 'intervalle', minutes: 120 },
      entrees: ['dossier:travail/a-valider'],
      sorties: [{ dossier: 'travail/controle', format: 'json' }],
      logiciels: [],
      validationHumaine: false
    },
    {
      id: 'rendre-compte-jour',
      nom: 'Rendre compte du jour',
      description: 'À 17h, écrit ce qui a été fait, ce qui attend décision, ce qui bloque. Lit le résumé à voix haute si l\'utilisateur est présent.',
      planification: { type: 'quotidienne', heure: '17:00' },
      entrees: ['dossier:travail'],
      sorties: [{ dossier: 'travail/journal', format: 'md' }],
      logiciels: [],
      validationHumaine: false
    }
  ];

  return baseTaches.map((t, i) => ({ ...t, active: true }));
}

function genererResume(nom) {
  const resumes = [
    `Matin : relève et classe le courrier, extrait les informations clés et met en avant ce qui demande action immédiate. Après-midi : tient à jour les registres et dossiers, prépare les documents demandés. Fin de journée : rend compte en trois lignes de ce qui a été fait et des blocages.`,
    `Chaque jour, examine les entrées, les classe, met en avant ce qui demande action, tient les registres à jour et prépare les relances. Signale immédiatement les écarts ou situations qui sortent de l'ordinaire. Laisse décider à l'utilisateur ce qui sort de la routine.`,
    `Traite chaque jour les documents entrants, maintient les bases de données, prépare les rapports et actions. Escalade intelligemment les décisions complexes. Rend compte chaque soir de ce qui a été fait et des points d'attention.`,
  ];
  return resumes[Math.floor(Math.random() * resumes.length)];
}

async function generer() {
  console.log('Génération du Batch 2 en cours...\n');

  let compteur = 0;
  const fichiers = [];

  for (const sect of SECTEURS) {
    console.log(`  ${sect.nom_secteur}:`);
    for (let i = 0; i < sect.count; i++) {
      const num = sect.start + i;
      const role = sect.roles[i];
      const fiche = genererFiche(num, role.slug, role.nom, sect.secteur, sect.nom_secteur);

      const nomFichier = `AG-${String(num).padStart(4, '0')}-${role.slug}.json`;
      const cheminFichier = path.join(agentsDir, nomFichier);

      await fs.writeFile(cheminFichier, JSON.stringify(fiche, null, 2) + '\n');
      compteur++;
      fichiers.push(nomFichier);

      if ((i + 1) % 5 === 0) process.stdout.write('.');
    }
    console.log(` ${sect.count} fiches générées`);
  }

  console.log(`\n✓ ${compteur} fiches du Batch 2 générées avec succès`);
  return compteur;
}

await generer();
