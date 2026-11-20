import { useSyncExternalStore } from "react";

/** How much each task shows (docs/SPEC.md 16). */
export type UiMode = "full" | "compact";

export const UI_MODES: { id: UiMode; name: string; description: string }[] = [
  { id: "full", name: "Full", description: "Every detail of each task" },
  { id: "compact", name: "Compact", description: "Title, status icon and Start/Pause only" },
];

export const DEFAULT_UI_MODE: UiMode = "full";

const KEY = "uiMode";

const isUiMode = (value: unknown): value is UiMode => value === "full" || value === "compact";

function load(): UiMode {
  try {
    const saved = localStorage.getItem(KEY);
    return isUiMode(saved) ? saved : DEFAULT_UI_MODE;
  } catch {
    return DEFAULT_UI_MODE;
  }
}

let mode: UiMode = load();
const listeners = new Set<() => void>();

export function setUiMode(next: UiMode) {
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Not saved (private window); it still applies until the page closes.
  }
  listeners.forEach((l) => l());
}

/** The UI mode in use; re-renders when it changes. */
export function useUiMode(): UiMode {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode
  );
}
