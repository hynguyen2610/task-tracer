import { useEffect, useRef, useState } from "react"
import axios from "axios"
import { Play, Pause, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

import TaskForm from "./components/TaskForm"
import TaskList from "./components/TaskList"
import { formatTime } from "./utils/formatTime"
import type { Task } from "./types"
import './App.css'

const API_URL = "http://localhost:4000"

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState("")
  const [newPriority, setNewPriority] = useState<Task["priority"]>("Normal")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editTime, setEditTime] = useState("")
  const [editPriority, setEditPriority] = useState<Task["priority"]>("Normal")
  const [globalRunning, setGlobalRunning] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTasks = async () => {
    const res = await axios.get<Task[]>(`${API_URL}/tasks`)
    setTasks(res.data)
  }

  const addTask = async () => {
    if (!newTitle.trim()) return
    await axios.post<Task>(`${API_URL}/tasks`, {
      title: newTitle,
      priority: newPriority,
    })
    setNewTitle("")
    setNewPriority("Normal")
    fetchTasks()
  }

  const toggleTask = async (id: number) => {
    await axios.post<Task[]>(`${API_URL}/tasks/${id}/toggle`)
    fetchTasks()
  }

  const deleteTask = async (id: number) => {
    await axios.delete(`${API_URL}/tasks/${id}`)
    fetchTasks()
  }

  const startEditing = (task: Task) => {
    setEditingId(task.id)
    setEditTitle(task.title)
    const h = String(Math.floor(task.totalSeconds / 3600)).padStart(2, "0")
    const m = String(Math.floor((task.totalSeconds % 3600) / 60)).padStart(2, "0")
    setEditTime(`${h}:${m}`)
    setEditPriority(task.priority)
  }

  const saveEdit = async (id: number) => {
    const [h, m] = editTime.split(":").map(Number)
    const totalSeconds = h * 3600 + m * 60
    await axios.put(`${API_URL}/tasks/${id}`, {
      title: editTitle,
      totalSeconds,
      priority: editPriority,
    })
    setEditingId(null)
    setEditTitle("")
    setEditTime("")
    setEditPriority("Normal")
    fetchTasks()
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

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return
    const reordered = Array.from(tasks)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setTasks(reordered)
    await axios.post(`${API_URL}/tasks/reorder`, {
      ids: reordered.map((t) => t.id),
    })
  }

  const exportToExcel = () => {
    const data = tasks.map((t) => ({
      "Total Time (hours)": (t.totalSeconds / 3600).toFixed(2),
      Title: t.title,
    }))
    const worksheet = XLSX.utils.json_to_sheet(data)
    const maxTitleLength = Math.max("Title".length, ...tasks.map((t) => t.title.length))
    worksheet["!cols"] = [{ wch: 18 }, { wch: maxTitleLength + 5 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks")
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" })
    saveAs(blob, "tasks.xlsx")
  }

  useEffect(() => {
    fetchTasks()
    intervalRef.current = setInterval(fetchTasks, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const totalAllSeconds = tasks.reduce((sum, t) => sum + t.totalSeconds, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 relative">
        <button
          onClick={toggleGlobal}
          className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full text-white transition ${
            globalRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {globalRunning ? <Pause /> : <Play />}
        </button>

        <h1 className="text-2xl font-bold text-gray-800 mb-6">Task Tracker</h1>

        <TaskForm
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          newPriority={newPriority}
          setNewPriority={setNewPriority}
          addTask={addTask}
        />

        <div className="mb-4 flex items-center justify-end space-x-2">
          <p className="text-right text-gray-700 font-medium">
            Total Time (All Tasks): {formatTime(totalAllSeconds)}
          </p>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center"
          >
            <span className="sr-only">Export to Excel</span>
            <FileSpreadsheet className="h-6 w-6" />
          </button>
        </div>

        <TaskList
          tasks={tasks}
          editingId={editingId}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editTime={editTime}
          setEditTime={setEditTime}
          editPriority={editPriority}
          setEditPriority={setEditPriority}
          startEditing={startEditing}
          saveEdit={saveEdit}
          toggleTask={toggleTask}
          deleteTask={deleteTask}
          handleDragEnd={handleDragEnd}
        />
      </div>
    </div>
  )
}
