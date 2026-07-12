# Crafty Bass — Frontend

The web UI for **Crafty Bass**, a tradesman/homeowner marketplace. Built with the
Next.js 16 App Router and consumed from the Nx + pnpm monorepo at the repo root.

## Stack

- **Next.js 16** (App Router) + **React 19**, TypeScript.
- **Tailwind CSS v4** via `@tailwindcss/postcss`; design tokens live in `src/app/globals.css`.
- Shared UI primitives from **`@repo/ui`** (wrapping [base-ui](https://base-ui.com), not Radix);
  theming via `next-themes` + the `@repo/ui` provider/toggle.
- **TanStack Query** for server state, **React Hook Form** + **Zod** for forms,
  **better-auth** client for auth, **axios** for the data client.
- Icons: `lucide-react` / `@tabler/icons-react`.
- Path alias `@/*` → `src/*`.

## Getting started

Install dependencies from the **repo root** (this is a workspace, not a standalone app):

```bash
pnpm install
```

Run the dev server (frontend only):

```bash
pnpm nx run frontend:dev
# or, for the whole stack (frontend + backend + ai-service):
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Backend proxy & auth

The browser only ever talks to the Next.js origin. `/api/*` is rewritten to the
backend (default `http://localhost:3005`, override with `API_PROXY_TARGET`), so the
better-auth session cookie is set first-party and auth guards run server-side. Start
the backend (`pnpm nx run backend:dev`) for data and auth to work locally.

## Scripts

Run via `pnpm nx run frontend:<target>` from the root, or `pnpm <script>` inside `apps/frontend`:

| Script  | Description                               |
| ------- | ----------------------------------------- |
| `dev`   | Start the Next.js dev server on port 3000 |
| `build` | Production build (output in `dist/`)      |
| `start` | Serve the production build                |
| `lint`  | ESLint over the app                       |
| `test`  | No-op — unit tests are not configured yet |

### End-to-end tests

Playwright is configured (`playwright.config.ts` + `e2e/`), exposed as an Nx target:

```bash
pnpm nx run frontend:e2e
```

## Project structure

- `src/app/` — App Router routes, `layout.tsx`, and `globals.css` (tokens + `@theme inline` aliases).
- `src/components/` — feature and composed UI (shared primitives come from `@repo/ui`).
- `public/` — static assets.
