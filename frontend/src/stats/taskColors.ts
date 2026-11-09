// Categorical colours for tasks on the timeline (validated palette, light
// surface). Tasks get slots in the order they first appear that day, so a
// task keeps its colour while you look at the day. Past 8 tasks the rest
// share a neutral grey; the table and list name every task in text.
const SLOTS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#6250d6", // violet
  "#e34948", // red
];
export const OTHER_COLOR = "#9a9893";

/** Colour per task id, in order of first appearance. */
export function assignTaskColors(taskIdsInOrder: number[]): Map<number, string> {
  const colors = new Map<number, string>();
  for (const id of taskIdsInOrder) {
    if (!colors.has(id)) colors.set(id, SLOTS[colors.size] ?? OTHER_COLOR);
  }
  return colors;
}
