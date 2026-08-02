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

test("the empty state has no dead shortcut rows without JavaScript", async ({ page }) => {
  // toBeHidden() alone would also pass if the button were never rendered at all, which isn't the
  // property this test needs: the row is meant to exist in markup (so it still counts as content,
  // and snaps into place the instant JS does load) but be display:none via .no-js .js-only while
  // there's no handler to make it do anything. A plain getByRole("button", ...) can't tell those
  // two cases apart either — Chromium's accessibility tree drops display:none nodes, so the
  // locator itself resolves to zero matches once .js-only hides the row, the same as if the row
  // had been deleted outright. `includeHidden: true` is required to make the existence check
  // actually exercise "hidden", not "absent".
  //
  // Deliberately no `exact: true` here: per the accname spec, a display:none element's computed
  // accessible name is empty, so an exact-name match against a forced-hidden node can never
  // succeed no matter what text is inside it — verified directly by temporarily adding
  // `exact: true` to this same locator and watching `toHaveAccessibleName` report `Received: ""`
  // for this exact node. The exact-name leak this task guards against only matters once the row
  // is genuinely visible, which is what the `toHaveAccessibleName` assertions in
  // empty-state.spec.ts (run under the desktop/mobile projects, where the row actually renders)
  // exist to catch. This test's job is narrower: prove the row still exists in markup and stays
  // hidden without JavaScript.
  await page.goto("/");
  const paletteRow = page.getByRole("button", { name: "command palette", includeHidden: true });
  await expect(paletteRow).toHaveCount(1);
  await expect(paletteRow).toBeHidden();
  await expect(page.getByRole("main").getByText("select a file to begin")).toBeVisible();
});
