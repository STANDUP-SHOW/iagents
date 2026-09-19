import agentsConfig from '../config/agents-config.json';
import conversationSettings from '../config/conversation-settings.json';

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
  private agentIndex: Map<string, any> = new Map();

  constructor() {
    this.initializeAgents();
  }

  private initializeAgents(): void {
    for (const agent of agentsConfig.agents) {
      this.agentIndex.set(agent.id, agent);
      // Index also by prenom for wake word detection
      this.agentIndex.set(agent.prenom.toLowerCase(), agent);
    }
  }

  /**
   * Détecte le prénom de l'agent dans la transcription
   * Exemple: "Carla, quels sont les horaires?" → "carla"
   */
  detectAgent(transcription: string): { agent: any; utterance: string } | null {
    const lowerTranscription = transcription.toLowerCase().trim();

    for (const agent of agentsConfig.agents) {
      for (const wakeWord of agent.wake_word) {
        const pattern = new RegExp(`^${wakeWord}\\s+(.+)$`, 'i');
        const match = lowerTranscription.match(pattern);

        if (match) {
          const utterance = match[1];
          return { agent, utterance };
        }

        // Fuzzy match with threshold
        if (this.fuzzyMatch(lowerTranscription, wakeWord, 0.85)) {
          const utterance = lowerTranscription.replace(wakeWord, '').trim();
          return { agent, utterance };
        }
      }
    }

    return null;
  }

  private fuzzyMatch(text: string, pattern: string, threshold: number): boolean {
    const words = text.split(/\s+/);
    for (const word of words) {
      const similarity = this.levenshteinSimilarity(word, pattern);
      if (similarity >= threshold) {
        return true;
      }
    }
    return false;
  }

  private levenshteinSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    const distance = this.levenshteinDistance(a, b);
    return 1 - distance / maxLen;
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
    const maxTurns = conversationSettings.conversation.max_context_turns * 2;
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

    const agent = this.agentIndex.get(newAgentId);
    if (!agent) return false;

    context.current_agent_id = newAgentId;
    context.last_activity = new Date();

    // Log du changement
    this.addMessage(
      sessionId,
      'agent',
      `[Changement d'agent: ${agent.nom}]`
    );

    return true;
  }

  /**
   * Récupère les paramètres de l'agent actuel
   */
  getAgentConfig(agentId: string): any {
    return this.agentIndex.get(agentId);
  }

  /**
   * Formatte le contexte pour le prompt du LLM
   */
  formatSystemPrompt(agentId: string): string {
    const agent = this.getAgentConfig(agentId);
    if (!agent) return '';

    const basePrompt = agent.llm.system_prompt;
    const regles = agent.regles.map((r: string) => `- ${r}`).join('\n');

    return `${basePrompt}

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

    const timeoutMinutes = conversationSettings.conversation.user_session_timeout_minutes;
    const elapsed = Date.now() - context.last_activity.getTime();

    return elapsed > timeoutMinutes * 60 * 1000;
  }

  /**
   * Nettoie les sessions expirées
   */
  cleanupExpiredSessions(): void {
    for (const [sessionId, context] of this.contexts.entries()) {
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
      agent_name: agent?.nom || 'Unknown',
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
    if (!agent) return conversationSettings.tts.primary;

    return {
      ...conversationSettings.tts.primary,
      ...agent.tts,
    };
  }

  /**
   * Récupère les paramètres STT (global)
   */
  getSTTConfig(): any {
    return conversationSettings.stt.primary;
  }

  /**
   * Récupère les paramètres LLM pour l'agent
   */
  getLLMConfig(agentId: string): any {
    const agent = this.getAgentConfig(agentId);
    if (!agent) return conversationSettings.llm.primary;

    return {
      ...conversationSettings.llm.primary,
      ...agent.llm,
    };
  }

  /**
   * Liste tous les agents disponibles
   */
  getAllAgents(): any[] {
    return agentsConfig.agents;
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
      agent_name: agent?.nom || 'Unknown',
      last_activity: context.last_activity,
    };
  }
}

export default ConversationEngine;
