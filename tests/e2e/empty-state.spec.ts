import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("no tab strip is shown when no file is open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Close / })).toHaveCount(0);
});

test("opening a file shows a tab, and closing it returns to the empty state", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "File explorer" })
    .getByRole("link", { name: "whoami.md" })
    .click();
  await expect(page).toHaveURL("/whoami");

  const close = page.getByRole("link", { name: "Close whoami.md" });
  await expect(close).toBeVisible();
  await close.click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("main").getByText("select a file to begin")).toBeVisible();
});

test("README is reachable at its own path", async ({ page }) => {
  await page.goto("/readme");
  await expect(page.getByRole("main").getByRole("heading", { name: "jason edman" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Close README.md" })).toBeVisible();
});
