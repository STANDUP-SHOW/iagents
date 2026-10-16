/**
 * The live conversation, screen side (`direct.rs` holds the line to Gemini).
 *
 * The screen captures the microphone and plays the answer because the web
 * view cancels the echo of what it plays itself: through the PC's speakers
 * the agent would otherwise hear its own voice and answer it. Rust never
 * hands the Google key over; only sound and words cross.
 *
 * The microphone is cut into tenths of a second, 16-bit PCM at 16 kHz, and
 * sent as it comes: Gemini hears the client while he speaks, decides itself
 * when he has finished, and stops talking when he talks over it.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

/** What `direct.rs` emits on the `direct` event; field names are Rust's.
 * `ligne` says which line it comes from. */
export type EvenementDirect = { ligne: number } & (
  | { quoi: 'pret' }
  | { quoi: 'son'; donnees: string; taux: number }
  | { quoi: 'coupe' }
  | { quoi: 'entendu'; texte: string }
  | { quoi: 'dit'; texte: string }
  | { quoi: 'tour-fini' }
  | { quoi: 'conge' }
  | { quoi: 'autre'; prenom: string; demande: string }
  | { quoi: 'fin'; motif: string | null }
)

export interface Ecouteurs {
  /** What the client has said in this turn so far. */
  entendu: (texte: string) => void
  /** What the agent has said in this turn so far. */
  dit: (texte: string) => void
  /** True while the agent's voice is playing. */
  parle: (oui: boolean) => void
  /** One exchange is over: what the client said, what the agent answered. */
  echange: (client: string, agent: string) => void
  /** The client called another agent: this line closes, that one is asked. */
  autre: (prenom: string, demande: string) => void
  /** The conversation is over; `motif` says why when it was not asked for. */
  fin: (motif: string | null) => void
}

/** Silence after which the conversation closes, as in the listening loop. */
const SILENCE_QUI_FERME_MS = 60_000
const TAUX_MICRO = 16_000
const ECHANTILLONS_PAR_ENVOI = TAUX_MICRO / 10

/** Turns the microphone's float samples into what Gemini takes. */
export function enPcm16Base64(echantillons: Float32Array): string {
  const octets = new Uint8Array(echantillons.length * 2)
  const vue = new DataView(octets.buffer)
  for (let i = 0; i < echantillons.length; i++) {
    const s = Math.max(-1, Math.min(1, echantillons[i]))
    vue.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  let binaire = ''
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  }
  return btoa(binaire)
}

/** What Gemini sends back, as float samples to play. */
export function dePcm16Base64(donnees: string): Float32Array<ArrayBuffer> {
  const binaire = atob(donnees)
  const n = Math.floor(binaire.length / 2)
  const sortie = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let v = binaire.charCodeAt(2 * i) | (binaire.charCodeAt(2 * i + 1) << 8)
    if (v >= 0x8000) v -= 0x10000
    sortie[i] = v / 0x8000
  }
  return sortie
}

// The worklet copies what the microphone hears out of the audio thread. A
// Blob URL, because the bundler does not know about worklet modules.
const CAPTURE = `
class Capture extends AudioWorkletProcessor {
  process(entrees) {
    const voie = entrees[0] && entrees[0][0]
    if (voie) this.port.postMessage(voie.slice(0))
    return true
  }
}
registerProcessor('iagent-capture', Capture)
`

export class ConversationDirecte {
  private ecouteurs: Ecouteurs
  private arreter: UnlistenFn | null = null
  private flux: MediaStream | null = null
  private micro: AudioContext | null = null
  private haut: AudioContext | null = null
  private enAttente: Float32Array[] = []
  private enAttenteLongueur = 0
  private sources = new Set<AudioBufferSourceNode>()
  private prochain = 0
  private client = ''
  private agent = ''
  private minuterie: ReturnType<typeof setTimeout> | null = null
  private fermee = false
  private ligne: number | null = null
  /** Events that arrive before Rust has told which line is ours. */
  private avant: EvenementDirect[] = []
  /** The client said goodbye: close once the agent has finished speaking. */
  private partir = false

  constructor(ecouteurs: Ecouteurs) {
    this.ecouteurs = ecouteurs
  }

