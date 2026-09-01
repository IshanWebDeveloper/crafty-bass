# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Domain

The Prisma schema (`packages/db/prisma/schema.prisma`, owned by the `@repo/db` package - **not** `apps/backend/prisma`, which no longer exists) and `apps/backend/src/` describe a **tradesman/homeowner marketplace**. Core models: `User`, `HomeownerProfile`, `TradesmanProfile`, `ServiceCategory`, `Skill`, `Job`, `Quote`, `Review`, `Conversation`, `Message`, `JobRecommendation`, `Report`; enums for `Role`, `UserType`, `JobStatus`, etc. Backend modules live under `apps/backend/src/{users,profiles,jobs,quotes,escrow,categories,reviews,recommendations,verification,conversations,reports,consent,legal,admin,webhooks,health}`. RBAC statements/roles live in `packages/auth/src/access.ts` (statements: `profile`, `job`, `quote`, `escrow`, `conversation`, `message`, `review`, `report`, `recommendation`, `category`, `user`; roles: `customer`, `support`, `admin`). `CUSTOMER` covers **both** homeowners and tradesmen - the homeowner/tradesman distinction is carried by `User.userType` and enforced at the service layer (ownership + userType checks), not by a dedicated role. The legacy e-commerce sweep is complete and the schema/statements are fully marketplace. Note: there is no separate `messages/` module - message endpoints live under `conversations/`.

## Repository

Nx + pnpm monorepo with four apps:

- `apps/frontend` - Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui - the homeowner/tradesman-facing marketplace, port `3000`
- `apps/admin` - Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui + TanStack Query/Table + Recharts - the internal admin/support console, port `3001`
- `apps/backend` - NestJS 11 + Prisma (PostgreSQL) + better-auth + BullMQ + Stripe
- `apps/ai-service` - Python FastAPI + LangChain/LangGraph (LLM provider is `anthropic` or `openai`)

…and seven workspace packages under `packages/`, all scoped `@repo/*`:

- `@repo/db` - owns the Prisma schema (`packages/db/prisma/schema.prisma`), migrations/seeds, and the generated Prisma client; consumed by the backend
- `@repo/auth` - better-auth access-control definitions (`access.ts`: statements + `customer`/`support`/`admin` roles) plus shared auth helpers; consumed by the backend
- `@repo/shared-types` - Prisma-generated browser-safe types (`packages/shared-types/src/generated/prisma/`), consumed by both frontend and backend
- `@repo/ui` - shared UI primitives (base-ui under the hood) plus `cn`, `ThemeProvider`, `mode-toggle` (consumed by the frontend)
- `@repo/validation` - shared Zod schemas
- `@repo/eslint-config`, `@repo/prettier-config` - shared lint/format config

`pnpm-workspace.yaml` includes `apps/*` and `packages/*`. (The monorepo-restructure work moved `shared-types` into `packages/` and later extracted `@repo/db` and `@repo/auth` out of the backend - older notes that say "`packages/` doesn't exist yet" or that the schema lives under `apps/backend/prisma` are stale.)

## Common commands

All run from repo root unless noted.

```bash
pnpm install                # install JS deps; ai-service .venv is separate (see below)
pnpm dev                    # frontend + admin + backend + ai-service in parallel via Nx
pnpm dev:admin               # only admin via Nx
pnpm build / lint / test    # nx run-many across all projects (ai-service .venv must exist)
pnpm format                 # prettier
pnpm dev:ai                 # only ai-service via Nx (uses .venv)
pnpm dev:ai:uvicorn         # ai-service via uvicorn directly (no .venv required)
pnpm affected:build / affected:lint / affected:test   # CI-style affected-only
```

Per-app: `pnpm nx run <frontend|admin|backend|ai-service>:<dev|build|lint|test>`.

Ports: frontend `3000`, admin `3001`, backend `3005` (override with `PORT`), ai-service `8006`. CORS defaults to `http://localhost:3000,http://admin.localhost:3001,http://localhost:3001,http://localhost:5173` (override with `CORS_ORIGINS`, see `apps/backend/.env.example`). Note admin is opened at `http://admin.localhost:3001` (see Admin section for why).

### Local database (Docker)

Postgres runs locally via `docker-compose.yml` (Postgres 17, matching the Neon instance it replaced). Redis is **not** in compose - run your own container on `6379`.

```bash
docker compose up -d        # start postgres on 5432
docker compose down         # stop; data survives in the named volume
docker compose down -v      # stop and wipe (forces a re-seed next time)
```

Two databases are created on first boot: `craftybass_dev` (used by `apps/backend/.env`) and `craftybass_test` (used by `apps/backend/.env.test`), the second via `scripts/postgres/init-test-db.sh`. That init script only runs on an **empty** data directory, so `down -v` is what you need to recreate them. After a fresh `up -d`, apply the schema and seed:

