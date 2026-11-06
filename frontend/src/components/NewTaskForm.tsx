import { useRef, useState } from "react";
import { DEFAULT_PRIORITY, PRIORITIES } from "../constants/priority";
import type { Priority } from "../types";
import OptionSelect from "./OptionSelect";

interface NewTaskFormProps {
  onAdd: (title: string, priority: Priority) => Promise<void>;
}

export default function NewTaskForm({ onAdd }: NewTaskFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>(DEFAULT_PRIORITY);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!title.trim()) return;
    await onAdd(title, priority);
    setTitle("");
    setPriority(DEFAULT_PRIORITY);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex mb-6 space-x-2">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task title..."
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <OptionSelect
        value={priority}
        options={PRIORITIES}
        onChange={setPriority}
        className="border rounded-lg px-2 py-2"
      />
      <button
        onClick={submit}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
      >
        ➕ Add
      </button>
    </div>
  );
}
