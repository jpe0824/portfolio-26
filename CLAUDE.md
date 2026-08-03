# portfolio-26 — jason edman

Personal portfolio presented as a terminal emulator running an agentic CLI, titled **jason edman**
(lowercase). Navigation is a file explorer, not a nav bar; all content is
presented as files.

Standalone personal repo — **not** part of the UAMPS Obsidian vault. No vault frontmatter or index
entries.

See `AGENTS.md` for Next.js framework idiom. This file covers repo-specific rules only.

## Commands

    pnpm dev        # dev server
    pnpm build      # production build
    pnpm lint       # eslint
    pnpm test       # vitest unit tests
    pnpm test:e2e   # playwright acceptance tests

## Hard constraints

- **Dark mode only.** No light theme, no toggle.
- **Tailwind v4 is CSS-first.** Tokens live in `@theme` in `src/app/globals.css`.
  **Never create `tailwind.config.js`.**
- **Client components are an enumerated list, not a count.** Exactly these five:
  `mobile-nav-drawer`, `terminal/command-surface`, `terminal/terminal-panel`,
  `terminal/command-palette`, `shortcut-row`. Adding a sixth needs a deliberate decision.
  The governing rule is **no content is reachable only through the terminal** — the explorer
  stays a complete, no-JS path to every file.
- **The frame lives in the root layout, not the page.** Layouts do not re-render on navigation
  (`next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md:240`), which is what keeps
  terminal scrollback alive across a soft nav. The explorer is a parallel-route `@explorer` slot so
  it can still receive `params` and stay a Server Component. Both slots need a `default.tsx`.
- **`/` is not a content node.** The manifest has no entry for it; `[[...path]]/page.tsx` handles
  `segments.length === 0` and renders `EmptyState`. `generateStaticParams` must therefore add `""`
  back explicitly, in **both** the page and the `@explorer` slot. README lives at `/readme`.
- **`PathLine` is desktop-only** (`hidden md:flex`). Mobile chrome was ~200px of a 667px viewport
  once the tab strip and panel header landed. Nested files lose their folder prefix on a phone;
  that is accepted, not a bug.
- **`⌘P` is deliberately unbound** — it is the browser's print shortcut. The `⌘K` palette covers
  files and commands in one surface.
- **JS-only controls use `.js-only`.** `<html>` ships with `class="no-js"`, removed by an inline
  script during parse. With scripting off, the terminal and shortcut rows are absent rather than
  present and dead.
- **The mobile drawer must work without JavaScript.** It is a controlled `<details>`, not a state-
  driven div. `tests/e2e/no-js.spec.ts` enforces this.
- **`text-fg-subtle` is decorative only** — 4.06:1 on `bg-elevated`, below WCAG AA. Line numbers
  only; never real content.
- **Focus rings use `primary`/`primary-hi`, never a border token** — `border-edge-strong` is 2.3:1,
  under the 3:1 UI minimum.
- **Full-viewport TUI:** `100dvh`, `body { overflow: hidden }`. The page never scrolls.
- Never reproduce a third-party logo or wordmark. The `J{E}` mark is original.
- **The site is titled `jason edman` — always lowercase.** Not "Jason Edman". The one exception is
  the status-bar version chip, `jason-edman v0.1`. ("JSON Code" was an early working name, retired.)
- **Rendered markdown has no line-number gutter.** Line numbers are for source only — JSON, logs,
  plain text. An earlier version numbered markdown blocks, which meant a forty-item list counted as
  "1"; the numbers matched neither source lines nor visual lines. Per-visual-line numbering is not
  achievable in CSS once text wraps, so markdown gets none.

## AI chat (phase 2b)

`/ai` enters a chat mode inside the existing terminal; `exit` leaves. **It adds no client
component** — mode and message state live in `command-surface`, rendering in `terminal-panel`.
The mode switch is a `CommandResult` kind (`{ kind: "mode" }`), so dispatch stays in the pure
registry.

- **The whole corpus is inlined in the system prompt.** It is ~6 KB; there is no retrieval, no
  embedding, no vector store. `tests/unit/system-prompt.test.ts` asserts a size ceiling — if that
  test ever fails, the retrieval question genuinely reopens rather than the ceiling being raised.
