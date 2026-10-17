// Le modèle de données commun de la plateforme iAgent (MASTER développeur
// global du 07/10/2026, §17). Ce fichier est le SEUL endroit où une entité de
// la plateforme se définit : le Control Plane, le Voice Hub, iAgent Create, le
// moteur de tarifs, le back-office et l'application desktop l'importent tous.
// Une entité définie deux fois finit par dire deux choses.
//
// Règle d'isolation (§18) : toute entité qui appartient à un client porte
// `tenant_id`, et le stockage refuse de la lire sans ce tenant.

export type Iso = string; // date ISO 8601
export type Id = string;

/**
 * Ce que l'usine relève sur la machine avant d'installer (brief Factory
 * Installer du 11/10/2026, §6, §13). Rien ici n'est un secret : ce sont les
 * caractéristiques que porte déjà la fiche technique du fabricant.
 */
export type InventaireBox = {
  cpu: string;
  coeurs: number;
  memoire_go: number;
  disque: { modele: string; capacite_go: number };
  mac: { eth0: string | null; eth1: string | null; wifi: string | null };
  bios: { fournisseur: string; version: string; date: string | null };
  tpm: { present: boolean; version: string | null };
  uefi: boolean;
  secure_boot: boolean | null;
  releve_le: Iso;
};

/**
 * Cycle de vie d'une Box, un seul (brief du 11/10/2026 §41 posé sur les états
 * du §6) : `usine` (enrôlée par le Factory Installer, tests en cours) →
 * `qualifiee` (rapport d'usine passé) → `stock` (prête à attribuer) →
 * `provisionnee` (attribuée à un client) → `expediee` → `active` (première
 * télémétrie chez le client) → `suspendue` | `restituee` | `remplacee`.
 * Une Box provisionnée à la main par le back-office entre directement en `stock`.
 */
export type StatutBox = 'usine' | 'qualifiee' | 'stock' | 'provisionnee' | 'expediee' | 'active' | 'suspendue' | 'restituee' | 'remplacee';

/** Une Box iAgent : appliance louée, propriété d'iAgent (§4, §6). */
export type Box = {
  device_id: Id;
  tenant_id: Id | null; // null = en stock, pas encore attribuée
  serial: string;
  /**
   * Référence commerciale, imprimée sur l'étiquette et dans le QR :
   * `IA-FR-HOME-00000128` (Home Box), `IA-FR-PRO-00000042` (Pro Box) ou
   * `IA-FR-BUS-00000127` (Business Box). Un numéro d'ordre par gamme, attribué
   * par la plateforme à la création, jamais un secret.
   */
  reference: string;
  /** Clé publique Ed25519 de la Box, en PEM. La clé privée ne quitte jamais la Box (TPM visé). */
  identite_publique: string;
  /**
   * Clé publique X25519 brute (32 octets, base64url) pour chiffrer les Skill
   * Packs à cette Box seule (§6). Absente = la Box ne reçoit aucun contenu de Skill.
   */
  cle_chiffrement_publique?: string | null;
  /**
   * Trois gammes (max, 14/10/2026) : Home Box 16 Go (un agent, la voix
   * d'abord), Pro Box 32 Go (4 agents), Business Box 64 Go (8 agents).
   * « Commander » est le nom de l'application (Desktop Commander), pas une gamme.
   */
  gamme: 'home' | 'pro' | 'business';
  os: string;
  version_desktop: string;
  statut: StatutBox;
  plan_id: Id | null;
  sante: { vu_le: Iso; cpu?: number; memoire?: number; disque?: number; temperature?: number } | null;
  garantie_jusqu_au: Iso | null;
  /** Identifiant du profil matériel (`box/materiel/<id>.json`) contre lequel l'usine l'a qualifiée ; null si provisionnée à la main. */
  profil_materiel: string | null;
  inventaire: InventaireBox | null;
  /** Versions des services installés, par nom de service (`device`, `desktop`, `os`…), reçues par la télémétrie. */
  versions: Record<string, string> | null;
  /** Ce que l'usine a inscrit à l'enrôlement ; null pour une Box provisionnée à la main. */
  usine: { enrolee_le: Iso; installateur: string; operateur: string; lot: string | null; jeton_id: Id } | null;
};

/**
 * Jeton d'usine : émis par le back-office pour un opérateur et un lot, montré
 * une seule fois, gardé ici par son empreinte seulement. Il autorise
 * `POST /controle/usine/enroler` sans accès admin sur la machine d'atelier.
 */
export type JetonUsine = {
  id: Id;
  /** SHA-256 (hex) du jeton ; le jeton lui-même n'est jamais stocké. */
  empreinte: string;
  operateur: string;
  lot: string | null;
  /** Client et plan à attribuer dès que le rapport d'usine passe ; null = la Box reste en stock. */
  tenant_id: Id | null;
  plan_id: Id | null;
  cree_le: Iso;
  expire_le: Iso;
  utilisations_max: number;
  utilisations: number;
};

