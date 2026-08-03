import { expect, test, type Page } from "@playwright/test";

const term = (page: Page) => page.getByRole("region", { name: "Terminal" });

async function openTerminal(page: Page) {
  await page.goto("/");
  const toggle = term(page).getByRole("button", { name: "TERMINAL" });
  await toggle.click();
  await expect(term(page).getByLabel(/input/i)).toBeVisible();
}

async function run(page: Page, line: string) {
  const input = term(page).getByLabel(/input/i);
  await input.fill(line);
  await input.press("Enter");
}

test("/ai switches the prompt to chat mode", async ({ page }) => {
  await openTerminal(page);
  await run(page, "/ai");

  // exact: true — getByRole/getByLabel name matching is substring by default, so a
  // non-exact "Chat input" would also match a longer label and prove nothing.
  await expect(term(page).getByLabel("Chat input", { exact: true })).toBeVisible();
  await expect(term(page).getByText("ai ❯", { exact: true })).toBeVisible();
});

test("exit returns to the shell prompt with cwd intact", async ({ page }) => {
  await openTerminal(page);
  await run(page, "cd projects");
  await run(page, "/ai");
  await expect(term(page).getByLabel("Chat input", { exact: true })).toBeVisible();

  await run(page, "exit");

  // cwd must survive the round trip: /ai is a mode, not a navigation reset.
  await expect(term(page).getByLabel("Terminal input (~/portfolio-26/projects)")).toBeVisible();
});

test("chat mode announces how to leave", async ({ page }) => {
  await openTerminal(page);
  await run(page, "/ai");
  await expect(term(page).getByText(/exit/).last()).toBeVisible();
});

/** Serves a fixed answer from a fake /api/chat so no test ever reaches a real provider. */
async function mockChat(page: Page, body: string, status = 200) {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({ status, contentType: "text/plain; charset=utf-8", body });
  });
}

test("a streamed answer lands in scrollback", async ({ page }) => {
  await mockChat(page, "He works in Python and FastAPI.");
  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "what is his backend stack?");

  await expect(term(page).getByText("He works in Python and FastAPI.")).toBeVisible();
  await expect(term(page).getByText("ai ❯ what is his backend stack?")).toBeVisible();
});

test("a multi-line answer keeps its line breaks", async ({ page }) => {
  await mockChat(page, "first line\nsecond line");
  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "tell me two things");

  await expect(term(page).getByText("first line", { exact: true })).toBeVisible();
  await expect(term(page).getByText("second line", { exact: true })).toBeVisible();
});

test("the log region is busy while streaming and settles afterward", async ({ page }) => {
  // role="log" is an implicit polite live region; streaming tokens into it would
  // announce every fragment. aria-busy makes the answer announce once, whole.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/chat", async (route) => {
    await held;
    await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: "done" });
  });

  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "hello");

  const log = term(page).getByRole("log");
  await expect(log).toHaveAttribute("aria-busy", "true");

  release();
  await expect(term(page).getByText("done", { exact: true })).toBeVisible();
  await expect(log).toHaveAttribute("aria-busy", "false");
});

test("chat mode does not run shell commands", async ({ page }) => {
  // `ls` in chat mode is a question about ls, not a directory listing. If the
  // registry were still consulted here, the content tree would print instead.
  await mockChat(page, "ls lists a directory.");
  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "ls");

  await expect(term(page).getByText("ls lists a directory.")).toBeVisible();
  await expect(term(page).getByText("whoami.md", { exact: true })).toHaveCount(0);
});

test("clear still works inside chat mode", async ({ page }) => {
  await mockChat(page, "an answer");
  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "a question");
  await expect(term(page).getByText("an answer")).toBeVisible();

  await run(page, "clear");
  await expect(term(page).getByText("an answer")).toHaveCount(0);
  // Still in chat mode after clearing — clear wipes scrollback, not the mode.
  await expect(term(page).getByLabel("Chat input", { exact: true })).toBeVisible();
});
