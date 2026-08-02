import { expect, test } from "@playwright/test";

// Both nav trees are always in the DOM — the mobile drawer renders BEFORE the desktop pane, so
// an unscoped `.first()` always resolves to the mobile copy, which is display:none at desktop
// width and never becomes visible. Every desktop query must be scoped to the "File explorer"
// landmark; every mobile query to the "Files" landmark.
const desktopNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "File explorer" });

test("explorer navigation works without JavaScript", async ({ page }) => {
  await page.goto("/");
  await desktopNav(page).getByRole("link", { name: "whoami.md" }).click();
  await expect(page).toHaveURL("/whoami");
  await expect(page.getByRole("heading", { name: "whoami" })).toBeVisible();
});

test("folder disclosure works without JavaScript", async ({ page }) => {
  await page.goto("/");
  const projects = desktopNav(page).locator("summary").filter({ hasText: "projects/" });
  const personal = desktopNav(page).locator("summary").filter({ hasText: "personal/" });
  await expect(personal).toBeHidden();
  await projects.click();
  await expect(personal).toBeVisible();
  await expect(desktopNav(page).getByRole("link", { name: "1kout.md" })).toBeHidden();
  await personal.click();
  await expect(desktopNav(page).getByRole("link", { name: "1kout.md" })).toBeVisible();
});

test("the mobile drawer opens without JavaScript", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByLabel("Toggle file explorer").click();
  await expect(
    page.getByRole("navigation", { name: "Files" }).getByRole("link", { name: "whoami.md" }),
  ).toBeVisible();
});

test("the terminal is absent without JavaScript", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Terminal" })).toBeHidden();
});
