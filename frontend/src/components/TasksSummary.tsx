import { useState } from "react";
import { FileSpreadsheet, Mail } from "lucide-react";
import type { Task } from "../types";
import { formatDuration, type TimeFormat } from "../utils/time";
import { exportToExcel } from "../utils/exportToExcel";
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
        <p className="order-last sm:order-none w-full sm:w-auto sm:text-right text-gray-700 font-medium">
          Total Time (All Tasks): {formatDuration(totalSeconds, timeFormat)}
        </p>
        <button
          onClick={() => setReportOpen(true)}
          title="Daily report"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center"
        >
          <span className="sr-only">Daily report</span>
          <Mail className="h-6 w-6" />
        </button>
        <button
          onClick={() =>
            exportToExcel(tasks).catch((err) => alert(`Export failed: ${err}`))
          }
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center"
        >
          <span className="sr-only">Export to Excel</span>
          <FileSpreadsheet className="h-6 w-6" />
        </button>
      </div>

      {reportOpen && (
        <ReportDialog tasks={tasks} onClose={() => setReportOpen(false)} />
      )}
    </>
  );
}
