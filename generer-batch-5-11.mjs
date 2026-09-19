#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.join(__dirname, 'catalogue/catalogue.json');
const agentsDir = path.join(__dirname, 'agents');

const catalogueRaw = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
const profilsMap = new Map(catalogueRaw.profils.map(p => [p.id, p]));

// Get all generated agents
const generatedFiles = await fs.readdir(agentsDir);
const generatedIds = new Set(
  generatedFiles
    .filter(f => f.endsWith('.json'))
    .map(f => f.match(/AG-\d{4}/)[0])
);

// Find all missing agents
const missingAgents = catalogueRaw.agents
  .filter(a => !generatedIds.has(a.id))
  .sort((a, b) => parseInt(a.id.slice(3)) - parseInt(b.id.slice(3)));

console.log(`Total agents to generate: ${missingAgents.length}`);

// Split into batches of 110
const BATCH_SIZE = 110;
const batches = [];
for (let i = 0; i < missingAgents.length; i += BATCH_SIZE) {
  batches.push(missingAgents.slice(i, i + BATCH_SIZE));
}

const CONNECTEURS_STANDARD = [
  'voix', 'conversation', 'email', 'whatsapp', 'calendrier', 'fichiers'
];

const LOGICIELS_PAR_SECTEUR = {
  'administration': ['client-email', 'excel', 'libreoffice'],
  'comptabilite': ['logiciel-comptabilite', 'excel', 'client-email'],
  'finance': ['excel', 'logiciel-comptabilite', 'client-email', 'bi-tool'],
  'commercial': ['excel', 'logiciel-crm', 'client-email', 'outils-prospection'],
  'marketing': ['excel', 'logiciel-crm', 'client-email', 'outils-analyse'],
  'design': ['figma', 'adobe-creative'],
  'informatique': ['client-email', 'git', 'ide'],
  'conseil': ['excel', 'client-email', 'outils-presentation', 'gestion-projets'],
  'juridique': ['client-email', 'logiciel-contrats'],
  'ressources-humaines': ['logiciel-rh', 'excel', 'client-email'],
  'recrutement': ['logiciel-recrutement', 'excel', 'client-email'],
  'immobilier': ['logiciel-immobilier', 'excel', 'client-email'],
  'logistique': ['logiciel-logistique', 'excel', 'client-email'],
  'transport': ['logiciel-transport', 'gps', 'client-email'],
};

function genererAccroche(nom, secteur) {
  const accroches = [
    `${nom} qui gère vos workflows, jour et nuit, sur votre machine.`,
    `Votre expert ${nom.toLowerCase()} qui automatise et optimise vos processus quotidiens.`,
    `${nom}: un assistant IA spécialisé qui vous fait gagner du temps chaque jour.`,
    `Expert en ${secteur.toLowerCase().replace(/-/g, ' ')}, il gère vos opérations sans interruption.`,
    `${nom}: votre assistant IA qui travaille à vos côtés pour optimiser vos tâches.`,
    `Un spécialiste en ${secteur.toLowerCase().replace(/-/g, ' ')} qui maîtrise les processus critiques de votre métier.`,
  ];
  return accroches[Math.floor(Math.random() * accroches.length)];
}

