import { useSyncExternalStore } from "react";

/** Below Tailwind's `sm` breakpoint (640px): the phone layout (docs/SPEC.md 14). */
const PHONE = "(max-width: 639.98px)";

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches);
}
