import { PRIORITIES } from "../constants/priority";
import { STATUSES } from "../constants/status";
import type { Priority, Status } from "../types";
import DurationInput from "./DurationInput";
import OptionSelect from "./OptionSelect";

export interface TaskDraft {
  title: string;
  /** "HH:mm" */
  time: string;
  priority: Priority;
  status: Status;
}

interface TaskEditFormProps {
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  onSave: () => void;
}

const labelClass = "block text-sm font-medium text-gray-600";

export default function TaskEditForm({
  draft,
  onChange,
  onSave,
}: TaskEditFormProps) {
  return (
    <div className="space-y-2 flex-1">
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

      <label className={labelClass}>Total Time (HH:mm)</label>
      <DurationInput
        value={draft.time}
        onChange={(time) => onChange({ ...draft, time })}
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
    </div>
  );
}
