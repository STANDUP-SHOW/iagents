// VoiceProvider (MASTER §10): the business logic talks to a `SessionVoix` and
// never to an engine. Four adapters:
//
//  - gemini     : Gemini Live, one bidirectional WebSocket (speech in, speech
//                 out, tool calls) — the engine thinks by itself;
//  - elevenlabs : Scribe (ear) + text-to-speech (mouth), turn by turn;
//  - mistral    : Voxtral transcription (ear) + Voxtral TTS (mouth), turn by turn;
//  - local      : whisper-cli (ear) + Piper (mouth), the chain the Desktop uses
//                 (desktop/src-tauri/src/voice.rs), run as processes.
// The three turn-by-turn engines only hear and speak: a `Cerveau` (language
// model) sits between ear and mouth and is the one that calls tools. By default
// it is the Anthropic Messages API, model read from dimensionnement/tarifs-api.json.
//
// Formats READ in the official documentation (page, date):
//  - Gemini Live: https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket and
//    https://ai.google.dev/api/live and https://ai.google.dev/gemini-api/docs/live-api/capabilities
//    (07/10/2026): URL …BidiGenerateContent?key=, first message `setup` {model:"models/…"},
//    wait `setupComplete`; `realtimeInput.audio {data base64, mimeType "audio/pcm;rate=16000"}`,
//    `realtimeInput.audioStreamEnd`; `clientContent {turns, turnComplete}`;
//    `toolResponse.functionResponses[]` matched by `id`; server `serverContent.modelTurn.parts[].inlineData.data`,
//    `serverContent.interrupted`, `serverContent.turnComplete`, `inputTranscription`/`outputTranscription`,
//    `toolCall.functionCalls[]`, `usageMetadata`; output audio always 24 kHz; voice
//    `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`; model `gemini-3.8-live`.
//    NOT VERIFIED: the getting-started sample puts `responseModalities` directly in `setup`
//    while the API reference nests it in `setup.generationConfig` — we follow the reference;
//    the field names inside `usageMetadata` (promptTokenCount / responseTokenCount) were not read.
//  - ElevenLabs TTS: https://elevenlabs.io/docs/api-reference/text-to-speech/convert (07/10/2026):
//    POST /v1/text-to-speech/:voice_id, header xi-api-key, body {text, model_id, language_code},
//    query output_format. NOT VERIFIED: the value `pcm_16000` (the page hides its 28 values);
//    model `eleven_v4` comes from branch equipe-levee (voix_api.rs, read 06/10/2026).
//  - ElevenLabs STT: https://elevenlabs.io/docs/api-reference/speech-to-text/convert (07/10/2026):
//    POST /v1/speech-to-text multipart, model_id `scribe_v2`, file, file_format `pcm_s16le_16`
//    (16-bit, 16 kHz, mono, little-endian), language_code; answer `text`.
//  - Mistral TTS: https://docs.mistral.ai/api/endpoint/audio/speech (07/10/2026): POST
//    /v1/audio/speech, Bearer, {model, input, voice_id, response_format: wav}, answer `audio_data`
//    base64. NOT VERIFIED here: model `voxtral-mini-tts-2603` and voice `fr_marie_neutral`
//    (taken from branch equipe-levee, the page lists neither).
//  - Mistral STT: https://docs.mistral.ai/api/endpoint/audio/transcriptions (07/10/2026): POST
//    /v1/audio/transcriptions, Bearer, fields file, model (`voxtral-mini-latest`), language;
//    answer `text`. NOT VERIFIED: multipart (the page labels the body JSON but shows `-F`).
//  - whisper-cli: https://github.com/ggml-org/whisper.cpp examples/cli/README.md (07/10/2026):
//    -m, -f, -l, -nt, -otxt, -of. Piper: same flags as the Desktop (--model, --output_file,
//    text on stdin); Piper's own README moved (OHF-Voice/piper1-gpl) and was NOT re-read.
//  - Anthropic Messages: https://platform.claude.com/docs/en/api/messages (07/10/2026) for the
//    body (model, messages, tools with name/input_schema, tool_use id, tool_result tool_use_id);
//    headers x-api-key and anthropic-version 2023-06-01 as desktop/src-tauri/src/llm.rs sends them
//    (the page excerpt did not show them).
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tarifsApi from '../../dimensionnement/tarifs-api.json' with { type: 'json' };
import { cle, manque, type Env } from './cles.ts';
import { FICHES } from './registre.ts';
import type { MoteurVoix } from './types.ts';