```bash
pnpm --filter @repo/db exec dotenv -e ../../apps/backend/.env -- prisma migrate deploy
pnpm --filter @repo/db db:seed && pnpm --filter @repo/db db:seed:users
```

The previous Neon URLs are preserved as comments in both env files - swap the two `DATABASE_URL` lines to switch back.

### Prisma

The schema and migration/seed scripts live in **`@repo/db`** (`packages/db/package.json`): e.g. `pnpm --filter @repo/db db:migrate:dev`, `db:migrate:reset`, `db:seed`, `db:seed:users` - all load `apps/backend/.env` (or `.env.test`) via dotenv. The two scripts that matter at the workspace level (root `package.json`):

```bash
pnpm prisma:generate:all       # @repo/db db:generate (client) + refresh shared-types browser output & hash stamp
pnpm prisma:check:generated    # CI guard: verifies packages/shared-types/.../prisma/.schema-hash.json matches the schema SHA
```

If you change `packages/db/prisma/schema.prisma`, you must run `prisma:generate:all` and commit the updated hash stamp under `packages/shared-types/src/generated/prisma/`, or the `prisma-generated-check` CI job will fail.

### Backend tests

Backend has **both Jest and Vitest configured** - they don't overlap, but the distinction matters:

- **Jest unit** - `pnpm --filter backend test`. Config inlined in `package.json`. `rootDir: src`, `testRegex: .*\.spec\.ts$`. Loaded via `dotenv -e .env.test`, so `apps/backend/.env.test` must exist.
- **Jest e2e** - `pnpm --filter backend test:e2e`. Config at `apps/backend/test/jest-e2e.json`, `testRegex: .e2e-spec.ts$` (note the dot, not slash). Specs live under `apps/backend/test/`.
- **Vitest** - `apps/backend/vitest.config.ts` picks up `test/**/*.vitest.test.ts`. **Not wired to any pnpm script** - run via `pnpm --filter backend exec vitest`. Root `vitest.workspace.ts` will discover it. At least one such test already exists (`test/auth-password-reset.vitest.test.ts`).

Single Jest spec: `pnpm --filter backend test -- src/orders/orders.service.spec.ts`.

Backend dev against the test database: `pnpm --filter backend dev:test` (runs `nest start --watch` with `.env.test` loaded).

### Frontend tests

`pnpm --filter frontend test` is a no-op (echoes "No frontend tests configured") - unit tests are not set up yet despite Vitest deps being installed. **Playwright e2e is configured**: `apps/frontend/playwright.config.ts` + `apps/frontend/e2e/`, with `@nx/playwright/plugin` exposing an `e2e` Nx target. Run via `pnpm nx run frontend:e2e`.

### Stripe webhook forwarding (backend dev)

```bash
pnpm stripe:listen        # forwards to http://localhost:3005/api/v1/payments/webhook
```

### AI service local setup

The Nx targets (`ai-service:dev`, `:build`, `:lint`, `:test`) invoke `apps/ai-service/.venv/Scripts/python.exe` directly - the venv **must exist** or workspace-wide `pnpm build/lint/test` will fail.

```powershell
cd apps/ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .[dev]
Copy-Item .env.example .env       # set ANTHROPIC_API_KEY or OPENAI_API_KEY
```

CI (`.github/workflows/ci.yml`) creates the venv on a self-hosted Windows runner.

## Architecture

### Backend (NestJS)

- Bootstrap: `apps/backend/src/main.ts`. Global prefix `api/v1` is applied **except** for `/api/auth/*`, which is mounted manually on the Express instance via `expressInstance.all('/api/auth/*splat', toNodeHandler(auth))`. The comment at `main.ts:76` explains why: `@thallesp/nestjs-better-auth` doesn't yet use the Express 5 wildcard syntax, so the manual mount is a deliberate workaround - don't "clean it up."
- **Two layers of auth rate-limiting** on `/api/auth`: (1) `express-rate-limit` in `main.ts` skipping in non-production and only counting attempt paths (`/sign-in`, `/sign-up`, `/forget-password`, `/reset-password`, `/send-verification-email`, `/verify-email` - session checks are intentionally exempt); (2) better-auth's own `rateLimit` config in `auth.ts:122` (10/min in prod, unlimited in dev). If you see unexpected 429s, check both.
- Global providers wired in `app.module.ts`: `SanitizationPipe`, `ZodValidationPipe`, `ZodSerializerInterceptor`, `GlobalExceptionFilter`, `PermissionsGuard`, `CustomThrottlerGuard` (proxy-aware). `disableGlobalAuthGuard: true` is passed to `AuthModule.forRoot` - authentication is enforced by `PermissionsGuard`, not by better-auth's default guard.
- RBAC: defined in `packages/auth/src/access.ts` (the `@repo/auth` package) using better-auth's access-control DSL (`createAccessControl`). Roles are `CUSTOMER | SUPPORT | ADMIN` (see `Role` enum); statements are marketplace-shaped (`profile`, `job`, `quote`, `escrow`, …). `CUSTOMER` covers both homeowners and tradesmen - the split is `User.userType` enforced in services (ownership + userType checks), not a separate role.
- TypeScript imports use the `.js` ESM suffix (`./app.module.js`) even though source is `.ts` - keep this pattern, it's required for the ESM build.
- Feature module convention: `<feature>/<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `dto/`. Cross-cutting code in `src/common/` (`guards/`, `filters/`, `pipes/`, `middleware/`, `prisma/`, `cron/`, `decorators/`, `services/`, `utils/`).
- Validation: `nestjs-zod` everywhere (DTOs are Zod schemas, not class-validator).
- BullMQ uses `REDIS_URL`; `rediss://` automatically enables TLS (Upstash-compatible).
- Swagger UI at `http://localhost:3005/api`.
- A `Dockerfile` exists at `apps/backend/Dockerfile`; build via `pnpm nx run backend:docker-build` (depends on `build`).

