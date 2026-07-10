# Testing & Validation implementation — `feat/testing-validation`

## Status: implemented ✅

All 11 commits are done on `feat/testing-validation`. Corrections found while
implementing (the plan below is the original; these override it where they
differ):

- **Password-reset fix was larger than "add `privacyPolicyAcceptedAt`."** The
  test also queried the reset token wrong — better-auth stores it as a
  verification row `identifier = reset-password:<token>` with `value = userId`,
  so the token is the identifier suffix, not `verification.value`.
- **The seeded taxonomy has 16 categories / 49 skills, not 14** (`pest-control`
  and `welding` were added). The eval `taxonomy.json` reflects the real 16.
- **The verified seeded tradesman is `priya@example.com`, not `kasun`** (kasun is
  seeded unverified). The gated fund-page e2e uses priya.
- **`frontend:e2e` already exists** via `@nx/playwright/plugin`, so no
  `project.json` e2e target was added.
- **The Neon `.env.test` DB had drifted to an old e-commerce schema** mid-work
  (missing `user.userType` etc.); it was brought current with
  `prisma migrate reset` (user-approved) before integration tests passed.
- **e2e is validated by config/`--list`/lint, not a live CI run** — the golden
  journey passes locally against a booted stack (manual, out of CI, as planned).
- Some **pre-existing lint debt** surfaced by the gates was cleaned so
  `lint` is green (two jest `unbound-method` suppressions; ai-service ruff
  modernisations + a FastAPI `B008` ignore).

The corrected, living strategy now lives in `docs/TESTING_STRATEGY.md`,
`docs/SUS_PROTOCOL.md` and `docs/ACCEPTANCE_CRITERIA.md`.

## Context

The interim report's Chapter 5 (Validation) commits to a layered test strategy, but the repo's actual baseline is thin and the strategy doc has factual mismatches. Verified gaps:

