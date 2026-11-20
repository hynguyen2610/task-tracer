import { useState } from "react";
import { Mail } from "lucide-react";
import type { Task } from "../types";
import { formatDuration, type TimeFormat } from "../utils/time";
import { useTimeFormat } from "../hooks/useTimeFormat";
import ReportDialog from "./ReportDialog";
import TimeFormatToggle from "./TimeFormatToggle";

interface TasksSummaryProps {
  tasks: Task[];
  onTimeFormatChange: (format: TimeFormat) => void;
}

export default function TasksSummary({ tasks, onTimeFormatChange }: TasksSummaryProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const timeFormat = useTimeFormat();
  const totalSeconds = tasks.reduce((sum, t) => sum + t.totalSeconds, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <div className="mr-auto">
          <TimeFormatToggle value={timeFormat} onChange={onTimeFormatChange} />
        </div>
        {/* Its own line under the buttons on a phone. */}
        <p className="order-last sm:order-none w-full sm:w-auto sm:text-right text-fg font-medium">
          Total Time (All Tasks): {formatDuration(totalSeconds, timeFormat)}
        </p>
        <button
          onClick={() => setReportOpen(true)}
          title="Daily report"
          className="px-4 py-2 bg-accent text-on-color rounded-lg hover:bg-accent-hover transition flex items-center justify-center"
        >
          <span className="sr-only">Daily report</span>
          <Mail className="h-6 w-6" />
        </button>
      </div>

      {reportOpen && (
        <ReportDialog tasks={tasks} onClose={() => setReportOpen(false)} />
      )}
    </>
  );
}
