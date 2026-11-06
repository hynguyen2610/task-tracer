import type { Priority } from "../types";

export const PRIORITIES: Priority[] = ["Highest", "High", "Normal", "Low"];

export const DEFAULT_PRIORITY: Priority = "Normal";

export const PRIORITY_COLORS: Record<Priority, string> = {
  Highest: "bg-red-100 border-l-4 border-red-500",
  High: "bg-orange-100 border-l-4 border-orange-500",
  Normal: "bg-green-100 border-l-4 border-green-500",
  Low: "bg-gray-100 border-l-4 border-gray-400",
};
