// The conversational switchboard (MASTER §11): no DTMF menu — the caller
// speaks, the reception agent understands, and its TOOLS move the call. The
// call is a pure state machine: `transition()` takes the policy, the moment and
// an event, and returns the next state, the actions for the operator and a
// French reason. Nothing here talks to the network; `routes.ts` executes the
// actions, and the same machine runs whatever voice engine the agent uses.
import type { Call } from '../modele.ts';
import type { EvenementVoix, Outil, SessionVoix } from './fournisseurs-voix.ts';
import { heureLocale, dansPlages, plagesInvalides, type HeureLocale } from './temps.ts';
import { destinationValide, normaliserE164 } from './telephonie.ts';
import type { CibleHumaine, DecisionHandoff, Extension, Humain, Standard } from './types.ts';

export type Etape = 'sonne' | 'conversation' | 'attente' | 'handoff' | 'humain' | 'messagerie' | 'rappel' | 'termine';

export type EtatAppel = {
  etape: Etape;
  extension: string | null;
  transferts: number;
  humain_id?: string;
  cible?: CibleHumaine;
  file_id?: string;
  motif?: string;
  resume?: string;
  issue?: Call['issue'];
};

export const ETAT_INITIAL: EtatAppel = { etape: 'sonne', extension: null, transferts: 0 };

export type Evenement =
  | { type: 'entrant' }
  | { type: 'transferer_agent'; vers: string }
  | { type: 'demander_humain'; motif: string; resume: string }
  | { type: 'decision'; decision: DecisionHandoff }
  | { type: 'file_libre' }
  | { type: 'attente_depassee'; vers: 'messagerie' | 'rappel' | 'file'; file_id?: string }
  | { type: 'laisser_message' }
  | { type: 'demander_rappel' }
  | { type: 'traite'; resume: string }
  | { type: 'raccroche' };

export type Action =
  | { type: 'decrocher' }
  | { type: 'dire'; texte: string }
  | { type: 'connecter_agent'; extension: string; agent_instance_id: string }
  | { type: 'mettre_en_attente'; file_id: string | null }
  | { type: 'notifier_handoff'; humain_id: string; appelant: string; motif: string; resume: string }
  | { type: 'transferer'; vers: string; cible: CibleHumaine['type'] }
  | { type: 'messagerie' }
  | { type: 'programmer_rappel'; numero: string }
  | { type: 'raccrocher' };

export type ContexteAppel = {
  standard: Standard;
  appelant: string;
  maintenant: Date;
  /** false while no media bridge links the phone line to a voice engine. */
  agent_au_telephone: boolean;
  /** false when the tenant's simultaneous-session ceiling is reached. */
  places_libres: boolean;
};

export type Transition = { etat: EtatAppel; actions: Action[]; motif: string; refuse: boolean };

const refuse = (etat: EtatAppel, motif: string): Transition => ({ etat, actions: [], motif, refuse: true });
const va = (etat: EtatAppel, actions: Action[], motif: string): Transition => ({ etat, actions, motif, refuse: false });

function extensionPour(std: Standard, vers: string): Extension | undefined {
  const v = vers.trim().toLowerCase();
  return std.extensions.find((e) => e.numero === v || e.departement.toLowerCase() === v || e.prenom.toLowerCase() === v);
}

function cibleOuverte(c: CibleHumaine, h: HeureLocale, std: Standard): boolean {
  return dansPlages(h, c.plages ?? std.horaires);
}

/** Who can take the call now: someone of the department first, anyone otherwise. */
export function humainDisponible(std: Standard, departement: string | null, h: HeureLocale): Humain | null {
  const joignables = std.humains.filter((u) => u.cibles.some((c) => cibleOuverte(c, h, std)));
  return joignables.find((u) => departement && u.departements.includes(departement)) ?? joignables[0] ?? null;
}

/** The rule of the transfer: the human's targets in their order, the first one reachable now. */
export function cibleDe(std: Standard, humain: Humain, h: HeureLocale): CibleHumaine | null {
  return humain.cibles.find((c) => cibleOuverte(c, h, std)) ?? null;
}

