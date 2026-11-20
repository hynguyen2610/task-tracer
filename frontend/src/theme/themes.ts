import { useSyncExternalStore } from "react";

/** The themes (docs/SPEC.md 15). Their look is in themes.css, keyed by id. */
export const THEMES = [
  {
    id: "classic",
    name: "Classic",
    description: "Indigo and blue, clean and bright",
    /** The phone's status bar colour (<meta name="theme-color">). */
    barColor: "#4f46e5",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark navy, cyan light, a sky of stars",
    barColor: "#0a0f1e",
  },
  {
    id: "notebook",
    name: "Notebook",
    description: "Ruled paper, sticky notes, a red pen",
    barColor: "#eee6d2",
  },
  {
    id: "terminal",
    name: "Terminal",
    description: "Green on black, monospace, a blinking cursor",
    barColor: "#000000",
  },
  {
    id: "zen",
    name: "Zen",
    description: "Sand and sage, soft shapes, a falling leaf",
    barColor: "#f4efe4",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "classic";

// Also read by the inline script in index.html, which applies the theme
// before the page first paints.
const KEY = "theme";

const isTheme = (id: unknown): id is ThemeId => THEMES.some((t) => t.id === id);

export function savedTheme(): ThemeId {
  try {
    const id = localStorage.getItem(KEY);
    return isTheme(id) ? id : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Shows the theme on the whole page, including the phone's status bar. */
export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  const bar = THEMES.find((t) => t.id === id)!.barColor;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bar);
}

const listeners = new Set<() => void>();

export function setTheme(id: ThemeId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not saved (private window); it still applies until the page closes.
  }
  applyTheme(id);
  listeners.forEach((l) => l());
}

const current = () => (isTheme(document.documentElement.dataset.theme) ? document.documentElement.dataset.theme : savedTheme());

/** The theme in use; re-renders when it changes. */
export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current
  );
}
