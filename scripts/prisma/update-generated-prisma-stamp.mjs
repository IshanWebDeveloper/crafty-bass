import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, '..', '..');
const schemaPath = resolve(workspaceRoot, 'packages/db/prisma/schema.prisma');
const stampPath = resolve(
  workspaceRoot,
  'packages/shared-types/src/generated/prisma/.schema-hash.json',
);

// Normalize line endings so the hash is identical across platforms
// (Windows checkouts may have CRLF, CI/Linux has LF).
const schema = (await readFile(schemaPath, 'utf8')).replace(/\r\n/g, '\n');

const schemaSha256 = createHash('sha256').update(schema).digest('hex');

await mkdir(dirname(stampPath), { recursive: true });
await writeFile(
  stampPath,
  JSON.stringify(
    {
      schemaPath: 'packages/db/prisma/schema.prisma',
      schemaSha256,
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + '\n',
  'utf8',
);

console.log(`Updated Prisma generation stamp at ${stampPath}`);
