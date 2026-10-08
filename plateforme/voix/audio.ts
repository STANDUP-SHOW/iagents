// Sound on a phone line: G.711 μ-law at 8 kHz (the only format both Twilio
// Media Streams and Telnyx PCMU send), against the 16 kHz PCM the voice engines
// hear and the 16/22.05/24 kHz PCM they speak. Pure functions, no library.
//
// μ-law follows ITU-T G.711 as the reference C implementation writes it (bias
// 0x84, clip 32635, bits inverted on the wire); the bench checks that decoding
// then re-encoding every one of the 256 codes gives the same code back.

const BIAIS = 0x84;
const PLAFOND = 32635;

export function encoderUlaw(echantillon: number): number {
  let s = Math.max(-32768, Math.min(32767, Math.round(echantillon)));
  const signe = s < 0 ? 0x80 : 0;
  if (s < 0) s = -s;
  if (s > PLAFOND) s = PLAFOND;
  s += BIAIS;
  let exposant = 7;
  for (let m = 0x4000; (s & m) === 0 && exposant > 0; m >>= 1) exposant--;
  const mantisse = (s >> (exposant + 3)) & 0x0f;
  return ~(signe | (exposant << 4) | mantisse) & 0xff;
}

export function decoderUlaw(octet: number): number {
  const u = ~octet & 0xff;
  const signe = u & 0x80;
  const exposant = (u >> 4) & 0x07;
  const mantisse = u & 0x0f;
  const s = (((mantisse << 3) + BIAIS) << exposant) - BIAIS;
  return signe ? -s : s;
}

/** μ-law bytes → 16-bit little-endian PCM at the same rate. */
export function ulawVersPcm(ulaw: Buffer): Buffer {
  const pcm = Buffer.alloc(ulaw.length * 2);
  for (let i = 0; i < ulaw.length; i++) pcm.writeInt16LE(decoderUlaw(ulaw[i]), i * 2);
  return pcm;
}

export function pcmVersUlaw(pcm: Buffer): Buffer {
  const n = pcm.length >> 1;
  const u = Buffer.alloc(n);
  for (let i = 0; i < n; i++) u[i] = encoderUlaw(pcm.readInt16LE(i * 2));
  return u;
}

/**
 * Changes the rate of 16-bit mono PCM. Going down, each output sample is the
 * mean of the input samples it covers (a box filter: crude, but it keeps the
 * 8 kHz line from folding the 8-12 kHz of a 24 kHz voice back as hiss); going
 * up, linear interpolation.
 */
export function reechantillonner(pcm: Buffer, de: number, vers: number): Buffer {
  if (de === vers) return Buffer.from(pcm);
  const n = pcm.length >> 1;
  if (n === 0) return Buffer.alloc(0);
  const lire = (i: number) => pcm.readInt16LE(Math.max(0, Math.min(n - 1, i)) * 2);
  const m = Math.max(1, Math.round((n * vers) / de));
  const sortie = Buffer.alloc(m * 2);
  const pas = de / vers;
  for (let k = 0; k < m; k++) {
    let v: number;
    if (vers < de) {
      const debut = Math.floor(k * pas); const fin = Math.max(debut + 1, Math.floor((k + 1) * pas));
      let somme = 0; for (let i = debut; i < fin; i++) somme += lire(i);
      v = somme / (fin - debut);
    } else {
      const x = k * pas; const i = Math.floor(x); const f = x - i;
      v = lire(i) * (1 - f) + lire(i + 1) * f;
    }
    sortie.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), k * 2);
  }
  return sortie;
}

/** Root mean square of 16-bit PCM. */
export function energie(pcm: Buffer): number {
  const n = pcm.length >> 1;
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) { const v = pcm.readInt16LE(i * 2); s += v * v; }
  return Math.sqrt(s / n);
}

// ---------------------------------------------------------------------------
// Who is speaking: an energy detector on 20 ms frames
// ---------------------------------------------------------------------------

