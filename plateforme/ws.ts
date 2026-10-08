// Server side of a WebSocket (RFC 6455), without a library, for the operators'
// media streams (Twilio Media Streams, Telnyx media streaming). Only what those
// streams use: text messages, ping/pong, close. Read from the RFC itself
// (https://www.rfc-editor.org/rfc/rfc6455, §1.3 handshake, §5.2 framing, §5.3
// masking, §5.4 fragmentation, §5.5 control frames).
//
// Three refusals held here, not by the caller: a client frame that is not
// masked closes the connection (§5.1 says the server MUST); a message larger
// than `MESSAGE_MAX` closes it (a media frame is a few kilobytes, a flood is
// not); a binary message is refused (both operators speak JSON text).
import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const MESSAGE_MAX = 1024 * 1024;

export function cleAcceptation(cle: string): string {
  return createHash('sha1').update(cle + GUID).digest('base64');
}

/** Refuses an upgrade with a plain HTTP answer: the socket is closed, nothing is upgraded. */
export function refuserUpgrade(sock: Duplex, statut: number, message: string): void {
  const corps = Buffer.from(JSON.stringify({ erreur: message }), 'utf8');
  const texte = statut === 401 ? 'Unauthorized' : statut === 404 ? 'Not Found' : statut === 409 ? 'Conflict' : 'Bad Request';
  try {
    sock.end(`HTTP/1.1 ${statut} ${texte}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${corps.length}\r\nConnection: close\r\n\r\n${corps.toString('utf8')}`);
  } catch { /* already gone */ }
}

export function trameServeur(op: number, charge: Buffer): Buffer {
  const n = charge.length;
  const h = n < 126 ? Buffer.from([0x80 | op, n])
    : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255])
    : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | op; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([h, charge]);
}

export type ConnexionWs = {
  envoyer(texte: string): void;
  fermer(code?: number, raison?: string): void;
  readonly ouverte: boolean;
  surMessage: (texte: string) => void;
  surFermeture: (code: number) => void;
};

/**
 * Accepts the upgrade if the request is a valid WebSocket handshake; null (and
 * the socket refused) otherwise. `tete` is what Node already read past the
 * headers, part of the first frame when the client did not wait.
 */
export function accepter(req: IncomingMessage, sock: Duplex, tete: Buffer): ConnexionWs | null {
  const cle = String(req.headers['sec-websocket-key'] ?? '');
  const version = String(req.headers['sec-websocket-version'] ?? '');
  if (String(req.headers.upgrade ?? '').toLowerCase() !== 'websocket' || !cle || Buffer.from(cle, 'base64').length !== 16 || version !== '13') {
    refuserUpgrade(sock, 400, 'Poignée de main WebSocket invalide.');
    return null;
  }
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${cleAcceptation(cle)}\r\n\r\n`);

  let ouverte = true;
  let tampon = Buffer.alloc(0);
  let fragments: Buffer[] = [];
  let tailleFragments = 0;
  let enTexte = false;
  const c: ConnexionWs = {
    envoyer(texte) { if (ouverte) sock.write(trameServeur(0x1, Buffer.from(texte, 'utf8'))); },
    fermer(code = 1000, raison = '') {
      if (!ouverte) return;
      ouverte = false;
      const r = Buffer.from(raison, 'utf8').subarray(0, 120);
      const p = Buffer.alloc(2 + r.length); p.writeUInt16BE(code, 0); r.copy(p, 2);
      try { sock.end(trameServeur(0x8, p)); } catch { /* gone */ }
      c.surFermeture(code);
    },
    get ouverte() { return ouverte; },
    surMessage: () => {},
    surFermeture: () => {},
  };
  // The close frame is flushed by `end`; a peer that never closes its side is cut a second later.
  const couper = (code: number, raison: string) => { c.fermer(code, raison); setTimeout(() => sock.destroy(), 1000).unref(); };

  const lire = () => {
    while (ouverte && tampon.length >= 2) {
      const fin = (tampon[0] & 0x80) !== 0;
      const op = tampon[0] & 0x0f;
      const masque = (tampon[1] & 0x80) !== 0;
      let n = tampon[1] & 0x7f;
      let j = 2;
      if (n === 126) { if (tampon.length < 4) return; n = tampon.readUInt16BE(2); j = 4; }
      else if (n === 127) {
        if (tampon.length < 10) return;
        const grand = tampon.readBigUInt64BE(2);
        if (grand > BigInt(MESSAGE_MAX)) return couper(1009, 'message trop gros');
        n = Number(grand); j = 10;
      }
      if (!masque) return couper(1002, 'trame non masquée');
      if (n > MESSAGE_MAX) return couper(1009, 'message trop gros');
      if (tampon.length < j + 4 + n) return;
      const m = tampon.subarray(j, j + 4);
      const p = Buffer.from(tampon.subarray(j + 4, j + 4 + n));
      for (let k = 0; k < p.length; k++) p[k] ^= m[k & 3];
      tampon = tampon.subarray(j + 4 + n);

      if (op >= 0x8) {
        // Control frames: never fragmented, 125 bytes at most (§5.5).
        if (!fin || n > 125) return couper(1002, 'trame de contrôle invalide');
        if (op === 0x8) { c.fermer(p.length >= 2 ? p.readUInt16BE(0) : 1000); return; }
        if (op === 0x9) sock.write(trameServeur(0xa, p));
        continue;
      }
      if (op === 0x2) return couper(1003, 'messages binaires refusés');
      if (op === 0x1) { if (fragments.length) return couper(1002, 'fragment inattendu'); enTexte = true; }
      else if (op === 0x0) { if (!enTexte) return couper(1002, 'suite sans début'); }
      else return couper(1002, 'code inconnu');
      fragments.push(p); tailleFragments += p.length;
      if (tailleFragments > MESSAGE_MAX) return couper(1009, 'message trop gros');
      if (fin) {
        const texte = Buffer.concat(fragments).toString('utf8');
        fragments = []; tailleFragments = 0; enTexte = false;
        try { c.surMessage(texte); } catch { /* a handler's fault never kills the socket */ }
      }
    }
  };
  sock.on('data', (d: Buffer) => { tampon = Buffer.concat([tampon, d]); lire(); });
  sock.on('close', () => { if (ouverte) { ouverte = false; c.surFermeture(1006); } });
  sock.on('error', () => { /* close follows */ });
  if (tete.length) { tampon = Buffer.from(tete); queueMicrotask(lire); }
  return c;
}
