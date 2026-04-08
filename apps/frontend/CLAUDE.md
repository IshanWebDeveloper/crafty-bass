@AGENTS.md

# Figma MCP Integration Rules For Crafty-Bass Frontend

This document captures the current codebase reality and defines implementation rules for converting Figma designs into production code.

Scope:

- Frontend app at apps/frontend
- App Router (Next.js)
- Tailwind CSS v4 + global CSS variables

Companion implementation plan:

- apps/frontend/FIGMA_DESIGN_PLAN.md

Audit date:

- 2026-04-08

## 0. Current Baseline Snapshot

- UI surface is currently minimal and scaffold-level.
- There is no dedicated shared component library folder yet.
- There is no Storybook or component-doc tooling yet.
- Token usage exists as CSS variables in global styles, with Tailwind theme mapping.

---

## 1. Token Definitions

### Where tokens are defined

- Global CSS custom properties are in apps/frontend/src/app/globals.css.
- Tailwind v4 theme mapping is also in apps/frontend/src/app/globals.css via @theme inline.

### Current token format/structure

- Raw semantic variables:

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}
```

- Theme mapping used by Tailwind utilities:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

- Dark mode is currently media-query driven:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```

### Token transformation system status

- No Style Dictionary, Theo, custom token build pipeline, or JSON token source is present.
- Token transformation is currently manual through CSS variables and Tailwind theme aliases.

### Rules for Figma integration

1. Add new design tokens first in globals.css as CSS custom properties.
2. Expose token aliases through @theme inline for Tailwind use.
3. Use semantic token names (surface, text-primary, border-muted) rather than raw color names.
4. Keep light/dark variants together under :root and prefers-color-scheme blocks.

---

## 2. Component Library

### Where UI components are defined

- Currently route-level components only:
  - apps/frontend/src/app/layout.tsx
  - apps/frontend/src/app/page.tsx
- No apps/frontend/src/components directory exists yet.

### Component architecture

- Next.js App Router using React Server Components by default.
- Composition currently happens directly in page.tsx.
- Alias import path `@/*` is available via tsconfig path mapping for `src/*`.

Example pattern in page-level JSX:

```tsx
export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        {/* content */}
      </main>
    </div>
  );
}
```

### Docs/storybook status

- No Storybook config or stories files are present.

### Rules for Figma integration

1. Extract reusable UI from page.tsx into apps/frontend/src/components.
2. Keep route entry files thin (layout/page should orchestrate, not contain long UI trees).
3. Name components by feature and role (HeroSection, PrimaryButton, ServiceCard).
4. If a component needs client interactivity, isolate with a client boundary file.

---

## 3. Frameworks And Libraries

### UI framework

- Next.js 16.2.2 + React 19.2.4

### Styling stack

- Tailwind CSS v4 through @tailwindcss/postcss plugin.
- Global CSS in app/globals.css.
- Utility classes in JSX.
- Current body fallback font is system stack via `Arial, Helvetica, sans-serif` in globals.css.

### Build system and bundler

- Nx monorepo orchestration at root.
- Frontend tasks are run via nx run-commands.
- Next.js build/dev/start commands run inside apps/frontend.
- Next.js handles the app bundling pipeline; no custom webpack/vite/turbo config file is present.

Example task wiring:

```json
{
  "build": {
    "executor": "nx:run-commands",
    "options": {
      "cwd": "apps/frontend",
      "command": "pnpm build"
    }
  }
}
```

Current tooling evidence:

```json
{
  "dependencies": {
    "next": "16.2.2",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4"
  }
}
```

### Rules for Figma integration

1. Default to Tailwind utility composition first.
2. Keep design implementation compatible with Next App Router conventions.
3. Do not introduce a second styling paradigm unless there is a strong architecture reason.

---

## 4. Asset Management

### Asset storage and references

- Static assets are in apps/frontend/public.
- Referenced with root-relative paths, for example /next.svg.
- Images are rendered with next/image.

Example:

```tsx
import Image from "next/image";

<Image src="/next.svg" alt="Next.js logo" width={100} height={20} priority />;
```

### Optimization techniques

- Next Image optimization is available and currently used.
- No custom optimization pipeline is present for SVG/icon/image processing.

### CDN configuration status

