use std::path::Path;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params, OptionalExtension, Result as SqlResult};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub persona: String,
    pub user_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePrint {
    pub id: String,
    pub user_id: String,
    pub mfcc_data: String, // Encrypted JSON
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub id: String,
    pub name: String,
    pub connector_type: String,
    pub credentials: String, // Encrypted
    pub status: String,
    pub user_id: String,
    pub created_at: String,
}

pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let path = Path::new(db_path);

        // Ensure database directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create database directory: {}", e))?;
        }

        // Open or create database
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        Ok(Database {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn init(&self) -> Result<(), String> {
        let conn = self.conn.lock()
            .map_err(|_| "Failed to acquire database lock".to_string())?;

        self.create_tables(&conn)?;
        println!("Database initialized");
        Ok(())
    }

    fn create_tables(&self, conn: &Connection) -> Result<(), String> {
        // User table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            )",
            [],
        ).map_err(|e| format!("Failed to create users table: {}", e))?;

        // VoicePrint table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS voice_prints (
                id TEXT PRIMARY KEY,
                user_id TEXT UNIQUE NOT NULL,
                mfcc_data TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )",
            [],
        ).map_err(|e| format!("Failed to create voice_prints table: {}", e))?;

        // Connector table (for Telegram and other connectors)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS connectors (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                credentials TEXT NOT NULL,
                status TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )",
            [],
        ).map_err(|e| format!("Failed to create connectors table: {}", e))?;

        Ok(())
    }

    pub fn create_or_get_user(&self, username: &str, email: &str) -> Result<User, String> {
        let conn = self.conn.lock()
            .map_err(|_| "Failed to acquire database lock".to_string())?;

        let user_id = Uuid::new_v4().to_string();
        let now = chrono::Local::now().to_rfc3339();

        conn.execute(
            "INSERT OR IGNORE INTO users (id, username, email, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&user_id, username, email, &now],
        ).map_err(|e| format!("Failed to create user: {}", e))?;

        Ok(User {
            id: user_id,
            username: username.to_string(),
            email: email.to_string(),
            created_at: now,
        })
    }

    pub fn save_voice_print(&self, user_id: &str, mfcc_data: &str) -> Result<VoicePrint, String> {
        let conn = self.conn.lock()
            .map_err(|_| "Failed to acquire database lock".to_string())?;

        let id = Uuid::new_v4().to_string();
        let now = chrono::Local::now().to_rfc3339();

        conn.execute(
            "INSERT OR REPLACE INTO voice_prints (id, user_id, mfcc_data, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&id, user_id, mfcc_data, &now],
        ).map_err(|e| format!("Failed to save voice print: {}", e))?;

        Ok(VoicePrint {
            id,
            user_id: user_id.to_string(),
            mfcc_data: mfcc_data.to_string(),
            created_at: now,
        })
    }

    pub fn get_voice_print(&self, user_id: &str) -> Result<Option<VoicePrint>, String> {
        let conn = self.conn.lock()
            .map_err(|_| "Failed to acquire database lock".to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, user_id, mfcc_data, created_at FROM voice_prints WHERE user_id = ?1"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let voice_print = stmt.query_row([user_id], |row| {
            Ok(VoicePrint {
                id: row.get(0)?,
                user_id: row.get(1)?,
                mfcc_data: row.get(2)?,
                created_at: row.get(3)?,
            })
        }).optional()
            .map_err(|e| format!("Failed to retrieve voice print: {}", e))?;

        Ok(voice_print)
    }

    pub fn save_connector_credentials(
        &self,
        user_id: &str,
        name: &str,
        connector_type: &str,
        credentials: &str,
    ) -> Result<Connector, String> {
        let conn = self.conn.lock()
            .map_err(|_| "Failed to acquire database lock".to_string())?;

        let id = Uuid::new_v4().to_string();
        let now = chrono::Local::now().to_rfc3339();

        conn.execute(
            "INSERT INTO connectors (id, name, type, credentials, status, user_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&id, name, connector_type, credentials, "connected", user_id, &now],
        ).map_err(|e| format!("Failed to save connector: {}", e))?;

        Ok(Connector {
            id,
            name: name.to_string(),
            connector_type: connector_type.to_string(),
            credentials: credentials.to_string(),
            status: "connected".to_string(),
            user_id: user_id.to_string(),
            created_at: now,
        })
    }

    pub fn get_connector_credentials(&self, user_id: &str, connector_type: &str) -> Result<Option<Connector>, String> {
        let conn = self.conn.lock()
            .map_err(|_| "Failed to acquire database lock".to_string())?;

        let mut stmt = conn.prepare(
            "SELECT id, name, type, credentials, status, user_id, created_at FROM connectors WHERE user_id = ?1 AND type = ?2 LIMIT 1"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

        let connector = stmt.query_row([user_id, connector_type], |row| {
            Ok(Connector {
                id: row.get(0)?,
                name: row.get(1)?,
                connector_type: row.get(2)?,
                credentials: row.get(3)?,
                status: row.get(4)?,
                user_id: row.get(5)?,
                created_at: row.get(6)?,
            })
        }).optional()
            .map_err(|e| format!("Failed to retrieve connector: {}", e))?;

        Ok(connector)
    }
}

// Simple datetime formatting for RFC3339
mod chrono {
    use std::time::SystemTime;

    pub struct Local;

    impl Local {
        pub fn now() -> DateTime {
            DateTime {
                timestamp: SystemTime::now(),
            }
        }
    }

    pub struct DateTime {
        timestamp: SystemTime,
    }

    impl DateTime {
        pub fn to_rfc3339(&self) -> String {
            use std::time::UNIX_EPOCH;

            let duration = self.timestamp
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default();

            let secs = duration.as_secs();
            let millis = duration.subsec_millis();

            // Simple ISO 8601 format (YYYY-MM-DDTHH:MM:SS.fffZ)
            // For MVP, use a placeholder with current unix timestamp
            format!("2026-09-19T{:02}:{:02}:{:02}Z",
                (secs % 86400) / 3600,
                (secs % 3600) / 60,
                secs % 60
            )
        }
    }
}
