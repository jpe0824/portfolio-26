# portfolio-26
Personal dev portfolio build, 2026 — "jason edman", a terminal-emulator portfolio.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · pnpm

## Commands
```bash
pnpm install      # install dependencies
pnpm dev          # dev server on http://localhost:3000
pnpm build        # production build
pnpm lint         # eslint
pnpm test         # vitest unit tests
pnpm test:e2e     # playwright acceptance tests
```

## Deployment
- Production: https://jsonedman.dev
- Vercel alias: https://portfolio-26-jason-personal-f16e1530.vercel.app
- Deployed via Vercel's GitHub integration — pushing to `main` triggers the production build.
- **Not indexed** — placeholder content, see `CLAUDE.md`.

## Documentation
- `CLAUDE.md` — repo conventions and constraints
- `AGENTS.md` — Next.js framework idiom (upstream, do not hand-edit)
