import { expect, test, type Page } from "@playwright/test";

// Browser version against the Express backend. See playwright.config.ts.

let counter = 0;
/** A title no other test uses, since all tests share one database. */
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
