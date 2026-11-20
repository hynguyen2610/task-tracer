import { useState } from "react";
import { BarChart3, HardDriveDownload, Palette } from "lucide-react";
import "./App.css";
import { BACKUP_REMINDER_DAYS, canBackup, lastBackupAt } from "./api/backup";
import { useIsPhone } from "./hooks/useIsPhone";
import { useTasks } from "./hooks/useTasks";
import { TimeFormatContext, useTimeFormatSetting } from "./hooks/useTimeFormat";
import BackupDialog from "./components/BackupDialog";
import NewTaskForm from "./components/NewTaskForm";
import PhoneLayout from "./components/phone/PhoneLayout";
import StatsScreen from "./components/StatsScreen";
import ThemePicker from "./components/ThemePicker";
import TaskList from "./components/TaskList";
import TasksSummary from "./components/TasksSummary";

export default function App() {
  const taskState = useTasks();
  const {
    tasks,
    addTask,
    toggleTask,
    pauseTask,
    updateTask,
    setStatus,
    deleteTask,
    moveTask,
  } = taskState;
  const isPhone = useIsPhone();
  const { format, setFormat } = useTimeFormatSetting();
  const [screen, setScreen] = useState<"tasks" | "stats">("tasks");
  const [backupOpen, setBackupOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [lastBackup, setLastBackup] = useState(lastBackupAt);
  const [now] = useState(Date.now);
  // Remind once there is work worth keeping and no recent backup.
  const hasWork = tasks.some((t) => t.totalSeconds > 0 || t.startedAt !== null);
  const backupDue =
    canBackup() && hasWork && (lastBackup === null || now - lastBackup > BACKUP_REMINDER_DAYS * 86_400_000);

  const dialogs = (
    <>
      {backupOpen && (
        <BackupDialog onClose={() => setBackupOpen(false)} onExported={() => setLastBackup(lastBackupAt())} />
      )}
      {themeOpen && <ThemePicker onClose={() => setThemeOpen(false)} />}
    </>
  );

  if (isPhone) {
    return (
      <TimeFormatContext.Provider value={format}>
        <PhoneLayout
          tasks={taskState}
          screen={screen}
          onScreen={setScreen}
          onTimeFormatChange={setFormat}
          backupDue={backupDue}
          onOpenBackup={() => setBackupOpen(true)}
          onOpenTheme={() => setThemeOpen(true)}
        />
        {dialogs}
      </TimeFormatContext.Provider>
    );
  }

  // Desktop and tablet: one card (docs/SPEC.md 14 for the phone layout).
  return (
    <TimeFormatContext.Provider value={format}>
      <div className="app-bg min-h-screen bg-gradient-to-br from-page to-page-deep flex justify-center items-start p-8">
        <div className="app-sheet w-full max-w-7xl bg-surface rounded-2xl shadow-xl p-6 relative">
          {screen === "stats" ? (
            <StatsScreen tasks={tasks} onBack={() => setScreen("tasks")} />
          ) : (
            <>
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => setThemeOpen(true)}
                  aria-label="Theme"
                  title="Theme"
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-line text-fg hover:bg-fill transition"
                >
                  <Palette size={20} />
                </button>
                {canBackup() && (
                  <button
                    onClick={() => setBackupOpen(true)}
                    aria-label={backupDue ? "Backup (no recent backup)" : "Backup"}
                    title={backupDue ? "Backup: no backup in the last week" : "Backup"}
                    className="relative w-10 h-10 flex items-center justify-center rounded-full border border-line text-fg hover:bg-fill transition"
                  >
                    <HardDriveDownload size={20} />
                    {backupDue && (
                      <span className="absolute top-0 right-0 w-3 h-3 rounded-full bg-warn ring-2 ring-surface" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => setScreen("stats")}
                  aria-label="Statistics"
                  title="Statistics"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-accent text-on-color hover:bg-accent-hover transition"
                >
                  <BarChart3 />
                </button>
              </div>

              <h1 className="text-2xl font-bold text-fg-strong mb-6">Task Tracker</h1>

              <NewTaskForm tasks={tasks} onAdd={addTask} />
              <TasksSummary tasks={tasks} onTimeFormatChange={setFormat} />
              <TaskList
                tasks={tasks}
                loaded={taskState.loaded}
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
      {dialogs}
    </TimeFormatContext.Provider>
  );
}