function versMessagerieOuRappel(ctx: ContexteAppel, etat: EtatAppel, avant: Action[], motif: string): Transition {
  const std = ctx.standard;
  if (std.messagerie) {
    return va({ ...etat, etape: 'messagerie', motif }, [...avant, { type: 'dire', texte: 'Vous pouvez laisser un message après le signal.' }, { type: 'messagerie' }], motif);
  }
  if (std.rappel) {
    return va({ ...etat, etape: 'rappel', motif }, [...avant, { type: 'dire', texte: 'Nous vous rappellerons au plus vite.' }, { type: 'programmer_rappel', numero: ctx.appelant }, { type: 'raccrocher' }], motif);
  }
  return va({ ...etat, etape: 'termine', issue: 'abandonne', motif }, [...avant, { type: 'raccrocher' }], `${motif} Ni messagerie ni rappel ne sont prévus : l’appel est raccroché.`);
}

function ouvrirConversation(ctx: ContexteAppel, etat: EtatAppel, avant: Action[]): Transition {
  const std = ctx.standard;
  const h = heureLocale(ctx.maintenant, std.fuseau);
  if (!ctx.agent_au_telephone) {
    // Without a media bridge an agent cannot speak on the line: go to a human.
    const motif = 'L’agent ne peut pas encore parler au téléphone (le pont média n’est pas en place).';
    const u = humainDisponible(std, null, h);
    if (!u) return versMessagerieOuRappel(ctx, etat, avant, `${motif} Personne n’est joignable.`);
    return va({ ...etat, etape: 'handoff', humain_id: u.id, motif, resume: '' }, [...avant, { type: 'mettre_en_attente', file_id: std.file_id }, { type: 'notifier_handoff', humain_id: u.id, appelant: ctx.appelant, motif, resume: '' }], `${motif} ${u.nom} est prévenu.`);
  }
  const ext = extensionPour(std, std.extension_accueil);
  if (!ext) return versMessagerieOuRappel(ctx, etat, avant, `L’extension d’accueil ${std.extension_accueil} n’existe pas dans ce standard.`);
  return va({ ...etat, etape: 'conversation', extension: ext.numero }, [...avant, { type: 'connecter_agent', extension: ext.numero, agent_instance_id: ext.agent_instance_id }], `${ext.prenom} (${ext.departement}) prend l’appel.`);
}