- **The subject's name must never appear in model output.** `src/lib/ai/redact.ts` guarantees it;
  the prompt rule alone does not, because `whoami.md` hands the model the exact string. The
  streaming redactor buffers text it cannot yet prove is safe: on every chunk it finds the last
  occurrence of the bare first name and holds back everything from there onward until the tail
  can no longer grow into a match (whitespace, then an optional partial surname, then an optional
  possessive). That scan has no fixed length limit — an earlier version held back only a fixed
  32-character window, which let the surname leak whenever a wide run of whitespace separated the
  two names. A separate, inherently short check (at most 5 characters, the length of "jason")
  catches a bare prefix of the first name still growing at the very end of the buffer. The
  apostrophe character class is written as Unicode escapes (`'`, `’`), never literal
  glyphs — the two are visually near-identical, and a mistyped literal silently stops matching
  with no test pointing at the cause.
- **Citations are linkified against the manifest, not tool-called.** `cite.ts` matches a file's
  `source` (path *with* extension), which is also how the system prompt delimits files. If those
  two spellings ever drift apart, citations stop resolving with no error anywhere.
- **`src/lib/ai/provider.ts` is the only place a provider is named.** Gemini primary, Groq
  fallback, both free tiers with no card — which is what makes the $0 ceiling structural rather
  than enforced by our own rate limiter. Model IDs are pinned against live provider docs rather
  than chosen from memory: free-tier lineups and per-model shutdown dates shift with only weeks of
  notice, so re-pinning is meant to stay a one-line change in that file. Phase 3 prepends a homelab
  candidate here and changes nothing else.
- **Keys are optional everywhere.** No keys means an empty chain, a 503, and a degraded line.
  `pnpm build` and the full suite must stay green with zero secrets set.
- **The message-length cap applies only to the newest message.** `src/app/api/chat/route.ts`
  rejects a request when the latest turn exceeds 500 characters; earlier turns were already
  validated when first sent. Assistant replies can run past 500 characters — `GENERATION`'s
  token budget allows it — so checking every message would 400 the very next question over text
  the model wrote, not the visitor. History past the most recent 6 messages is truncated, never
  rejected — a long conversation is legitimate, it just doesn't all need to be sent.
- **Playwright never calls a real provider, except one test.** `tests/e2e/chat.spec.ts` mocks
  `**/api/chat` with `page.route` everywhere except the test asserting the live endpoint never
  hangs; that one test asserts only that something arrives, never what.
- **Only `exit` and `clear` are intercepted in chat mode.** Everything else is a question, so
  "what does ls do?" is answered rather than executed.

## Testing

`pnpm test` is Vitest over pure logic; `pnpm test:e2e` is Playwright over real browser behavior.

**The two-trees trap — read this before writing any Playwright locator.** The nav tree is rendered
**twice**, always, in both the desktop pane (`aria-label="File explorer"`, `hidden md:block`) and the
mobile drawer (`aria-label="Files"`, `md:hidden`). CSS decides which is visible; both are in the DOM.
The drawer renders **before** the desktop pane.

Consequences that have bitten this repo three separate times:

- An unscoped `getByRole("link", …).first()` resolves to the **mobile** copy, which is `display:none`
  at desktop widths — the test times out for reasons unrelated to what it was testing.
- A query that matches a file in the content pane may **also** match the sidebar, because the explorer
  auto-expands the folder containing the current path. A directory-listing test passed green against a
  completely empty `DirectoryListing` for exactly this reason.
- `getByRole("group")` matches the drawer's `<details>` *and* every nested folder `<details>` inside it.
- **The terminal is a sibling of `<main>`, not inside it.** This is deliberate: `getByRole("main")`
  is the standard content-pane scope, and scrollback inside `main` would match content assertions.
  Scope terminal assertions with `getByRole("region", { name: "Terminal" })`. Do not move the panel
  inside `main`.

**So: always scope.** Use `getByRole("main")` for content-pane assertions, and the specific landmark
name for nav assertions. Target the drawer toggle by `getByLabel("Toggle file explorer")`.

**Before trusting a new test, watch it fail.** Break the thing it covers, confirm red, then restore.

**Assertions that pass on a broken feature.** Each of these looks like a correct check and isn't;
all four are specific and non-obvious enough to slip past review.

