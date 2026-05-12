# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first: the repo is mid-migration

The Prisma schema (`apps/backend/prisma/schema.prisma`) has been rewritten for a **tradesman/homeowner marketplace** (models: `User`, `HomeownerProfile`, `TradesmanProfile`, `ServiceCategory`, `Skill`, `Job`, `Quote`, `Review`, `Conversation`, `Message`, `JobRecommendation`, `Report`; enums for `Role`, `UserType`, `JobStatus`, etc.).

But `apps/backend/src/` still contains the **previous e-commerce modules** (`products/`, `cart/`, `orders/`, `payments/`, `wishlist/`, `promotions/`, `tax-rates/`, `reviews/`, `support/`). README's Phase 1 explicitly calls for rewiring modules around the new Prisma models. The Prisma schema and the README roadmap are authoritative for the domain; the legacy backend modules are scaffolding to replace.

### Where the docs/code lie about the product

Three places still describe a different product than the current target — don't trust them when inferring intent:

- `apps/backend/src/auth-access.ts` — RBAC statements (`product`, `category`, `cart`, `order`, `coupon`, `payments`, `review`, `ticket`, `user`) and roles (`customer`, `support`, `admin`) are built for the old e-commerce domain. Will need rewriting alongside the schema migration.
- `apps/backend/src/main.ts` — Swagger title is still "StreetGadgetz E-Commerce API".
- `apps/ai-service/pyproject.toml` — description still references "local Ollama workflows", but `LLM_PROVIDER` in `app/core/config.py` is typed `Literal["github", "openai"]` only.

## Repository

Nx + pnpm monorepo with three apps:

- `apps/frontend` — Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui
- `apps/backend` — NestJS 11 + Prisma (PostgreSQL) + better-auth + BullMQ + Stripe
- `apps/ai-service` — Python FastAPI + LangChain/LangGraph (LLM provider is `github` or `openai`)
- `packages/shared-types/` — workspace package exposing Prisma-generated browser types via `packages/shared-types/src/generated/prisma/`

`pnpm-workspace.yaml` includes `apps/*` and `packages/*` (no `packages/` exists yet — `shared-types` is at the root).

## Common commands

All run from repo root unless noted.

```bash
pnpm install                # install JS deps; ai-service .venv is separate (see below)
pnpm dev                    # frontend + backend + ai-service in parallel via Nx
pnpm build / lint / test    # nx run-many across all projects (ai-service .venv must exist)
pnpm format                 # prettier
pnpm dev:ai                 # only ai-service via Nx (uses .venv)
pnpm dev:ai:uvicorn         # ai-service via uvicorn directly (no .venv required)
pnpm affected:build / affected:lint / affected:test   # CI-style affected-only
```

Per-app: `pnpm nx run <frontend|backend|ai-service>:<dev|build|lint|test>`.

Ports: frontend `3000`, backend `3005` (override with `PORT`), ai-service `8006`. CORS defaults to `http://localhost:3000` (override with `CORS_ORIGINS`).

### Prisma

Most scripts are in `apps/backend/package.json`. The two that matter at the workspace level:

```bash
pnpm prisma:generate:all       # generates Prisma client + shared-types browser output
pnpm prisma:check:generated    # CI guard: verifies packages/shared-types/.../prisma/.schema-hash.json matches schema SHA
```

If you change `schema.prisma`, you must run `prisma:generate:all` and commit the updated hash stamp under `packages/shared-types/src/generated/prisma/`, or the `prisma-generated-check` CI job will fail.

### Backend tests

Backend has **both Jest and Vitest configured** — they don't overlap, but the distinction matters:

- **Jest unit** — `pnpm --filter backend test`. Config inlined in `package.json`. `rootDir: src`, `testRegex: .*\.spec\.ts$`. Loaded via `dotenv -e .env.test`, so `apps/backend/.env.test` must exist.
- **Jest e2e** — `pnpm --filter backend test:e2e`. Config at `apps/backend/test/jest-e2e.json`, `testRegex: .e2e-spec.ts$` (note the dot, not slash). Specs live under `apps/backend/test/`.
- **Vitest** — `apps/backend/vitest.config.ts` picks up `test/**/*.vitest.test.ts`. **Not wired to any pnpm script** — run via `pnpm --filter backend exec vitest`. Root `vitest.workspace.ts` will discover it. At least one such test already exists (`test/auth-password-reset.vitest.test.ts`).

Single Jest spec: `pnpm --filter backend test -- src/orders/orders.service.spec.ts`.

Backend dev against the test database: `pnpm --filter backend dev:test` (runs `nest start --watch` with `.env.test` loaded).

### Frontend tests

`pnpm --filter frontend test` is a no-op (echoes "No frontend tests configured") — unit tests are not set up yet despite Vitest deps being installed. **Playwright e2e is configured**: `apps/frontend/playwright.config.ts` + `apps/frontend/e2e/`, with `@nx/playwright/plugin` exposing an `e2e` Nx target. Run via `pnpm nx run frontend:e2e`.

### Stripe webhook forwarding (backend dev)

```bash
pnpm stripe:listen        # forwards to http://localhost:3005/api/v1/payments/webhook
```

### AI service local setup

The Nx targets (`ai-service:dev`, `:build`, `:lint`, `:test`) invoke `apps/ai-service/.venv/Scripts/python.exe` directly — the venv **must exist** or workspace-wide `pnpm build/lint/test` will fail.

```powershell
cd apps/ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .[dev]
Copy-Item .env.example .env       # set GITHUB_TOKEN or OPENAI_API_KEY
```

