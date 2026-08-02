import { expect, test } from "@playwright/test";

test("no tab strip is shown when no file is open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Close / })).toHaveCount(0);
});

test("README is reachable at its own path", async ({ page }) => {
  await page.goto("/readme");
  await expect(page.getByRole("main").getByRole("heading", { name: "jason edman" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Close README.md" })).toBeVisible();
});

test("the shortcut rows open what they name", async ({ page }) => {
  await page.goto("/");
  // exact: true closes a real gap: getByRole's name filter defaults to a case-insensitive
  // substring match, so a broken accessible name like "⌃` toggle terminal" (the aria-hidden key
  // chip leaking into the accname) would still match "toggle terminal" and this test would keep
  // passing right through the regression it's meant to catch.
  await page.getByRole("button", { name: "toggle terminal", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Terminal" }).getByLabel("Terminal input"),
  ).toBeVisible();
});

test("help opens the terminal with the command list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "help", exact: true }).click();
  const term = page.getByRole("region", { name: "Terminal" });
  await expect(term.getByText(/^grep\s+search the content tree/)).toBeVisible();
});

test("no print shortcut is advertised", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("⌘P")).toHaveCount(0);
});

// Both tests below genuinely need a real desktop viewport, regardless of which project runs
// this file: the first clicks the desktop-only explorer landmark (`hidden md:block`, not in the
// accessibility tree below md), and the second explicitly asserts on desktop-only chrome (the
// key chip is `hidden md:inline`). Neither has a mobile equivalent to lose by pinning here.
test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

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

  test("the key chip is shown at desktop width, and the phone marker is not", async ({ page }) => {
    // Existence is checked before the hidden assertion below (for the marker) — a "hidden"
    // assertion alone also passes when the element is simply absent, which would let a removed
    // marker span slip by.
    await page.goto("/");
    const row = page.getByRole("button", { name: "command palette", exact: true });
    const chip = row.getByText("⌘K");
    const marker = row.getByText("›");
    await expect(chip).toBeVisible();
    await expect(marker).toHaveCount(1);
    await expect(marker).toBeHidden();
  });
});

test("the key chip and marker are decorative, not part of the row's accessible name", async ({
  page,
}) => {
  // The gap this closes: getByRole's name option is a case-insensitive substring match by
  // default, so a broken accname like "⌘K command palette" still satisfies
  // { name: "command palette" } and every test above would keep passing straight through that
  // regression. toHaveAccessibleName does a real whole-string comparison (no substring, no
  // `exact` escape hatch needed), so this is the assertion that actually enforces the
  // aria-hidden requirement rather than merely looking stricter.
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "command palette", exact: true }),
  ).toHaveAccessibleName("command palette");
  await expect(
    page.getByRole("button", { name: "toggle terminal", exact: true }),
  ).toHaveAccessibleName("toggle terminal");
  await expect(page.getByRole("button", { name: "help", exact: true })).toHaveAccessibleName(
    "help",
  );
});

test("the toggle-terminal row announces panel state, the other rows don't", async ({ page }) => {
  await page.goto("/");
  const terminalRow = page.getByRole("button", { name: "toggle terminal", exact: true });
  await expect(terminalRow).toHaveAttribute("aria-expanded", "false");
  await expect(terminalRow).toHaveAttribute("aria-controls", "terminal-body");
  await terminalRow.click();
  await expect(terminalRow).toHaveAttribute("aria-expanded", "true");

  // Neither is a disclosure control, so applying aria-expanded to them would announce a false
  // state to assistive tech.
  await expect(
    page.getByRole("button", { name: "command palette", exact: true }),
  ).not.toHaveAttribute("aria-expanded");
  await expect(page.getByRole("button", { name: "help", exact: true })).not.toHaveAttribute(
    "aria-expanded",
  );
});

test.describe("phone viewport", () => {
  // Pinned to a specific, real phone size rather than relying on the mobile project's own
  // device viewport, so this exercises one fixed, reproducible narrow width regardless of which
  // project runs this file.
  test.use({ viewport: { width: 375, height: 812 } });

  test("the key chip is hidden below md, and the marker takes its place", async ({ page }) => {
    await page.goto("/");
    const row = page.getByRole("button", { name: "command palette", exact: true });
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
    await page.getByRole("button", { name: "toggle terminal", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Terminal" }).getByLabel("Terminal input"),
    ).toBeVisible();
  });
});
