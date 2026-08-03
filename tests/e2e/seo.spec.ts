import { expect, test } from "@playwright/test";
import { manifest } from "../../src/content/manifest";
import { allPaths } from "../../src/content/resolve";
import { SITE_URL } from "../../src/lib/site";

// Request-only: no viewport is pinned, so both browser projects exercise these
// against their own device defaults without turning one into a duplicate of the other.

test("robots.txt allows crawling and points at the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);

  const body = await response.text();
  expect(body).toContain("User-Agent: *");
  expect(body).toContain("Allow: /");
  expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test("robots.txt keeps the terminal's data source out of the index", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /content-index.json");
});

test("robots.txt keeps the chat endpoint out of the index", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /api/");
});

test("sitemap.xml lists every route the app prerenders, and only those", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);

  const body = await response.text();
  const listed = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  // The manifest is the single source of truth for routing, so the sitemap has to
  // agree with it exactly — a route added to the manifest but missing here is
  // invisible to crawlers, and a stale entry here is a 404 advertised to them.
  const expected = ["", ...allPaths(manifest)].map((path) =>
    path === "" ? SITE_URL : `${SITE_URL}/${path}`,
  );

  expect(listed.sort()).toEqual(expected.sort());
});

test("sitemap.xml advertises the custom domain, not the deployment host", async ({ request }) => {
  const body = await (await request.get("/sitemap.xml")).text();
  expect(body).not.toContain("vercel.app");
  expect(body).not.toContain("localhost");
});
