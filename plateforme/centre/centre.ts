// The internal AI call centre of iAgent Tech: one agent behind two channels
// (WhatsApp, the phone line), with the jobs a reception desk really does —
// answer from what is true, qualify the prospect, book a meeting, hand over to
// a human, and stop contacting whoever asks. This file is the business logic,
// with no network: `routes.ts` reads the channels and executes what a turn
// decides, the bench drives the same functions with a scripted brain.
//
// What the agent may say about iAgent comes from two places only: the price
// file the website reads (frontend/src/data/tarifs.json) and `connaissances.ts`.
// A price that is not in the first is never said: the agent offers a meeting.

import { randomUUID } from 'node:crypto';
import tarifs from '../../frontend/src/data/tarifs.json' with { type: 'json' };
import type { Stockage } from '../stockage.ts';
import { verifierContact, type Verdict } from '../voix/campagnes.ts';
import type { Cerveau, MessageCerveau, Outil } from '../voix/fournisseurs-voix.ts';
import { heureLocale, joursFeriesFrance, dansPlages, minutesDe } from '../voix/temps.ts';
import { normaliserE164 } from '../voix/telephonie.ts';
import type { Plage } from '../voix/types.ts';
import { CONNAISSANCES } from './connaissances.ts';
import reglages from './reglages.json' with { type: 'json' };

export const REGLAGES = reglages;

export const C = {
  conversations: 'centre_conversations',
  rendezVous: 'centre_rendez_vous',
  contacts: 'centre_contacts',
} as const;

export type Canal = 'whatsapp' | 'telephone';
export type Qui = 'contact' | 'agent' | 'humain' | 'systeme';
export type Tour = { qui: Qui; texte: string; le: string };

export const INTERETS = ['chaud', 'tiede', 'froid'] as const;
export type Qualification = {
  nom?: string; entreprise?: string; activite?: string; besoin?: string;
  nombre_postes?: number; echeance?: string; email?: string; interet?: (typeof INTERETS)[number];
};

export type Transfert = { motif: string; resume: string; le: string; statut: 'a-traiter' | 'en-ligne' | 'traite' };

export type Conversation = {
  id: string;
  canal: Canal;
  sens: 'entrant' | 'sortant';
  contact: string; // E.164
  nom: string;
  objet: string | null;
  ouverte_le: string;
  maj_le: string;
  etat: 'agent' | 'humain' | 'terminee';
  tours: Tour[];
  qualification: Qualification;
  rendez_vous: string | null;
  /** The slots last offered: the model only keeps the words it said, the booking needs the exact start. */
  creneaux_proposes: { debut: string; libelle: string }[];
  transfert: Transfert | null;
  id_operateur: string | null;
  /** Keys of inbound messages already handled: Meta retries what it believes was not received. */
  vus: string[];
  silences: number;
  jetons: { entree: number; sortie: number };
};

export type RendezVous = {
  id: string; debut: string; fin: string; conversation_id: string; canal: Canal;
  contact: string; nom: string; entreprise: string | null; objet: string; cree_le: string; statut: 'confirme' | 'annule';
};

export type Contact = {
  id: string; // E.164
  e164: string;
  nom: string;
  consentement: { source: string; date: string; preuve: string; retire_le?: string } | null;
  retire_le: string | null;
  appels: string[];
};

const iso = (d: Date) => d.toISOString();

// ---------------------------------------------------------------------------
// What the agent knows
// ---------------------------------------------------------------------------

type Offre = { nom: string; contenu?: string; mensuel?: number; mensuelMin?: number; mensuelMax?: number; aPartirDe?: number; surDevis?: boolean; statut?: string; engagementMois?: number };

function prix(o: Offre): string | null {
  if (o.surDevis) return 'sur devis';
  if (o.mensuel !== undefined) return `${o.mensuel} € HT par mois${o.engagementMois ? ` sur ${o.engagementMois} mois` : ''}`;
  if (o.mensuelMin !== undefined && o.mensuelMax !== undefined) return `de ${o.mensuelMin} à ${o.mensuelMax} € HT par mois`;
  if (o.aPartirDe !== undefined) return `à partir de ${o.aPartirDe} € HT par mois`;
  return null;
}

