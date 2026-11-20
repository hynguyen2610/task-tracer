import { expect, test, type Page } from "@playwright/test";

// Settings: UI mode and theme (docs/SPEC.md 16). Runs in the "chromium"
// (desktop) and "phone" projects, so both layouts are covered.

async function pickUiMode(page: Page, name: "Full" | "Compact") {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  const mode = settings.getByRole("radiogroup", { name: "UI mode" }).getByRole("radio", { name: new RegExp(`^${name}`) });
  await mode.click();
  await expect(mode).toHaveAttribute("aria-checked", "true");
  await settings.getByRole("button", { name: "Close" }).click();
  await expect(settings).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
});

test("Settings holds the UI mode and the theme; Full is the default", async ({ page }) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
  await expect(settings.getByRole("radio", { name: /^Full/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Theme", exact: true })).toHaveCount(0);
});

test("compact mode shows only the title, a status icon and Start/Pause, and is kept", async ({ page }) => {
  const task = page.getByTestId("task").first();
  await expect(task.getByText("Consumed", { exact: false })).not.toHaveCount(0);

  await pickUiMode(page, "Compact");
  await expect(task).toContainText("First task of the day");
  await expect(task.getByRole("img", { name: "Status: Todo" })).toBeVisible();
  await expect(task.getByRole("button")).toHaveCount(1);
  await expect(task.getByText("Consumed", { exact: false })).toHaveCount(0);

  await task.getByRole("button", { name: "Start" }).click();
  await expect(task.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(task.getByRole("img", { name: "Status: In progress" })).toBeVisible();
  await expect(task).toHaveClass(/glow/);

  await page.reload();
  await expect(page.getByTestId("task").first().getByRole("img", { name: /^Status: / })).toBeVisible();

  await pickUiMode(page, "Full");
  await expect(page.getByTestId("task").first().getByText("Consumed", { exact: false })).not.toHaveCount(0);
});
