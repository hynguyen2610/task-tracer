import { useEffect, useId, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useBackClose } from "../../hooks/useBackClose";

interface FullScreenPageProps {
  title: string;
  onClose: () => void;
  /** Under the title in the fixed header, e.g. tabs. */
  header?: ReactNode;
  /** Fixed at the bottom of the screen, e.g. the main button. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * A page over the whole phone screen with Back always in reach at the top
 * (docs/SPEC.md 14.1). Back, Escape and the phone's back all close it.
 */
export default function FullScreenPage({ title, onClose, header, footer, children }: FullScreenPageProps) {
  const close = useBackClose(onClose);
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll along.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex flex-col bg-surface"
    >
      <header className="flex-shrink-0 border-b bg-surface pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2 px-2">
          <button
            type="button"
            onClick={close}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full text-fg hover:bg-fill"
          >
            <ArrowLeft />
          </button>
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-fg-strong">
            {title}
          </h2>
        </div>
        {header}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <footer className="flex-shrink-0 border-t bg-surface px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {footer}
        </footer>
      )}
    </div>
  );
}
