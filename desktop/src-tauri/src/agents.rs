use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String, // "active" or "inactive"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCommand {
    pub agent_id: String,
    pub agent_name: String,
    pub command: String,
    pub confidence: f32,
}

pub struct AgentRouter {
    agents: HashMap<String, Agent>,
    active_agents: Vec<String>,
}

impl AgentRouter {
    pub fn new() -> Self {
        let mut agents = HashMap::new();

        // Phase 1: 5 sample agents
        let sample_agents = vec![
            Agent {
                id: "AG-0001".to_string(),
                name: "Albert".to_string(),
                description: "Assistant productivité".to_string(),
                status: "inactive".to_string(),
            },
            Agent {
                id: "AG-0002".to_string(),
                name: "Justine".to_string(),
                description: "Assistante communication".to_string(),
                status: "inactive".to_string(),
            },
            Agent {
                id: "AG-0050".to_string(),
                name: "Audrey".to_string(),
                description: "Assistante créative".to_string(),
                status: "inactive".to_string(),
            },
            Agent {
                id: "AG-0100".to_string(),
                name: "Marcus".to_string(),
                description: "Analyste données".to_string(),
                status: "inactive".to_string(),
            },
            Agent {
                id: "AG-0150".to_string(),
                name: "Olivia".to_string(),
                description: "Gestionnaire projets".to_string(),
                status: "inactive".to_string(),
            },
        ];

        for agent in sample_agents {
            agents.insert(agent.name.to_lowercase(), agent);
        }

        AgentRouter {
            agents,
            active_agents: vec![],
        }
    }

    pub fn route_voice_command(&self, utterance: &str) -> Result<AgentCommand, String> {
        let lower = utterance.to_lowercase();

        // Pattern: "Agent_Name, do something" or "Agent_Name!"
        let mut best_match: Option<(String, f32)> = None;

        for (name, agent) in &self.agents {
            // Exact name match (e.g., "Albert")
            if lower.starts_with(name) || lower.contains(&format!(" {}", name)) {
                if agent.status == "active" {
                    best_match = Some((name.clone(), 1.0));
                    break;
                }
            }

            // Partial match for confidence scoring
            if lower.contains(name) {
                best_match = Some((name.clone(), 0.8));
            }
        }

        match best_match {
            Some((agent_name, confidence)) => {
                if let Some(agent) = self.agents.get(&agent_name) {
                    let command = utterance
                        .trim_start_matches(&agent.name)
                        .trim_start_matches(&agent_name)
                        .trim_matches(|c: char| c == ',' || c == '!' || c.is_whitespace())
                        .to_string();

                    Ok(AgentCommand {
                        agent_id: agent.id.clone(),
                        agent_name: agent.name.clone(),
                        command,
                        confidence,
                    })
                } else {
                    Err("Agent not found".to_string())
                }
            }
            None => {
                // Fallback to first active agent
                if !self.active_agents.is_empty() {
                    if let Some(agent) = self.agents.values().find(|a| a.id == self.active_agents[0]) {
                        Ok(AgentCommand {
                            agent_id: agent.id.clone(),
                            agent_name: agent.name.clone(),
                            command: utterance.to_string(),
                            confidence: 0.3,
                        })
                    } else {
                        Err("No active agents found".to_string())
                    }
                } else {
                    Err("No agent name recognized in command".to_string())
                }
            }
        }
    }

    pub fn activate_agent(&mut self, agent_id: &str) -> Result<Agent, String> {
        for agent in self.agents.values_mut() {
            if agent.id == agent_id {
                agent.status = "active".to_string();
                if !self.active_agents.contains(&agent.id.to_string()) {
                    self.active_agents.push(agent.id.clone());
                }
                return Ok(agent.clone());
            }
        }
        Err("Agent not found".to_string())
    }

    pub fn deactivate_agent(&mut self, agent_id: &str) -> Result<Agent, String> {
        for agent in self.agents.values_mut() {
            if agent.id == agent_id {
                agent.status = "inactive".to_string();
                self.active_agents.retain(|id| id != agent_id);
                return Ok(agent.clone());
            }
        }
        Err("Agent not found".to_string())
    }

    pub fn list_agents(&self) -> Vec<Agent> {
        self.agents.values().cloned().collect()
    }

    pub fn get_active_agents(&self) -> Vec<Agent> {
        self.agents
            .values()
            .filter(|a| a.status == "active")
            .cloned()
            .collect()
    }
}
