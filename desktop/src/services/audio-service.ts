/**
 * Service pour gérer STT (Speech-to-Text) et TTS (Text-to-Speech)
 */

import conversationSettings from '../config/conversation-settings.json';

export interface AudioConfig {
  provider: string;
  model?: string;
  language?: string;
  api_key?: string;
  voice_id?: string;
  speed?: number;
  stability?: number;
  similarity_boost?: number;
}

export class AudioService {
  private ttsConfig: AudioConfig;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.ttsConfig = conversationSettings.tts.primary;
    this.initAudioContext();
  }

  private initAudioContext(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    } catch (e) {
      console.error('AudioContext not supported:', e);
    }
  }

  /**
   * Enregistre l'audio du microphone
   */
  async recordAudio(durationMs: number): Promise<Float32Array> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      return new Promise((resolve) => {
        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioData = new Float32Array(arrayBuffer);
          resolve(audioData);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), durationMs);
      });
    } catch (error) {
      console.error('Erreur enregistrement audio:', error);
      throw error;
    }
  }

  /**
   * Convertit l'audio en texte (STT) avec Whisper
   */
  async transcribeAudio(
    audioData: ArrayBuffer | Blob,
    language: string = 'fr'
  ): Promise<string> {
    try {
      // Fallback: utilise Whisper API (OpenAI)
      const formData = new FormData();
      formData.append('file', new Blob([audioData], { type: 'audio/wav' }), 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', language);

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Erreur transcription:', error);
      throw error;
    }
  }

  /**
   * Convertit le texte en audio (TTS) avec ElevenLabs
   */
  async synthesizeAudio(
    text: string,
    voiceId: string,
    ttsConfig?: Partial<AudioConfig>
  ): Promise<ArrayBuffer> {
    try {
      const config = { ...this.ttsConfig, ...ttsConfig };

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': process.env.REACT_APP_ELEVENLABS_API_KEY || '',
          },
          body: JSON.stringify({
            text,
            model_id: config.model || 'eleven_monolingual_v1',
            voice_settings: {
              stability: config.stability || 0.75,
              similarity_boost: config.similarity_boost || 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      return response.arrayBuffer();
    } catch (error) {
      console.error('Erreur synthèse vocale:', error);
      throw error;
    }
  }

  /**
   * Joue l'audio synthétisé
   */
  async playAudio(audioBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.audioContext) {
          throw new Error('AudioContext not initialized');
        }

        this.audioContext.decodeAudioData(
          audioBuffer,
          (decodedBuffer) => {
            const source = this.audioContext!.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(this.audioContext!.destination);

            source.onended = () => {
              resolve();
            };

            source.start(0);
          },
          (error) => {
            reject(error);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Détermine la latence STT
   */
  getSTTLatency(): number {
    return conversationSettings.performance.target_latency_ms.stt;
  }

  /**
   * Détermine la latence TTS
   */
  getTTSLatency(): number {
    return conversationSettings.performance.target_latency_ms.tts;
  }

  /**
   * Vérifie si le microphone est accessible
   */
  async checkMicrophoneAccess(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone access denied:', error);
      return false;
    }
  }

  /**
   * Obtient la liste des périphériques audio disponibles
   */
  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'audioinput');
    } catch (error) {
      console.error('Erreur énumération périphériques:', error);
      return [];
    }
  }
}

export default AudioService;