  /**
   * Opens the line for `prenom`. Rejects with Rust's reason when it cannot
   * (no key, no internet, microphone refused): the caller then answers
   * through the relay.
   */
  async ouvrir(prenom: string, ficheId: string, consigne: string, demande: string): Promise<void> {
    this.arreter = await listen<EvenementDirect>('direct', (e) => this.recevoir(e.payload))
    try {
      // The microphone first: if the client refuses it, no line is opened
      // for nothing.
      this.flux = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      this.haut = new AudioContext({ sampleRate: 24_000 })
      this.ligne = await invoke<number>('direct_ouvrir', { prenom, ficheId, consigne, demande })
      for (const e of this.avant.splice(0)) this.recevoir(e)
      await this.capter()
      this.attendre()
    } catch (err) {
      await this.liberer()
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  /** Closes the conversation (the client said goodbye, or called another agent). */
  async fermer(): Promise<void> {
    if (this.fermee) return
    if (this.ligne !== null) await invoke('direct_fermer', { ligne: this.ligne }).catch(() => {})
    await this.liberer()
    this.ecouteurs.fin(null)
  }

  private async capter() {
    // At 16 kHz the browser resamples the microphone itself.
    this.micro = new AudioContext({ sampleRate: TAUX_MICRO })
    const url = URL.createObjectURL(new Blob([CAPTURE], { type: 'application/javascript' }))
    try {
      await this.micro.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    const source = this.micro.createMediaStreamSource(this.flux!)
    const noeud = new AudioWorkletNode(this.micro, 'iagent-capture')
    noeud.port.onmessage = (e: MessageEvent<Float32Array>) => this.empiler(e.data)
    source.connect(noeud)
  }

  private empiler(morceau: Float32Array) {
    if (this.fermee) return
    this.enAttente.push(morceau)
    this.enAttenteLongueur += morceau.length
    if (this.enAttenteLongueur < ECHANTILLONS_PAR_ENVOI) return
    const tout = new Float32Array(this.enAttenteLongueur)
    let i = 0
    for (const m of this.enAttente) {
      tout.set(m, i)
      i += m.length
    }
    this.enAttente = []
    this.enAttenteLongueur = 0
    invoke('direct_son', { donnees: enPcm16Base64(tout) }).catch(() => {})
  }

  private recevoir(e: EvenementDirect) {
    if (this.ligne === null) {
      this.avant.push(e)
      return
    }
    if (e.ligne !== this.ligne) return
    switch (e.quoi) {
      case 'son':
        this.jouer(e.donnees, e.taux)
        break
      case 'coupe':
        this.taire()
        break
      case 'entendu':
        this.client += e.texte
        this.ecouteurs.entendu(this.client.trim())
        this.attendre()
        break
      case 'dit':
        this.agent += e.texte
        this.ecouteurs.dit(this.agent.trim())
        break
      case 'tour-fini':
        if (this.client.trim() || this.agent.trim()) this.ecouteurs.echange(this.client.trim(), this.agent.trim())
        this.client = ''
        this.agent = ''
        this.attendre()
        break
      case 'conge':
        this.partir = true
        if (!this.sources.size) void this.fermer()
        break
      case 'autre':
        void this.fermer().then(() => this.ecouteurs.autre(e.prenom, e.demande))
        break
      case 'fin':
        if (!this.fermee) {
          // Rust has dropped the line; the listening state goes back to sleep.
          void invoke('direct_fermer', { ligne: this.ligne })
            .catch(() => {})
            .then(() => this.liberer())
            .then(() => this.ecouteurs.fin(e.motif))
        }
        break
    }
  }

  private jouer(donnees: string, taux: number) {
    const haut = this.haut
    if (!haut || this.fermee) return
    const echantillons = dePcm16Base64(donnees)
    if (!echantillons.length) return
    const tampon = haut.createBuffer(1, echantillons.length, taux)
    tampon.copyToChannel(echantillons, 0)
    const source = haut.createBufferSource()
    source.buffer = tampon
    source.connect(haut.destination)
    const debut = Math.max(haut.currentTime, this.prochain)
    source.start(debut)
    this.prochain = debut + tampon.duration
    if (!this.sources.size) this.ecouteurs.parle(true)
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      if (!this.sources.size) {
        this.ecouteurs.parle(false)
        if (this.partir) void this.fermer()
        else this.attendre()
      }
    }
  }

  /** The client talks over the agent: everything queued stops now. */
  private taire() {
    for (const s of this.sources) {
      s.onended = null
      try {
        s.stop()
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear()
    this.prochain = 0
    this.ecouteurs.parle(false)
  }

  /** Closes after a minute of silence, counted from the last thing said. */
  private attendre() {
    if (this.minuterie) clearTimeout(this.minuterie)
    this.minuterie = setTimeout(() => {
      if (this.sources.size) return this.attendre()
      void this.fermer()
    }, SILENCE_QUI_FERME_MS)
  }

  private async liberer() {
    this.fermee = true
    if (this.minuterie) clearTimeout(this.minuterie)
    this.arreter?.()
    this.arreter = null
    this.taire()
    this.flux?.getTracks().forEach((t) => t.stop())
    this.flux = null
    await this.micro?.close().catch(() => {})
    await this.haut?.close().catch(() => {})
    this.micro = null
    this.haut = null
  }
}
