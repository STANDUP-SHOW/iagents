// Entities of the voice module that `plateforme/modele.ts` does not define yet
// (routing policy, queue, campaign, handoff). They belong in modele.ts — the
// module does not own that file, so they live here until the coordinator moves
// them. Nothing else in the repository defines them.
import type { Metriques } from './fournisseurs-voix.ts';
import type { Call, Id, Iso, PhoneNumber } from '../modele.ts';

export type MoteurVoix = 'gemini' | 'elevenlabs' | 'mistral' | 'local';
export const MOTEURS: MoteurVoix[] = ['gemini', 'elevenlabs', 'mistral', 'local'];
export type Canal = 'desktop' | 'telephone' | 'support';
export type ProviderTel = PhoneNumber['provider'];
export const PROVIDERS_TEL: ProviderTel[] = ['telnyx', 'twilio', 'sip'];

/** A time slot, days 1 = Monday … 7 = Sunday, times "HH:MM" in the standard's time zone. */
export type Plage = { jours: number[]; debut: string; fin: string };

export type Extension = {
  numero: string; agent_instance_id: Id; prenom: string; departement: string;
  /** The VoiceProfile that lends this agent its voice on the phone; else the profile whose persona_id is agent_instance_id. */
  profil_voix?: Id;
};

export type CibleHumaine = {
  type: 'desktop' | 'webrtc' | 'mobile' | 'fixe';
  /** desktop/webrtc: a SIP URI (sip:…); mobile/fixe: an E.164 number. */
  adresse: string;
  /** When absent, the target follows the standard's opening hours. */
  plages?: Plage[];
};

export type Humain = { id: Id; nom: string; departements: string[]; cibles: CibleHumaine[] };

/** The routing policy of a number (« standard »), PUT /voix/standards/:id. */
export type Standard = {
  id: Id;
  tenant_id: Id;
  nom: string;
  fuseau: string; // IANA, e.g. Europe/Paris
  accueil: string;
  message_ferme: string;
  horaires: Plage[];
  /** The extension that answers first (the reception agent). */
  extension_accueil: string;
  extensions: Extension[];
  humains: Humain[];
  messagerie: boolean;
  rappel: boolean;
  file_id: Id | null;
  plafond_sessions: number;
  /** Recording is only ever done when this is true AND the country allows it. */
  consentement_enregistrement: boolean;
};

export type FileAttente = {
  id: Id;
  tenant_id: Id;
  nom: string;
  priorite: number; // higher served first
  capacite: number;
  attente_max_s: number;
  debordement: { type: 'file'; file_id: Id } | { type: 'messagerie' } | { type: 'rappel' };
  rappel: boolean;
};

export type EnFile = { appel_id: Id; tenant_id: Id; file_id: Id; priorite: number; depuis: Iso; appelant: string };

export type DecisionHandoff = 'prendre' | 'refuser' | 'rappeler' | 'laisser';

export type Handoff = {
  id: Id; // = appel id
  tenant_id: Id;
  appel_id: Id;
  appelant: string;
  motif: string;
  resume: string;
  humain_id: Id;
  cree_le: Iso;
  statut: 'en-attente' | DecisionHandoff;
  decide_le: Iso | null;
};

/** What the module stores for a call: the shared `Call` plus what only voice needs. */
export type AppelVoix = Call & {
  provider: ProviderTel;
  id_operateur: string;
  standard_id: Id | null;
  moteur_voix: MoteurVoix | null;
  etat: unknown; // EtatAppel, see standard.ts
  journal: { quand: Iso; quoi: string }[];
  cout_manquants: string[];
  enregistre: boolean;
  fin: Iso | null;
  /** What each voice session of the call used (engine, seconds, characters, tokens), set when the media bridge closes. */
  sessions_voix?: Metriques[];
};

export type ConsentementContact = { source: string; date: Iso; retire_le?: Iso | null };
export type ContactCampagne = {
  e164: string;
  nom?: string;
  consentement: ConsentementContact | null;
  consentement_enregistrement?: boolean;
};

export type Campagne = {
  id: Id;
  tenant_id: Id;
  pays: string;
  provider: ProviderTel;
  numero_appelant: string;
  source_consentement: string;
  fenetres: Plage[];
  enregistrement: boolean;
  contacts: ContactCampagne[];
  cree_le: Iso;
  lancements: { quand: Iso; resultats: { e164: string; statut: 'appele' | 'refuse' | 'echec'; motif: string; appel_id?: Id }[] }[];
};

export type Opposition = { id: Id; tenant_id: Id; e164: string; liste: string; depuis: Iso };
