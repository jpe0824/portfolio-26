import { expect, test } from "@playwright/test";

// No file-level viewport override: the "desktop" project's own 1440x900 and the "mobile"
// project's own Pixel 7 viewport both apply as-is, so the mobile project genuinely exercises
// a phone-sized viewport across every test below rather than silently re-running the desktop
// size under a different project name. Only the dedicated short-viewport test near the bottom
// pins an exact size, because it exists specifically to reproduce one fixed repro case.

const palette = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Command palette", exact: true });

const paletteInput = (page: import("@playwright/test").Page) =>
  palette(page).getByLabel("Command palette input", { exact: true });

const term = (page: import("@playwright/test").Page) => page.getByRole("region", { name: "Terminal" });

// ⌘K is handled by the same keydown listener, wired up in the same useEffect, as the ⌃`
// terminal toggle in command-surface.tsx — see openTerminal() in terminal.spec.ts for the
// original case this pattern covers. goto()'s load event can fire before that effect
// attaches under load (observed here on the mobile project once workers contend for CPU), so
// this waits for the chord to land rather than assuming the page is interactive the instant
// it loads.
//
// The retry itself is a hydration *gate*, not a standing waiver on the chord's reliability: a
// second attempt is given a chance to succeed (so a genuinely slow first render doesn't fail
// the test outright), but needing it at all is asserted afterward, hard. A chord that is
// silently dropped on *every* page load — not merely slow to attach once in a while — would
// otherwise pass this check every single time as long as the second press always worked,
// which is exactly the regression this asserts against.
async function openPalette(page: import("@playwright/test").Page) {
  const dialog = palette(page);
  let attempts = 0;
  await expect(async () => {
    attempts++;
    if (await dialog.isVisible()) return;
    await page.keyboard.press("ControlOrMeta+k");
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  expect(attempts, "ControlOrMeta+K needed more than one attempt to open the palette").toBe(1);
}

test("cmd-k opens the palette and filtering a file navigates to it", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);

  await paletteInput(page).fill("who");
  await paletteInput(page).press("Enter");

  await expect(page).toHaveURL("/whoami");
  await expect(palette(page)).toBeHidden();
});

test("the palette lists commands as well as files", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  await paletteInput(page).fill("tree");
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
  await paletteInput(page).fill("zzzzz");
  await expect(palette(page).getByText("no matches")).toBeVisible();
});

test("escape returns focus to the element that had it before the palette opened", async ({ page }) => {
  await page.goto("/");
  // The always-visible TERMINAL toggle, not a File explorer link: that nav is the desktop copy
  // of the two rendered trees (CLAUDE.md's "two-trees trap"), CSS-hidden below the md
  // breakpoint, so it isn't a real, focusable element on a phone-sized viewport and this test
  // runs under both the desktop and mobile projects.
  const invoker = page.getByRole("button", { name: "TERMINAL", exact: true });
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

test("choosing a command that relocates focus is not overridden by the invoker restore", async ({
  page,
}) => {
  // Regression case: closing the palette by *choosing an item* must not restore focus to
  // whatever had it before opening, because the chosen action can (and here, does) move focus
  // somewhere new on its own. `tree` opens the terminal and focuses its input — the same
  // place a direct click on the "help" shortcut row lands, per empty-state.spec.ts. If the
  // palette's own invoker-restore effect fired unconditionally, it would run after
  // TerminalPanel's own focus effect and yank focus back to whatever opened the palette,
  // contradicting the equivalent direct path. The invoker has to be a real, focused element
  // for this to actually exercise the bug: an unfocused-by-default page (nothing explicitly
  // focused) makes the restore a no-op regardless of whether the guard exists, since there's
  // nothing for it to focus back to.
  await page.goto("/");
  const invoker = page.getByRole("button", { name: "TERMINAL", exact: true });
  await invoker.focus();
  await expect(invoker).toBeFocused();

  await openPalette(page);
  await paletteInput(page).fill("tree");
  await paletteInput(page).press("Enter");

  await expect(palette(page)).toBeHidden();
  await expect(term(page).getByLabel("Terminal input")).toBeFocused();
  await expect(invoker).not.toBeFocused();
});

test("tab cycles forward through the dialog and wraps back to the input", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  const input = paletteInput(page);
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
  const input = paletteInput(page);
  await expect(input).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(palette(page).getByRole("option").last()).toBeFocused();
});

test("narrowing the query after arrowing to the bottom keeps selection in range", async ({ page }) => {
  await page.goto("/");
  await openPalette(page);
  const input = paletteInput(page);

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

// A single test with its own pinned viewport, reproducing one specific repro case (a short
// landscape phone) regardless of which project runs it — not "phone coverage" in general;
// the file no longer overrides viewport at all, so every test above already runs at a real
// phone size under the "mobile" project.
test.describe("short landscape viewport", () => {
  test.use({ viewport: { width: 812, height: 375 } });

  test("tabbing through every match row keeps the focused row within the viewport and hit-testable", async ({
    page,
  }) => {
    await page.goto("/");
    await openPalette(page);

    // Walk every match row via Tab (mirrors the forward-wrap test's focusable count: input
    // plus 10 rows). At each stop, the currently-focused element must be a real, on-screen,
    // clickable point — not merely present in the DOM past the visible edge. A dialog/list
    // that doesn't bound its own height and scroll internally lets Tab hand focus to a row
    // rendered below the viewport, where elementFromPoint returns null: focus lands somewhere
    // the user cannot see or reach.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");

      const check = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return {
          withinViewport:
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth,
          hitTestable: hit !== null && (hit === el || el.contains(hit)),
        };
      });

      expect(check, `row ${i} should be focusable and visible`).not.toBeNull();
      expect(check!.withinViewport, `row ${i} is outside the viewport`).toBe(true);
      expect(check!.hitTestable, `row ${i} is not hit-testable at its own center`).toBe(true);
    }
  });
});
