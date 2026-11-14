import { expect, test, type Page } from "@playwright/test";

// The phone layout (docs/SPEC.md 14) on a small phone (iPhone SE size, touch),
// on the dev server. See playwright.config.ts, project "phone".

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const card = (page: Page, title: string) => page.getByTestId("task").filter({ hasText: title });

/** Adds a task from the add sheet; returns its card, pinned by id so it survives edits. */
async function addTask(page: Page, title: string, priority?: string) {
  await page.getByRole("button", { name: "Add task" }).tap();
  const sheet = page.getByRole("dialog", { name: "New task" });
  await expect(sheet.getByPlaceholder("New task title...")).toBeFocused();
  await sheet.getByPlaceholder("New task title...").fill(title);
  if (priority) await sheet.getByRole("radio", { name: priority, exact: true }).tap();
  await sheet.getByRole("button", { name: "➕ Add" }).tap();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, title)).toBeVisible();
  const id = await card(page, title).getAttribute("data-task-id");
  return page.locator(`[data-testid="task"][data-task-id="${id}"]`);
}

const titles = (page: Page) =>
  page.getByTestId("task").evaluateAll((cards) => cards.map((c) => c.querySelector("p")!.textContent));

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
});

test("a card gives the title the width and the time and main button their own line", async ({ page }) => {
  const row = await addTask(page, "Review the quarterly time tracking export", "High");
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  const title = (await row.locator("p").first().boundingBox())!;
  const box = (await row.boundingBox())!;
  // Only the drag handle and the menu button share its line.
  expect(title.width).toBeGreaterThan(box.width - 100);
  await expect(row.getByRole("button", { name: "Status: Todo" })).toBeVisible();
  await expect(row).toContainText("High");
  // One big Start button under the title, at least 44px for a thumb.
  const start = (await row.getByRole("button", { name: "Start" }).boundingBox())!;
  expect(start.y).toBeGreaterThan(title.y + title.height);
  expect(start.height).toBeGreaterThanOrEqual(44);
  // Edit and Delete wait in the card's menu.
  await expect(row.getByRole("button", { name: "Edit task" })).toHaveCount(0);
});

test("the running task is pinned at the top and can be paused from there", async ({ page }) => {
  const title = "Timed on a phone";
  const row = await addTask(page, title);
  const bar = page.getByRole("region", { name: "Running task" });
  await expect(bar).toHaveCount(0);

  await row.getByRole("button", { name: "Start" }).tap();
  await expect(bar).toContainText(title);
  await expect(bar).toContainText(/00:00:0[1-9]/, { timeout: 10_000 });
  await bar.getByRole("button", { name: "Pause" }).tap();
  await expect(bar).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Start" })).toBeVisible();
});

test("the card menu edits and deletes", async ({ page }) => {
  const row = await addTask(page, "Edit me on a phone");
  await row.getByRole("button", { name: "Task actions" }).tap();
  await page.getByRole("menuitem", { name: "Edit task" }).tap();
  const input = row.getByRole("textbox").first();
  await expect(input).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await input.fill("Edited on a phone");
  await row.getByRole("button", { name: "Save task" }).tap();
  await expect(row.locator("p").first()).toHaveText("Edited on a phone");

  await row.getByRole("button", { name: "Task actions" }).tap();
  await page.getByRole("menuitem", { name: "Delete task" }).tap();
  await expect(card(page, "Edited on a phone")).toHaveCount(0);
});

test("the status chip opens a picker, and finished tasks fold away", async ({ page }) => {
  const row = await addTask(page, "Finish me");
  await row.getByRole("button", { name: "Status: Todo" }).tap();
  const sheet = page.getByRole("dialog", { name: "Status" });
  await expect(sheet.getByRole("radio", { name: "Todo" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("radio", { name: "Done" }).tap();
  await expect(sheet).toHaveCount(0);

  const finished = page.getByRole("button", { name: "Finished (1)" });
  await expect(finished).toHaveAttribute("aria-expanded", "false");
  await expect(row).toHaveCount(0);
  await finished.tap();
  await expect(row.getByRole("button", { name: "Status: Done" })).toBeVisible();
});

test("open tasks reorder by their handle and finished tasks stay put", async ({ page }) => {
  await addTask(page, "Second");
  const done = await addTask(page, "Already done");
  await addTask(page, "Fourth");
  await done.getByRole("button", { name: "Status: Todo" }).tap();
  await page.getByRole("dialog", { name: "Status" }).getByRole("radio", { name: "Done" }).tap();
  await expect.poll(() => titles(page)).toEqual(["First task of the day", "Second", "Fourth"]);

  // Keyboard dragging, as touch dragging can't be scripted reliably.
  const handle = card(page, "Fourth").getByLabel("Drag to reorder");
  await handle.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect.poll(() => titles(page)).toEqual(["Fourth", "First task of the day", "Second"]);

  // The stored order moved Fourth to the top and left the finished task where it was.
  await page.reload();
  await page.getByRole("button", { name: "Finished (1)" }).tap();
  await expect.poll(() => titles(page)).toEqual(["Fourth", "First task of the day", "Second", "Already done"]);
});

test("the more menu opens the report and backup, and they fit the screen", async ({ page }) => {
  await addTask(page, "Report on a phone");
  for (const [item, dialogName] of [
    ["Daily report", /report/i],
    [/^Backup/, "Backup"],
  ] as const) {
    await page.getByRole("button", { name: /^More actions/ }).tap();
    await page.getByRole("menuitem", { name: item }).tap();
    const dialog = page.getByRole("dialog", { name: dialogName });
    await expect(dialog).toBeVisible();
    expect(await sideways(page)).toBeLessThanOrEqual(0);
    await dialog.getByRole("button", { name: "Close" }).tap();
    await expect(dialog).toHaveCount(0);
  }
});

test("statistics open from the bottom bar and a tap on the timeline shows the details", async ({ page }) => {
  const title = "Timed for stats";
  const row = await addTask(page, title);
  await row.getByRole("button", { name: "Start" }).tap();
  await expect(row.getByTestId("task-time")).toHaveText(/00:00:0[1-9]/, { timeout: 10_000 });
  await row.getByRole("button", { name: "Pause" }).tap();

  await page.getByRole("navigation", { name: "Screens" }).getByRole("button", { name: "Statistics" }).tap();
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  // The session is a bar a few pixels wide; a tap near it is enough.
  const track = page.getByRole("figure", { name: "Timeline of the day" }).locator("div").first();
  await track.scrollIntoViewIfNeeded();
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

  await page.getByRole("button", { name: "Tasks", exact: true }).tap();
  await expect(card(page, title)).toBeVisible();
});
