import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Copy, X } from "lucide-react";
import { useIsPhone } from "../hooks/useIsPhone";
import FullScreenPage from "./phone/FullScreenPage";
import type { Task } from "../types";
import {
  buildReportHtml,
  buildReportText,
  formatReportDate,
  selectReportTasks,
  totalRoundedHours,
  withNextWeekday,
  type ReportSettings,
} from "../report/dailyReport";
import {
  copyReport,
  loadReportSettings,
  saveReportSettings,
} from "../report/reportStorage";
import { parseTicketRules } from "../report/ticketLinks";

interface ReportDialogProps {
  tasks: Task[];
  onClose: () => void;
}

const fieldClass = "border rounded-lg px-2 py-1 w-full text-sm";
const labelClass = "block text-sm font-medium text-gray-600 mt-3 mb-1";

export default function ReportDialog({ tasks, onClose }: ReportDialogProps) {
  // Fixed when the dialog opens, so the report doesn't change at midnight.
  const [today] = useState(() => new Date());
  const [settings, setSettings] = useState<ReportSettings>(() => {
    const saved = loadReportSettings();
    return { ...saved, nextPlanned: withNextWeekday(saved.nextPlanned, today) };
  });
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const isPhone = useIsPhone();
  const [tab, setTab] = useState<"preview" | "edit">("preview");

  const reportTasks = useMemo(() => selectReportTasks(tasks, today), [tasks, today]);
  const html = useMemo(
    () => buildReportHtml(settings, reportTasks, today),
    [settings, reportTasks, today]
  );

  const invalidTicketLines = useMemo(
    () => parseTicketRules(settings.ticketLinks).invalid,
    [settings.ticketLinks]
  );

  useEffect(() => saveReportSettings(settings), [settings]);

  useEffect(() => {
    if (isPhone) return; // the full-screen page handles Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPhone]);

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

  const summary = (
    <>
    <p className="text-sm text-gray-500">
      {reportTasks.length} task{reportTasks.length === 1 ? "" : "s"}: worked on
      today, or still In progress / Pending.
    </p>
    <p className="text-sm text-gray-700 mt-1">
      <span className="font-medium">Total ETA (rounded):</span>{" "}
      {totalRoundedHours(reportTasks)} hour
      <span className="text-gray-500"> · sum of the ETAs in the report, not copied</span>
    </p>
    </>
  );
  // Set once and rarely changed: folded away on a phone.
  const openingFields = (
    <>
      <label className={labelClass}>Greeting</label>
      <input className={fieldClass} value={settings.greeting} onChange={set("greeting")} />

      <label className={labelClass}>
        Intro <span className="font-normal">({"{date}"} becomes today's date)</span>
      </label>
      <input className={fieldClass} value={settings.intro} onChange={set("intro")} />
    </>
  );
  const closingFields = (
    <>
      <label className={labelClass}>Signature</label>
      <textarea
        className={fieldClass}
        rows={2}
        value={settings.signature}
        onChange={set("signature")}
      />

      <label className={labelClass} htmlFor="ticket-links">
        Ticket links{" "}
        <span className="font-normal">
          (one per line: id prefix, a space, then the URL with {"{id}"} or {"{num}"})
        </span>
      </label>
      <textarea
        id="ticket-links"
        className={`${fieldClass} font-mono`}
        rows={2}
        placeholder={"ABC- https://yourcompany.atlassian.net/browse/{id}"}
        value={settings.ticketLinks}
        onChange={set("ticketLinks")}
      />
    </>
  );
  const dailyFields = (
    <>
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
    </>
  );
  const invalidTickets = invalidTicketLines.length > 0 && (
      <p role="alert" className="text-sm text-red-600 mt-1">
        Not used (needs a prefix, a space, and an http(s) URL with {"{id}"} or {"{num}"}):{" "}
        {invalidTicketLines.join(", ")}
      </p>
  );
  const copyMessages = (
    <>
      {copyState === "copied" && (
        <span className="text-sm text-green-700">Copied. Paste it into your email.</span>
      )}
      {copyState === "failed" && (
        <span className="text-sm text-red-600">
          Couldn't copy. Select the preview and copy it by hand.
        </span>
      )}
    </>
  );
  // Built from escaped task and settings text, so safe to render. Ticket
  // links are for the email; following one here would leave the app.
  const preview = (className: string) => (
    <div
      className={`report-preview text-gray-900 ${className}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) e.preventDefault();
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
  const copyButton = (className: string) => (
    <button
      onClick={copy}
      className={`bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition flex items-center justify-center gap-2 ${className}`}
    >
      <Copy className="h-4 w-4" />
      Copy report
    </button>
  );

  if (isPhone) {
    const tabClass = (t: typeof tab) =>
      `flex-1 h-10 text-sm font-medium border-b-2 ${
        tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500"
      }`;
    return (
      <FullScreenPage
        title={`Daily report · ${formatReportDate(today)}`}
        onClose={onClose}
        header={
          <div role="tablist" aria-label="Report" className="flex px-4">
            <button role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")} className={tabClass("preview")}>
              Preview
            </button>
            <button role="tab" aria-selected={tab === "edit"} onClick={() => setTab("edit")} className={tabClass("edit")}>
              Edit
            </button>
          </div>
        }
        footer={
          <>
            <div className="mb-2 text-center empty:hidden">{copyMessages}</div>
            {copyButton("w-full h-12 font-medium")}
          </>
        }
      >
        {tab === "preview" ? (
          <div role="tabpanel" aria-label="Preview">
            {summary}
            {preview("mt-4")}
          </div>
        ) : (
          <div role="tabpanel" aria-label="Edit" className="-mt-3">
            {dailyFields}
            <details className="mt-5 rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center gap-1 px-3 py-3 text-sm font-semibold text-gray-700 [&::-webkit-details-marker]:hidden">
                <ChevronRight size={18} className="transition-transform [details[open]_&]:rotate-90" />
                Report settings
              </summary>
              <div className="-mt-3 px-3 pb-3">
                {openingFields}
                {closingFields}
              </div>
            </details>
            {invalidTickets}
          </div>
        )}
      </FullScreenPage>
    );
  }

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
        {summary}

        <div className="grid md:grid-cols-2 gap-6 mt-2">
          <div>
            {openingFields}
            {dailyFields}
            {closingFields}
            {invalidTickets}
          </div>

          <div className="flex flex-col">
            <div className={labelClass}>Preview</div>
            {preview("border rounded-lg p-3 flex-1 overflow-auto max-h-[60vh]")}
            <div className="flex items-center justify-end gap-3 mt-3">
              {copyMessages}
              {copyButton("px-4 py-2")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
