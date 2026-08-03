import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const term = (page: Page) => page.getByRole("region", { name: "Terminal" });

const PROVIDER_KEYS = ["GOOGLE_GENERATIVE_AI_API_KEY", "GROQ_API_KEY"];

/**
 * `next start` (the webServer this config spawns) loads `.env.local` into its own process via
 * Next's env loader — this spec's Node process never sees that file, so checking
 * `process.env` alone would miss a key placed there for local provider testing. Reading the
 * file directly is the only way to detect one before a test fires a real generation against it.
 */
function hasProviderKeyConfigured(): boolean {
  if (PROVIDER_KEYS.some((key) => !!process.env[key])) return true;

  const envPath = path.join(__dirname, "..", "..", ".env.local");
  if (!existsSync(envPath)) return false;
  const contents = readFileSync(envPath, "utf8");
  return PROVIDER_KEYS.some((key) => new RegExp(`^${key}=\\S+`, "m").test(contents));
}

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

test("invoking a command through the palette runs the command, not a chat question", async ({ page }) => {
  // runInTerminal (the palette's command items, the empty-state shortcut row, the `?` chord)
  // always means "run this command" — even while chat mode is active. Without that, opening
  // ⌘K in chat mode and choosing `tree` would POST the literal string "tree" to /api/chat
  // instead of listing the content tree. Throwing inside the handler is the strongest form of
  // "must not be called": it fails the test outright the instant the route is hit, rather than
  // trusting a flag checked only after the fact.
  await page.route("**/api/chat", async () => {
    throw new Error("chat mode must not ask the model when a palette command runs a shell command");
  });

  await openTerminal(page);
  await run(page, "/ai");
  await expect(term(page).getByLabel("Chat input", { exact: true })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.getByRole("dialog", { name: "Command palette", exact: true });
  await expect(dialog).toBeVisible();
  const paletteInput = dialog.getByLabel("Command palette input", { exact: true });
  await paletteInput.fill("tree");
  await paletteInput.press("Enter");

  await expect(dialog).toBeHidden();
  // Real `tree` output, not a chat answer: whoami.md is a root-level file the tree command
  // prints, and chat answers never contain literal manifest filenames unless the model cites
  // them (mockChat is never wired up here, so nothing could have produced this line but tree).
  await expect(term(page).getByText("whoami.md", { exact: true })).toBeVisible();
  // Still in chat mode: the palette dispatch ran a command without leaving the mode.
  await expect(term(page).getByLabel("Chat input", { exact: true })).toBeVisible();
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

test("a 503 from an unconfigured deployment degrades gracefully", async ({ page }) => {
  await mockChat(page, "no model configured", 503);
  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "what is his stack?");

  await expect(term(page).getByText(/the model is resting/)).toBeVisible();
  // The site is not broken — the terminal still works after a failed answer.
  await run(page, "exit");
  await run(page, "ls");
  await expect(term(page).getByText("whoami.md", { exact: true }).last()).toBeVisible();
});

test("a 429 degrades with the same line", async ({ page }) => {
  await mockChat(page, "slow down", 429);
  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "hello");
  await expect(term(page).getByText(/the model is resting/)).toBeVisible();
});

test("a dropped connection degrades instead of hanging", async ({ page }) => {
  await page.route("**/api/chat", (route) => route.abort("failed"));
  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "hello");
  await expect(term(page).getByText(/unreachable/)).toBeVisible();
});

test("the live deployment answers or degrades, but never hangs", async ({ page }) => {
  // No route mock: this exercises the real /api/chat against whatever keys the environment
  // has. That is the point with none configured (CI, a fresh clone) — 503, degrading
  // gracefully — but the moment a real key is configured locally, this would fire an actual
  // provider generation on every `pnpm test:e2e` run, which no test in this suite may do.
  test.skip(hasProviderKeyConfigured(), "would call a real provider now that a key is configured");

  await openTerminal(page);
  await run(page, "/ai");
  await run(page, "what does he work on?");

  const log = term(page).getByRole("log");
  // aria-busy flips from "true" to "false" only when askModel's settle() runs, and settle()
  // is the one call reached by every branch of the ladder (streamed success, non-OK response,
  // thrown error). A hung request leaves it "true" forever, so waiting on this — rather than
  // on any particular text — is what actually proves "never hangs" instead of just "eventually
  // shows something".
  await expect(log).toHaveAttribute("aria-busy", "false", { timeout: 30_000 });

  // Scope to this exchange's own entry, and within it to the answer paragraph specifically —
  // not to the log region as a whole, and not to the entry's echoed prompt line. The prompt
  // ("ai ❯ what does he work on?") is written synchronously before the request is even sent
  // and is always non-empty, so asserting non-emptiness against the whole entry (or the whole
  // log) would pass whether or not the request ever returned. Only the answer paragraph is
  // populated by settle(), and settle() never writes an empty lines array on any branch, so a
  // non-empty answer paragraph is only reachable once the request has actually concluded.
  const entry = log.locator("> div").last();
  await expect(entry).toContainText("ai ❯ what does he work on?");
  const answerLine = entry.locator("p").last();
  await expect(answerLine).not.toBeEmpty();
});

// No describe-level test.use({ viewport }): <main> — what every assertion below reads —
// renders identically at both breakpoints; only the explorer sidebar's visibility is
// viewport-gated (terminal-frame.tsx), and none of these tests touch the sidebar. Pinning a
// desktop size here would silently drop the mobile project's coverage of all three tests for no
// real benefit, exactly the trap CLAUDE.md's testing section warns about.
test.describe("citations", () => {
  test("a cited path opens the file in the editor pane", async ({ page }) => {
    await mockChat(page, "That work is in projects/professional/migration.md today.");
    await openTerminal(page);
    await run(page, "/ai");
    await run(page, "where is the migration work?");

    // exact: true — getByRole name matching is substring by default, and the whole prompt
    // line could otherwise satisfy a substring match against a longer accessible name.
    const link = term(page).getByRole("link", { name: "projects/professional/migration.md", exact: true });
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
