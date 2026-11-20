import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Themes (docs/SPEC.md 15). Runs in the "chromium" (desktop) and "phone"
// projects, so both layouts are covered.

const THEMES = ["Classic", "Midnight", "Notebook", "Terminal", "Zen"];

const isPhone = (page: Page) => page.viewportSize()!.width < 640;

async function addTask(page: Page, title: string) {
  if (isPhone(page)) await page.getByRole("button", { name: "Add task" }).click();
  await page.getByPlaceholder("New task title...").fill(title);
  await page.getByRole("button", { name: "➕ Add" }).click();
  const card = page.getByTestId("task").filter({ hasText: title });
  await expect(card).toBeVisible();
  return card;
}

async function setStatus(page: Page, card: ReturnType<Page["locator"]>, status: string) {
  if (isPhone(page)) {
    await card.getByRole("button", { name: /^Status: / }).click();
    await page.getByRole("dialog", { name: "Status" }).getByRole("radio", { name: status }).click();
  } else {
    await card.locator("select").selectOption(status);
  }
}

async function pickTheme(page: Page, name: string) {
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Theme" });
  await picker.getByRole("radio", { name: new RegExp(`^${name}`) }).click();
  await expect(picker.getByRole("radio", { name: new RegExp(`^${name}`) })).toHaveAttribute("aria-checked", "true");
  await picker.getByRole("button", { name: "Close" }).click();
  await expect(picker).toHaveCount(0);
}

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const pageColor = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
});

test("picks a theme, applies it at once and keeps it after a reload", async ({ page }) => {
  expect(await theme(page)).toBe("classic");
  await page.getByRole("button", { name: "Theme", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Theme" });
  await expect(picker.getByRole("radio")).toHaveCount(THEMES.length);
  await expect(picker.getByRole("radio", { name: /^Classic/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("dialog", { name: "Theme" }).getByRole("button", { name: "Close" }).click();

  await pickTheme(page, "Midnight");
  expect(await theme(page)).toBe("midnight");
  expect(await pageColor(page)).toBe("rgb(10, 15, 30)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0f1e");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Task Tracker" })).toBeVisible();
  expect(await theme(page)).toBe("midnight");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0a0f1e");

  await pickTheme(page, "Classic");
  expect(await pageColor(page)).toBe("rgb(241, 245, 249)");
});

for (const name of THEMES) {
  test(`${name}: text is readable on the main screens`, async ({ page }) => {
    // Measure the settled screen, not a card halfway through fading in.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await pickTheme(page, name);
    const running = await addTask(page, "ABC-12 Readable in every theme");
    await running.getByRole("button", { name: "Start" }).click();
    const pending = await addTask(page, "Waiting for review");
    await setStatus(page, pending, "Pending");

    const contrast = async (where: string) => {
      const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      const found = violations.flatMap((v) => v.nodes.map((n) => `${where}: ${n.target.join(" ")} — ${n.failureSummary}`));
      expect(found).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    };
    await contrast("tasks");

    await page.getByRole("button", { name: isPhone(page) ? "Report" : "Daily report" }).click();
    await expect(page.getByRole("dialog", { name: /^Daily report/ })).toBeVisible();
    await contrast("report");
    await page.keyboard.press("Escape");

    const stats = isPhone(page)
      ? page.getByRole("navigation", { name: "Screens" }).getByRole("button", { name: "Statistics" })
      : page.getByRole("button", { name: "Statistics" });
    await stats.click();
    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
    await contrast("statistics");
  });
}

test("marks a task just added and a task just done, once, for the theme to animate", async ({ page }) => {
  // Loading the list marks nothing.
  await expect(page.getByTestId("task")).toHaveCount(1);
  await expect(page.locator("[data-new], [data-just-done]")).toHaveCount(0);

  const card = await addTask(page, "Brand new");
  await expect(card).toHaveAttribute("data-new", "true");
  await expect(page.locator("[data-new]")).toHaveCount(1);
  await expect(card).not.toHaveAttribute("data-new", /.*/, { timeout: 3_000 });

  const first = page.getByTestId("task").filter({ hasText: "First task of the day" });
  await setStatus(page, first, "Done");
  if (isPhone(page)) {
    // On a phone it moves to the folded Finished section, whose header shows the moment.
    const finished = page.getByRole("button", { name: /^Finished/ });
    await expect(finished).toHaveAttribute("data-just-done", "true");
    await finished.click();
  }
  await expect(first).toHaveAttribute("data-just-done", "true");
  await expect(first).not.toHaveAttribute("data-just-done", /.*/, { timeout: 3_000 });
});

test("Midnight's running light stops when the phone asks for less motion", async ({ page }) => {
  await pickTheme(page, "Midnight");
  const card = await addTask(page, "Running in the dark");
  await card.getByRole("button", { name: "Start" }).click();
  await expect(card).toHaveClass(/glow/);
  const light = () => card.evaluate((el) => getComputedStyle(el, "::before").animationName);
  expect(await light()).toBe("midnight-spin");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await light()).toBe("none");
});