CI (`.github/workflows/ci.yml`) creates the venv on a self-hosted Windows runner.

## Architecture

### Backend (NestJS)

- Bootstrap: `apps/backend/src/main.ts`. Global prefix `api/v1` is applied **except** for `/api/auth/*`, which is mounted manually on the Express instance via `expressInstance.all('/api/auth/*splat', toNodeHandler(auth))`. The comment at `main.ts:76` explains why: `@thallesp/nestjs-better-auth` doesn't yet use the Express 5 wildcard syntax, so the manual mount is a deliberate workaround — don't "clean it up."
- **Two layers of auth rate-limiting** on `/api/auth`: (1) `express-rate-limit` in `main.ts` skipping in non-production and only counting attempt paths (`/sign-in`, `/sign-up`, `/forget-password`, `/reset-password`, `/send-verification-email`, `/verify-email` — session checks are intentionally exempt); (2) better-auth's own `rateLimit` config in `auth.ts:122` (10/min in prod, unlimited in dev). If you see unexpected 429s, check both.
- Global providers wired in `app.module.ts`: `SanitizationPipe`, `ZodValidationPipe`, `ZodSerializerInterceptor`, `GlobalExceptionFilter`, `PermissionsGuard`, `CustomThrottlerGuard` (proxy-aware). `disableGlobalAuthGuard: true` is passed to `AuthModule.forRoot` — authentication is enforced by `PermissionsGuard`, not by better-auth's default guard.
- RBAC: defined in `auth-access.ts` using better-auth's access-control DSL (`createAccessControl`). Roles are `CUSTOMER | SUPPORT | ADMIN` (see `Role` enum). See "Where the docs/code lie" above — current statements are for e-commerce.
- TypeScript imports use the `.js` ESM suffix (`./app.module.js`) even though source is `.ts` — keep this pattern, it's required for the ESM build.
- Feature module convention: `<feature>/<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `dto/`. Cross-cutting code in `src/common/` (`guards/`, `filters/`, `pipes/`, `middleware/`, `prisma/`, `cron/`, `decorators/`, `services/`, `utils/`).
- Validation: `nestjs-zod` everywhere (DTOs are Zod schemas, not class-validator).
- BullMQ uses `REDIS_URL`; `rediss://` automatically enables TLS (Upstash-compatible).
- Swagger UI at `http://localhost:3005/api`.
- A `Dockerfile` exists at `apps/backend/Dockerfile`; build via `pnpm nx run backend:docker-build` (depends on `build`).

### Frontend (Next.js App Router)

Two frontend-only docs at `apps/frontend/`:

- **`AGENTS.md`** — single hard rule: Next.js 16 has breaking changes from training data, so **read `node_modules/next/dist/docs/` before writing any code**. Heed deprecation notices.
- **`CLAUDE.md`** — the Figma-MCP → code workflow contract (token-first, primitives before pages, asset/icon conventions, server/client boundary rules).

Read both before touching frontend code. This root file deliberately does not duplicate them.

Quick orientation: path alias `@/*` → `src/*`. Theming via `next-themes` + `ThemeProvider` (`src/components/theme-provider.tsx`). Tokens live in `src/app/globals.css` as CSS custom properties plus `@theme inline` aliases for Tailwind v4.

### AI service (FastAPI + LangGraph)

- Entry: `apps/ai-service/app/main.py`. Routes mounted under `settings.api_v1_str` (`/api/v1`).
- Layered layout: `api/v1/routes/` → `services/` → `graphs/<name>/{graph,nodes,state}.py` → `infrastructure/llm/` and `infrastructure/prompts/`. Domain logic (e.g. `domain/classification/`) is separate from graph wiring.
- Settings (`app/core/config.py`) load from `apps/ai-service/.env` via pydantic-settings. `LLM_PROVIDER` selects `github` or `openai`; the post-init validator enforces that the matching API key is set.
- Endpoints: `POST /api/v1/assistant/chat`, `POST /api/v1/assistant/classify-job`, `GET /api/v1/assistant/info`, `GET /api/v1/health`.
- JWT verification helpers live in `app/api/deps/auth.py` and `app/core/auth.py` (PyJWT).
- Pytest specs under `apps/ai-service/tests/`. `pyproject.toml` sets `asyncio_mode = "auto"`.

### Shared types

`packages/shared-types/src/generated/prisma/browser.ts` is the browser-safe Prisma output consumed by the frontend. The SHA stamp at `packages/shared-types/src/generated/prisma/.schema-hash.json` is checked in CI — never edit it by hand; regenerate with `pnpm prisma:generate:all`.

## CI

`.github/workflows/ci.yml` runs three jobs on push/PR:

1. `prisma-generated-check` (Ubuntu) — runs `pnpm prisma:check:generated`.
2. `build` and `test` (**self-hosted Windows**) — set up Python 3.11, create the ai-service venv, then run `pnpm build` / `pnpm test`.

The Windows jobs are gated on a self-hosted runner, so PRs from forks (or any environment without the runner registered) will see `build` and `test` skipped. Only the Ubuntu Prisma check runs everywhere.

## Conventions

- Conventional Commits enforced by commitlint (husky `commit-msg` hook); `lint-staged` runs prettier on staged files in `pre-commit`. Header max 150, body line max 200 (see `commitlint.config.js`).
- ESM-style relative imports with `.js` suffix in backend TypeScript — match the surrounding files.
- Backend Prisma scripts expect `apps/backend/.env` and `apps/backend/.env.test`. Never commit env files.
