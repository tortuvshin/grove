// SPDX-License-Identifier: MIT
/**
 * Copy the built registry (packages/registry/dist/r) into the docs
 * site's public/ so it is served at https://withgrove.dev/r/<item>.json
 * — the URL template consumers put in components.json:
 *
 *   "registries": { "@grove": "https://withgrove.dev/r/{name}.json" }
 *
 * Runs before `astro build` in apps/docs. public/r/ is gitignored.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, rm } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { DIST_DIR, ROOT } from './lib/registry.mjs';

const target = resolve(ROOT, 'apps/docs/public/r');
const built = () => existsSync(resolve(DIST_DIR, 'registry.json'));

if (!built()) {
  // A fresh clone (Cloudflare / Netlify build with an apps/docs-scoped
  // install) has no packages/registry/dist yet. Build it here instead
  // of relying on the root postinstall having run.
  console.log(`${relative(ROOT, DIST_DIR)} is missing — running \`pnpm registry:build\`.`);
  const result = spawnSync('pnpm', ['--filter', '@grove-dev/registry', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0 || !built()) {
    console.error(`${relative(ROOT, DIST_DIR)} is still missing after \`pnpm registry:build\`.`);
    process.exit(1);
  }
}
await rm(target, { recursive: true, force: true });
await cp(DIST_DIR, target, { recursive: true });
console.log(`Synced registry → ${relative(ROOT, target)}/`);
