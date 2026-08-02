import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

const palette = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Command palette" });

// ⌘K is handled by the same keydown listener, wired up in the same useEffect, as the ⌃`
// terminal toggle in command-surface.tsx — see openTerminal() in terminal.spec.ts for the
// original case this pattern covers. goto()'s load event can fire before that effect
// attaches under load (observed here on the mobile project once workers contend for CPU),
// so a bare keyboard.press can land before there's a listener to catch it. Retry the chord
// rather than assume the page is interactive the instant it loads.
async function openPalette(page: import("@playwright/test").Page) {
  const dialog = palette(page);
  let attempts = 0;
  await expect(async () => {
    attempts++;
    if (await dialog.isVisible()) return;
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  expect(attempts, "ControlOrMeta+K needed more than one retry to open the palette").toBeLessThanOrEqual(2);
}

test("cmd-k opens the palette and filtering a file navigates to it", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  await palette(page).getByLabel("Command palette input").fill("who");
  await palette(page).getByLabel("Command palette input").press("Enter");

  await expect(page).toHaveURL("/whoami");
  await expect(palette(page)).toBeHidden();
});

test("the palette lists commands as well as files", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  await palette(page).getByLabel("Command palette input").fill("tree");
  await expect(palette(page).getByText("print the whole content tree")).toBeVisible();
});

test("escape closes the palette", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
});

test("the palette reports no matches rather than going blank", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  await palette(page).getByLabel("Command palette input").fill("zzzzz");
  await expect(palette(page).getByText("no matches")).toBeVisible();
});

test("escape returns focus to the element that had it before the palette opened", async ({ page }) => {
  await page.goto("/");
  const invoker = page
    .getByRole("navigation", { name: "File explorer" })
    .getByRole("link", { name: "README.md" });
  await invoker.focus();
  await expect(invoker).toBeFocused();

  await openPalette(page);
  // Sanity check that opening actually moved focus off the invoker, so the
  // assertion below proves a real return trip rather than focus never leaving.
  await expect(invoker).not.toBeFocused();

  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
  await expect(invoker).toBeFocused();
});

test("tab cycles forward through the dialog and wraps back to the input", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  const input = palette(page).getByLabel("Command palette input");
  await expect(input).toBeFocused();

  // Empty-query matches are the first 10 files (see manifest order), so the dialog holds
  // exactly 11 focusables: the input plus 10 match buttons. 11 Tab presses from the input
  // should walk every button and land back on the input, proving the trap wraps rather than
  // leaking focus into the page behind aria-modal="true".
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press("Tab");
  }
  await expect(input).toBeFocused();
});

test("shift+tab from the input wraps to the last item in the dialog", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  const input = palette(page).getByLabel("Command palette input");
  await expect(input).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(palette(page).getByRole("button").last()).toBeFocused();
});

test("narrowing the query after arrowing to the bottom keeps selection in range", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  const input = palette(page).getByLabel("Command palette input");

  // "a" matches many files and commands (more than one), so ArrowDown can walk well past a
  // single-item list without the guard rail this test exists to check.
  await input.fill("a");
  for (let i = 0; i < 15; i++) {
    await input.press("ArrowDown");
  }

  // Narrow to a query whose matches are a *different, shorter* set: stack.json, contact.json,
  // /stack, /contact (this is the only case among current content/commands where a single
  // extra letter changes which items match). If `active` weren't reset on every query change,
  // Enter here would either throw indexing a non-existent row or fire whatever the previous
  // (now-stale) index happens to land on in the new list -- neither of which is "the file
  // that's actually first in this narrower list."
  await input.fill("ac");
  await input.press("Enter");

  await expect(page).toHaveURL("/stack");
});

test("opening the palette introduces no page scrollbar", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  const overflow = await page.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.vertical).toBe(0);
  expect(overflow.horizontal).toBe(0);
});

test.describe("phone viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("opening the palette introduces no page scrollbar at a phone width", async ({ page }) => {
    await page.goto("/");
    await openPalette(page);

    const overflow = await page.evaluate(() => ({
      vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(overflow.vertical).toBe(0);
    expect(overflow.horizontal).toBe(0);
  });
});
