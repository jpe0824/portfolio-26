import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { manifest } from "@/content/manifest";
import { allPaths } from "@/content/resolve";
import { SITE_URL } from "@/lib/site";

const urls = () => sitemap().map((entry) => entry.url);

describe("sitemap", () => {
  it("lists the root plus every manifest path", () => {
    const expected = ["", ...allPaths(manifest)].map((path) =>
      path === "" ? SITE_URL : `${SITE_URL}/${path}`,
    );
    expect(urls().sort()).toEqual(expected.sort());
  });

  it("lists directories as well as files", () => {
    expect(urls()).toContain(`${SITE_URL}/projects`);
    expect(urls()).toContain(`${SITE_URL}/projects/personal`);
  });

  it("lists README at its own path and never at the root", () => {
    expect(urls()).toContain(`${SITE_URL}/readme`);
    expect(urls().filter((url) => url === SITE_URL)).toHaveLength(1);
  });

  it("emits no duplicates", () => {
    expect(new Set(urls()).size).toBe(urls().length);
  });

  it("emits absolute URLs on the canonical origin, without a trailing slash", () => {
    for (const url of urls()) {
      expect(url.startsWith(`${SITE_URL}/`) || url === SITE_URL).toBe(true);
      expect(url.endsWith("/")).toBe(false);
    }
  });
});
