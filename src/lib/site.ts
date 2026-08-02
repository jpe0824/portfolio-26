/**
 * Canonical production origin. No trailing slash — callers append their own.
 *
 * The sitemap, `robots.txt`, and `metadataBase` must all agree with the domain
 * Vercel actually serves, or crawlers treat the `*.vercel.app` alias and the
 * custom domain as two origins holding duplicate content.
 */
export const SITE_URL = "https://jsonedman.dev";
