// Asks the browser not to clear the on-device data when space runs low or
// the site goes unused (docs/SPEC.md 13). Browsers decide for themselves:
// Chrome agrees for installed or often-used sites, Safari keeps the data of
// apps added to the home screen.

export type StorageState = "kept" | "may-be-cleared" | "unknown";

/** Asks once; resolves to what the browser decided. Never rejects. */
export async function requestPersistentStorage(): Promise<StorageState> {
  try {
    if (!navigator.storage?.persist) return "unknown";
    if (await navigator.storage.persisted()) return "kept";
    return (await navigator.storage.persist()) ? "kept" : "may-be-cleared";
  } catch {
    return "unknown";
  }
}

/** What the browser has decided so far, without asking. */
export async function storageState(): Promise<StorageState> {
  try {
    if (!navigator.storage?.persisted) return "unknown";
    return (await navigator.storage.persisted()) ? "kept" : "may-be-cleared";
  } catch {
    return "unknown";
  }
}