// ---------------------------------------------------------------------------
// The abstraction
// ---------------------------------------------------------------------------

export type Outil = { nom: string; description: string; parametres: Record<string, unknown> };
export type AppelOutil = { id: string; nom: string; arguments: Record<string, unknown> };
export type ContexteSession = { tenant_id: string; agent: string; consigne: string };

export type EvenementVoix =
  | { type: 'audio'; pcm: Buffer; taux: number }
  | { type: 'transcription'; qui: 'appelant' | 'agent'; texte: string }
  | { type: 'appel-outil'; appel: AppelOutil }
  | { type: 'interrompu' }
  | { type: 'fin-de-tour' }
  | { type: 'erreur'; motif: string };

export type Metriques = {
  moteur: MoteurVoix;
  duree_s: number;
  secondes_audio_entree: number;
  secondes_audio_sortie: number;
  caracteres_synthetises: number;
  jetons_entree: number;
  jetons_sortie: number;
  appels_outils: number;
};

export type Executeur = (nom: string, args: Record<string, unknown>) => Promise<unknown>;

export interface SessionVoix {
  /** 16-bit little-endian mono PCM at 16 kHz. `finDeTour` closes the caller's turn. */
  sendAudio(pcm: Buffer, o?: { finDeTour?: boolean }): Promise<void>;
  receiveAudio(): AsyncIterable<EvenementVoix>;
  interrupt(): Promise<void>;
  setVoice(voix: string): Promise<void>;
  sendContext(c: ContexteSession): Promise<void>;
  /** Says this exact sentence (the switchboard's own words: greeting, "please hold"…), then ends a turn. */
  say(texte: string): Promise<void>;
  executeTool(appel: AppelOutil, executeur: Executeur): Promise<void>;
  closeSession(): Promise<Metriques>;
}

export type OuvertureSession = { voix: string; langue: string; contexte: ContexteSession; outils: Outil[] };

export interface VoiceProvider {
  readonly nom: MoteurVoix;
  /** null when it can work; otherwise the French reason (never a key, only its name). */
  indisponible(): string | null;
  startSession(o: OuvertureSession): Promise<SessionVoix>;
}

export type Bases = { gemini: string; elevenlabs: string; mistral: string; anthropic: string };
export const BASES_OFFICIELLES: Bases = {
  gemini: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent',
  elevenlabs: 'https://api.elevenlabs.io',
  mistral: 'https://api.mistral.ai',
  anthropic: 'https://api.anthropic.com',
};

export const MODELES = {
  gemini: 'gemini-3.8-live',
  elevenlabs_tts: 'eleven_v4',
  elevenlabs_stt: 'scribe_v2',
  mistral_tts: 'voxtral-mini-tts-2603',
  mistral_stt: 'voxtral-mini-latest',
  cerveau: tarifsApi.modeles.reference.id,
};

// ---------------------------------------------------------------------------
// Small tools
// ---------------------------------------------------------------------------

