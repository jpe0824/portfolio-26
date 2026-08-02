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

test("the shortcut rows open what they name", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "toggle terminal" }).click();
  await expect(
    page.getByRole("region", { name: "Terminal" }).getByLabel("Terminal input"),
  ).toBeVisible();
});

test("help opens the terminal with the command list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "help" }).click();
  const term = page.getByRole("region", { name: "Terminal" });
  await expect(term.getByText(/^grep\s+search the content tree/)).toBeVisible();
});

test("no print shortcut is advertised", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("⌘P")).toHaveCount(0);
});

test("the key chip is shown at desktop width, and the phone marker is not", async ({ page }) => {
  // This file's 1440x900 override above applies regardless of which Playwright project runs
  // it, so this is the genuine desktop case even under --project=mobile. Existence is checked
  // before the hidden assertion below (for the marker) — a "hidden" assertion alone also
  // passes when the element is simply absent, which would let a removed marker span slip by.
  await page.goto("/");
  const row = page.getByRole("button", { name: "command palette" });
  const chip = row.getByText("⌘K");
  const marker = row.getByText("›");
  await expect(chip).toBeVisible();
  await expect(marker).toHaveCount(1);
  await expect(marker).toBeHidden();
});

test.describe("phone viewport", () => {
  // Overrides the file-level 1440x900 above with a real phone size, since that override applies
  // regardless of which project runs this file — running --project=mobile alone would not
  // otherwise exercise the md breakpoint at all.
  test.use({ viewport: { width: 375, height: 812 } });

  test("the key chip is hidden below md, and the marker takes its place", async ({ page }) => {
    await page.goto("/");
    const row = page.getByRole("button", { name: "command palette" });
    const chip = row.getByText("⌘K");
    const marker = row.getByText("›");
    // Existence first: a "hidden" assertion on its own can't distinguish "rendered but
    // display:none" from "never rendered at all", and only the former is the property this
    // test is meant to prove.
    await expect(chip).toHaveCount(1);
    await expect(chip).toBeHidden();
    await expect(marker).toBeVisible();
  });

  // The rows are the only way a phone visitor reaches the terminal from the empty state, so
  // proving the tap actually opens it (not just that the marker paints in place of the key chip)
  // is the point of running this file under a real phone width at all.
  test("the toggle-terminal row is tappable at phone width", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "toggle terminal" }).click();
    await expect(
      page.getByRole("region", { name: "Terminal" }).getByLabel("Terminal input"),
    ).toBeVisible();
  });
});
