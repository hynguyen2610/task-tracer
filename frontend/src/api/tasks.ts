import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Activity, Priority, Status, Task, TaskChanges } from "../types";

// In the desktop app each function calls a Rust command in
// src-tauri/src/lib.rs. In a plain browser it calls the Express backend
// (backend/) over HTTP instead. Either way a failed call rejects with the
// error message (e.g. "Task not found").

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = text || res.statusText;
    try {
      message = JSON.parse(text).error ?? message;
    } catch {
      // Plain-text error body; keep it as is.
    }
    throw new Error(message);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function getTasks(): Promise<Task[]> {
  if (isTauri()) return invoke<Task[]>("get_tasks");
  return http<Task[]>("GET", "/tasks");
}

/** `startedAt` reuses the start date of an earlier task with the same title. */
export async function createTask(title: string, priority: Priority, startedAt?: number) {
  if (isTauri()) await invoke<Task>("create_task", { title, priority, startedAt });
  else await http<Task>("POST", "/tasks", { title, priority, startedAt });
}

/** Work sessions overlapping [from, to) and task events inside it (epoch ms). */
export async function getActivity(from: number, to: number): Promise<Activity> {
  if (isTauri()) return invoke<Activity>("get_activity", { from, to });
  return http<Activity>("GET", `/activity?from=${from}&to=${to}`);
}

/** Starts or pauses a task. Returns every task, with times brought up to date. */
export async function toggleTask(id: number): Promise<Task[]> {
  if (isTauri()) return invoke<Task[]>("toggle_task", { id });
  return http<Task[]>("POST", `/tasks/${id}/toggle`);
}

export async function updateTask(id: number, changes: TaskChanges) {
  if (isTauri()) await invoke("update_task", { id, changes });
  else await http("PUT", `/tasks/${id}`, changes);
}

/** Changes only the status; every other field keeps its value. */
export async function updateStatus(id: number, status: Status) {
  if (isTauri()) await invoke("update_task", { id, changes: { status } });
  else await http("PUT", `/tasks/${id}`, { status });
}

export async function deleteTask(id: number) {
  if (isTauri()) await invoke("delete_task", { id });
  else await http("DELETE", `/tasks/${id}`);
}

export async function reorderTasks(ids: number[]) {
  if (isTauri()) await invoke("reorder_tasks", { ids });
  else await http("POST", "/tasks/reorder", { ids });
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
