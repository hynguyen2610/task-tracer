import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "../api/tasks";
import type { Priority, Task, TaskChanges } from "../types";

const POLL_INTERVAL_MS = 1000;

/** Task list state, kept fresh by polling the backend every second. */
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    setTasks(await api.getTasks());
  }, []);

  const startPolling = useCallback(() => {
    fetchTasks();
    intervalRef.current = setInterval(fetchTasks, POLL_INTERVAL_MS);
    setIsPolling(true);
  }, [fetchTasks]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsPolling(false);
  }, []);

  const togglePolling = () => (isPolling ? stopPolling() : startPolling());

  useEffect(() => {
    startPolling();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startPolling]);

  const addTask = async (title: string, priority: Priority) => {
    await api.createTask(title, priority);
    fetchTasks();
  };

  const toggleTask = async (id: number) => {
    await api.toggleTask(id);
    fetchTasks();
  };

  const updateTask = async (
    id: number,
    changes: TaskChanges
  ) => {
    await api.updateTask(id, changes);
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
    isPolling,
    togglePolling,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    moveTask,
  };
}
