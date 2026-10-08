// The media bridge: a phone line's audio in a voice engine's ears, the engine's
// voice back on the line. One `Pont` per live call, between the operator's
// WebSocket (Twilio Media Streams, Telnyx media streaming) and a `SessionVoix`.
//
// Formats READ in the official documentation (08/10/2026):
//  - Twilio https://www.twilio.com/docs/voice/media-streams/websocket-messages : we receive
//    `connected`, `start` (top-level `streamSid`, `start.mediaFormat` always audio/x-mulaw,
//    8000, 1), `media` (`media.track` inbound|outbound, `media.payload` base64), `stop`,
//    `dtmf`, `mark` (`mark.name`); we send `media` {streamSid, media.payload: raw mulaw/8000
//    base64, no file header}, `mark` {streamSid, mark.name}, `clear` {streamSid}.
//  - Telnyx https://developers.telnyx.com/docs/voice/programmable-voice/media-streaming :
//    same events with `stream_id` and `sequence_number`; `media.payload` base64 RTP payload
//    without headers (PCMU at 8 kHz, asked for in `streaming_start`); `error` {payload.code,
//    title, detail}; we send `media` {media.payload} in chunks of 20 ms to 30 s, `clear`,
//    `mark` {mark.name}. NOT DONE: the page says media events may arrive out of order and
//    gives `chunk` to reorder; we play them in arrival order.
//
// What the bridge decides, and only here:
//  - when the caller's turn ends (`DetecteurTours`, energy on 20 ms frames), so every
//    engine gets the same turns, Gemini Live included (it also has its own detector);
//  - barge-in: the caller speaking over the agent cuts the agent (`interrupt` + `clear`);
//  - what the switchboard says while an agent holds the line: a sentence produced by a
//    tool's transition goes back in the tool's answer (`a_dire`), so the agent says it in
//    its own turn; any other one is said with `say`;
//  - an agent-to-agent transfer: the next agent's session opens on the same line once the
//    current agent has finished its sentence.
// The line stays open when no engine can speak (the caller hears silence while a human is
// warned): closing a Twilio <Connect><Stream> would run the rest of the TwiML, i.e. hang up.
import { DetecteurTours, pcmVersUlaw, reechantillonner, ulawVersPcm, type ReglagesTours } from './audio.ts';
import type { Metriques, SessionVoix } from './fournisseurs-voix.ts';
import { evenementDeOutil, type Etape, type Evenement, type Transition } from './standard.ts';
import type { MoteurVoix } from './types.ts';
import type { ConnexionWs } from '../ws.ts';

export type Protocole = 'twilio' | 'telnyx';

export type SessionOuverte =
  | { session: SessionVoix; moteur: MoteurVoix; agent: string; accueil: string | null; motif: string }
  | { session: null; motif: string };

export type BilanPont = { sessions: Metriques[]; tours_appelant: number; interruptions: number };

export type OptionsPont = {
  ws: ConnexionWs;
  protocole: Protocole;
  appel_id: string;
  extension: string;
  /** Opens the voice session of an extension (profile, engine, fallbacks). */
  ouvrirSession: (extension: string, apresTransfert: boolean) => Promise<SessionOuverte>;
  /** Applies an event to the stored call, as a webhook would. */
  appliquer: (ev: Evenement) => Promise<Transition | null>;
  /** What the switchboard had to say before the line was ours (Telnyx greeting). */
  premiers_mots: string[];
  journal: (quoi: string) => void;
  surFin: (b: BilanPont) => void;
  reglages?: ReglagesTours;
  /** How often queued audio leaves for the operator. */
  cadence_ms?: number;
};

/** The bridges of the calls in progress, by call id: `routes.ts` routes the switchboard's actions through them. */
export const ponts = new Map<string, Pont>();

