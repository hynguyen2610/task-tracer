import type { Priority } from "../types";

export const PRIORITIES: Priority[] = ["Highest", "High", "Normal", "Low"];

export const DEFAULT_PRIORITY: Priority = "Normal";

export const PRIORITY_COLORS: Record<Priority, string> = {
  Highest: "bg-row-highest border-l-4 border-row-highest-edge",
  High: "bg-row-high border-l-4 border-row-high-edge",
  Normal: "bg-row-normal border-l-4 border-row-normal-edge",
  Low: "bg-row-low border-l-4 border-row-low-edge",
};