- All committed unit specs are **Jest** (escrow, verification, uploads, app.controller); Vitest is configured but runs only `test/auth-password-reset.vitest.test.ts`, which **no script runs** and which is **silently broken** (its sign-up payload lacks `privacyPolicyAcceptedAt`, which the `user.create.before` hook in `packages/auth/src/index.ts` rejects on `/sign-up/email`).
- `computeQuoteTotals` / Zod schemas in `packages/validation` and the entire quotes service are untested.
- The recommendations module is a stub — **no scoring functions exist** — and `RecommendationsService.getJobRecommendations(jobId)` has **no ownership check** (any signed-in user can read any job's recommendations).
- Playwright has only the scaffold stub (asserts `h1 "Welcome"`, fails vs the localized homepage); no auth fixtures; `webServer` boots all four apps. No recommendations UI exists; backend never calls the AI `classify-job` endpoint (only `translate`) — both are feature gaps to document, not fix here.
- AI service: zero classification tests, no labelled dataset/eval harness, no pytest-cov.
- No coverage config anywhere meaningful; CI publishes no coverage artifact. No TESTING_STRATEGY.md / SUS protocol / acceptance-criteria docs exist.

**Decisions (settled):** (1) new TS tests in Vitest, keep Jest specs untouched, wire Vitest into CI; (2) build the pure recommendation scoring module now with unit tests (engine/DB wiring stays Sprint 3); (3) integration tests keep the Neon `.env.test` DB with self-cleaning fixtures — no Testcontainers (document as ADR deviation); (4) full AI eval scope: labelled EN/SI/TA dataset + manual metrics harness + CI-safe pure unit tests.

Branch: `git checkout -b feat/testing-validation` off `feat/admin-dashboard`. Conventional commits; each commit individually buildable; run lint after every edit. Use pnpm only.

## Key facts for the implementer

- Jest unit: `rootDir: src`, `testRegex .*\.spec\.ts$` → new Vitest files must be `*.vitest.test.ts` (invisible to Jest). Split: `src/**/*.vitest.test.ts` = unit, `test/**/*.vitest.test.ts` = integration.
- `packages/auth/src/index.ts`: `requireEmailVerification: false`, `autoSignIn: true`; sign-up on `/sign-up/email` **requires `privacyPolicyAcceptedAt`**; MX email check skipped only when `NODE_ENV === 'test'`; better-auth rate limit 10/min outside development — keep auth calls per integration file ≤ ~8.
- Escrow `fund()` with `paymentMethod: 'paypal' | 'local'` is fully simulated (no Stripe) → integration lifecycle test needs no Stripe keys.
- Scoring formulas are specified in `docs/recommendation-scoring-panel2-formulas.png`: reputation `wᵢ=0.5^(ageᵢ/H)`, `R=(C·m+Σwᵢrᵢ)/(C+Σwᵢ)`, `score=(R−1)/4`; proximity `clamp(1−d/radius,0,1)` (haversine); completion `(C·p+completed)/(C+n)` over 90d; response `clamp(1−(t−Tg)/(Tp−Tg),0,1)`; composite `0.35·rep+0.30·prox+0.20·comp+0.15·resp` + verified boost capped at 1.
- `packages/validation` already has a `test` script (`vitest --passWithNoTests`) and a `test` block in its `vite.config.ts`.
- Seeded ServiceCategory slugs (for the eval dataset & fixtures): plumbing, electrical, carpentry, painting, masonry, cleaning, handyman, furniture-assembly, mounting, appliances, air-conditioning, gardening, moving, roofing (see `packages/db/prisma/seed.ts`).
- `post-job-form.tsx` uses labelled inputs (`#title`, `#description`, `#city`, …) → `getByLabel()` works in Playwright.
- ai-service confidence gate: `CONFIDENCE_ACCEPT_THRESHOLD = 0.7`, `MAX_CLASSIFICATION_ATTEMPTS = 2` in `apps/ai-service/app/graphs/classification/nodes.py`; normalizer in `app/domain/classification/normalizer.py`; JWT in `app/core/auth.py` (PyJWKClient, `lru_cache`d aud/iss helpers — clear caches in test fixtures).

## Commit sequence

### 1. `test(validation): unit tests for quote totals, deposit tiers and schema edge cases`

New: `packages/validation/src/quote-totals.test.ts`, `deposit.test.ts`, `schemas.test.ts`.
Modify: `packages/validation/package.json` (explicit `vitest` + `@vitest/coverage-v8` devDeps matching root major; `test` → `vitest run`); `vite.config.ts` (add `coverage: { provider: 'v8', reporter: ['text','lcov'], include: ['src/**'], exclude: ['src/**/*.test.ts'] }`).

Cases — `computeQuoteTotals`: empty lines → all 0; labour/material bucket split; qty×unitPrice; calloutFee (undefined → 0); discount subtracted with **floor at 0** (vat/total also 0); VAT 18% applied after discount; applyVat false/undefined → 0; NaN qty treated as 0. `depositTier`/`maxDeposit`: unverified → none/0; verified 20%/15 000; trusted boundary (4.5 & 20 vs 4.49/19); background boundary (bgChecked & 4.7 & 50); cap by tier cap and by materialsAmount; never negative. Zod: `CreateJobSchema` budget refine + path, title min, lat/lng bounds, coercion; `CreateQuoteSchema` min-1 line, defaults; `FundEscrowSchema` card-requires-paymentMethodId superRefine.

Verify: `pnpm nx run validation:test && pnpm nx run validation:lint && pnpm nx run validation:build`

### 2. `chore(backend): wire vitest into scripts and Nx (unit/integration split, coverage)`

- `apps/backend/vitest.config.ts` → unit config: `include: ['src/**/*.vitest.test.ts']`, `passWithNoTests: true`, coverage v8 (`reportsDirectory: 'coverage-vitest'`, exclude spec/test files, `dto/**`, `*.module.ts`, `main.ts`, config).
- New `apps/backend/vitest.integration.config.ts`: same swc/alias, `include: ['test/**/*.vitest.test.ts']`, `fileParallelism: false`, `pool: 'forks'` + `singleFork: true`, `testTimeout: 30_000`.
- `apps/backend/package.json` scripts: `test:vitest`, `test:vitest:cov`, `test:integration` (all `dotenv -e .env.test -- vitest run …`).
- `apps/backend/project.json`: `test` target becomes run-commands `[jest, vitest run]` sequential (CI-safe, unit only); new `test-integration` target (not named `test` → CI never runs it, `cache: false`); new `test-cov` target (jest --coverage + vitest --coverage, outputs both coverage dirs).
- Fix `apps/backend/test/auth-password-reset.vitest.test.ts`: add `privacyPolicyAcceptedAt: new Date().toISOString()` to the sign-up body.
- Prune `apps/backend/test/app.e2e-spec.ts`: drop legacy e-commerce describes (`/products`, `/cart`, `/orders`, `/wishlist`) — verify each endpoint truly no longer exists before deleting its block.

Verify: `pnpm nx run backend:test` (jest green + vitest no-tests green), `pnpm nx run backend:test-integration` (password-reset passes), `pnpm nx run backend:build`, lint.

### 3. `test(backend): quotes service unit tests (vitest, mocked prisma)`

New: `apps/backend/src/quotes/quotes.service.vitest.test.ts` — mock Prisma in the style of `escrow.service.spec.ts` (`vi.fn()`s, `$transaction: fn => fn(tx)`), instantiate service directly.

Cases — `create`: job 404; own job → Forbidden; non-OPEN → Conflict; HOMEOWNER userType → Forbidden; null userType → sets TRADESMAN; duplicate quote → Conflict; **server-side totals** (labour 2×5000 + material 1×3000 + callout 500 − discount 500, VAT → amount 15340, materialsAmount 3000, vatRate 18); deposit above `maxDeposit` → BadRequest (unverified + verified-over-cap variants); deposit within cap passes; `validUntil ≈ now + validityDays` (tolerance). `accept`: non-owner/non-OPEN/non-PENDING guards; happy path (other quotes rejected, job ASSIGNED, `jobEscrow.create` with deposit/balance); no deposit → no escrow. `reject`/`withdraw`: authz + state guards + happy paths.

Optional same commit: `src/escrow/escrow.service.lifecycle.vitest.test.ts` for `markWorkDone` (untested: tradesman-only, FUNDED/MATERIALS_RELEASED-only, sets workCompletedAt).

Verify: `pnpm nx run backend:test`, lint.

### 4. `feat(recommendations): pure scoring module with weighted composite`

New under `apps/backend/src/recommendations/scoring/`: `config.ts` (SCORING_CONFIG: weights 0.35/0.30/0.20/0.15, reputation prior m=4.0/C=5/H=180d, completion p=0.9/C=5/90d window, response Tg=30min/Tp=1440min/missing=0.5, verifiedBoost 0.05), `proximity.ts` (haversineKm + proximityScore, null coords/radius≤0 → 0), `reputation.ts` (takes pre-shaped `{rating, ageDays}[]` — clock-free), `completion.ts`, `response.ts`, `composite.ts` (returns score + per-factor breakdown + boost, capped at 1), `index.ts` barrel. Pure functions, no Nest/Prisma imports; `RecommendationsService` untouched. Use `.js` ESM import suffixes.

New: `apps/backend/src/recommendations/scoring/scoring.vitest.test.ts` — weights sum to 1; haversine Colombo→Kandy ≈ 94 km; proximity identical coords → 1, d≥radius → 0, d=radius/2 → 0.5, null → 0; reputation zero-history → exactly `(m−1)/4`, recency damping, monotone in rating; completion zero-history → p, cancellations reduce, ∈[0,1]; response t≤Tg → 1, t=Tp → 0, midpoint 0.5, null → 0.5; composite all-1s verified stays 1 (cap), 0.9s + boost = 0.95, breakdown sums to score; determinism (same input twice → identical).

Verify: `pnpm nx run backend:test && pnpm nx run backend:build && pnpm nx run backend:lint`.

### 5. `fix(recommendations): restrict job recommendations to the job owner`

Modify `recommendations.service.ts`: `getJobRecommendations(userId, jobId, take=8)` — `job.findUnique` → 404 if missing, Forbidden if `homeownerId !== userId` (mirror `QuotesService.listForJob`). Modify `recommendations.controller.ts`: add current-user param (see how other controllers get the session user — e.g. quotes controller) and pass through.

New: `src/recommendations/recommendations.service.vitest.test.ts` — 404 / 403 / owner happy path (findMany with rank asc, take 8).

Verify: `pnpm nx run backend:test && pnpm nx run backend:build`. No frontend consumer exists.

### 6. `test(backend): integration tests for job→quote→escrow and recommendations authz`

New: `apps/backend/test/job-quote-escrow.integration.vitest.test.ts` — bootstrap copied from `auth-password-reset.vitest.test.ts` (mock resend, real AppModule, `setGlobalPrefix('api/v1', { exclude: ['api/auth/{*path}'] })`, real PrismaClient via `createDbAdapter()`). Auth helper: sign-up (with `privacyPolicyAcceptedAt`) + sign-in via supertest, reuse the returned cookies. Unique run suffix in emails. Fixtures: create `tradesmanProfile` (isVerified, avgRating 4.6, jobsCompleted 25) via prisma for deposit headroom.

Sequence: homeowner posts job (201, OPEN) → tradesman quotes (assert server-computed amount/materialsAmount) → `GET jobs/:id/quotes` as tradesman → 403, as owner → 200 → unverified tradesman quoting with any deposit → 400 → owner accepts → assert via prisma: job ASSIGNED, escrow REQUESTED with correct deposit/balance → fund with `paymentMethod: 'paypal'` → FUNDED → tradesman marks work done → owner approves → RELEASED (check `escrow.controller.ts` for exact routes) → unauthenticated job post → 401.

`afterAll`: `user.deleteMany({ email: { contains: run } })` (cascades), `verification.deleteMany`, disconnect, close.

New: `apps/backend/test/recommendations-authz.integration.vitest.test.ts` — owner → 200 `[]`, non-owner → 403, unauthenticated → 401.

Verify: `pnpm nx run backend:test-integration` **twice in a row** (idempotence proves self-cleaning).

### 7. `test(e2e): playwright golden journey with storage-state auth (chromium)`

- `apps/frontend/playwright.config.ts`: chromium only; `webServer` → array of backend (`pnpm nx run backend:dev`, health URL — verify the actual route in `apps/backend/src/health` first) + frontend only; `globalSetup: './e2e/global-setup.ts'`; `reuseExistingServer: true`.
- New `apps/frontend/e2e/global-setup.ts`: API sign-up/sign-in through the Next origin proxy (`http://localhost:3000/api/auth/...`) for a homeowner and a tradesman (gmail-domain emails — MX check is live under NODE_ENV=development); save `storageState` to `e2e/.auth/*.json`; gitignore `e2e/.auth/`.
- Delete `apps/frontend/e2e/example.spec.ts` (stale scaffold).
- New `apps/frontend/e2e/golden-journey.spec.ts` (`describe.serial`, homeowner storageState): post job at `/en/jobs/new` via `getByLabel` → capture jobId from redirect → tradesman submits quote **via API request context** (no dual browser session) → homeowner reloads detail, sees quote, accepts → job shows Assigned.
- New `apps/frontend/e2e/fund-page.spec.ts` gated by `test.skip(!process.env.E2E_SEEDED)`: seeded verified tradesman (`kasun@example.com` / seed password — confirm in `packages/db/prisma/seed-users.ts`) quotes with deposit → accept → `/en/jobs/[id]/fund` renders deposit summary.
- `apps/frontend/project.json`: add `e2e` run-commands target (`playwright test`, cwd apps/frontend, no cache). **Not** wired into CI.

Verify: `pnpm nx run frontend:e2e` with servers running, then cold; `pnpm nx run frontend:lint`.

### 8. `test(ai): unit tests for normalizer, confidence gate and jwt verification + pytest-cov`

- `apps/ai-service/pyproject.toml`: add `pytest-cov` dev dep; `addopts = "--cov=app --cov-report=term-missing --cov-report=xml"`. Reinstall venv deps (`.venv\Scripts\python.exe -m pip install -e .[dev]`).
- `apps/ai-service/project.json`: add `coverage.xml` to test outputs.
- New `tests/test_normalizer.py`: invalid category slug → None; valid preserved; unknown skill dropped; category-mismatched skill dropped (None-category skill kept); dedupe preserving order; 5-skill cap; nothing-survives → confidence 0; blank reasoning default.
- New `tests/test_confidence_gate.py`: no parsed → END; attempts ≥ 2 → END; ≥0.7 + category → END; 0.5 → retry with hint (prev slug + formatted confidence); high confidence but null category → retry; `extract_json_block` fenced/prose/no-braces fallback.
- New `tests/test_auth.py`: generate keypair with `cryptography`, stub the JWKS client via monkeypatch, clear `lru_cache`d aud/iss helpers per test; valid → TokenPayload; expired/wrong-aud/wrong-iss/missing-sub → 401; missing env → RuntimeError.

Verify: `pnpm nx run ai-service:test && pnpm nx run ai-service:lint`.

### 9. `feat(ai): labelled classification eval dataset and metrics harness`

New under `apps/ai-service/evals/`: `__init__.py`; `dataset/taxonomy.json` (snapshot of seeded 14 categories + skills in TaxonomyOption shape); `dataset/classification_labelled.json` (~45 items: ~30 EN, ~8 SI, ~7 TA; every category ≥2×; 3–4 deliberately ambiguous); `run_classification_eval.py` (CLI `--limit/--out`; calls the real classification service entry point the routes use; pure-python precision/recall/F1 per category + macro/micro, confusion matrix, confidence-decile calibration, skill Jaccard; writes timestamped CSV + JSON to `evals/results/`); `README.md` (run instructions, env, cost, how to cite). Gitignore `evals/results/`. Extend ai-service lint target to include `evals`.

Verify: `pnpm nx run ai-service:lint`; if an API key is available in `.env`, dry-run `--limit 3`.

### 10. `ci: coverage targets and artifact upload`

- `packages/validation/project.json` (or package.json script): `test-cov` target `vitest run --coverage`.
- Root `package.json`: `test:cov` script running backend/validation `test-cov` + ai-service test.
- `.github/workflows/ci.yml`: after the test step on the Windows job, add `actions/upload-artifact@v4` (`if: always()`, `if-no-files-found: ignore`) for `apps/backend/coverage`, `apps/backend/coverage-vitest`, `packages/validation/coverage`, `apps/ai-service/coverage.xml`. Keep the CI test step as plain `affected:test` (fast); pytest addopts means `coverage.xml` is always produced.

Verify: `pnpm test:cov` locally completes and emits reports.

### 11. `docs: testing strategy, SUS protocol and acceptance criteria matrix`

- `docs/TESTING_STRATEGY.md` — the **corrected** strategy: layer → runner → location → CI status table (Jest legacy unit / Vitest unit / Vitest integration on Neon / Playwright manual / pytest+cov / manual eval harness); ADR note on Neon-instead-of-Testcontainers (rationale, consequences, mitigations); scoring module built now, engine wiring Sprint 3; updated TC-01..TC-18 statuses (TC-11/12 now wired; TC-14 quote-total and TC-15 recommendation-403 now Pass; TC-16 still blocked on backend classify wiring; TC-17 partially covered by golden journey); known feature gaps (no backend classify-job call, no recommendations UI, Stripe card path unit-only).
- `docs/SUS_PROTOCOL.md` — n≥10 across both roles, fixed task script, consent + anonymisation, 10-item SUS questionnaire, 0–100 scoring, target ≥70, capture task success/time/friction.
- `docs/ACCEPTANCE_CRITERIA.md` — FR-1..FR-12 → Given/When/Then → verifying artifact (test file / e2e spec / manual) → status; AC-5 (FR-6 recommendations) marked deferred to Sprint 3.

Verify: prettier via lint-staged on commit; commitlint header ≤150.

## Risks / notes

- If `.env.test` sets NODE_ENV so the 10/min auth rate limit applies, keep sign-ups ≤8 per integration file; failure mode is 429.
- Vitest major-version skew between root and backend — don't unify in this branch; match each package's existing version.
- Playwright health-check URL and escrow route paths must be read from source before use (don't guess).
- e2e accounts accumulate in the dev DB (gmail-alias emails) — acceptable; note in the e2e README/comment.
- Never commit `.env*`; the eval harness reads keys from the ai-service `.env`.

## Final verification (whole branch)

1. `pnpm build` and `pnpm test` (workspace) — green.
2. `pnpm nx run backend:test-integration` twice — green both times.
3. `pnpm nx run frontend:e2e` — golden journey passes against local stack.
4. `pnpm test:cov` — coverage reports emitted for backend (both runners), validation, ai-service.
5. `pnpm lint` — green.
