import { useEffect, useRef, useState } from "react"
import axios from "axios"
import type { Task } from "../types"

const API_URL = "http://localhost:4000"

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [globalRunning, setGlobalRunning] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTasks = async () => {
    const res = await axios.get<Task[]>(`${API_URL}/tasks`)
    setTasks(res.data)
  }

  const addTask = async (title: string, priority: Task["priority"]) => {
    if (!title.trim()) return
    await axios.post<Task>(`${API_URL}/tasks`, { title, priority })
    fetchTasks()
  }

  const toggleTask = async (id: number) => {
    await axios.post(`${API_URL}/tasks/${id}/toggle`)
    fetchTasks()
  }

  const deleteTask = async (id: number) => {
    await axios.delete(`${API_URL}/tasks/${id}`)
    fetchTasks()
  }

  const saveTask = async (id: number, data: Partial<Task>) => {
    await axios.put(`${API_URL}/tasks/${id}`, data)
    fetchTasks()
  }

  const reorderTasks = async (ids: number[]) => {
    setTasks(prev => {
      const reordered = ids.map(id => prev.find(t => t.id === id)!)
      return reordered
    })
    await axios.post(`${API_URL}/tasks/reorder`, { ids })
  }

  const toggleGlobal = () => {
    if (globalRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      setGlobalRunning(false)
    } else {
      fetchTasks()
      intervalRef.current = setInterval(fetchTasks, 1000)
      setGlobalRunning(true)
    }
  }

  useEffect(() => {
    fetchTasks()
    intervalRef.current = setInterval(fetchTasks, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { tasks, addTask, toggleTask, deleteTask, saveTask, reorderTasks, globalRunning, toggleGlobal }
}