/** One consumer, many producers. */
class FileEvenements {
  private tampon: EvenementVoix[] = [];
  private attente: ((v: IteratorResult<EvenementVoix>) => void) | null = null;
  private fermee = false;
  pousser(e: EvenementVoix): void {
    if (this.fermee) return;
    if (this.attente) { const a = this.attente; this.attente = null; a({ value: e, done: false }); } else this.tampon.push(e);
  }
  fermer(): void {
    this.fermee = true;
    if (this.attente) { const a = this.attente; this.attente = null; a({ value: undefined, done: true }); }
  }
  async *iterer(): AsyncIterable<EvenementVoix> {
    while (true) {
      if (this.tampon.length) { yield this.tampon.shift()!; continue; }
      if (this.fermee) return;
      const r = await new Promise<IteratorResult<EvenementVoix>>((res) => { this.attente = res; });
      if (r.done) return;
      yield r.value;
    }
  }
}

export function wav(pcm: Buffer, taux: number): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(taux, 24); h.writeUInt32LE(taux * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function lireWav(b: Buffer): { pcm: Buffer; taux: number } {
  if (b.length < 12 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Le son rendu n’est pas un fichier WAV.');
  }
  let i = 12; let taux = 0; let canaux = 1; let bits = 16;
  while (i + 8 <= b.length) {
    const id = b.toString('ascii', i, i + 4); const n = b.readUInt32LE(i + 4);
    if (id === 'fmt ') { canaux = b.readUInt16LE(i + 10); taux = b.readUInt32LE(i + 12); bits = b.readUInt16LE(i + 22); }
    if (id === 'data') {
      if (!taux) break;
      if (canaux !== 1 || bits !== 16) throw new Error(`Son en ${canaux} canal(aux) sur ${bits} bits : seul le mono 16 bits est lu.`);
      return { pcm: b.subarray(i + 8, i + 8 + n), taux };
    }
    i += 8 + n + (n % 2);
  }
  throw new Error('Le fichier WAV n’a pas de données lisibles.');
}

function refusHttp(qui: string, statut: number): string {
  if (statut === 401 || statut === 403) return `${qui} refuse la clé : vérifiez-la.`;
  if (statut === 402 || statut === 429) return `${qui} refuse pour l’instant : crédit épuisé ou trop de demandes.`;
  return `${qui} n’a pas su répondre (code ${statut}).`;
}

async function appelHttp(qui: string, url: string, init: RequestInit): Promise<Response> {
  let r: Response;
  try { r = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) }); } catch {
    throw new Error(`${qui} est injoignable : rien n’a été produit.`);
  }
  if (!r.ok) throw new Error(refusHttp(qui, r.status));
  return r;
}

// ---------------------------------------------------------------------------
// The brain of the turn-by-turn engines
// ---------------------------------------------------------------------------

export type Bloc =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };
export type MessageCerveau = { role: 'user' | 'assistant'; content: Bloc[] };
export type ReponseCerveau = { texte: string; appels: AppelOutil[]; jetons_entree: number; jetons_sortie: number };

export interface Cerveau {
  repondre(systeme: string, messages: MessageCerveau[], outils: Outil[]): Promise<ReponseCerveau>;
}

