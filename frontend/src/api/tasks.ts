import { invoke } from "@tauri-apps/api/core";
import type { Priority, Status, Task, TaskChanges } from "../types";

// Each function calls a Rust command in src-tauri/src/lib.rs. A failed call
// rejects with the error message (e.g. "Task not found").

export async function getTasks(): Promise<Task[]> {
  return invoke<Task[]>("get_tasks");
}

export async function createTask(title: string, priority: Priority) {
  await invoke<Task>("create_task", { title, priority });
}

/** Starts or pauses a task. Returns every task, with times brought up to date. */
export async function toggleTask(id: number): Promise<Task[]> {
  return invoke<Task[]>("toggle_task", { id });
}

export async function updateTask(id: number, changes: TaskChanges) {
  await invoke("update_task", { id, changes });
}

/** Changes only the status; every other field keeps its value. */
export async function updateStatus(id: number, status: Status) {
  await invoke("update_task", { id, changes: { status } });
}

export async function deleteTask(id: number) {
  await invoke("delete_task", { id });
}

export async function reorderTasks(ids: number[]) {
  await invoke("reorder_tasks", { ids });
}

/**
 * Shows a save dialog and writes the file. Resolves to the saved path, or
 * null if the user cancelled.
 */
export async function saveFile(
  defaultName: string,
  contents: Uint8Array
): Promise<string | null> {
  return invoke<string | null>("save_file", {
    defaultName,
    contents: Array.from(contents),
  });
}
