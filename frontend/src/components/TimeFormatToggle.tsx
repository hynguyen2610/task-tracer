import type { TimeFormat } from "../utils/time";

interface TimeFormatToggleProps {
  value: TimeFormat;
  onChange: (format: TimeFormat) => void;
}

const OPTIONS: { value: TimeFormat; label: string; title: string }[] = [
  { value: "hhmm", label: "hh:mm", title: "Show and enter time as hours:minutes, e.g. 01:30" },
  { value: "decimal", label: "Decimal", title: "Show and enter time as decimal hours, e.g. 1.5" },
];

/** Two-button switch between hh:mm and decimal hours. */
export default function TimeFormatToggle({ value, onChange }: TimeFormatToggleProps) {
  return (
    <div
      role="group"
      aria-label="Time format"
      className="inline-flex rounded-lg border border-line overflow-hidden text-sm"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 transition ${
            value === option.value
              ? "bg-selected text-on-color"
              : "bg-surface text-fg-soft hover:bg-fill"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
