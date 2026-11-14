import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * How much of the bottom of the window the on-screen keyboard covers. iOS
 * doesn't shrink the page for the keyboard, so a sheet fixed to the bottom
 * would sit behind it.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/** A panel that slides up from the bottom of a phone screen, over a dimmed page. */
export default function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  const keyboard = useKeyboardInset();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end" style={{ bottom: keyboard }} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[85%] overflow-y-auto rounded-t-2xl bg-white px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl animate-sheet-up"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 -mr-2 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
