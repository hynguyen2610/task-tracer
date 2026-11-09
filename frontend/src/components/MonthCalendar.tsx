import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey } from "../stats/dayStats";

interface MonthCalendarProps {
  /** Any date in the month to show. */
  month: Date;
  selected: Date;
  /** Days (dayKey) with tracked work, marked with a dot. */
  activeDays: Set<string>;
  onSelect: (day: Date) => void;
  onMonthChange: (month: Date) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid, weeks starting on Monday. Days after today can't be picked. */
export default function MonthCalendar({
  month,
  selected,
  activeDays,
  onSelect,
  onMonthChange,
}: MonthCalendarProps) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const leadingBlanks = (first.getDay() + 6) % 7; // Monday = 0
  const todayKey = dayKey(new Date());
  const selectedKey = dayKey(selected);
  const isCurrentMonth = year === new Date().getFullYear() && m === new Date().getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(first);

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, m, i + 1)),
  ];

  return (
    <div className="w-full max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onMonthChange(new Date(year, m - 1, 1))}
          aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="font-semibold text-gray-800" aria-live="polite">
          {monthLabel}
        </h3>
        <button
          onClick={() => onMonthChange(new Date(year, m + 1, 1))}
          aria-label="Next month"
          disabled={isCurrentMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {WEEKDAYS.map((d) => (
          <div key={d} aria-hidden className="text-xs font-medium text-gray-500 py-1">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`blank-${i}`} />;
          const key = dayKey(day);
          const isSelected = key === selectedKey;
          const isToday = key === todayKey;
          const hasWork = activeDays.has(key);
          const isFuture = key > todayKey;
          const label = new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(day);
          return (
            <button
              key={key}
              onClick={() => onSelect(day)}
              disabled={isFuture}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${label}${hasWork ? ", has tracked work" : ""}`}
              data-day={key}
              className={`relative h-9 rounded-lg transition disabled:text-gray-300 ${
                isSelected
                  ? "bg-indigo-600 text-white font-semibold"
                  : isToday
                    ? "ring-1 ring-indigo-400 text-gray-800 hover:bg-indigo-50"
                    : "text-gray-700 enabled:hover:bg-gray-100"
              }`}
            >
              {day.getDate()}
              {hasWork && (
                <span
                  aria-hidden
                  className={`absolute left-1/2 -translate-x-1/2 bottom-1 h-1 w-1 rounded-full ${
                    isSelected ? "bg-white" : "bg-indigo-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
