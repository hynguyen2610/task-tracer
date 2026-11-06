import { PRIORITIES } from "../constants/priority";
import type { Priority } from "../types";

interface PrioritySelectProps {
  value: Priority;
  onChange: (value: Priority) => void;
  className?: string;
}

export default function PrioritySelect({
  value,
  onChange,
  className,
}: PrioritySelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Priority)}
      className={className}
    >
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
