import { useEffect, useRef, useState } from "react"
import axios from "axios"
import { Play, Pause, Trash2, Edit2, Check, FileSpreadsheet } from "lucide-react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import type { DropResult } from "@hello-pangea/dnd"
import type { Task } from "./types"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

const API_URL = "http://localhost:4000"

function formatTime(totalSeconds: number): string {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0")
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")
  const s = String(totalSeconds % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

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
  const newTaskInputRef = useRef<HTMLInputElement>(null)

  const fetchTasks = async () => {
    const res = await axios.get<Task[]>(`${API_URL}/tasks`)
    setTasks(res.data)
  }

  const addTask = async () => {
    if (!newTitle.trim()) return
    await axios.post<Task>(`${API_URL}/tasks`, { title: newTitle, priority: newPriority })
    setNewTitle("")
    setNewPriority("Normal")
    fetchTasks()
    setTimeout(() => newTaskInputRef.current?.focus(), 0)
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

  const handleDragEnd = async (result: DropResult) => {
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

    const maxTitleLength = Math.max(
      "Title".length,
      ...tasks.map((t) => t.title.length)
    )
    worksheet["!cols"] = [
      { wch: 18 }, // Total Time column fixed width
      { wch: maxTitleLength + 5 }, // Title column auto-sized with padding
    ]

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

  const priorityColors: Record<Task["priority"], string> = {
    Highest: "bg-red-100 border-l-4 border-red-500",
    High: "bg-orange-100 border-l-4 border-orange-500",
    Normal: "bg-green-100 border-l-4 border-green-500",
    Low: "bg-gray-100 border-l-4 border-gray-400",
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 relative">
        <button
          onClick={toggleGlobal}
          className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full text-white transition ${globalRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
            }`}
        >
          {globalRunning ? <Pause /> : <Play />}
        </button>

        <h1 className="text-2xl font-bold text-gray-800 mb-6">Task Tracker</h1>

        <div className="flex mb-6 space-x-2">
          <input
            ref={newTaskInputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task title..."
            onKeyDown={(e) => {
              if (e.key === "Enter") addTask()
            }}
            className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as Task["priority"])}
            className="border rounded-lg px-2 py-2"
          >
            <option value="Highest">Highest</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>
          <button
            onClick={addTask}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            ➕ Add
          </button>
        </div>

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


        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="task-list">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                {tasks.map((task, index) => (
                  <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`flex items-center justify-between p-4 rounded-xl shadow-sm ${priorityColors[task.priority]}`}
                      >

                        <div className="flex items-center flex-1">
                          <div className="flex-shrink-0 mr-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold">
                              {index + 1}
                            </div>
                          </div>

                          {editingId === task.id ? (
                            <div className="space-y-2 flex-1">
                              <label className="block text-sm font-medium text-gray-600">Title</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(task.id)
                                }}
                                onBlur={() => saveEdit(task.id)}
                                className="border rounded-lg px-2 py-1 w-full"
                              />
                              <label className="block text-sm font-medium text-gray-600">Total Time (HH:mm)</label>
                              <input
                                type="time"
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveEdit(task.id)
                                }}
                                onBlur={() => saveEdit(task.id)}
                                className="border rounded-lg px-2 py-1"
                              />
                              <label className="block text-sm font-medium text-gray-600">Priority</label>
                              <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value as Task["priority"])}
                                className="border rounded-lg px-2 py-1"
                              >
                                <option value="Highest">Highest</option>
                                <option value="High">High</option>
                                <option value="Normal">Normal</option>
                                <option value="Low">Low</option>
                              </select>
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium text-gray-800">{task.title}</p>
                              <p className="text-gray-500 text-sm">
                                <span className="font-medium">Total Time:</span> {formatTime(task.totalSeconds)}
                              </p>
                              <p className="text-gray-500 text-sm">
                                <span className="font-medium">Priority:</span> {task.priority}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleTask(task.id)}
                            className={`w-10 h-10 flex items-center justify-center rounded-full text-white transition ${task.isRunning
                              ? "bg-red-500 hover:bg-red-600"
                              : "bg-green-500 hover:bg-green-600"
                              }`}
                          >
                            {task.isRunning ? <Pause /> : <Play />}
                          </button>

                          {editingId === task.id ? (
                            <button
                              onClick={() => saveEdit(task.id)}
                              className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                            >
                              <Check />
                            </button>
                          ) : (
                            <button
                              onClick={() => startEditing(task)}
                              className="w-10 h-10 flex items-center justify-center rounded-full bg-yellow-500 text-white hover:bg-yellow-600"
                            >
                              <Edit2 />
                            </button>
                          )}

                          <button
                            onClick={() => deleteTask(task.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-500 text-white hover:bg-gray-600"
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  )
}

