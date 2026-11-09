use std::path::Path;

use rusqlite::{params, Connection};

/// Opens (or creates) the database and brings its schema up to date.
pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let mut conn = Connection::open(path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            totalSeconds INTEGER NOT NULL DEFAULT 0,
            isRunning INTEGER NOT NULL DEFAULT 0,
            lastStart INTEGER,
            position INTEGER,
            priority TEXT NOT NULL DEFAULT 'Normal',
            status TEXT NOT NULL DEFAULT 'Todo',
            statusNote TEXT,
            startedAt INTEGER,
            lastWorkedAt INTEGER
        )",
        [],
    )?;

    // Databases from older versions (including the Express backend's
    // tasks.db) may be missing these columns. See docs/SPEC.md 4.6.
    add_column_if_missing(
        &mut conn,
        "status",
        "TEXT NOT NULL DEFAULT 'Todo'",
        &["UPDATE tasks SET status = 'In progress' WHERE isRunning = 1"],
    )?;
    add_column_if_missing(&mut conn, "statusNote", "TEXT", &[])?;
    add_column_if_missing(
        &mut conn,
        "startedAt",
        "INTEGER",
        &["UPDATE tasks SET startedAt = lastStart WHERE lastStart IS NOT NULL"],
    )?;
    add_column_if_missing(
        &mut conn,
        "lastWorkedAt",
        "INTEGER",
        &["UPDATE tasks SET lastWorkedAt = lastStart WHERE lastStart IS NOT NULL"],
    )?;

    // Very old rows had no position; number them in id order.
    let unpositioned: Vec<i64> = conn
        .prepare("SELECT id FROM tasks WHERE position IS NULL ORDER BY id")?
        .query_map([], |row| row.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    for (idx, id) in unpositioned.iter().enumerate() {
        conn.execute(
            "UPDATE tasks SET position = ?1 WHERE id = ?2",
            params![idx as i64, id],
        )?;
    }

    let count: i64 = conn.query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0))?;
    if count == 0 {
        conn.execute(
            "INSERT INTO tasks (title, position) VALUES (?1, 0)",
            ["First task of the day"],
        )?;
    }

    Ok(conn)
}

fn add_column_if_missing(
    conn: &mut Connection,
    name: &str,
    definition: &str,
    backfill: &[&str],
) -> rusqlite::Result<()> {
    let exists = conn
        .prepare("SELECT 1 FROM pragma_table_info('tasks') WHERE name = ?1")?
        .exists([name])?;
    if exists {
        return Ok(());
    }
    let tx = conn.transaction()?;
    tx.execute(&format!("ALTER TABLE tasks ADD COLUMN {name} {definition}"), [])?;
    for sql in backfill {
        tx.execute(sql, [])?;
    }
    tx.commit()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_a_database_from_the_express_backend() {
        let dir = std::env::temp_dir().join(format!("task-tracker-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("old.db");
        let _ = std::fs::remove_file(&path);
        {
            // Schema before status existed, with one running and one idle task.
            let old = Connection::open(&path).unwrap();
            old.execute_batch(
                "CREATE TABLE tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
                   totalSeconds INTEGER NOT NULL DEFAULT 0, isRunning INTEGER NOT NULL DEFAULT 0,
                   lastStart INTEGER, position INTEGER, priority TEXT NOT NULL DEFAULT 'Normal');
                 INSERT INTO tasks (title, isRunning, lastStart, position) VALUES ('running', 1, 1000, 0);
                 INSERT INTO tasks (title, position) VALUES ('idle', NULL);",
            )
            .unwrap();
        }
        let conn = open(&path).unwrap();
        let rows: Vec<(String, String, Option<i64>, Option<i64>, i64)> = conn
            .prepare("SELECT title, status, startedAt, lastWorkedAt, position FROM tasks ORDER BY id")
            .unwrap()
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(rows[0], ("running".into(), "In progress".into(), Some(1000), Some(1000), 0));
        assert_eq!(rows[1], ("idle".into(), "Todo".into(), None, None, 0));
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
