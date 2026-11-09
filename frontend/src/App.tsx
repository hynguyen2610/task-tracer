import "./App.css";
import { useTasks } from "./hooks/useTasks";
import { TimeFormatContext, useTimeFormatSetting } from "./hooks/useTimeFormat";
import NewTaskForm from "./components/NewTaskForm";
import PlayPauseButton from "./components/PlayPauseButton";
import TaskList from "./components/TaskList";
import TasksSummary from "./components/TasksSummary";

export default function App() {
  const {
    tasks,
    isPolling,
    togglePolling,
    addTask,
    toggleTask,
    pauseTask,
    updateTask,
    setStatus,
    deleteTask,
    moveTask,
  } = useTasks();
  const { format, setFormat } = useTimeFormatSetting();

  return (
    <TimeFormatContext.Provider value={format}>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
        <div className="w-full max-w-7xl bg-white rounded-2xl shadow-xl p-6 relative">
          <PlayPauseButton
            isRunning={isPolling}
            onClick={togglePolling}
            labels={{ play: "Resume updates", pause: "Pause updates" }}
            className="absolute top-4 right-4"
          />

          <h1 className="text-2xl font-bold text-gray-800 mb-6">Task Tracker</h1>

          <NewTaskForm onAdd={addTask} />
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
        </div>
      </div>
    </TimeFormatContext.Provider>
  );
}
