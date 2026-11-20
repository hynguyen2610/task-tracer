interface ChipGroupProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}

/** One-tap choice between a few values (radio buttons that look like chips). */
export default function ChipGroup<T extends string>({ label, value, options, onChange }: ChipGroupProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={`min-h-[40px] rounded-full border px-4 text-sm font-medium transition ${
            option === value
              ? "border-accent bg-accent text-on-color"
              : "border-line bg-surface text-fg"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
