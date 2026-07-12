# Crafty Bass Frontend — Agent Guide

This is the single guide for `apps/frontend` (the former `AGENTS.md` has been folded in here — refer only to `CLAUDE.md`).

## Next.js 16 — read the live docs, not training data

This app runs **Next.js 16** (App Router), which renamed and changed APIs versus older versions. Do not answer from memory or stale training data. Read current docs through the **Next.js DevTools MCP**: read the `nextjs-docs://llms-index` resource for the index, then `nextjs_docs` for a page. (There is **no** bundled `node_modules/next/dist/docs/` folder — the MCP is the source of truth.)

Known Next 16 changes that bite:

- **`middleware.ts` is removed** — it's renamed to **`proxy.ts`** (export a `proxy` function, placed at the same level as `app/`, e.g. `src/proxy.ts`). Codemod: `npx @next/codemod@canary middleware-to-proxy .`.
- Always verify routing, data-fetching, caching, and `next.config` APIs against the live docs before using them; heed deprecation notices.

## Stack

- Next.js 16 App Router + React 19, TypeScript.
- Tailwind CSS v4 via `@tailwindcss/postcss`; tokens in `src/app/globals.css`.
- Shared shadcn-style primitives in `@repo/ui` (wrapping **base-ui**, not Radix); theming via `next-themes` + the `@repo/ui` provider/toggle.
- Icons: prefer `lucide-react` / `@tabler/icons-react`.
- Path alias `@/*` → `src/*`. Keep route files thin; reusable UI in `src/components/<feature>/`, e.g. `auth/`, `chat/`, `dashboard/`, `escrow/`, `jobs/`, `quotes/`, `reviews/`, `trades/`, `verification/`.

## i18n routing

All app routes live under `src/app/[locale]/` (e.g. `[locale]/dashboard`, `[locale]/jobs`, `[locale]/quotes`, `[locale]/sign-in`) — this repo has one-click content translation (see the translation feature commit history) and every route must stay under the `[locale]` segment. Don't add a page directly under `src/app/` outside `[locale]`.

## Backend auth: same-origin proxy, not direct calls

`apps/frontend` reaches the backend through a **same-origin proxy** rather than calling it cross-origin:

- `next.config.ts` rewrites `/api/*` to `API_PROXY_TARGET` (default `http://localhost:3005`) — the browser only ever talks to the frontend's own origin.
- `src/proxy.ts` is this app's Next 16 `proxy.ts` (the renamed `middleware.ts`).
- Server-side session checks forward cookies to the backend (`server-session.ts` + a `requireAuth()` used at the top of private pages/layouts) rather than gating with a client-only `useSession()` hook.

`apps/admin` now uses this same pattern (same-origin `/api/*` rewrite + a server-side `requireAdmin()` guard); the main difference is that admin also checks the `ADMIN`/`SUPPORT` role and has no `[locale]` segment. See the root `CLAUDE.md` Admin section for the specifics.

## Tokens

- Global CSS custom properties + Tailwind v4 `@theme inline` mapping live in `src/app/globals.css`. Add new tokens there first, expose via `@theme inline`, use semantic names (e.g. `surface`, `text-primary`) over raw color names, and keep light/dark variants together.

## Assets

- Static assets in `apps/frontend/public`, referenced with root-relative paths and rendered via `next/image`.
