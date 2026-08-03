import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * `/content-index.json` is disallowed because it is the terminal's data source,
 * not a page: it holds every content file's full text, so indexing it would put
 * a duplicate of the whole site into results as one unreadable JSON blob.
 * Blocking a crawler does not affect the browser fetch that `cat` and `grep` use.
 *
 * `/api/` is disallowed for the same reason: `/api/chat` is machinery, POST-only,
 * and has nothing a crawler should index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/content-index.json", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
