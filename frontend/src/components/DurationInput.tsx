import { useState } from "react"

interface DurationInputProps {
  value: string
  onChange: (val: string) => void
  onEnter?: () => void
  onBlur?: () => void
  className?: string
}

export default function DurationInput({ value, onChange, onEnter, onBlur, className }: DurationInputProps) {
  const [internal, setInternal] = useState(value)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9:]/g, "")
    setInternal(val)
    onChange(val)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onEnter) onEnter()
  }

  const handleBlur = () => {
    const [hRaw, mRaw] = internal.split(":")
    const h = String(Number(hRaw) || 0).padStart(2, "0")
    const m = String(Math.min(Number(mRaw) || 0, 59)).padStart(2, "0")
    const normalized = `${h}:${m}`
    setInternal(normalized)
    onChange(normalized)
    if (onBlur) onBlur()
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="HH:mm"
      value={internal}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={className}
    />
  )
}
