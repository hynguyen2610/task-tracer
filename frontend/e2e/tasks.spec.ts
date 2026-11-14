import { expect, test, type Page } from "@playwright/test";

// Browser version, with its data in IndexedDB. See playwright.config.ts.

let counter = 0;
/** A title no other task in the test uses. */
const uniqueTitle = (name: string) => `${name} ${Date.now()}-${counter++}`;

const taskRow = (page: Page, title: string) =>
  page.getByTestId("task").filter({ hasText: title });

async function addTask(page: Page, title: string, priority = "Normal") {
  await page.getByPlaceholder("New task title...").fill(title);
  await page.locator("select").first().selectOption(priority);
  await page.getByRole("button", { name: "➕ Add" }).click();
  await expect(taskRow(page, title)).toBeVisible();
  // Pin the row by its id, so it still matches while the title is being
  // edited (an input's value isn't text) or after a rename.
  const id = await taskRow(page, title).getAttribute("data-rfd-draggable-id");
  return page.locator(`[data-testid="task"][data-rfd-draggable-id="${id}"]`);
}

/** All rows whose title contains `title` (case-insensitive), in list order. */
const taskRowsWithTitle = (page: Page, title: string) =>
  page.getByTestId("task").filter({ hasText: title });

/** Opens the edit form, types a total time and saves. */
async function setTimeByEdit(row: ReturnType<Page["locator"]>, value: string) {
  await row.getByRole("button", { name: "Edit task" }).click();
  const field = row.getByPlaceholder("HH:mm");
  await field.fill(value);
  await field.press("Enter");
  await expect(row.getByRole("button", { name: "Edit task" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
});

test("adds a task as Todo with no time", async ({ page }) => {
  const title = uniqueTitle("Write report");
  const row = await addTask(page, title, "High");

  await expect(row).toContainText("Total Time: 00:00:00");
  await expect(row).toContainText("Priority: High");
  await expect(row.locator("select")).toHaveValue("Todo");
  await expect(page.getByPlaceholder("New task title...")).toHaveValue("");
});

test("ignores a blank title", async ({ page }) => {
  const before = await page.getByTestId("task").count();
  await page.getByPlaceholder("New task title...").fill("   ");
  await page.getByRole("button", { name: "➕ Add" }).click();
  await expect(page.getByTestId("task")).toHaveCount(before);
});

test("starting a task counts time and makes it In progress; pausing keeps it", async ({
  page,
}) => {
  const title = uniqueTitle("Timer");
  const row = await addTask(page, title);

  await row.getByRole("button", { name: "Start" }).click();
  await expect(row.locator("select")).toHaveValue("In progress");
  await expect(row).toContainText(/Total Time: 00:00:0[2-9]/, { timeout: 10_000 });

  await row.getByRole("button", { name: "Pause" }).click();
  await expect(row.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(row.locator("select")).toHaveValue("In progress");

  // Paused: the time stops going up.
  const text = await row.innerText();
  const paused = text.match(/Total Time: (\d\d:\d\d:\d\d)/)![1];
  await page.waitForTimeout(2_000);
  await expect(row).toContainText(`Total Time: ${paused}`);
});

test("starting a task stops the one that is running", async ({ page }) => {
  const first = await addTask(page, uniqueTitle("First"));
  const second = await addTask(page, uniqueTitle("Second"));

  await first.getByRole("button", { name: "Start" }).click();
  await expect(first.getByRole("button", { name: "Pause" })).toBeVisible();
  await second.getByRole("button", { name: "Start" }).click();

  await expect(second.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(first.getByRole("button", { name: "Start" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(1);

  await second.getByRole("button", { name: "Pause" }).click();
});

for (const status of ["Pending", "Done", "Canceled"]) {
  test(`a ${status} task can't be started`, async ({ page }) => {
    const row = await addTask(page, uniqueTitle(status));
    await row.locator("select").selectOption(status);
    await expect(row.getByRole("button", { name: "Start" })).toBeDisabled();
  });
}

test("moving a running task to Done stops its timer", async ({ page }) => {
  const row = await addTask(page, uniqueTitle("Finish"));
  await row.getByRole("button", { name: "Start" }).click();
  await expect(row.getByRole("button", { name: "Pause" })).toBeVisible();

  await row.locator("select").selectOption("Done");
  await expect(row.getByRole("button", { name: "Start" })).toBeDisabled();
});

test("edits title, time, priority, status and note", async ({ page }) => {
  const row = await addTask(page, uniqueTitle("Draft"));
  const renamed = uniqueTitle("Renamed");

  // Leaving the title or time field saves and closes the form, so each of
  // those is changed last, in its own edit.
  await row.getByRole("button", { name: "Edit task" }).click();
  await row.locator("select").nth(0).selectOption("Low");
  await row.locator("select").nth(1).selectOption("Pending");
  await row.getByPlaceholder("e.g. Waiting for Kiro").fill("  Waiting for review  ");
  const titleInput = row.locator("input").first();
  await titleInput.fill(renamed);
  await titleInput.press("Enter");

  const edited = row;
  await expect(edited).toContainText(renamed);
  await expect(edited).toContainText("Priority: Low");
  await expect(edited.locator("select")).toHaveValue("Pending");
  await expect(edited).toContainText("(Waiting for review)");

  await edited.getByRole("button", { name: "Edit task" }).click();
  const time = edited.getByPlaceholder("HH:mm");
  await time.fill("01:30");
  await time.press("Enter");
  await expect(edited).toContainText("Total Time: 01:30:00");
});

test("deletes a task", async ({ page }) => {
  const title = uniqueTitle("Throwaway");
  const row = await addTask(page, title);
  await row.getByRole("button", { name: "Delete task" }).click();
  await expect(taskRow(page, title)).toHaveCount(0);
});

test("keeps tasks after a reload", async ({ page }) => {
  const title = uniqueTitle("Persisted");
  await addTask(page, title, "Highest");
  await page.reload();
  await expect(taskRow(page, title)).toContainText("Priority: Highest");
});

test("exports tasks.xlsx as a download", async ({ page }) => {
  await addTask(page, uniqueTitle("Exported"));
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to Excel" }).click();
  expect((await download).suggestedFilename()).toBe("tasks.xlsx");
});

test.describe("time format", () => {
  const formatButton = (page: Page, name: "hh:mm" | "Decimal") =>
    page.getByRole("group", { name: "Time format" }).getByRole("button", { name });

  /** Types into the time field of an open edit form and saves. */
  async function setTimeInOpenForm(row: ReturnType<Page["locator"]>, value: string) {
    const field = row.locator("input").nth(1);
    await field.fill(value);
    await field.press("Enter");
  }

  async function setTime(row: ReturnType<Page["locator"]>, value: string) {
    await row.getByRole("button", { name: "Edit task" }).click();
    await setTimeInOpenForm(row, value);
  }

  test("starts as hh:mm and switches to decimal hours, and back", async ({ page }) => {
    const row = await addTask(page, uniqueTitle("Format"));
    await setTime(row, "01:30");
    await expect(formatButton(page, "hh:mm")).toHaveAttribute("aria-pressed", "true");
    await expect(row).toContainText("Total Time: 01:30:00");

    await formatButton(page, "Decimal").click();
    await expect(formatButton(page, "Decimal")).toHaveAttribute("aria-pressed", "true");
    await expect(row).toContainText("Total Time: 1.5 h");
    await expect(page.getByText(/Total Time \(All Tasks\): [\d.]+ h/)).toBeVisible();

    await formatButton(page, "hh:mm").click();
    await expect(row).toContainText("Total Time: 01:30:00");
  });

  test("remembers the choice after a reload", async ({ page }) => {
    await formatButton(page, "Decimal").click();
    await page.reload();
    await expect(formatButton(page, "Decimal")).toHaveAttribute("aria-pressed", "true");
  });

  test("takes decimal hours in the edit form", async ({ page }) => {
    const row = await addTask(page, uniqueTitle("Decimal input"));
    await formatButton(page, "Decimal").click();

    await row.getByRole("button", { name: "Edit task" }).click();
    await expect(row.getByPlaceholder("Hours, e.g. 1.5")).toHaveValue("0");
    await setTimeInOpenForm(row, "2.25");
    await expect(row).toContainText("Total Time: 2.25 h");

    // A comma works as the decimal point too.
    await setTime(row, "1,5");
    await expect(row).toContainText("Total Time: 1.5 h");

    await formatButton(page, "hh:mm").click();
    await expect(row).toContainText("Total Time: 01:30:00");
  });

  test("saving the form without touching the time keeps its seconds", async ({ page }) => {
    const row = await addTask(page, uniqueTitle("Keep seconds"));
    await row.getByRole("button", { name: "Start" }).click();
    await expect(row).toContainText(/Total Time: 00:00:0[2-9]/, { timeout: 10_000 });

    // Opening the form pauses the task; the time it shows is final.
    await row.getByRole("button", { name: "Edit task" }).click();
    const title = row.locator("input").first();
    await title.fill(uniqueTitle("Renamed"));
    await title.press("Enter");
    // Wait for the save to finish and the form to close.
    await expect(row.getByRole("button", { name: "Edit task" })).toBeVisible();

    const text = await row.innerText();
    expect(text).toMatch(/Total Time: 00:00:0[2-9]/);
    await page.waitForTimeout(1_500);
    await expect(row).toContainText(text.match(/Total Time: \S+/)![0]);
  });
});

test.describe("start date", () => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateInput = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const shortDate = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  test("defaults to today and isn't saved unless picked", async ({ page }) => {
    const row = await addTask(page, uniqueTitle("No start"));
    await expect(row).not.toContainText("Started:");

    await row.getByRole("button", { name: "Edit task" }).click();
    await expect(row.getByLabel("Start date")).toHaveValue(dateInput(new Date()));
    await expect(row.getByLabel("Start date")).toHaveAttribute("max", dateInput(new Date()));
    await row.getByRole("button", { name: "Save task" }).click();
    // Saving is async; wait for the form to close before reading the row.
    await expect(row.getByRole("button", { name: "Edit task" })).toBeVisible();

    await expect(row.locator("select")).toHaveValue("Todo");
    await expect(row).not.toContainText("Started:");
  });

  test("starting the timer sets it to today", async ({ page }) => {
    const row = await addTask(page, uniqueTitle("Started today"));
    await row.getByRole("button", { name: "Start" }).click();
    await expect(row).toContainText(`Started: ${shortDate(new Date())}`);
    await row.getByRole("button", { name: "Pause" }).click();
  });

  test("can be picked, and is shown on the task and in the report", async ({ page }) => {
    const title = uniqueTitle("Backdated");
    const row = await addTask(page, title);
    const picked = daysAgo(3);

    await row.getByRole("button", { name: "Edit task" }).click();
    await row.getByLabel("Start date").fill(dateInput(picked));
    await row.getByLabel("Start date").press("Enter");
    await expect(row).toContainText(`Started: ${shortDate(picked)}`);

    // It stays when the task moves on, and the form shows it next time.
    await row.locator("select").selectOption("In progress");
    await expect(row).toContainText(`Started: ${shortDate(picked)}`);
    await row.getByRole("button", { name: "Edit task" }).click();
    await expect(row.getByLabel("Start date")).toHaveValue(dateInput(picked));
    await row.getByRole("button", { name: "Save task" }).click();
    // Saving is async; wait for the form to close before reading the row.
    await expect(row.getByRole("button", { name: "Edit task" })).toBeVisible();

    await page.getByRole("button", { name: "Daily report" }).click();
    await expect(page.getByRole("dialog")).toContainText(`Start date : ${shortDate(picked)}`);
  });
});

test.describe("statistics", () => {
  const openStats = async (page: Page) => {
    await page.getByRole("button", { name: "Statistics" }).click();
    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  };
  const entries = (page: Page) => page.getByTestId("timeline-entry");

  test("opens from the main screen and goes back", async ({ page }) => {
    await openStats(page);
    await page.getByRole("button", { name: "Back to tasks" }).click();
    await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
  });

  test("sets and remembers workday hours", async ({ page }) => {
    await openStats(page);
    const button = page.getByRole("button", { name: /Workday hours/ });
    await expect(button).toContainText("08:30–18:00");

    await button.click();
    const dialog = page.getByRole("dialog", { name: "Workday hours" });
    await expect(dialog.getByLabel("Lunch starts")).toHaveValue("12:00");
    await expect(dialog.getByLabel("Lunch ends")).toHaveValue("13:30");

    // Out of order times can't be saved.
    await dialog.getByLabel("Workday ends").fill("08:00");
    await expect(dialog.getByRole("alert")).toContainText("end after it starts");
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();

    await dialog.getByLabel("Workday starts").fill("07:00");
    await dialog.getByLabel("Workday ends").fill("17:00");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(button).toContainText("07:00–17:00");

    await page.reload();
    await openStats(page);
    await expect(button).toContainText("07:00–17:00");
    await button.click();
    await dialog.getByRole("button", { name: "Reset to defaults" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(button).toContainText("08:30–18:00");
  });

  test("shows today's sessions, status changes and time adjustments", async ({ page }) => {
    const title = uniqueTitle("Tracked");
    const row = await addTask(page, title);
    await row.getByRole("button", { name: "Start" }).click();
    await expect(row).toContainText(/Total Time: 00:00:0[1-9]/, { timeout: 10_000 });
    await row.getByRole("button", { name: "Pause" }).click();
    await setTimeByEdit(row, "01:30");
    await row.locator("select").selectOption("Done");
    await expect(row.getByRole("button", { name: "Start" })).toBeDisabled();

    await openStats(page);
    await expect(entries(page).filter({ hasText: `Started ${title}` })).toHaveCount(1);
    await expect(entries(page).filter({ hasText: `Paused ${title} after` })).toHaveCount(1);
    await expect(entries(page).filter({ hasText: `${title} → In progress` })).toHaveCount(1);
    await expect(entries(page).filter({ hasText: `${title} → Done` })).toHaveCount(1);
    await expect(entries(page).filter({ hasText: new RegExp(`Adjusted ${title} by \\+01:29:5\\d`) })).toHaveCount(1);
    await expect(page.getByTestId("timeline-segment").first()).toBeVisible();

    // The per-task table counts tracked time plus the adjustment.
    const taskRowInTable = page.getByRole("row").filter({ hasText: title });
    await expect(taskRowInTable).toContainText("01:30:00");
  });

  test("shows a task's work history across days from the by-task table", async ({ page }) => {
    const title = uniqueTitle("History");
    const row = await addTask(page, title);
    await row.getByRole("button", { name: "Start" }).click();
    await expect(row).toContainText(/Total Time: 00:00:0[1-9]/, { timeout: 10_000 });
    await row.getByRole("button", { name: "Pause" }).click();
    await expect(row.getByRole("button", { name: "Start" })).toBeVisible();
    await setTimeByEdit(row, "02:00");
    await row.locator("select").selectOption("Done");

    await openStats(page);
    await page.getByRole("row").filter({ hasText: title }).getByRole("button", { name: title }).click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toContainText("Days worked");
    await expect(dialog).toContainText("Finished");
    await expect(dialog).toContainText("02:00:00");
    const days = dialog.getByTestId("history-day");
    await expect(days).toHaveCount(1);
    await expect(days.first()).toContainText(/Worked 00:00:0\d/);
    await expect(days.first()).toContainText("→ In progress");
    await expect(days.first()).toContainText("→ Done");
    await expect(days.first()).toContainText(/Adjusted by \+01:59:5\d/);

    // Picking the day closes the dialog and shows that day.
    await days.first().getByRole("button").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
  });

  test("keeps the history of a deleted task", async ({ page }) => {
    const title = uniqueTitle("Deleted later");
    const row = await addTask(page, title);
    await row.getByRole("button", { name: "Start" }).click();
    await expect(row.getByRole("button", { name: "Pause" })).toBeVisible();
    await row.getByRole("button", { name: "Delete task" }).click();
    await expect(taskRow(page, title)).toHaveCount(0);

    await openStats(page);
    await expect(page.getByRole("row").filter({ hasText: title })).toContainText("(deleted)");
  });

  test("marks days with work in the calendar and shows an empty day", async ({ page }) => {
    const row = await addTask(page, uniqueTitle("Calendar"));
    await row.getByRole("button", { name: "Start" }).click();
    await row.getByRole("button", { name: "Pause" }).click();

    await openStats(page);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    await expect(page.locator(`[data-day="${todayKey}"]`)).toHaveAttribute("aria-label", /has tracked work/);
    await expect(page.locator(`[data-day="${todayKey}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();

    // Nothing was tracked last month in this fresh database.
    await page.getByRole("button", { name: "Previous month" }).click();
    await page.locator('[data-day$="-01"]').click();
    await expect(page.getByText("No work tracked on this day.")).toBeVisible();
  });
});

test.describe("existing task suggestions", () => {
  const titleInput = (page: Page) => page.getByPlaceholder("New task title...");
  const options = (page: Page) => page.getByRole("listbox", { name: "Existing tasks" }).getByRole("option");

  test("suggests similar titles while typing and reuses the picked task's start date", async ({ page }) => {
    const title = uniqueTitle("Quarterly invoice review");
    const old = await addTask(page, title);
    await old.locator("select").selectOption("Pending"); // gives it a start date
    await expect(old).toContainText("Started:");
    const started = (await old.innerText()).match(/Started: (\d\d \w+)/)![1];

    await titleInput(page).fill(title.slice(0, 15)); // "Quarterly invoi"
    await expect(options(page).filter({ hasText: title })).toContainText(`Pending · started ${started}`);
    await options(page).filter({ hasText: title }).click();

    await expect(titleInput(page)).toHaveValue(title);
    const reuse = page.getByRole("checkbox", { name: /already exists/ });
    await expect(reuse).toBeChecked();
    await page.getByRole("button", { name: "➕ Add" }).click();

    const rows = taskRowsWithTitle(page, title);
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toContainText(`Started: ${started}`);
    await expect(rows.nth(1).locator("select")).toHaveValue("Todo");
  });

  test("asks before reusing the start date of an exact match typed by hand", async ({ page }) => {
    const title = uniqueTitle("Weekly sync");
    const old = await addTask(page, title);
    await old.locator("select").selectOption("Done");

    await titleInput(page).fill(title.toUpperCase());
    const reuse = page.getByRole("checkbox", { name: /already exists/ });
    await expect(reuse).not.toBeChecked();
    await page.getByRole("button", { name: "➕ Add" }).click();
    await expect(taskRowsWithTitle(page, title.toUpperCase()).last()).not.toContainText("Started:");
  });

  test("picks a suggestion with the keyboard", async ({ page }) => {
    const title = uniqueTitle("Keyboard pick");
    await addTask(page, title);
    await titleInput(page).fill("Keyboard pi");
    await titleInput(page).press("ArrowDown");
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
    const picked = await options(page).first().locator("span").first().innerText();
    await titleInput(page).press("Enter");
    await expect(titleInput(page)).toHaveValue(picked);
    await titleInput(page).press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });
});

test.describe("layout", () => {
  const longTitle = (name: string) =>
    uniqueTitle(`${name}: review the quarterly time tracking export and reconcile it with the`);

  /** Number of text lines the title takes up. */
  const titleLines = (row: ReturnType<Page["locator"]>) =>
    row.locator("p").first().evaluate((el) => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      return Math.round(el.getBoundingClientRect().height / lineHeight);
    });

  test("uses the width of a wide screen so a long title fits on one line", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const row = await addTask(page, longTitle("Wide"));
    expect(await titleLines(row)).toBe(1);
    // Time, priority and status share one line too.
    const meta = row.locator("p").nth(1);
    const status = row.locator("label");
    expect((await meta.boundingBox())!.y).toBeCloseTo((await status.boundingBox())!.y, -1);
  });

  test("wraps a long title on a narrow screen without scrolling sideways", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    const row = await addTask(page, longTitle("Narrow"));
    expect(await titleLines(row)).toBeGreaterThan(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    // The buttons stay inside the screen (the row may be below the fold).
    const del = (await row.getByRole("button", { name: "Delete task" }).boundingBox())!;
    expect(del.x + del.width).toBeLessThanOrEqual(480);
  });
});

test("opens and closes the daily report", async ({ page }) => {
  const title = uniqueTitle("Reported");
  const row = await addTask(page, title);
  await row.locator("select").selectOption("In progress");

  await page.getByRole("button", { name: "Daily report" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(title);
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("links ticket ids in the daily report", async ({ page }) => {
  const key = `T${Date.now() % 100000}-42`;
  const prefix = key.split("-")[0] + "-";
  const row = await addTask(page, uniqueTitle(`${key} Analyze the mapping`));
  await row.locator("select").selectOption("In progress");

  await page.getByRole("button", { name: "Daily report" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/Ticket links/).fill(`${prefix} https://jira.example.com/browse/{id}`);
  const link = dialog.locator(".report-preview a", { hasText: key });
  await expect(link).toHaveAttribute("href", `https://jira.example.com/browse/${key}`);
  await expect(dialog.locator(".report-preview")).toContainText(`Task #${key}: Analyze the mapping`);

  // Clicking a link in the preview stays in the app.
  await link.click();
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/Ticket links/).fill("not a rule");
  await expect(dialog.getByRole("alert")).toContainText("not a rule");
  await dialog.getByLabel(/Ticket links/).fill("");
});

test.describe("backup", () => {
  const openBackup = async (page: Page) => {
    await page.getByRole("button", { name: /^Backup/ }).click();
    return page.getByRole("dialog", { name: "Backup" });
  };

  test("exports everything and imports it into a new browser", async ({ page, browser }) => {
    const title = uniqueTitle("Backed up");
    const row = await addTask(page, title, "High");
    await setTimeByEdit(row, "01:30");
    await page.getByRole("group", { name: "Time format" }).getByRole("button", { name: "Decimal" }).click();

    // Work worth keeping and no backup yet: the button reminds.
    await expect(page.getByRole("button", { name: "Backup (no recent backup)" })).toBeVisible();
    const dialog = await openBackup(page);
    await expect(dialog.getByTestId("last-backup")).toContainText("never");
    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export backup" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^task-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(dialog.getByRole("status")).toContainText("Saved task-tracker-backup-");
    await expect(dialog.getByTestId("last-backup")).not.toContainText("never");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("button", { name: "Backup", exact: true })).toBeVisible();

    const file = JSON.parse(await (await import("node:fs/promises")).readFile(await download.path(), "utf8"));
    expect(file.tasks.map((t: { title: string }) => t.title)).toContain(title);
    expect(file.settings.timeFormat).toBe("decimal");

    // A new browser context has its own, empty database.
    const other = await browser.newPage();
    await other.goto("/");
    await expect(taskRow(other, title)).toHaveCount(0);
    const otherDialog = await openBackup(other);
    await otherDialog.getByLabel("Backup file").setInputFiles(await download.path());
    await expect(otherDialog).toContainText(`(${file.tasks.length} task`);
    await otherDialog.getByRole("button", { name: "Replace" }).click();

    await expect(taskRow(other, title)).toContainText("Priority: High");
    await expect(taskRow(other, title)).toContainText("Total Time: 1.5 h");
    await other.close();
  });

  test("refuses a file that isn't a backup, and changes nothing", async ({ page }) => {
    const title = uniqueTitle("Kept");
    await addTask(page, title);
    const dialog = await openBackup(page);
    await dialog.getByLabel("Backup file").setInputFiles({
      name: "notes.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ hello: "world" })),
    });
    await expect(dialog.getByRole("alert")).toContainText("isn't a Task Tracker backup");
    await expect(dialog.getByRole("button", { name: "Replace" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(taskRow(page, title)).toBeVisible();
  });

  test("cancelling an import keeps the current data", async ({ page }) => {
    const title = uniqueTitle("Stays");
    await addTask(page, title);
    const dialog = await openBackup(page);
    const backup = { format: "task-tracker-backup", version: 1, exportedAt: Date.now(), tasks: [], sessions: [], events: [], settings: {} };
    await dialog.getByLabel("Backup file").setInputFiles({
      name: "empty.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(dialog).toContainText("(0 tasks, 0 work sessions, 0 changes)");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog.getByRole("button", { name: "Replace" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(taskRow(page, title)).toBeVisible();
  });
});
