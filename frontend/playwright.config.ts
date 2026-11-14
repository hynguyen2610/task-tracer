import { defineConfig, devices } from "@playwright/test";

// The browser version, keeping its data in IndexedDB. Every test gets a new
// browser context, so it starts with a new, empty database (one Todo task),
// and tests can run side by side. Vite runs on its own ports, so a running
// dev server is never touched.
//
// - "chromium": the app on the Vite dev server.
// - "pwa": the built app on `vite preview`, since the service worker only
//   exists in a build (docs/SPEC.md 13).
const UI_PORT = 1430;
const PREVIEW_PORT = 1431;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      testIgnore: "pwa.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${UI_PORT}` },
    },
    {
      name: "pwa",
      testMatch: "pwa.spec.ts",
      use: { ...devices["Pixel 7"], baseURL: `http://localhost:${PREVIEW_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${UI_PORT}`,
      url: `http://localhost:${UI_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite build && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
