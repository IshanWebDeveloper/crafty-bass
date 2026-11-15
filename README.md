# Crafty Bass

Crafty Bass is a tradesman/homeowner marketplace built as an Nx monorepo containing a Next.js frontend, a Next.js admin app, a NestJS backend, and a Python FastAPI AI service for LangChain and LangGraph workflows.

## Monorepo Structure

- `apps/frontend` - Next.js web app (App Router), port `3000`
- `apps/admin` - Next.js admin/support console, port `3001`
- `apps/backend` - NestJS API + Prisma + better-auth + BullMQ + Stripe, port `3005`
- `apps/ai-service` - FastAPI + LangChain + LangGraph, port `8006`
- `packages/db` - Owns the Prisma schema, migrations/seeds, and the generated client (`@repo/db`)
- `packages/auth` - better-auth config, access-control definitions and shared auth helpers (`@repo/auth`)
- `packages/ui` - Shared UI primitives (base-ui under the hood) (`@repo/ui`)
- `packages/shared-types` - Shared browser-safe Prisma types (`@repo/shared-types`)
- `packages/validation` - Shared Zod schemas (`@repo/validation`)
- `packages/eslint-config` and `packages/prettier-config` - Shared tooling configs
- `deploy/oracle` - Production Docker Compose stack (Postgres, Redis, backend, AI service, Caddy)

## Tech Stack

- Monorepo: Nx
- Package manager: pnpm
- Frontend and admin: Next.js 16 + React 19 + Tailwind v4 + TypeScript
- Backend: NestJS 11 + Prisma (PostgreSQL 17) + better-auth + BullMQ (Redis) + Stripe
- AI service: FastAPI + LangChain + LangGraph (LLM provider is `anthropic` or `openai`)

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (local Postgres + Redis via `docker-compose.yml`)
- Python 3.11 for `apps/ai-service`
- Stripe CLI (for webhook forwarding during payment testing)
- An Anthropic or OpenAI API key for the AI service (`LLM_PROVIDER=anthropic` or `openai`)

## Getting Started

1. Install JS dependencies:

   ```bash
   pnpm install
   ```

2. Create the AI service virtual environment:

   ```powershell
   cd apps/ai-service
   py -3.11 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -e .[dev]
   Copy-Item .env.example .env       # set ANTHROPIC_API_KEY or OPENAI_API_KEY
   ```

3. Create `apps/backend/.env` and `apps/backend/.env.test` from `apps/backend/.env.example`.

4. Start everything (Docker Postgres + Redis, migrations, Stripe webhook forwarding, and all four dev servers):

   ```bash
   pnpm dev:all
   ```

   On a fresh database, seed it once:

   ```bash
   pnpm --filter @repo/db db:seed && pnpm --filter @repo/db db:seed:users
   ```

5. Open the apps:

- Frontend: <http://localhost:3000>
- Admin: <http://admin.localhost:3001> (a separate host keeps the admin session cookie apart from the frontend's)
- Backend: <http://localhost:3005>
- Swagger API docs: <http://localhost:3005/api>
- AI service health: <http://localhost:8006/api/v1/health>

## Environment Files

This repository ignores local environment files (`.env`, `.env.*`); only `.env.example` files are committed. Copy each `.env.example` and keep secrets out of source control.

Key cross-service settings:

- `AI_SERVICE_JWT_AUDIENCE` (backend) must equal `JWT_AUDIENCE` (AI service). The backend mints short-lived, server-only tokens with this audience to call the AI service, and it must differ from the backend's public `JWT_AUDIENCE`, so a token fetched from `/api/auth/token` is rejected by the AI service.
- `CORS_ORIGINS` (backend) defaults to `http://localhost:3000,http://admin.localhost:3001,http://localhost:3001,http://localhost:5173`.

## Useful Commands

### Workspace-level commands

```bash
pnpm build
pnpm lint
pnpm test
pnpm test:cov
pnpm format
```

These commands include `apps/ai-service`, so make sure its `.venv` exists before running the workspace-wide build, lint, or test targets.

### Run apps individually

