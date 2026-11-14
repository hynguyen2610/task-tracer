import { invoke, isTauri } from "@tauri-apps/api/core";
import { IdbStore } from "../core/idbStore";
import type { Activity, Priority, Status, Task, TaskChanges } from "../types";

// In the desktop app each function calls a Rust command in
// src-tauri/src/lib.rs. In a browser it runs the same rules (src/core/) on
// data kept in IndexedDB on this device. Either way a failed call rejects
// with the error message (e.g. "Task not found").

let store: Promise<IdbStore> | null = null;

/** The on-device database, opened on first use. */
function local(): Promise<IdbStore> {
  store ??= IdbStore.open().catch((e) => {
    store = null; // try again on the next call
    throw e;
  });
  return store;
}

export async function getTasks(): Promise<Task[]> {
  if (isTauri()) return invoke<Task[]>("get_tasks");
  return (await local()).getTasks(Date.now());
}

/** `startedAt` reuses the start date of an earlier task with the same title. */
export async function createTask(title: string, priority: Priority, startedAt?: number) {
  if (isTauri()) await invoke<Task>("create_task", { title, priority, startedAt });
  else await (await local()).createTask(title, priority, startedAt);
}

/** Work sessions overlapping [from, to) and task events inside it (epoch ms). */
export async function getActivity(from: number, to: number): Promise<Activity> {
  if (isTauri()) return invoke<Activity>("get_activity", { from, to });
  return (await local()).getActivity(from, to);
}

/** Starts or pauses a task. Returns every task, with times brought up to date. */
export async function toggleTask(id: number): Promise<Task[]> {
  if (isTauri()) return invoke<Task[]>("toggle_task", { id });
  return (await local()).toggleTask(id, Date.now());
}

export async function updateTask(id: number, changes: TaskChanges) {
  if (isTauri()) await invoke("update_task", { id, changes });
  else await (await local()).updateTask(id, changes, Date.now());
}

/** Changes only the status; every other field keeps its value. */
export async function updateStatus(id: number, status: Status) {
  await updateTask(id, { status });
}

export async function deleteTask(id: number) {
  if (isTauri()) await invoke("delete_task", { id });
  else await (await local()).deleteTask(id, Date.now());
}

export async function reorderTasks(ids: number[]) {
  if (isTauri()) await invoke("reorder_tasks", { ids });
  else await (await local()).reorderTasks(ids);
}

/**
 * Saves a file. In the desktop app it shows a save dialog and resolves to the
 * saved path, or null if the user cancelled. In a browser it downloads the
 * file and resolves to its name.
 */
export async function saveFile(
  defaultName: string,
  contents: Uint8Array
): Promise<string | null> {
  if (isTauri()) {
    return invoke<string | null>("save_file", {
      defaultName,
      contents: Array.from(contents),
    });
  }
  const url = URL.createObjectURL(
    new Blob([contents as BlobPart], { type: "application/octet-stream" })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return defaultName;
}
