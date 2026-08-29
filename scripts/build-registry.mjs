// SPDX-License-Identifier: MIT
/**
 * Build `@grove-dev/registry`.
 *
 *   node scripts/build-registry.mjs           validate, then `shadcn build`
 *   node scripts/build-registry.mjs --check   validate only (CI gate)
 *
 * Steps:
 *   1. Validate registry.json against the source tree (see
 *      scripts/lib/registry.mjs — coverage, derived dependencies,
 *      file types, targets, forbidden imports).
 *   2. Write registry.build.json: the authored items plus the
 *      generated `default` scaffold, each stamped with the package
 *      version. Gitignored; the authored registry.json stays the
 *      thing humans edit and review.
 *   3. `shadcn build registry.build.json --output dist/r` — the
 *      official CLI inlines every file's content into
 *      dist/r/<item>.json, which is what `shadcn add`, `grove init`,
 *      and `grove update` all consume.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import {
  BUILD_JSON,
  buildFullRegistry,
  DIST_DIR,
  REGISTRY_DIR,
  ROOT,
  validateRegistry,
} from './lib/registry.mjs';

const check = process.argv.includes('--check');

const errors = validateRegistry();
if (errors.length > 0) {
  console.error(
    `registry.json is inconsistent with packages/registry/default/ (${errors.length} problem${errors.length === 1 ? '' : 's'}):\n`,
  );
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
const full = buildFullRegistry();
console.log(
  `Registry OK — ${full.items.length - 1} items + generated default (${full.items.at(-1).files.length} files).`,
);
if (check) process.exit(0);

await writeFile(BUILD_JSON, `${JSON.stringify(full, null, 2)}\n`);
await rm(DIST_DIR, { recursive: true, force: true });
await mkdir(DIST_DIR, { recursive: true });

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'shadcn',
    'build',
    relative(REGISTRY_DIR, BUILD_JSON),
    '--output',
    relative(REGISTRY_DIR, DIST_DIR),
  ],
  { cwd: REGISTRY_DIR, stdio: 'inherit' },
);
if (result.status !== 0) {
  console.error('shadcn build failed.');
  process.exit(result.status ?? 1);
}

// Sanity-check the output the rest of the toolchain depends on.
for (const item of full.items) {
  const out = `${DIST_DIR}/${item.name}.json`;
  if (!existsSync(out)) {
    console.error(`shadcn build did not emit ${relative(ROOT, out)}`);
    process.exit(1);
  }
  const built = JSON.parse(await readFile(out, 'utf8'));
  const missing = built.files.filter((file) => typeof file.content !== 'string');
  if (missing.length > 0) {
    console.error(`${relative(ROOT, out)}: ${missing.length} file(s) have no inlined content`);
    process.exit(1);
  }
}
console.log(`Built ${full.items.length} item(s) → ${relative(ROOT, DIST_DIR)}/`);
