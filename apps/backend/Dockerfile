# Backend image for the NestJS API (build context: repo root).
#
#   docker build -f apps/backend/Dockerfile -t crafty-bass-backend .
#
# Builds the backend plus the workspace packages it depends on (@repo/db,
# @repo/auth, @repo/shared-types, @repo/validation). Works on amd64 and arm64
# (Oracle Ampere): Prisma 7 talks to Postgres through the node-postgres driver
# adapter, so there is no native query engine to match to the CPU.
FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile --filter "backend..."

# prisma.config.ts reads the URL even for `generate`; nothing connects here.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter @repo/db db:generate
RUN pnpm --filter "backend^..." build \
  && pnpm --filter backend build

FROM node:22-bookworm-slim AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/apps/backend

EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:3005/health || exit 1

CMD ["node", "dist/main.js"]