export function transition(ctx: ContexteAppel, etat: EtatAppel, ev: Evenement): Transition {
  const std = ctx.standard;
  const h = heureLocale(ctx.maintenant, std.fuseau);
  if (etat.etape === 'termine') {
    return ev.type === 'raccroche' ? va(etat, [], 'L’appel était déjà terminé.') : refuse(etat, 'L’appel est terminé.');
  }
  switch (ev.type) {
    case 'entrant': {
      if (etat.etape !== 'sonne') return refuse(etat, 'Cet appel a déjà été pris.');
      const decroche: Action[] = [{ type: 'decrocher' }];
      if (!dansPlages(h, std.horaires)) {
        return versMessagerieOuRappel(ctx, etat, [...decroche, { type: 'dire', texte: std.message_ferme }], 'Appel reçu en dehors des horaires d’ouverture.');
      }
      const accueil: Action[] = [...decroche, { type: 'dire', texte: std.accueil }];
      if (!ctx.places_libres) {
        if (std.file_id) {
          return va({ ...etat, etape: 'attente', file_id: std.file_id }, [...accueil, { type: 'dire', texte: 'Tous nos agents sont en ligne, merci de patienter.' }, { type: 'mettre_en_attente', file_id: std.file_id }], 'Plafond d’appels simultanés atteint : l’appel attend dans la file.');
        }
        return versMessagerieOuRappel(ctx, etat, accueil, 'Plafond d’appels simultanés atteint et aucune file prévue.');
      }
      return ouvrirConversation(ctx, etat, accueil);
    }
    case 'file_libre': {
      if (etat.etape !== 'attente') return refuse(etat, 'Cet appel n’attend dans aucune file.');
      return ouvrirConversation(ctx, { ...etat, file_id: undefined }, []);
    }
    case 'attente_depassee': {
      if (etat.etape !== 'attente') return refuse(etat, 'Cet appel n’attend dans aucune file.');
      if (ev.vers === 'file' && ev.file_id) {
        return va({ ...etat, file_id: ev.file_id }, [{ type: 'mettre_en_attente', file_id: ev.file_id }], 'Attente trop longue : l’appel déborde vers une autre file.');
      }
      if (ev.vers === 'rappel' && std.rappel) {
        return va({ ...etat, etape: 'rappel' }, [{ type: 'dire', texte: 'L’attente est longue : nous vous rappelons dès qu’un agent se libère.' }, { type: 'programmer_rappel', numero: ctx.appelant }, { type: 'raccrocher' }], 'Attente trop longue : rappel programmé.');
      }
      return versMessagerieOuRappel(ctx, etat, [], 'Attente trop longue.');
    }
    case 'transferer_agent': {
      if (etat.etape !== 'conversation') return refuse(etat, 'Seul un agent en conversation peut transférer l’appel.');
      const ext = extensionPour(std, ev.vers);
      if (!ext) return va(etat, [{ type: 'dire', texte: `Je n’ai personne pour « ${ev.vers} » ici.` }], `Aucune extension ni département « ${ev.vers} » dans ce standard.`);
      if (ext.numero === etat.extension) return va(etat, [], `${ext.prenom} a déjà l’appel.`);
      return va({ ...etat, extension: ext.numero, transferts: etat.transferts + 1 },
        [{ type: 'dire', texte: `Je vous passe ${ext.prenom}, ${ext.departement}.` }, { type: 'connecter_agent', extension: ext.numero, agent_instance_id: ext.agent_instance_id }],
        `Transfert d’agent à agent vers ${ext.prenom} (${ext.numero}).`);
    }
    case 'demander_humain': {
      if (etat.etape !== 'conversation') return refuse(etat, 'Seul un agent en conversation peut demander un humain.');
      const dep = std.extensions.find((e) => e.numero === etat.extension)?.departement ?? null;
      const u = humainDisponible(std, dep, h);
      if (!u) {
        return va(etat, [{ type: 'dire', texte: 'Personne n’est disponible pour le moment. Je peux prendre un message ou vous faire rappeler.' }], 'Aucun humain joignable à cette heure : l’agent garde l’appel.');
      }
      return va({ ...etat, etape: 'handoff', humain_id: u.id, motif: ev.motif, resume: ev.resume },
        [{ type: 'dire', texte: `Je préviens ${u.nom}, ne quittez pas.` }, { type: 'mettre_en_attente', file_id: std.file_id }, { type: 'notifier_handoff', humain_id: u.id, appelant: ctx.appelant, motif: ev.motif, resume: ev.resume }],
        `Prise en main demandée à ${u.nom}.`);
    }
    case 'decision': {
      if (etat.etape !== 'handoff') return refuse(etat, 'Aucune prise en main n’est en attente pour cet appel.');
      const u = std.humains.find((x) => x.id === etat.humain_id);
      const agentPeutReprendre = ctx.agent_au_telephone && etat.extension !== null;
      if (ev.decision === 'prendre') {
        const c = u ? cibleDe(std, u, h) : null;
        if (!u || !c) {
          return agentPeutReprendre
            ? va({ ...etat, etape: 'conversation' }, [{ type: 'dire', texte: 'Je reste avec vous.' }], 'Aucune cible de l’humain n’est joignable maintenant : l’agent reprend.')
            : versMessagerieOuRappel(ctx, etat, [], 'Aucune cible de l’humain n’est joignable maintenant.');
        }
        return va({ ...etat, etape: 'humain', cible: c }, [{ type: 'transferer', vers: normaliserE164(c.adresse) ?? c.adresse, cible: c.type }], `${u.nom} prend l’appel (${c.type}).`);
      }
      if (ev.decision === 'rappeler') {
        return va({ ...etat, etape: 'rappel' }, [{ type: 'dire', texte: `${u?.nom ?? 'Un collègue'} vous rappellera.` }, { type: 'programmer_rappel', numero: ctx.appelant }, { type: 'raccrocher' }], 'L’humain rappellera.');
      }
      if (ev.decision === 'laisser' && agentPeutReprendre) {
        return va({ ...etat, etape: 'conversation' }, [{ type: 'dire', texte: 'Je continue avec vous.' }], 'L’humain laisse l’agent continuer.');
      }
      // refuser, or « laisser » when no agent can hold the line.
      return versMessagerieOuRappel(ctx, etat, [], ev.decision === 'laisser' ? 'L’humain laisse l’agent continuer, mais aucun agent ne peut tenir la ligne.' : 'L’humain refuse l’appel.');
    }
    case 'laisser_message': {
      if (!['conversation', 'handoff', 'attente'].includes(etat.etape)) return refuse(etat, 'On ne peut pas laisser de message à cette étape.');
      if (!std.messagerie) return va(etat, [{ type: 'dire', texte: 'La messagerie n’est pas ouverte ici.' }], 'Messagerie désactivée dans ce standard.');
      return va({ ...etat, etape: 'messagerie' }, [{ type: 'dire', texte: 'Laissez votre message après le signal.' }, { type: 'messagerie' }], 'L’appelant laisse un message.');
    }
    case 'demander_rappel': {
      if (!['conversation', 'handoff', 'attente'].includes(etat.etape)) return refuse(etat, 'On ne peut pas programmer de rappel à cette étape.');
      if (!std.rappel) return va(etat, [{ type: 'dire', texte: 'Le rappel n’est pas proposé ici.' }], 'Rappel désactivé dans ce standard.');
      return va({ ...etat, etape: 'rappel' }, [{ type: 'dire', texte: 'C’est noté, nous vous rappelons.' }, { type: 'programmer_rappel', numero: ctx.appelant }, { type: 'raccrocher' }], 'Rappel programmé à la demande de l’appelant.');
    }
    case 'traite': {
      if (etat.etape !== 'conversation') return refuse(etat, 'Seul un agent en conversation peut clore l’appel.');
      const issue = etat.transferts > 0 ? 'transfere-agent' : 'traite';
      return va({ ...etat, etape: 'termine', issue, resume: ev.resume }, [{ type: 'raccrocher' }], 'L’agent a traité la demande.');
    }
    case 'raccroche': {
      const issue: Call['issue'] =
        etat.etape === 'messagerie' ? 'messagerie'
        : etat.etape === 'rappel' ? 'rappel'
        : etat.etape === 'humain' ? 'transfere-humain'
        : etat.etape === 'conversation' ? (etat.transferts > 0 ? 'transfere-agent' : 'traite')
        : 'abandonne';
      return va({ ...etat, etape: 'termine', issue }, [], 'Fin de l’appel.');
    }
  }
}

