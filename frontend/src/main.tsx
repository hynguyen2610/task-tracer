import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isTauri } from '@tauri-apps/api/core'
import { registerSW } from 'virtual:pwa-register'
import { requestPersistentStorage } from './api/storage'
import './index.css'
import App from './App.tsx'

// Installable, offline web app (docs/SPEC.md 13). Not in the desktop app:
// its files come with the app, and a cached copy would hide updates.
if (!isTauri()) {
  registerSW({ immediate: true })
  // The data lives only in this browser; ask it to keep the data.
  void requestPersistentStorage()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
