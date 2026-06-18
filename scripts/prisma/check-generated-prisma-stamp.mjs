import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, '..', '..');

const schemaPath = resolve(workspaceRoot, 'packages/db/prisma/schema.prisma');
const generatedBrowserPath = resolve(
  workspaceRoot,
  'packages/shared-types/src/generated/prisma/browser.ts',
);
const stampPath = resolve(
  workspaceRoot,
  'packages/shared-types/src/generated/prisma/.schema-hash.json',
);

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

await access(generatedBrowserPath).catch(() => {
  fail(
    'Missing shared Prisma output at packages/shared-types/src/generated/prisma/browser.ts. Run `pnpm prisma:generate:all`.',
  );
});

// Normalize line endings so the hash is identical across platforms
// (Windows checkouts may have CRLF, CI/Linux has LF).
const schema = (await readFile(schemaPath, 'utf8')).replace(/\r\n/g, '\n');
const currentHash = createHash('sha256').update(schema).digest('hex');

let stamp;
try {
  stamp = JSON.parse(await readFile(stampPath, 'utf8'));
} catch {
  fail(
    'Missing or invalid shared Prisma schema hash stamp. Run `pnpm prisma:generate:all`.',
  );
}

if (stamp?.schemaSha256 !== currentHash) {
  fail(
    'Prisma generated types are stale for @repo/shared-types. Run `pnpm prisma:generate:all` and commit generated changes.',
  );
}

console.log('Prisma generated types are in sync with schema.prisma');
