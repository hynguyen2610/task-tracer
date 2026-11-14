import { expect, test, type Page } from "@playwright/test";

// The app on a small phone (iPhone SE size, touch), on the dev server. See
// playwright.config.ts, project "phone". Nothing may need sideways scrolling,
// and titles get the width of the screen.

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function addTask(page: Page, title: string) {
  await page.getByPlaceholder("New task title...").fill(title);
  await page.getByRole("button", { name: "➕ Add" }).click();
  await expect(page.getByTestId("task").filter({ hasText: title })).toBeVisible();
  // Pin the row by its id, so it still matches while the title is being
  // edited (an input's value isn't text).
  const id = await page.getByTestId("task").filter({ hasText: title }).getAttribute("data-rfd-draggable-id");
  return page.locator(`[data-testid="task"][data-rfd-draggable-id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
});

test("the task list fits the screen and titles get its width", async ({ page }) => {
  const row = await addTask(page, "Review the quarterly time tracking export");
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  // The title isn't squeezed beside the buttons: it uses most of the row.
  const title = (await row.locator("p").first().boundingBox())!;
  const box = (await row.boundingBox())!;
  expect(title.width).toBeGreaterThan(box.width * 0.6);
  // The buttons sit on their own line under the details.
  const del = (await row.getByRole("button", { name: "Delete task" }).boundingBox())!;
  expect(del.y).toBeGreaterThan(title.y + title.height);
  expect(del.x + del.width).toBeLessThanOrEqual(box.x + box.width);
});

test("the edit form fits the screen", async ({ page }) => {
  const row = await addTask(page, "Edit me on a phone");
  await row.getByRole("button", { name: "Edit task" }).tap();
  await expect(row.getByRole("button", { name: "Save task" })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await row.getByRole("button", { name: "Save task" }).tap();
});

test("dialogs fit the screen", async ({ page }) => {
  await addTask(page, "Report on a phone");
  for (const name of ["Daily report", /^Backup/]) {
    await page.getByRole("button", { name }).tap();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await dialog.getByRole("button", { name: "Close" }).tap();
    await expect(dialog).toHaveCount(0);
  }
});

test("statistics fit the screen and a tap on the timeline shows the details", async ({ page }) => {
  const title = "Timed on a phone";
  const row = await addTask(page, title);
  await row.getByRole("button", { name: "Start" }).tap();
  await expect(row).toContainText(/Total Time: 00:00:0[1-9]/, { timeout: 10_000 });
  await row.getByRole("button", { name: "Pause" }).tap();

  await page.getByRole("button", { name: "Statistics" }).tap();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  // The session is a bar a few pixels wide; a tap near it is enough.
  const track = page.getByRole("figure", { name: "Timeline of the day" }).locator("div").first();
  const bar = (await page.getByTestId("timeline-segment").first().boundingBox())!;
  const trackBox = (await track.boundingBox())!;
  const x = Math.min(bar.x + 20, trackBox.x + trackBox.width - 1) - trackBox.x;
  await track.tap({ position: { x, y: trackBox.height / 2 } });
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText(title);
  const box = (await tip.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  // A tap elsewhere hides it.
  await page.getByRole("heading", { name: "By task" }).tap();
  await expect(tip).toHaveCount(0);
});