- `getByRole(..., { name })` is a case-insensitive **substring** match, not an exact match — an
  accessible-name assertion meant to pin one control will happily match a longer name that merely
  contains it. Pass `exact: true` whenever the intent is "this exact name."
- `toBeHidden()` passes when the element is **absent from the DOM**, not only when it's present but
  hidden. If the assertion means "this control exists but isn't shown right now," assert presence
  first, then hidden.
- A `position: fixed` overlay does not participate in document flow, so it cannot change
  `document.scrollHeight` or the page's scroll position. An assertion that "the page doesn't scroll"
  while the overlay is open, written against those metrics, is measuring something the overlay was
  never able to affect.
- A retry helper (`toPass`, a hand-rolled retry loop) that swallows failures until one attempt
  succeeds hides a systematic break unless the attempt count itself is asserted — require exactly
  one attempt (or whatever the real budget is), not merely eventual success.

Playwright config specifics, all load-bearing:

- **Port 3211**, matched across `baseURL`, `webServer.url`, and the start command.
- **`reuseExistingServer: false`** — an unrelated process serves HTTP 200 on port 3000 on the owner's
  machine, and with reuse enabled Playwright would run the whole suite against it.
- **`testIgnore: /no-js\.spec\.ts/` on the `desktop` and `mobile` projects.** `testMatch` on the
  `no-js` project only says which files *that* project runs; without `testIgnore` the other two also
  collect that spec and run it under viewports it was never written for.
- **`pnpm test:e2e --project=X -- <filter>` silently swallows the filter.** pnpm forwards everything
  after `--` to the script's underlying command, but Playwright reads its own filter argument
  positionally, before `--project`; the filter after `--` is dropped rather than erroring. Run
  `npx playwright test --project=X <filter>` directly when you need both.
- **A file-scope `test.use({ viewport })` overrides the mobile project's device viewport.** The
  `mobile` project's own `devices["Pixel 7"]` viewport only applies if nothing more specific wins; a
  `test.use` at the top of a spec file beats the project config for every test in that file, silently
  turning a "mobile" run into a desktop-sized duplicate. Only pin a viewport at file scope for a test
  that is reproducing one specific fixed-size case, and scope the `test.use` to a `describe` block
  around just that test — never the whole file — so the rest of the file still exercises the
  project's real viewport. The one exception is a file whose entire subject does not exist above (or
  below) the breakpoint it tests — e.g. the mobile drawer, `md:hidden` with no desktop equivalent —
  where there is no real-viewport coverage to lose by pinning the whole file, and running it under
  the project's own viewport would either test nothing or contradict itself.

## Local development

- **Ports 3000 and 3001 belong to the repo owner**, who keeps a local session running. Use another
  port (3210/3211) for anything automated, and **never kill a process you did not start.**
- `next dev` refuses a second instance for the same project directory *regardless of port*. For a
  second server, use `pnpm build && pnpm exec next start -p <port>`.
- Some symptoms — dev-only console warnings (hydration mismatches, Fast Refresh output) chief among
  them — don't reproduce under `next start`, which skips the dev-mode checks that produce them. When
  a second `next dev` is unavoidable, create a throwaway `git worktree` (its own `node_modules`, a
  fresh `pnpm install`), run `pnpm dev -p <port>` inside it, and remove the worktree afterward.

## Content model

`src/content/manifest.ts` is the single source of truth for **both** the explorer tree and routing.
Adding an entry there makes it appear in the nav and generates its route via
`src/app/[[...path]]/page.tsx`. Do not add routes by hand.

Content files live in `src/content/files/`; `source` in the manifest is relative to that directory.
Markdown is rendered with `marked` and injected via `dangerouslySetInnerHTML` — acceptable only
because content is first-party and read at build time. **If content ever becomes user-supplied,
sanitize it.**

**JSON link rule:** `JsonFile` renders a string value as an anchor when `hrefForJsonString`
(`src/lib/json-link.ts`) recognizes it as a whole-string `http(s)` URL; a value that merely contains
a URL does not link. Quotes render outside the anchor so the tokenizer's `join("") === line` invariant holds.
Links keep the string color, never `primary`, because `primary` is the key color.
Email is deliberately not linkified and no address is published: the site is indexed, and a `mailto:`
beside a real name is what address harvesters match on. Contact runs through GitHub and LinkedIn.

