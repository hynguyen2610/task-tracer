import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "./dailyReport";

const KEY = "dailyReportSettings";

/** Last-used email text, or the defaults. Storage can be blocked, so never throw. */
export function loadReportSettings(): ReportSettings {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return { ...DEFAULT_REPORT_SETTINGS, ...JSON.parse(saved) };
  } catch {
    // fall through to defaults
  }
  return DEFAULT_REPORT_SETTINGS;
}

export function saveReportSettings(settings: ReportSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // not saved; the dialog still works for this session
  }
}

/**
 * Copies rich HTML (keeps lists and highlights when pasted into email) with a
 * plain-text fallback for clients that only accept text.
 */
export async function copyReport(html: string, text: string): Promise<void> {
  if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  // Older browsers: select a rendered copy and use the legacy copy command.
  const el = document.createElement("div");
  el.innerHTML = html;
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  const ok = document.execCommand("copy");
  selection?.removeAllRanges();
  el.remove();
  if (!ok) throw new Error("Copy failed");
}
