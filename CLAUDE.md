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
- **Exactly one client component:** `src/components/mobile-nav-drawer.tsx`. Everything else is a
  Server Component. Adding `"use client"` anywhere else needs a deliberate decision.
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

**So: always scope.** Use `getByRole("main")` for content-pane assertions, and the specific landmark
name for nav assertions. Target the drawer toggle by `getByLabel("Toggle file explorer")`.

**Before trusting a new test, watch it fail.** Break the thing it covers, confirm red, then restore.

Playwright config specifics, all load-bearing:

- **Port 3211**, matched across `baseURL`, `webServer.url`, and the start command.
- **`reuseExistingServer: false`** — an unrelated process serves HTTP 200 on port 3000 on the owner's
  machine, and with reuse enabled Playwright would run the whole suite against it.
- **`testIgnore: /no-js\.spec\.ts/` on the `desktop` and `mobile` projects.** `testMatch` on the
  `no-js` project only says which files *that* project runs; without `testIgnore` the other two also
  collect that spec and run it under viewports it was never written for.

## Local development

- **Ports 3000 and 3001 belong to the repo owner**, who keeps a local session running. Use another
  port (3210/3211) for anything automated, and **never kill a process you did not start.**
- `next dev` refuses a second instance for the same project directory *regardless of port*. For a
  second server, use `pnpm build && pnpm exec next start -p <port>`.

## Content model

`src/content/manifest.ts` is the single source of truth for **both** the explorer tree and routing.
Adding an entry there makes it appear in the nav and generates its route via
`src/app/[[...path]]/page.tsx`. Do not add routes by hand.

Content files live in `src/content/files/`; `source` in the manifest is relative to that directory.
Markdown is rendered with `marked` and injected via `dangerouslySetInnerHTML` — acceptable only
because content is first-party and read at build time. **If content ever becomes user-supplied,
sanitize it.**

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

## ⚠️ Temporary: search indexing is disabled

`src/app/layout.tsx` sets `robots: { index: false, follow: false }`. This is deliberate — the site is
live and shareable, but content is still placeholder, and placeholder copy should not be cached against
a real person's name. **Remove it when real content lands.** Deployment Protection is intentionally
off; `noindex` is the only thing holding this back.

Correction found during the 2026-07-31 deploy: the project's actual protection setting is
`ssoProtection: all_except_custom_domains` (a `jason-personal` team default for new projects), not a
blanket "off." This means the raw `*.vercel.app` alias requires Vercel SSO login, while the custom
domain `jsonedman.dev` — the link that actually gets shared — is fully public. If the `*.vercel.app`
alias also needs to be public, disable SSO Protection explicitly: `vercel project protection disable
portfolio-26 --sso --scope jason-personal-f16e1530`. Left untouched here pending owner decision.

## Phases

1. **Terminal shell** — done
2. `/commands` palette and AI chat
3. Local LLM on Proxmox
4. Transport (Tailscale vs. Cloudflare tunnel) + SQLite
