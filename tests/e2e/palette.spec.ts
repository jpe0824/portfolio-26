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

// Computes the real, on-screen contrast ratio for a text element against whatever is actually
// behind it, rather than asserting a class name — a class name can change while staying
// compliant (or stay while regressing), so it proves nothing about what a viewer sees.
//
// getComputedStyle can hand back any CSS Color 4 syntax (this repo's tokens are oklch()), and
// a canvas is the one place the browser will resolve *any* valid color string down to concrete
// 8-bit sRGB — asking the platform beats hand-rolling an oklch→rgb conversion this test would
// have to keep in sync with globals.css by hand.
async function contrastRatio(locator: import("@playwright/test").Locator): Promise<number> {
  return locator.evaluate((node: Element) => {
    function toRgb(colorStr: string): [number, number, number, number] {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    }

    function relativeLuminance([r, g, b]: [number, number, number]): number {
      const [rl, gl, bl] = [r, g, b].map((channel) => {
        const proportion = channel / 255;
        return proportion <= 0.03928 ? proportion / 12.92 : Math.pow((proportion + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
    }

    // Walks from the element up to <html>, compositing every non-transparent background onto
    // an assumed-opaque white canvas, nearest ancestor last. Every real background in this app
    // is fully opaque by the time the walk reaches it, so this resolves on the first painted
    // ancestor in practice — the walk exists so the test measures what sits behind the element,
    // not just its own (here, transparent) background-color.
    function effectiveBackground(start: Element): [number, number, number] {
      const layers: [number, number, number, number][] = [];
      for (let el: Element | null = start; el; el = el.parentElement) {
        const [r, g, b, a] = toRgb(getComputedStyle(el).backgroundColor);
        if (a > 0) layers.unshift([r, g, b, a]);
      }
      let [cr, cg, cb] = [255, 255, 255];
      for (const [r, g, b, a] of layers) {
        cr = r * a + cr * (1 - a);
        cg = g * a + cg * (1 - a);
        cb = b * a + cb * (1 - a);
      }
      return [cr, cg, cb];
    }

    const background = effectiveBackground(node);
    const inkColor = toRgb(getComputedStyle(node).color);
    // Tailwind's opacity-70 utility sets the CSS `opacity` property, which blends the whole
    // element into whatever sits behind it at render time. Reproducing that blend is what makes
    // this a *composited* ratio rather than the ink color measured in isolation.
    const opacity = parseFloat(getComputedStyle(node).opacity) || 1;
    const renderedText: [number, number, number] = [
      opacity * inkColor[0] + (1 - opacity) * background[0],
      opacity * inkColor[1] + (1 - opacity) * background[1],
      opacity * inkColor[2] + (1 - opacity) * background[2],
    ];

    const l1 = relativeLuminance(renderedText);
    const l2 = relativeLuminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  });
}

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
    // isVisible() is awaited unconditionally, on every attempt, so the timing this retry loop
    // presents to the chord's listener is identical to a version that never checked attempts at
    // all — only what happens with the result changes. Only a *retry* (attempts > 1) may treat
    // an already-visible dialog as success — the previous press might have opened it just after
    // that attempt's own visibility assertion timed out. The first attempt must always press the
    // chord itself: without the `attempts > 1` guard, a dialog that happened to already be open
    // before this call ran would make this function report success (attempts === 1) without ever
    // exercising the shortcut — the one remaining way this helper could pass while the keyboard
    // shortcut is broken.
    const alreadyVisible = await dialog.isVisible();
    if (attempts > 1 && alreadyVisible) return;
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

test("the active row's hint text meets the 4.5:1 AA floor against its own background", async ({
  page,
}) => {
  await page.goto("/");
  await openPalette(page);

  // The first match row is active by default (command-palette.tsx initializes `active` to 0),
  // so no arrow-key press is needed to select it before measuring.
  const hint = palette(page).getByRole("option").first().locator("span").last();
  const ratio = await contrastRatio(hint);
  expect(ratio, "active-row hint text contrast against its own background").toBeGreaterThanOrEqual(4.5);
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

test("choosing a file leaves focus somewhere real rather than on the body", async ({ page }) => {
  // Opening a file is the palette's headline action, and it was the one path with no coverage.
  // Nothing about router.push moves focus, so the palette's own invoker restore is what has to
  // catch it; an unconditional skipRestore left focus on <body> — no selected element, Tab and
  // the arrow keys starting again from the top of the document.
  await page.goto("/");
  const invoker = page.getByRole("button", { name: "TERMINAL", exact: true });
  await invoker.focus();
  await expect(invoker).toBeFocused();

  await openPalette(page);
  await paletteInput(page).fill("who");
  await paletteInput(page).press("Enter");

  await expect(page).toHaveURL("/whoami");
  await expect(palette(page)).toBeHidden();
  await expect(invoker).toBeFocused();
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
});

test("choosing a command focuses the terminal input even when the panel is already open", async ({
  page,
}) => {
  // The terminal is opened FIRST, deliberately. The earlier version of this fix worked only
  // because setTerminalOpen(true) was a real state change, which re-ran the panel's focus effect;
  // with the panel already open that effect never re-runs, nothing catches focus after the palette
  // unmounts, and the restore is skipped — so focus lands on <body>. The sibling test above runs
  // the terminal-closed path, which is why that one passed all along.
  await page.goto("/");
  await page.getByRole("button", { name: "toggle terminal", exact: true }).click();
  const input = term(page).getByLabel("Terminal input");
  await expect(input).toBeVisible();

  const invoker = page.getByRole("button", { name: "TERMINAL", exact: true });
  await invoker.focus();
  await expect(invoker).toBeFocused();

  await openPalette(page);
  await paletteInput(page).fill("tree");
  await paletteInput(page).press("Enter");

  await expect(palette(page)).toBeHidden();
  await expect(input).toBeFocused();
});

test("the terminal chord is inert while the palette is open, so escape still works", async ({
  page,
}) => {
  // ⌃` opening the terminal from under the modal pulls focus out of a live role="dialog"
  // aria-modal="true". Escape is bound on the dialog wrapper, so once focus is outside it the key
  // reaches nothing and the palette can no longer be dismissed at all — measured as three Escape
  // presses with the palette still open.
  await page.goto("/");
  await openPalette(page);
  await page.keyboard.press("Control+Backquote");
  await expect(term(page).getByLabel("Terminal input")).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
});

test("? does not run help from behind the palette when focus is on a match row", async ({
  page,
}) => {
  // The `?` binding's guard only recognises INPUT/TEXTAREA/contentEditable as "typing". A palette
  // match row is a <button>, so Tab onto one and `?` fired straight through — running help in a
  // terminal opened behind the overlay, and taking focus out of the trap with it.
  await page.goto("/");
  await openPalette(page);
  await page.keyboard.press("Tab");
  await expect(palette(page).getByRole("option").first()).toBeFocused();

  await page.keyboard.press("?");
  await expect(term(page).getByLabel("Terminal input")).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
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