function genererDescription(nom, secteur) {
  const descriptions = [
    `${nom} automatise vos processus quotidiens dans le domaine de la ${secteur.toLowerCase().replace(/-/g, ' ')}. Il traite les documents, met à jour vos bases de données, prépare les rapports nécessaires, et escalade uniquement ce qui demande votre expertise.`,
    `${nom} gère l'ensemble de vos workflows opérationnels. Il classe les données, vérifie la conformité, prépare les documents, et vous signale en temps réel les écarts ou les actions requises.`,
    `Assistant spécialisé, ${nom} prend en charge vos tâches récurrentes et complexes. Il maintient vos registres à jour, gère vos correspondances, prépare vos analyses, et vous laisse vous concentrer sur les décisions.`,
    `Expert en ${secteur.toLowerCase().replace(/-/g, ' ')}, ${nom} automatise vos opérations quotidiennes. Chaque matin il examine votre calendrier, prépare les actions du jour et vous tient informé en temps réel.`,
    `Maître de la ${secteur.toLowerCase().replace(/-/g, ' ')}, ${nom} traite chaque situation avec la rigueur d'un professionnel aguerri. Il anticipe les problèmes, classe les priorités et vous libère du travail répétitif.`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function genererExpert(nom, secteur) {
  return {
    persona: `Vingt ans d'expérience opérationnelle en ${secteur.toLowerCase().replace(/-/g, ' ')}. Réputé pour son organisation irréprochable, son attention au détail, sa maîtrise des procédures et sa capacité à communiquer clairement. Connaît par cœur les usages professionnels français, les délais courants, les bonnes pratiques du secteur et la façon de traiter avec les administrations et partenaires commerciaux. Reconnu pour ne rien laisser traîner et pour l'exactitude de ses dossiers.`,
    consigne: `Tu es un spécialiste en ${nom.toLowerCase()} de l'entreprise de ton utilisateur. Tu travailles en local, sur sa machine, avec les seuls dossiers et comptes qu'il t'a ouverts. Tu t'exprimes en français, avec la correction d'une correspondance professionnelle : vouvoiement, formules d'usage sobres, aucune familiarité, aucune faute.

Ton travail quotidien consiste à examiner les documents et dossiers en attente, les traiter selon les règles en vigueur, extraire les informations clés, ranger les pièces jointes dans le bon dossier, et préparer les actions ou documents nécessaires pour le jour suivant. Une action préparée est toujours un brouillon : tu ne l'envoies jamais toi-même tant que la tâche exige une validation. Tu maintiens à jour les registres et bases de données de l'utilisateur, tu relances selon les calendriers définis, et tu rends compte chaque jour de ce qui a été fait.

Ce que tu ne fais jamais : inventer un fait, une date ou un engagement. Quand une information manque, tu poses la question à l'utilisateur. Tu ne signes jamais un document à sa place. Tu n'envoies jamais un document à un destinataire extérieur sans qu'il l'ait validé au préalable.

Tu agis avec l'autonomie d'un professionnel expérimenté : tu peux traiter des cas complexes, adapter tes méthodes aux exceptions, mais tu signales immédiatement ce qui sort de ton champ ou de tes connaissances.`,
    connaissances: [
      {
        titre: 'Procédures opérationnelles et bonnes pratiques',
        resume: 'Maîtrise complète des procédures clés du domaine, des flux de traitement standard, des modèles de documents, des niveaux d\'escalade et de la gestion des exceptions courantes.'
      },
      {
        titre: 'Outils bureautiques et systèmes collaboratifs',
        resume: 'Excellente maîtrise de Word, Excel, Outlook, Google Workspace, systèmes de gestion documentaire, signatures électroniques, et bases de données simples.'
      },
      {
        titre: 'Calendriers, délais et conformité',
        resume: 'Connaissance des délais légaux et réglementaires, calendriers de déclaration obligatoires, alertes saisonnières, conservation légale des documents.'
      },
      {
        titre: 'Correspondance professionnelle et rédaction',
        resume: 'Maîtrise de la rédaction professionnelle française, formules d\'usage adaptées, structures de courriers officiels, et tons appropriés.'
      },
      {
        titre: 'Relations avec tiers et escalade',
        resume: 'Sait traiter avec les administrations, fournisseurs, clients et partenaires en respectant les protocoles. Reconnaît quand une situation dépasse son autorité et escalade sans ambiguïté.'
      }
    ],
    regles: [
      'Aucun document ne quitte l\'entreprise sans validation préalable de l\'utilisateur.',
      'Toute date limite ou obligation légale est escaladée 48 heures avant l\'échéance.',
      'Chaque action effectuée est documentée avec références, horodatage et traçabilité.',
      'En cas de doute sur l\'interprétation d\'une règle ou d\'une situation, poser la question plutôt que supposer.',
      'Signaler immédiatement les blocages, anomalies ou situations hors protocole.'
    ]
  };
}

function genererTaches() {
  return [
    {
      id: 'traiter-entrees-quotidiennes',
      nom: 'Traiter les entrées quotidiennes',
      description: 'Examine chaque jour les documents et demandes reçus, les classe, extrait les informations clés et range les pièces jointes appropriées.',
      planification: { type: 'quotidienne', heure: '09:00' },
      entrees: ['email', 'fichiers'],
      sorties: [{ dossier: 'travail/traite', format: 'md' }],
      logiciels: ['client-email'],
      validationHumaine: false,
      active: true
    },
    {
      id: 'maintenir-registres-a-jour',
      nom: 'Maintenir les registres à jour',
      description: 'Met à jour quotidiennement les bases de données, les listes de suivi et les dossiers principaux avec les informations du jour.',
      planification: { type: 'quotidienne', heure: '14:00' },
      entrees: ['dossier:travail'],
      sorties: [{ dossier: 'travail/registres', format: 'json' }],
      logiciels: [],
      validationHumaine: false,
      active: true
    },
    {
      id: 'preparer-relances',
      nom: 'Préparer les relances',
      description: 'Compare la liste des actions à faire à l\'état réel, prépare les relances dues et les soumet à validation.',
      planification: { type: 'quotidienne', heure: '11:00' },
      entrees: ['dossier:travail/a-traiter'],
      sorties: [{ dossier: 'travail/relances', format: 'eml' }],
      logiciels: ['client-email'],
      validationHumaine: true,
      active: true
    },
    {
      id: 'generer-rapports',
      nom: 'Générer les rapports',
      description: 'Prépare les rapports, analyses et synthèses demandés, avec chiffres, graphiques et conclusions pertinentes.',
      planification: { type: 'quotidienne', heure: '16:00' },
      entrees: ['dossier:travail', 'fichiers'],
      sorties: [{ dossier: 'travail/rapports', format: 'pdf' }],
      logiciels: ['excel'],
      validationHumaine: true,
      active: true
    },
    {
      id: 'verifier-conformite',
      nom: 'Vérifier la conformité',
      description: 'Contrôle que tous les documents disposent des informations obligatoires, signatures et mentions légales requises.',
      planification: { type: 'intervalle', minutes: 120 },
      entrees: ['dossier:travail/a-valider'],
      sorties: [{ dossier: 'travail/controle', format: 'json' }],
      logiciels: [],
      validationHumaine: false,
      active: true
    },
    {
      id: 'rendre-compte-jour',
      nom: 'Rendre compte du jour',
      description: 'À 17h, écrit ce qui a été fait, ce qui attend décision, ce qui bloque. Tient l\'utilisateur informé des actions et blocages.',
      planification: { type: 'quotidienne', heure: '17:00' },
      entrees: ['dossier:travail'],
      sorties: [{ dossier: 'travail/journal', format: 'md' }],
      logiciels: [],
      validationHumaine: false,
      active: true
    }
  ];
}

function genererResume(nom, secteur) {
  const resumes = [
    `Matin : relève et classe le courrier, extrait les informations clés et met en avant ce qui demande action. Après-midi : tient à jour les registres, prépare les documents. Fin de journée : rend compte de ce qui a été fait et des blocages.`,
    `Chaque jour, examine les entrées, les classe, met en avant ce qui demande action, tient les registres à jour. Signale les écarts et situations inhabituellesgardes les priorités en ordre. Laisse décider à l'utilisateur ce qui sort de la routine.`,
    `Matin : traite les demandes reçues et tient à jour le statut de chaque dossier. Après-midi : prépare les documents et relances, teste la conformité. Fin de journée : synthèse des actions et alertes.`,
    `Gère le flux d'entrée en en ${secteur.toLowerCase().replace(/-/g, ' ')}, classe par urgence, extrait ce qui compte et soulève ce qui demande intervention. Travaille de façon autonome sur la routine, escalade les exceptions.`,
  ];
  return resumes[Math.floor(Math.random() * resumes.length)];
}

function genererFiche(agent) {
  const profil = profilsMap.get(agent.profil);
  const prixMensuel = profil.prixCible;
  const logiciels = LOGICIELS_PAR_SECTEUR[agent.secteur] || ['client-email', 'excel'];

  // Déterminer les modèles en fonction du secteur
  let modeles = {
    texte: 'texte-standard',
    activite: 0.2
  };

  // Certains secteurs utilisent la vision ou l'audio
  if (['photo-video-audio', 'design'].includes(agent.secteur)) {
    modeles.vision = 'vision';
    modeles.image = agent.secteur === 'photo-video-audio' ? 'image-qualite' : 'image-rapide';
    modeles.activite = 0.4;
  } else if (['juridique', 'data'].includes(agent.secteur)) {
    modeles.texte = 'texte-avance';
    modeles.activite = 0.25;
  }

  // Tous ont de l'audio pour les brèves rendez comptes
  modeles.audio = 'audio-parole';
  modeles.embeddings = 'embeddings';

  // Configuration du matériel basée sur le secteur
  let materiel = {
    ram: 16,
    vram: 2,
    cpuCoeurs: 6,
    disque: 20,
    chargeContinue: 0.12,
    gpu: {
      classe: 'integre',
      libelle: 'GPU intégré récent (classe Radeon 780M / Apple M), mémoire partagée avec la RAM'
    }
  };

  if (['data', 'informatique', 'photo-video-audio'].includes(agent.secteur)) {
    materiel.ram = 32;
    materiel.vram = 8;
    materiel.cpuCoeurs = 8;
    materiel.disque = 50;
    materiel.chargeContinue = 0.25;
    materiel.gpu = {
      classe: 'dediee-entree',
      libelle: 'GPU dédié d\'entrée de gamme (RTX 3060 / A4000), 6-12 GB VRAM'
    };
  } else if (['design'].includes(agent.secteur)) {
    materiel.ram = 24;
    materiel.vram = 6;
    materiel.cpuCoeurs = 8;
    materiel.disque = 100;
    materiel.chargeContinue = 0.2;
  }

  return {
    format: 'iagent-paquet/1',
    id: agent.id,
    slug: agent.slug,
    version: '1.0.0',
    famille: 'metier',
    secteur: agent.secteur,
    nom: agent.metier,
    accroche: genererAccroche(agent.metier, agent.secteur),
    description: genererDescription(agent.metier, agent.secteur),
    expert: genererExpert(agent.metier, agent.secteur),
    taches: genererTaches(),
    connecteurs: CONNECTEURS_STANDARD,
    acces: {
      dossiers: 'choisis',
      internet: true,
      logiciels: logiciels
    },
    modeles: modeles,
    materiel: materiel,
    commercial: {
      profil: agent.profil,
      priorite: profil.priorite,
      pack: profil.pack,
      prixMensuel: {
        min: prixMensuel.min,
        max: prixMensuel.max
      },
      autonomie: profil.autonomie,
      besoinHumain: profil.besoinHumain,
      risqueReglementaire: profil.risqueReglementaire
    },
    miseAJour: {
      canal: 'stable',
      appMinimum: '1.0.0',
      notes: 'Première version.'
    },
    profil_risque: profil.profilRisque || 'PR-00',
    resume_metier: genererResume(agent.metier, agent.secteur),
    execution: {
      modes: ['local', 'api'],
      defaut: 'local',
      bascule: 'automatique',
      api: {
        capacites: {
          texte: 'llm',
          ...(modeles.vision && { vision: 'llm-vision' }),
          ...(modeles.image && { image: 'image' }),
          audio: 'parole',
          embeddings: 'embeddings'
        }
      },
      appelsParJourEstimes: 20
    }
  };
}

async function genererBatch(batchIndex, agents) {
  const batchNum = batchIndex + 5; // Batches 5-11
  const start = agents[0].id;
  const end = agents[agents.length - 1].id;

  console.log(`\n🔨 Batch ${batchNum}: ${start} → ${end} (${agents.length} fiches)`);

  const parSecteur = {};
  for (const agent of agents) {
    if (!parSecteur[agent.secteur]) parSecteur[agent.secteur] = 0;
    parSecteur[agent.secteur]++;
  }

  const secteurs = Object.keys(parSecteur).sort();
  console.log(`   Secteurs: ${secteurs.join(', ')}`);
  console.log('');

  let compteur = 0;
  for (const agent of agents) {
    const fiche = genererFiche(agent);
    const nomFichier = `${agent.id}-${agent.slug}.json`;
    const cheminFichier = path.join(agentsDir, nomFichier);

    await fs.writeFile(cheminFichier, JSON.stringify(fiche, null, 2) + '\n');
    compteur++;

    if (compteur % 20 === 0) process.stdout.write('.');
  }

  console.log(`\n   ✓ ${compteur} fiches générées`);
  return compteur;
}

async function generer() {
  console.log(`\n📦 Génération des Batches 5-11 (${missingAgents.length} fiches) en cours...\n`);
  console.log(`${batches.length} batches à générer, ${BATCH_SIZE} fiches par batch\n`);

  let totalGenere = 0;
  for (let i = 0; i < batches.length; i++) {
    const count = await genererBatch(i, batches[i]);
    totalGenere += count;
  }

  console.log(`\n✅ ${totalGenere} fiches des Batches 5-11 générées avec succès!`);
  console.log(`   Total généré jusqu'à présent: ${generatedIds.size + totalGenere} fiches`);
}

await generer();
