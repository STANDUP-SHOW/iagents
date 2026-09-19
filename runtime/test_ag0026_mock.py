#!/usr/bin/env python3
"""
Test AG-0026 — Version MOCK (pas d'appel API réel)
Simule une exécution d'agent pour valider structure et logs
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class MockAuditLog:
    """Audit log mock"""

    def __init__(self, **kwargs):
        self.data = kwargs

    def model_dump(self):
        return self.data


class MockAgent:
    """Agent mock — pas d'API call"""

    def __init__(self, fiche_path: str, user_id: str = "test_user"):
        self.user_id = user_id
        self.fiche_path = fiche_path
        self.fiche = self._load_fiche()
        self.agent_id = self.fiche.get("id", "UNKNOWN")
        self.nom = self.fiche.get("nom", "Unknown")
        self.audit_logs = []
        self.messages = []

    def _load_fiche(self) -> dict:
        """Charge fiche JSON"""
        with open(self.fiche_path, 'r', encoding='utf-8') as f:
            fiche = json.load(f)

        # Validations minimales
        assert "id" in fiche, "Fiche sans 'id'"
        assert "expert" in fiche, "Fiche sans 'expert'"
        return fiche

    def run_turn(self, user_input: str) -> dict:
        """Mock exécution — pas d'API réel"""
        import time
        start = time.time()

        try:
            # Simule réponse
            persona = self.fiche.get("expert", {}).get("persona", "")
            response_text = f"""[Mock response from {self.nom}]

Votre demande a été traitée avec succès.

**Contexte :** {persona[:100]}...

**Résultat :** Exécution simulée terminée.
Tokens estimés: 5432 (input: 4500, output: 932)
Coût: €0,0654"""

            # Stats mock
            duration = time.time() - start
            tokens_in = 4500
            tokens_out = 932
            cost_eur = (tokens_in * 0.000002) + (tokens_out * 0.00001)

            return {
                "output": response_text,
                "tokens_input": tokens_in,
                "tokens_output": tokens_out,
                "cost_eur": cost_eur,
                "duration_sec": duration,
                "error": None
            }

        except Exception as e:
            return {
                "output": None,
                "tokens_input": 0,
                "tokens_output": 0,
                "cost_eur": 0.0,
                "duration_sec": 0.0,
                "error": str(e)
            }

    def log_audit(self, result: dict, user_input: str):
        """Enregistre audit log"""
        log = MockAuditLog(
            timestamp=datetime.now(timezone.utc).isoformat(),
            user_id=self.user_id,
            agent_id=self.agent_id,
            action="execute_turn",
            input_text=user_input[:500],
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
        """Export audit logs"""
        return [log.model_dump() for log in self.audit_logs]


def main():
    """Test AG-0026 mock"""

    # Trouve AG-0026
    ag26_path = None
    for f in Path("/home/user/iagents/agents").glob("AG-0026-*.json"):
        ag26_path = str(f)
        break

    if not ag26_path:
        print("❌ AG-0026 not found")
        return False

    print(f"✓ Chargement {Path(ag26_path).name}")
    print("=" * 60)

    # Crée agent mock
    agent = MockAgent(ag26_path, user_id="alice_comptabilite")
    print(f"✓ Agent {agent.agent_id}")
    print(f"  Nom: {agent.nom}")
    print(f"  Persona: {agent.fiche['expert']['persona'][:80]}...")

    # Demande test
    user_input = """Ventile les frais généraux d'août entre client A et B.
    Frais: 500€ loyer, 200€ électricité, 100€ téléphone.
    Allocation: A 60%, B 40%."""

    print(f"\n📝 Demande utilisateur:")
    print(f"  {user_input[:60]}...")

    print(f"\n⏳ Exécution (MOCK)...")

    result = agent.run_turn(user_input)
    agent.log_audit(result, user_input)

    if result["error"]:
        print(f"❌ Erreur: {result['error']}")
        return False

    print(f"✓ Réponse reçue")
    print(f"  Tokens: {result['tokens_input']} input + {result['tokens_output']} output")
    print(f"  Coût: €{result['cost_eur']:.4f}")
    print(f"  Temps: {result['duration_sec']:.2f}s")

    # Affiche réponse
    print(f"\n--- RÉPONSE AGENT ---")
    print(result["output"])

    # Audit log
    logs = agent.export_audit_logs()
    print(f"\n--- AUDIT TRAIL (JSON) ---")
    print(json.dumps(logs[0], indent=2, ensure_ascii=False))

    # Validation structure
    log = logs[0]
    required_fields = ["timestamp", "user_id", "agent_id", "action", "tokens_input", "tokens_output", "cost_eur"]
    missing = [f for f in required_fields if f not in log]

    if missing:
        print(f"\n⚠ Champs manquants dans audit log: {missing}")
        return False

    print(f"\n✓ Audit log structure valide")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
