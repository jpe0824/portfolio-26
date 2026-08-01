import { expect, test } from "@playwright/test";

test("serves a prerendered content index keyed by manifest source", async ({ request }) => {
  const response = await request.get("/content-index.json");
  expect(response.status()).toBe(200);

  const index = await response.json();
  // whoami.md's body reads "Jason Edman" (title case) — the brief's draft assertion
  // used lowercase "jason edman", which only appears in README.md's page title.
  // See task-2-report.md for the full note.
  expect(index["whoami.md"]).toContain("Jason Edman");
  expect(index["contact.json"]).toContain("linkedin");
});

test("omits image sources from the index", async ({ request }) => {
  const index = await (await request.get("/content-index.json")).json();
  expect(index).not.toHaveProperty("assets/je-mark.svg");
});
