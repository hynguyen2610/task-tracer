import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import * as api from "../api/tasks";
import { useTimeFormat } from "../hooks/useTimeFormat";
import { clock, formatDelta, formatMs } from "../stats/format";
import { buildTaskHistory, type TaskHistoryEntry } from "../stats/taskHistory";
import type { Activity } from "../types";
import type { TimeFormat } from "../utils/time";

interface TaskHistoryDialogProps {
  taskId: number;
  title: string;
  deleted: boolean;
  /** Shows that day on the statistics screen. */
  onPickDay: (day: Date) => void;
  onClose: () => void;
}

const dateLabel = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(ms);

/** Every day a task was worked on, oldest first. See docs/SPEC.md 9.5. */
export default function TaskHistoryDialog({ taskId, title, deleted, onPickDay, onClose }: TaskHistoryDialogProps) {
  const timeFormat = useTimeFormat();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Fixed when loaded, so a running session's length is as of then.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const loadedAt = Date.now();
    api
      .getActivity(0, loadedAt + 1)
      .then((a) => {
        if (cancelled) return;
        setActivity(a);
        setNow(loadedAt);
      })
      .catch((err) => !cancelled && setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const history = useMemo(
    () => (activity ? buildTaskHistory(activity, taskId, now) : null),
    [activity, taskId, now]
  );
  const fmt = (ms: number) => formatMs(ms, timeFormat);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-history-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">Work history</p>
            <h2 id="task-history-title" className="text-xl font-bold text-gray-800 break-words">
              {title}
              {deleted && <span className="ml-2 text-base font-normal text-gray-400">(deleted)</span>}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X />
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            Couldn't load the history: {error}
          </p>
        )}
        {!history && !error && <p className="text-gray-500">Loading…</p>}
        {history && history.days.length === 0 && (
          <p className="text-gray-500">No work recorded for this task.</p>
        )}

        {history && history.days.length > 0 && (
          <>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Tile label="Total" value={fmt(history.totalMs)} />
              <Tile label="Days worked" value={String(history.days.length)} />
              <Tile label="Began" value={dateLabel(history.firstAt!)} />
              <Tile
                label={history.finishedAt ? (history.finalStatus === "Canceled" ? "Canceled" : "Finished") : "Last worked"}
                value={dateLabel(history.finishedAt ?? history.lastAt!)}
              />
            </dl>
            {history.adjustmentMs !== 0 && (
              <p className="text-sm text-gray-500 -mt-3 mb-4">
                Tracked {fmt(history.trackedMs)}, adjusted by {formatDelta(history.adjustmentMs / 1000, timeFormat)}
              </p>
            )}

            <ol className="space-y-4" aria-label="Days">
              {history.days.map((day) => (
                <li key={day.key} data-testid="history-day">
                  <div className="flex items-baseline justify-between gap-3 border-b pb-1 mb-1">
                    <button
                      onClick={() => onPickDay(new Date(day.start))}
                      title="Show this day's statistics"
                      className="font-semibold text-gray-800 hover:underline"
                    >
                      {dateLabel(day.start)}
                    </button>
                    <span className="tabular-nums font-medium text-gray-800">{fmt(day.totalMs)}</span>
                  </div>
                  <ul className="text-sm space-y-0.5">
                    {day.entries.map((e, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-24 shrink-0 tabular-nums text-gray-500">
                          {e.kind === "session" ? `${clock(e.at)}–${e.running ? "now" : clock(e.end)}` : clock(e.at)}
                        </span>
                        <span className="text-gray-700">{describe(e, fmt, timeFormat)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-semibold text-gray-800 tabular-nums">{value}</dd>
    </div>
  );
}

function describe(e: TaskHistoryEntry, fmt: (ms: number) => string, timeFormat: TimeFormat): React.ReactNode {
  switch (e.kind) {
    case "session":
      return (
        <>
          Worked {fmt(e.ms)}
          {e.running && " · running"}
        </>
      );
    case "status":
      return <>→ {e.status}</>;
    case "adjustment":
      return (
        <>
          Adjusted by {formatDelta(e.toSeconds - e.fromSeconds, timeFormat)} ({fmt(e.fromSeconds * 1000)} →{" "}
          {fmt(e.toSeconds * 1000)})
        </>
      );
  }
}
