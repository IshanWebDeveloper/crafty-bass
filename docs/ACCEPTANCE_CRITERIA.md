# Acceptance criteria matrix

Functional requirements expressed as Given/When/Then acceptance criteria, each
mapped to the artifact that verifies it and its current status. "Verified by"
names an automated test where one exists, otherwise the manual method.

| ID | Requirement | Given / When / Then | Verified by | Status |
| --- | --- | --- | --- | --- |
| AC-1 | FR-1 Authentication & password reset | **Given** a registered user, **when** they request a password reset and use the emailed token, **then** they can sign in with the new password. | `auth-password-reset.vitest.test.ts` (integration) | Pass |
| AC-2 | FR-2 Homeowner posts a job | **Given** a signed-in homeowner, **when** they submit a valid job, **then** a job is created with status `OPEN` and they are recorded as the owner. | `job-quote-escrow.integration.vitest.test.ts`, `golden-journey.spec.ts` | Pass |
| AC-3 | FR-3 Tradesman submits a quote | **Given** an open job, **when** a tradesman quotes with line items, **then** the total, materials amount and VAT are computed server-side (client maths is ignored). | `quotes.service.vitest.test.ts`, `job-quote-escrow.integration.vitest.test.ts` | Pass |
| AC-4 | FR-4 Quote acceptance assigns the job | **Given** an open job with a pending quote, **when** the owner accepts it, **then** the job becomes `ASSIGNED`, other quotes are rejected, and a deposit escrow is created when one was requested. | `quotes.service.vitest.test.ts`, integration test | Pass |
| AC-5 | FR-5 Materials escrow lifecycle | **Given** an accepted deposit quote, **when** the homeowner funds it and the tradesman releases materials and marks work done and the homeowner approves, **then** the escrow moves REQUESTED → FUNDED → MATERIALS_RELEASED → WORK_COMPLETED → RELEASED. | `job-quote-escrow.integration.vitest.test.ts`, `escrow.service.lifecycle.vitest.test.ts` | Pass |
| AC-6 | FR-6 Tradesman recommendations for a job | **Given** a job, **when** the owner requests recommendations, **then** tradesmen are ranked by the weighted composite score. | Scoring: `scoring/scoring.vitest.test.ts`; ranking engine — **deferred to Sprint 3** | Deferred (scoring done; engine + UI later) |
| AC-7 | FR-7 Quote visibility restricted to owner | **Given** a job with quotes, **when** a non-owner requests the quote list, **then** the request is rejected (403); the owner gets 200. | `job-quote-escrow.integration.vitest.test.ts` | Pass |
| AC-8 | FR-8 Deposit within trust tier | **Given** a tradesman's verification tier, **when** they request a materials deposit, **then** a deposit above their allowed maximum (capped by tier and by the materials line) is rejected. | `deposit.test.ts`, `quotes.service.vitest.test.ts`, integration test | Pass |
| AC-9 | FR-9 Recommendation access control | **Given** an unauthenticated caller, **when** they request a job's recommendations, **then** they get 401; a signed-in non-owner gets 403. | `recommendations.service.vitest.test.ts`, `recommendations-authz.integration.vitest.test.ts` | Pass |
| AC-10 | FR-10 Multilingual job classification quality | **Given** labelled EN/SI/TA jobs, **when** the classifier runs, **then** category F1, skill Jaccard and confidence calibration are measured. | `evals/run_classification_eval.py` (manual, needs LLM key); normalizer/gate units in `tests/` | Harness ready + units Pass |
| AC-11 | FR-11 Role-based access control | **Given** protected/admin endpoints, **when** called without a session, **then** they return 401. | `app.e2e-spec.ts` (Jest e2e) | Pass |
| AC-12 | FR-12 Automatic job classification on posting | **Given** a posted job, **when** it is saved, **then** the AI service classifies it into a category/skills. | — (backend integrates AI only for translation) | Not implemented — feature gap |

## Notes

- **AC-6** is deferred: the pure scoring functions are implemented and unit
  tested now, but the DB-backed ranking engine that populates
  `JobRecommendation` and a UI to display recommendations are a later sprint.
- **AC-12** is a known feature gap: the backend calls the AI service for
  translation but does not yet call `classify-job` when a job is posted.
- The escrow lifecycle (AC-5) is verified with the fully-simulated
  `paypal`/`local` funding path; the Stripe card/3DS path is covered separately
  by mocked unit tests (`escrow.service.spec.ts`).