**Image rule:** `ImageFile` builds its URL from the filename alone, discarding the directory. So every
image filename must be **globally unique across the content tree**, and every image needs a matching
copy in `public/`. A basename collision silently serves the wrong image; a missing `public/` copy 404s
with no build-time warning.

**Path safety:** `readContentFile` guards with `resolved.startsWith(ROOT + path.sep)`. The `+ path.sep`
is load-bearing — a bare `startsWith(ROOT)` is defeated by a sibling directory such as
`../files-evil/x`, which string-prefixes the root without being inside it.

## Palette

Primary is `oklch(65.2% 0.190 253.2)` = `#1E90FF` (CSS `dodgerblue`). All tokens are gamut-verified;
`primary-hi` is chroma `0.130` because `0.150` falls outside sRGB.

## Git

Commits go **directly to `main`** — owner-authorized 2026-07-31. No feature branch, no PR.

## Vercel — scope hazard

The CLI user (`jason-3629`) has two teams, and **`uamps` is the default active scope**. This is a
personal repo and must go to `jason-personal`. Prefer the explicit flag over `vercel switch`, so a
stale global scope cannot silently redirect a deploy:

    vercel <cmd> --scope jason-personal-f16e1530

Deploying under `uamps` would publish a personal site into an employer's team.

Project: **`portfolio-26`** (already exists under `jason-personal` — link to it, never create a second).
Domain: **`jsonedman.dev`**, registered 2026-07-31 via Name.com with nameservers already pointed at
`ns1/ns2.vercel-dns.com`. `.dev` is HSTS-preloaded, so HTTPS is mandatory; Vercel handles the
certificate.

**Live URLs** (deployed 2026-07-31):
- Production: https://jsonedman.dev
- Vercel alias: https://portfolio-26-jason-personal-f16e1530.vercel.app (production deployment; the
  raw `*.vercel.app` alias sits behind Vercel's Standard/SSO Protection team default — the custom
  domain is the actual public, shareable link)

## Search indexing

Indexing is enabled. `src/app/layout.tsx` sets no `robots` directive, so pages are indexable by
default. A `noindex` was in place while the site carried placeholder copy and came off on 2026-07-31
once real content landed.

`src/app/robots.ts` and `src/app/sitemap.ts` are Next metadata routes, prerendered like any other
static asset. Both take the origin from `src/lib/site.ts` — **that constant, `metadataBase`, and the
domain Vercel serves must agree**, or the `*.vercel.app` alias and `jsonedman.dev` look like two
origins holding duplicate content.

- **The sitemap is generated from the manifest**, using the same `["", ...allPaths(manifest)]`
  expression as `generateStaticParams`. Adding a manifest entry adds a sitemap entry. Never hand-list
  routes. `tests/e2e/seo.spec.ts` asserts the served XML matches the manifest exactly in both
  directions, so a dropped route and a stale one both fail.
- **No `lastModified`, `changeFrequency`, or `priority`.** A fresh checkout resets file mtimes, so any
  build-time date would claim the whole site changed on every deploy; crawlers discount a `lastmod`
  that always reads "now", which is worse than omitting it. Google ignores the other two outright.
- **`/content-index.json` is disallowed** in `robots.txt`. It is the terminal's data source, holding
  every content file's full text — indexing it would put a duplicate of the entire site into results
  as one unreadable blob. Blocking crawlers does not affect the browser fetch `cat` and `grep` use.

Deployment Protection is a separate axis and is unchanged. The project's setting is
`ssoProtection: all_except_custom_domains`, a `jason-personal` team default for new projects rather
than a blanket "off". The raw `*.vercel.app` alias requires Vercel SSO login; the custom domain
`jsonedman.dev`, which is the link that actually gets shared, is fully public. To make the
`*.vercel.app` alias public as well:

    vercel project protection disable portfolio-26 --sso --scope jason-personal-f16e1530

Left untouched pending owner decision.

**Indexing is controlled in code and takes effect only in a deployed build.**

## Phases

1. **Terminal shell** — done
2. **a. Empty state, editor tab, terminal, `⌘K` palette** — done
   **b. AI chat** — done
3. Local LLM on Proxmox
4. Transport (Tailscale vs. Cloudflare tunnel) + SQLite
