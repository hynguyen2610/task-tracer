import { useEffect } from "react";
import { Check, Play, X } from "lucide-react";
import { useIsPhone } from "../hooks/useIsPhone";
import { THEMES, setTheme, useTheme, type ThemeId } from "../theme/themes";
import BottomSheet from "./phone/BottomSheet";

interface ThemePickerProps {
  onClose: () => void;
}

/** A small task card drawn in the given theme, whatever theme the page uses. */
function Preview({ id }: { id: ThemeId }) {
  return (
    <div data-theme={id} aria-hidden className="theme-swatch bg-page font-sans rounded-lg p-2">
      <div className="flex items-center gap-2 rounded-md border-l-4 border-row-progress-edge bg-row-progress px-2 py-1.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-fg-strong">Daily standup</div>
          <div className="text-sm font-semibold tabular-nums text-fg-strong">01:25:00</div>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-go text-on-color">
          <Play size={14} />
        </span>
      </div>
      <div className="mt-1.5 flex gap-1">
        <span className="h-1.5 w-8 rounded-full bg-primary" />
        <span className="h-1.5 w-5 rounded-full bg-accent" />
      </div>
    </div>
  );
}

/** Choose one of the themes (docs/SPEC.md 15); it applies at once and is kept. */
export default function ThemePicker({ onClose }: ThemePickerProps) {
  const isPhone = useIsPhone();
  const current = useTheme();

  useEffect(() => {
    if (isPhone) return; // the sheet handles Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPhone]);

  const list = (
    <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-2">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={t.id === current}
          onClick={() => setTheme(t.id)}
          className={`rounded-xl border-2 p-2 text-left transition ${
            t.id === current ? "border-accent" : "border-line-soft hover:border-line"
          }`}
        >
          <Preview id={t.id} />
          <div className="mt-2 flex items-center justify-between gap-2 px-1">
            <div className="min-w-0">
              <div className="font-semibold text-fg-strong">{t.name}</div>
              <div className="text-sm text-fg-muted">{t.description}</div>
            </div>
            {t.id === current && <Check className="flex-shrink-0 text-accent" size={20} />}
          </div>
        </button>
      ))}
    </div>
  );

  if (isPhone) {
    return (
      <BottomSheet title="Theme" onClose={onClose}>
        {list}
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-scrim/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-title"
        className="bg-surface rounded-2xl shadow-xl w-full max-w-xl p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="theme-title" className="text-xl font-bold text-fg-strong">
            Theme
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-fill"
          >
            <X />
          </button>
        </div>
        {list}
      </div>
    </div>
  );
}
