//! Task rules. See docs/SPEC.md sections 4 and 5.

use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const STATUSES: [&str; 5] = ["Todo", "In progress", "Pending", "Done", "Canceled"];

/// Statuses whose timer can't be started.
const UNSTARTABLE: [&str; 3] = ["Pending", "Done", "Canceled"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub total_seconds: i64,
    pub is_running: bool,
    pub last_start: Option<i64>,
    pub position: i64,
    pub priority: String,
    pub status: String,
    pub status_note: Option<String>,
    pub started_at: Option<i64>,
    pub last_worked_at: Option<i64>,
}

/// Fields to change. Missing (or null) fields keep their value; an empty
/// `statusNote` clears the note.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskUpdate {
    pub title: Option<String>,
    pub total_seconds: Option<i64>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub status_note: Option<String>,
    /// Start date picked by hand, as epoch ms.
    pub started_at: Option<i64>,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn row_to_task(row: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        title: row.get("title")?,
        total_seconds: row.get("totalSeconds")?,
        is_running: row.get::<_, i64>("isRunning")? != 0,
        last_start: row.get("lastStart")?,
        position: row.get::<_, Option<i64>>("position")?.unwrap_or(0),
        priority: row.get("priority")?,
        status: row.get("status")?,
        status_note: row.get("statusNote")?,
        started_at: row.get("startedAt")?,
        last_worked_at: row.get("lastWorkedAt")?,
    })
}

fn get(conn: &Connection, id: i64) -> AppResult<Option<Task>> {
    Ok(conn
        .query_row("SELECT * FROM tasks WHERE id = ?1", [id], row_to_task)
        .optional()?)
}

fn all(conn: &Connection) -> AppResult<Vec<Task>> {
    let tasks = conn
        .prepare("SELECT * FROM tasks ORDER BY position ASC")?
        .query_map([], row_to_task)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(tasks)
}

/// Adds the time elapsed since `lastStart` to the running task.
///
/// Only whole seconds are added, and `lastStart` moves forward by exactly
/// that much, so the leftover fraction carries over to the next update
/// instead of being lost on every poll.
fn update_running(conn: &Connection) -> AppResult<()> {
    let now = now_ms();
    let running: Vec<(i64, i64)> = conn
        .prepare("SELECT id, lastStart FROM tasks WHERE isRunning = 1 AND lastStart IS NOT NULL")?
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    for (id, last_start) in running {
        let elapsed = (now - last_start).max(0) / 1000;
        if elapsed > 0 {
            conn.execute(
                "UPDATE tasks
                 SET totalSeconds = totalSeconds + ?1, lastStart = ?2, lastWorkedAt = ?3
                 WHERE id = ?4",
                params![elapsed, last_start + elapsed * 1000, now, id],
            )?;
        }
    }
    Ok(())
}

pub fn list(conn: &Connection) -> AppResult<Vec<Task>> {
    update_running(conn)?;
    all(conn)
}

pub fn create(conn: &Connection, title: &str, priority: Option<&str>) -> AppResult<Task> {
    let max_pos: Option<i64> = conn.query_row("SELECT MAX(position) FROM tasks", [], |r| r.get(0))?;
    conn.execute(
        "INSERT INTO tasks (title, position, priority) VALUES (?1, ?2, ?3)",
        params![title, max_pos.unwrap_or(-1) + 1, priority.unwrap_or("Normal")],
    )?;
    get(conn, conn.last_insert_rowid())?.ok_or(AppError::NotFound)
}

/// Starts or pauses a task (SPEC 4.3). Returns every task.
pub fn toggle(conn: &Connection, id: i64) -> AppResult<Vec<Task>> {
    update_running(conn)?;
    let task = get(conn, id)?.ok_or(AppError::NotFound)?;
    let now = now_ms();
    if task.is_running {
        conn.execute(
            "UPDATE tasks SET isRunning = 0, lastWorkedAt = ?1 WHERE id = ?2",
            params![now, id],
        )?;
    } else {
        if UNSTARTABLE.contains(&task.status.as_str()) {
            return Err(AppError::Conflict(format!("Cannot start a {} task", task.status)));
        }
        conn.execute("UPDATE tasks SET isRunning = 0", [])?;
        conn.execute(
            "UPDATE tasks
             SET isRunning = 1,
                 lastStart = ?1,
                 lastWorkedAt = ?1,
                 startedAt = COALESCE(startedAt, ?1),
                 status = CASE WHEN status = 'Todo' THEN 'In progress' ELSE status END
             WHERE id = ?2",
            params![now, id],
        )?;
    }
    all(conn)
}

