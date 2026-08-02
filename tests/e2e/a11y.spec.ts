import { expect, test } from "@playwright/test";

test("the skip link is the first focusable element", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("line numbers are hidden from assistive tech", async ({ page }) => {
  await page.goto("/stack");
  const gutter = page.locator("pre span[aria-hidden='true']").first();
  await expect(gutter).toBeVisible();
});

// The desktop explorer landmark (`hidden md:block`) does not exist in the accessibility tree
// below the md breakpoint, so these two need a real desktop viewport regardless of which
// project runs this file — without this, "--project=mobile" would resolve the locator to zero
// elements rather than exercising the landmark at all.
test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the explorer is a labelled navigation landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "File explorer" })).toBeVisible();
  });

  test("the active file is marked aria-current", async ({ page }) => {
    await page.goto("/whoami");
    await expect(
      page.getByRole("navigation", { name: "File explorer" }).getByRole("link", { name: "whoami.md" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
