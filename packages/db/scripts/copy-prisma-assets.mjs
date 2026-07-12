/**
 * Copies non-TypeScript Prisma artifacts (the query-engine binary and any
 * wasm/schema assets) from the generated source tree into the compiled `dist`
 * tree, so the compiled client can resolve its engine via `__dirname` at runtime.
 *
 * tsc only emits `.js`/`.d.ts`; the engine `.node` (and friends) must be copied.
 */
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const srcDir = join(pkgRoot, 'src', 'generated', 'prisma');
const distDir = join(pkgRoot, 'dist', 'generated', 'prisma');

const isAsset = (name) =>
  /\.(node|wasm)$/.test(name) || name.endsWith('.prisma');

const entries = await readdir(srcDir, { withFileTypes: true }).catch(() => []);
const assets = entries.filter((e) => e.isFile() && isAsset(e.name));

if (assets.length === 0) {
  console.warn(
    `[copy-prisma-assets] no engine assets found in ${srcDir} - did "prisma generate" run?`,
  );
}

await mkdir(distDir, { recursive: true });
for (const asset of assets) {
  await cp(join(srcDir, asset.name), join(distDir, asset.name));
  console.log(`[copy-prisma-assets] ${asset.name}`);
}
