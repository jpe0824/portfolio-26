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
  await page.keyboard.press("Escape");
  await expect(link).toBeHidden();
  await expect(toggle(page)).toBeFocused();
});

// No wait between the click and the keypress, deliberately: clicking <summary> toggles the
// native, uncontrolled <details> element synchronously (the link becomes visible immediately,
// no JS required — the whole point of a plain <details> per this repo's no-JS requirement), but
// per the HTML spec the <details> `toggle` *event* is dispatched asynchronously, as a separately
// queued task. An earlier version of the Escape listener attached from an effect gated on
// React's `open` state, which is only set once that queued `toggle` event reaches React's
// `onToggle` handler — a real, measured gap (tens of milliseconds, worse under load or CPU
// throttling) in which a fast Escape press was silently lost. The listener now attaches once at
// mount and reads the DOM's own `open` state directly, so it no longer depends on that event
// having arrived at all — this test presses Escape as fast as physically possible specifically
// to prove that.
test("Escape closes the drawer even pressed immediately after opening, with no wait in between", async ({
  page,
}) => {
  await page.goto("/");
  await toggle(page).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "whoami.md" })).toBeHidden();
  await expect(toggle(page)).toBeFocused();
});

// Delays every JS chunk so the test can open the drawer the same way a visitor on a slow
// connection or an underpowered device can: natively, via the browser's own <details> toggle,
// before React ever hydrates. That leaves the DOM genuinely open while React's `open` state is
// still its initial `false` — a real desync, not a test artifact — because the `toggle` event
// that would have told React about it had no listener yet to receive it. The extra wait after
// goto() gives the delayed bundle time to arrive and hydrate before each test's real assertion.
async function openBeforeHydration(page: import("@playwright/test").Page) {
  // Only scripts are delayed — not the CSS the same glob would otherwise also match under
  // _next/static/chunks/. CSS is render-blocking: delaying it holds up the very first paint,
  // which holds up Playwright's own actionability check for the click below (it waits for the
  // element to actually be visible/stable), pushing the click past the point where the "delayed"
  // scripts have already arrived and hydrated — silently defeating this whole reproduction.
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (route.request().resourceType() !== "script") {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  // waitUntil: "commit" is load-bearing here, not the default: the default waits for the
  // "load" event, which itself waits for every in-flight resource — including the chunks this
  // helper just deliberately delayed — so goto() wouldn't resolve until after they'd already
  // arrived, defeating the point. "commit" resolves once the navigation's response has started,
  // well before any script has had a chance to run, so the click below is genuinely racing the
  // (still in-flight, delayed) bundle rather than following behind it.
  await page.goto("/", { waitUntil: "commit" });
  await toggle(page).click();
  await expect(page.getByRole("link", { name: "whoami.md" })).toBeVisible();
  await page.waitForTimeout(2500);
}

test("Escape still closes a drawer that was opened natively before hydration completed", async ({
  page,
}) => {
  await openBeforeHydration(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "whoami.md" })).toBeHidden();
  await expect(toggle(page)).toBeFocused();
});

test("a drawer link opened before hydration still closes the drawer instead of leaving it covering the destination", async ({
  page,
}) => {
  await openBeforeHydration(page);
  await page.getByRole("link", { name: "whoami.md" }).click();
  await expect(page).toHaveURL("/whoami");
  await expect(page.getByRole("heading", { name: "whoami" })).toBeVisible();
  // Checking a *different* file's link than the one just navigated to, not "whoami.md" again:
  // once on /whoami the tab strip grows a "Close whoami.md" link, and getByRole's name filter is
  // a substring match by default, so a "whoami.md" query would silently resolve to that always-
  // visible, unrelated link instead of the drawer's own (by-then collapsed, and so excluded from
  // the accessibility tree) copy — proving nothing. "stack.json" has no such collision, so its
  // being hidden actually is proof the drawer's own pane closed rather than sitting open on top
  // of the page it just navigated to.
  await expect(page.getByRole("link", { name: "stack.json" })).toBeHidden();
});
