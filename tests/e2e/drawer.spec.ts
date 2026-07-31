import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

// Target the drawer's own summary by its aria-label. Do NOT use
// getByRole("group").locator("summary") — the drawer's <details> contains the tree's nested
// folder <details>, which are also role=group with their own <summary>, so that locator
// matches several elements and fails Playwright strict mode.
const toggle = (page: import("@playwright/test").Page) => page.getByLabel("Toggle file explorer");

test("the desktop explorer pane is hidden on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav[aria-label='File explorer']")).toBeHidden();
  await expect(page.locator("nav[aria-label='Files']")).toBeAttached();
});

test("the drawer opens and closes on navigation", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  const link = page.getByRole("link", { name: "whoami.md" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL("/whoami");
  await expect(page.getByRole("link", { name: "stack.json" })).toBeHidden();
});

test("Escape closes the drawer and returns focus to the toggle", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  await expect(page.getByRole("link", { name: "whoami.md" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "whoami.md" })).toBeHidden();
  await expect(toggle(page)).toBeFocused();
});
