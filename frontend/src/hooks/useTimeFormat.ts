import { createContext, useCallback, useContext, useState } from "react";
import { DEFAULT_TIME_FORMAT, type TimeFormat } from "../utils/time";

const KEY = "timeFormat";

function loadTimeFormat(): TimeFormat {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "hhmm" || saved === "decimal") return saved;
  } catch {
    // storage blocked: use the default
  }
  return DEFAULT_TIME_FORMAT;
}

/** The chosen time format, remembered in localStorage. Use once, in App. */
export function useTimeFormatSetting() {
  const [format, setFormatState] = useState<TimeFormat>(loadTimeFormat);
  const setFormat = useCallback((next: TimeFormat) => {
    setFormatState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // not saved; still applies for this session
    }
  }, []);
  return { format, setFormat };
}

export const TimeFormatContext = createContext<TimeFormat>(DEFAULT_TIME_FORMAT);

/** The time format chosen in the toggle, for any component under App. */
export function useTimeFormat(): TimeFormat {
  return useContext(TimeFormatContext);
}
