# Crafty Bass — Backend

The NestJS API for the Crafty Bass tradesman/homeowner marketplace. Built with NestJS 11, Prisma (PostgreSQL), better-auth, BullMQ, and Stripe. Part of the Crafty Bass Nx monorepo — see the [root README](../../README.md) for workspace-wide setup.

## Tech Stack

- **NestJS 11** (Express platform, ESM build)
- **Prisma 7** on PostgreSQL — schema owned by the `@repo/db` package (`packages/db/prisma/schema.prisma`), **not** this app
- **better-auth** for authentication, with RBAC defined in `@repo/auth` (`packages/auth/src/access.ts`)
- **BullMQ** (Redis) for background jobs; `rediss://` URLs enable TLS automatically (Upstash-compatible)
- **Stripe** for escrow/payments
- **nestjs-zod** for validation and serialization (DTOs are Zod schemas, not class-validator)
- **Swagger** UI at `/api`

## Getting Started

Install dependencies from the repo root (this is a pnpm workspace):

```bash
pnpm install
```

Create the required env files (never commit these):

- `apps/backend/.env` — local development
- `apps/backend/.env.test` — used by tests and `dev:test`

Run the backend:

```bash
pnpm nx run backend:dev          # from repo root
pnpm --filter backend dev        # equivalent, loads .env
pnpm --filter backend dev:test   # run against the test database (loads .env.test)
```

The API listens on port **3005** by default (override with `PORT`). CORS defaults to `http://localhost:3000` (override with `CORS_ORIGINS`).

- Swagger UI: <http://localhost:3005/api>
- API base path: `/api/v1` (better-auth routes are mounted at `/api/auth/*`, outside the global prefix)

## Architecture

- **Bootstrap**: `src/main.ts`. The global prefix `api/v1` is applied to everything **except** `/api/auth/*`, which is mounted manually on the Express instance (a deliberate workaround for Express 5 wildcard syntax — don't "clean it up").
- **Auth rate limiting** happens in two layers: `express-rate-limit` in `main.ts` (skips non-production, only counts attempt paths) and better-auth's own `rateLimit` config in `auth.ts`. Check both if you see unexpected 429s.
- **Global providers** wired in `app.module.ts`: `SanitizationPipe`, `ZodValidationPipe`, `ZodSerializerInterceptor`, `GlobalExceptionFilter`, `PermissionsGuard`, `CustomThrottlerGuard`. `disableGlobalAuthGuard: true` is passed to `AuthModule.forRoot` — authentication is enforced by `PermissionsGuard`, not better-auth's default guard.
- **RBAC**: roles are `CUSTOMER | SUPPORT | ADMIN`. `CUSTOMER` covers both homeowners and tradesmen — the split is `User.userType`, enforced in services (ownership + userType checks), not by a separate role.
- **ESM imports** use the `.js` suffix (`./app.module.js`) even though source is `.ts` — required for the ESM build. Match this pattern.
- **Module convention**: `<feature>/<feature>.module.ts`, `.controller.ts`, `.service.ts`, `dto/`. Cross-cutting code lives in `src/common/` (`guards/`, `filters/`, `pipes/`, `middleware/`, `prisma/`, `cron/`, `decorators/`, `services/`, `utils/`).

### Feature modules

`users`, `profiles`, `categories`, `jobs`, `quotes`, `material-requests`, `escrow`, `verification`, `conversations`, `reports`, `reviews`, `recommendations`, `consent`, `legal`, `admin`, `webhooks`, `translation`, `notifications`, `health`.

> Note: message endpoints live under `conversations/` — there is no separate `messages/` module.

## Prisma

The schema and migration/seed scripts live in the `@repo/db` package, not this app. From the repo root:

```bash
pnpm --filter @repo/db db:migrate:dev        # create/apply a migration (loads apps/backend/.env)
pnpm --filter @repo/db db:migrate:dev:test   # migrate the test database (loads .env.test)
pnpm --filter @repo/db db:migrate:reset
pnpm --filter @repo/db db:seed               # service categories and skills (en/si/ta)
pnpm --filter @repo/db db:seed:users
```

If you change `packages/db/prisma/schema.prisma`, run `pnpm prisma:generate:all` from the root and commit the updated hash stamp under `packages/shared-types/src/generated/prisma/`, or the `prisma-generated-check` CI job will fail.

## Testing

Backend has **both Jest and Vitest** configured (they don't overlap):

```bash
# Jest unit — config inlined in package.json, testRegex .*\.spec\.ts$ (loads .env.test)
pnpm --filter backend test
pnpm --filter backend test -- src/jobs/jobs.service.spec.ts   # single spec

# Jest e2e — config at test/jest-e2e.json, testRegex .e2e-spec.ts$
pnpm --filter backend test:e2e

# Coverage
pnpm --filter backend test:cov

# Vitest — test/**/*.vitest.test.ts, not wired to a pnpm script
pnpm --filter backend exec vitest
```

`apps/backend/.env.test` must exist — the Jest scripts load it via `dotenv -e .env.test`.

## Stripe webhook forwarding

From the repo root, forward Stripe events to the local webhook endpoint:

```bash
pnpm stripe:listen        # -> http://localhost:3005/api/v1/payments/webhook
```

## Build & Docker

```bash
pnpm --filter backend build            # nest build
pnpm nx run backend:docker-build       # builds the image (depends on build); Dockerfile at apps/backend/Dockerfile
```

## Environment notes

- BullMQ uses `REDIS_URL`.
- Backend Prisma scripts expect `apps/backend/.env` and `apps/backend/.env.test`.
