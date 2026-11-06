import "./App.css";
import { useTasks } from "./hooks/useTasks";
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 relative">
        <PlayPauseButton
          isRunning={isPolling}
          onClick={togglePolling}
          className="absolute top-4 right-4"
        />

        <h1 className="text-2xl font-bold text-gray-800 mb-6">Task Tracker</h1>

        <NewTaskForm onAdd={addTask} />
        <TasksSummary tasks={tasks} />
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
  );
}
