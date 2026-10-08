// The AI engine behind iAgent Create. One interface, two implementations: the
// Anthropic API (production) and, in the bench, an engine written by hand.
// The engine only returns parsed JSON; what is accepted is decided by
// `schemas.ts`, never here, so the bench engine goes through the same gate.

import Anthropic from '@anthropic-ai/sdk';
import { pourApi } from './schemas.ts';

export type DemandeMoteur = {
  quoi: 'opportunites' | 'etude';
  systeme: string;
  utilisateur: string;
  schema: Record<string, unknown>;
};

export type MoteurIA = {
  /** Shown on the étude: which engine wrote it. */
  modele: string;
  generer: (d: DemandeMoteur) => Promise<unknown>;
};

/** Refusal from the engine, in French, without any secret in it. */
export class ErreurMoteur extends Error {}

export const MODELE = 'claude-opus-5-5';

export type EtatMoteur = { moteur: MoteurIA } | { manque: string };

/** The Anthropic engine if a key is set; otherwise what is missing, said plainly. */
export function moteurDepuisEnv(env: Record<string, string | undefined>): EtatMoteur {
  const cle = (env.ANTHROPIC_API_KEY ?? '').trim();
  if (!cle) {
    return {
      manque:
        "Le moteur d'IA n'est pas configuré : ANTHROPIC_API_KEY n'est pas posée sur la plateforme. Aucune opportunité ni étude n'a été produite.",
    };
  }
  const client = new Anthropic({ apiKey: cle });
  return {
    moteur: {
      modele: MODELE,
      generer: async (d) => {
        let message;
        try {
          const flux = client.beta.messages.stream({
            model: MODELE,
            max_tokens: 32000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'high', format: { type: 'json_schema', schema: pourApi(d.schema) as Record<string, unknown> } },
            system: d.systeme,
            messages: [{ role: 'user', content: d.utilisateur }],
          });
          message = await flux.finalMessage();
        } catch (e) {
          if (e instanceof Anthropic.AuthenticationError) throw new ErreurMoteur("Le moteur d'IA a refusé la clé posée sur la plateforme.");
          if (e instanceof Anthropic.RateLimitError) throw new ErreurMoteur("Le moteur d'IA est saturé pour le moment : réessayez plus tard.");
          if (e instanceof Anthropic.APIError) throw new ErreurMoteur(`Le moteur d'IA a refusé la demande (statut ${e.status ?? 'inconnu'}).`);
          throw new ErreurMoteur("Le moteur d'IA n'a pas pu être joint.");
        }
        if (message.stop_reason === 'refusal') throw new ErreurMoteur("Le moteur d'IA a décliné cette demande.");
        if (message.stop_reason === 'max_tokens') throw new ErreurMoteur("La réponse du moteur d'IA a été coupée avant la fin : elle n'est pas retenue.");
        const texte = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
        try {
          return JSON.parse(texte);
        } catch {
          throw new ErreurMoteur("La réponse du moteur d'IA n'est pas du JSON lisible : elle n'est pas retenue.");
        }
      },
    },
  };
}
