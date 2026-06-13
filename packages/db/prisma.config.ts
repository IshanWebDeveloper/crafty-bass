import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Prisma 7 reads the connection URL for migrate/db CLI commands from here
  // (it is no longer in the schema datasource). The migrate scripts load env via
  // dotenv-cli, which sets DIRECT_URL; fall back to DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
