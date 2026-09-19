import { useState } from 'react';

export default function AgentSimulator({ agent, onClose }) {
  const [input, setInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);

  const handleExecute = async () => {
    if (!input.trim()) return;

    setExecuting(true);
    setResult(null);

    // Simulation d'exécution (2 secondes)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Générer des résultats fake mais réalistes
    const tokensUsed = Math.floor(Math.random() * 8000) + 2000;
    const costPerToken = 0.000000333;
    const executionCost = (tokensUsed * costPerToken).toFixed(3);
    const executionTime = (Math.random() * 2 + 0.5).toFixed(2);

    const mockResult = {
      status: 'success',
      agentId: agent.id,
      agentName: agent.nom,
      input: input,
      output: `Tâche complétée avec succès. ${agent.nom} a traité votre demande en ${executionTime}s.`,
      metrics: {
        tokensUsed: tokensUsed.toLocaleString('fr-FR'),
        cost: executionCost,
        duration: executionTime,
        timestamp: new Date().toISOString(),
      },
      auditLog: {
        step_1: {
          action: 'parse_input',
          status: 'completed',
          duration_ms: Math.floor(Math.random() * 500),
          tokens: Math.floor(tokensUsed * 0.15),
        },
        step_2: {
          action: 'process_context',
          status: 'completed',
          duration_ms: Math.floor(Math.random() * 1000),
          tokens: Math.floor(tokensUsed * 0.25),
        },
        step_3: {
          action: 'call_llm',
          status: 'completed',
          duration_ms: Math.floor(Math.random() * 800),
          model: agent.modeles?.texte || 'claude-3-haiku',
          tokens: Math.floor(tokensUsed * 0.6),
        },
        step_4: {
          action: 'format_output',
          status: 'completed',
          duration_ms: Math.floor(Math.random() * 300),
          tokens: Math.floor(tokensUsed * 0.1),
        },
      },
    };

    setExecuting(false);
    setResult(mockResult);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-lg shadow-2xl max-w-2xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Simuler l'exécution</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-black/20 px-4 py-2 rounded transition"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Input Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Entrée utilisateur
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Décrivez la tâche à exécuter..."
              disabled={executing}
              className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              rows="4"
            />
          </div>

          {/* Execute Button */}
          <button
            onClick={handleExecute}
            disabled={!input.trim() || executing}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {executing ? (
              <>
                <span className="spinner">⏳</span>
                Exécution en cours...
              </>
            ) : (
              <>
                🚀 Exécuter l'agent
              </>
            )}
          </button>

          {/* Results Section */}
          {result && (
            <div className="space-y-4 bg-slate-900/50 p-6 rounded-lg border border-slate-700">
              <h3 className="text-xl font-bold text-indigo-300">Résultats</h3>

              {/* Output */}
              <div className="bg-slate-800 p-4 rounded-lg">
                <p className="text-sm text-slate-400 mb-2">Résultat:</p>
                <p className="text-slate-200">{result.output}</p>
              </div>

              {/* Metrics */}
              <div className="grid md:grid-cols-3 gap-3">
                <div className="bg-slate-700/50 p-3 rounded">
                  <p className="text-xs text-slate-400">Tokens utilisés</p>
                  <p className="text-lg font-bold text-green-300">{result.metrics.tokensUsed}</p>
                </div>
                <div className="bg-slate-700/50 p-3 rounded">
                  <p className="text-xs text-slate-400">Coût estimé</p>
                  <p className="text-lg font-bold text-blue-300">{result.metrics.cost}€</p>
                </div>
                <div className="bg-slate-700/50 p-3 rounded">
                  <p className="text-xs text-slate-400">Temps d'exécution</p>
                  <p className="text-lg font-bold text-purple-300">{result.metrics.duration}s</p>
                </div>
              </div>

              {/* Audit Log */}
              <div>
                <p className="text-sm font-semibold text-slate-400 mb-3">Journal d'exécution</p>
                <div className="space-y-2">
                  {Object.entries(result.auditLog).map(([stepKey, step]) => (
                    <div key={stepKey} className="bg-slate-800 p-3 rounded text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono font-bold text-indigo-300">{step.action}</span>
                        <span className="text-green-300">✓ {step.status}</span>
                      </div>
                      <div className="flex gap-4 text-slate-400">
                        <span>⏱ {step.duration_ms}ms</span>
                        <span>📊 {step.tokens.toLocaleString('fr-FR')} tokens</span>
                        {step.model && <span>🤖 {step.model}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* JSON Export */}
              <details className="bg-slate-800 p-4 rounded">
                <summary className="font-semibold text-slate-300 cursor-pointer hover:text-indigo-300">
                  📋 Réponse JSON complète
                </summary>
                <pre className="mt-3 text-xs bg-slate-900 p-3 rounded overflow-x-auto text-slate-300">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full btn-secondary"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
