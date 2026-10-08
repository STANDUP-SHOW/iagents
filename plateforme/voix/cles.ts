// The ONE place where the voice module names its secrets and settings. Every
// adapter reads its key through `cle()` / `manque()` and nothing else; a key
// never travels in a response, a log line or an error message — only the NAME
// of the variable that is missing.

export const VARIABLES = {
  gemini: { variable: 'GEMINI_API_KEY', libelle: 'la clé Gemini (Google AI Studio)' },
  elevenlabs: { variable: 'ELEVENLABS_API_KEY', libelle: 'la clé ElevenLabs' },
  mistral: { variable: 'MISTRAL_API_KEY', libelle: 'la clé Mistral' },
  anthropic: { variable: 'ANTHROPIC_API_KEY', libelle: 'la clé du modèle de langage (Anthropic)' },
  telnyx_api: { variable: 'TELNYX_API_KEY', libelle: 'la clé d’API Telnyx' },
  telnyx_cle_publique: { variable: 'TELNYX_CLE_PUBLIQUE', libelle: 'la clé publique Telnyx des webhooks' },
  telnyx_connexion: { variable: 'TELNYX_CONNECTION_ID', libelle: 'l’identifiant d’application Call Control Telnyx' },
  twilio_sid: { variable: 'TWILIO_ACCOUNT_SID', libelle: 'l’identifiant de compte Twilio' },
  twilio_jeton: { variable: 'TWILIO_AUTH_TOKEN', libelle: 'le jeton d’authentification Twilio' },
  sip_passerelle: { variable: 'SIP_PASSERELLE_URL', libelle: 'l’adresse de la passerelle SIP' },
  sip_jeton: { variable: 'SIP_PASSERELLE_JETON', libelle: 'le jeton de la passerelle SIP' },
  sip_secret: { variable: 'SIP_SECRET_WEBHOOK', libelle: 'le secret des webhooks de la passerelle SIP' },
  url_publique: { variable: 'VOIX_URL_PUBLIQUE', libelle: 'l’adresse publique de la plateforme (https://…)' },
  piper_binaire: { variable: 'PIPER_BINAIRE', libelle: 'le moteur Piper' },
  piper_voix: { variable: 'PIPER_VOIX_DOSSIER', libelle: 'le dossier des voix Piper (.onnx)' },
  whisper_binaire: { variable: 'WHISPER_BINAIRE', libelle: 'le programme whisper-cli' },
  whisper_modele: { variable: 'WHISPER_MODELE', libelle: 'le modèle d’écoute whisper (.bin)' },
} as const;

export type NomCle = keyof typeof VARIABLES;
export type Env = Record<string, string | undefined>;

export function cle(nom: NomCle, env: Env): string | null {
  const v = (env[VARIABLES[nom].variable] ?? '').trim();
  return v ? v : null;
}

/** Null when every key is set; otherwise a French sentence naming what is missing (names only). */
export function manque(noms: NomCle[], env: Env, pour: string): string | null {
  const absentes = noms.filter((n) => !cle(n, env));
  if (absentes.length === 0) return null;
  const quoi = absentes.map((n) => `${VARIABLES[n].libelle} (${VARIABLES[n].variable})`).join(', ');
  return `${pour} est impossible : il manque ${quoi}. Rien n’a été envoyé.`;
}
