// Fakes for the voice bench, written by hand on 127.0.0.1: an operator (Telnyx,
// Twilio, SIP gateway), the turn-by-turn engines (ElevenLabs, Mistral, the
// Anthropic brain) and Gemini Live over a real WebSocket (handshake and frames
// of RFC 6455, no library). They record what they receive: the bench checks
// bytes and headers, not an imitation of the adapters.
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { wav } from './fournisseurs-voix.ts';

export type Recu = { methode: string; chemin: string; entetes: Record<string, string>; corps: string };

async function lireCorps(req: IncomingMessage): Promise<string> {
  const m: Buffer[] = [];
  for await (const x of req) m.push(x as Buffer);
  return Buffer.concat(m).toString('utf8');
}

function entetes(req: IncomingMessage): Record<string, string> {
  const e: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') e[k] = v;
  return e;
}

export async function ecouter(s: Server): Promise<string> {
  await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
}

// --- The operator ------------------------------------------------------------

export function fauxOperateur() {
  const recus: Recu[] = [];
  let n = 0;
  const serveur = createServer(async (req, res) => {
    const corps = await lireCorps(req);
    const chemin = req.url ?? '/';
    recus.push({ methode: req.method ?? '', chemin, entetes: entetes(req), corps });
    const json = (o: unknown, statut = 200) => { res.writeHead(statut, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (chemin === '/v2/calls') return json({ data: { call_control_id: `v3:faux-${++n}`, call_leg_id: 'x', record_type: 'call' } });
    if (/^\/v2\/calls\/[^/]+\/actions\//.test(chemin)) return json({ data: { result: 'ok' } });
    if (/^\/2010-04-01\/Accounts\/[^/]+\/Calls\.json$/.test(chemin)) return json({ sid: `CAfaux${++n}`, status: 'queued' }, 201);
    if (/^\/2010-04-01\/Accounts\/[^/]+\/Calls\/[^/]+\.json$/.test(chemin)) return json({ sid: 'x', status: 'in-progress' });
    if (chemin === '/sip/appels') return json({ id: `sip-${++n}` });
    if (chemin.startsWith('/sip/appels/')) return json({});
    json({ erreur: 'inconnu' }, 404);
  });
  return { serveur, recus };
}

// --- Turn-by-turn engines and the brain ----------------------------------------

/** What the caller "says" on each turn, by order of the transcription requests. */
export function fauxMoteurs(paroles: string[]) {
  const recus: Recu[] = [];
  let tourStt = 0;
  const serveur = createServer(async (req, res) => {
    const corps = await lireCorps(req);
    const chemin = req.url ?? '/';
    recus.push({ methode: req.method ?? '', chemin, entetes: entetes(req), corps });
    const json = (o: unknown) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (chemin === '/v1/speech-to-text' || chemin === '/v1/audio/transcriptions') return json({ text: paroles[tourStt++] ?? '' });
    if (chemin.startsWith('/v1/text-to-speech/')) { res.writeHead(200, { 'content-type': 'audio/pcm' }); return res.end(Buffer.alloc(3200)); }
    if (chemin === '/v1/audio/speech') return json({ audio_data: wav(Buffer.alloc(4800), 24000).toString('base64') });
    if (chemin === '/v1/messages') {
      const v = JSON.parse(corps) as { messages: { role: string; content: { type: string; text?: string }[] }[] };
      const dernier = v.messages[v.messages.length - 1].content;
      if (dernier.some((b) => b.type === 'tool_result')) return json({ content: [{ type: 'text', text: 'Très bien.' }], usage: { input_tokens: 200, output_tokens: 10 } });
      const texte = dernier.map((b) => b.text ?? '').join(' ').toLowerCase();
      const outil = decider(texte);
      return json({
        content: outil ? [{ type: 'tool_use', id: `toolu_${Math.random().toString(36).slice(2)}`, name: outil.nom, input: outil.args }] : [{ type: 'text', text: 'Je vous écoute.' }],
        usage: { input_tokens: 300, output_tokens: 20 },
      });
    }
    res.writeHead(404); res.end();
  });
  return { serveur, recus };
}

/** The same "intent" for every engine: that is what makes the comparison fair. */
export function decider(texte: string): { nom: string; args: Record<string, unknown> } | null {
  if (texte.includes('comptabilit')) return { nom: 'transferer_vers', args: { destination: 'comptabilite' } };
  if (texte.includes('quelqu')) return { nom: 'demander_un_humain', args: { motif: 'litige sur une facture', resume: 'Client mécontent de la facture de septembre.' } };
  return null;
}

// --- Gemini Live over a real WebSocket -------------------------------------------

function trame(texte: string): Buffer {
  const p = Buffer.from(texte, 'utf8');
  const h = p.length < 126 ? Buffer.from([0x81, p.length])
    : p.length < 65536 ? Buffer.from([0x81, 126, p.length >> 8, p.length & 255])
    : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(p.length), 2); return b; })();
  return Buffer.concat([h, p]);
}

