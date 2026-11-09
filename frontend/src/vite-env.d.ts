/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Express backend used when the UI runs in a plain browser. */
  readonly VITE_API_URL?: string;
}
