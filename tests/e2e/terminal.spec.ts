import { expect, test } from "@playwright/test";

const term = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Terminal" });

async function openTerminal(page: import("@playwright/test").Page) {
  await page.goto("/");
  const input = term(page).getByLabel("Terminal input");
  // Ctrl+` is handled by a keydown listener wired up in a useEffect, which only attaches once
  // the client bundle hydrates. goto()'s load event fires before that under load (observed
  // flaking on the mobile project when the suite runs with several workers against a cold
  // server), so this waits for the chord to land rather than assuming the page is interactive
  // the instant it loads. Checking visibility before each retry (rather than pressing
  // unconditionally) keeps a slow first render from being toggled shut again by a second press.
  //
  // The retry itself is a hydration *gate*, not a standing waiver on the chord's reliability: a
  // second attempt gets a chance to succeed (so a genuinely slow first render doesn't fail the
  // test outright), but needing it at all is asserted afterward, hard. A chord silently dropped
  // on *every* page load — not merely slow to attach once in a while — would otherwise pass
  // this check every single time as long as the second press always worked, which is exactly
  // the regression this asserts against.
  let attempts = 0;
  await expect(async () => {
    attempts++;
    // isVisible() is awaited unconditionally, on every attempt, so the timing this retry loop
    // presents to the chord's listener is identical to a version that never checked attempts at
    // all — only what happens with the result changes. Only a *retry* (attempts > 1) may treat
    // an already-visible input as success — the previous press might have opened it just after
    // that attempt's own visibility assertion timed out. The first attempt must always press the
    // chord itself: without the `attempts > 1` guard, an input that happened to already be
    // visible before this call ran would make this function report success (attempts === 1)
    // without ever exercising the shortcut — the one remaining way this helper could pass while
    // the keyboard shortcut is broken.
    const alreadyVisible = await input.isVisible();
    if (attempts > 1 && alreadyVisible) return;
    await page.keyboard.press("Control+Backquote");
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  expect(attempts, "Ctrl+` needed more than one attempt to open the terminal").toBe(1);
}

async function run(page: import("@playwright/test").Page, command: string) {
  const input = term(page).getByLabel("Terminal input");
  await input.fill(command);
  await input.press("Enter");
}

test("the panel is collapsed until toggled", async ({ page }) => {
  await page.goto("/");
  await expect(term(page).getByLabel("Terminal input")).toBeHidden();
  await expect(term(page).getByRole("button", { name: "TERMINAL" })).toBeVisible();
});

test("ls lists the content root", async ({ page }) => {
  await openTerminal(page);
  await run(page, "ls");
  // .last() rather than a bare exact-text match: a second `ls` elsewhere in the suite (or a
  // future test) would otherwise leave two matching nodes in scrollback and trip strict mode.
  await expect(term(page).getByText("whoami.md", { exact: true }).last()).toBeVisible();
  await expect(term(page).getByText("projects/", { exact: true }).last()).toBeVisible();
});

test("cat prints file contents", async ({ page }) => {
  await openTerminal(page);
  await run(page, "cat whoami.md");
  // whoami.md's first line is "# whoami" — the site title "jason edman" is README.md's.
  await expect(term(page).getByText("# whoami", { exact: true })).toBeVisible();
});

// The <p>'s own bounding box left edge is constant for every scrollback row regardless of
// indentation — it's a block element spanning the same content width every time, so
// boundingBox().x on the element cannot tell an indented row from a flush one. What actually
// moves is where the first non-whitespace glyph paints, which requires measuring a DOM Range
// over the text node itself rather than the element's box.
async function glyphX(locator: import("@playwright/test").Locator, skipLeadingChars: number) {
  return locator.evaluate((el, skip) => {
    const textNode = el.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, skip);
    range.setEnd(textNode, skip + 1);
    return range.getBoundingClientRect().x;
  }, skipLeadingChars);
}

test("tree indentation is measurably preserved, not collapsed", async ({ page }) => {
  // Playwright's own text-matching normalizes whitespace, so a text-content assertion cannot
  // tell "  ".repeat(depth) preserved from collapsed — both would match the same normalized
  // string. Depth is the only thing `tree` communicates, so this checks the real rendered x of
  // the first visible glyph: a top-level row (depth 0, "R" of README.md, no leading spaces)
  // against projects/personal/1kout.md, which sits two levels deeper (depth 2, four literal
  // leading spaces before the "1"). If whitespace collapsed instead of being preserved, that
  // four-space run would render as roughly one space's worth of width, not four, so the two
  // glyphs would land far closer together than a real indent produces.
  await openTerminal(page);
  await run(page, "tree");
  const topLevelX = await glyphX(term(page).getByText("README.md", { exact: true }), 0);
  const nestedX = await glyphX(term(page).getByText("1kout.md", { exact: true }), 4);
  // One JetBrains Mono character at this font size is roughly 8-9px; four preserved spaces is
  // ~34px, a single collapsed one is ~8px. 20px sits well clear of both, on the preserved side.
  expect(nestedX).toBeGreaterThan(topLevelX + 20);
});

test("blank lines in cat output are not collapsed to zero height", async ({ page }) => {
  // whoami.md's second line is genuinely blank (a real blank line between the h1 and the prose).
  // An empty <p> with no text node at all does not generate a line box on its own — pre-wrap or
  // not — so this measures the blank line's own rendered height directly rather than trusting a
  // screenshot to reveal a height:0 row, which is exactly what a visual skim missed.
  await openTerminal(page);
  await run(page, "cat whoami.md");
  const firstLine = term(page).getByText("# whoami", { exact: true });
  const linesInEntry = firstLine.locator("xpath=..").locator("p");
  const nonBlank = await linesInEntry.nth(1).boundingBox(); // "# whoami" itself
  const blank = await linesInEntry.nth(2).boundingBox(); // the blank line right after it
  expect(nonBlank).not.toBeNull();
  expect(blank).not.toBeNull();
  expect(blank!.height).toBeGreaterThan(0);
  expect(blank!.height).toBeGreaterThanOrEqual(nonBlank!.height - 2);
});

// This test genuinely needs a real desktop viewport, regardless of which project runs this
// file: it navigates via the desktop-only explorer landmark (`hidden md:block`, not in the
// accessibility tree below md). A mobile visitor would navigate via the drawer instead, which
// is a different component covered by drawer.spec.ts.
test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("scrollback survives navigation", async ({ page }) => {
    await openTerminal(page);
    await run(page, "ls");
    await run(page, "open whoami.md");

    await expect(page).toHaveURL("/whoami");
    await expect(page.getByRole("main").getByRole("heading", { name: "whoami" })).toBeVisible();
    await expect(term(page).getByText("~/portfolio-26 ❯ ls")).toBeVisible();

    // The check above, on its own, proves less than it looks like: `entries` lives in
    // CommandSurface, which was already always-mounted in the frame (Task 8), so that text would
    // still be there even if TerminalPanel itself remounted on every route change — a fresh
    // instance would just re-read the same context value. An unsubmitted draft is local state
    // TerminalPanel owns itself; it can only survive a navigation if the panel instance does. That
    // is the property this task's frame placement is actually responsible for, and it's the one
    // that goes red in Step 6 when the panel is rendered from the page instead.
    const input = term(page).getByLabel("Terminal input");
    await input.fill("cat wh");
    await page
      .getByRole("navigation", { name: "File explorer" })
      .getByRole("link", { name: "README.md" })
      .click();

    await expect(page).toHaveURL("/readme");
    await expect(term(page).getByText("~/portfolio-26 ❯ ls")).toBeVisible();
    await expect(input).toHaveValue("cat wh");
  });
});

