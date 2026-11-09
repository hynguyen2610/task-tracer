mod db;
mod error;
mod tasks;

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

use error::AppResult;
use tasks::{Task, TaskUpdate};

/// One connection, used by one command at a time.
struct AppState {
    db: Mutex<Connection>,
}

/// Runs `f` inside a transaction, so every command's changes are all-or-nothing.
fn with_tx<T>(state: &State<AppState>, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
    let mut conn = state.db.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let tx = conn.transaction()?;
    let result = f(&tx)?;
    tx.commit()?;
    Ok(result)
}

#[tauri::command]
fn get_tasks(state: State<AppState>) -> AppResult<Vec<Task>> {
    with_tx(&state, tasks::list)
}

#[tauri::command]
fn create_task(state: State<AppState>, title: String, priority: Option<String>) -> AppResult<Task> {
    with_tx(&state, |c| tasks::create(c, &title, priority.as_deref()))
}

#[tauri::command]
fn toggle_task(state: State<AppState>, id: i64) -> AppResult<Vec<Task>> {
    with_tx(&state, |c| tasks::toggle(c, id))
}

#[tauri::command]
fn update_task(state: State<AppState>, id: i64, changes: TaskUpdate) -> AppResult<()> {
    with_tx(&state, |c| tasks::update(c, id, &changes))
}

#[tauri::command]
fn reorder_tasks(state: State<AppState>, ids: Vec<i64>) -> AppResult<()> {
    with_tx(&state, |c| tasks::reorder(c, &ids))
}

#[tauri::command]
fn delete_task(state: State<AppState>, id: i64) -> AppResult<()> {
    with_tx(&state, |c| tasks::delete(c, id))
}

/// Asks where to save, then writes the file. Returns the chosen path, or
/// `None` if the user cancelled. Async so the blocking dialog doesn't run on
/// the main thread.
#[tauri::command]
async fn save_file(
    app: tauri::AppHandle,
    default_name: String,
    contents: Vec<u8>,
) -> AppResult<Option<String>> {
    let extension = std::path::Path::new(&default_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let mut dialog = app.dialog().file().set_file_name(&default_name);
    if !extension.is_empty() {
        dialog = dialog.add_filter(extension.to_uppercase(), &[extension.as_str()]);
    }
    let Some(choice) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = choice
        .into_path()
        .map_err(|e| error::AppError::Invalid(format!("Unsupported save location: {e}")))?;
    std::fs::write(&path, contents)?;
    Ok(Some(path.display().to_string()))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // e.g. %APPDATA%\com.hy.tasktracker\tasks.db on Windows
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::open(&dir.join("tasks.db"))?;
            app.manage(AppState { db: Mutex::new(conn) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            create_task,
            toggle_task,
            update_task,
            reorder_tasks,
            delete_task,
            save_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Task Tracker");
}
