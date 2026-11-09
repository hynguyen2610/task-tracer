import { Pause, Play } from "lucide-react";

interface PlayPauseButtonProps {
  isRunning: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  /** Accessible names for the two states. */
  labels?: { play: string; pause: string };
  className?: string;
}

export default function PlayPauseButton({
  isRunning,
  onClick,
  disabled = false,
  title,
  labels = { play: "Start", pause: "Pause" },
  className = "",
}: PlayPauseButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={isRunning ? labels.pause : labels.play}
      className={`w-10 h-10 flex items-center justify-center rounded-full text-white transition disabled:opacity-40 disabled:cursor-not-allowed ${
        isRunning
          ? "bg-red-500 hover:bg-red-600"
          : "bg-green-500 enabled:hover:bg-green-600"
      } ${className}`}
    >
      {isRunning ? <Pause /> : <Play />}
    </button>
  );
}
