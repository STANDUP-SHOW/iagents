use std::path::Path;
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, OptionalExtension, params};
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
    pub mfcc_data: String, // Plain JSON, stored as-is
    pub created_at: String,
}

pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Ouvre la base du poste au chemin donné.
    ///
    /// Elle prenait une chaîne, et `main` lui passait `"iagent.db"` : un chemin
    /// relatif au dossier courant, c'est-à-dire au dossier d'où l'application a
    /// été lancée. Un `Path` ne corrige pas ça tout seul, mais il rend visible
    /// que l'appelant doit dire OÙ.
    pub fn new(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                format!("création de {} : {}", parent.display(), e)
            })?;
        }

        let conn = Connection::open(db_path)
            .map_err(|e| format!("ouverture de {} : {}", db_path.display(), e))?;

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

        Ok(())
    }

    pub fn create_or_get_user(&self, username: &str, email: &str) -> Result<User, String> {
        let conn = self.conn.lock()
            .map_err(|_| "Failed to acquire database lock".to_string())?;

        let user_id = Uuid::new_v4().to_string();
        let now = horodatage();

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
        let now = horodatage();

        // `voice_prints.user_id` references `users(id)`, and the bundled SQLite
        // enforces foreign keys. Nothing ever created the owner's row, so on
        // every real install the first voice print was refused (« FOREIGN KEY
        // constraint failed », max's PC, 11/10/2026). The owner is created
        // here, in the same transaction, so the print cannot be orphaned.
        let tx = conn.unchecked_transaction()
            .map_err(|e| format!("la base du poste n'a pas pu s'ouvrir en écriture : {}", e))?;
        tx.execute(
            "INSERT OR IGNORE INTO users (id, username, email, created_at) VALUES (?1, ?1, ?1, ?2)",
            params![user_id, &now],
        ).map_err(|e| format!("la personne du poste n'a pas pu être inscrite : {}", e))?;
        tx.execute(
            "INSERT OR REPLACE INTO voice_prints (id, user_id, mfcc_data, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![&id, user_id, mfcc_data, &now],
        ).map_err(|e| format!("l'empreinte n'a pas pu être rangée : {}", e))?;
        tx.commit()
            .map_err(|e| format!("l'empreinte n'a pas pu être rangée : {}", e))?;

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

    // Il y avait ici `save_connector_credentials` et `get_connector_credentials`,
    // qui écrivaient le jeton d'un connecteur en clair dans une colonne
    // `credentials` de ce SQLite. Personne ne les appelait — le seul candidat,
    // Telegram, avait été ramené en mémoire — et la structure portait pour tout
    // garde-fou un commentaire disant de ne jamais y mettre de secret. Un champ
    // qu'il ne faut jamais remplir n'est pas un garde-fou : c'est une invitation
    // à laquelle le prochain répondra. Le secret d'un connecteur va au trousseau
    // du système, comme la clé d'API (`llm::cle_api`) et les jetons MCP, et
    // c'est là que le prochain branchement ira le chercher.
}

/// L'heure du poste, au format qu'on range en base.
///
/// Il y avait ici un faux module `chrono` dont `to_rfc3339` écrivait
/// `2026-09-19T<hh>:<mm>:<ss>Z` : la date en dur, seule l'heure calculée. Tout
/// ce que cette base a daté jusqu'ici dit donc le 19 septembre 2026. Le
/// calendrier vit une seule fois, dans `tache::civil`, qui le dit lui-même :
/// deux implémentations du même calcul finissent par diverger.
fn horodatage() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secondes = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    crate::tache::date_rfc3339(secondes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn une_empreinte_se_range_sur_une_base_neuve() {
        // Seen on max's PC on 11/10/2026: the very first save failed because
        // no `users` row existed for the owner.
        let dossier = std::env::temp_dir().join(format!("iagent-base-{}", Uuid::new_v4()));
        let base = Database::new(&dossier.join("temoin.sqlite")).unwrap();
        base.init().unwrap();
        {
            let conn = base.conn.lock().unwrap();
            let actives: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0)).unwrap();
            assert_eq!(actives, 1, "the test only means something if foreign keys are enforced");
        }

        base.save_voice_print("proprietaire", "{\"a\":1}").unwrap();
        // A second recording replaces the first instead of failing.
        base.save_voice_print("proprietaire", "{\"a\":2}").unwrap();
        let rangee = base.get_voice_print("proprietaire").unwrap().unwrap();
        assert_eq!(rangee.mfcc_data, "{\"a\":2}");
        let _ = std::fs::remove_dir_all(dossier);
    }
}
