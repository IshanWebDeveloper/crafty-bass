# AGENTS.md

This is the repo-wide, tool-agnostic guide for agents and contributors working in this monorepo.

## Start Here

- Work from the repository root unless a command explicitly says otherwise.
- The workspace is managed with Nx and pnpm.
- Prefer the package and project scripts already defined in `package.json`, `apps/*/package.json`, and `project.json`.
- Read the nearest app-specific `AGENTS.md` before changing app code. For frontend work, also read `apps/frontend/AGENTS.md`.

## Repository Map

- `apps/frontend` - Next.js App Router frontend using React 19, Tailwind CSS v4, shadcn-style primitives, `next-themes`, and shared browser-safe Prisma types.
- `apps/backend` - NestJS 11 API using Prisma, PostgreSQL, better-auth, BullMQ, Stripe, and Zod-based validation.
- `apps/ai-service` - FastAPI service using LangChain/LangGraph with `github` or `openai` as the configured LLM provider.
- `shared-types/` - Workspace package exposing generated Prisma browser types from `shared-types/src/generated/prisma/`.

`pnpm-workspace.yaml` includes `apps/*` and `packages/*`. The current shared package lives at the repo root as `shared-types/`.

## Current Product Reality

The backend is mid-migration. Treat the Prisma schema and roadmap as the source of truth for the product domain.

- `apps/backend/prisma/schema.prisma` models a tradesman/homeowner marketplace.
- Several backend modules under `apps/backend/src/` still reflect the older e-commerce scaffold, including products, cart, orders, payments, wishlist, promotions, tax rates, reviews, and support.
- Some stale names remain, such as old RBAC statements, the Swagger title, and the AI service package description. Do not infer product intent from those stale references.

## Common Commands

Run these from the repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm affected:build
pnpm affected:lint
pnpm affected:test
```

Useful per-app pattern:

```bash
pnpm nx run <frontend|backend|ai-service>:<dev|build|lint|test>
```

Ports:

- Frontend: `3000`
- Backend: `3005` by default, overridable with `PORT`
- AI service: `8006`

## Safe Editing Rules

- Do not commit `.env` files. Use checked-in examples as references only.
- Do not hand-edit generated Prisma shared types under `shared-types/src/generated/prisma/`.
- If `apps/backend/prisma/schema.prisma` changes, run `pnpm prisma:generate:all` and include the generated shared-type changes and schema hash.
- Keep backend TypeScript relative imports using the existing `.js` suffix style.
- Keep validation patterns aligned with the app: NestJS DTOs use `nestjs-zod`; the AI service uses Pydantic/FastAPI patterns.
- Do not replace existing app conventions with a new framework or styling approach unless the task explicitly calls for it.

## Verification Guide

- Workspace-wide checks: `pnpm build`, `pnpm lint`, and `pnpm test`.
- Prisma generated output check: `pnpm prisma:check:generated`.
- Frontend unit test script is currently a no-op; Playwright e2e is configured through `pnpm nx run frontend:e2e`.
- Backend Jest unit tests run with `pnpm --filter backend test` and require `apps/backend/.env.test`.
- Backend Jest e2e tests run with `pnpm --filter backend test:e2e`.
- Backend Vitest tests are not wired to a package script; run them with `pnpm --filter backend exec vitest`.
- AI service Nx targets expect `apps/ai-service/.venv/Scripts/python.exe` to exist. Create and install the venv before relying on workspace-wide build, lint, or test.

AI service setup on Windows:

```powershell
cd apps/ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .[dev]
Copy-Item .env.example .env
```