export type VerdictTest = 'passe' | 'echec' | 'non_constate';

/** Le rapport d'usine d'une Box (brief §45, §46) : une ligne par test, et un verdict que la plateforme recalcule. */
export type RapportUsine = {
  id: Id;
  device_id: Id;
  reference: string;
  serial: string;
  gamme: Box['gamme'];
  profil_materiel: string;
  inventaire: InventaireBox;
  installateur: { version: string; build_id: string; commit: string };
  operateur: string;
  lot: string | null;
  commence_le: Iso;
  termine_le: Iso;
  recu_le: Iso;
  tests: { id: string; libelle: string; verdict: VerdictTest; duree_ms: number; detail: string | null }[];
  /** Dérivé des tests et des tests obligatoires du profil matériel ; jamais cru sur parole. */
  verdict: 'passe' | 'echec';
};

/** Une mise à jour publiée pour les Box (§6) : signée par la plateforme, la Box refuse un paquet dont la signature ne tombe pas juste. */
export type MiseAJour = {
  id: Id; // `${composant}:${canal}:${version}`
  composant: 'desktop' | 'os' | 'skills' | 'device';
  version: string;
  canal: 'stable' | 'beta';
  url: string;
  /** SHA-256 (hex) du paquet. */
  empreinte: string;
  /** Ed25519 de la plateforme sur `iagent-maj-v1\n<composant>\n<version>\n<empreinte>`, base64url. */
  signature: string;
  publiee_le: Iso;
};

/** Le droit d'exécuter un agent : Client + Box + Template + Spécialisation + Licence (§6). */
export type Entitlement = {
  id: Id;
  tenant_id: Id;
  device_id: Id;
  agent_template_id: Id; // AG-XXXX du catalogue
  specialisation_id: Id | null;
  licence: 'essential' | 'professional' | 'expert' | 'commander' | 'home';
  statut: 'active' | 'suspendue' | 'revoquee' | 'expiree';
  debut: Iso;
  fin: Iso | null;
};

/** Persona visuelle et vocale, séparée du template et de l'instance (§8). */
export type Persona = {
  id: Id;
  visuel: string; // chemin ou URL de l'image
  voice_profile_id: Id | null;
  personnalite: string;
  locale: string;
};

export type AgentTemplate = {
  id: Id; // AG-XXXX
  metier: string;
  skills: Id[];
  missions: string[];
  autonomie_defaut: 'seul' | 'conseillee' | 'tout-relu';
};

export type Specialisation = {
  id: Id;
  secteur: string;
  logiciels: Id[]; // LOG-XXXX
  processus: string[];
  locale: string;
};

export type InstanceClient = {
  id: Id;
  tenant_id: Id;
  entitlement_id: Id;
  persona_id: Id;
  prenom: string;
  outils: Id[];
  objectifs: string[];
  permissions: string[];
};

/** Identité vocale stable d'une persona, quel que soit le moteur (§10). */
export type VoiceProfile = {
  id: Id;
  persona_id: Id | null;
  locale: string;
  /** Une voix par moteur : le registre choisit le moteur, la persona garde « sa » voix. */
  voix_par_moteur: Record<string, string>; // provider -> voice id chez ce provider
  ordre_de_repli: string[];
  palier: 'standard' | 'premium';
};

export type ModeVoix = 'quality_first' | 'cost_first' | 'balanced' | 'local_first';

export type PhoneNumber = {
  e164: string;
  tenant_id: Id;
  provider: 'telnyx' | 'twilio' | 'sip';
  statut: 'demande' | 'actif' | 'suspendu' | 'libere';
  routage_id: Id | null; // standard (RoutingPolicy) à appliquer
};

export type Call = {
  id: Id;
  tenant_id: Id;
  direction: 'entrant' | 'sortant';
  appelant: string;
  appele: string;
  agent_instance_id: Id | null;
  debut: Iso;
  duree_s: number;
  resume: string | null;
  consentement_enregistrement: boolean;
  issue: 'traite' | 'transfere-agent' | 'transfere-humain' | 'messagerie' | 'rappel' | 'abandonne';
  cout: { telephonie: number; voix: number; llm: number; outils: number; total: number; devise: string } | null;
};

export type Opportunity = {
  id: Id;
  date: Iso;
  titre: string;
  marche: string;
  score: number; // 0-100
  statut: 'brouillon' | 'publiee' | 'retiree';
  carte: Record<string, string>; // pourquoi maintenant, demande, concurrence…
  etude_id: Id | null;
};

export type SkillPack = {
  skill_pack_id: Id;
  version: string;
  source_type: 'iagent' | 'terrain-anonymise' | 'editeur';
  validation_status: 'candidat' | 'en-revue' | 'valide' | 'rejete' | 'retire';
  compatible_agents: Id[];
  compatible_tools: Id[];
  sector_scope: string[];
  locale: string;
  changelog: string;
  /** Empreinte SHA-256 du paquet signé. */
  empreinte: string | null;
};