export class CerveauAnthropic implements Cerveau {
  private readonly cle: string;
  private readonly base: string;
  constructor(cleApi: string, base: string) { this.cle = cleApi; this.base = base; }
  async repondre(systeme: string, messages: MessageCerveau[], outils: Outil[]): Promise<ReponseCerveau> {
    const r = await appelHttp('Le modèle de langage', `${this.base}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': this.cle, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELES.cerveau, max_tokens: 1024, system: systeme, messages,
        tools: outils.map((o) => ({ name: o.nom, description: o.description, input_schema: o.parametres })),
      }),
    });
    const v = (await r.json()) as { content?: Bloc[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const blocs = v.content ?? [];
    return {
      texte: blocs.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join(' ').trim(),
      appels: blocs.filter((b) => b.type === 'tool_use').map((b) => {
        const t = b as { id: string; name: string; input: Record<string, unknown> };
        return { id: t.id, nom: t.name, arguments: t.input ?? {} };
      }),
      jetons_entree: v.usage?.input_tokens ?? 0,
      jetons_sortie: v.usage?.output_tokens ?? 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Turn by turn: ear -> brain -> mouth
// ---------------------------------------------------------------------------

type Oreille = (pcm16k: Buffer, langue: string) => Promise<string>;
type Bouche = (texte: string, voix: string, langue: string) => Promise<{ pcm: Buffer; taux: number }>;

const TOURS_OUTILS_MAX = 5;

class SessionTourParTour implements SessionVoix {
  private readonly moteur: MoteurVoix;
  private readonly oreille: Oreille;
  private readonly bouche: Bouche;
  private readonly cerveau: Cerveau;
  private readonly outils: Outil[];
  private readonly langue: string;
  private voix: string;
  private systeme: string;
  private readonly file = new FileEvenements();
  private tampon: Buffer[] = [];
  private historique: MessageCerveau[] = [];
  private enCours: Promise<void> = Promise.resolve();
  private interrompu = false;
  private readonly enAttente = new Map<string, (r: string) => void>();
  private readonly debut = Date.now();
  private readonly m: Metriques;

  constructor(moteur: MoteurVoix, oreille: Oreille, bouche: Bouche, cerveau: Cerveau, o: OuvertureSession) {
    this.moteur = moteur; this.oreille = oreille; this.bouche = bouche; this.cerveau = cerveau;
    this.outils = o.outils; this.langue = o.langue; this.voix = o.voix;
    this.systeme = consigneDe(o.contexte);
    this.m = { moteur, duree_s: 0, secondes_audio_entree: 0, secondes_audio_sortie: 0, caracteres_synthetises: 0, jetons_entree: 0, jetons_sortie: 0, appels_outils: 0 };
  }

  async sendAudio(pcm: Buffer, o: { finDeTour?: boolean } = {}): Promise<void> {
    this.tampon.push(pcm);
    this.m.secondes_audio_entree += pcm.length / 32000;
    if (o.finDeTour) {
      const son = Buffer.concat(this.tampon); this.tampon = [];
      this.enCours = this.enCours.then(() => this.tour(son)).catch((e) => {
        this.file.pousser({ type: 'erreur', motif: e instanceof Error ? e.message : 'Le tour a échoué.' });
      });
    }
  }

  private async tour(son: Buffer): Promise<void> {
    this.interrompu = false;
    const entendu = (await this.oreille(son, this.langue)).trim();
    if (!entendu) { this.file.pousser({ type: 'fin-de-tour' }); return; }
    this.file.pousser({ type: 'transcription', qui: 'appelant', texte: entendu });
    this.historique.push({ role: 'user', content: [{ type: 'text', text: entendu }] });
    let texte = '';
    for (let i = 0; i < TOURS_OUTILS_MAX; i++) {
      const r = await this.cerveau.repondre(this.systeme, this.historique, this.outils);
      this.m.jetons_entree += r.jetons_entree; this.m.jetons_sortie += r.jetons_sortie;
      const blocs: Bloc[] = [];
      if (r.texte) blocs.push({ type: 'text', text: r.texte });
      for (const a of r.appels) blocs.push({ type: 'tool_use', id: a.id, name: a.nom, input: a.arguments });
      this.historique.push({ role: 'assistant', content: blocs });
      texte = r.texte;
      if (r.appels.length === 0) break;
      const resultats = await Promise.all(r.appels.map((a) => new Promise<string>((res) => {
        this.enAttente.set(a.id, res);
        this.file.pousser({ type: 'appel-outil', appel: a });
      })));
      this.historique.push({ role: 'user', content: r.appels.map((a, k) => ({ type: 'tool_result' as const, tool_use_id: a.id, content: resultats[k] })) });
    }
    if (texte && !this.interrompu) {
      const { pcm, taux } = await this.bouche(texte, this.voix, this.langue);
      this.m.caracteres_synthetises += texte.length;
      this.m.secondes_audio_sortie += pcm.length / (2 * taux);
      if (!this.interrompu) {
        this.file.pousser({ type: 'audio', pcm, taux });
        this.file.pousser({ type: 'transcription', qui: 'agent', texte });
      }
    }
    this.file.pousser({ type: 'fin-de-tour' });
  }

  receiveAudio(): AsyncIterable<EvenementVoix> { return this.file.iterer(); }
  async interrupt(): Promise<void> { this.interrompu = true; this.file.pousser({ type: 'interrompu' }); }
  async setVoice(voix: string): Promise<void> { this.voix = voix; }
  async sendContext(c: ContexteSession): Promise<void> { this.systeme = consigneDe(c); }
  async say(texte: string): Promise<void> {
    // Not pushed into the history (the brain's first message must be the caller's);
    // the instruction remembers it instead, so the agent does not greet twice.
    this.systeme += `\nTu as déjà dit à l’appelant : « ${texte} »`;
    this.enCours = this.enCours.then(async () => {
      this.interrompu = false;
      const { pcm, taux } = await this.bouche(texte, this.voix, this.langue);
      this.m.caracteres_synthetises += texte.length;
      this.m.secondes_audio_sortie += pcm.length / (2 * taux);
      if (!this.interrompu) {
        this.file.pousser({ type: 'audio', pcm, taux });
        this.file.pousser({ type: 'transcription', qui: 'agent', texte });
      }
      this.file.pousser({ type: 'fin-de-tour' });
    }).catch((e) => {
      this.file.pousser({ type: 'erreur', motif: e instanceof Error ? e.message : 'La phrase n’a pas pu être dite.' });
    });
  }
  async executeTool(appel: AppelOutil, executeur: Executeur): Promise<void> {
    this.m.appels_outils++;
    let r: unknown;
    try { r = await executeur(appel.nom, appel.arguments); } catch (e) { r = { refus: e instanceof Error ? e.message : 'refusé' }; }
    const res = this.enAttente.get(appel.id);
    this.enAttente.delete(appel.id);
    res?.(JSON.stringify(r ?? null));
  }
  async closeSession(): Promise<Metriques> {
    await this.enCours;
    this.file.fermer();
    this.m.duree_s = (Date.now() - this.debut) / 1000;
    return { ...this.m };
  }
}

function consigneDe(c: ContexteSession): string {
  return `${c.consigne}\nTu es ${c.agent}. Tu parles au téléphone ou à voix haute : phrases courtes, en français, sans liste ni balise.`;
}

// ---------------------------------------------------------------------------
// Gemini Live: one WebSocket
// ---------------------------------------------------------------------------

type MessageGemini = {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
    interrupted?: boolean; turnComplete?: boolean;
    inputTranscription?: { text?: string }; outputTranscription?: { text?: string };
  };
  toolCall?: { functionCalls?: { id: string; name: string; args?: Record<string, unknown> }[] };
  usageMetadata?: { promptTokenCount?: number; responseTokenCount?: number };
};

class SessionGemini implements SessionVoix {
  private readonly ws: WebSocket;
  private readonly file = new FileEvenements();
  private muet = false;
  private readonly debut = Date.now();
  private readonly m: Metriques;
  constructor(ws: WebSocket) {
    this.ws = ws;
    this.m = { moteur: 'gemini', duree_s: 0, secondes_audio_entree: 0, secondes_audio_sortie: 0, caracteres_synthetises: 0, jetons_entree: 0, jetons_sortie: 0, appels_outils: 0 };
  }

  static async ouvrir(url: string, o: OuvertureSession): Promise<SessionGemini> {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    const s = new SessionGemini(ws);
    await new Promise<void>((res, rej) => {
      const minuterie = setTimeout(() => { rej(new Error('Gemini Live ne répond pas à l’ouverture.')); try { ws.close(); } catch { /* closed */ } }, 10_000);
      let pret = false;
      ws.onopen = () => ws.send(JSON.stringify({
        setup: {
          model: `models/${MODELES.gemini}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: o.voix } } },
          },
          systemInstruction: { parts: [{ text: consigneDe(o.contexte) }] },
          tools: o.outils.length
            ? [{ functionDeclarations: o.outils.map((t) => ({ name: t.nom, description: t.description, parameters: t.parametres })) }]
            : [],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      }));
      ws.onmessage = (e) => {
        const m = s.lire(e.data);
        if (!pret && m?.setupComplete !== undefined) { pret = true; clearTimeout(minuterie); res(); return; }
        if (m) s.traiter(m);
      };
      // The URL carries the key: never echo the event or the URL.
      ws.onerror = () => { clearTimeout(minuterie); if (!pret) rej(new Error('Gemini Live est injoignable ou refuse la clé.')); else s.file.pousser({ type: 'erreur', motif: 'La liaison avec Gemini Live a échoué.' }); };
      ws.onclose = () => { clearTimeout(minuterie); if (!pret) rej(new Error('Gemini Live a fermé la session avant de l’ouvrir.')); s.file.fermer(); };
    });
    return s;
  }

  private lire(d: unknown): MessageGemini | null {
    try {
      const t = typeof d === 'string' ? d : new TextDecoder().decode(d as ArrayBuffer);
      return JSON.parse(t) as MessageGemini;
    } catch { return null; }
  }

  private traiter(m: MessageGemini): void {
    const c = m.serverContent;
    if (c?.inputTranscription?.text) this.file.pousser({ type: 'transcription', qui: 'appelant', texte: c.inputTranscription.text });
    for (const p of c?.modelTurn?.parts ?? []) {
      if (p.inlineData?.data && !this.muet) {
        const pcm = Buffer.from(p.inlineData.data, 'base64');
        this.m.secondes_audio_sortie += pcm.length / 48000;
        this.file.pousser({ type: 'audio', pcm, taux: 24000 });
      }
    }
    if (c?.outputTranscription?.text) this.file.pousser({ type: 'transcription', qui: 'agent', texte: c.outputTranscription.text });
    if (c?.interrupted) this.file.pousser({ type: 'interrompu' });
    if (c?.turnComplete) { this.muet = false; this.file.pousser({ type: 'fin-de-tour' }); }
    for (const f of m.toolCall?.functionCalls ?? []) this.file.pousser({ type: 'appel-outil', appel: { id: f.id, nom: f.name, arguments: f.args ?? {} } });
    if (m.usageMetadata) {
      this.m.jetons_entree += m.usageMetadata.promptTokenCount ?? 0;
      this.m.jetons_sortie += m.usageMetadata.responseTokenCount ?? 0;
    }
  }

  private envoyer(o: unknown): void {
    if (this.ws.readyState !== WebSocket.OPEN) throw new Error('La session Gemini Live est fermée.');
    this.ws.send(JSON.stringify(o));
  }

  async sendAudio(pcm: Buffer, o: { finDeTour?: boolean } = {}): Promise<void> {
    this.m.secondes_audio_entree += pcm.length / 32000;
    if (pcm.length) this.envoyer({ realtimeInput: { audio: { data: pcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } });
    if (o.finDeTour) this.envoyer({ realtimeInput: { audioStreamEnd: true } });
  }
  receiveAudio(): AsyncIterable<EvenementVoix> { return this.file.iterer(); }
  /** Gemini cuts itself when the caller speaks (its VAD); here we stop forwarding its audio until the turn ends. */
  async interrupt(): Promise<void> { this.muet = true; this.file.pousser({ type: 'interrompu' }); }
  async setVoice(): Promise<void> {
    throw new Error('Gemini Live fixe la voix à l’ouverture de la session : il faut en ouvrir une nouvelle pour en changer.');
  }
  async sendContext(c: ContexteSession): Promise<void> {
    this.envoyer({ clientContent: { turns: [{ role: 'user', parts: [{ text: `Contexte : ${consigneDe(c)}` }] }], turnComplete: false } });
  }
  async say(texte: string): Promise<void> {
    // Gemini Live speaks only what it generates: it is asked to repeat the sentence word for word.
    this.envoyer({ clientContent: { turns: [{ role: 'user', parts: [{ text: `Dis mot pour mot à l’appelant, sans rien ajouter : « ${texte} »` }] }], turnComplete: true } });
  }
  async executeTool(appel: AppelOutil, executeur: Executeur): Promise<void> {
    this.m.appels_outils++;
    let r: unknown;
    try { r = await executeur(appel.nom, appel.arguments); } catch (e) { r = { refus: e instanceof Error ? e.message : 'refusé' }; }
    this.envoyer({ toolResponse: { functionResponses: [{ id: appel.id, name: appel.nom, response: { resultat: r ?? null } }] } });
  }
  async closeSession(): Promise<Metriques> {
    try { this.ws.close(); } catch { /* already closed */ }
    this.file.fermer();
    this.m.duree_s = (Date.now() - this.debut) / 1000;
    return { ...this.m };
  }
}

