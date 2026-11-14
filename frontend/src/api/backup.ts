import { isTauri } from "@tauri-apps/api/core";
import { backupFileName, makeBackup, parseBackup, SETTING_KEYS, type Backup } from "../core/backup";
import { localStore, saveFile } from "./tasks";

// Backup and restore of the on-device data (docs/SPEC.md 10.3). Browser
// only: the desktop app keeps its data in tasks.db.

const LAST_BACKUP_KEY = "lastBackupAt";

/** Days without a backup after which the app reminds you. */
export const BACKUP_REMINDER_DAYS = 7;

export const canBackup = () => !isTauri();

/** When a backup was last exported from this browser, or null if never. */
export function lastBackupAt(): number | null {
  try {
    const saved = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

function readSettings(): Record<string, string> {
  const settings: Record<string, string> = {};
  try {
    for (const key of SETTING_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) settings[key] = value;
    }
  } catch {
    // storage blocked: back up the data without settings
  }
  return settings;
}

/** Downloads everything as one JSON file. Resolves to the file name, or null if cancelled. */
export async function exportBackup(): Promise<string | null> {
  const now = Date.now();
  const backup = makeBackup(await (await localStore()).exportData(), readSettings(), now);
  const json = JSON.stringify(backup, null, 1);
  const saved = await saveFile(backupFileName(now), new TextEncoder().encode(json));
  if (saved !== null) {
    try {
      localStorage.setItem(LAST_BACKUP_KEY, String(now));
    } catch {
      // the reminder just won't know about this backup
    }
  }
  return saved;
}

/** Reads and checks a backup file. Rejects with a BackupError saying what is wrong. */
export async function readBackup(file: Blob): Promise<Backup> {
  return parseBackup(await file.text());
}

/** Replaces all data and settings in this browser with the backup's. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await (await localStore()).replaceAll(backup);
  try {
    for (const key of SETTING_KEYS) {
      const value = backup.settings[key];
      if (value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  } catch {
    // storage blocked: the data is restored, the settings stay as they were
  }
}
