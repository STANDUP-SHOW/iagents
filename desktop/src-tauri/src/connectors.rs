use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub id: String,
    pub name: String,
    pub connector_type: String,
    pub status: String, // "connected" or "disconnected"
    pub config: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorEvent {
    pub id: String,
    pub connector_id: String,
    pub event_type: String,
    pub payload: String,
    pub status: String,
}

pub struct ConnectorManager {
    connectors: HashMap<String, Connector>,
    events: Vec<ConnectorEvent>,
}

impl ConnectorManager {
    pub fn new() -> Self {
        ConnectorManager {
            connectors: HashMap::new(),
            events: vec![],
        }
    }

    pub fn register_connector(
        &mut self,
        name: &str,
        connector_type: &str,
        config: HashMap<String, String>,
    ) -> Result<Connector, String> {
        let id = format!("conn_{}", uuid::Uuid::new_v4());

        let connector = Connector {
            id: id.clone(),
            name: name.to_string(),
            connector_type: connector_type.to_string(),
            status: "disconnected".to_string(),
            config,
        };

        self.connectors.insert(id.clone(), connector.clone());
        Ok(connector)
    }

    pub fn connect_telegram(&mut self, token: &str) -> Result<Connector, String> {
        if token.is_empty() {
            return Err("Token cannot be empty".to_string());
        }

        // Verify token format (simplified)
        if !token.starts_with("bot") && !token.contains(':') {
            return Err("Invalid Telegram token format".to_string());
        }

        let mut config = HashMap::new();
        config.insert("token".to_string(), token.to_string());

        match self.register_connector("Telegram", "telegram", config) {
            Ok(mut connector) => {
                connector.status = "connected".to_string();
                self.connectors.insert(connector.id.clone(), connector.clone());
                Ok(connector)
            }
            Err(e) => Err(e),
        }
    }

    pub fn connect_whatsapp(&mut self, api_key: &str) -> Result<Connector, String> {
        if api_key.is_empty() {
            return Err("API key cannot be empty".to_string());
        }

        let mut config = HashMap::new();
        config.insert("api_key".to_string(), api_key.to_string());

        match self.register_connector("WhatsApp", "whatsapp", config) {
            Ok(mut connector) => {
                connector.status = "connected".to_string();
                self.connectors.insert(connector.id.clone(), connector.clone());
                Ok(connector)
            }
            Err(e) => Err(e),
        }
    }

    pub fn list_connectors(&self) -> Vec<Connector> {
        self.connectors.values().cloned().collect()
    }

    pub fn get_connector(&self, id: &str) -> Option<Connector> {
        self.connectors.get(id).cloned()
    }

    pub fn disconnect_connector(&mut self, id: &str) -> Result<Connector, String> {
        if let Some(mut connector) = self.connectors.remove(id) {
            connector.status = "disconnected".to_string();
            Ok(connector)
        } else {
            Err("Connector not found".to_string())
        }
    }

    pub fn queue_event(&mut self, event: ConnectorEvent) {
        self.events.push(event);
    }

    pub fn get_pending_events(&self) -> Vec<ConnectorEvent> {
        self.events
            .iter()
            .filter(|e| e.status == "pending")
            .cloned()
            .collect()
    }
}

// Simple UUID placeholder for web environment
mod uuid {
    use std::time::{SystemTime, UNIX_EPOCH};
    use std::cell::Cell;

    thread_local! {
        static COUNTER: Cell<u64> = Cell::new(0);
    }

    pub struct Uuid;

    impl Uuid {
        pub fn new_v4() -> String {
            COUNTER.with(|c| {
                let count = c.get();
                c.set(count + 1);
                let time = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis();
                format!("{:x}{:x}", time, count)
            })
        }
    }
}
