import { PRIORITIES } from "../constants/priority";
import { STATUSES } from "../constants/status";
import type { Priority, Status } from "../types";
import { useId } from "react";
import { useTimeFormat } from "../hooks/useTimeFormat";
import { toDateInput } from "../utils/date";
import DurationInput from "./DurationInput";
import OptionSelect from "./OptionSelect";

export interface TaskDraft {
  title: string;
  totalSeconds: number;
  /** Whether the time field was changed; if not, the saved time is left alone. */
  timeEdited: boolean;
  /** "YYYY-MM-DD": the task's start date, or today if it hasn't started. */
  startDate: string;
  /** Whether a start date was picked; if not, the saved one is left alone. */
  startDateEdited: boolean;
  priority: Priority;
  status: Status;
  statusNote: string;
}

interface TaskEditFormProps {
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  onSave: () => void;
}

const labelClass = "block text-sm font-medium text-fg-soft";

export default function TaskEditForm({
  draft,
  onChange,
  onSave,
}: TaskEditFormProps) {
  const timeFormat = useTimeFormat();
  const startDateId = useId();
  return (
    <div className="space-y-2 flex-1 min-w-0">
      <label className={labelClass}>Title</label>
      <input
        type="text"
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
        }}
        onBlur={onSave}
        className="border rounded-lg px-2 py-1 w-full"
      />

      <label className={labelClass}>
        Total Time ({timeFormat === "decimal" ? "hours" : "HH:mm"})
      </label>
      <DurationInput
        // Remount on a format switch so the field shows the new format.
        key={timeFormat}
        value={draft.totalSeconds}
        onChange={(totalSeconds) => onChange({ ...draft, totalSeconds, timeEdited: true })}
        onEnter={onSave}
        onBlur={onSave}
        className="border rounded-lg px-2 py-1"
      />

      <label className={labelClass}>Priority</label>
      <OptionSelect
        value={draft.priority}
        options={PRIORITIES}
        onChange={(priority) => onChange({ ...draft, priority })}
        className="border rounded-lg px-2 py-1"
      />

      <label className={labelClass}>Status</label>
      <OptionSelect
        value={draft.status}
        options={STATUSES}
        onChange={(status) => onChange({ ...draft, status })}
        className="border rounded-lg px-2 py-1"
      />

      <label className={labelClass}>Status note (optional)</label>
      <input
        type="text"
        value={draft.statusNote}
        placeholder="e.g. Waiting for Kiro"
        onChange={(e) => onChange({ ...draft, statusNote: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
        }}
        className="border rounded-lg px-2 py-1 w-full"
      />

      <label htmlFor={startDateId} className={labelClass}>
        Start date
      </label>
      <input
        id={startDateId}
        type="date"
        value={draft.startDate}
        max={toDateInput(new Date())}
        onChange={(e) =>
          onChange({ ...draft, startDate: e.target.value, startDateEdited: true })
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
        }}
        className="border rounded-lg px-2 py-1 max-w-full"
      />
    </div>
  );
}
