import { useCallback, useEffect, useRef } from "react";

const KEY = "fullScreenPage";

/**
 * Lets the phone's back button or back swipe close a full-screen page
 * (docs/SPEC.md 14.1): while the page is open, one history entry of its own
 * sits on top. Returns the function to call for every other way of closing,
 * so all of them go through the same history step.
 */
export function useBackClose(onClose: () => void): () => void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });

  useEffect(() => {
    // Reuse our entry if it's already on top (React's development double
    // mount, or a page opened from another page), so one back always closes.
    const ours = (history.state as Record<string, unknown> | null)?.[KEY] === true;
    if (!ours) history.pushState({ ...(history.state ?? {}), [KEY]: true }, "");
    const onPop = () => latest.current();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return useCallback(() => {
    if ((history.state as Record<string, unknown> | null)?.[KEY] === true) history.back();
    else latest.current();
  }, []);
}
