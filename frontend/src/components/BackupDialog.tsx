import { useEffect, useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { exportBackup, lastBackupAt, readBackup, restoreBackup } from "../api/backup";
import type { Backup } from "../core/backup";

interface BackupDialogProps {
  onClose: () => void;
  /** Called after a backup was exported, so the reminder can update. */
  onExported: () => void;
}

const dateTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Exports and imports all data as a JSON file. See docs/SPEC.md 10.3. */
export default function BackupDialog({ onClose, onExported }: BackupDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState(lastBackupAt);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = () =>
    run(async () => {
      const name = await exportBackup();
      if (name === null) return;
      setLast(lastBackupAt());
      setMessage(`Saved ${name}.`);
      onExported();
    });

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    setPending(null);
    void run(async () => setPending(await readBackup(file)));
  };

  const doImport = (backup: Backup) =>
    run(async () => {
      await restoreBackup(backup);
      // Every screen and setting reads afresh from the restored data.
      window.location.reload();
    });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id="backup-title" className="text-xl font-bold text-gray-800">
            Backup
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X />
          </button>
        </div>
        <p className="text-sm text-gray-600">
          Your tasks and history are kept only in this browser, on this device. Clearing the
          browser's data deletes them. Export a backup now and then; import it to restore, or to
          move to another device.
        </p>
        <p className="text-sm text-gray-600 mt-3" data-testid="last-backup">
          Last backup: <strong>{last ? dateTime(last) : "never"}</strong>
        </p>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            type="button"
            onClick={doExport}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
          >
            <Download size={18} /> Export backup
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <Upload size={18} /> Import backup…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Backup file"
            className="hidden"
            onChange={pickFile}
          />
        </div>

        {message && (
          <p role="status" className="mt-4 text-sm text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {pending && (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="text-gray-800">
              Replace everything in this browser with the backup from{" "}
              <strong>{pending.exportedAt ? dateTime(pending.exportedAt) : "an unknown date"}</strong> (
              {count(pending.tasks.length, "task")}, {count(pending.sessions.length, "work session")},{" "}
              {count(pending.events.length, "change")})?
            </p>
            <p className="text-gray-600 mt-1">The tasks and history here now will be lost.</p>
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                onClick={() => doImport(pending)}
                disabled={busy}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={busy}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