// ---------------------------------------------------------------------------
// Ears and mouths
// ---------------------------------------------------------------------------

function oreilleElevenlabs(base: string, cleApi: string): Oreille {
  return async (pcm, langue) => {
    const f = new FormData();
    f.append('model_id', MODELES.elevenlabs_stt);
    f.append('file_format', 'pcm_s16le_16');
    f.append('language_code', langue);
    f.append('file', new Blob([new Uint8Array(pcm)]), 'tour.pcm');
    const r = await appelHttp('ElevenLabs (écoute)', `${base}/v1/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': cleApi }, body: f });
    return String(((await r.json()) as { text?: string }).text ?? '');
  };
}

function boucheElevenlabs(base: string, cleApi: string): Bouche {
  return async (texte, voix, langue) => {
    const r = await appelHttp('ElevenLabs (voix)', `${base}/v1/text-to-speech/${encodeURIComponent(voix)}?output_format=pcm_16000`, {
      method: 'POST',
      headers: { 'xi-api-key': cleApi, 'content-type': 'application/json' },
      body: JSON.stringify({ text: texte, model_id: MODELES.elevenlabs_tts, language_code: langue }),
    });
    return { pcm: Buffer.from(await r.arrayBuffer()), taux: 16000 };
  };
}

function oreilleMistral(base: string, cleApi: string): Oreille {
  return async (pcm, langue) => {
    const f = new FormData();
    f.append('model', MODELES.mistral_stt);
    f.append('language', langue);
    f.append('file', new Blob([new Uint8Array(wav(pcm, 16000))], { type: 'audio/wav' }), 'tour.wav');
    const r = await appelHttp('Mistral (écoute)', `${base}/v1/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${cleApi}` }, body: f });
    return String(((await r.json()) as { text?: string }).text ?? '');
  };
}

function boucheMistral(base: string, cleApi: string): Bouche {
  return async (texte, voix) => {
    const r = await appelHttp('Mistral (voix)', `${base}/v1/audio/speech`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cleApi}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODELES.mistral_tts, input: texte, voice_id: voix, response_format: 'wav' }),
    });
    const b64 = ((await r.json()) as { audio_data?: string }).audio_data;
    if (!b64) throw new Error('Mistral n’a rendu aucun son.');
    return lireWav(Buffer.from(b64, 'base64'));
  };
}

function lancer(binaire: string, args: string[], entree: string | null, qui: string): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn(binaire, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let erreur = '';
    p.stderr.on('data', (d) => { erreur = (erreur + d).slice(-300); });
    p.on('error', () => rej(new Error(`${qui} ne se lance pas : vérifiez le chemin du programme.`)));
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${qui} a échoué (code ${code}).`))));
    if (entree !== null) p.stdin.end(entree); else p.stdin.end();
  });
}

