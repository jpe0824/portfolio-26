import { expect, test } from "@playwright/test";

async function scrollEmptyRegionTo(page: import("@playwright/test").Page, where: "top" | "bottom") {
  await page.evaluate((edge) => {
    // <main>'s only child at the root route is the empty state's own box. Every landscape
    // assertion below is made against THIS element rather than against <main>, because main is
    // overflow:visible — a child that spills out of it neither clips nor scrolls, it simply paints
    // outside, where the opaque top bar, terminal header and status bar cover it.
    const region = document.querySelector("main > div");
    if (region) region.scrollTop = edge === "top" ? 0 : region.scrollHeight;
  }, where);
}

// toBeVisible() proves neither of the two things that matter here: it checks that the element has
// a non-empty box and is not `display:none`, and says nothing about whether that box is inside its
// container, inside the viewport, or covered by something opaque. An element painted 22px below
// its parent and underneath the terminal header passes toBeVisible() — which is how the suite
// stayed green through a defect that put the mark at y = -12.9. So: measure containment against
// the region, and hit-test the element at its own centre.
async function placement(target: import("@playwright/test").Locator) {
  return target.evaluate((el) => {
    const region = document.querySelector("main > div");
    if (!region) return null;
    const box = region.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return {
      insideRegion: rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1,
      insideViewport: rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
      // elementFromPoint returns the innermost painted node, which for a wrapper is one of its own
      // children — hence containment in both directions rather than identity.
      hitTestable: !!hit && (hit === el || el.contains(hit) || hit.contains(el)),
      // Named so a failure reports what covered it, not merely "false".
      coveredBy: hit ? `${hit.tagName}.${String(hit.className ?? "")}`.slice(0, 70) : "nothing",
      top: +rect.top.toFixed(1),
      bottom: +rect.bottom.toFixed(1),
    };
  });
}

test("no tab strip is shown when no file is open", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Close / })).toHaveCount(0);
});

test("README is reachable at its own path", async ({ page }) => {
  await page.goto("/readme");
  await expect(page.getByRole("main").getByRole("heading", { name: "jason edman" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Close README.md" })).toBeVisible();
});

test("the shortcut rows open what they name", async ({ page }) => {
  await page.goto("/");
  // exact: true closes a real gap: getByRole's name filter defaults to a case-insensitive
  // substring match, so a broken accessible name like "⌃` toggle terminal" (the aria-hidden key
  // chip leaking into the accname) would still match "toggle terminal" and this test would keep
  // passing right through the regression it's meant to catch.
  await page.getByRole("button", { name: "toggle terminal", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Terminal" }).getByLabel("Terminal input"),
  ).toBeVisible();
});

test("help opens the terminal with the command list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "help", exact: true }).click();
  const term = page.getByRole("region", { name: "Terminal" });
  await expect(term.getByText(/^grep\s+search the content tree/)).toBeVisible();
});

test("no print shortcut is advertised", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("⌘P")).toHaveCount(0);
});

// Both tests below genuinely need a real desktop viewport, regardless of which project runs
// this file: the first clicks the desktop-only explorer landmark (`hidden md:block`, not in the
// accessibility tree below md), and the second explicitly asserts on desktop-only chrome (the
// key chip is `hidden md:inline`). Neither has a mobile equivalent to lose by pinning here.
test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("opening a file shows a tab, and closing it returns to the empty state", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "File explorer" })
      .getByRole("link", { name: "whoami.md" })
      .click();
    await expect(page).toHaveURL("/whoami");

    const close = page.getByRole("link", { name: "Close whoami.md" });
    await expect(close).toBeVisible();
    await close.click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("main").getByText("select a file to begin")).toBeVisible();
  });

  test("the key chip is shown at desktop width, and the phone marker is not", async ({ page }) => {
    // Existence is checked before the hidden assertion below (for the marker) — a "hidden"
    // assertion alone also passes when the element is simply absent, which would let a removed
    // marker span slip by.
    await page.goto("/");
    const row = page.getByRole("button", { name: "command palette", exact: true });
    const chip = row.getByText("⌘K");
    const marker = row.getByText("›");
    await expect(chip).toBeVisible();
    await expect(marker).toHaveCount(1);
    await expect(marker).toBeHidden();
  });
});

test("the key chip and marker are decorative, not part of the row's accessible name", async ({
  page,
}) => {
  // The gap this closes: getByRole's name option is a case-insensitive substring match by
  // default, so a broken accname like "⌘K command palette" still satisfies
  // { name: "command palette" } and every test above would keep passing straight through that
  // regression. toHaveAccessibleName does a real whole-string comparison (no substring, no
  // `exact` escape hatch needed), so this is the assertion that actually enforces the
  // aria-hidden requirement rather than merely looking stricter.
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "command palette", exact: true }),
  ).toHaveAccessibleName("command palette");
  await expect(
    page.getByRole("button", { name: "toggle terminal", exact: true }),
  ).toHaveAccessibleName("toggle terminal");
  await expect(page.getByRole("button", { name: "help", exact: true })).toHaveAccessibleName(
    "help",
  );
});

