use serde::{Serialize, Serializer};

/// Errors returned to the frontend, where `invoke` rejects with the message.
#[derive(Debug)]
pub enum AppError {
    Db(rusqlite::Error),
    Io(std::io::Error),
    /// Unknown task id (was HTTP 404).
    NotFound,
    /// Action not allowed in the task's current state (was HTTP 409).
    Conflict(String),
    /// Bad input (was HTTP 400).
    Invalid(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Db(e) => write!(f, "Database error: {e}"),
            AppError::Io(e) => write!(f, "File error: {e}"),
            AppError::NotFound => write!(f, "Task not found"),
            AppError::Conflict(msg) | AppError::Invalid(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Db(e)
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e)
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
