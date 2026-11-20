import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { useIsPhone } from "../hooks/useIsPhone";
import { UI_MODES, setUiMode, useUiMode } from "../hooks/useUiMode";
import BottomSheet from "./phone/BottomSheet";
import ThemePicker from "./ThemePicker";

interface SettingsDialogProps {
  onClose: () => void;
}

function UiModePicker() {
  const current = useUiMode();
  return (
    <div role="radiogroup" aria-label="UI mode" className="grid grid-cols-2 gap-3">
      {UI_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === current}
          onClick={() => setUiMode(m.id)}
          className={`flex items-start justify-between gap-2 rounded-xl border-2 p-3 text-left transition ${
            m.id === current ? "border-accent" : "border-line-soft hover:border-line"
          }`}
        >
          <div className="min-w-0">
            <div className="font-semibold text-fg-strong">{m.name}</div>
            <div className="text-sm text-fg-muted">{m.description}</div>
          </div>
          {m.id === current && <Check className="flex-shrink-0 text-accent" size={20} />}
        </button>
      ))}
    </div>
  );
}

/** The UI mode and the theme (docs/SPEC.md 16); each choice applies at once and is kept. */
export default function SettingsDialog({ onClose }: SettingsDialogProps) {
  const isPhone = useIsPhone();

  useEffect(() => {
    if (isPhone) return; // the sheet handles Escape
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPhone]);

  const content = (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 font-semibold text-fg-strong">UI mode</h3>
        <UiModePicker />
      </section>
      <section>
        <h3 className="mb-2 font-semibold text-fg-strong">Theme</h3>
        <ThemePicker />
      </section>
    </div>
  );

  if (isPhone) {
    return (
      <BottomSheet title="Settings" onClose={onClose}>
        {content}
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-scrim/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-surface rounded-2xl shadow-xl w-full max-w-xl p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="settings-title" className="text-xl font-bold text-fg-strong">
            Settings
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
        {content}
      </div>
    </div>
  );
}