- No explicit CDN/assetPrefix/remote image domain config is present in next.config.ts.

Evidence:

```ts
const nextConfig: NextConfig = {
  distDir: "dist",
};
```

### Rules for Figma integration

1. Export static design assets into apps/frontend/public with descriptive names.
2. Use next/image for raster assets and important SVG illustrations when applicable.
3. Keep naming convention kebab-case and feature-scoped, for example home-hero-illustration.svg.

---

## 5. Icon System

### Current icon storage

- No dedicated icon package/folder exists.
- Current icons are plain SVG files in public (next.svg, vercel.svg, etc).
- Current files: file.svg, globe.svg, window.svg, vercel.svg, next.svg.

### Current import/usage style

- Used as static image files via next/image with src path strings.

### Naming convention status

- No enforced convention beyond scaffold defaults.

### Rules for Figma integration

1. Establish apps/frontend/public/icons for icon assets.
2. Adopt icon naming format: ic-{domain}-{name}-{size}.svg.
3. For high-volume icons, consider moving to an SVG React component pipeline later.

---

## 6. Styling Approach

### CSS methodology

- Utility-first Tailwind classes in JSX.
- Global stylesheet for tokens and base body styles.
- No CSS Modules or CSS-in-JS in current frontend source.

### Global styles

- apps/frontend/src/app/globals.css is imported by root layout.

### Responsive implementation

- Tailwind responsive prefixes are used (sm, md).
- No breakpoint token map or design-breakpoint contract file exists yet.

Example:

```tsx
<main className="... sm:items-start">
...
<a className="... md:w-39.5">Deploy Now</a>
```

### Rules for Figma integration

1. Map Figma breakpoints to Tailwind responsive classes.
2. Avoid hardcoded pixel-only responsive behavior when utility variants can express it.
3. Keep spacing, typography, and color references token-driven where possible.

---

## 7. Project Structure

### Overall organization

- Monorepo root with Nx and pnpm workspaces.
- apps/frontend for web UI.
- apps/backend for API/auth/data.

### Frontend organization

- App Router entrypoint in apps/frontend/src/app.
- Current files:
  - layout.tsx
  - page.tsx
  - globals.css

### Feature organization pattern status

- No mature feature-folder architecture yet in frontend.
- ESLint module boundary rules already anticipate future scoped libraries/tags.

### Rules for Figma integration

1. Introduce feature-first folders under apps/frontend/src/components and apps/frontend/src/features as UI grows.
2. Keep route files minimal and compose from feature components.
3. Follow existing Nx tag boundaries if/when shared libs are introduced.

---

## MCP Implementation Workflow Rules

When implementing Figma designs through MCP:

1. Pull design context first and identify reusable tokens (color, spacing, type, radius, shadow).
2. Update globals.css tokens before implementing component markup.
3. Build reusable component primitives before page assembly.
4. Use next/image and public assets for exported design media.
5. Implement responsive behavior directly with Tailwind breakpoints.
6. Keep accessibility in scope: semantic HTML, alt text, keyboard focus visibility.
7. Validate visual parity in both light and dark contexts due current token system.

Operational workflow for every Figma handoff:

1. Retrieve Figma node context.
2. Identify token gaps and update globals.css before component coding.
3. Build primitive component in `src/components/ui` first.
4. Compose feature component in `src/features`.
5. Wire route usage in `src/app`.
6. Validate keyboard and screen-size behavior.
7. Only then proceed to next handoff node.

Definition of done for a Figma-derived component:

- Uses semantic token(s) instead of arbitrary literal values.
- Avoids introducing CSS-in-JS or a second styling system.
- Keeps server/client boundaries explicit.
- Uses optimized assets and meaningful alt text.
- Keeps route files orchestration-focused.

---

## File Index Used For This Analysis

- apps/frontend/src/app/globals.css
- apps/frontend/src/app/layout.tsx
- apps/frontend/src/app/page.tsx
- apps/frontend/next.config.ts
- apps/frontend/postcss.config.mjs
- apps/frontend/package.json
- apps/frontend/project.json
- apps/frontend/AGENTS.md
- apps/frontend/README.md
- nx.json
- package.json
- apps/frontend/FIGMA_DESIGN_PLAN.md