const TAUX_LIGNE = 8000;
const TAUX_MOTEUR = 16000;
/** Audio sent ahead of real time on each tick: enough to ride out jitter, small enough that `clear` cuts quickly. */
const AVANCE_OCTETS = 1600; // 200 ms of mulaw/8000
const ATTENTE_MAX_OCTETS = 10 * TAUX_MOTEUR * 2; // 10 s of caller audio kept while a session opens

type Sortant = { type: 'son'; ulaw: Buffer } | { type: 'marque'; nom: string };

export class Pont {
  private readonly o: OptionsPont;
  private flux: string | null = null;
  private session: SessionVoix | null = null;
  private extension: string;
  private readonly detecteur: DetecteurTours;
  private file: Sortant[] = [];
  private minuterie: ReturnType<typeof setInterval> | null = null;
  private marques = 0;
  private derniereMarque: string | null = null;
  private agentParle = false;
  private sonDepuisMarque = false;
  private muet = false;
  private ouverture: Promise<void> | null = null;
  private enAttente: { pcm: Buffer; fin: boolean }[] = [];
  private tailleAttente = 0;
  private bascule: string | null = null;
  private aDireEnAttente: string[] = [];
  private finie = false;
  private readonly metriques: Metriques[] = [];
  private tours = 0;
  private interruptions = 0;
  /** True while a tool of the agent is being applied: its sentences go back in the tool's answer. */
  dansOutil = false;
  readonly aDire: string[] = [];

  constructor(o: OptionsPont) {
    this.o = o;
    this.extension = o.extension;
    this.aDireEnAttente.push(...o.premiers_mots);
    this.detecteur = new DetecteurTours(TAUX_LIGNE, o.reglages);
    o.ws.surMessage = (t) => this.recevoir(t);
    o.ws.surFermeture = () => { void this.finir('la ligne s’est fermée'); };
  }

  // --- The switchboard talks to the bridge ----------------------------------

  /** A sentence of the switchboard: in the tool's answer when a tool caused it, said otherwise. */
  dire(texte: string): void {
    if (this.dansOutil) { this.aDire.push(texte); return; }
    if (this.session) void this.session.say(texte).catch(() => this.o.journal('pont : une phrase du standard n’a pas pu être dite.'));
    else this.aDireEnAttente.push(texte);
  }

  /** The call's stage changed: outside a conversation, the caller's voice no longer reaches the agent. */
  etape(e: Etape): void {
    this.muet = e !== 'conversation';
  }

  /** Another agent takes the line once the current one has finished its sentence. */
  basculer(extension: string): void {
    this.bascule = extension;
    if (!this.dansOutil && !this.agentParle) void this.basculerMaintenant();
  }

  get moteurEnLigne(): boolean { return this.session !== null; }

  // --- The operator's messages ---------------------------------------------

  private recevoir(texte: string): void {
    let m: Record<string, any>;
    try { m = JSON.parse(texte); } catch { this.o.journal('pont : message illisible de l’opérateur, ignoré.'); return; }
    switch (m.event) {
      case 'connected': return;
      case 'start': {
        this.flux = String((this.o.protocole === 'twilio' ? m.streamSid ?? m.start?.streamSid : m.stream_id) ?? '');
        const f = m.start?.mediaFormat ?? m.start?.media_format;
        const enc = String(f?.encoding ?? '');
        if (enc && !['audio/x-mulaw', 'PCMU'].includes(enc)) {
          this.o.journal(`pont : l’opérateur envoie du « ${enc} », seul le μ-law 8 kHz est lu : un humain est prévenu.`);
          void this.sansVoix('le son de la ligne n’est pas dans un format lu');
          return;
        }
        this.o.journal('pont : la ligne est branchée.');
        this.minuterie = setInterval(() => this.emettre(), this.o.cadence_ms ?? 100);
        this.ouverture = this.ouvrir(this.extension);
        return;
      }
      case 'media': {
        if (m.media?.track === 'outbound') return;
        const b64 = m.media?.payload;
        if (typeof b64 !== 'string' || !b64) return;
        this.entendre(ulawVersPcm(Buffer.from(b64, 'base64')));
        return;
      }
      case 'mark': {
        if (m.mark?.name && m.mark.name === this.derniereMarque && !this.file.some((x) => x.type === 'son')) {
          this.agentParle = false;
          if (this.bascule) void this.basculerMaintenant();
        }
        return;
      }
      case 'dtmf': this.o.journal(`pont : touche ${String(m.dtmf?.digit ?? '?')} reçue (le standard n’a pas de menu à touches).`); return;
      case 'error': this.o.journal(`pont : l’opérateur signale une erreur de flux (${String(m.payload?.title ?? m.payload?.code ?? 'sans détail')}).`); return;
      case 'stop': void this.finir('l’opérateur a arrêté le flux'); return;
      default: return;
    }
  }

