import { expect, test } from "@playwright/test";

test("renders the empty state at the root", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByText("select a file to begin")).toBeVisible();
  await expect(main.getByRole("heading")).toHaveCount(0);
});

// The desktop explorer landmark (`hidden md:block`) does not exist in the accessibility tree
// below the md breakpoint, so this needs a real desktop viewport regardless of which project
// runs this file — the mobile drawer is a separate component covered by drawer.spec.ts.
test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("navigates from the explorer to a file", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "File explorer" }).getByRole("link", { name: "whoami.md" }).click();
    await expect(page).toHaveURL("/whoami");
    await expect(page.getByRole("heading", { name: "whoami" })).toBeVisible();
  });
});

test("syntax highlights JSON", async ({ page }) => {
  await page.goto("/stack");
  await expect(page.locator("pre code").getByText('"runtime"')).toBeVisible();
});

test("renders an image file", async ({ page }) => {
  await page.goto("/assets/je-mark");
  await expect(page.getByRole("img", { name: "je-mark.svg" })).toBeVisible();
});

test("renders a directory listing", async ({ page }) => {
  await page.goto("/assets");
  await expect(page.getByRole("main").getByRole("link", { name: "je-mark.svg" })).toBeVisible();
});

test("renders a two-level directory listing", async ({ page }) => {
  await page.goto("/projects/personal");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "1kout.md" })).toBeVisible();
  await expect(main.getByRole("link", { name: "shapeshift.md" })).toBeVisible();
  await expect(main.getByRole("link", { name: "portfolios.md" })).toBeVisible();
});

test("linkifies contact URLs but not plain values", async ({ page }) => {
  await page.goto("/contact");
  const main = page.getByRole("main");
  const linkedin = main.getByRole("link", { name: "https://www.linkedin.com/in/jasonedman/" });
  await expect(linkedin).toHaveAttribute("href", "https://www.linkedin.com/in/jasonedman/");
  await expect(main.getByText("Salt Lake City, Utah")).toBeVisible();
  await expect(main.getByRole("link", { name: "Salt Lake City, Utah" })).toHaveCount(0);
});

test("shows a terminal 404 for an unknown path", async ({ page }) => {
  await page.goto("/nope");
  await expect(page.getByText("No such file or directory")).toBeVisible();
});

test("every route gets its own title and description", async ({ page }) => {
  // All 19 routes render from one optional-catch-all module, so a static `metadata` export gave
  // every one of them the same <title> and description — defeating the spec's stated mitigation
  // for moving README.md off the root (that it stays separately indexable at /readme).
  const routes = ["/", "/readme", "/whoami", "/stack", "/projects"];
  const titles: string[] = [];
  const descriptions: string[] = [];
  for (const route of routes) {
    await page.goto(route);
    titles.push(await page.title());
    descriptions.push(
      (await page.locator('meta[name="description"]').getAttribute("content")) ?? "",
    );
  }

  expect(new Set(titles).size, `titles were ${JSON.stringify(titles)}`).toBe(routes.length);
  expect(new Set(descriptions).size, `descriptions were ${JSON.stringify(descriptions)}`).toBe(
    routes.length,
  );
  expect(descriptions.every((d) => d.length > 0)).toBe(true);
  // The site title is lowercase (CLAUDE.md); the status-bar chip is the one exception and is
  // unrelated to <title>.
  expect(titles[0]).toBe("jason edman");
  expect(titles[1]).toBe("README.md — jason edman");
});

test("the page itself never scrolls", async ({ page }) => {
  await page.goto("/");
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  );
  expect(overflowing).toBe(false);
});