/** One line per offer, read from the site's price file. An offer the site does not sell yet is named without a price. */
function ligne(o: Offre): string {
  const p = prix(o);
  const quoi = o.contenu ? ` (${o.contenu})` : '';
  if (o.statut === 'bientot' || !p) return `- ${o.nom}${quoi} : présenté par un conseiller en rendez-vous, ne pas donner de prix.`;
  return `- ${o.nom}${quoi} : ${p}.`;
}

export function tarifsEnTexte(t: typeof tarifs = tarifs): string {
  const l: string[] = [];
  l.push('Agents (abonnement par agent) :');
  for (const p of t.agents.paliers) l.push(ligne(p as Offre));
  l.push('Box (le poste livré chez le client, en plus des agents) :');
  for (const b of t.box) l.push(ligne(b as Offre));
  l.push(ligne({ ...(t.commander as Offre), contenu: `pilote les agents, inclus à partir de ${t.commander.inclusAPartirDe} agents` }));
  l.push('Formules :');
  for (const p of t.packs) l.push(ligne(p as Offre));
  l.push('Téléphonie pour les entreprises clientes :');
  for (const v of t.voice.offres) l.push(ligne(v as Offre));
  l.push(`Consommation : ${t.consommation.phrase}`);
  return l.join('\n');
}

export function consigne(conv: Conversation, maintenant: Date): string {
  const h = heureLocale(maintenant, REGLAGES.fuseau);
  const q = conv.qualification;
  const connu = Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k} = ${v}`).join(' ; ') || 'rien encore';
  const canal = conv.canal === 'telephone'
    ? `Tu es AU TÉLÉPHONE : une à trois phrases courtes par réponse, aucune liste, aucun symbole, aucune adresse web épelée lettre à lettre, des nombres écrits comme on les dit. L'appel est ${conv.sens === 'sortant' ? `sortant, objet : ${conv.objet ?? 'rappel demandé'}` : 'entrant'}.`
    : 'Tu réponds sur WHATSAPP : messages courts, pas de mise en forme, pas plus de trois phrases sauf si l’on te demande un détail.';
  return [
    `Tu es ${REGLAGES.prenom}, l'assistante virtuelle d'${REGLAGES.societe}. Tu es une intelligence artificielle et tu le dis sans détour si on te le demande. Tu parles français, tu vouvoies.`,
    canal,
    `Nous sommes le ${h.date}, il est ${String(Math.floor(h.minutes / 60)).padStart(2, '0')}:${String(h.minutes % 60).padStart(2, '0')} (${REGLAGES.fuseau}).`,
    'Ton travail, dans cet ordre : répondre juste aux questions ; comprendre le besoin (nom, entreprise, activité, besoin, nombre de postes, échéance, adresse e-mail) en le notant avec noter_qualification au fil de la conversation, sans interrogatoire ; proposer un rendez-vous avec un conseiller quand la personne est intéressée ou quand tu ne sais pas répondre (creneaux_libres puis reserver_rendez_vous, jamais un créneau inventé) ; passer la main à un humain si on te le demande ou si la personne est mécontente (transferer_a_un_humain) ; si la personne ne veut plus être contactée, appeler ne_plus_contacter et le confirmer.',
    'Règles strictes : tu n’annonces jamais un prix, une date de livraison ou une fonction qui ne figurent pas ci-dessous ; tu ne demandes jamais de coordonnées bancaires ni de mot de passe ; tu ne promets rien au nom d’un conseiller sauf le rendez-vous réservé ; si tu ne sais pas, tu le dis et tu proposes le rendez-vous.',
    `Ce que tu sais d'${REGLAGES.societe} :\n${CONNAISSANCES}`,
    `Tarifs en vigueur (hors taxes), et rien d'autre :\n${tarifsEnTexte()}`,
    `Déjà noté sur cette personne : ${connu}.${conv.rendez_vous ? ' Un rendez-vous est déjà réservé pour elle.' : ''}`,
    ...(conv.creneaux_proposes.length && !conv.rendez_vous
      ? [`Créneaux que tu as proposés (pour reserver_rendez_vous, reprendre debut tel quel) : ${JSON.stringify(conv.creneaux_proposes)}`]
      : []),
  ].join('\n\n');
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const OUTILS: Outil[] = [
  {
    nom: 'noter_qualification',
    description: 'Noter ce que la personne a dit d’elle et de son besoin. Ne remplir que ce qu’elle a réellement dit.',
    parametres: {
      type: 'object',
      properties: {
        nom: { type: 'string' }, entreprise: { type: 'string' }, activite: { type: 'string', description: 'métier ou secteur de l’entreprise' },
        besoin: { type: 'string' }, nombre_postes: { type: 'integer' }, echeance: { type: 'string' }, email: { type: 'string' },
        interet: { type: 'string', enum: [...INTERETS] },
      },
    },
  },
  {
    nom: 'creneaux_libres',
    description: 'Les prochains créneaux libres pour un rendez-vous de trente minutes avec un conseiller.',
    parametres: { type: 'object', properties: { a_partir_du: { type: 'string', description: 'date AAAA-MM-JJ, facultative' } } },
  },
  {
    nom: 'reserver_rendez_vous',
    description: 'Réserver un créneau rendu par creneaux_libres, une fois que la personne l’a choisi et que son nom est connu.',
    parametres: { type: 'object', properties: { debut: { type: 'string', description: 'le champ debut du créneau, tel quel' }, objet: { type: 'string' } }, required: ['debut', 'objet'] },
  },
  {
    nom: 'transferer_a_un_humain',
    description: 'Passer la main à un conseiller humain, avec le motif et un résumé de la conversation.',
    parametres: { type: 'object', properties: { motif: { type: 'string' }, resume: { type: 'string' } }, required: ['motif', 'resume'] },
  },
  {
    nom: 'ne_plus_contacter',
    description: 'La personne ne veut plus être appelée ni recevoir de message : retirer son consentement.',
    parametres: { type: 'object', properties: {} },
  },
  {
    nom: 'terminer',
    description: 'La conversation est finie (au téléphone : raccrocher après ta dernière phrase).',
    parametres: { type: 'object', properties: { resume: { type: 'string' } } },
  },
];

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

