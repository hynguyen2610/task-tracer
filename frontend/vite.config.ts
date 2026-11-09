/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Tauri loads the dev server from a fixed URL (src-tauri/tauri.conf.json:
// build.devUrl), so the port must not change. 1420 is Tauri's usual port; it
// avoids clashing with any other Vite dev server on Vite's default 5173.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  // Unit tests only; the Playwright tests in e2e/ run with `npm run test:e2e`.
  test: {
    include: ['src/**/*.test.ts'],
  },
})
