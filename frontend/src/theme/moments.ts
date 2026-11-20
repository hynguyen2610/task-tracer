import { useEffect, useRef, useState } from "react";

// Moments a theme can animate (src/theme/effects.css): marked on a task card
// for a short while, then cleared, so an animation plays once.

const MOMENT_MS = 1500;

/** True for a moment after `on` turns true. Not when it is already true at first. */
export function useJustBecame(on: boolean): boolean {
  const [active, setActive] = useState(false);
  const before = useRef(on);
  useEffect(() => {
    const turnedOn = on && !before.current;
    before.current = on;
    if (!turnedOn) return;
    setActive(true);
    const timer = setTimeout(() => setActive(false), MOMENT_MS);
    return () => clearTimeout(timer);
  }, [on]);
  return active;
}

/**
 * The ids that just appeared in the list, for a moment. The ids there once
 * the list has loaded (or when coming back to the screen) are not new.
 */
export function useNewIds(ids: number[], loaded: boolean): ReadonlySet<number> {
  const known = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<number>>(() => new Set());
  const key = ids.join(",");

  useEffect(() => {
    if (!loaded) return;
    const now = key ? key.split(",").map(Number) : [];
    if (known.current === null) {
      known.current = new Set(now);
      return;
    }
    const added = now.filter((id) => !known.current!.has(id));
    // Forget ids that left, so one coming back (a task finished again) is new again.
    known.current = new Set(now);
    if (added.length === 0) return;
    setFresh(new Set(added));
    const timer = setTimeout(() => setFresh(new Set()), MOMENT_MS);
    return () => clearTimeout(timer);
  }, [key, loaded]);

  return fresh;
}