// ---------------------------------------------------------------------------
// The agent's tools: the only way the conversation moves the call
// ---------------------------------------------------------------------------

export const OUTILS_STANDARD: Outil[] = [
  { nom: 'transferer_vers', description: 'Passer l’appel à un autre agent : numéro d’extension, prénom ou département.', parametres: { type: 'object', properties: { destination: { type: 'string' } }, required: ['destination'] } },
  { nom: 'demander_un_humain', description: 'Demander qu’un humain prenne l’appel, avec le motif et un résumé.', parametres: { type: 'object', properties: { motif: { type: 'string' }, resume: { type: 'string' } }, required: ['motif', 'resume'] } },
  { nom: 'prendre_message', description: 'L’appelant veut laisser un message.', parametres: { type: 'object', properties: {} } },
  { nom: 'proposer_rappel', description: 'L’appelant veut être rappelé.', parametres: { type: 'object', properties: {} } },
  { nom: 'appel_traite', description: 'La demande est traitée, l’appel peut se terminer.', parametres: { type: 'object', properties: { resume: { type: 'string' } }, required: ['resume'] } },
];

export function evenementDeOutil(nom: string, args: Record<string, unknown>): Evenement | null {
  const s = (k: string) => String(args[k] ?? '').trim();
  switch (nom) {
    case 'transferer_vers': return s('destination') ? { type: 'transferer_agent', vers: s('destination') } : null;
    case 'demander_un_humain': return { type: 'demander_humain', motif: s('motif') || 'non précisé', resume: s('resume') };
    case 'prendre_message': return { type: 'laisser_message' };
    case 'proposer_rappel': return { type: 'demander_rappel' };
    case 'appel_traite': return { type: 'traite', resume: s('resume') };
    default: return null;
  }
}

/**
 * Drives one voice session against the call: every tool call becomes an event
 * of the machine, its answer goes back to the engine. Engine-agnostic by
 * construction — it only sees `SessionVoix`.
 */
