import { defineConfig, devices } from "@playwright/test";

// The browser version: the UI served by Vite, keeping its data in IndexedDB.
// Every test gets a new browser context, so it starts with a new, empty
// database (one Todo task), and tests can run side by side. Vite runs on its
// own port, so a running dev server is never touched.
const UI_PORT = 1430;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${UI_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite --port ${UI_PORT}`,
    url: `http://localhost:${UI_PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