```bash
pnpm dev              # frontend + admin + backend + ai-service (no Docker/Stripe)
pnpm dev:admin        # only admin
pnpm dev:ai           # only ai-service (via Nx, requires .venv)
pnpm dev:ai:uvicorn   # only ai-service (via uvicorn, no .venv required)
pnpm nx run <frontend|admin|backend|ai-service>:dev
```

### Local database (Docker)

```bash
docker compose up -d        # Postgres on 5432 + Redis on 6379
docker compose down         # stop; data survives in the named volume
docker compose down -v      # stop and wipe (forces a re-seed next time)
```

Two databases are created on first boot: `craftybass_dev` and `craftybass_test`.

### Prisma scripts

The schema and migration/seed scripts live in the `@repo/db` package (`packages/db`).

```bash
pnpm prisma:generate:all          # generate client + refresh shared-types browser output & hash stamp
pnpm prisma:check:generated       # CI guard: verify the generated hash stamp matches the schema
pnpm --filter @repo/db db:migrate:dev
pnpm --filter @repo/db db:migrate:reset
pnpm --filter @repo/db db:seed
pnpm --filter @repo/db db:seed:users
pnpm --filter @repo/db db:seed:sus   # seed/reset the SUS usability-study participants
```

### Tests

```bash
pnpm --filter backend test               # Jest unit tests
pnpm --filter backend test:e2e           # Jest e2e tests
pnpm --filter backend test:integration   # Vitest integration tests (test database)
pnpm nx run frontend:e2e                 # Playwright golden-journey e2e
```

### Stripe webhook forwarding (backend)

```bash
pnpm stripe:listen
```

## Deployment

`deploy/oracle` contains a Docker Compose stack for a single VM: Postgres, Redis, the backend and the AI service on a private network, with Caddy as the only public entry point (HTTPS). Postgres, Redis and the AI service publish no ports.

```bash
cd deploy/oracle
cp .env.example .env      # then fill it in
docker compose up -d --build
```

The frontend and admin apps are deployed separately (Vercel) and proxy `/api/*` to the backend.

## Notes

- Backend defaults to port `3005` (configurable via `PORT`).
- AI service defaults to port `8006` and reads local config from `apps/ai-service/.env`.
- Frontend and admin talk to the backend through a same-origin `/api/*` proxy, so the better-auth session cookie is first-party.
- Common local-only artifacts are gitignored, including `node_modules`, `dist`, `.next`, `.turbo`, `.nx/cache`, and `apps/backend/src/generated`.

## Implementation Roadmap

This roadmap is based on the approved project scope.

### Phase 1: Core Platform Foundation ✅

- Wire NestJS modules and route structure around the Prisma models (`User`, `HomeownerProfile`, `TradesmanProfile`, `ServiceCategory`, `Skill`, `Job`, `Quote`, `Review`, `Conversation`, `Message`, `JobRecommendation`).
- Integrate `@repo/auth` with HTTP endpoints and role-based guards (`CUSTOMER`, `SUPPORT`, `ADMIN`); marketplace RBAC in `packages/auth/src/access.ts`.
- Add seed data for service categories and skills (English, Sinhala, Tamil labels).

Deliverable: authenticated backend APIs with a stable domain model and seeded taxonomy. **Complete**: backend modules `users/`, `profiles/`, `jobs/`, `quotes/`, `material-requests/`, `escrow/`, `categories/`, `classification/`, `reviews/`, `recommendations/`, `verification/`, `uploads/`, `conversations/`, `reports/`, `consent/`, `legal/`, `admin/`, `webhooks/`, `translation/`, `notifications/`, and `health/` are wired; taxonomy seeded.

### Phase 2: Two-Sided Marketplace Features ✅

- Homeowner flows: profile setup, create/edit job posts, view quotes, accept quotes, complete jobs.
- Tradesman flows: profile setup, skills management, availability, submit/withdraw quotes.
- Job lifecycle: `OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED/CANCELLED` with audit-ready status transitions.
- Messaging: job-linked conversations and direct messaging with unread/read tracking.

