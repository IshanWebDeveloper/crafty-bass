# Testing & validation strategy

This is the corrected, implemented strategy for Crafty Bass. It supersedes the
interim report's Chapter 5 where they disagree (the interim doc predated the
marketplace test suite and had a few factual mismatches, noted inline).

## Layers

| Layer | Runner | Location | Runs in CI? |
| --- | --- | --- | --- |
| Legacy unit (escrow, verification, uploads, app controller) | **Jest** | `apps/backend/src/**/*.spec.ts` | Yes (`backend:test`) |
| Unit (quotes, escrow lifecycle, recommendations, scoring) | **Vitest** | `apps/backend/src/**/*.vitest.test.ts` | Yes (`backend:test`) |
| Shared-schema unit (quote totals, deposit tiers, Zod schemas) | **Vitest** | `packages/validation/src/*.test.ts` | Yes (`validation:test`) |
| Integration (job→quote→escrow, recommendations authz, auth) | **Vitest** | `apps/backend/test/**/*.integration.vitest.test.ts`, `auth-password-reset.vitest.test.ts` | No — `backend:test-integration`, run manually against the Neon test DB |
| End-to-end golden journey | **Playwright** (chromium) | `apps/frontend/e2e/*.spec.ts` | No — local/manual (`frontend:e2e`) |
| AI unit (normalizer, confidence gate, JWT) | **pytest + pytest-cov** | `apps/ai-service/tests/` | Yes (`ai-service:test`) |
| AI classification eval | manual harness | `apps/ai-service/evals/` | No — calls a live LLM |

Backend has **both** Jest and Vitest wired: the `test` Nx target runs Jest then
Vitest-unit (both CI-safe, no DB). Integration and coverage are separate,
non-`test` targets so CI's `affected:test` never picks them up.

- Unit vitest: `apps/backend/vitest.config.ts` (`src/**/*.vitest.test.ts`).
- Integration vitest: `apps/backend/vitest.integration.config.ts`
  (`test/**/*.vitest.test.ts`, single fork, 30 s timeout).

## Commands

```bash
pnpm nx run backend:test              # jest + vitest-unit (CI-safe)
pnpm nx run backend:test-integration  # vitest integration (Neon test DB)
pnpm nx run validation:test           # shared schema unit
pnpm nx run ai-service:test           # pytest (+ coverage.xml)
pnpm nx run frontend:e2e              # Playwright golden journey (local)
pnpm test:cov                         # coverage across backend + validation + ai
```

## ADR: Neon test database instead of Testcontainers

**Decision.** Integration tests run against the shared Neon `.env.test`
PostgreSQL database with self-cleaning fixtures, not an ephemeral Testcontainers
Postgres.

**Rationale.** CI runs on a self-hosted Windows runner where Docker is not
guaranteed; Prisma's driver adapter + better-auth already point at Neon; and a
real managed Postgres exercises the same SSL/pooler path as production.

**Consequences / mitigations.**

- Tests must be self-cleaning: every fixture is namespaced with a unique run
  suffix and removed in `afterAll` (`user.deleteMany({ email: { contains: run }})`
  cascades jobs/quotes/escrows/profiles). Idempotence is verified by running
  `backend:test-integration` twice in a row.
- The DB schema must match the current migrations. If sign-up 500s with
  `column user.userType does not exist`, the test DB has drifted — re-apply
  migrations with `prisma migrate reset` against `.env.test` (this was needed
  once during development when the shared DB reverted to an old schema).
- Keep auth calls per integration file ≤ ~8 (better-auth rate-limits 10/min
  outside development).

## Scoring module: built now, engine wiring later

The recommendation **scoring** module (`apps/backend/src/recommendations/scoring/`)
is implemented and unit-tested now: pure, dependency-free functions for the
documented weighted composite (0.35 reputation + 0.30 proximity + 0.20
completion + 0.15 response, + verified boost, capped at 1). The DB query +
ranking **engine** that feeds these functions and writes `JobRecommendation`
rows remains a later sprint; `RecommendationsService.getJobRecommendations`
currently returns the (empty) precomputed set, now guarded by job ownership.

## Test-case matrix (updated)

| ID | Case | Layer | Artifact | Status |
| --- | --- | --- | --- | --- |
| TC-01 | Quote totals: buckets, callout, discount floor, VAT | validation unit | `quote-totals.test.ts` | Pass |
| TC-02 | Deposit tiers + caps (unverified/verified/trusted/background) | validation unit | `deposit.test.ts` | Pass |
| TC-03 | Zod schema edge cases (job budget refine, quote min line, fund superRefine) | validation unit | `schemas.test.ts` | Pass |
| TC-04 | Quote create guards (ownership, state, userType, duplicate) | backend unit | `quotes.service.vitest.test.ts` | Pass |
| TC-05 | Quote create server-side totals + deposit cap | backend unit | `quotes.service.vitest.test.ts` | Pass |
| TC-06 | Quote accept → assign job, reject others, escrow | backend unit | `quotes.service.vitest.test.ts` | Pass |
| TC-07 | Quote reject / withdraw authz + state | backend unit | `quotes.service.vitest.test.ts` | Pass |
| TC-08 | Escrow `markWorkDone` (tradesman-only, state, timestamp) | backend unit | `escrow.service.lifecycle.vitest.test.ts` | Pass |
| TC-09 | Scoring: weights, proximity, reputation, completion, response, composite | backend unit | `scoring/scoring.vitest.test.ts` | Pass |
| TC-10 | Password reset (request + reset + invalid token) | integration | `auth-password-reset.vitest.test.ts` | Pass |
| TC-11 | Job→quote→escrow lifecycle end-to-end | integration | `job-quote-escrow.integration.vitest.test.ts` | Pass (wired) |
| TC-12 | Escrow fund→release→work-done→approve → RELEASED | integration | `job-quote-escrow.integration.vitest.test.ts` | Pass (wired) |
| TC-13 | Quote listing owner-only (403 vs 200) | integration | `job-quote-escrow.integration.vitest.test.ts` | Pass |
| TC-14 | Quote total server-computed (amount/materials) | integration | `job-quote-escrow.integration.vitest.test.ts` | Pass |
| TC-15 | Recommendations authz (owner 200 / non-owner 403 / anon 401) | integration | `recommendations-authz.integration.vitest.test.ts` | Pass |
| TC-16 | Backend calls AI `classify-job` on job post | — | — | Blocked — feature gap (backend only calls `translate`) |
| TC-17 | Golden journey (post job → quote → accept) | e2e | `golden-journey.spec.ts` | Partial — passes locally; not in CI |
| TC-18 | AI classification quality (category F1, skill Jaccard) | manual eval | `evals/run_classification_eval.py` | Harness ready; run manually with an LLM key |
| TC-19 | AI normalizer / confidence gate / JWT | AI unit | `tests/test_*.py` | Pass |

## Known feature gaps (documented, not fixed here)

- **No backend `classify-job` call.** The backend integrates the AI service only
  for translation; automatic job classification on posting is not wired (TC-16).
- **No recommendations UI.** The endpoint exists and is authz-guarded, but no
  frontend surface consumes it, and the ranking engine is a later sprint.
- **Stripe card funding is unit-tested only.** The integration/e2e lifecycle
  uses the fully-simulated `paypal`/`local` methods (no Stripe keys needed); the
  card/3DS path is covered by `escrow.service.spec.ts` mocks.
