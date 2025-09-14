export interface Task {
  id: number;
  title: string;
  totalSeconds: number;
  isRunning: boolean;
  priority: "Highest" | "High" | "Normal" | "Low"
}
