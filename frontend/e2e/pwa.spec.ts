import { expect, test, type Page } from "@playwright/test";

// The installable, offline web app (docs/SPEC.md 13), on the built app with a
// phone-sized screen. See playwright.config.ts, project "pwa".

const heading = (page: Page) => page.getByRole("heading", { name: "Task Tracker" });

/** Waits until the service worker is active and controls the page. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    // The first visit isn't controlled until the worker claims it or a reload.
    await page.reload();
  }
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test("links a manifest that makes the app installable", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Task Tracker");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBeTruthy();

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: "Task Tracker",
    short_name: "Tasks",
    display: "standalone",
    start_url: "/",
    scope: "/",
  });
  const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ` ${i.purpose}` : ""}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512", "512x512 maskable"]));

  const icons = [
    ...manifest.icons.map((i: { src: string }) => `/${i.src}`),
    await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"),
  ];
  for (const src of icons) {
    const res = await request.get(src!);
    expect(res.status(), src!).toBe(200);
    expect(res.headers()["content-type"], src!).toBe("image/png");
  }
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#4f46e5");
});

test("opens and keeps working offline once loaded", async ({ page, context }) => {
  await page.goto("/");
  await expect(heading(page)).toBeVisible();
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(heading(page)).toBeVisible();

  // The data is on the device, so tasks still work with no connection.
  await page.getByPlaceholder("New task title...").fill("Written offline");
  await page.getByRole("button", { name: "➕ Add" }).click();
  await expect(page.getByTestId("task").filter({ hasText: "Written offline" })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("task").filter({ hasText: "Written offline" })).toBeVisible();
  await context.setOffline(false);
});

test("asks the browser to keep the data and shows the answer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Backup/ }).click();
  const state = page.getByRole("dialog", { name: "Backup" }).getByTestId("storage-state");
  await expect(state).toContainText(/Storage: (kept by the browser|may be cleared by the browser|unknown)/);
});