### Frontend (Next.js App Router)

Frontend-specific guidance lives in **`apps/frontend/CLAUDE.md`** (the Figma-MCP → code workflow plus the Next.js 16 rule and stack notes). Read it before touching frontend code; this root file does not duplicate it. There are no `AGENTS.md` files in this repo - `CLAUDE.md` is the single source.

**Next.js 16 - use the live docs, not training data.** This repo runs Next.js 16, which renamed/changed APIs from older versions. Don't answer from memory: read current docs through the **Next.js DevTools MCP** - the `nextjs-docs://llms-index` resource for the index, then `nextjs_docs` for a page. (There is no bundled `node_modules/next/dist/docs/` folder.) Notably, the `middleware.ts` convention is **removed/renamed to `proxy.ts`** in Next 16 (codemod: `npx @next/codemod@canary middleware-to-proxy .`).

Quick orientation: path alias `@/*` → `src/*`. Shared UI primitives now live in the `@repo/ui` package, **not** in local `src/components/` - import them from there (e.g. `import { Button, cn, ThemeProvider } from '@repo/ui'`). Theming via `next-themes` + `ThemeProvider` (now exported from `@repo/ui`; the old `src/components/theme-provider.tsx` is gone). Tokens live in `src/app/globals.css` as CSS custom properties plus `@theme inline` aliases for Tailwind v4.

`@repo/ui` is consumed **from source** - its `package.json` `exports` point at `./src/*` (not `dist`), so editing a primitive in `packages/ui/src/` is picked up by the frontend's HMR with no rebuild. `@repo/ui` primitives wrap **`@base-ui/react`** (not Radix). With base-ui, compose a custom element into a trigger/slot via the **`render` prop**, never by nesting - e.g. `<DropdownMenuTrigger render={<Button … />} />`. Nesting (`<DropdownMenuTrigger><Button/></DropdownMenuTrigger>`) renders two `<button>`s and throws a "`<button>` cannot be a descendant of `<button>`" hydration error (this is exactly what bit `mode-toggle.tsx`).

#### Debugging dev-server errors with the Next.js DevTools MCP

Next.js 16 exposes an MCP endpoint per running dev server. To diagnose runtime/build/hydration errors, prefer this over guessing or scraping logs:

1. `init` (next-devtools) - required first call per session.
2. `nextjs_index` - discovers running servers. Frontend is `3000`; when 3000 is taken (e.g. frontend already running) the **admin** app comes up on `3001`.
3. `nextjs_call` with `toolName: "get_errors"` (port `3000`/`3001`) - returns source-mapped runtime + build errors. `get_errors` reports per **browser session**, so a page must be open; if it says "No browser sessions connected", load the page first. Other tools: `get_logs`, `get_routes`, `get_page_metadata`, `get_project_metadata`.
4. Fix in source (for `@repo/ui` issues, edit `packages/ui/src/` - HMR applies it live).
5. Verify with `browser_eval`: `start` → `navigate` to the page → `console_messages { errorsOnly: true }`, then re-run `get_errors` to confirm zero. `browser_eval` writes a `.playwright-mcp/` artifact dir - delete it when done.

### Admin (Next.js App Router)

