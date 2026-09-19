#!/usr/bin/env python3
"""
Agent Runtime — Exécute une fiche LocalAgent réelle
Charge JSON fiche → prépare prompt → appelle Anthropic API → log audit
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import hashlib

from anthropic import Anthropic
from pydantic import BaseModel


class AuditLog(BaseModel):
    """Schéma d'audit trail"""
    timestamp: str
    user_id: str
    agent_id: str
    action: str
    input_text: str
    output_text: str
    tokens_input: int
    tokens_output: int
    cost_eur: float
    duration_sec: float
    error: Optional[str] = None


class LocalAgent:
    """
    Agent unique qui incarne une fiche LocalAgent.
    Charge la fiche JSON, prépare le système prompt, gère une conversation.
    """

    def __init__(self, fiche_path: str, user_id: str = "test_user"):
        """
        Args:
            fiche_path: chemin vers le JSON de la fiche (ex: agents/AG-0026-*.json)
            user_id: identifiant de l'utilisateur qui lance l'agent
        """
        self.user_id = user_id
        self.fiche_path = fiche_path
        self.fiche = self._load_fiche()
        self.agent_id = self.fiche.get("id", "UNKNOWN")
        self.nom = self.fiche.get("nom", "Unknown")

        # Client Anthropic
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-3-5-sonnet-20241022"  # Version actuelle

        # Historique de conversation
        self.messages = []
        self.audit_logs = []

    def _load_fiche(self) -> dict:
        """Charge et valide la fiche JSON"""
        with open(self.fiche_path, 'r', encoding='utf-8') as f:
            fiche = json.load(f)

        # Validations minimales
        assert "id" in fiche, "Fiche sans 'id'"
        assert "expert" in fiche, "Fiche sans 'expert' (persona)"
        assert "expert" in fiche["expert"], "Expert sans 'consigne'"

        return fiche

    def _prepare_system_prompt(self) -> str:
        """Construit le système prompt à partir de la fiche"""
        expert = self.fiche.get("expert", {})

        # Éléments clés
        persona = expert.get("persona", "")
        consigne = expert.get("consigne", "")
        connaissances = expert.get("connaissances", [])
        regles = expert.get("regles", [])

        # Format du prompt
        system = f"""Tu es {self.nom}.

PERSONA:
{persona}

CONSIGNE (écrite pour exécution locale):
{consigne}

CONNAISSANCES:
{chr(10).join(f"- {k}" for k in connaissances[:5])}

RÈGLES À RESPECTER:
{chr(10).join(f"- {r}" for r in regles[:5])}

Réponds en français, sois concis, reste dans ton rôle."""

        return system

    def run_turn(self, user_input: str, max_tokens: int = 500) -> dict:
        """
        Lance un tour de conversation (1 appel API).

        Args:
            user_input: demande de l'utilisateur
            max_tokens: limite output

        Returns:
            {
              "output": texte réponse,
              "tokens_input": int,
              "tokens_output": int,
              "cost_eur": float,
              "duration_sec": float,
              "error": str or None
            }
        """
        import time
        start = time.time()

        try:
            # Ajoute message utilisateur
            self.messages.append({
                "role": "user",
                "content": user_input
            })

            # Appel API
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=self._prepare_system_prompt(),
                messages=self.messages
            )

            # Extrait réponse
            assistant_message = response.content[0].text
            self.messages.append({
                "role": "assistant",
                "content": assistant_message
            })

            # Calcul tokens & coûts (pricing Sonnet 5)
            tokens_in = response.usage.input_tokens
            tokens_out = response.usage.output_tokens

            # Coûts (EUR)
            # Sonnet 5: €0.000002 input, €0.00001 output
            cost_input = tokens_in * 0.000002
            cost_output = tokens_out * 0.00001
            cost_total = cost_input + cost_output

            duration = time.time() - start

            return {
                "output": assistant_message,
                "tokens_input": tokens_in,
                "tokens_output": tokens_out,
                "cost_eur": cost_total,
                "duration_sec": duration,
                "error": None
            }

        except Exception as e:
            duration = time.time() - start
            return {
                "output": None,
                "tokens_input": 0,
                "tokens_output": 0,
                "cost_eur": 0.0,
                "duration_sec": duration,
                "error": str(e)
            }

    def log_audit(self, result: dict, user_input: str):
        """Enregistre un audit trail"""
        log = AuditLog(
            timestamp=datetime.now(timezone.utc).isoformat(),
            user_id=self.user_id,
            agent_id=self.agent_id,
            action="execute_turn",
            input_text=user_input[:500],  # Limiter taille log
            output_text=result.get("output", "")[:500] if result.get("output") else "",
            tokens_input=result.get("tokens_input", 0),
            tokens_output=result.get("tokens_output", 0),
            cost_eur=result.get("cost_eur", 0.0),
            duration_sec=result.get("duration_sec", 0.0),
            error=result.get("error")
        )

        self.audit_logs.append(log)
        return log

    def export_audit_logs(self) -> list[dict]:
        """Export audit logs en JSON"""
        return [log.model_dump() for log in self.audit_logs]


def main():
    """Test AG-0026 avec une demande fictive"""

    # Trouve AG-0026
    ag26_path = None
    for f in Path("/home/user/iagents/agents").glob("AG-0026-*.json"):
        ag26_path = str(f)
        break

    if not ag26_path:
        print("❌ AG-0026 not found")
        sys.exit(1)

    print(f"✓ Chargement {Path(ag26_path).name}")

    # Crée agent
    agent = LocalAgent(ag26_path, user_id="alice_comptabilite")
    print(f"✓ Agent {agent.agent_id} ({agent.nom}) prêt")

    # Demande test
    user_input = """Ventile les frais généraux d'août entre client A et B.
    Frais: 500€ loyer, 200€ électricité, 100€ téléphone.
    Allocation: A 60%, B 40%.
    Fournis un tableau."""

    print(f"\n📝 Demande: {user_input[:80]}...")
    print("⏳ Appel API...")

    result = agent.run_turn(user_input)
    agent.log_audit(result, user_input)

    if result["error"]:
        print(f"❌ Erreur: {result['error']}")
        sys.exit(1)

    print(f"\n✓ Réponse reçue ({result['tokens_output']} tokens, €{result['cost_eur']:.4f})")
    print(f"  Durée: {result['duration_sec']:.1f}s")
    print(f"  Tokens: {result['tokens_input']} input, {result['tokens_output']} output")

    # Affiche réponse
    print(f"\n--- RÉPONSE AGENT ---")
    print(result["output"][:500])
    if len(result["output"]) > 500:
        print(f"... [{len(result['output']) - 500} chars de plus]")

    # Export audit log
    logs = agent.export_audit_logs()
    print(f"\n--- AUDIT LOG (JSON) ---")
    print(json.dumps(logs[0], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
