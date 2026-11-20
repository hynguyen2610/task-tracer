import { useEffect, useState } from "react";
import type { Task } from "../types";
import { dueProgress, type DueTone } from "../utils/dueProgress";

/** The current time, refreshed every minute: days left only change slowly. */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const BAR: Record<DueTone, string> = { ok: "bg-success", soon: "bg-warn", late: "bg-danger" };
const TEXT: Record<DueTone, string> = { ok: "text-fg-soft", soon: "text-warn-strong", late: "text-danger-strong" };

/**
 * How far the task is from its due date (docs/SPEC.md 4.7): a bar from the
 * start date to the due date, and the days left. Nothing without a due date
 * or once the task is finished.
 */
export default function DueProgressBar({ task, className = "" }: { task: Task; className?: string }) {
  const now = useMinuteClock();
  const p = dueProgress(task, now);
  if (!p) return null;
  const label = <span className={`whitespace-nowrap text-xs font-medium ${TEXT[p.tone]}`}>{p.label}</span>;
  if (p.fraction === null) return <div className={className}>{label}</div>;

  const percent = Math.round(p.fraction * 100);
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-label="Time to due date"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% of the time used, ${p.label.toLowerCase()}`}
        data-tone={p.tone}
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface/70 ring-1 ring-inset ring-line-soft"
      >
        <div className={`h-full rounded-full ${BAR[p.tone]}`} style={{ width: `${percent}%` }} />
      </div>
      {label}
    </div>
  );
}
