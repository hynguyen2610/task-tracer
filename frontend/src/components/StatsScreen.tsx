import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import * as api from "../api/tasks";
import { useTimeFormat } from "../hooks/useTimeFormat";
import {
  activeDays,
  buildDayStats,
  dayKey,
  dayRange,
  type TaskTotal,
  type TimelineEntry,
} from "../stats/dayStats";
import { clock, formatDelta, formatMs } from "../stats/format";
import { assignTaskColors } from "../stats/taskColors";
import { loadWorkday, minutesToClock, saveWorkday, type WorkdaySettings } from "../stats/workday";
import type { Activity, Task } from "../types";
import DayTimeline from "./DayTimeline";
import MonthCalendar from "./MonthCalendar";
import TaskHistoryDialog from "./TaskHistoryDialog";
import WorkdayDialog from "./WorkdayDialog";

interface StatsScreenProps {
  /** Current tasks, for up-to-date titles. */
  tasks: Task[];
  /** Left out on the phone layout, whose bottom bar goes back. */
  onBack?: () => void;
}

/** While today is shown, history is re-read this often so running time grows. */
const REFRESH_MS = 5_000;
const EMPTY: Activity = { sessions: [], events: [] };

/** Statistics for one day, picked from a month calendar. See docs/SPEC.md 9. */
export default function StatsScreen({ tasks, onBack }: StatsScreenProps) {
  const timeFormat = useTimeFormat();
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date());
  const [dayActivity, setDayActivity] = useState<Activity>(EMPTY);
  const [monthActivity, setMonthActivity] = useState<Activity>(EMPTY);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [workday, setWorkday] = useState<WorkdaySettings>(loadWorkday);
  const [editingWorkday, setEditingWorkday] = useState(false);
  const [historyTask, setHistoryTask] = useState<TaskTotal | null>(null);
  const changeWorkday = (next: WorkdaySettings) => {
    setWorkday(next);
    saveWorkday(next);
  };

  const day = dayRange(selected);
  const isToday = dayKey(selected) === dayKey(new Date());
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [d, m] = await Promise.all([
          api.getActivity(day.start, day.end),
          api.getActivity(monthStart, monthEnd),
        ]);
        if (cancelled) return;
        setDayActivity(d);
        setMonthActivity(m);
        setNow(Date.now());
        setError(null);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    };
    load();
    const interval = isToday ? setInterval(load, REFRESH_MS) : undefined;
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [day.start, day.end, monthStart, monthEnd, isToday]);

  const titles = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);
  const stats = useMemo(
    () => buildDayStats(dayActivity, day.start, day.end, now, titles, workday),
    [dayActivity, day.start, day.end, now, titles, workday]
  );
  const marked = useMemo(() => activeDays(monthActivity, now), [monthActivity, now]);
  const colors = useMemo(
    () => assignTaskColors([...stats.segments.map((s) => s.taskId), ...stats.perTask.map((t) => t.taskId)]),
    [stats]
  );

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selected);
  const fmt = (ms: number) => formatMs(ms, timeFormat);
  const hasData = stats.span !== null || stats.entries.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to tasks"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-fill"
          >
            <ArrowLeft />
          </button>
        )}
        <h1 className="text-2xl font-bold text-fg-strong">Statistics</h1>
        <button
          onClick={() => setEditingWorkday(true)}
          title="Set working hours and lunch; breaks only count inside them"
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line text-sm text-fg hover:bg-fill"
        >
          <Clock className="h-4 w-4" />
          Workday hours
          <span className="text-fg-soft tabular-nums">
            {minutesToClock(workday.start)}–{minutesToClock(workday.end)}
          </span>
        </button>
      </div>

      {historyTask && (
        <TaskHistoryDialog
          taskId={historyTask.taskId}
          title={historyTask.title}
          deleted={historyTask.deleted}
          onPickDay={(d) => {
            setSelected(d);
            setMonth(d);
            setHistoryTask(null);
          }}
          onClose={() => setHistoryTask(null)}
        />
      )}

      {editingWorkday && (
        <WorkdayDialog
          value={workday}
          onSave={changeWorkday}
          onClose={() => setEditingWorkday(false)}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <MonthCalendar
          month={month}
          selected={selected}
          activeDays={marked}
          onSelect={setSelected}
          onMonthChange={setMonth}
        />

        <section className="flex-1 min-w-0" aria-labelledby="stats-day">
          <h2 id="stats-day" className="text-lg font-semibold text-fg-strong mb-4">
            {dateLabel}
          </h2>

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong">
              Couldn't load statistics: {error}
            </p>
          )}

          {!hasData ? (
            <p className="text-fg-muted">No work tracked on this day.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <Tile label="Work" value={fmt(stats.workMs)} />
                <Tile label="Break" value={fmt(stats.breakMs)} />
                <Tile
                  label="Day span"
                  value={stats.span ? `${clock(stats.span.start)}–${clock(stats.span.end)}` : "–"}
                />
                <Tile
                  label="Adjustments"
                  value={stats.adjustmentMs ? formatDelta(stats.adjustmentMs / 1000, timeFormat) : "none"}
                />
              </dl>

              <DayTimeline stats={stats} colors={colors} timeFormat={timeFormat} />

              <h3 className="font-semibold text-fg-strong mb-2">By task</h3>
              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="text-left text-fg-muted border-b">
                    <th className="py-1 font-medium">Task</th>
                    <th className="hidden sm:table-cell py-1 pl-3 font-medium text-right">Tracked</th>
                    <th className="hidden sm:table-cell py-1 pl-3 font-medium text-right">Adjusted</th>
                    <th className="py-1 pl-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perTask.map((t) => (
                    <tr key={t.taskId} className="border-b last:border-0">
                      <td className="py-1.5 pr-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-sm mr-2 align-middle"
                          style={{ background: colors.get(t.taskId) }}
                        />
                        <button
                          onClick={() => setHistoryTask(t)}
                          title="Show this task's work history across all days"
                          className="text-left text-fg-strong hover:text-accent-strong hover:underline"
                        >
                          {t.title}
                        </button>
                        {t.deleted && <span className="ml-1 text-fg-faint">(deleted)</span>}
                      </td>
                      <td className="hidden sm:table-cell py-1.5 pl-3 text-right tabular-nums text-fg">{fmt(t.trackedMs)}</td>
                      <td className="hidden sm:table-cell py-1.5 pl-3 text-right tabular-nums text-fg">
                        {t.adjustmentMs ? formatDelta(t.adjustmentMs / 1000, timeFormat) : "–"}
                      </td>
                      <td className="py-1.5 pl-3 text-right tabular-nums font-medium text-fg-strong">
                        {fmt(t.totalMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="font-semibold text-fg-strong mb-2">Timeline</h3>
              <ol className="text-sm space-y-1" aria-label="Timeline entries">
                {stats.entries.map((e, i) => (
                  <li key={i} data-testid="timeline-entry" className="flex gap-3">
                    <span className="w-12 shrink-0 tabular-nums text-fg-muted">{clock(e.at)}</span>
                    <span className="text-fg">{describe(e, fmt, timeFormat)}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-fill-soft px-3 py-2">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="text-lg font-semibold text-fg-strong tabular-nums">{value}</dd>
    </div>
  );
}

function describe(
  e: TimelineEntry,
  fmt: (ms: number) => string,
  timeFormat: ReturnType<typeof useTimeFormat>
): React.ReactNode {
  switch (e.kind) {
    case "start":
      return (
        <>
          {e.segment.fromPreviousDay ? "Continued" : "Started"} <b>{e.segment.title}</b>
          {e.segment.running && " · running"}
          {e.segment.intoNextDay && " · carries on into the next day"}
        </>
      );
    case "stop":
      return (
        <>
          Paused <b>{e.segment.title}</b> after {fmt(e.workedMs)}
        </>
      );
    case "break":
      return <>Break of {fmt(e.ms)}, until {clock(e.end)}</>;
    case "status":
      return (
        <>
          <b>{e.title}</b> → {e.status}
        </>
      );
    case "adjustment":
      return (
        <>
          Adjusted <b>{e.title}</b> by {formatDelta(e.toSeconds - e.fromSeconds, timeFormat)} (
          {fmt(e.fromSeconds * 1000)} → {fmt(e.toSeconds * 1000)})
        </>
      );
  }
}
