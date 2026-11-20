/** @type {import('tailwindcss').Config} */

// Colours are roles, not hues: each theme sets them as CSS variables in
// src/theme/themes.css (docs/SPEC.md 15). Tailwind's own palette is left out on
// purpose, so a component can't pick a colour that a theme doesn't control;
// src/theme/noRawColors.test.ts checks the code for it.
const role = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const roles = (prefix, names) =>
  Object.fromEntries(names.map((n) => [n, role(n === "DEFAULT" ? prefix : `${prefix}-${n}`)]));

export default {
  content: ["./index.html", "./src/**/*.{js,ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      // Surfaces
      page: roles("page", ["DEFAULT", "deep"]),
      surface: role("surface"),
      fill: roles("fill", ["DEFAULT", "soft"]),
      line: roles("line", ["DEFAULT", "soft"]),
      scrim: role("scrim"),
      tooltip: role("tooltip"),
      // Text, strongest to faintest
      fg: roles("fg", ["DEFAULT", "strong", "soft", "muted", "faint", "ghost"]),
      // Text and icons on a coloured background (buttons, tooltip, selection)
      "on-color": role("on-color"),
      // Actions
      primary: roles("primary", ["DEFAULT", "hover", "soft", "ring"]),
      accent: roles("accent", ["DEFAULT", "hover", "soft", "ring", "strong"]),
      selected: role("selected"),
      go: roles("go", ["DEFAULT", "hover"]),
      stop: roles("stop", ["DEFAULT", "hover"]),
      live: role("live"),
      edit: roles("edit", ["DEFAULT", "hover"]),
      neutral: roles("neutral", ["DEFAULT", "hover"]),
      // Meanings
      danger: roles("danger", ["DEFAULT", "hover", "soft", "strong"]),
      success: role("success"),
      warn: roles("warn", ["DEFAULT", "soft", "line", "strong"]),
      // Task rows: background and left edge, by priority, or by status where it overrides
      row: {
        highest: role("row-highest"),
        "highest-edge": role("row-highest-edge"),
        high: role("row-high"),
        "high-edge": role("row-high-edge"),
        normal: role("row-normal"),
        "normal-edge": role("row-normal-edge"),
        low: role("row-low"),
        "low-edge": role("row-low-edge"),
        progress: role("row-progress"),
        "progress-edge": role("row-progress-edge"),
        pending: role("row-pending"),
        "pending-edge": role("row-pending-edge"),
        done: role("row-done"),
        "done-edge": role("row-done-edge"),
      },
      // The report preview looks like the email in every theme.
      email: { paper: role("email-paper"), ink: role("email-ink") },
    },
    extend: {
      // `border` with no colour, and `divide-*`
      borderColor: { DEFAULT: role("line-soft") },
      ringColor: { DEFAULT: role("primary-ring") },
      // Bottom sheets on the phone layout slide up (docs/SPEC.md 14).
      keyframes: {
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
      },
      animation: { "sheet-up": "sheet-up 180ms ease-out" },
    },
  },
  plugins: [],
};
