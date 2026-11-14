import { useEffect, useRef, useState } from "react";
import type { DayStats, Segment } from "../stats/dayStats";
import { clock, formatMs } from "../stats/format";
import type { TimeFormat } from "../utils/time";

interface DayTimelineProps {
  stats: DayStats;
  colors: Map<number, string>;
  timeFormat: TimeFormat;
}

const HOUR = 3_600_000;

/**
 * One horizontal track from the first start to the last stop, rounded out
 * to whole hours. Each work session is a bar in its task's colour; the gaps
 * between them are breaks.
 */
export default function DayTimeline({ stats, colors, timeFormat }: DayTimelineProps) {
  const [hovered, setHovered] = useState<Segment | null>(null);
  const track = useRef<HTMLDivElement>(null);

  // A tap outside the track hides the details (phones have no mouse leaving).
  useEffect(() => {
    if (!hovered) return;
    const hide = (e: PointerEvent) => {
      if (!track.current?.contains(e.target as Node)) setHovered(null);
    };
    document.addEventListener("pointerdown", hide);
    return () => document.removeEventListener("pointerdown", hide);
  }, [hovered]);

  if (!stats.span) return null;

  // Whole hours around the span, at least one hour wide.
  const from = Math.floor(stats.span.start / HOUR) * HOUR;
  const to = Math.max(Math.ceil(stats.span.end / HOUR) * HOUR, from + HOUR);
  const pct = (ms: number) => ((ms - from) / (to - from)) * 100;
  const hours = Math.round((to - from) / HOUR);
  // Label every hour, or every 2nd / 3rd on long days so labels don't collide.
  const step = hours > 12 ? 3 : hours > 6 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(hours / step) + 1 }, (_, i) => from + i * step * HOUR);

  /**
   * A tap anywhere on the track shows the nearest session: a short session
   * is a bar too thin to hit with a finger.
   */
  const pickNearest = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const at = ((e.clientX - box.left) / box.width) * 100;
    const distance = (s: Segment) => Math.max(pct(s.start) - at, at - pct(s.end), 0);
    const nearest = stats.segments.reduce<Segment | null>(
      (best, s) => (best === null || distance(s) < distance(best) ? s : best),
      null
    );
    setHovered(nearest);
  };

  return (
    <figure className="mb-6" aria-label="Timeline of the day">
      <div ref={track} onClick={pickNearest} className="relative h-10 rounded-md bg-slate-100 cursor-pointer">
        {stats.segments.map((s) => (
          <div
            key={`${s.taskId}-${s.start}`}
            data-testid="timeline-segment"
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(null)}
            className="absolute top-1 bottom-1 rounded"
            style={{
              left: `${pct(s.start)}%`,
              // 2px surface gap between neighbouring bars; never thinner than 2px.
              width: `max(2px, calc(${pct(s.end) - pct(s.start)}% - 2px))`,
              background: colors.get(s.taskId),
              opacity: hovered && hovered !== s ? 0.45 : 1,
            }}
          />
        ))}
        {hovered && (
          <div
            role="tooltip"
            className="absolute z-10 -top-2 -translate-y-full -translate-x-1/2 w-max max-w-[16rem] rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow"
            // Kept away from the edges so it stays on a narrow screen.
            style={{ left: `clamp(8rem, ${(pct(hovered.start) + pct(hovered.end)) / 2}%, calc(100% - 8rem))` }}
          >
            <span
              className="mr-1 inline-block h-2 w-2 rounded-sm"
              style={{ background: colors.get(hovered.taskId) }}
            />
            {hovered.title} · {clock(hovered.start)}–{hovered.running ? "now" : clock(hovered.end)} ·{" "}
            {formatMs(hovered.end - hovered.start, timeFormat)}
          </div>
        )}
      </div>
      <div className="relative h-5 mt-1 text-xs text-gray-500" aria-hidden>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${pct(t)}%` }}
          >
            {clock(t)}
          </span>
        ))}
      </div>
    </figure>
  );
}
