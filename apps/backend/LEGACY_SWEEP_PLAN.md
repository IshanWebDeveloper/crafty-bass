# Backend legacy-module sweep plan

The Prisma schema describes a tradesman/homeowner marketplace. `apps/backend/src` still ships nine NestJS modules from the previous e-commerce build. This plan removes them safely.

## Inventory (as of 2026-06-07)

```
apps/backend/src/
├── admin/              # mixed — keep, partial rewrite (uses legacy + new)
├── auth-access.ts      # legacy RBAC statements (product/cart/order/coupon/…)
├── cart/               # legacy — delete
├── categories/         # repurpose for ServiceCategory
├── common/             # keep (prisma, guards, pipes, filters, utils)
├── consent/            # keep — already marketplace-aligned (UserConsent)
├── legal/              # keep
├── notifications/      # legacy — delete (no Notification model in new schema)
├── orders/             # legacy — delete (replaced by Job + Quote)
├── payments/           # legacy — delete; will be rebuilt for Stripe Connect payouts
├── products/           # legacy — delete
├── promotions/         # legacy — delete
├── recommendations/    # legacy core, but JobRecommendation model exists — rewrite
├── reviews/            # rewrite against marketplace Review model
├── support/            # legacy ticket system — delete; future help-desk via Conversation+Report
├── tax-rates/          # legacy — delete
├── users/              # keep; trim profile dashboard's legacy queries
└── wishlist/           # legacy — delete
```

## Untangle order (Phase A — must run before any deletion)

A deletion now would break the build because legacy modules are wired into `app.module.ts`, `users.module.ts`, and `orders.module.ts`, and several legacy services are dependencies of code we want to keep.

| #   | Action                                                                                                                                                                                                                                                                                                           | Files                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A.1 | Strip legacy queries from the user profile dashboard. Replace `prisma.order` + `prisma.wishlist` lookups with marketplace equivalents (`postedJobs`, `assignedJobs`, `reviewsReceived`, `quotes`).                                                                                                               | `users/users.service.ts` (lines 74, 88, 114–118)                                                                                                                              |
| A.2 | Stop injecting `RecommendationsService` and `PromotionsService` into `UsersService`. Replace the recommendations/promotions touch-points with placeholder stubs or remove them entirely.                                                                                                                         | `users/users.module.ts`, `users/users.service.ts`                                                                                                                             |
| A.3 | Drop `PromotionsModule` import from `orders/orders.module.ts` (file is going away in Phase B but the import would block a clean intermediate state).                                                                                                                                                             | `orders/orders.module.ts`                                                                                                                                                     |
| A.4 | Rewrite `auth-access.ts`: replace `product/category/cart/order/coupon/payments/review/ticket` statements with marketplace ones (`job`, `quote`, `profile`, `message`, `report`, `review`, `recommendation`, `user`). Roles become `HOMEOWNER`, `TRADESMAN`, `SUPPORT`, `ADMIN` derived from `Role` + `UserType`. | `auth-access.ts`                                                                                                                                                              |
| A.5 | Audit `admin/` for legacy DB references; either rewrite to marketplace equivalents or temporarily comment out the admin endpoints that depend on deleted models. Keep `S3Service` and `PdfService` (still used by the GDPR export flow).                                                                         | `admin/admin.service.ts`, `admin/admin-catalog.service.ts`, `admin/admin-reviews.controller.ts`, `admin/report.processor.ts`, `admin/pdf.service.ts`, `admin/admin.module.ts` |
| A.6 | Audit `data-retention.cron.ts` for legacy model references and rewrite to operate on marketplace models (`Job`, `Quote`, `Message`, `Report`, etc.).                                                                                                                                                             | `common/cron/data-retention.cron.ts`                                                                                                                                          |
| A.7 | Audit `notifications/`. If retained, narrow it to the marketplace surface (no `Notification` model exists; would need a new schema model or to be deleted). Recommended: delete in Phase B and have features email/in-app-event directly.                                                                        | `notifications/`                                                                                                                                                              |
| A.8 | Audit `recommendations/`. Replace `orderItem`/`product` queries with `JobRecommendation` queries against the existing model. Keep the module.                                                                                                                                                                    | `recommendations/recommendations.service.ts`                                                                                                                                  |

Exit criterion for Phase A: `pnpm --filter backend build` succeeds with the legacy module imports removed from `app.module.ts` but legacy folders still present.

## Deletion order (Phase B)

Delete leaf modules first so each step compiles. Commit one module per commit so a bad delete is a single `git revert`.

| #   | Module           | Notes                                                     |
| --- | ---------------- | --------------------------------------------------------- |
| B.1 | `cart/`          | No upstream dependency once Phase A is done.              |
| B.2 | `wishlist/`      | Same.                                                     |
| B.3 | `tax-rates/`     | Same.                                                     |
| B.4 | `promotions/`    | Depends on Phase A.2 + A.3 being done.                    |
| B.5 | `orders/`        | Depends on Phase A.3.                                     |
| B.6 | `products/`      | Depends on Phase A.5 (admin-catalog references products). |
| B.7 | `payments/`      | Standalone once Phase A.5 is done.                        |
| B.8 | `support/`       | Standalone.                                               |
| B.9 | `notifications/` | If Phase A.7 chose to delete.                             |

Delete the corresponding tests in `apps/backend/test/` (e2e specs) and `apps/backend/src/**/*.spec.ts` as their modules go.

## Build-out order (Phase C — out of scope for this sweep)

Once Phase B is complete the backend has a small surface: `users`, `categories`, `reviews`, `recommendations`, `consent`, `legal`, `admin` (trimmed), `common`. Phase C adds the marketplace modules:

- `profiles/` — HomeownerProfile + TradesmanProfile CRUD
- `jobs/` — Job lifecycle (OPEN → ASSIGNED → IN_PROGRESS → COMPLETED/CANCELLED/EXPIRED)
- `quotes/` — Quote CRUD with state machine
- `conversations/` + `messages/` — chat threads
- `reports/` — moderation
- `categories/` rewrite to ServiceCategory
- `reviews/` rewrite to marketplace Review

Out of scope here. Each gets its own design + PR.

## Polish (Phase D)

- `apps/backend/src/main.ts` — Swagger title currently `"StreetGadgetz E-Commerce API"`.
- `apps/ai-service/pyproject.toml` — description still references Ollama.
- Root `README.md` Phase 1 — mark legacy sweep complete.
- `CLAUDE.md` — remove the "Where the docs/code lie" section once those lies are gone.

## Risks and exits

- **CI is gated on `pnpm build` + `pnpm test`** on the self-hosted Windows runner. The runner is offline for PRs from forks (guarded by the commit landed earlier in this branch), but every push to a branch with an open same-repo PR triggers it. Aim to keep each commit individually buildable.
- **`apps/backend/test/auth-password-reset.vitest.test.ts`** must keep passing — it doesn't depend on legacy modules but does depend on `auth.ts`, which is touched in Phase A.4.
- **Prisma migrations** — none created here. If a Phase C model needs schema tweaks, that's a separate change.
- **`shared-types` regen** — schema is unchanged in this sweep, so `pnpm prisma:generate:all` shouldn't be necessary. If it is, the hash stamp will fail CI.

## Checkpoints

After each phase, run `pnpm --filter backend build && pnpm --filter backend lint`. After Phase A and after the last Phase B commit, run the full `pnpm test`.