Deliverable: end-to-end homeowner and tradesman marketplace workflow. **Complete**: frontend journeys live under `apps/frontend/src/app/[locale]/` (`jobs`, `quotes`, `messages`, `dashboard`, `account`, `notifications`); escrow/Stripe payments and material requests are wired.

### Phase 3: AI-Assisted Job Classification ✅

- Build a LangChain/LangGraph workflow that classifies free-text job descriptions into `ServiceCategory` and likely `Skill` tags.
- Persist outputs to `Job.aiCategoryId`, `Job.aiConfidence`, and `Job.aiSuggestedTags`.
- Add confidence thresholds and manual override (homeowner or admin can correct classification).

Deliverable: production-ready classification service with observable confidence metrics. **Complete**: `apps/ai-service` exposes `POST /api/v1/assistant/classify-job` (and `/classify-jobs/batch`) via a LangGraph workflow, called by the backend `classification/` module with a server-only service token; AI-suggested skills are attached as `JobSkill` rows.

### Phase 4: Recommendation and Trust Scoring ✅

- Implement recommendation ranking for each job and persist in `JobRecommendation`.
- Compute score using weighted factors: proximity, average rating, completion reliability, and response speed.
- Add explanation payloads in `JobRecommendation.reasons` for transparency.
- Introduce trust signals: verification status, report history, cancellation behavior.

Deliverable: explainable multi-factor tradesman recommendation engine. **Complete**: backend `recommendations/` module ranks and persists `JobRecommendation` records; `verification/` and `reports/` supply trust signals. A latent-truth benchmark (`apps/backend/src/recommendations/scoring/benchmark/`) evaluates ranking quality with bootstrap confidence intervals, cold-start exposure and a weight sweep.

### Phase 5: Multilingual and UX Completion ✅

- Implement i18n for English/Sinhala/Tamil in frontend copy and category/skill display.
- Build frontend pages for auth, dashboards, job posting, quote comparison, messaging, and reviews.
- Ensure mobile responsiveness and accessibility baseline (WCAG-focused form/navigation checks).

Deliverable: usable tri-lingual web app across homeowner and tradesman journeys. **Complete**: the frontend is routed under a `[locale]` segment (en/si/ta) backed by the backend `translation/` module, with auth, dashboard, jobs, quotes, and messaging pages built.

### Phase 6: Quality, Evaluation, and Submission 🚧

- Backend tests: unit + integration for auth, jobs, quotes, AI classification, and recommendation scoring.
- Frontend tests: core journey e2e tests (post job, receive quote, accept quote, review tradesman).
- Run SUS-based usability evaluation with participants and compute average SUS score. ✅
- Compare results against informal baseline process (time to hire, confidence, transparency).

Deliverable: validated project outcomes aligned with dissertation/report requirements. **In progress**: backend Jest unit/e2e and Vitest integration suites (job-quote-escrow lifecycle, recommendations authz) and the Playwright golden-journey e2e are in place; the SUS usability study is complete (participant accounts seeded via `db:seed:sus`); the baseline comparison remains.

## Current Repository Status

- Data model is stable in `packages/db/prisma/schema.prisma` (marketplace domain).
- Auth lives in `packages/auth/` (`@repo/auth`) with marketplace RBAC in `packages/auth/src/access.ts`.
- Backend modules wired in `apps/backend/src/app.module.ts`: `users`, `profiles`, `jobs`, `quotes`, `material-requests`, `escrow`, `categories`, `classification`, `reviews`, `recommendations`, `verification`, `uploads`, `conversations`, `reports`, `consent`, `legal`, `admin`, `webhooks`, `translation`, `notifications`, `health`.
- Frontend has multilingual (en/si/ta) marketplace pages routed under `[locale]`: home, jobs, quotes, messages, dashboard, account, notifications, and legal/marketing pages.
- Admin console (`apps/admin`) covers users, jobs, escrow, reviews, verifications, reports, categories, audit log, and settings.
- Escrow/Stripe payments are integrated (webhook forwarding via `pnpm stripe:listen`).
- Production deployment stack is in `deploy/oracle`.
- Legacy e-commerce sweep complete.
