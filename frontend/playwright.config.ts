import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The browser version: the UI served by Vite, talking to the Express backend
// over HTTP. Both run on their own ports with a fresh database per run, so a
// running dev server and the real backend/tasks.db are never touched.
const API_PORT = 4100;
const UI_PORT = 1430;
// Set once in the runner; workers inherit it, so they all see the same file.
process.env.E2E_TASKS_DB ??= join(tmpdir(), `task-tracker-e2e-${Date.now()}.db`);

export default defineConfig({
  testDir: "e2e",
  // Tests share one backend, so run them one at a time.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${UI_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx ts-node-dev --transpile-only src/index.ts",
      cwd: "../backend",
      url: `http://localhost:${API_PORT}/tasks`,
      env: { PORT: String(API_PORT), TASKS_DB: process.env.E2E_TASKS_DB },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${UI_PORT}`,
      url: `http://localhost:${UI_PORT}`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
