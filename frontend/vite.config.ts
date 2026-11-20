/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// Tauri loads the dev server from a fixed URL (src-tauri/tauri.conf.json:
// build.devUrl), so the port must not change. 1420 is Tauri's usual port; it
// avoids clashing with any other Vite dev server on Vite's default 5173.
export default defineConfig({
  plugins: [
    react(),
    // Installable, offline web app. See docs/SPEC.md 13. Icons come from
    // public/logo.svg (npm run icons). The service worker only exists in
    // builds: test it with `npm run build && npm run preview`.
    VitePWA({
      registerType: 'autoUpdate',
      // Registered in src/main.tsx, which skips it in the desktop app.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Task Tracker',
        short_name: 'Tasks',
        description: 'Track time on your tasks and write the daily report. Data stays on this device.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#4f46e5',
        background_color: '#f1f5f9',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Theme fonts: Latin and Vietnamese work offline; other scripts load
        // only when such text appears (docs/SPEC.md 15.2).
        globIgnores: ['**/*-cyrillic*', '**/*-greek*'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
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
