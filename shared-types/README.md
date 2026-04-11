# shared-types

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build shared-types` to build the library.

## Running unit tests

Run `nx test shared-types` to execute the unit tests via [Vitest](https://vitest.dev/).

## Prisma Types

This package now re-exports frontend-safe Prisma model types and enums from
`shared-types/src/generated/prisma/browser`.

Example:

```ts
import type { Job, ServiceCategory } from 'shared-types';
import { JobStatus, Role } from 'shared-types';
```

Use these for shared type imports in the frontend. Prefer API-specific DTOs for
actual response contracts when backend payloads differ from raw Prisma model
shapes.

Refresh generated Prisma types with:

```bash
pnpm prisma:generate:all
pnpm prisma:check:generated
```
