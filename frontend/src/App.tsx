import { useState } from "react";
import { BarChart3, HardDriveDownload } from "lucide-react";
import "./App.css";
import { BACKUP_REMINDER_DAYS, canBackup, lastBackupAt } from "./api/backup";
import { useTasks } from "./hooks/useTasks";
import { TimeFormatContext, useTimeFormatSetting } from "./hooks/useTimeFormat";
import BackupDialog from "./components/BackupDialog";
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
  const [backupOpen, setBackupOpen] = useState(false);
  const [lastBackup, setLastBackup] = useState(lastBackupAt);
  const [now] = useState(Date.now);
  // Remind once there is work worth keeping and no recent backup.
  const hasWork = tasks.some((t) => t.totalSeconds > 0 || t.startedAt !== null);
  const backupDue =
    canBackup() && hasWork && (lastBackup === null || now - lastBackup > BACKUP_REMINDER_DAYS * 86_400_000);

  return (
    <TimeFormatContext.Provider value={format}>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex justify-center items-start p-8">
        <div className="w-full max-w-7xl bg-white rounded-2xl shadow-xl p-6 relative">
          {screen === "stats" ? (
            <StatsScreen tasks={tasks} onBack={() => setScreen("tasks")} />
          ) : (
            <>
              <div className="absolute top-4 right-4 flex gap-2">
                {canBackup() && (
                  <button
                    onClick={() => setBackupOpen(true)}
                    aria-label={backupDue ? "Backup (no recent backup)" : "Backup"}
                    title={backupDue ? "Backup: no backup in the last week" : "Backup"}
                    className="relative w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                  >
                    <HardDriveDownload size={20} />
                    {backupDue && (
                      <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-amber-500 ring-2 ring-white" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setScreen("stats")}
                  aria-label="Statistics"
                  title="Statistics"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  <BarChart3 />
                </button>
              </div>

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
      {backupOpen && (
        <BackupDialog onClose={() => setBackupOpen(false)} onExported={() => setLastBackup(lastBackupAt())} />
      )}
    </TimeFormatContext.Provider>
  );
}
