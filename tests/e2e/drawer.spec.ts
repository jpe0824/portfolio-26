import { expect, test } from "@playwright/test";

// Pinned at file scope, unlike the rest of the suite's viewport pins: the mobile drawer this
// file tests is `md:hidden` and has no desktop equivalent to lose coverage of. Leaving this
// file unpinned would make the "desktop" project run every test below at a width where the
// drawer never renders at all — not "duplicate coverage" but no coverage, and the first test
// below would be self-contradictory (asserting the drawer's own pane is hidden while sitting
// above the very breakpoint that shows it). Pinning narrow, for every project, is what makes
// this file's subject exist in the first place.
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
  const link = page.getByRole("link", { name: "whoami.md" });
  await expect(link).toBeVisible();

  // Clicking <summary> toggles the native, uncontrolled <details> element immediately — the
  // link above becomes visible right away regardless of hydration, which is exactly the point
  // of a plain <details> (it must work with no JS at all, per this repo's no-JS requirement).
  // But Escape is handled by a document-level keydown listener that mobile-nav-drawer.tsx only
  // attaches from a useEffect gated on React's own `open` state, which is set by the details'
  // own onToggle handler — i.e. only *after* React has processed the click, re-rendered, and
  // flushed its passive effects.
  //
  // Unlike the ⌘K/⌃` chord helpers elsewhere in this suite, this is not merely a load-dependent
  // hydration gap that a single retry safely absorbs: passive effects are *never* flushed
  // synchronously within the click that triggers them — React defers them past the next paint
  // by design — while the native toggle above is synchronous with that same click. So "the link
  // is visible" is guaranteed to be true strictly before the listener can possibly be attached;
  // there is no load level at which a single Escape press is guaranteed to land after it, only
  // a race whose odds worsen under contention (confirmed directly: instrumented runs showed a
  // real, measurable gap between the native toggle and the listener attaching, and a captured
  // failure needed exactly one extra attempt to close). A hard `attempts === 1` bar — right for
  // the chord helpers, where hydration has a real-world head start — would therefore make this
  // test spuriously red on a harmless race no human could ever trigger (no one presses Escape
  // in the same JavaScript tick their click lands). The bound below still catches a genuinely
  // broken handler: if Escape stopped working entirely, every attempt would keep failing and
  // the outer toPass would time out and throw, same as it would with a hard equality check.
  let attempts = 0;
  await expect(async () => {
    attempts++;
    await page.keyboard.press("Escape");
    await expect(link).toBeHidden({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  expect(
    attempts,
    "Escape needed a suspicious number of attempts to close the drawer — investigate rather than raise this further",
  ).toBeLessThanOrEqual(2);
  await expect(toggle(page)).toBeFocused();
});