test("the toggle-terminal row announces panel state, the other rows don't", async ({ page }) => {
  await page.goto("/");
  const terminalRow = page.getByRole("button", { name: "toggle terminal", exact: true });
  await expect(terminalRow).toHaveAttribute("aria-expanded", "false");
  await expect(terminalRow).toHaveAttribute("aria-controls", "terminal-body");
  await terminalRow.click();
  await expect(terminalRow).toHaveAttribute("aria-expanded", "true");

  // Neither is a disclosure control, so applying aria-expanded to them would announce a false
  // state to assistive tech.
  await expect(
    page.getByRole("button", { name: "command palette", exact: true }),
  ).not.toHaveAttribute("aria-expanded");
  await expect(page.getByRole("button", { name: "help", exact: true })).not.toHaveAttribute(
    "aria-expanded",
  );
});

// The suite had no landscape-phone coverage of any kind, and landscape is the shape that breaks
// first: 375px of height, less the top bar, status bar and terminal header, leaves the empty state
// under 240px for ~260px of content — before the visitor presses the shortcut this very screen
// advertises, which takes another 35dvh away.
//
// These assertions are deliberately not toBeVisible(): see placement() above. They fail against
// each of the three wrong versions of this component — plain `justify-center` with no overflow
// handling (content leaves the box at both ends), `justify-center` plus `overflow-auto` (the top
// overflow sits at a negative offset that scrollTop 0 cannot reach), and `justify-center-safe`
// with no `overflow-auto` (the bottom overflow is start-aligned but still unscrollable).
test.describe("landscape phone", () => {
  test.use({ viewport: { width: 667, height: 375 } });

  for (const terminal of ["collapsed", "open"] as const) {
    test(`the empty state stays inside its own box and scrolls, terminal ${terminal}`, async ({
      page,
    }) => {
      await page.goto("/");
      if (terminal === "open") {
        await page.getByRole("button", { name: "toggle terminal", exact: true }).click();
        await expect(
          page.getByRole("region", { name: "Terminal" }).getByLabel("Terminal input"),
        ).toBeVisible();
      }

      const main = page.getByRole("main");
      const mark = main.getByRole("img", { name: "jason edman" });
      const tagline = main.getByText("select a file to begin");

      // Top of the region: the mark is the first thing in the flow, so it is what a centred
      // overflow pushes to a negative offset, through the top bar.
      await scrollEmptyRegionTo(page, "top");
      const top = await placement(mark);
      expect(top, "the empty-state region should exist").not.toBeNull();
      expect(top!.insideRegion, `mark escaped its box: top=${top!.top} bottom=${top!.bottom}`).toBe(
        true,
      );
      expect(top!.insideViewport, `mark outside the viewport: top=${top!.top}`).toBe(true);
      expect(top!.hitTestable, `mark covered by ${top!.coveredBy}`).toBe(true);

      // Bottom of the region: the last line is what a centred overflow spills past the bottom
      // edge, under the terminal header. It must be reachable by scrolling THIS region.
      await scrollEmptyRegionTo(page, "bottom");
      const bottom = await placement(tagline);
      expect(
        bottom!.insideRegion,
        `"select a file to begin" escaped its box: top=${bottom!.top} bottom=${bottom!.bottom}`,
      ).toBe(true);
      expect(bottom!.insideViewport, `"select a file to begin" outside the viewport`).toBe(true);
      expect(bottom!.hitTestable, `"select a file to begin" covered by ${bottom!.coveredBy}`).toBe(
        true,
      );

      // The interior pane scrolls; the page still must not. Note this assertion alone cannot fail
      // here — body{overflow:hidden} plus h-[100dvh] make it structurally invariant — which is
      // precisely why it is not the assertion this test relies on.
      const pageScrolls = await page.evaluate(
        () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      );
      expect(pageScrolls).toBe(false);
    });
  }
});

test.describe("phone viewport", () => {
  // Pinned to a specific, real phone size rather than relying on the mobile project's own
  // device viewport, so this exercises one fixed, reproducible narrow width regardless of which
  // project runs this file.
  test.use({ viewport: { width: 375, height: 812 } });

  test("the key chip is hidden below md, and the marker takes its place", async ({ page }) => {
    await page.goto("/");
    const row = page.getByRole("button", { name: "command palette", exact: true });
    const chip = row.getByText("⌘K");
    const marker = row.getByText("›");
    // Existence first: a "hidden" assertion on its own can't distinguish "rendered but
    // display:none" from "never rendered at all", and only the former is the property this
    // test is meant to prove.
    await expect(chip).toHaveCount(1);
    await expect(chip).toBeHidden();
    await expect(marker).toBeVisible();
  });

  // The rows are the only way a phone visitor reaches the terminal from the empty state, so
  // proving the tap actually opens it (not just that the marker paints in place of the key chip)
  // is the point of running this file under a real phone width at all.
  test("the toggle-terminal row is tappable at phone width", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "toggle terminal", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Terminal" }).getByLabel("Terminal input"),
    ).toBeVisible();
  });
});
