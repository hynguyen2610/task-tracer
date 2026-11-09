import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  clockToMinutes,
  DEFAULT_WORKDAY,
  minutesToClock,
  workdayError,
  type WorkdaySettings,
} from "../stats/workday";

interface WorkdayDialogProps {
  value: WorkdaySettings;
  onSave: (workday: WorkdaySettings) => void;
  onClose: () => void;
}

type Field = keyof WorkdaySettings;

const FIELDS: { field: Field; label: string }[] = [
  { field: "start", label: "Workday starts" },
  { field: "lunchStart", label: "Lunch starts" },
  { field: "lunchEnd", label: "Lunch ends" },
  { field: "end", label: "Workday ends" },
];

const toText = (w: WorkdaySettings) =>
  Object.fromEntries(FIELDS.map(({ field }) => [field, minutesToClock(w[field])])) as Record<Field, string>;

/** Edits working hours and lunch. See docs/SPEC.md 9.4. */
export default function WorkdayDialog({ value, onSave, onClose }: WorkdayDialogProps) {
  const [text, setText] = useState(() => toText(value));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const parsed = FIELDS.map(({ field }) => [field, clockToMinutes(text[field])] as const);
  const missing = parsed.some(([, minutes]) => minutes === null);
  const workday = Object.fromEntries(parsed) as unknown as WorkdaySettings;
  const error = missing ? "Fill in every time." : workdayError(workday);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    onSave(workday);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="workday-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 my-8"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id="workday-title" className="text-xl font-bold text-gray-800">
            Workday hours
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Breaks only count inside the workday, and never during lunch.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ field, label }) => (
            <label key={field} className="text-sm font-medium text-gray-600">
              {label}
              <input
                type="time"
                required
                value={text[field]}
                onChange={(e) => setText({ ...text, [field]: e.target.value })}
                className="mt-1 border rounded-lg px-2 py-1 w-full text-sm font-normal"
              />
            </label>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 mt-5">
          <button
            type="button"
            onClick={() => setText(toText(DEFAULT_WORKDAY))}
            className="text-sm text-gray-600 hover:underline"
          >
            Reset to defaults
          </button>
          <button
            type="submit"
            disabled={!!error}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
