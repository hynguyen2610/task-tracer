import { useState } from "react";
import { useTimeFormat } from "../hooks/useTimeFormat";
import {
  durationToInput,
  inputToDuration,
  sanitizeDurationInput,
} from "../utils/time";

interface DurationInputProps {
  /** Duration in seconds. */
  value: number;
  onChange: (seconds: number) => void;
  onEnter?: () => void;
  onBlur?: () => void;
  className?: string;
}

/** Duration field in the chosen time format: "01:30" or "1.5" (hours). */
export default function DurationInput({ value, onChange, onEnter, onBlur, className }: DurationInputProps) {
  const format = useTimeFormat();
  const [text, setText] = useState(() => durationToInput(value, format));

  const handleBlur = () => {
    // Tidy what was typed: "1:5" -> "01:05", "1,50" -> "1.5".
    const seconds = inputToDuration(text, format);
    setText(durationToInput(seconds, format));
    onBlur?.();
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={format === "decimal" ? "Hours, e.g. 1.5" : "HH:mm"}
      value={text}
      onChange={(e) => {
        const next = sanitizeDurationInput(e.target.value, format);
        setText(next);
        onChange(inputToDuration(next, format));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onEnter?.();
      }}
      onBlur={handleBlur}
      className={className}
    />
  );
}