  // --- Caller → engine -----------------------------------------------------

  private entendre(pcm8k: Buffer): void {
    for (const s of this.detecteur.pousser(pcm8k)) {
      if (s.type === 'debut') {
        this.tours++;
        if (this.agentParle) this.couperAgent();
        continue;
      }
      if (this.muet) continue;
      const pcm = s.type === 'son' ? reechantillonner(s.pcm, TAUX_LIGNE, TAUX_MOTEUR) : Buffer.alloc(0);
      this.versMoteur(pcm, s.type === 'fin');
    }
  }

  private versMoteur(pcm: Buffer, fin: boolean): void {
    if (!this.session) {
      if (this.tailleAttente + pcm.length <= ATTENTE_MAX_OCTETS) { this.enAttente.push({ pcm, fin }); this.tailleAttente += pcm.length; }
      return;
    }
    this.session.sendAudio(pcm, { finDeTour: fin }).catch(() => this.o.journal('pont : le son n’a pas pu partir vers le moteur.'));
  }

  private couperAgent(): void {
    this.interruptions++;
    this.viderSortie();
    this.agentParle = false;
    void this.session?.interrupt().catch(() => {});
  }

  // --- Engine → caller -----------------------------------------------------

  private versLigne(pcm: Buffer, taux: number): void {
    const ulaw = pcmVersUlaw(reechantillonner(pcm, taux, TAUX_LIGNE));
    if (!ulaw.length) return;
    this.file.push({ type: 'son', ulaw });
    this.agentParle = true;
    this.sonDepuisMarque = true;
  }

  private marquer(): void {
    const nom = `fin-${++this.marques}`;
    this.derniereMarque = nom;
    this.sonDepuisMarque = false;
    this.file.push({ type: 'marque', nom });
  }

  private viderSortie(): void {
    this.file = [];
    this.envoyer({ event: 'clear' });
  }

  private envoyer(o: Record<string, unknown>): void {
    if (!this.o.ws.ouverte) return;
    this.o.ws.envoyer(JSON.stringify(this.o.protocole === 'twilio' ? { event: o.event, streamSid: this.flux, ...o } : o));
  }

  /** Sends what is queued, up to `AVANCE_OCTETS` of sound per tick, marks in their place. */
  private emettre(): void {
    let budget = AVANCE_OCTETS;
    while (this.file.length && budget > 0) {
      const x = this.file[0];
      if (x.type === 'marque') { this.file.shift(); this.envoyer({ event: 'mark', mark: { name: x.nom } }); continue; }
      const morceau = x.ulaw.subarray(0, budget);
      x.ulaw = x.ulaw.subarray(morceau.length);
      if (!x.ulaw.length) this.file.shift();
      budget -= morceau.length;
      this.envoyer({ event: 'media', media: { payload: morceau.toString('base64') } });
    }
  }

  // --- Sessions ------------------------------------------------------------

