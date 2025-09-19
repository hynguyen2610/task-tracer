import { Play, Pause } from "lucide-react"

export default function GlobalToggle({ running, onToggle }: { running: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full text-white transition ${
        running ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
      }`}
    >
      {running ? <Pause /> : <Play />}
    </button>
  )
}
