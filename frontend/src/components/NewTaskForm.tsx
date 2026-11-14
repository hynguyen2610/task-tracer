import { useId, useMemo, useRef, useState } from "react";
import { DEFAULT_PRIORITY, PRIORITIES } from "../constants/priority";
import { formatReportDate } from "../report/dailyReport";
import type { Priority, Task } from "../types";
import { findExactMatch, normalizeTitle, suggestTasks } from "../utils/taskMatch";
import OptionSelect from "./OptionSelect";
import ChipGroup from "./phone/ChipGroup";

interface NewTaskFormProps {
  /** Existing tasks, to suggest similar titles and offer their start date. */
  tasks: Task[];
  onAdd: (title: string, priority: Priority, startedAt?: number) => Promise<void>;
  /** The phone layout's add sheet: the keyboard opens at once, priority is chips. */
  phone?: boolean;
}

const startLabel = (task: Task) =>
  task.startedAt ? `started ${formatReportDate(new Date(task.startedAt))}` : "not started";

export default function NewTaskForm({ tasks, onAdd, phone = false }: NewTaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>(DEFAULT_PRIORITY);
  const [listOpen, setListOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [reuseStart, setReuseStart] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const reuseId = useId();

  const suggestions = useMemo(() => suggestTasks(tasks, title), [tasks, title]);
  const match = useMemo(() => findExactMatch(tasks, title), [tasks, title]);
  // No point listing only the title that is already typed in full.
  const showList =
    listOpen &&
    suggestions.length > 0 &&
    !(suggestions.length === 1 && normalizeTitle(suggestions[0].title) === normalizeTitle(title));

  const changeTitle = (next: string, reuse = false) => {
    setTitle(next);
    setReuseStart(reuse);
    setHighlighted(-1);
  };

  /** Picking a suggestion means "the same task again", so reuse its start date. */
  const pick = (task: Task) => {
    changeTitle(task.title, task.startedAt !== null);
    setListOpen(false);
  };

  const submit = async () => {
    if (!title.trim()) return;
    const startedAt = reuseStart && match?.startedAt ? match.startedAt : undefined;
    await onAdd(title, priority, startedAt);
    changeTitle("");
    setPriority(DEFAULT_PRIORITY);
    setListOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!suggestions.length) return;
      e.preventDefault();
      setListOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlighted((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setListOpen(false);
      setHighlighted(-1);
    } else if (e.key === "Enter") {
      if (showList && highlighted >= 0) pick(suggestions[highlighted]);
      else submit();
    }
  };

  return (
    <div className={phone ? "" : "mb-6"}>
      {/* On a narrow screen the title gets its own line; priority and Add go below. */}
      <div className={phone ? "flex flex-col gap-3" : "flex flex-wrap gap-2"}>
        <div className="relative basis-full sm:basis-0 sm:flex-1">
          <input
            ref={inputRef}
            autoFocus={phone}
            enterKeyHint="done"
            type="text"
            value={title}
            onChange={(e) => {
              changeTitle(e.target.value);
              setListOpen(true);
            }}
            onFocus={() => setListOpen(true)}
            onBlur={() => setListOpen(false)}
            onKeyDown={onKeyDown}
            placeholder="New task title..."
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={listId}
            aria-activedescendant={
              showList && highlighted >= 0 ? `${listId}-${highlighted}` : undefined
            }
            className={`w-full border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              phone ? "h-12 text-base" : "py-2"
            }`}
          />
          {showList && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Existing tasks"
              className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden"
            >
              {suggestions.map((task, i) => (
                <li
                  key={task.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === highlighted}
                  // Keep focus in the input; pick on mouse down, before blur.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(task);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`px-3 py-2 cursor-pointer flex items-baseline justify-between gap-4 ${
                    i === highlighted ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="text-gray-800 truncate">{task.title}</span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {task.status} · {startLabel(task)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {phone ? (
          <ChipGroup label="Priority" value={priority} options={PRIORITIES} onChange={setPriority} />
        ) : (
          <OptionSelect
            value={priority}
            options={PRIORITIES}
            onChange={setPriority}
            className="border rounded-lg px-2 py-2"
          />
        )}
        <button
          onClick={submit}
          className={`px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition ${
            phone ? "h-12 font-medium" : "flex-1 sm:flex-none py-2"
          }`}
        >
          ➕ Add
        </button>
      </div>

      {match?.startedAt && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          <input
            id={reuseId}
            type="checkbox"
            checked={reuseStart}
            onChange={(e) => setReuseStart(e.target.checked)}
          />
          <label htmlFor={reuseId}>
            "{match.title}" already exists ({match.status}). Use its start date,{" "}
            <strong>{formatReportDate(new Date(match.startedAt))}</strong>?
          </label>
        </div>
      )}
    </div>
  );
}
