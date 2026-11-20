import { Check, Play } from "lucide-react";
import { THEMES, setTheme, useTheme, type ThemeId } from "../theme/themes";

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

/** The themes to choose from, in Settings (docs/SPEC.md 15.2); a tap applies one and keeps it. */
export default function ThemePicker() {
  const current = useTheme();
  return (
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
}
