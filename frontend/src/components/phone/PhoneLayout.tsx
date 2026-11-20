import { useState } from "react";
import { BarChart3, HardDriveDownload, ListTodo, Mail, Plus } from "lucide-react";
import { canBackup } from "../../api/backup";
import { useTimeFormat } from "../../hooks/useTimeFormat";
import type { useTasks } from "../../hooks/useTasks";
import { formatDuration, type TimeFormat } from "../../utils/time";
import NewTaskForm from "../NewTaskForm";
import PlayPauseButton from "../PlayPauseButton";
import ReportDialog from "../ReportDialog";
import StatsScreen from "../StatsScreen";
import TimeFormatToggle from "../TimeFormatToggle";
import BottomSheet from "./BottomSheet";
import PhoneTaskList from "./PhoneTaskList";

interface PhoneLayoutProps {
  tasks: ReturnType<typeof useTasks>;
  screen: "tasks" | "stats";
  onScreen: (screen: "tasks" | "stats") => void;
  onTimeFormatChange: (format: TimeFormat) => void;
  backupDue: boolean;
  onOpenBackup: () => void;
}

/**
 * The app below 640px wide (docs/SPEC.md 14): edge to edge, the running task
 * pinned at the top, and Tasks, Report and Statistics always in thumb reach
 * at the bottom.
 */
export default function PhoneLayout({
  tasks: t,
  screen,
  onScreen,
  onTimeFormatChange,
  backupDue,
  onOpenBackup,
}: PhoneLayoutProps) {
  const timeFormat = useTimeFormat();
  const [adding, setAdding] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const running = t.tasks.find((task) => task.isRunning);
  const total = t.tasks.reduce((sum, task) => sum + task.totalSeconds, 0);

  const navClass = (current: boolean) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
      current ? "text-indigo-600" : "text-gray-500"
    }`;
  const navButton = (target: "tasks" | "stats", label: string, icon: React.ReactNode) => (
    <button
      onClick={() => onScreen(target)}
      aria-current={screen === target ? "page" : undefined}
      className={navClass(screen === target)}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100 pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-xl font-bold text-gray-800">Task Tracker</h1>
          {canBackup() && (
            <button
              onClick={onOpenBackup}
              aria-label={backupDue ? "Backup (no recent backup)" : "Backup"}
              className="relative -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100"
            >
              <HardDriveDownload size={22} />
              {backupDue && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
            </button>
          )}
        </div>

        {screen === "tasks" && running && (
          <div
            role="region"
            aria-label="Running task"
            className="flex items-center gap-3 border-t bg-indigo-600 px-4 py-2 text-white"
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-red-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm opacity-90">{running.title}</p>
              <p className="text-xl font-semibold tabular-nums">{formatDuration(running.totalSeconds, timeFormat)}</p>
            </div>
            <PlayPauseButton
              isRunning
              onClick={() => t.pauseTask(running.id)}
              className="!h-12 !w-12 ring-2 ring-white/70"
            />
          </div>
        )}
      </header>

      {screen === "stats" ? (
        <main className="bg-white px-4 py-4">
          <StatsScreen tasks={t.tasks} />
        </main>
      ) : (
        <main className="px-4 pt-3 pb-24">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              All tasks <span className="font-semibold tabular-nums text-gray-800">{formatDuration(total, timeFormat)}</span>
            </p>
            <TimeFormatToggle value={timeFormat} onChange={onTimeFormatChange} />
          </div>
          <PhoneTaskList
            tasks={t.tasks}
            onToggle={t.toggleTask}
            onPause={t.pauseTask}
            onDelete={t.deleteTask}
            onUpdate={t.updateTask}
            onStatusChange={t.setStatus}
            onMove={t.moveTask}
          />
          <button
            onClick={() => setAdding(true)}
            aria-label="Add task"
            className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600"
          >
            <Plus size={28} />
          </button>
        </main>
      )}

      <nav
        aria-label="Screens"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] border-t bg-white pb-[env(safe-area-inset-bottom)]"
      >
        {navButton("tasks", "Tasks", <ListTodo size={22} />)}
        {/* Opens the full-screen report page over the current screen. */}
        <button onClick={() => setReportOpen(true)} aria-haspopup="dialog" className={navClass(reportOpen)}>
          <Mail size={22} />
          Report
        </button>
        {navButton("stats", "Statistics", <BarChart3 size={22} />)}
      </nav>

      {adding && (
        <BottomSheet title="New task" onClose={() => setAdding(false)}>
          <NewTaskForm
            phone
            tasks={t.tasks}
            onAdd={async (...args) => {
              await t.addTask(...args);
              setAdding(false);
            }}
          />
        </BottomSheet>
      )}
      {reportOpen && <ReportDialog tasks={t.tasks} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
