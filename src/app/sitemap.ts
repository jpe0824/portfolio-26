import type { MetadataRoute } from "next";
import { manifest } from "@/content/manifest";
import { allPaths } from "@/content/resolve";
import { SITE_URL } from "@/lib/site";

/**
 * Every prerendered route, derived from the same source as
 * `generateStaticParams` — the manifest plus `""` for the empty state, which is
 * not a content node and so is not in `allPaths`.
 *
 * No `lastModified`: a fresh checkout resets file mtimes, so any date derived at
 * build time would claim the whole site changed on every deploy. Crawlers
 * discount a `lastmod` that always says "now", which is worse than omitting it.
 * `changeFrequency` and `priority` are omitted for the same reason — Google
 * ignores both.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", ...allPaths(manifest)].map((path) => ({
    url: path === "" ? SITE_URL : `${SITE_URL}/${path}`,
  }));
}