- `apps/admin` is the internal console for `ADMIN`/`SUPPORT` staff - user/job/escrow/review/verification/report management, audit log, categories, settings. Runs on port `3001` (`next dev --port 3001`). **Open it at `http://admin.localhost:3001`, not `localhost:3001`** - the distinct host keeps its better-auth session cookie out of the frontend's `localhost` cookie jar (cookies ignore the port, so `localhost:3000` and `localhost:3001` would otherwise share/clobber one session, blocking simultaneous admin + homeowner/tradesman sign-in). `admin.localhost` is in `allowedDevOrigins` (`apps/admin/next.config.ts`) and `CORS_ORIGINS`; `localhost:3001` stays trusted for backwards compat.
- Route groups: `src/app/(dashboard)/*` (users, jobs, escrow, reviews, verifications, reports, categories, audit-log, settings) plus a standalone `src/app/sign-in`.
- **Like `apps/frontend`, admin talks to the backend through a same-origin proxy.** `src/next.config.ts` rewrites `/api/*` to `API_PROXY_TARGET` (default `http://localhost:3005`), so the browser only ever hits the admin origin and the better-auth session cookie is first-party. `src/lib/api.ts` uses a relative `/api/v1` base in the browser (absolute `API_PROXY_TARGET` only as a server-side fallback); `src/lib/auth-client.ts` points at `window.location.origin`. The old `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_BETTER_AUTH_URL` vars are gone. Auth is guarded **server-side** by `src/lib/server-session.ts` (`getServerSession()` forwards `cookies()` to `/api/auth/get-session`; `requireAdmin()` reads `role` off the session and reports `authorized` for `ADMIN`/`SUPPORT`), called at the top of the `(dashboard)` route-group layout - signed-out users are redirected to `/sign-in`, signed-in non-staff see `<AccessDenied />`. Real authorization still lives in the backend `PermissionsGuard`; this is UX only.
- Admins sign in with **email + password** (`authClient.signIn.email`, core better-auth; `emailAndPassword` is enabled in `packages/auth/src/index.ts`) - `src/components/auth/sign-in-form.tsx`. There is no phone-OTP flow in admin.
- shadcn config (`apps/admin/components.json`) points its aliases at `@repo/ui` (`components`/`ui`/`lib`/`hooks` all resolve into the `@repo/ui` package) rather than a local `src/components/ui` - new shadcn-generated primitives land in `@repo/ui`, feature components stay in `apps/admin/src/components/`.
- Backend `CORS_ORIGINS` must include `http://admin.localhost:3001` (and `http://localhost:3001`) for local admin dev (already the default in `apps/backend/.env.example`).

### AI service (FastAPI + LangGraph)

- Entry: `apps/ai-service/app/main.py`. Routes mounted under `settings.api_v1_str` (`/api/v1`).
- Layered layout: `api/v1/routes/` → `services/` → `graphs/<name>/{graph,nodes,state}.py` → `infrastructure/llm/` and `infrastructure/prompts/`. Domain logic (e.g. `domain/classification/`) is separate from graph wiring.
- Settings (`app/core/config.py`) load from `apps/ai-service/.env` via pydantic-settings. `LLM_PROVIDER` selects `anthropic` (default, `claude-haiku-4-5` via `langchain-anthropic`) or `openai`; the post-init validator enforces that the matching API key is set and non-blank. `LLM_MAX_TOKENS` (default `4096`) caps output, which matters for Anthropic because an unset cap truncates responses.
- Endpoints: `POST /api/v1/assistant/chat`, `POST /api/v1/assistant/chat/stream`, `POST /api/v1/assistant/classify-job`, `POST /api/v1/assistant/classify-jobs/batch`, `GET /api/v1/assistant/info`, `GET /api/v1/health`.
- JWT verification helpers live in `app/api/deps/auth.py` and `app/core/auth.py` (PyJWT).
- Pytest specs under `apps/ai-service/tests/`. `pyproject.toml` sets `asyncio_mode = "auto"`.

### Shared types

`packages/shared-types/src/generated/prisma/browser.ts` is the browser-safe Prisma output, published as `@repo/shared-types` and consumed by both frontend and backend. The SHA stamp at `packages/shared-types/src/generated/prisma/.schema-hash.json` is checked in CI - never edit it by hand; regenerate with `pnpm prisma:generate:all`.

## CI

`.github/workflows/ci.yml` runs three jobs on push/PR:

1. `prisma-generated-check` (Ubuntu) - runs `pnpm prisma:check:generated`.
2. `build` and `test` (**self-hosted Windows**) - set up Python 3.11, create the ai-service venv, then run `pnpm build` / `pnpm test`.

The Windows jobs are gated on a self-hosted runner, so PRs from forks (or any environment without the runner registered) will see `build` and `test` skipped. Only the Ubuntu Prisma check runs everywhere.

## Conventions

- Conventional Commits enforced by commitlint (husky `commit-msg` hook); `lint-staged` runs prettier on staged files in `pre-commit`. Header max 150, body line max 200 (see `commitlint.config.js`).
- ESM-style relative imports with `.js` suffix in backend TypeScript - match the surrounding files.
- Backend Prisma scripts expect `apps/backend/.env` and `apps/backend/.env.test`. Never commit env files.
