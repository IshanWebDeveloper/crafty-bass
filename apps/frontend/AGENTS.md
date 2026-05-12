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
- shadcn-style primitives and Tailwind integration through `shadcn` and `shadcn/tailwind.css`.
- Theme switching via `next-themes` and `src/components/theme-provider.tsx`.
- Icons should use existing React icon packages when possible, especially `lucide-react` and `@tabler/icons-react`.
- Common utilities live in `src/lib/utils.ts`.

## Current Structure

- `src/app/` contains route entry files, global styles, and App Router layout files.
- `src/components/` contains shared frontend components.
- `src/components/ui/` contains reusable UI primitives such as `button` and `dropdown-menu`.
- `src/components/theme-provider.tsx` owns theme provider setup.
- `src/components/mode-toggle.tsx` owns the theme toggle UI.
- Path alias `@/*` maps to `src/*`.

Keep route files thin. Put reusable UI in `src/components`, feature-specific UI in feature folders when it grows, and only add client boundaries where interactivity requires them.

## Styling And Tokens

- Global CSS and Tailwind theme aliases live in `src/app/globals.css`.
- Use semantic CSS variables and Tailwind token-backed utilities before adding one-off literal values.
- Keep light and dark values together: base values in `:root`, dark values in `.dark`.
- Use the existing `cn` helper from `src/lib/utils.ts` for conditional class composition.
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
4. Build or reuse primitives in `src/components/ui` before composing full screens.
5. Keep page files as orchestration; move substantial UI into components.
6. Implement responsive behavior with Tailwind breakpoints.
7. Validate semantic HTML, labels, alt text, keyboard focus, contrast, and mobile/desktop layouts.

Definition of done for frontend UI:

- Uses existing primitives and token-backed styling where practical.
- Keeps server and client component boundaries explicit.
- Avoids large repeated JSX trees in route files.
- Builds cleanly and passes the most relevant available check.
