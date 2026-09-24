import type { AgentInstalle } from '../agents/fiche';

export interface Reglages {
  conversation: {
    max_context_turns: number;
    user_session_timeout_minutes: number;
  };
  tts: { primary: Record<string, unknown> };
  stt: { primary: Record<string, unknown> };
  llm: { primary: Record<string, unknown> };
}

function normaliserPrenom(mot: string): string {
  return mot
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}]/gu, '');
}

interface Message {
  role: 'user' | 'agent';
  content: string;
  agent_id?: string;
  timestamp: Date;
  duration_seconds?: number;
}

interface ConversationContext {
  session_id: string;
  current_agent_id: string;
  messages: Message[];
  start_time: Date;
  last_activity: Date;
}

export class ConversationEngine {
  private contexts: Map<string, ConversationContext> = new Map();
  private parFicheId: Map<string, AgentInstalle> = new Map();
  private agents: readonly AgentInstalle[];
  private reglages: Reglages;
  /** Ce que l'employeur a reproché à chaque agent, par identifiant de fiche. */
  private journaux: Map<string, string[]> = new Map();

  constructor(agents: readonly AgentInstalle[], reglages: Reglages) {
    this.agents = agents;
    this.reglages = reglages;
    for (const agent of agents) {
      this.parFicheId.set(agent.fiche.id, agent);
    }
  }

  /** Le journal d'un agent, relu du disque : ce qu'il a appris de son employeur. */
  enregistrerJournal(ficheId: string, retours: readonly string[]): void {
    this.journaux.set(ficheId, [...retours]);
  }

  /**
   * Détecte le prénom de l'agent dans la transcription
   * Exemple: "Carla, quels sont les horaires?" → Carla
   */
  detectAgent(
    transcription: string
  ): { agent: AgentInstalle; utterance: string } | null {
    const mots = transcription.trim().split(/\s+/);
    if (mots.length === 0 || mots[0] === '') return null;

    const premier = normaliserPrenom(mots[0]);
    const reste = mots.slice(1).join(' ').trim();

    const exact = this.agents.find((a) => normaliserPrenom(a.prenom) === premier);
    if (exact) return { agent: exact, utterance: reste };

    const proches = this.agents.filter((a) => {
      const prenom = normaliserPrenom(a.prenom);
      // Une lettre de travers sur un prénom un peu long reste reconnaissable ;
      // sur un prénom court, elle en désigne souvent un autre.
      const tolerance = prenom.length >= 5 ? 1 : 0;
      return this.levenshteinDistance(premier, prenom) <= tolerance;
    });

    // Deux prénoms aussi proches l'un que l'autre : mieux vaut ne pas répondre
    // que faire répondre le mauvais agent.
    return proches.length === 1 ? { agent: proches[0], utterance: reste } : null;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Crée une nouvelle session de conversation
   */
  createSession(sessionId: string, agentId: string): ConversationContext {
    const context: ConversationContext = {
      session_id: sessionId,
      current_agent_id: agentId,
      messages: [],
      start_time: new Date(),
      last_activity: new Date(),
    };

    this.contexts.set(sessionId, context);
    return context;
  }

  /**
   * Ajoute un message à la conversation
   */
  addMessage(
    sessionId: string,
    role: 'user' | 'agent',
    content: string,
    duration_seconds?: number
  ): void {
    const context = this.contexts.get(sessionId);
    if (!context) return;

    const message: Message = {
      role,
      content,
      agent_id: context.current_agent_id,
      timestamp: new Date(),
      duration_seconds,
    };

    context.messages.push(message);
    context.last_activity = new Date();

    // Limite la mémoire à max_context_turns
    const maxTurns = this.reglages.conversation.max_context_turns * 2;
    if (context.messages.length > maxTurns) {
      context.messages = context.messages.slice(-maxTurns);
    }
  }

  /**
   * Récupère le contexte conversationnel pour le LLM
   */
  getConversationHistory(sessionId: string): Message[] {
    const context = this.contexts.get(sessionId);
    return context?.messages || [];
  }

  /**
   * Change d'agent dans la conversation
   */
  switchAgent(sessionId: string, newAgentId: string): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) return false;

    const agent = this.parFicheId.get(newAgentId);
    if (!agent) return false;

    context.current_agent_id = newAgentId;
    context.last_activity = new Date();

    // Log du changement
    this.addMessage(
      sessionId,
      'agent',
      `[Changement d'agent: ${agent.prenom}]`
    );

