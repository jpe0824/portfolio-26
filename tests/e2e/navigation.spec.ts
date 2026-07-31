import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("renders the landing file at the root", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "jason edman" })).toBeVisible();
});

test("navigates from the explorer to a file", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "File explorer" }).getByRole("link", { name: "whoami.md" }).click();
  await expect(page).toHaveURL("/whoami");
  await expect(page.getByRole("heading", { name: "whoami" })).toBeVisible();
});

test("syntax highlights JSON", async ({ page }) => {
  await page.goto("/stack");
  await expect(page.locator("pre code").getByText('"runtime"')).toBeVisible();
});

test("renders an image file", async ({ page }) => {
  await page.goto("/assets/je-mark");
  await expect(page.getByRole("img", { name: "je-mark.svg" })).toBeVisible();
});

test("renders a directory listing", async ({ page }) => {
  await page.goto("/assets");
  await expect(page.getByRole("main").getByRole("link", { name: "je-mark.svg" })).toBeVisible();
});

test("shows a terminal 404 for an unknown path", async ({ page }) => {
  await page.goto("/nope");
  await expect(page.getByText("No such file or directory")).toBeVisible();
});

test("the page itself never scrolls", async ({ page }) => {
  await page.goto("/");
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  );
  expect(overflowing).toBe(false);
});
