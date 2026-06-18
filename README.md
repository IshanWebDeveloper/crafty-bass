# Crafty Bass

Crafty Bass is an Nx monorepo containing a Next.js frontend, a NestJS backend, and a Python FastAPI AI service for local LangChain and LangGraph workflows.

## Monorepo Structure

- `apps/frontend` - Next.js web app
- `apps/admin` - Next.js admin app
- `apps/backend` - NestJS API + Prisma
- `apps/ai-service` - FastAPI + LangChain + LangGraph + Ollama
- `packages/ui` - Shared shadcn UI primitives
- `packages/shared-types` - Shared browser-safe Prisma types
- `packages/validation` - Shared Zod schemas
- `packages/eslint-config` and `packages/prettier-config` - Shared tooling configs

## Tech Stack

- Monorepo: Nx
- Package manager: pnpm
- Frontend: Next.js + React + TypeScript
- Backend: NestJS + Prisma + PostgreSQL
- AI service: FastAPI + LangChain + LangGraph + Ollama

## Prerequisites

- Node.js 20+
- pnpm 10+
- Python 3.10+ for `apps/ai-service`
- Ollama for local model inference

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start both apps in development mode:

   ```bash
   pnpm dev
   ```

3. Open the apps:

- Frontend: http://localhost:3000
- Admin: http://localhost:3001
- Backend: http://localhost:3005
- Swagger API docs: http://localhost:3005/api

## Environment Files

This repository ignores local environment files:

- `.env`
- `.env.*`

Create local env files as needed (for example, `apps/backend/.env` and `apps/backend/.env.test`) and keep secrets out of source control.

## Useful Commands

### Workspace-level commands

```bash
pnpm build
pnpm lint
pnpm test
pnpm format
```

These commands now include `apps/ai-service`, so make sure its `.venv` has been created before running the workspace-wide build, lint, or test targets.

### Run apps individually

```bash
pnpm nx run frontend:dev
pnpm nx run admin:dev
pnpm nx run backend:dev
pnpm nx run ai-service:dev
```

### Run the AI service through the root shortcut

```bash
pnpm dev:ai
```

### Backend Prisma scripts

```bash
pnpm --filter backend prisma:generate
pnpm prisma:generate:all
pnpm prisma:check:generated
pnpm --filter backend prisma:migrate:dev
pnpm --filter backend prisma:migrate:reset
pnpm --filter backend prisma:migrate:dev:test
```

### Stripe webhook forwarding (backend)

```bash
pnpm stripe:listen
```

## Notes

- Backend defaults to port `3005` (configurable via `PORT`).
- AI service defaults to port `8006` and reads local config from `apps/ai-service/.env`.
- CORS defaults to `http://localhost:3000` when `CORS_ORIGINS` is not set.
- Backend Prisma scripts expect environment files such as `.env` and `.env.test` in `apps/backend`.
- AI service expects a local virtual environment at `apps/ai-service/.venv` for Nx targets such as `ai-service:dev`.
- Common local-only artifacts are gitignored, including `node_modules`, `dist`, `.next`, `.turbo`, `.nx/cache`, and `apps/backend/src/generated`.

## Implementation Roadmap

This roadmap is based on the approved project scope

### Phase 1: Core Platform Foundation ✅

- Wire NestJS modules and route structure around existing Prisma models (`User`, `HomeownerProfile`, `TradesmanProfile`, `ServiceCategory`, `Skill`, `Job`, `Quote`, `Review`, `Conversation`, `Message`, `JobRecommendation`).
- Integrate `@repo/auth` with HTTP endpoints and role-based guards (`CUSTOMER`, `SUPPORT`, `ADMIN`); marketplace RBAC in `packages/auth/src/access.ts`.
- Add seed data for service categories and skills (English, Sinhala, Tamil labels).

Deliverable: authenticated backend APIs with a stable domain model and seeded taxonomy. **Complete** — backend modules `users/`, `profiles/`, `jobs/`, `quotes/`, `categories/`, `reviews/`, `recommendations/`, `consent/`, `legal/`, `admin/` are wired; taxonomy seeded.

### Phase 2: Two-Sided Marketplace Features

- Homeowner flows: profile setup, create/edit job posts, view quotes, accept quotes, complete jobs.
- Tradesman flows: profile setup, skills management, availability, submit/withdraw quotes.
- Job lifecycle: `OPEN -> ASSIGNED -> IN_PROGRESS -> COMPLETED/CANCELLED` with audit-ready status transitions.
- Messaging: job-linked conversations and direct messaging with unread/read tracking.

Deliverable: end-to-end homeowner and tradesman marketplace workflow.

### Phase 3: AI-Assisted Job Classification

- Build a LangChain/LangGraph workflow that classifies free-text job descriptions into `ServiceCategory` and likely `Skill` tags.
- Persist outputs to `Job.aiCategoryId`, `Job.aiConfidence`, and `Job.aiSuggestedTags`.
- Add confidence thresholds and manual override (homeowner or admin can correct classification).

Deliverable: production-ready classification service with observable confidence metrics.

### Phase 4: Recommendation and Trust Scoring

- Implement recommendation ranking for each job and persist in `JobRecommendation`.
- Compute score using weighted factors: proximity, average rating, completion reliability, and response speed.
- Add explanation payloads in `JobRecommendation.reasons` for transparency.
- Introduce trust signals: verification status, report history, cancellation behavior.

Deliverable: explainable multi-factor tradesman recommendation engine.

### Phase 5: Multilingual and UX Completion

- Implement i18n for English/Sinhala/Tamil in frontend copy and category/skill display.
- Build frontend pages for auth, dashboards, job posting, quote comparison, messaging, and reviews.
- Ensure mobile responsiveness and accessibility baseline (WCAG-focused form/navigation checks).

Deliverable: usable tri-lingual web app across homeowner and tradesman journeys.

### Phase 6: Quality, Evaluation, and Submission

- Backend tests: unit + integration for auth, jobs, quotes, AI classification, and recommendation scoring.
- Frontend tests: core journey e2e tests (post job, receive quote, accept quote, review tradesman).
- Run SUS-based usability evaluation with participants and compute average SUS score.
- Compare results against informal baseline process (time to hire, confidence, transparency).

Deliverable: validated project outcomes aligned with dissertation/report requirements.

## Current Repository Status (Quick Gap View)

- Data model is stable in `packages/db/prisma/schema.prisma` (marketplace domain).
- Auth foundation lives in `packages/auth/` with marketplace RBAC in `packages/auth/src/access.ts`.
- Backend modules wired in `apps/backend/src/app.module.ts`: `users`, `profiles`, `jobs`, `quotes`, `categories`, `reviews`, `recommendations`, `consent`, `legal`, `admin`.
- Frontend has multilingual (en/si/ta) marketplace pages: home, job search, account/privacy.
- Legacy e-commerce sweep complete (see `apps/backend/LEGACY_SWEEP_PLAN.md`).

Recommended immediate next step: finish Phase C marketplace modules (`conversations/`, `messages/`, `reports/`), then move into Phase 3 AI classification work.
