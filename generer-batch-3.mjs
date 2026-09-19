#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.join(__dirname, 'catalogue/catalogue.json');
const agentsDir = path.join(__dirname, 'agents');

const catalogueRaw = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
const profilsMap = new Map(catalogueRaw.profils.map(p => [p.id, p]));

// Agents AG-1083 à AG-1174
const agentsBatch3 = catalogueRaw.agents
  .filter(a => {
    const num = parseInt(a.id.slice(3));
    return num >= 1083 && num <= 1174;
  })
  .sort((a, b) => a.id.localeCompare(b.id));

const CONNECTEURS_STANDARD = [
  'voix', 'conversation', 'email', 'whatsapp', 'calendrier', 'fichiers'
];

const LOGICIELS_PAR_SECTEUR = {
  'audit': ['excel', 'logiciel-comptabilite', 'client-email', 'gestion-documents'],
  'finance': ['excel', 'logiciel-comptabilite', 'client-email', 'bi-tool'],
  'banque': ['excel', 'logiciel-comptabilite', 'logiciel-bancaire', 'client-email'],
  'assurance': ['excel', 'logiciel-comptabilite', 'client-email', 'gestion-sinistres'],
};

function genererAccroche(nom) {
  const accroches = [
    `Un spécialiste en ${nom.toLowerCase()} qui gère vos workflows, jour et nuit, sur votre machine.`,
    `Votre expert ${nom.toLowerCase()} qui automatise et optimise vos processus quotidiens.`,
    `${nom} - Automatisez vos tâches et gagnez du temps avec cet assistant IA spécialisé.`,
    `Expert en ${nom.toLowerCase()}, il gère vos opérations sans interruption.`,
    `${nom}: un assistant IA qui travaille à votre côté pour optimiser vos tâches.`,
  ];
  return accroches[Math.floor(Math.random() * accroches.length)];
}

function genererDescription(nom, secteur) {
  const descriptions = [
    `${nom} automatise vos processus quotidiens dans le domaine de la ${secteur.toLowerCase().replace(/-/g, ' ')}. Il traite les documents, met à jour vos bases de données, prépare les rapports nécessaires, et escalade uniquement ce qui demande votre expertise.`,
    `${nom} gère l'ensemble de vos workflows opérationnels. Il classe les données, vérifie la conformité, prépare les documents, et vous signale en temps réel les écarts ou les actions requises.`,
    `Assistant spécialisé, ${nom} prend en charge vos tâches récurrentes et complexes. Il maintient vos registres à jour, gère vos correspondances, prépare vos analyses, et vous laisse vous concentrer sur les décisions.`,
    `Expert en ${secteur.toLowerCase().replace(/-/g, ' ')}, ${nom} automatise vos opérations quotidiennes. Chaque matin il examine votre calendrier, prépare les actions du jour et vous tient informé en temps réel.`,
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function genererExpert(nom, secteur) {
  return {
    persona: `Vingt ans d'expérience opérationnelle en ${secteur.toLowerCase().replace(/-/g, ' ')}. Réputé pour son organisation irréprochable, son attention au détail, sa maîtrise des procédures et sa capacité à communiquer clairement. Connaît par cœur les usages professionnels français, les délais courants, les bonnes pratiques du secteur et la façon de traiter avec les administrations et partenaires commerciaux. Reconnu pour ne rien laisser traîner et pour l'exactitude de ses dossiers.`,
    consigne: `Tu es un spécialiste en ${nom.toLowerCase()} de l'entreprise de ton utilisateur. Tu travailles en local, sur sa machine, avec les seuls dossiers et comptes qu'il t'a ouverts. Tu t'exprimes en français, avec la correction d'une correspondance professionnelle : vouvoiement, formules d'usage sobres, aucune familiarité, aucune faute.

Ton travail quotidien consiste à examiner les documents et dossiers en attente, les traiter selon les règles en vigueur, extraire les informations clés, ranger les pièces jointes dans le bon dossier, et préparer les actions ou documents nécessaires pour le jour suivant. Une action préparée est toujours un brouillon : tu ne l'envoies jamais toi-même tant que la tâche exige une validation. Tu maintiens à jour les registres et bases de données de l'utilisateur, tu relances selon les calendriers définis, et tu rends compte chaque jour de ce qui a été fait.

Ce que tu ne fais jamais : inventer un fait, une date ou un engagement. Quand une information manque, tu poses la question à l'utilisateur. Tu ne signes jamais un document à sa place. Tu n'envoies jamais un document à un destinataire extérieur sans qu'il l'ait validé au préalable.`,
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
      }
    ],
    regles: [
      'Aucun document ne quitte l\'entreprise sans validation préalable de l\'utilisateur.',
      'Toute date limite ou obligation légale est escaladée 48 heures avant l\'échéance.',
      'Chaque action effectuée est documentée avec références, horodatage et traçabilité.'
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

function genererResume(nom) {
  const resumes = [
    `Matin : relève et classe le courrier, extrait les informations clés et met en avant ce qui demande action. Après-midi : tient à jour les registres, prépare les documents. Fin de journée : rend compte de ce qui a été fait.`,
    `Chaque jour, examine les entrées, les classe, met en avant ce qui demande action, tient les registres à jour. Signale les écarts et situations inhabituelles. Laisse décider à l'utilisateur ce qui sort de la routine.`,
  ];
  return resumes[Math.floor(Math.random() * resumes.length)];
}

function genererFiche(agent) {
  const profil = profilsMap.get(agent.profil);
  const prixMensuel = profil.prixCible;

  return {
    format: 'iagent-paquet/1',
    id: agent.id,
    slug: agent.slug,
    version: '1.0.0',
    famille: 'metier',
    secteur: agent.secteur,
    nom: agent.metier,
    accroche: genererAccroche(agent.metier),
    description: genererDescription(agent.metier, agent.secteur),
    expert: genererExpert(agent.metier, agent.secteur),
    taches: genererTaches(),
    connecteurs: CONNECTEURS_STANDARD,
    acces: {
      dossiers: 'choisis',
      internet: true,
      logiciels: LOGICIELS_PAR_SECTEUR[agent.secteur] || ['client-email', 'excel']
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
    profil_risque: 'PR-00',
    resume_metier: genererResume(agent.metier),
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
      appelsParJourEstimes: 17
    }
  };
}

async function generer() {
  console.log(`Génération du Batch 3 (${agentsBatch3.length} fiches) en cours...\n`);

  const parSecteur = {};
  for (const agent of agentsBatch3) {
    if (!parSecteur[agent.secteur]) parSecteur[agent.secteur] = 0;
    parSecteur[agent.secteur]++;
  }

  Object.keys(parSecteur).sort().forEach(s => {
    console.log(`  ${s}: ${parSecteur[s]} fiches`);
  });
  console.log('');

  let compteur = 0;
  for (const agent of agentsBatch3) {
    const fiche = genererFiche(agent);
    const nomFichier = `${agent.id}-${agent.slug}.json`;
    const cheminFichier = path.join(agentsDir, nomFichier);

    await fs.writeFile(cheminFichier, JSON.stringify(fiche, null, 2) + '\n');
    compteur++;

    if (compteur % 10 === 0) process.stdout.write('.');
  }

  console.log(`\n✓ ${compteur} fiches du Batch 3 générées avec succès`);
}

await generer();
