# Figma MCP Design Implementation Plan

## Goal

Integrate Figma designs into the Crafty Bass frontend with consistent tokens, reusable components, and predictable delivery quality using Model Context Protocol workflows.

## Inputs

- Figma node/page context retrieved via MCP design tools.
- Existing frontend stack and constraints from `apps/frontend/CLAUDE.md`.
- Existing app structure under `apps/frontend/src/app`.

## Constraints From Current Codebase

- Frontend currently contains route-level scaffold files only (`layout.tsx`, `page.tsx`, `globals.css`).
- Styling is Tailwind CSS v4 + global CSS custom properties.
- No Storybook or dedicated component library exists yet.
- No token build pipeline (Style Dictionary/Theo) is present.

## Delivery Phases

### Phase 1: Foundation Hardening

1. Expand design tokens in `apps/frontend/src/app/globals.css` with semantic naming:
   - color (`--color-surface`, `--color-text-primary`, etc.)
   - spacing (`--space-1` ... `--space-12`)
   - radius (`--radius-sm`, `--radius-md`, etc.)
   - elevation/shadow
2. Keep `@theme inline` aliases in sync so Tailwind utility classes can consume the same tokens.
3. Add a lightweight token usage guide section in `apps/frontend/CLAUDE.md`.

Exit criteria:

- New semantic tokens exist for all core Figma primitives.
- Light/dark behavior is explicitly defined.

### Phase 2: Component Architecture Setup

1. Create base folders:
   - `apps/frontend/src/components/ui`
   - `apps/frontend/src/components/layout`
   - `apps/frontend/src/features`
2. Extract reusable primitives from route-level JSX:
   - button
   - input
   - card
   - badge/chip
   - section container
3. Keep route files (`src/app/*`) orchestration-only.

Exit criteria:

- Route files no longer contain large repeated UI trees.
- At least one feature uses shared UI primitives.

### Phase 3: Asset + Icon Pipeline

1. Introduce folders:
   - `apps/frontend/public/images`
   - `apps/frontend/public/icons`
2. Enforce naming conventions:
   - images: `{feature}-{purpose}.(png|jpg|svg|webp)`
   - icons: `ic-{domain}-{name}-{size}.svg`
3. Use `next/image` for raster images and static illustration assets.

Exit criteria:

- Assets are grouped by intent and no longer mixed at root public for new work.
- Icon naming is consistent for all newly imported icons.

### Phase 4: Figma-to-Code Workflow Standardization

For each screen/component handoff:

1. Retrieve Figma design context with MCP.
2. Extract and map:
   - typography scale
   - spacing/radius/shadows
   - color roles
   - component states (default/hover/focus/disabled)
3. Check token coverage:
   - if token exists -> reuse
   - if missing -> add semantic token first
4. Build component using Tailwind utilities + token-backed classes.
5. Validate accessibility (landmarks, labels, focus ring, contrast).
6. Validate responsiveness for mobile/tablet/desktop breakpoints.

Exit criteria:

- Every delivered component references tokens, not arbitrary values.
- Accessibility and responsive checks are completed before merge.

### Phase 5: Core Journey Screens

Implement in this order:

1. Auth and account entry
2. Homeowner job posting flow
3. Tradesman listing and recommendation cards
4. Quote comparison and acceptance view
5. Conversation/message interface
6. Review and trust indicators

Exit criteria:

- Main marketplace journeys are represented with production-ready UI skeletons.

### Phase 6: Quality Gates

1. Add/expand frontend e2e scenarios (Playwright):
   - navigation and route rendering
   - responsive smoke checks
   - critical form flow submission
2. Add visual acceptance checklist to PR template (or team checklist document).
3. Validate lint/build consistency via Nx targets.

Exit criteria:

- Key user journeys pass automated checks.
- Design parity issues are tracked and reduced each iteration.

## Definition of Done for Any Figma Handoff

- Uses semantic tokens from `globals.css`.
- Uses reusable components where possible.
- Includes responsive variants.
- Meets minimum accessibility checks.
- Avoids introducing new styling paradigms.
- Builds and lints successfully in the Nx workflow.

## Suggested Backlog Sequencing

1. Token expansion
2. Primitive components
3. Assets/icons normalization
4. First journey (job posting)
5. Recommendation card + list views
6. Messaging/reviews views