export async function conduireAppel(
  session: SessionVoix,
  appliquer: (ev: Evenement) => Promise<Transition>,
  tours: Buffer[],
): Promise<{ transcription: { qui: string; texte: string }[]; evenements: string[]; etape: Etape }> {
  const transcription: { qui: string; texte: string }[] = [];
  const evenements: string[] = [];
  let etape: Etape = 'conversation';
  let i = 0;
  const parler = async () => { if (i < tours.length) await session.sendAudio(tours[i++], { finDeTour: true }); };
  await parler();
  for await (const e of session.receiveAudio() as AsyncIterable<EvenementVoix>) {
    if (e.type === 'transcription') transcription.push({ qui: e.qui, texte: e.texte });
    if (e.type === 'erreur') { evenements.push(`erreur: ${e.motif}`); break; }
    if (e.type === 'appel-outil') {
      const ev = evenementDeOutil(e.appel.nom, e.appel.arguments);
      await session.executeTool(e.appel, async () => {
        if (!ev) return { refus: `Outil inconnu : ${e.appel.nom}` };
        const t = await appliquer(ev);
        evenements.push(`${ev.type}->${t.etat.etape}${t.refuse ? ' (refusé)' : ''}`);
        etape = t.etat.etape;
        return { etape: t.etat.etape, motif: t.motif };
      });
    }
    if (e.type === 'fin-de-tour') {
      if (etape !== 'conversation' || i >= tours.length) break;
      await parler();
    }
  }
  return { transcription, evenements, etape };
}

// ---------------------------------------------------------------------------
// Validation of a policy sent by the back-office
// ---------------------------------------------------------------------------

export function standardInvalide(s: Standard): string | null {
  if (!s || typeof s !== 'object') return 'Le standard est vide.';
  if (!s.tenant_id) return 'Le standard doit nommer son client (tenant_id).';
  try { new Intl.DateTimeFormat('fr-FR', { timeZone: s.fuseau }); } catch { return `Fuseau horaire inconnu : « ${s.fuseau} ».`; }
  const p = plagesInvalides(s.horaires); if (p) return p;
  if (!s.accueil?.trim() || !s.message_ferme?.trim()) return 'Le standard doit avoir un accueil et un message hors horaires.';
  if (!Array.isArray(s.extensions) || !Array.isArray(s.humains)) return 'Extensions et humains doivent être des listes.';
  const vues = new Set<string>();
  for (const e of s.extensions) {
    if (!/^\d{2,6}$/.test(e.numero)) return `Extension « ${e.numero} » : 2 à 6 chiffres.`;
    if (vues.has(e.numero)) return `Extension ${e.numero} déclarée deux fois.`;
    vues.add(e.numero);
    if (!e.agent_instance_id || !e.departement || !e.prenom) return `Extension ${e.numero} : agent, prénom et département requis.`;
  }
  if (!vues.has(s.extension_accueil)) return `L’extension d’accueil ${s.extension_accueil} n’est pas déclarée.`;
  for (const u of s.humains) {
    if (!u.id || !u.nom || !Array.isArray(u.cibles) || u.cibles.length === 0) return 'Chaque humain a un identifiant, un nom et au moins une cible.';
    for (const c of u.cibles) {
      if (!['desktop', 'webrtc', 'mobile', 'fixe'].includes(c.type)) return `Cible « ${c.type} » inconnue (desktop, webrtc, mobile, fixe).`;
      if ((c.type === 'mobile' || c.type === 'fixe') && !normaliserE164(c.adresse)) return `${u.nom} : « ${c.adresse} » n’est pas un numéro E.164.`;
      if ((c.type === 'desktop' || c.type === 'webrtc') && !/^sips?:/.test(c.adresse)) return `${u.nom} : une cible ${c.type} est une adresse sip:…`;
      if (!destinationValide(normaliserE164(c.adresse) ?? c.adresse)) return `${u.nom} : destination « ${c.adresse} » illisible.`;
      if (c.plages) { const q = plagesInvalides(c.plages); if (q) return q; }
    }
  }
  if (!Number.isInteger(s.plafond_sessions) || s.plafond_sessions < 1) return 'Le plafond d’appels simultanés doit être un entier positif.';
  if (typeof s.messagerie !== 'boolean' || typeof s.rappel !== 'boolean' || typeof s.consentement_enregistrement !== 'boolean') return 'messagerie, rappel et consentement_enregistrement sont vrai ou faux.';
  return null;
}