const JOUR = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function libelleCreneau(d: Date): string {
  const h = heureLocale(d, REGLAGES.fuseau);
  const [, m, j] = h.date.split('-').map(Number);
  const hh = Math.floor(h.minutes / 60), mm = h.minutes % 60;
  return `${JOUR[h.jour]} ${j} ${MOIS[m - 1]} à ${hh} h${mm ? ` ${String(mm).padStart(2, '0')}` : ''}`;
}

const plagesDe = (p: { jours: number[]; plages: { debut: string; fin: string }[] }): Plage[] =>
  p.plages.map((x) => ({ jours: p.jours, debut: x.debut, fin: x.fin }));

/**
 * Can a meeting start at `d`? It must start on a slot boundary inside the local
 * opening hours, fit entirely before the end of its range, avoid public
 * holidays and keep the minimum notice. Checked on the local clock — no offset
 * arithmetic, so the change to summer time cannot shift a meeting by an hour.
 */
function creneauPossible(d: Date, maintenant: Date): boolean {
  const r = REGLAGES.rendez_vous;
  const pas = r.duree_minutes * 60_000;
  if (d.getTime() % pas !== 0) return false;
  if (d.getTime() < maintenant.getTime() + r.delai_minimum_heures * 3_600_000) return false;
  if (d.getTime() > maintenant.getTime() + r.horizon_jours * 86_400_000) return false;
  const plages = plagesDe(r);
  const h = heureLocale(d, REGLAGES.fuseau);
  if (joursFeriesFrance(Number(h.date.slice(0, 4))).includes(h.date) || !dansPlages(h, plages)) return false;
  const finRdv = heureLocale(new Date(d.getTime() + pas - 60_000), REGLAGES.fuseau);
  return finRdv.date === h.date && dansPlages(finRdv, plages);
}

function creneauxPris(s: Stockage): Set<string> {
  return new Set(s.lister<RendezVous>(C.rendezVous, (x) => x.statut === 'confirme').map((x) => x.debut));
}

/** True when `debut` (as rendered by creneauxLibres) can still be booked. */
export function creneauLibre(s: Stockage, maintenant: Date, debut: string): boolean {
  const t = Date.parse(debut);
  return Number.isFinite(t) && iso(new Date(t)) === debut && creneauPossible(new Date(t), maintenant) && !creneauxPris(s).has(debut);
}

