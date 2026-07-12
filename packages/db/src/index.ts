/**
 * `@repo/db` - the single source for the Prisma client across the workspace.
 *
 * Always import the client and Prisma types/enums from here, never from the
 * generated output or `@prisma/client` directly. This keeps a single
 * `globalThis`-cached `PrismaClient` instance (avoids exhausting connections
 * under dev HMR / tests) and gives us one seam to swap how the client is
 * constructed (e.g. Prisma 7 driver adapters) without touching call sites.
 *
 * The client re-exported here is the generated `prisma-client` output under
 * `./generated/prisma` (self-contained: bundles the query engine), which is
 * reliably produced by `prisma generate` regardless of pnpm's build-script
 * gating - unlike the npm `@prisma/client` default, whose types depend on
 * Prisma's postinstall that this workspace blocks.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

// Re-export everything Prisma generates (PrismaClient, the `Prisma` namespace,
// `$Enums`, enums like `Role`, and model types) so consumers import only `@repo/db`.
export * from './generated/prisma/client.js';

// Prisma 7 connects through a driver adapter (node-postgres) instead of a
// datasource `url`. DATABASE_URL is the default; set PRISMA_USE_DIRECT_URL=1 to
// route through DIRECT_URL (e.g. for DDL via Better Auth's CLI). On Railway PG
// both URLs resolve to the same database - the split is kept for portability.
const connectionString =
  process.env.PRISMA_USE_DIRECT_URL === '1'
    ? process.env.DIRECT_URL
    : process.env.DATABASE_URL;

/**
 * Builds a node-postgres driver adapter for the Prisma 7 client. Exported so
 * the NestJS `PrismaService` (which extends `PrismaClient` for DI/lifecycle) and
 * test harnesses can construct their own client with the same connection wiring.
 * Prefer the shared `prisma` singleton below for app code.
 */
export const createDbAdapter = (): PrismaPg =>
  new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  __repoPrisma__?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.__repoPrisma__ ??
  new PrismaClient({ adapter: createDbAdapter() });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__repoPrisma__ = prisma;
}
