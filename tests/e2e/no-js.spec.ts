import { expect, test } from "@playwright/test";

test("explorer navigation works without JavaScript", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "whoami.md" }).first().click();
  await expect(page).toHaveURL("/whoami");
  await expect(page.getByRole("heading", { name: "whoami" })).toBeVisible();
});

test("folder disclosure works without JavaScript", async ({ page }) => {
  await page.goto("/");
  const summary = page.locator("summary").filter({ hasText: "projects/" }).first();
  await summary.click();
  await expect(page.getByRole("link", { name: "one.md" })).toBeVisible();
});

test("the mobile drawer opens without JavaScript", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.locator("summary").filter({ hasText: "~/portfolio-26" }).click();
  await expect(page.getByRole("link", { name: "whoami.md" })).toBeVisible();
});
