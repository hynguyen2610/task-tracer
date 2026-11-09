import { useState } from "react";
import { BarChart3 } from "lucide-react";
import "./App.css";
import { useTasks } from "./hooks/useTasks";
import { TimeFormatContext, useTimeFormatSetting } from "./hooks/useTimeFormat";
import NewTaskForm from "./components/NewTaskForm";
import StatsScreen from "./components/StatsScreen";
import TaskList from "./components/TaskList";
import TasksSummary from "./components/TasksSummary";

export default function App() {
  const {
    tasks,
    addTask,
    toggleTask,
    pauseTask,
    updateTask,
    setStatus,
    deleteTask,
    moveTask,
  } = useTasks();
  const { format, setFormat } = useTimeFormatSetting();
  const [screen, setScreen] = useState<"tasks" | "stats">("tasks");

  return (
    <TimeFormatContext.Provider value={format}>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
        <div className="w-full max-w-7xl bg-white rounded-2xl shadow-xl p-6 relative">
          {screen === "stats" ? (
            <StatsScreen tasks={tasks} onBack={() => setScreen("tasks")} />
          ) : (
            <>
              <button
                onClick={() => setScreen("stats")}
                aria-label="Statistics"
                title="Statistics"
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                <BarChart3 />
              </button>

              <h1 className="text-2xl font-bold text-gray-800 mb-6">Task Tracker</h1>

              <NewTaskForm tasks={tasks} onAdd={addTask} />
              <TasksSummary tasks={tasks} onTimeFormatChange={setFormat} />
              <TaskList
                tasks={tasks}
                onToggle={toggleTask}
                onPause={pauseTask}
                onDelete={deleteTask}
                onUpdate={updateTask}
                onStatusChange={setStatus}
                onMove={moveTask}
              />
            </>
          )}
        </div>
      </div>
    </TimeFormatContext.Provider>
  );
}
