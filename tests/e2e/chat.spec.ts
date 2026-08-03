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

test("a concurrent follow-up does not drop the first exchange from later history", async ({ page }) => {
  // Nothing gates the input while a response streams, so a second question can be asked
  // before the first has settled. Both askModel calls close over the same pre-request
  // `messages` snapshot; a plain overwrite on settle would let whichever call finishes last
  // wipe out the other's contribution instead of merging with it. That corruption is invisible
  // in scrollback (entries are keyed by id, not by array position) — it only shows up in the
  // history payload of a later, third question, so this test asserts on captured request
  // bodies rather than on what is rendered.
  const requestBodies: { role: string; content: string }[][] = [];
  let releaseFirst: () => void = () => {};
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  await page.route("**/api/chat", async (route) => {
    const { messages } = route.request().postDataJSON() as {
      messages: { role: string; content: string }[];
    };
    requestBodies.push(messages);
    const question = messages[messages.length - 1]?.content;

    if (question === "first question") {
      // Held open so the second question below is genuinely in flight at the same time,
      // not merely typed quickly after the first already resolved.
      await firstHeld;
      await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: "first answer" });
    } else if (question === "second question") {
      await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: "second answer" });
    } else {
      await route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: "third answer" });
    }
  });

  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "first question");
  await run(page, "second question");
  // The second question's request is dispatched, and its response arrives, entirely while
  // the first is still held — proving the two really overlapped rather than running in turn.
  await expect(term(page).getByText("second answer", { exact: true })).toBeVisible();

  releaseFirst();
  await expect(term(page).getByText("first answer", { exact: true })).toBeVisible();

  // A third question probes what actually got committed to conversational memory: its
  // outgoing history is the only place the earlier overwrite bug is observable, since a
  // concurrently-dispatched request's own payload is fixed before either sibling settles.
  await run(page, "third question");
  await expect(term(page).getByText("third answer", { exact: true })).toBeVisible();

  const thirdRequestContents = requestBodies[requestBodies.length - 1].map((message) => message.content);
  expect(thirdRequestContents).toContain("first question");
  expect(thirdRequestContents).toContain("first answer");
  expect(thirdRequestContents).toContain("second question");
  expect(thirdRequestContents).toContain("second answer");
});

test.describe("citations", () => {
  // Desktop viewport: this navigates and then asserts against the content pane, and the
  // assertions below are scoped to <main> rather than the page precisely because the explorer
  // auto-expands to the current path and would match the same filename in the sidebar.
  test.use({ viewport: { width: 1440, height: 900 } });

  test("a cited path opens the file in the editor pane", async ({ page }) => {
    await mockChat(page, "That work is in projects/professional/migration.md today.");
    await openTerminal(page);
    await run(page, "/ai");
    await run(page, "where is the migration work?");

    const link = term(page).getByRole("link", { name: "projects/professional/migration.md" });
    await expect(link).toBeVisible();
    await link.click();

    await expect(page).toHaveURL("/projects/professional/migration");
    await expect(page.getByRole("main")).toContainText("migration");
  });

  test("an invented path is not a link", async ({ page }) => {
    await mockChat(page, "See projects/kubernetes.md for that.");
    await openTerminal(page);
    await run(page, "/ai");
    await run(page, "kubernetes?");

    await expect(term(page).getByText("See projects/kubernetes.md for that.")).toBeVisible();
    await expect(term(page).getByRole("link", { name: /kubernetes/ })).toHaveCount(0);
  });

  test("command output is never linkified", async ({ page }) => {
    // `cat` prints file text verbatim; turning paths inside it into links would
    // change long-standing shell behavior that other specs depend on.
    await openTerminal(page);
    await run(page, "cat README.md");
    await expect(term(page).getByRole("link")).toHaveCount(0);
  });
});
