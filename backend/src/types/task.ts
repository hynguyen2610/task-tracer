export interface Task {
  id: number;
  title: string;
  totalSeconds: number;
  isRunning: boolean;
  lastStart?: number;
}