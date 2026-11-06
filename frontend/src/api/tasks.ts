import axios from "axios";
import type { Priority, Task, TaskChanges } from "../types";

const API_URL = "http://localhost:4000";

export async function getTasks(): Promise<Task[]> {
  const res = await axios.get<Task[]>(`${API_URL}/tasks`);
  return res.data;
}

export async function createTask(title: string, priority: Priority) {
  await axios.post<Task>(`${API_URL}/tasks`, { title, priority });
}

/** Starts or pauses a task. Returns every task, with times brought up to date. */
export async function toggleTask(id: number): Promise<Task[]> {
  const res = await axios.post<Task[]>(`${API_URL}/tasks/${id}/toggle`);
  return res.data;
}

export async function updateTask(
  id: number,
  changes: TaskChanges
) {
  await axios.put(`${API_URL}/tasks/${id}`, changes);
}

export async function deleteTask(id: number) {
  await axios.delete(`${API_URL}/tasks/${id}`);
}

export async function reorderTasks(ids: number[]) {
  await axios.post(`${API_URL}/tasks/reorder`, { ids });
}
