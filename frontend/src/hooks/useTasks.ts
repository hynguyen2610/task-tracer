import { useCallback, useEffect, useState } from "react";
import * as api from "../api/tasks";
import type { Priority, Status, Task, TaskChanges } from "../types";

const POLL_INTERVAL_MS = 1000;

/** Task list state, kept fresh by polling the backend every second. */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  /** False until the first read, so an empty list is known to be really empty. */
  const [loaded, setLoaded] = useState(false);

  const fetchTasks = useCallback(async () => {
    setTasks(await api.getTasks());
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  /** `startedAt` reuses the start date of an earlier task with the same title. */
  const addTask = async (title: string, priority: Priority, startedAt?: number) => {
    await api.createTask(title, priority, startedAt);
    fetchTasks();
  };

  const toggleTask = async (id: number) => {
    await api.toggleTask(id);
    fetchTasks();
  };

  /**
   * Pauses a running task and returns it with its time brought up to date.
   * Only call it for a task that is running: the endpoint toggles.
   */
  const pauseTask = async (id: number): Promise<Task | undefined> => {
    const all = await api.toggleTask(id);
    setTasks(all);
    return all.find((t) => t.id === id);
  };

  const updateTask = async (
    id: number,
    changes: TaskChanges
  ) => {
    await api.updateTask(id, changes);
    fetchTasks();
  };

  const setStatus = async (id: number, status: Status) => {
    await api.updateStatus(id, status);
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await api.deleteTask(id);
    fetchTasks();
  };

  /** Moves a task optimistically, then saves the new order. */
  const moveTask = async (fromIndex: number, toIndex: number) => {
    const reordered = Array.from(tasks);
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setTasks(reordered);
    await api.reorderTasks(reordered.map((t) => t.id));
  };

  return {
    tasks,
    loaded,
    addTask,
    toggleTask,
    pauseTask,
    updateTask,
    setStatus,
    deleteTask,
    moveTask,
  };
}