/** Plan tarifaire versionné (§5, schéma minimal). */
export type Plan = {
  plan_id: Id;
  nom: string;
  description: string;
  segment: 'business' | 'home' | 'voice' | 'enterprise';
  currency: string;
  billing_period: 'mois' | 'annee';
  commitment_months: number;
  base_price: number | null; // null = sur devis
  /** Haut de fourchette (« 599–749 € »), sinon null. */
  base_price_max: number | null;
  /** « à partir de » : base_price est un plancher. */
  a_partir_de: boolean;
  included_agents: number;
  included_commander: boolean;
  included_box: boolean;
  included_voice_minutes: number;
  usage_rate_llm: number | null;
  usage_rate_voice: number | null;
  usage_rate_telephony: number | null;
  overage_rules: string | null;
  effective_from: Iso;
  effective_to: Iso | null;
  public_visibility: boolean;
  region: string; // ISO pays, ex. FR
  tax_mode: 'HT' | 'TTC';
  legacy_flag: boolean;
};

/** Trace d'audit d'une action sensible (§18). Jamais de secret dedans. */
export type Audit = {
  id: Id;
  tenant_id: Id | null;
  quand: Iso;
  acteur: string;
  action: string;
  cible: string;
  detail: string;
  /** Noyau (ADMIN MASTER §16) : qui agit, sous quelle règle, avec quelle approbation, pour quel résultat, dans quelle chaîne. */
  acteur_type?: 'HUMAN' | 'AGENT' | 'SERVICE' | 'DEVICE';
  politique?: 'ALLOW' | 'DENY' | 'APPROVAL' | 'DUAL_APPROVAL';
  risque?: 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
  approbation?: string | null;
  resultat?: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'DENIED';
  correlation_id?: string;
};

/** Un client de la plateforme (entreprise ou foyer). */
export type Tenant = {
  tenant_id: Id;
  nom: string;
  segment: 'business' | 'home' | 'enterprise';
  pays: string;
  /** Participation volontaire à l'amélioration commune des Skill Packs (§7). Faux par défaut. */
  opt_in_skills: boolean;
  cree_le: Iso;
};

// --- iAgent Create (§9) ---------------------------------------------------
// Ajouté par le chantier « create » : l'étude et le projet composé n'avaient
// aucune entité ici, et un chiffre de scénario devait pouvoir porter ses
// hypothèses sans jamais passer pour une promesse.

/** Un chiffre de scénario : toujours une fourchette, son unité et ses hypothèses (§9, §20). */
export type Estimation = {
  nature: 'estimation';
  min: number;
  max: number;
  unite: string;
  hypotheses: string[];
};

export type NumeroPhase = '01' | '02' | '03' | '04' | '05';

export type MembreEquipe = {
  agent_id: Id; // AG-XXXX de agents/
  metier: string; // lu dans le catalogue, jamais écrit par le moteur d'IA
  role: string;
  pourquoi: string;
  licence: 'essential' | 'professional' | 'expert';
};

/** Étude gratuite : publique, identifiant non devinable (§9). */
export type Etude = {
  id: Id;
  cree_le: Iso;
  source: { idee: string | null; opportunite_id: Id | null };
  titre: string;
  resume: string;
  /** Étiquettes fermées qui choisissent les rôles optionnels de chaque phase. */
  besoins: string[];
  scenarios: Record<'prudent' | 'central' | 'ambitieux', {
    chiffre_affaires_annee1: Estimation;
    couts_annee1: Estimation;
    capital_necessaire: Estimation;
    hypotheses: string[];
  }>;
  couts: { poste: string; montant: Estimation }[];
  canaux: { canal: string; pourquoi: string }[];
  reglementation: { sujet: string; obligation: string; a_verifier_aupres: string }[];
  plan_execution: { phase: NumeroPhase; duree_mois: Estimation; actions: string[] }[];
  agents_par_phase: { phase: NumeroPhase; agents: MembreEquipe[] }[];
  avertissement: string;
  modele: string;
};

/** L'entreprise composée, côté Box : cinq phases, une équipe du catalogue par phase (§9). */
export type ProjetCree = {
  id: Id;
  tenant_id: Id;
  etude_id: Id;
  cree_le: Iso;
  titre: string;
  phases: {
    numero: NumeroPhase;
    nom: string;
    objectif: string;
    duree_mois: Estimation;
    equipe: MembreEquipe[];
    box: { nombre: number; agents: number };
    budget: {
      mensuel_ht: number;
      detail: string[];
      total_ht: Estimation;
      consommation_ia: Estimation;
    };
    jalons: string[];
    responsabilites_humaines: string[];
  }[];
  box_recommandee: { plan_id: Id; nombre: number; agents_par_box_max: number; motif: string };
  budget_total_ht: Estimation;
  /** Vrai tant que les prix viennent de la constante provisoire et pas du moteur de tarifs. */
  prix_provisoires: boolean;
  avertissement: string;
};