/** Splits client frames (masked, RFC 6455 §5.2). Returns texts and the unread rest. */
function lireTrames(tampon: Buffer): { textes: string[]; reste: Buffer; ferme: boolean } {
  const textes: string[] = []; let i = 0; let ferme = false;
  while (tampon.length - i >= 2) {
    const op = tampon[i] & 0x0f; const masque = (tampon[i + 1] & 0x80) !== 0; let n = tampon[i + 1] & 0x7f; let j = i + 2;
    if (n === 126) { if (tampon.length < j + 2) break; n = tampon.readUInt16BE(j); j += 2; }
    else if (n === 127) { if (tampon.length < j + 8) break; n = Number(tampon.readBigUInt64BE(j)); j += 8; }
    const cleM = masque ? tampon.subarray(j, j + 4) : null; if (masque) j += 4;
    if (tampon.length < j + n) break;
    const p = Buffer.from(tampon.subarray(j, j + n));
    if (cleM) for (let k = 0; k < p.length; k++) p[k] ^= cleM[k % 4];
    if (op === 1) textes.push(p.toString('utf8'));
    if (op === 8) ferme = true;
    i = j + n;
  }
  return { textes, reste: tampon.subarray(i), ferme };
}

export function fauxGemini(paroles: string[], cleAttendue: string) {
  const recus: { url: string; messages: Record<string, unknown>[] } = { url: '', messages: [] };
  const serveur = createServer((_q, r) => { r.writeHead(426); r.end(); });
  serveur.on('upgrade', (req: IncomingMessage, sock: Duplex) => {
    recus.url = req.url ?? '';
    const k = new URL(req.url ?? '/', 'http://x').searchParams.get('key');
    if (k !== cleAttendue) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const accept = createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const envoyer = (o: unknown) => sock.write(trame(JSON.stringify(o)));
    let tampon = Buffer.alloc(0); let tour = 0; let n = 0;
    sock.on('data', (d: Buffer) => {
      const r = lireTrames(Buffer.concat([tampon, d])); tampon = Buffer.from(r.reste);
      for (const t of r.textes) {
        const m = JSON.parse(t) as Record<string, any>;
        recus.messages.push(m);
        if (m.setup) envoyer({ setupComplete: {} });
        if (m.realtimeInput?.audioStreamEnd) {
          const dit = paroles[tour++] ?? '';
          envoyer({ serverContent: { inputTranscription: { text: dit } } });
          const outil = decider(dit.toLowerCase());
          if (outil) envoyer({ toolCall: { functionCalls: [{ id: `g${++n}`, name: outil.nom, args: outil.args }] } });
          else envoyer({ serverContent: { turnComplete: true } });
        }
        if (m.toolResponse) {
          envoyer({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: Buffer.alloc(4800).toString('base64') } }] }, outputTranscription: { text: 'Très bien.' } } });
          envoyer({ serverContent: { turnComplete: true }, usageMetadata: { promptTokenCount: 50, responseTokenCount: 5 } });
        }
      }
      if (r.ferme) sock.end();
    });
    sock.on('error', () => {});
  });
  return { serveur, recus };
}