function oreilleLocale(env: Env): Oreille {
  return async (pcm, langue) => {
    const d = mkdtempSync(join(tmpdir(), 'iagent-ecoute-'));
    try {
      writeFileSync(join(d, 'tour.wav'), wav(pcm, 16000));
      await lancer(cle('whisper_binaire', env)!, ['-m', cle('whisper_modele', env)!, '-f', join(d, 'tour.wav'), '-l', langue, '-nt', '-otxt', '-of', join(d, 'tour')], null, 'L’écoute locale (whisper)');
      return readFileSync(join(d, 'tour.txt'), 'utf8');
    } finally { rmSync(d, { recursive: true, force: true }); }
  };
}

function boucheLocale(env: Env): Bouche {
  return async (texte, voix) => {
    if (!/^[A-Za-z0-9_.-]+$/.test(voix)) throw new Error('Nom de voix locale illisible.');
    const d = mkdtempSync(join(tmpdir(), 'iagent-voix-'));
    try {
      // The text goes through stdin, as in the Desktop: it comes from the caller.
      await lancer(cle('piper_binaire', env)!, ['--model', join(cle('piper_voix', env)!, `${voix}.onnx`), '--output_file', join(d, 'sortie.wav')], texte, 'La voix locale (Piper)');
      return lireWav(readFileSync(join(d, 'sortie.wav')));
    } finally { rmSync(d, { recursive: true, force: true }); }
  };
}

