import { Pause, Play } from "lucide-react";

interface PlayPauseButtonProps {
  isRunning: boolean;
  onClick: () => void;
  className?: string;
}

export default function PlayPauseButton({
  isRunning,
  onClick,
  className = "",
}: PlayPauseButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 flex items-center justify-center rounded-full text-white transition ${
        isRunning
          ? "bg-red-500 hover:bg-red-600"
          : "bg-green-500 hover:bg-green-600"
      } ${className}`}
    >
      {isRunning ? <Pause /> : <Play />}
    </button>
  );
}
