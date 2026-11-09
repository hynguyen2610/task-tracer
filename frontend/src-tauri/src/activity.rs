//! Work history for the statistics screen. See docs/SPEC.md section 9.
//!
//! - A work session is one stretch of the timer running on one task.
//! - A task event is a status change or a time adjustment (total time typed
//!   in the edit form).
//!
//! Rows copy the task title and have no foreign key, so history survives
//! renames and deleted tasks.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::AppResult;

pub const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS work_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId INTEGER NOT NULL,
        taskTitle TEXT NOT NULL,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER
    );
    CREATE INDEX IF NOT EXISTS work_sessions_startedAt ON work_sessions (startedAt);
    CREATE TABLE IF NOT EXISTS task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        taskId INTEGER NOT NULL,
        taskTitle TEXT NOT NULL,
        type TEXT NOT NULL,
        at INTEGER NOT NULL,
        status TEXT,
        fromSeconds INTEGER,
        toSeconds INTEGER
    );
    CREATE INDEX IF NOT EXISTS task_events_at ON task_events (at);
";

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkSession {
    pub id: i64,
    pub task_id: i64,
    pub task_title: String,
    pub started_at: i64,
    /// `None` while the timer is still running.
    pub ended_at: Option<i64>,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TaskEvent {
    pub id: i64,
    pub task_id: i64,
    pub task_title: String,
    /// "status" or "adjustment".
    #[serde(rename = "type")]
    pub kind: String,
    pub at: i64,
    /// New status, for "status" events.
    pub status: Option<String>,
    /// Total time before and after, for "adjustment" events.
    pub from_seconds: Option<i64>,
    pub to_seconds: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct Activity {
    pub sessions: Vec<WorkSession>,
    pub events: Vec<TaskEvent>,
}

pub fn open_session(conn: &Connection, task_id: i64, title: &str, now: i64) -> AppResult<()> {
    conn.execute(
        "INSERT INTO work_sessions (taskId, taskTitle, startedAt) VALUES (?1, ?2, ?3)",
        params![task_id, title, now],
    )?;
    Ok(())
}

/// Ends the open session of one task, or of every task when `task_id` is `None`.
pub fn close_sessions(conn: &Connection, task_id: Option<i64>, now: i64) -> AppResult<()> {
    match task_id {
        Some(id) => conn.execute(
            "UPDATE work_sessions SET endedAt = ?1 WHERE endedAt IS NULL AND taskId = ?2",
            params![now, id],
        )?,
        None => conn.execute(
            "UPDATE work_sessions SET endedAt = ?1 WHERE endedAt IS NULL",
            [now],
        )?,
    };
    Ok(())
}

pub fn record_status(conn: &Connection, task_id: i64, title: &str, status: &str, now: i64) -> AppResult<()> {
    conn.execute(
        "INSERT INTO task_events (taskId, taskTitle, type, at, status)
         VALUES (?1, ?2, 'status', ?3, ?4)",
        params![task_id, title, now, status],
    )?;
    Ok(())
}

pub fn record_adjustment(
    conn: &Connection,
    task_id: i64,
    title: &str,
    from_seconds: i64,
    to_seconds: i64,
    now: i64,
) -> AppResult<()> {
    conn.execute(
        "INSERT INTO task_events (taskId, taskTitle, type, at, fromSeconds, toSeconds)
         VALUES (?1, ?2, 'adjustment', ?3, ?4, ?5)",
        params![task_id, title, now, from_seconds, to_seconds],
    )?;
    Ok(())
}

/// Sessions that overlap `[from, to)` and events inside it, oldest first.
pub fn between(conn: &Connection, from: i64, to: i64) -> AppResult<Activity> {
    let sessions = conn
        .prepare(
            "SELECT id, taskId, taskTitle, startedAt, endedAt FROM work_sessions
             WHERE startedAt < ?2 AND (endedAt IS NULL OR endedAt > ?1)
             ORDER BY startedAt, id",
        )?
        .query_map(params![from, to], |r| {
            Ok(WorkSession {
                id: r.get(0)?,
                task_id: r.get(1)?,
                task_title: r.get(2)?,
                started_at: r.get(3)?,
                ended_at: r.get(4)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    let events = conn
        .prepare(
            "SELECT id, taskId, taskTitle, type, at, status, fromSeconds, toSeconds
             FROM task_events WHERE at >= ?1 AND at < ?2 ORDER BY at, id",
        )?
        .query_map(params![from, to], |r| {
            Ok(TaskEvent {
                id: r.get(0)?,
                task_id: r.get(1)?,
                task_title: r.get(2)?,
                kind: r.get(3)?,
                at: r.get(4)?,
                status: r.get(5)?,
                from_seconds: r.get(6)?,
                to_seconds: r.get(7)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(Activity { sessions, events })
}
