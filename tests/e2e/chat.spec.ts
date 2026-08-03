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
