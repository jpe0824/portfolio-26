import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

const term = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Terminal" });

async function openTerminal(page: import("@playwright/test").Page) {
  await page.goto("/");
  const input = term(page).getByLabel("Terminal input");
  // Ctrl+` is handled by a keydown listener wired up in a useEffect, which only attaches once
  // the client bundle hydrates. goto()'s load event fires before that under load (observed
  // flaking on the mobile project when the suite runs with several workers against a cold
  // server), so retry the chord rather than assume the page is interactive the instant it loads.
  // Checking visibility before each retry (rather than pressing unconditionally) keeps a slow
  // first render from being toggled shut again by a second press.
  await expect(async () => {
    if (await input.isVisible()) return;
    await page.keyboard.press("Control+Backquote");
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
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
  await expect(term(page).getByText("whoami.md", { exact: true })).toBeVisible();
  await expect(term(page).getByText("projects/", { exact: true })).toBeVisible();
});

test("cat prints file contents", async ({ page }) => {
  await openTerminal(page);
  await run(page, "cat whoami.md");
  // whoami.md's first line is "# whoami" — the site title "jason edman" is README.md's.
  await expect(term(page).getByText("# whoami", { exact: true })).toBeVisible();
});

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

test("cd changes the prompt without navigating", async ({ page }) => {
  await openTerminal(page);
  await run(page, "cd projects");
  await expect(page).toHaveURL("/");
  await expect(term(page).getByText("~/portfolio-26/projects ❯")).toBeVisible();
});

test("tab completes a file argument", async ({ page }) => {
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.fill("cat wh");
  await input.press("Tab");
  await expect(input).toHaveValue("cat whoami.md ");
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
});

test("tab on an empty prompt moves focus instead of trapping it", async ({ page }) => {
  await openTerminal(page);
  const input = term(page).getByLabel("Terminal input");
  await input.focus();
  await input.press("Tab");
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