export type ReglagesTours = {
  /** Minimum RMS of a speech frame, whatever the line noise (μ-law silence decodes to about 0, a breath to a few hundred). */
  seuil_min: number;
  /** A frame is speech when it is this many times above the measured noise floor. */
  facteur_bruit: number;
  /** Speech this long at least before a turn counts (a cough or a click is not a turn). */
  parole_min_ms: number;
  /** Silence this long after speech closes the caller's turn. */
  silence_fin_ms: number;
  /** Audio kept from just before speech starts, so the first syllable is not cut. */
  avant_ms: number;
  /** A turn longer than this is closed anyway: the engines bill by the second and whisper has a window. */
  tour_max_ms: number;
};

export const REGLAGES_TOURS: ReglagesTours = {
  seuil_min: 600, facteur_bruit: 3, parole_min_ms: 200, silence_fin_ms: 700, avant_ms: 200, tour_max_ms: 30_000,
};

export type SortieTours =
  | { type: 'debut' }
  | { type: 'son'; pcm: Buffer }
  | { type: 'fin' };

/**
 * Cuts a stream of 16-bit PCM into caller turns. `pousser` takes any length;
 * frames are 20 ms at the given rate. Before a turn starts nothing is forwarded
 * (silence costs money at every engine); once it starts, the pre-roll and then
 * every frame go out, and `fin` closes it.
 */
export class DetecteurTours {
  private readonly r: ReglagesTours;
  private readonly octetsTrame: number;
  private reste = Buffer.alloc(0);
  private bruit = 0;
  private avant: Buffer[] = [];
  private enParole = false;
  private parleMs = 0;
  private silenceMs = 0;
  private tourMs = 0;
  private confirme = false;

  constructor(taux: number, r: ReglagesTours = REGLAGES_TOURS) {
    this.r = r;
    this.octetsTrame = Math.round(taux * 0.02) * 2;
  }

  pousser(pcm: Buffer): SortieTours[] {
    const sorties: SortieTours[] = [];
    let b = this.reste.length ? Buffer.concat([this.reste, pcm]) : pcm;
    while (b.length >= this.octetsTrame) {
      const trame = b.subarray(0, this.octetsTrame);
      b = b.subarray(this.octetsTrame);
      this.trame(Buffer.from(trame), sorties);
    }
    this.reste = Buffer.from(b);
    return sorties;
  }

  /** True while a turn is open (the caller is speaking or has just stopped). */
  get parle(): boolean { return this.enParole; }

  private trame(t: Buffer, sorties: SortieTours[]): void {
    const e = energie(t);
    const seuil = Math.max(this.r.seuil_min, this.bruit * this.r.facteur_bruit);
    const voix = e >= seuil;
    if (!this.enParole) {
      // The noise floor only learns from frames that are not speech.
      if (!voix) this.bruit = this.bruit === 0 ? e : this.bruit * 0.95 + e * 0.05;
      this.avant.push(t);
      while (this.avant.length * 20 > this.r.avant_ms + this.r.parole_min_ms) this.avant.shift();
      if (!voix) { this.parleMs = 0; return; }
      this.parleMs += 20;
      if (this.parleMs < this.r.parole_min_ms) return;
      this.enParole = true; this.confirme = true; this.silenceMs = 0; this.tourMs = this.avant.length * 20;
      sorties.push({ type: 'debut' }, { type: 'son', pcm: Buffer.concat(this.avant) });
      this.avant = [];
      return;
    }
    sorties.push({ type: 'son', pcm: t });
    this.tourMs += 20;
    this.silenceMs = voix ? 0 : this.silenceMs + 20;
    if (this.silenceMs >= this.r.silence_fin_ms || this.tourMs >= this.r.tour_max_ms) {
      this.enParole = false; this.parleMs = 0; this.silenceMs = 0; this.tourMs = 0;
      if (this.confirme) sorties.push({ type: 'fin' });
      this.confirme = false;
    }
  }
}