/// Applies an edit (SPEC 4.4).
pub fn update(conn: &Connection, id: i64, changes: &TaskUpdate) -> AppResult<()> {
    if let Some(status) = &changes.status {
        if !STATUSES.contains(&status.as_str()) {
            return Err(AppError::Invalid(format!(
                "status must be one of: {}",
                STATUSES.join(", ")
            )));
        }
    }
    if changes.started_at.is_some_and(|ms| ms < 0) {
        return Err(AppError::Invalid("startedAt must be a date (epoch ms)".into()));
    }
    get(conn, id)?.ok_or(AppError::NotFound)?;

    // A running task must stay In progress, so any other status stops the
    // timer. Bring its time up to date first so no elapsed time is lost.
    if changes.status.as_deref().is_some_and(|s| s != "In progress") {
        update_running(conn)?;
        conn.execute("UPDATE tasks SET isRunning = 0 WHERE id = ?1", [id])?;
    }

    let current = get(conn, id)?.ok_or(AppError::NotFound)?;
    let title = changes.title.clone().unwrap_or(current.title);
    let total_seconds = changes.total_seconds.unwrap_or(current.total_seconds);
    let priority = changes.priority.clone().unwrap_or(current.priority);
    let status = changes.status.clone().unwrap_or_else(|| current.status.clone());
    let status_note = match &changes.status_note {
        None => current.status_note,
        Some(note) => Some(note.trim().to_string()).filter(|n| !n.is_empty()),
    };

    let now = now_ms();
    let worked = status != current.status || total_seconds != current.total_seconds;
    // A date picked by hand wins; otherwise it is set once, on leaving Todo.
    let started_at = changes
        .started_at
        .or(current.started_at)
        .or(if status != "Todo" { Some(now) } else { None });
    let last_worked_at = if worked { Some(now) } else { current.last_worked_at };

    conn.execute(
        "UPDATE tasks
         SET title = ?1, totalSeconds = ?2, priority = ?3, status = ?4, statusNote = ?5,
             startedAt = ?6, lastWorkedAt = ?7
         WHERE id = ?8",
        params![title, total_seconds, priority, status, status_note, started_at, last_worked_at, id],
    )?;
    Ok(())
}

pub fn reorder(conn: &Connection, ids: &[i64]) -> AppResult<()> {
    let mut stmt = conn.prepare("UPDATE tasks SET position = ?1 WHERE id = ?2")?;
    for (idx, id) in ids.iter().enumerate() {
        stmt.execute(params![idx as i64, id])?;
    }
    Ok(())
}

pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Connection {
        // Starts with the seeded "First task of the day" (id 1, Todo).
        crate::db::open(std::path::Path::new(":memory:")).unwrap()
    }

    fn task(conn: &Connection, id: i64) -> Task {
        get(conn, id).unwrap().unwrap()
    }

    fn set(status: &str) -> TaskUpdate {
        TaskUpdate { status: Some(status.into()), ..Default::default() }
    }

    #[test]
    fn new_task_is_todo_and_never_started() {
        let conn = setup();
        let t = create(&conn, "Write report", Some("High")).unwrap();
        assert_eq!(t.status, "Todo");
        assert_eq!(t.position, 1);
        assert!(t.started_at.is_none() && t.last_worked_at.is_none());
    }

    #[test]
    fn starting_a_todo_task_makes_it_in_progress_and_stops_the_other() {
        let conn = setup();
        create(&conn, "Second", None).unwrap();
        toggle(&conn, 1).unwrap();
        toggle(&conn, 2).unwrap();
        let (first, second) = (task(&conn, 1), task(&conn, 2));
        assert!(!first.is_running && first.status == "In progress");
        assert!(second.is_running && second.status == "In progress");
        assert!(second.started_at.is_some() && second.last_worked_at.is_some());
    }

    #[test]
    fn pausing_keeps_in_progress() {
        let conn = setup();
        toggle(&conn, 1).unwrap();
        toggle(&conn, 1).unwrap();
        let t = task(&conn, 1);
        assert!(!t.is_running);
        assert_eq!(t.status, "In progress");
    }

    #[test]
    fn pending_done_and_canceled_cannot_start() {
        for status in UNSTARTABLE {
            let conn = setup();
            update(&conn, 1, &set(status)).unwrap();
            assert!(matches!(toggle(&conn, 1), Err(AppError::Conflict(_))), "{status}");
        }
    }

    #[test]
    fn leaving_in_progress_stops_the_timer_and_keeps_elapsed_time() {
        for status in ["Todo", "Pending", "Done", "Canceled"] {
            let conn = setup();
            toggle(&conn, 1).unwrap();
            // Pretend the timer started 5.5 seconds ago.
            conn.execute("UPDATE tasks SET lastStart = lastStart - 5500 WHERE id = 1", [])
                .unwrap();
            update(&conn, 1, &set(status)).unwrap();
            let t = task(&conn, 1);
            assert!(!t.is_running, "{status}");
            assert_eq!(t.status, status);
            assert_eq!(t.total_seconds, 5, "{status}");
        }
    }

    #[test]
    fn partial_seconds_carry_over_between_updates() {
        let conn = setup();
        toggle(&conn, 1).unwrap();
        // 1.6 s, then another 0.6 s: 2.2 s in total must count as 2, not 1.
        conn.execute("UPDATE tasks SET lastStart = lastStart - 1600 WHERE id = 1", []).unwrap();
        update_running(&conn).unwrap();
        conn.execute("UPDATE tasks SET lastStart = lastStart - 600 WHERE id = 1", []).unwrap();
        update_running(&conn).unwrap();
        assert_eq!(task(&conn, 1).total_seconds, 2);
    }

    #[test]
    fn missing_fields_keep_their_value_and_title_edit_is_not_work() {
        let conn = setup();
        update(&conn, 1, &TaskUpdate { title: Some("Renamed".into()), ..Default::default() })
            .unwrap();
        let t = task(&conn, 1);
        assert_eq!((t.title.as_str(), t.priority.as_str(), t.status.as_str()), ("Renamed", "Normal", "Todo"));
        assert!(t.last_worked_at.is_none() && t.started_at.is_none());
    }

    #[test]
    fn status_note_is_trimmed_kept_and_cleared_by_empty_string() {
        let conn = setup();
        let note = |n: &str| TaskUpdate { status_note: Some(n.into()), ..Default::default() };
        update(&conn, 1, &note("  Waiting for Kiro  ")).unwrap();
        assert_eq!(task(&conn, 1).status_note.as_deref(), Some("Waiting for Kiro"));
        update(&conn, 1, &set("Pending")).unwrap();
        assert_eq!(task(&conn, 1).status_note.as_deref(), Some("Waiting for Kiro"));
        update(&conn, 1, &note("")).unwrap();
        assert_eq!(task(&conn, 1).status_note, None);
    }

    #[test]
    fn leaving_todo_by_hand_sets_start_date_once() {
        let conn = setup();
        update(&conn, 1, &set("Pending")).unwrap();
        let started = task(&conn, 1).started_at.unwrap();
        conn.execute("UPDATE tasks SET startedAt = 123 WHERE id = 1", []).unwrap();
        update(&conn, 1, &set("Done")).unwrap();
        assert!(started > 0);
        assert_eq!(task(&conn, 1).started_at, Some(123));
    }

    #[test]
    fn start_date_can_be_set_by_hand_and_survives_status_changes() {
        let conn = setup();
        let picked = TaskUpdate { started_at: Some(1_700_000_000_000), ..Default::default() };
        update(&conn, 1, &picked).unwrap();
        let t = task(&conn, 1);
        assert_eq!(t.started_at, Some(1_700_000_000_000));
        // Picking a date is not work, and doesn't move the task out of Todo.
        assert!(t.last_worked_at.is_none());
        assert_eq!(t.status, "Todo");

        toggle(&conn, 1).unwrap();
        update(&conn, 1, &set("Done")).unwrap();
        assert_eq!(task(&conn, 1).started_at, Some(1_700_000_000_000));

        let negative = TaskUpdate { started_at: Some(-1), ..Default::default() };
        assert!(matches!(update(&conn, 1, &negative), Err(AppError::Invalid(_))));
    }

    #[test]
    fn invalid_status_and_unknown_task_are_rejected() {
        let conn = setup();
        assert!(matches!(update(&conn, 1, &set("Blocked")), Err(AppError::Invalid(_))));
        assert!(matches!(update(&conn, 99, &set("Done")), Err(AppError::NotFound)));
        assert!(matches!(toggle(&conn, 99), Err(AppError::NotFound)));
    }

    #[test]
    fn reorder_and_delete() {
        let conn = setup();
        create(&conn, "B", None).unwrap();
        create(&conn, "C", None).unwrap();
        reorder(&conn, &[3, 1, 2]).unwrap();
        let titles: Vec<String> = all(&conn).unwrap().into_iter().map(|t| t.title).collect();
        assert_eq!(titles, ["C", "First task of the day", "B"]);
        delete(&conn, 1).unwrap();
        assert_eq!(all(&conn).unwrap().len(), 2);
    }
}
