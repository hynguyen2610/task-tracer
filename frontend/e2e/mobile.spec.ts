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

test("ETA and due date show as chips, with the time to the due date as a bar", async ({ page }) => {
  const row = await addTask(page, "Estimated on a phone");
  const due = new Date();
  due.setDate(due.getDate() + 5);
  const pad = (n: number) => String(n).padStart(2, "0");
  await row.getByRole("button", { name: "Task actions" }).tap();
  await page.getByRole("menuitem", { name: "Edit task" }).tap();
  await row.getByLabel("ETA (hours to finish)").fill("12");
  await row.getByLabel("Due date").fill(`${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await row.getByRole("button", { name: "Save task" }).tap();

  await expect(row).toContainText("ETA 12 h");
  await expect(row).toContainText("Due in 5 days");
  await expect(row).toContainText("Consumed");
  await row.getByRole("button", { name: "Start" }).tap();
  const bar = row.getByRole("progressbar", { name: "Time to due date" });
  await expect(bar).toBeVisible();
  await expect(row).toContainText("5 days left");
  // The bar fits inside the card.
  const b = (await bar.boundingBox())!;
  const c = (await row.boundingBox())!;
  expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await row.getByRole("button", { name: "Pause" }).tap();
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

/** Whether the element is entirely inside the screen. */
const onScreen = (el: ReturnType<Page["locator"]>) =>
  el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    // 1px of slack for sub-pixel layout (a bar split in thirds of 320px).
    return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
  });

/** Report is in the bottom bar, Backup in the header: one tap each. */
async function open(page: Page, what: "Report" | "Backup") {
  if (what === "Report") {
    await page.getByRole("navigation", { name: "Screens" }).getByRole("button", { name: "Report" }).tap();
  } else {
    await page.getByRole("banner").getByRole("button", { name: /^Backup/ }).tap();
  }
}

test("Tasks, Report and Statistics are always in the bottom bar", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Screens" });
  for (const screen of ["Tasks", "Statistics"]) {
    await nav.getByRole("button", { name: screen, exact: true }).tap();
    await expect(nav.getByRole("button")).toHaveText(["Tasks", "Report", "Statistics"]);
    for (const b of await nav.getByRole("button").all()) expect(await onScreen(b)).toBe(true);
  }
  // From Statistics, Report opens over it, and Back returns to Statistics.
  await open(page, "Report");
  const report = page.getByRole("dialog", { name: /^Daily report/ });
  await expect(report).toBeVisible();
  await report.getByRole("button", { name: "Back", exact: true }).tap();
  await expect(report).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
});

test("the daily report is a full-screen page with Copy always in reach", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Only tasks worked on today are in the report (docs/SPEC.md 8.1).
  const row = await addTask(page, "Report on a phone");
  await row.getByRole("button", { name: "Status: Todo" }).tap();
  await page.getByRole("dialog", { name: "Status" }).getByRole("radio", { name: "In progress" }).tap();
  await open(page, "Report");
  const report = page.getByRole("dialog", { name: /^Daily report/ });
  await expect(report).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);

  // Preview first: the email, with no fields in the way.
  await expect(report.getByRole("tab", { name: "Preview" })).toHaveAttribute("aria-selected", "true");
  await expect(report.getByRole("tabpanel", { name: "Preview" })).toContainText("Report on a phone");
  await expect(report.getByRole("textbox")).toHaveCount(0);

  // Edit: the daily fields open, the set-once ones folded under Report settings.
  await report.getByRole("tab", { name: "Edit" }).tap();
  const edit = report.getByRole("tabpanel", { name: "Edit" });
  await expect(edit.getByText("Next planned tasks")).toBeVisible();
  await expect(edit.getByText("Signature")).toBeHidden();
  await edit.getByText("Report settings").tap();
  await expect(edit.getByText("Signature")).toBeVisible();

  // Scrolled to the end of the fields, Back and Copy are still on screen.
  await edit.getByLabel("Ticket links").scrollIntoViewIfNeeded();
  const back = report.getByRole("button", { name: "Back", exact: true });
  const copy = report.getByRole("button", { name: "Copy report" });
  expect(await onScreen(back)).toBe(true);
  expect(await onScreen(copy)).toBe(true);
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await copy.tap();
  await expect(report).toContainText("Copied. Paste it into your email.");

  await back.tap();
  await expect(report).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
});

test("the phone's back and Escape close a full-screen page and stay in the app", async ({ page }) => {
  await open(page, "Report");
  const report = page.getByRole("dialog", { name: /^Daily report/ });
  await expect(report).toBeVisible();
  await page.goBack();
  await expect(report).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();

  // Closing with Back leaves no extra history: the next phone back has
  // nothing of ours left to undo.
  await open(page, "Backup");
  const backup = page.getByRole("dialog", { name: "Backup" });
  await expect(backup.getByRole("button", { name: "Export backup" })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  await backup.getByRole("button", { name: "Back", exact: true }).tap();
  await expect(backup).toHaveCount(0);
  expect(await page.evaluate(() => history.state?.fullScreenPage)).toBeFalsy();

  await open(page, "Backup");
  await page.keyboard.press("Escape");
  await expect(backup).toHaveCount(0);
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
