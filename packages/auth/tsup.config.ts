import { defineConfig } from 'tsup';

/**
 * Dual-format (ESM + CJS) build plus a *bundled* declaration file.
 *
 * The bundled `.d.ts` (rollup-plugin-dts) inlines the `betterAuth()` return type
 * into this package, which resolves the TS2742 "cannot be named without a
 * reference to .pnpm/..." portability error that blocks a plain `tsc` declaration
 * emit. Shipping a real `.d.ts` (instead of pointing types at the `.ts` source)
 * lets consumers resolve `@repo/auth` as an external package, so it is not pulled
 * into the backend's compilation/output tree.
 *
 * Runtime deps (better-auth, @repo/db, etc.) stay external so the singleton
 * Prisma client is shared and the bundle stays small.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // tsconfig.lib.json clears the inherited @repo/* path aliases so the bundled
  // dts resolves workspace deps (e.g. @repo/db) as external packages instead of
  // pulling their source in (which trips TS6059 rootDir).
  tsconfig: 'tsconfig.lib.json',
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    /^@repo\//,
    'better-auth',
    '@better-auth/stripe',
    'stripe',
    'resend',
    'zod',
  ],
});