// ---------------------------------------------------------------------------
// The providers
// ---------------------------------------------------------------------------

export type DependancesVoix = { env: Env; bases: Bases; cerveau?: Cerveau | null };

function cerveauDe(d: DependancesVoix): Cerveau | null {
  if (d.cerveau) return d.cerveau;
  const k = cle('anthropic', d.env);
  return k ? new CerveauAnthropic(k, d.bases.anthropic) : null;
}

export function fournisseur(nom: MoteurVoix, d: DependancesVoix): VoiceProvider {
  const pour = `Parler avec ${FICHES[nom].libelle}`;
  const indisponible = (): string | null => {
    const k = nom === 'gemini' ? manque(['gemini'], d.env, pour)
      : nom === 'elevenlabs' ? manque(['elevenlabs'], d.env, pour)
      : nom === 'mistral' ? manque(['mistral'], d.env, pour)
      : manque(['piper_binaire', 'piper_voix', 'whisper_binaire', 'whisper_modele'], d.env, pour);
    if (k) return k;
    if (FICHES[nom].besoin_cerveau && !cerveauDe(d)) {
      return `${FICHES[nom].libelle} n’entend et ne parle que : il faut aussi un modèle de langage (ANTHROPIC_API_KEY). Rien n’a été envoyé.`;
    }
    return null;
  };
  return {
    nom,
    indisponible,
    async startSession(o: OuvertureSession): Promise<SessionVoix> {
      const motif = indisponible();
      if (motif) throw new Error(motif);
      if (nom === 'gemini') return SessionGemini.ouvrir(`${d.bases.gemini}?key=${encodeURIComponent(cle('gemini', d.env)!)}`, o);
      const cerveau = cerveauDe(d)!;
      if (nom === 'elevenlabs') {
        const k = cle('elevenlabs', d.env)!;
        return new SessionTourParTour(nom, oreilleElevenlabs(d.bases.elevenlabs, k), boucheElevenlabs(d.bases.elevenlabs, k), cerveau, o);
      }
      if (nom === 'mistral') {
        const k = cle('mistral', d.env)!;
        return new SessionTourParTour(nom, oreilleMistral(d.bases.mistral, k), boucheMistral(d.bases.mistral, k), cerveau, o);
      }
      return new SessionTourParTour(nom, oreilleLocale(d.env), boucheLocale(d.env), cerveau, o);
    },
  };
}

export function disponibilites(d: DependancesVoix): Record<MoteurVoix, string | null> {
  return {
    gemini: fournisseur('gemini', d).indisponible(),
    elevenlabs: fournisseur('elevenlabs', d).indisponible(),
    mistral: fournisseur('mistral', d).indisponible(),
    local: fournisseur('local', d).indisponible(),
  };
}