    return true;
  }

  /**
   * Récupère les paramètres de l'agent actuel
   */
  getAgentConfig(agentId: string): AgentInstalle | undefined {
    return this.parFicheId.get(agentId);
  }

  /**
   * Formatte le contexte pour le prompt du LLM
   */
  formatSystemPrompt(agentId: string): string {
    const agent = this.getAgentConfig(agentId);
    if (!agent) return '';

    const { expert } = agent.fiche;
    const regles = expert.regles.map((r) => `- ${r}`).join('\n');

    // Les fiches portent un genre grammatical figé, parfois contradictoire d'un
    // paragraphe à l'autre. Le choix du client prime sur ce qui est écrit.
    const accord =
      agent.sexe === undefined
        ? ''
        : `\nTu es ${agent.sexe === 'femme' ? 'une femme' : 'un homme'}. Quelle que soit la ` +
          `formulation employée plus haut, tu parles de toi au ` +
          `${agent.sexe === 'femme' ? 'féminin' : 'masculin'} et accordes en conséquence.\n`;

    const bloc = (titre: string, savoirs: readonly { titre: string; resume: string }[]) =>
      savoirs.length === 0
        ? ''
        : `\n${titre}\n${savoirs.map((c) => `- ${c.titre} : ${c.resume}`).join('\n')}\n`;

    const metier = bloc('Ce que tu sais de ton métier:', expert.connaissances);
    // Ce que l'employeur a appris à son agent l'emporte : il connaît sa maison
    // mieux que le savoir général du métier.
    const maison =
      agent.competences.length === 0
        ? ''
        : bloc(
            "Ce que ton employeur t'a appris, et qui prime sur le savoir général:",
            agent.competences
          );

    // Ce qui lui a déjà été reproché passe en dernier et prime : c'est la
    // correction la plus récente, celle qui doit l'emporter sur le reste.
    const retours = this.journaux.get(agentId) ?? [];
    const appris =
      retours.length === 0
        ? ''
        : `\nCe que ton employeur t'a déjà repris, et que tu ne refais pas:\n` +
          retours.map((r) => `- ${r}`).join('\n') +
          '\n';

    return `${expert.consigne}

Tu t'appelles ${agent.prenom}. Tu réponds quand on t'appelle par ce prénom.
${accord}${metier}${maison}${appris}
Règles strictes à respecter:
${regles}

Réponse courte et naturelle, comme si vous parliez au téléphone.`;
  }

  /**
   * Construit le contexte pour le LLM (messages + metadata)
   */
  buildLLMContext(sessionId: string): {
    messages: Array<{ role: string; content: string }>;
    systemPrompt: string;
    agentConfig: any;
  } {
    const context = this.contexts.get(sessionId);
    if (!context) {
      return {
        messages: [],
        systemPrompt: '',
        agentConfig: null,
      };
    }

    const agentConfig = this.getAgentConfig(context.current_agent_id);
    const messages = context.messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    return {
      messages,
      systemPrompt: this.formatSystemPrompt(context.current_agent_id),
      agentConfig,
    };
  }

  /**
   * Vérifie si la session a expiré
   */
  isSessionExpired(sessionId: string): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) return true;

    const timeoutMinutes = this.reglages.conversation.user_session_timeout_minutes;
    const elapsed = Date.now() - context.last_activity.getTime();

    return elapsed > timeoutMinutes * 60 * 1000;
  }

  /**
   * Nettoie les sessions expirées
   */
  cleanupExpiredSessions(): void {
    for (const sessionId of this.contexts.keys()) {
      if (this.isSessionExpired(sessionId)) {
        this.contexts.delete(sessionId);
      }
    }
  }

  /**
   * Exporte la conversation pour logging/audit
   */
  exportConversation(sessionId: string): {
    session_id: string;
    agent_id: string;
    agent_name: string;
    duration_seconds: number;
    messages: Message[];
    start_time: Date;
    end_time: Date;
  } | null {
    const context = this.contexts.get(sessionId);
    if (!context) return null;

    const agent = this.getAgentConfig(context.current_agent_id);
    const durationMs = Date.now() - context.start_time.getTime();

    return {
      session_id: context.session_id,
      agent_id: context.current_agent_id,
      agent_name: agent?.prenom ?? 'inconnu',
      duration_seconds: Math.round(durationMs / 1000),
      messages: context.messages,
      start_time: context.start_time,
      end_time: new Date(),
    };
  }

  /**
   * Récupère les paramètres TTS pour l'agent
   */
  getTTSConfig(agentId: string): any {
    const agent = this.getAgentConfig(agentId);
    if (!agent) return this.reglages.tts.primary;

    return {
      ...this.reglages.tts.primary,
      voice_id: agent.voix,
    };
  }

  /**
   * Récupère les paramètres STT (global)
   */
  getSTTConfig(): any {
    return this.reglages.stt.primary;
  }

  /**
   * Récupère les paramètres LLM pour l'agent
   */
  getLLMConfig(): any {
    return this.reglages.llm.primary;
  }

  /**
   * Liste tous les agents installés sur ce poste
   */
  getAllAgents(): readonly AgentInstalle[] {
    return this.agents;
  }

  /**
   * Obtient les stats de la session
   */
  getSessionStats(sessionId: string): {
    duration_seconds: number;
    message_count: number;
    agent_id: string;
    agent_name: string;
    last_activity: Date;
  } | null {
    const context = this.contexts.get(sessionId);
    if (!context) return null;

    const agent = this.getAgentConfig(context.current_agent_id);
    const duration = Math.round((Date.now() - context.start_time.getTime()) / 1000);

    return {
      duration_seconds: duration,
      message_count: context.messages.length,
      agent_id: context.current_agent_id,
      agent_name: agent?.prenom ?? 'inconnu',
      last_activity: context.last_activity,
    };
  }
}

export default ConversationEngine;
