import { useEffect, useRef, useState, type ReactNode } from "react";

export interface MenuAction {
  label: string;
  icon?: ReactNode;
  /** Shown after the label, e.g. a reminder dot. */
  badge?: ReactNode;
  /** Accessible name when it differs from the label. */
  ariaLabel?: string;
  danger?: boolean;
  onSelect: () => void;
}

interface ActionMenuProps {
  /** Accessible name of the button that opens the menu. */
  label: string;
  /** What the button shows. */
  trigger: ReactNode;
  actions: MenuAction[];
  className?: string;
}

/** A button that opens a short list of actions, closed by a tap outside or Escape. */
export default function ActionMenu({ label, trigger, actions, className = "" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={className}
      >
        {trigger}
      </button>
      {open && (
        <ul
          role="menu"
          aria-label={label}
          className="absolute right-0 top-full z-40 mt-1 min-w-[12rem] overflow-hidden rounded-xl border bg-white py-1 shadow-lg"
        >
          {actions.map((a) => (
            <li key={a.label} role="none">
              <button
                role="menuitem"
                aria-label={a.ariaLabel}
                onClick={() => {
                  setOpen(false);
                  a.onSelect();
                }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                  a.danger ? "text-red-600" : "text-gray-800"
                }`}
              >
                {a.icon}
                <span className="flex-1">{a.label}</span>
                {a.badge}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