test("cd changes the prompt without navigating", async ({ page }) => {
  await openTerminal(page);
  await run(page, "cd projects");
  await expect(page).toHaveURL("/");
  await expect(term(page).getByText("~/portfolio-26/projects ❯")).toBeVisible();

  // The prompt glyph above is aria-hidden (it's decorative), so the cwd change needs its own
  // accessible signal — otherwise a screen-reader user gets no indication `cd` did anything.
  await expect(term(page).getByLabel("Terminal input (~/portfolio-26/projects)")).toBeVisible();
});

test("tab completes a file argument", async ({ page }) => {
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.fill("cat wh");
  await input.press("Tab");
  await expect(input).toHaveValue("cat whoami.md ");
  // Browsers never insert a literal tab into a text input — Tab's default action is focus
  // navigation, not a keystroke — so a value-only assertion can't tell a working preventDefault
  // apart from one that's missing entirely (focus would silently leave along with completing).
  await expect(input).toBeFocused();
});

test("tab on unmatched input never inserts a literal tab character", async ({ page }) => {
  // complete() returns zero candidates here (no command starts with "zzz"), which is the one
  // path the brief singled out as needing its own proof: preventDefault fires unconditionally
  // whenever the prompt is non-empty, not only when a match is found, so a real tab character
  // can never reach the input value.
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.fill("zzz");
  await input.press("Tab");
  await expect(input).toHaveValue("zzz");
  await expect(input).toBeFocused();
});

