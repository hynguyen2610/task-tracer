import { useEffect, useMemo, useState } from "react";
import { Copy, X } from "lucide-react";
import type { Task } from "../types";
import {
  buildReportHtml,
  buildReportText,
  formatReportDate,
  selectReportTasks,
  totalRoundedHours,
  type ReportSettings,
} from "../report/dailyReport";
import {
  copyReport,
  loadReportSettings,
  saveReportSettings,
} from "../report/reportStorage";

interface ReportDialogProps {
  tasks: Task[];
  onClose: () => void;
}

const fieldClass = "border rounded-lg px-2 py-1 w-full text-sm";
const labelClass = "block text-sm font-medium text-gray-600 mt-3 mb-1";

export default function ReportDialog({ tasks, onClose }: ReportDialogProps) {
  const [settings, setSettings] = useState<ReportSettings>(loadReportSettings);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  // Fixed when the dialog opens, so the report doesn't change at midnight.
  const [today] = useState(() => new Date());

  const reportTasks = useMemo(() => selectReportTasks(tasks, today), [tasks, today]);
  const html = useMemo(
    () => buildReportHtml(settings, reportTasks, today),
    [settings, reportTasks, today]
  );

  useEffect(() => saveReportSettings(settings), [settings]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (field: keyof ReportSettings) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setSettings({ ...settings, [field]: e.target.value });
    setCopyState("idle");
  };

  const copy = async () => {
    try {
      await copyReport(html, buildReportText(settings, reportTasks, today));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id="report-title" className="text-xl font-bold text-gray-800">
            Daily report · {formatReportDate(today)}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X />
          </button>
        </div>
        <p className="text-sm text-gray-500">
          {reportTasks.length} task{reportTasks.length === 1 ? "" : "s"}: worked on
          today, or still In progress / Pending.
        </p>
        <p className="text-sm text-gray-700 mt-1">
          <span className="font-medium">Total ETA (rounded):</span>{" "}
          {totalRoundedHours(reportTasks)} hour
          <span className="text-gray-500"> · sum of the ETAs in the report, not copied</span>
        </p>

        <div className="grid md:grid-cols-2 gap-6 mt-2">
          <div>
            <label className={labelClass}>Greeting</label>
            <input className={fieldClass} value={settings.greeting} onChange={set("greeting")} />

            <label className={labelClass}>
              Intro <span className="font-normal">({"{date}"} becomes today's date)</span>
            </label>
            <input className={fieldClass} value={settings.intro} onChange={set("intro")} />

            <label className={labelClass}>
              Next planned tasks{" "}
              <span className="font-normal">(one per line, "-" for a sub-item)</span>
            </label>
            <textarea
              className={fieldClass}
              rows={4}
              value={settings.nextPlanned}
              onChange={set("nextPlanned")}
            />

            <label className={labelClass}>Issue / Concerns / Blocks</label>
            <textarea
              className={fieldClass}
              rows={2}
              value={settings.issues}
              onChange={set("issues")}
            />

            <label className={labelClass}>Signature</label>
            <textarea
              className={fieldClass}
              rows={2}
              value={settings.signature}
              onChange={set("signature")}
            />
          </div>

          <div className="flex flex-col">
            <div className={labelClass}>Preview</div>
            {/* Built from escaped task and settings text, so safe to render. */}
            <div
              className="report-preview border rounded-lg p-3 flex-1 overflow-auto max-h-[60vh] text-gray-900"
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <div className="flex items-center justify-end gap-3 mt-3">
              {copyState === "copied" && (
                <span className="text-sm text-green-700">Copied. Paste it into your email.</span>
              )}
              {copyState === "failed" && (
                <span className="text-sm text-red-600">
                  Couldn't copy. Select the preview and copy it by hand.
                </span>
              )}
              <button
                onClick={copy}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