  private async ouvrir(extension: string, apresTransfert = false): Promise<void> {
    const r = await this.o.ouvrirSession(extension, apresTransfert).catch((e): SessionOuverte => ({ session: null, motif: e instanceof Error ? e.message : 'La voix ne s’ouvre pas.' }));
    if (this.finie) { if (r.session) this.metriques.push(await r.session.closeSession()); return; }
    if (!r.session) { await this.sansVoix(r.motif); return; }
    this.session = r.session;
    this.extension = extension;
    this.o.journal(`pont : ${r.agent} parle par ${r.moteur}. ${r.motif}`);
    void this.boucle(r.session);
    const phrases = this.aDireEnAttente.splice(0);
    if (r.accueil) phrases.push(r.accueil);
    if (phrases.length) await r.session.say(phrases.join(' ')).catch(() => this.o.journal('pont : l’accueil n’a pas pu être dit.'));
    const attente = this.enAttente.splice(0); this.tailleAttente = 0;
    for (const a of attente) this.versMoteur(a.pcm, a.fin);
  }

  /** No engine can speak: the line stays open and a human is warned. */
  private async sansVoix(motif: string): Promise<void> {
    this.o.journal(`pont : aucun agent ne peut parler (${motif}).`);
    const t = await this.o.appliquer({ type: 'demander_humain', motif: 'la voix de l’agent ne s’ouvre pas', resume: motif }).catch(() => null);
    if (t?.refuse) this.o.journal(`pont : ${t.motif}`);
  }

  private async boucle(session: SessionVoix): Promise<void> {
    for await (const e of session.receiveAudio()) {
      if (session !== this.session) break;
      if (e.type === 'audio') this.versLigne(e.pcm, e.taux);
      else if (e.type === 'interrompu') { this.viderSortie(); this.agentParle = false; }
      else if (e.type === 'erreur') this.o.journal(`pont : ${e.motif}`);
      else if (e.type === 'appel-outil') {
        await session.executeTool(e.appel, async () => {
          const ev = evenementDeOutil(e.appel.nom, e.appel.arguments);
          if (!ev) return { refus: `Outil inconnu : ${e.appel.nom}` };
          this.dansOutil = true;
          let t: Transition | null;
          try { t = await this.o.appliquer(ev); } finally { this.dansOutil = false; }
          const dit = this.aDire.splice(0);
          if (!t) return { refus: 'L’appel n’existe plus.' };
          return { etape: t.etat.etape, motif: t.motif, ...(dit.length ? { a_dire: dit.join(' ') } : {}) };
        }).catch(() => this.o.journal('pont : la réponse de l’outil n’a pas pu partir.'));
      } else if (e.type === 'fin-de-tour') {
        // Silent turn: nothing to wait for. Otherwise the agent speaks until the operator returns the mark.
        if (!this.sonDepuisMarque) this.agentParle = false;
        this.marquer();
        if (this.bascule && !this.agentParle) await this.basculerMaintenant();
      }
    }
  }

  private async basculerMaintenant(): Promise<void> {
    const vers = this.bascule;
    if (!vers || this.finie) return;
    this.bascule = null;
    const ancienne = this.session;
    this.session = null;
    if (ancienne) this.metriques.push(await ancienne.closeSession());
    this.ouverture = this.ouvrir(vers, true);
    await this.ouverture;
  }

  // --- End -----------------------------------------------------------------

  private async finir(pourquoi: string): Promise<void> {
    if (this.finie) return;
    this.finie = true;
    if (this.minuterie) clearInterval(this.minuterie);
    ponts.delete(this.o.appel_id);
    await this.ouverture?.catch(() => {});
    const s = this.session; this.session = null;
    if (s) this.metriques.push(await s.closeSession());
    if (this.o.ws.ouverte) this.o.ws.fermer(1000, 'fin');
    this.o.journal(`pont : fermé (${pourquoi}), ${this.tours} tour(s) de l’appelant, ${this.interruptions} interruption(s).`);
    this.o.surFin({ sessions: this.metriques, tours_appelant: this.tours, interruptions: this.interruptions });
  }

  /** Waits for the end of the bridge (bench). */
  async fermer(): Promise<void> { await this.finir('fermé par la plateforme'); }
}
