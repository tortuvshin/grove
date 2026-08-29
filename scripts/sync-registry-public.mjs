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
import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { DIST_DIR, ROOT } from "./lib/registry.mjs";

const target = resolve(ROOT, "apps/docs/public/r");

if (!existsSync(resolve(DIST_DIR, "registry.json"))) {
  console.error(`${relative(ROOT, DIST_DIR)} is missing — run \`pnpm registry:build\` first.`);
  process.exit(1);
}
await rm(target, { recursive: true, force: true });
await cp(DIST_DIR, target, { recursive: true });
console.log(`Synced registry → ${relative(ROOT, target)}/`);
