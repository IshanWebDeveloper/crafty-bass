# Frontend Agent Guide

This file is the frontend-specific supplement for `apps/frontend`. Read the root `AGENTS.md` first, then use this guide before changing frontend code.

<!-- BEGIN:nextjs-agent-rules -->

## This Is Not The Next.js You Know

The frontend package currently uses Next.js `16.1.6`, React `19.2.3`, and React DOM `19.2.3`. This stack has breaking changes from older Next.js and React versions that may be present in model training data.

Before changing routing, data fetching, metadata, caching, server actions, or config behavior, read the relevant local docs in `node_modules/next/dist/docs/` and heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Current Stack

- Next.js App Router with TypeScript.
- Tailwind CSS v4 through `@tailwindcss/postcss`.
- shadcn-style primitives live in `packages/ui` and are consumed through `@repo/ui`.
- Theme switching uses `next-themes` through the shared `@repo/ui` provider/toggle.
- Icons should use existing React icon packages when possible, especially `lucide-react` and `@tabler/icons-react`.
- Common UI utilities live in `@repo/ui`.

## Current Structure

- `src/app/` contains route entry files, global styles, and App Router layout files.
- `src/components/` contains app-specific frontend components when needed.
- Shared primitives such as `button`, `dropdown-menu`, `checkbox`, theme provider, and mode toggle live in `packages/ui`.
- Path alias `@/*` maps to `src/*`.

Keep route files thin. Put reusable UI in `src/components`, feature-specific UI in feature folders when it grows, and only add client boundaries where interactivity requires them.

## Styling And Tokens

- Global CSS and Tailwind theme aliases live in `src/app/globals.css`.
- Use semantic CSS variables and Tailwind token-backed utilities before adding one-off literal values.
- Keep light and dark values together: base values in `:root`, dark values in `.dark`.
- Use the existing `cn` helper from `@repo/ui` for conditional class composition.
- Avoid adding CSS-in-JS, CSS Modules, or another styling system unless there is a specific architectural reason.

## Assets And Icons

- Static files belong in `apps/frontend/public`.
- Use `next/image` for raster images and important static media.
- Prefer React icon components from installed icon libraries over adding one-off SVG files.
- If importing Figma-exported assets, use descriptive kebab-case names and group new icons under `public/icons` when the set grows.

## Figma-To-Code Workflow

For Figma-derived work:

1. Pull the Figma design context and screenshot before coding.
2. Identify reusable color, typography, spacing, radius, and shadow tokens.
3. Update `src/app/globals.css` tokens before building component markup.
4. Build or reuse primitives in `packages/ui/src/components/ui` before composing full screens.
5. Keep page files as orchestration; move substantial UI into components.
6. Implement responsive behavior with Tailwind breakpoints.
7. Validate semantic HTML, labels, alt text, keyboard focus, contrast, and mobile/desktop layouts.

Definition of done for frontend UI:

- Uses existing primitives and token-backed styling where practical.
- Keeps server and client component boundaries explicit.
- Avoids large repeated JSX trees in route files.
- Builds cleanly and passes the most relevant available check.