test("tab on an empty prompt moves focus instead of trapping it", async ({ page }) => {
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.focus();
  await input.press("Tab");
  await expect(input).not.toBeFocused();
});

test("tab on a whitespace-only prompt moves focus instead of completing", async ({ page }) => {
  // complete()'s own guard treats a whitespace-only string as empty; the panel's guard must
  // match it, or a prompt full of spaces becomes an undocumented dead end.
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.fill("   ");
  await input.press("Tab");
  await expect(input).not.toBeFocused();
});

test("shift+tab on a non-empty prompt moves focus backward instead of completing", async ({ page }) => {
  // event.key is "Tab" for Shift+Tab too. Without a shiftKey guard, both directions on a
  // non-empty prompt ran completion and called preventDefault, leaving no backward keyboard
  // egress from the terminal at all.
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.fill("cat wh");
  await input.press("Shift+Tab");
  await expect(input).not.toBeFocused();
  await expect(input).toHaveValue("cat wh");
});

test("escape blurs the input", async ({ page }) => {
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.fill("cat wh");
  await input.press("Escape");
  await expect(input).not.toBeFocused();
});

test("arrow up recalls the previous command", async ({ page }) => {
  await openTerminal(page);
  await run(page, "pwd");
  const input = term(page).getByLabel("Terminal input");
  await input.press("ArrowUp");
  await expect(input).toHaveValue("pwd");
});

test("unrecognized input points at the model stub", async ({ page }) => {
  await openTerminal(page);
  await run(page, "tell me about your homelab");
  await expect(term(page).getByText(/phase 2b will route this to the model/)).toBeVisible();
});

test.describe("phone viewport", () => {
  // Pinned to a specific, real phone size rather than relying on the mobile project's own
  // device viewport, so this exercises one fixed, reproducible narrow width regardless of which
  // project runs this file.
  test.use({ viewport: { width: 375, height: 812 } });

  test("the collapsed panel does not claim a third of a phone screen", async ({ page }) => {
    await page.goto("/");
    await expect(term(page).getByRole("button", { name: "TERMINAL" })).toBeVisible();
    await expect(term(page).getByLabel("Terminal input")).toBeHidden();
    const box = await term(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThan(812 / 3);
  });

  test("the terminal opens and is usable at a phone width", async ({ page }) => {
    await openTerminal(page);
    await run(page, "ls");
    await expect(term(page).getByText("whoami.md", { exact: true }).last()).toBeVisible();
  });
});
