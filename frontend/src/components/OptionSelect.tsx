interface OptionSelectProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  className?: string;
}

/** A <select> over a fixed list of string values, such as priorities or statuses. */
export default function OptionSelect<T extends string>({
  value,
  options,
  onChange,
  className,
}: OptionSelectProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={className}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
