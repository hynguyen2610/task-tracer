import { useState } from "react";
import { FileSpreadsheet, Mail } from "lucide-react";
import type { Task } from "../types";
import { formatTime } from "../utils/time";
import { exportToExcel } from "../utils/exportToExcel";
import ReportDialog from "./ReportDialog";

interface TasksSummaryProps {
  tasks: Task[];
}

export default function TasksSummary({ tasks }: TasksSummaryProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const totalSeconds = tasks.reduce((sum, t) => sum + t.totalSeconds, 0);

  return (
    <>
      <div className="mb-4 flex items-center justify-end space-x-2">
        <p className="text-right text-gray-700 font-medium">
          Total Time (All Tasks): {formatTime(totalSeconds)}
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