/** The next free slots, walking UTC half-hours and keeping those `creneauPossible` accepts. */
export function creneauxLibres(s: Stockage, maintenant: Date, aPartirDu?: string): { debut: string; libelle: string }[] {
  const r = REGLAGES.rendez_vous;
  const pas = r.duree_minutes * 60_000;
  const pris = creneauxPris(s);
  const fin = maintenant.getTime() + r.horizon_jours * 86_400_000;
  const sortie: { debut: string; libelle: string }[] = [];
  for (let t = Math.ceil(maintenant.getTime() / pas) * pas; t <= fin && sortie.length < r.creneaux_proposes; t += pas) {
    const d = new Date(t);
    if (aPartirDu && heureLocale(d, REGLAGES.fuseau).date < aPartirDu) continue;
    if (!creneauPossible(d, maintenant) || pris.has(iso(d))) continue;
    sortie.push({ debut: iso(d), libelle: libelleCreneau(d) });
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Contacts and consent
// ---------------------------------------------------------------------------

export function contactDe(s: Stockage, e164: string, nom = ''): Contact {
  return s.lire<Contact>(C.contacts, e164) ?? { id: e164, e164, nom, consentement: null, retire_le: null, appels: [] };
}

/** A consent is a fact with its proof; one without source or date is refused here, not "fixed later". */
export function poserConsentement(s: Stockage, e: { e164?: unknown; nom?: unknown; source?: unknown; date?: unknown; preuve?: unknown }, maintenant: Date): Contact | string {
  const e164 = normaliserE164(e.e164);
  if (!e164) return 'Le numéro n’est pas lisible : écrivez-le avec l’indicatif, par exemple +33612345678.';
  const source = typeof e.source === 'string' ? e.source.trim() : '';
  const preuve = typeof e.preuve === 'string' ? e.preuve.trim() : '';
  if (!source) return 'Dites d’où vient le consentement (formulaire du site, demande écrite, appel entrant…) : sans source, il ne prouve rien.';
  if (!preuve) return 'Joignez la preuve du consentement (texte accepté, référence du formulaire ou du message) : la loi demande de la garder trois ans.';
  const date = typeof e.date === 'string' && Number.isFinite(Date.parse(e.date)) ? new Date(e.date) : maintenant;
  if (date.getTime() > maintenant.getTime()) return 'Le consentement ne peut pas être daté du futur.';
  const c = contactDe(s, e164, typeof e.nom === 'string' ? e.nom.trim() : '');
  if (typeof e.nom === 'string' && e.nom.trim()) c.nom = e.nom.trim();
  c.consentement = { source, date: iso(date), preuve };
  c.retire_le = null;
  return s.poser(C.contacts, e164, c);
}

export function retirerConsentement(s: Stockage, e164: string, maintenant: Date): Contact {
  const c = contactDe(s, e164);
  c.retire_le = iso(maintenant);
  if (c.consentement) c.consentement.retire_le = iso(maintenant);
  return s.poser(C.contacts, e164, c);
}

/** The one gate in front of an outbound call: the same rules as the client campaigns (`verifierContact`). */
export function peutAppeler(s: Stockage, e164: string, maintenant: Date): Verdict {
  const c = contactDe(s, e164);
  if (c.retire_le) return { autorise: false, motif: `Cette personne a demandé à ne plus être contactée (le ${c.retire_le.slice(0, 10)}).` };
  const trente = maintenant.getTime() - 30 * 86_400_000;
  return verifierContact({
    contact: { e164, nom: c.nom, consentement: c.consentement ? { source: c.consentement.source, date: c.consentement.date, retire_le: c.consentement.retire_le } : null },
    pays: REGLAGES.pays,
    fenetres: [],
    enregistrement_demande: false,
    maintenant,
    opposition: new Map(),
    appels_30_jours: c.appels.filter((a) => Date.parse(a) >= trente).length,
  });
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export function nouvelleConversation(o: { id: string; canal: Canal; sens: 'entrant' | 'sortant'; contact: string; nom?: string; objet?: string | null; id_operateur?: string | null }, maintenant: Date): Conversation {
  return {
    id: o.id, canal: o.canal, sens: o.sens, contact: o.contact, nom: o.nom ?? '', objet: o.objet ?? null,
    ouverte_le: iso(maintenant), maj_le: iso(maintenant), etat: 'agent', tours: [], qualification: {},
    rendez_vous: null, creneaux_proposes: [], transfert: null, id_operateur: o.id_operateur ?? null, vus: [], silences: 0, jetons: { entree: 0, sortie: 0 },
  };
}

export function ajouterTour(c: Conversation, qui: Qui, texte: string, maintenant: Date): void {
  c.tours.push({ qui, texte, le: iso(maintenant) });
  c.maj_le = iso(maintenant);
}

/** The model sees the conversation as alternating turns; a human's words are its own turns, marked. */
export function historique(c: Conversation): MessageCerveau[] {
  const m: MessageCerveau[] = [];
  for (const t of c.tours) {
    if (t.qui === 'systeme') continue;
    const role = t.qui === 'contact' ? 'user' : 'assistant';
    const texte = t.qui === 'humain' ? `[Message d’un conseiller humain] ${t.texte}` : t.texte;
    const dernier = m[m.length - 1];
    if (dernier && dernier.role === role) (dernier.content[0] as { text: string }).text += `\n${texte}`;
    else m.push({ role, content: [{ type: 'text', text: texte }] });
  }
  if (m[0]?.role === 'assistant') m.unshift({ role: 'user', content: [{ type: 'text', text: '(La conversation commence.)' }] });
  return m;
}

export type Effet = { transfert: Transfert | null; terminer: boolean };

function texteDe(v: unknown, max = 200): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
}

/** Executes one tool call. The answer goes back to the model, in French, success or refusal. */
export function executer(s: Stockage, c: Conversation, nom: string, a: Record<string, unknown>, effet: Effet, maintenant: Date): string {
  switch (nom) {
    case 'noter_qualification': {
      const q = c.qualification;
      for (const k of ['nom', 'entreprise', 'activite', 'besoin', 'echeance', 'email'] as const) {
        const v = texteDe(a[k]); if (v) q[k] = v;
      }
      if (Number.isInteger(a.nombre_postes) && (a.nombre_postes as number) > 0) q.nombre_postes = a.nombre_postes as number;
      if (INTERETS.includes(a.interet as never)) q.interet = a.interet as Qualification['interet'];
      if (q.nom && !c.nom) c.nom = q.nom;
      return 'Noté.';
    }
    case 'creneaux_libres': {
      const l = creneauxLibres(s, maintenant, texteDe(a.a_partir_du, 10));
      c.creneaux_proposes = l;
      return l.length ? JSON.stringify(l) : 'Aucun créneau libre dans les deux prochaines semaines : propose que la personne soit rappelée par un conseiller (transferer_a_un_humain).';
    }
    case 'reserver_rendez_vous': {
      if (c.rendez_vous) return 'Un rendez-vous est déjà réservé pour cette personne : ne pas en réserver un second.';
      const nomContact = c.qualification.nom || c.nom;
      if (!nomContact) return 'Refusé : demande d’abord le nom de la personne (et note-le).';
      const debut = texteDe(a.debut, 40) ?? '';
      if (!creneauLibre(s, maintenant, debut)) return 'Refusé : ce créneau n’est pas libre ou n’existe pas. Rappelle creneaux_libres et propose un créneau de la liste.';
      const rdv: RendezVous = {
        id: randomUUID(), debut, fin: iso(new Date(Date.parse(debut) + REGLAGES.rendez_vous.duree_minutes * 60_000)),
        conversation_id: c.id, canal: c.canal, contact: c.contact, nom: nomContact, entreprise: c.qualification.entreprise ?? null,
        objet: texteDe(a.objet, 300) ?? 'Présentation d’iAgent', cree_le: iso(maintenant), statut: 'confirme',
      };
      s.poser(C.rendezVous, rdv.id, rdv);
      c.rendez_vous = rdv.id;
      return `Réservé : ${libelleCreneau(new Date(debut))}, ${REGLAGES.rendez_vous.duree_minutes} minutes, avec un conseiller qui appellera le ${c.contact}.`;
    }
    case 'transferer_a_un_humain': {
      effet.transfert = { motif: texteDe(a.motif) ?? 'demande de la personne', resume: texteDe(a.resume, 600) ?? '', le: iso(maintenant), statut: 'a-traiter' };
      return c.canal === 'telephone'
        ? 'La mise en relation part après ta phrase : annonce-la en une phrase, sans promettre que quelqu’un décroche.'
        : 'Un conseiller est prévenu et répondra ici même. Dis-le en une phrase, sans promettre de délai.';
    }
    case 'ne_plus_contacter': {
      retirerConsentement(s, c.contact, maintenant);
      return 'Fait : plus aucun appel ni message ne partira vers cette personne. Confirme-le-lui simplement.';
    }
    case 'terminer': {
      effet.terminer = true;
      return 'Noté : dis au revoir.';
    }
    default:
      return `L’outil « ${nom} » n’existe pas.`;
  }
}

export const TOURS_OUTILS_MAX = 5;

export type ResultatTour = { texte: string; effet: Effet };

/**
 * One turn of the agent: the contact's words are already in `c.tours`. The
 * brain may call tools several times before it answers; the final text is the
 * reply. A brain that fails never leaves the person without an answer — the
 * turn falls back to a human, and says so.
 */
export async function tourAgent(s: Stockage, c: Conversation, cerveau: Cerveau, maintenant: Date): Promise<ResultatTour> {
  const effet: Effet = { transfert: null, terminer: false };
  const messages = historique(c);
  const systeme = consigne(c, maintenant);
  let texte = '';
  for (let i = 0; i < TOURS_OUTILS_MAX; i++) {
    const r = await cerveau.repondre(systeme, messages, OUTILS);
    c.jetons.entree += r.jetons_entree; c.jetons.sortie += r.jetons_sortie;
    if (r.texte) texte = r.texte;
    if (r.appels.length === 0) break;
    messages.push({
      role: 'assistant',
      content: [
        ...(r.texte ? [{ type: 'text' as const, text: r.texte }] : []),
        ...r.appels.map((x) => ({ type: 'tool_use' as const, id: x.id, name: x.nom, input: x.arguments })),
      ],
    });
    messages.push({
      role: 'user',
      content: r.appels.map((x) => ({ type: 'tool_result' as const, tool_use_id: x.id, content: executer(s, c, x.nom, x.arguments, effet, maintenant) })),
    });
    for (const x of r.appels) ajouterTour(c, 'systeme', `outil ${x.nom} ${JSON.stringify(x.arguments)}`, maintenant);
  }
  if (!texte) texte = effet.transfert ? 'Je vous passe un conseiller.' : 'Pardon, je n’ai pas su vous répondre. Un conseiller va reprendre la conversation.';
  return { texte, effet };
}

/** WhatsApp lets a business answer freely for 24 hours after the person's last message; after that, only approved templates. */
export function fenetreWhatsAppOuverte(c: Conversation, maintenant: Date): boolean {
  const dernier = [...c.tours].reverse().find((t) => t.qui === 'contact');
  return !!dernier && maintenant.getTime() - Date.parse(dernier.le) < 24 * 3_600_000;
}

/** Is a human expected to pick up now? Outside these hours a transfer becomes a callback. */
export function humainJoignable(maintenant: Date): boolean {
  const h = heureLocale(maintenant, REGLAGES.fuseau);
  if (joursFeriesFrance(Number(h.date.slice(0, 4))).includes(h.date)) return false;
  return dansPlages(h, plagesDe(REGLAGES.transfert));
}

/** Words that stop any further contact, whatever the agent would say. */
export function demandeArret(texte: string): boolean {
  return /^\s*(stop|arr[eê]t|arr[eê]ter|d[ée]sinscri(re|ption))\s*[.!]*\s*$/i.test(texte);
}

/** Forgets conversations older than the retention period. Meetings and consents follow their own rules. */
export function purger(s: Stockage, maintenant: Date): number {
  const limite = maintenant.getTime() - REGLAGES.conservation_jours * 86_400_000;
  let n = 0;
  for (const c of s.lister<Conversation>(C.conversations, (x) => Date.parse(x.maj_le) < limite)) {
    s.retirer(C.conversations, c.id); n++;
  }
  return n;
}

/** Checks the settings once, so a typo in reglages.json fails the bench rather than a call. */
export function reglagesInvalides(): string | null {
  try {
    for (const p of [...REGLAGES.rendez_vous.plages, ...REGLAGES.transfert.plages]) if (minutesDe(p.debut) >= minutesDe(p.fin)) return `Plage ${p.debut}-${p.fin} à l’envers.`;
  } catch (e) { return (e as Error).message; }
  if (!REGLAGES.prenom || !REGLAGES.voix_twilio) return 'Prénom ou voix manquant.';
  return null;
}
