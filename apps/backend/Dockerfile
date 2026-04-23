FROM node:20-alpine AS base
RUN apk update && apk add --no-cache libc6-compat openssl curl python3 make g++

FROM base AS builder
WORKDIR /app
RUN npm install -g pnpm@9.0.0 turbo@^2.8.11
COPY . .
RUN turbo prune backend --docker

FROM base AS installer
WORKDIR /app

COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

RUN npm install -g pnpm@9.0.0 turbo@^2.8.11
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

# Generate Prisma client before TypeScript build so @prisma/client exports are available.
RUN pnpm --filter backend exec prisma generate

RUN turbo run build --filter=backend...

FROM base AS runner
WORKDIR /app
RUN npm install -g pnpm@9.0.0

# Copy all the monorepo over for the backend to run properly with hoisted modules
# since it doesn't have a standalone output like Next.js
COPY --from=installer /app/ .

WORKDIR /app/apps/backend

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3005/api/v1 || exit 1

CMD ["node", "dist/main.js"]
